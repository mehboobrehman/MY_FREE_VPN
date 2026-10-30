import 'dart:convert';
import 'dart:io';
import 'package:sqflite/sqflite.dart';
import 'package:path_provider/path_provider.dart';

/// Log entry model representing telemetry or app logs.
class LogEntry {
  final int? id;
  final String level; // INFO, WARN, ERROR, DEBUG, HTTP
  final String tag;
  final String message;
  final String? metadata;
  final int timestamp;

  LogEntry({
    this.id,
    required this.level,
    required this.tag,
    required this.message,
    this.metadata,
    required this.timestamp,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'level': level,
      'tag': tag,
      'message': message,
      'metadata': metadata,
      'timestamp': timestamp,
    };
  }

  factory LogEntry.fromMap(Map<String, dynamic> map) {
    return LogEntry(
      id: map['id'] as int?,
      level: map['level'] as String,
      tag: map['tag'] as String,
      message: map['message'] as String,
      metadata: map['metadata'] as String?,
      timestamp: map['timestamp'] as int,
    );
  }
}

/// AgentLogger provides robust local SQLite persistence (offline logs & telemetry events),
/// network interception logging, and log retrieval/management for the Debug UI.
class AgentLogger {
  static Database? _database;
  static const String _tableName = 'agent_logs';

  /// Initialize SQLite database for local persistence.
  static Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDb();
    return _database!;
  }

  static Future<Database> _initDb() async {
    String path;
    if (Platform.isAndroid || Platform.isIOS) {
      final Directory documentsDirectory = await getApplicationDocumentsDirectory();
      path = '${documentsDirectory.path}/my_free_vpn_telemetry.db';
    } else {
      // For desktop / tests, use current directory or temporary directory
      final Directory tempDir = await getTemporaryDirectory();
      path = '${tempDir.path}/my_free_vpn_telemetry.db';
    }

    return await openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE $_tableName (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            level TEXT NOT NULL,
            tag TEXT NOT NULL,
            message TEXT NOT NULL,
            metadata TEXT,
            timestamp INTEGER NOT NULL
          )
        ''');
      },
    );
  }

  /// Log an event or message to local SQLite storage.
  static Future<void> log(String level, String tag, String message, {Map<String, dynamic>? metadata}) async {
    try {
      final db = await database;
      final entry = LogEntry(
        level: level.toUpperCase(),
        tag: tag,
        message: message,
        metadata: metadata != null ? jsonEncode(metadata) : null,
        timestamp: DateTime.now().millisecondsSinceEpoch,
      );
      await db.insert(_tableName, entry.toMap(), conflictAlgorithm: ConflictAlgorithm.replace);
    } catch (e) {
      // Fallback print if DB fails
      print('AgentLogger DB error: $e');
    }
  }

  static Future<void> i(String tag, String message, {Map<String, dynamic>? metadata}) =>
      log('INFO', tag, message, metadata: metadata);

  static Future<void> w(String tag, String message, {Map<String, dynamic>? metadata}) =>
      log('WARN', tag, message, metadata: metadata);

  static Future<void> e(String tag, String message, {Map<String, dynamic>? metadata}) =>
      log('ERROR', tag, message, metadata: metadata);

  static Future<void> d(String tag, String message, {Map<String, dynamic>? metadata}) =>
      log('DEBUG', tag, message, metadata: metadata);

  /// Log HTTP network interception events.
  static Future<void> logHttp({
    required String method,
    required String url,
    required int statusCode,
    required int durationMs,
    Map<String, String>? requestHeaders,
    String? requestBody,
    Map<String, String>? responseHeaders,
    String? responseBody,
    String? error,
  }) async {
    final metadata = {
      'method': method,
      'url': url,
      'status_code': statusCode,
      'duration_ms': durationMs,
      if (requestHeaders != null) 'request_headers': requestHeaders,
      if (requestBody != null) 'request_body': requestBody,
      if (responseHeaders != null) 'response_headers': responseHeaders,
      if (responseBody != null) 'response_body': responseBody,
      if (error != null) 'error': error,
    };

    final level = statusCode >= 400 || error != null ? 'ERROR' : 'HTTP';
    await log(level, 'NetworkInterceptor', '$method $url [$statusCode] (${durationMs}ms)', metadata: metadata);
  }

  /// Retrieve recent log entries (up to [limit]).
  static Future<List<LogEntry>> getRecentLogs({int limit = 100}) async {
    try {
      final db = await database;
      final List<Map<String, dynamic>> maps = await db.query(
        _tableName,
        orderBy: 'timestamp DESC',
        limit: limit,
      );
      return maps.map((map) => LogEntry.fromMap(map)).toList();
    } catch (e) {
      print('AgentLogger fetch error: $e');
      return [];
    }
  }

  /// Clear all stored log entries.
  static Future<void> clearLogs() async {
    try {
      final db = await database;
      await db.delete(_tableName);
    } catch (e) {
      print('AgentLogger clear error: $e');
    }
  }
}
