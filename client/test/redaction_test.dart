import 'package:flutter_test/flutter_test.dart';
import 'package:my_free_vpn/services/telemetry_redactor.dart';

void main() {
  group('TelemetryRedactor PII Tests', () {
    test('redacts sensitive keys', () {
      final input = {
        'username': 'alice',
        'password': 'secretPassword123',
        'authorization': 'Bearer super-secret-jwt-token',
        'api_key': 'key_abc123xyz',
        'session_token': 'tok_98765',
        'public_info': 'safe data'
      };

      final redacted = TelemetryRedactor.redact(input);

      expect(redacted['username'], 'alice');
      expect(redacted['password'], '[REDACTED]');
      expect(redacted['authorization'], '[REDACTED]');
      expect(redacted['api_key'], '[REDACTED]');
      expect(redacted['session_token'], '[REDACTED]');
      expect(redacted['public_info'], 'safe data');
    });

    test('redacts emails and bearer tokens in strings', () {
      final input = {
        'message': 'User test@example.com logged in with token Bearer abc123xyz',
      };

      final redacted = TelemetryRedactor.redact(input);

      expect(redacted['message'], 'User [REDACTED_EMAIL] logged in with token Bearer [REDACTED]');
    });

    test('handles nested maps and lists', () {
      final input = {
        'user': {
          'email': 'admin@secure-vpn.org',
          'secret_key': '12345',
        },
        'events': [
          {'type': 'login', 'token': 'jwt-111'},
          {'type': 'click', 'target': 'connect_btn'}
        ]
      };

      final redacted = TelemetryRedactor.redact(input);

      expect(redacted['user']['email'], '[REDACTED_EMAIL]');
      expect(redacted['user']['secret_key'], '[REDACTED]');
      expect(redacted['events'][0]['token'], '[REDACTED]');
      expect(redacted['events'][1]['target'], 'connect_btn');
    });
  });
}
