import 'dart:convert';

/// Robust PII Redactor for MY_FREE_VPN Device Agent Core.
/// Masks sensitive data (tokens, authorization headers, passwords, emails, API keys, secrets)
/// before telemetry events are buffered or transmitted.
class TelemetryRedactor {
  static final RegExp _emailRegex = RegExp(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+');
  static final Set<String> _sensitiveKeys = {
    'authorization', 'token', 'password', 'passwd', 'pwd', 'secret',
    'api_key', 'apikey', 'credential', 'private_key', 'seed', 'session_token',
    'auth', 'bearer', 'access_token', 'refresh_token'
  };

  /// Recursively inspects and redacts sensitive keys and PII patterns in maps, lists, and strings.
  static dynamic redact(dynamic value) {
    if (value == null) return null;
    if (value is String) {
      return _redactString(value);
    } else if (value is Map) {
      final redactedMap = <String, dynamic>{};
      value.forEach((k, v) {
        final keyStr = k.toString().toLowerCase();
        if (_sensitiveKeys.contains(keyStr) || _sensitiveKeys.any((sk) => keyStr.contains(sk))) {
          redactedMap[k.toString()] = '[REDACTED]';
        } else {
          redactedMap[k.toString()] = redact(v);
        }
      });
      return redactedMap;
    } else if (value is List) {
      return value.map((item) => redact(item)).toList();
    }
    return value;
  }

  static String _redactString(String input) {
    String output = input;
    // Redact email addresses
    output = output.replaceAll(_emailRegex, '[REDACTED_EMAIL]');
    // Redact Bearer tokens in strings
    output = output.replaceAll(RegExp(r'Bearer\s+[A-Za-z0-9\-\_\.\+\/]+=*', caseSensitive: false), 'Bearer [REDACTED]');
    return output;
  }
}
