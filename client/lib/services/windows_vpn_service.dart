import 'dart:ffi';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:ffi/ffi.dart';

class WindowsVpnService {
  static const String _libName = 'my_free_vpn_win'; // Name of the Go executable
  static DynamicLibrary? _dylib;

  // Load the dynamic library
  static void _loadDylib() {
    if (_dylib == null) {
      try {
        if (Platform.isWindows) {
          _dylib = DynamicLibrary.open('$_libName.exe');
        } else {
          // Handle other platforms if necessary, though this class is Windows-specific
          throw UnsupportedError("Platform not supported for Windows VPN service.");
        }
      } catch (e) {
        print("Error loading dynamic library $_libName.exe: $e");
        // Handle error: perhaps the executable is not found or not compatible
        _dylib = null; // Ensure _dylib is null if loading fails
      }
    }
  }

  // Call a function from the Go executable
  // This is a placeholder and needs to be defined in the Go code
  // For example, a function named 'ConnectVpn' that takes arguments and returns a status
  static Future<bool> connect(String serverUrl, String publicKey, String deviceId) async {
    _loadDylib();
    if (_dylib == null) {
      print("Dynamic library not loaded. Cannot connect.");
      return false; // Indicate failure
    }

    try {
      // Example: Define the signature of the Go function
      // This assumes the Go function is exported as 'ConnectVpn'
      // and takes a C-style string pointer for each argument, returning an integer (0 for success, non-zero for failure)
      var connectFunc = _dylib!.lookupFunction<Int32 Function(Pointer<Utf8>, Pointer<Utf8>, Pointer<Utf8>), int Function(Pointer<Utf8>, Pointer<Utf8>, Pointer<Utf8>) >('ConnectVpn');

      // Convert Dart strings to C-style string pointers
      Pointer<Utf8> serverUrlPtr = serverUrl.toNativeUtf8();
      Pointer<Utf8> publicKeyPtr = publicKey.toNativeUtf8();
      Pointer<Utf8> deviceIdPtr = deviceId.toNativeUtf8();

      // Call the Go function
      int result = connectFunc(serverUrlPtr, publicKeyPtr, deviceIdPtr);

      // Free the C strings after use to prevent memory leaks
      malloc.free(serverUrlPtr);
      malloc.free(publicKeyPtr);
      malloc.free(deviceIdPtr);

      return result == 0; // Assuming 0 means success
    } catch (e) {
      print("Error calling Go function ConnectVpn: $e");
      return false;
    }
  }

  static Future<bool> disconnect() async {
    _loadDylib();
    if (_dylib == null) {
      print("Dynamic library not loaded. Cannot disconnect.");
      return false;
    }

    try {
      // Example: Define the signature for a disconnect function
      var disconnectFunc = _dylib!.lookupFunction<Int32 Function(), int Function()>('DisconnectVpn');
      int result = disconnectFunc();
      return result == 0;
    } catch (e) {
      print("Error calling Go function DisconnectVpn: $e");
      return false;
    }
  }
}
