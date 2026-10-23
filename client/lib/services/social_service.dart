import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:encrypt/encrypt.dart' as encrypt;
import 'package:pointycastle/api.dart' as pointycastle;
import 'package:pointycastle/asymmetric/api.dart' as ec_api;
import 'package:pointycastle/signers/ecdsa_signer.dart';
import 'package:pointycastle/macs/hmac.dart';
import 'package:pointycastle/digests/sha256.dart';
import 'package:flutter_udid/flutter_udid.dart';
import 'package:uuid/uuid.dart';
import 'package:logger/logger.dart';

class SocialPost {
  final String postId;
  final String authorUuid;
  final String pseudonymId;
  final String content;
  final List<String> tags;
  final int createdAt;
  final int likesCount;
  final bool flagged;
  final String? moderationReason;

  SocialPost({
    required this.postId,
    required this.authorUuid,
    required this.pseudonymId,
    required this.content,
    required this.tags,
    required this.createdAt,
    required this.likesCount,
    required this.flagged,
    this.moderationReason,
  });

  factory SocialPost.fromJson(Map<String, dynamic> json) {
    return SocialPost(
      postId: json['post_id'] ?? '',
      authorUuid: json['author_uuid'] ?? '',
      pseudonymId: json['pseudonym_id'] ?? 'Anonymous',
      content: json['content'] ?? '',
      tags: json['tags'] != null ? List<String>.from(json['tags']) : [],
      createdAt: json['created_at'] ?? DateTime.now().millisecondsSinceEpoch,
      likesCount: json['likes_count'] ?? 0,
      flagged: json['flagged'] ?? false,
      moderationReason: json['moderation_reason'],
    );
  }
}

class SocialComment {
  final String commentId;
  final String postId;
  final String authorUuid;
  final String pseudonymId;
  final String content;
  final int createdAt;

  SocialComment({
    required this.commentId,
    required this.postId,
    required this.authorUuid,
    required this.pseudonymId,
    required this.content,
    required this.createdAt,
  });

  factory SocialComment.fromJson(Map<String, dynamic> json) {
    return SocialComment(
      commentId: json['comment_id'] ?? '',
      postId: json['post_id'] ?? '',
      authorUuid: json['author_uuid'] ?? '',
      pseudonymId: json['pseudonym_id'] ?? 'Anonymous',
      content: json['content'] ?? '',
      createdAt: json['created_at'] ?? DateTime.now().millisecondsSinceEpoch,
    );
  }
}

class UserProfile {
  final String deviceUuid;
  final String pseudonymId;
  final String publicKey;
  final int createdAt;
  final int postsCount;

  UserProfile({
    required this.deviceUuid,
    required this.pseudonymId,
    required this.publicKey,
    required this.createdAt,
    required this.postsCount,
  });

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      deviceUuid: json['device_uuid'] ?? '',
      pseudonymId: json['pseudonym_id'] ?? 'Anonymous',
      publicKey: json['public_key'] ?? '',
      createdAt: json['created_at'] ?? 0,
      postsCount: json['posts_count'] ?? 0,
    );
  }
}

class SocialService {
  static final Logger _logger = Logger();
  static const String baseUrl = 'http://127.0.0.1:8080/api/v1/social';

  /// Get or generate Device UUID
  static Future<String> _getDeviceId() async {
    final prefs = await SharedPreferences.getInstance();
    String? deviceId = prefs.getString('_deviceId');
    if (deviceId == null) {
      try {
        deviceId = await FlutterUdid.consistentIdentity;
      } catch (e) {
        deviceId = const Uuid().v4();
      }
      await prefs.setString('_deviceId', deviceId);
    }
    return deviceId;
  }

  /// Get or generate cryptographic key pair & signature for headers
  static Future<Map<String, String>> _getAuthHeaders(String payloadString) async {
    final deviceUuid = await _getDeviceId();
    final prefs = await SharedPreferences.getInstance();
    
    // Ensure keypair exists in prefs or generate
    String? publicKey = prefs.getString('_publicKey');
    String? privateKeyHex = prefs.getString('_privateKeyHex');

    if (publicKey == null || privateKeyHex == null) {
      // Generate EC key pair
      final domainParams = pointycastle.ECDomainParameters('prime256v1');
      final keyGenParams = pointycastle.ECKeyGeneratorParameters(domainParams);
      final keyGenerator = pointycastle.ECKeyGenerator()..init(keyGenParams);
      final keyPair = keyGenerator.generateKeyPair();

      final pubKey = keyPair.publicKey as ec_api.ECPublicKey;
      final privKey = keyPair.privateKey as ec_api.ECPrivateKey;

      final pubBytes = pubKey.Q!.getEncoded(false);
      publicKey = base64Encode(pubBytes);
      privateKeyHex = privKey.d!.toRadixString(16);

      await prefs.setString('_publicKey', publicKey);
      await prefs.setString('_privateKeyHex', privateKeyHex);
    }

    // Sign deviceUuid or payload using private key
    // For compatibility with backend verifyDeviceSignature which signs deviceUuid or request
    final messageBytes = utf8.encode(deviceUuid);
    
    // Sign using ECDSA signer
    final privKeyParam = ec_api.ECPrivateKey(
      BigInt.parse(privateKeyHex, radix: 16),
      pointycastle.ECDomainParameters('prime256v1'),
    );

    final signer = ECDSASigner(SHA256Digest(), HMac(SHA256Digest(), 64));
    signer.init(true, pointycastle.PrivateKeyParameter<ec_api.ECPrivateKey>(privKeyParam));
    
    final sig = signer.generateSignature(messageBytes) as pointycastle.ECSignature;
    
    // Encode r and s as base64 signature
    final sigBytes = utf8.encode('${sig.r.toRadixString(16)}:${sig.s.toRadixString(16)}');
    final signatureBase64 = base64Encode(sigBytes);

    return {
      'Content-Type': 'application/json',
      'x-device-uuid': deviceUuid,
      'x-signature': signatureBase64,
    };
  }

  static Future<List<SocialPost>> getPosts({int page = 1, int limit = 20, String? tag}) async {
    try {
      final headers = await _getAuthHeaders('');
      String url = '$baseUrl/posts?page=$page&limit=$limit';
      if (tag != null && tag.isNotEmpty) {
        url += '&tag=$tag';
      }

      final response = await http.get(Uri.parse(url), headers: headers);
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final List list = data['posts'] ?? [];
        return list.map((item) => SocialPost.fromJson(item)).toList();
      } else {
        throw Exception('Failed to load posts: ${response.statusCode}');
      }
    } catch (e) {
      _logger.e('Error fetching posts: $e');
      rethrow;
    }
  }

  static Future<SocialPost> createPost(String content, List<String> tags) async {
    try {
      final payload = jsonEncode({'content': content, 'tags': tags});
      final headers = await _getAuthHeaders(payload);

      final response = await http.post(
        Uri.parse('$baseUrl/posts'),
        headers: headers,
        body: payload,
      );

      if (response.statusCode == 201) {
        final data = jsonDecode(response.body);
        return SocialPost.fromJson(data['post']);
      } else {
        final errorData = jsonDecode(response.body);
        throw Exception(errorData['error'] ?? 'Failed to create post');
      }
    } catch (e) {
      _logger.e('Error creating post: $e');
      rethrow;
    }
  }

  static Future<List<SocialComment>> getComments(String postId) async {
    try {
      final headers = await _getAuthHeaders('');
      final response = await http.get(
        Uri.parse('$baseUrl/posts/$postId/comments'),
        headers: headers,
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final List list = data['comments'] ?? [];
        return list.map((item) => SocialComment.fromJson(item)).toList();
      } else {
        throw Exception('Failed to load comments: ${response.statusCode}');
      }
    } catch (e) {
      _logger.e('Error fetching comments: $e');
      rethrow;
    }
  }

  static Future<SocialComment> createComment(String postId, String content) async {
    try {
      final payload = jsonEncode({'content': content});
      final headers = await _getAuthHeaders(payload);

      final response = await http.post(
        Uri.parse('$baseUrl/posts/$postId/comments'),
        headers: headers,
        body: payload,
      );

      if (response.statusCode == 201) {
        final data = jsonDecode(response.body);
        return SocialComment.fromJson(data['comment']);
      } else {
        final errorData = jsonDecode(response.body);
        throw Exception(errorData['error'] ?? 'Failed to create comment');
      }
    } catch (e) {
      _logger.e('Error creating comment: $e');
      rethrow;
    }
  }

  static Future<UserProfile> getUserProfile() async {
    try {
      final headers = await _getAuthHeaders('');
      final response = await http.get(
        Uri.parse('$baseUrl/profile'),
        headers: headers,
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return UserProfile.fromJson(data['profile']);
      } else {
        throw Exception('Failed to load profile: ${response.statusCode}');
      }
    } catch (e) {
      _logger.e('Error fetching profile: $e');
      rethrow;
    }
  }
}
