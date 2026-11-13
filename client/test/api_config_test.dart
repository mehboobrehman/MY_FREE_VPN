import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:my_free_vpn/config/api_config.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('ApiConfig saves and retrieves custom host', () async {
    const testHost = '192.168.1.50';
    await ApiConfig.setCustomHost(testHost);
    final host = await ApiConfig.getCustomHost();
    expect(host, testHost);

    await ApiConfig.setCustomHost(null);
    final emptyHost = await ApiConfig.getCustomHost();
    expect(emptyHost, isNull);
  });
}
