import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:my_free_vpn/services/device_agent_core.dart';
import 'package:my_free_vpn/services/agent_logger.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('DeviceAgentCore exposes state stream and kDebugMode gating', () async {
    expect(kDebugMode, isTrue);
    expect(DeviceAgentCore.currentState, isNotNull);

    final states = <AgentConnectionState>[];
    final sub = DeviceAgentCore.stateStream.listen(states.add);

    await DeviceAgentCore.initialize();
    await sub.cancel();

    expect(DeviceAgentCore.currentState, isNotNull);
  });
}
