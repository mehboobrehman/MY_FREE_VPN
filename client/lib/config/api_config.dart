import 'package:shared_preferences/shared_preferences.dart';

class ApiConfig {
  static const String _prefsKey = 'custom_dev_api_host';
  
  static Future<String?> getCustomHost() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_prefsKey);
  }

  static Future<void> setCustomHost(String? host) async {
    final prefs = await SharedPreferences.getInstance();
    if (host == null || host.trim().isEmpty) {
      await prefs.remove(_prefsKey);
    } else {
      await prefs.setString(_prefsKey, host.trim());
    }
  }
}
