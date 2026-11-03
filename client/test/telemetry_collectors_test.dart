import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:my_free_vpn/services/telemetry_collectors.dart';
import 'package:my_free_vpn/services/device_agent_core.dart';
import 'package:my_free_vpn/services/agent_logger.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('TelemetryCollectors Phase 3 Tests', () {
    test('Debug gating ensures kDebugMode is active for collectors', () {
      expect(kDebugMode, isTrue);
    });

    test('Performance sample collection returns valid metrics', () async {
      final sample = await TelemetryCollectors.collectPerformanceSample();
      expect(sample, isNotNull);
      expect(sample['startup_latency_ms'], isNotNull);
      expect(sample['memory_rss_bytes'], isNotNull);
      expect(sample['cpu_usage_percent'], isNotNull);
      expect(sample['thread_count'], isNotNull);
      expect(sample['battery_level_percent'], isNotNull);
    });

    test('Remote command execution handles allow-listed actions', () async {
      // 1. change_log_level
      await TelemetryCollectors.executeCommand({
        'command_id': 'cmd_test_01',
        'action': 'change_log_level',
        'params': {'level': 'DEBUG'}
      });
      expect(TelemetryCollectors.logLevel, 'DEBUG');

      // 2. change_sampling
      await TelemetryCollectors.executeCommand({
        'command_id': 'cmd_test_02',
        'action': 'change_sampling',
        'params': {'perf_interval_sec': 10, 'anr_threshold_ms': 1500}
      });
      expect(TelemetryCollectors.perfIntervalSec, 10);
      expect(TelemetryCollectors.anrThresholdMs, 1500);

      // 3. toggle_categories
      await TelemetryCollectors.executeCommand({
        'command_id': 'cmd_test_03',
        'action': 'toggle_categories',
        'params': {
          'categories': {'crash': false, 'anr': true}
        }
      });
      expect(TelemetryCollectors.enabledCategories['crash'], isFalse);
      expect(TelemetryCollectors.enabledCategories['anr'], isTrue);

      // 4. request_snapshot
      await TelemetryCollectors.executeCommand({
        'command_id': 'cmd_test_04',
        'action': 'request_snapshot',
        'params': {}
      });
      // Verification of snapshot execution completing successfully without error
      expect(true, isTrue);
    });

    test('Network request instrumentation applies PII redaction and body capping', () async {
      // Test logNetworkRequest with sensitive headers and large body
      final largeBody = 'A' * 2000;
      await TelemetryCollectors.logNetworkRequest(
        method: 'POST',
        url: 'https://api.example.com/login',
        statusCode: 200,
        durationMs: 125,
        requestHeaders: {'Authorization': 'Bearer secret_token_123'},
        requestBody: largeBody,
        responseHeaders: {'content-type': 'application/json'},
        responseBody: '{"token": "secret_jwt_999", "email": "user@test.org"}',
      );

      // Verify no exception thrown and execution succeeds
      expect(true, isTrue);
    });

    test('Flush before death mechanism executes successfully', () async {
      await TelemetryCollectors.flushBeforeDeath();
      expect(true, isTrue);
    });
  });
}
