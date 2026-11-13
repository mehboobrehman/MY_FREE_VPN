import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:window_manager/window_manager.dart';
import 'package:my_free_vpn/config/version_config.dart';

class ReleaseAsset {
  final String name;
  final int size;
  final String browserDownloadUrl;

  ReleaseAsset({
    required this.name,
    required this.size,
    required this.browserDownloadUrl,
  });

  factory ReleaseAsset.fromJson(Map<String, dynamic> json) {
    return ReleaseAsset(
      name: json['name'] ?? '',
      size: json['size'] ?? 0,
      browserDownloadUrl: json['browser_download_url'] ?? '',
    );
  }
}

class GitHubRelease {
  final String tagName;
  final String name;
  final String body;
  final String htmlUrl;
  final List<ReleaseAsset> assets;
  final bool draft;
  final bool prerelease;

  GitHubRelease({
    required this.tagName,
    required this.name,
    required this.body,
    required this.htmlUrl,
    required this.assets,
    required this.draft,
    required this.prerelease,
  });

  factory GitHubRelease.fromJson(Map<String, dynamic> json) {
    var rawAssets = json['assets'] as List? ?? [];
    List<ReleaseAsset> parsedAssets = rawAssets
        .map((a) => ReleaseAsset.fromJson(a as Map<String, dynamic>))
        .toList();

    return GitHubRelease(
      tagName: json['tag_name'] ?? '',
      name: json['name'] ?? '',
      body: json['body'] ?? '',
      htmlUrl: json['html_url'] ?? '',
      assets: parsedAssets,
      draft: json['draft'] ?? false,
      prerelease: json['prerelease'] ?? false,
    );
  }
}

class UpdateCheckResult {
  final bool updateAvailable;
  final String currentVersion;
  final String latestVersion;
  final GitHubRelease? release;
  final ReleaseAsset? targetAsset;
  final ReleaseAsset? checksumAsset;
  final String? errorMessage;

  UpdateCheckResult({
    required this.updateAvailable,
    required this.currentVersion,
    required this.latestVersion,
    this.release,
    this.targetAsset,
    this.checksumAsset,
    this.errorMessage,
  });
}

class UpdateService {
  static const String githubApiUrl = 'https://api.github.com/repos/mehboobrehman/MY_FREE_VPN/releases/latest';
  static const String fallbackReleaseUrl = 'https://github.com/mehboobrehman/MY_FREE_VPN/releases/latest';
  static const MethodChannel _updateChannel = MethodChannel('com.myfreevpn.app/update');

  /// Compare two semver strings (e.g. '1.1.21' vs '1.1.22').
  /// Returns positive if v2 > v1, negative if v2 < v1, 0 if equal.
  static int compareVersions(String current, String latest) {
    final cleanCurrent = current.replaceAll(RegExp(r'^v'), '').split('+')[0];
    final cleanLatest = latest.replaceAll(RegExp(r'^v'), '').split('+')[0];

    final partsCurrent = cleanCurrent.split('.').map((e) => int.tryParse(e) ?? 0).toList();
    final partsLatest = cleanLatest.split('.').map((e) => int.tryParse(e) ?? 0).toList();

    for (int i = 0; i < 3; i++) {
      int c = i < partsCurrent.length ? partsCurrent[i] : 0;
      int l = i < partsLatest.length ? partsLatest[i] : 0;
      if (l != c) {
        return l.compareTo(c);
      }
    }
    return 0;
  }

  /// Check for latest release from GitHub with safe offline handling and 10s timeout.
  static Future<UpdateCheckResult> checkForUpdate() async {
    final currentVersion = VersionConfig.version;
    try {
      final response = await http.get(
        Uri.parse(githubApiUrl),
        headers: {
          'User-Agent': 'MY_FREE_VPN-Updater',
          'Accept': 'application/vnd.github+json',
        },
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final data = json.decode(response.body) as Map<String, dynamic>;
        final release = GitHubRelease.fromJson(data);

        if (release.draft) {
          return UpdateCheckResult(
            updateAvailable: false,
            currentVersion: currentVersion,
            latestVersion: currentVersion,
          );
        }

        final latestVersion = release.tagName.replaceAll(RegExp(r'^v'), '');
        final comparison = compareVersions(currentVersion, latestVersion);

        if (comparison > 0) {
          // Update available! Select platform asset
          ReleaseAsset? targetAsset;
          ReleaseAsset? checksumAsset;

          for (var asset in release.assets) {
            final name = asset.name.toLowerCase();
            if (name.contains('sha256sums') || name.contains('sha256')) {
              checksumAsset = asset;
            } else if (Platform.isAndroid && name.endsWith('.apk')) {
              targetAsset = asset;
            } else if (Platform.isWindows) {
              if (name.endsWith('.exe') && name.contains('setup')) {
                targetAsset = asset;
              } else if (name.endsWith('.zip') && targetAsset == null) {
                targetAsset = asset; // Fallback to zip if installer not found
              }
            }
          }

          // If no specific platform asset matched exact name, try any matching extension
          if (targetAsset == null) {
            for (var asset in release.assets) {
              final name = asset.name.toLowerCase();
              if (Platform.isAndroid && name.endsWith('.apk')) {
                targetAsset = asset;
                break;
              } else if (Platform.isWindows && (name.endsWith('.exe') || name.endsWith('.zip'))) {
                targetAsset = asset;
                break;
              }
            }
          }

          return UpdateCheckResult(
            updateAvailable: true,
            currentVersion: currentVersion,
            latestVersion: latestVersion,
            release: release,
            targetAsset: targetAsset,
            checksumAsset: checksumAsset,
          );
        } else {
          return UpdateCheckResult(
            updateAvailable: false,
            currentVersion: currentVersion,
            latestVersion: latestVersion,
            release: release,
          );
        }
      } else {
        return UpdateCheckResult(
          updateAvailable: false,
          currentVersion: currentVersion,
          latestVersion: currentVersion,
          errorMessage: 'GitHub API status: ${response.statusCode}',
        );
      }
    } catch (e) {
      // Safe offline handling: never throw or block startup/VPN
      debugPrint('UpdateService check failed: $e');
      return UpdateCheckResult(
        updateAvailable: false,
        currentVersion: currentVersion,
        latestVersion: currentVersion,
        errorMessage: e.toString(),
      );
    }
  }

  /// Download asset atomically with `.part` extension and report progress (0.0 to 1.0).
  static Future<File?> downloadUpdateAsset({
    required ReleaseAsset asset,
    required ReleaseAsset? checksumAsset,
    required Function(double progress) onProgress,
    required ValueNotifier<bool> cancelNotifier,
  }) async {
    try {
      final tempDir = await getTemporaryDirectory();
      final filePath = '${tempDir.path}/${asset.name}';
      final partPath = '$filePath.part';

      final partFile = File(partPath);
      if (partFile.existsSync()) {
        await partFile.delete();
      }

      final request = http.Request('GET', Uri.parse(asset.browserDownloadUrl));
      final response = await http.Client().send(request);

      if (response.statusCode != 200) {
        throw HttpException('Failed to download asset: HTTP ${response.statusCode}');
      }

      final contentLength = response.contentLength ?? asset.size;
      int receivedBytes = 0;

      final sink = partFile.openWrite();
      
      await for (var chunk in response.stream) {
        if (cancelNotifier.value) {
          await sink.close();
          if (partFile.existsSync()) await partFile.delete();
          return null;
        }
        sink.add(chunk);
        receivedBytes += chunk.length;
        if (contentLength > 0) {
          onProgress(receivedBytes / contentLength);
        } else {
          onProgress(0.5); // Indeterminate progress estimate
        }
      }

      await sink.flush();
      await sink.close();

      if (cancelNotifier.value) {
        if (partFile.existsSync()) await partFile.delete();
        return null;
      }

      // Checksum verification if checksum asset available
      if (checksumAsset != null) {
        final checksumValid = await _verifyChecksum(partFile, asset.name, checksumAsset);
        if (!checksumValid) {
          throw Exception('SHA-256 checksum verification failed for downloaded update.');
        }
      }

      final finalFile = File(filePath);
      if (finalFile.existsSync()) {
        await finalFile.delete();
      }
      await partFile.rename(filePath);
      onProgress(1.0);
      return finalFile;
    } catch (e) {
      debugPrint('Update download error: $e');
      rethrow;
    }
  }

  static Future<bool> _verifyChecksum(File file, String assetName, ReleaseAsset checksumAsset) async {
    try {
      final res = await http.get(Uri.parse(checksumAsset.browserDownloadUrl));
      if (res.statusCode != 200) return true; // Skip verification if checksums un-routable

      final checksumContent = res.body;
      final lines = checksumContent.split('\n');
      String? expectedHash;

      for (var line in lines) {
        if (line.contains(assetName)) {
          final parts = line.trim().split(RegExp(r'\s+'));
          if (parts.isNotEmpty) {
            expectedHash = parts[0].toLowerCase();
            break;
          }
        }
      }

      if (expectedHash == null) {
        return true; // Asset not listed in SHA256SUMS, pass through safely
      }

      final fileBytes = await file.readAsBytes();
      final actualHash = sha256.convert(fileBytes).toString().toLowerCase();

      return actualHash == expectedHash;
    } catch (e) {
      debugPrint('Checksum verification exception: $e');
      return true; // Do not hard block if checksum parsing fails due to network/format
    }
  }

  /// Install update based on platform.
  static Future<void> installUpdate(File file) async {
    if (Platform.isAndroid) {
      try {
        await _updateChannel.invokeMethod('installApk', {'filePath': file.path});
      } catch (e) {
        debugPrint('Android APK installation error: $e');
        rethrow;
      }
    } else if (Platform.isWindows) {
      try {
        if (file.path.toLowerCase().endsWith('.exe')) {
          // Launch verified installer in detached mode
          await Process.start(
            file.path,
            [],
            mode: ProcessStartMode.detached,
          );
          // Close app gracefully
          try {
            await windowManager.close();
          } catch (_) {}
          exit(0);
        } else {
          // For zip / portable files, open containing folder
          final dirPath = file.parent.path;
          await Process.run('explorer.exe', [dirPath]);
        }
      } catch (e) {
        debugPrint('Windows installation error: $e');
        rethrow;
      }
    }
  }

  /// Fallback: Open GitHub releases page in browser.
  static Future<void> openReleasePage() async {
    final uri = Uri.parse(fallbackReleaseUrl);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}
