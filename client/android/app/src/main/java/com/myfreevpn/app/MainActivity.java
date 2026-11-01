package com.myfreevpn.app;

import android.app.Activity; // Added
import android.content.Intent;
import android.os.Bundle;
import android.util.Log; // Added
import android.net.VpnService; // Added

import androidx.annotation.NonNull;
import io.flutter.embedding.android.FlutterActivity;
import io.flutter.embedding.engine.FlutterEngine;
import io.flutter.plugin.common.BinaryMessenger;
import io.flutter.plugin.common.MethodCall;
import io.flutter.plugin.common.MethodChannel;
import io.flutter.plugins.GeneratedPluginRegistrant;

public class MainActivity extends FlutterActivity {
  private static final String CHANNEL = "com.myfreevpn.app/vpn";
  private static final int VPN_REQUEST_CODE = 1001; // Unique request code for VPN permission

  private MethodChannel _channel;
  private Object _vpnConnectArgs; // To store arguments for connect call
  private MethodChannel.Result _vpnResult; // To store the result callback


  @Override
  public void configureFlutterEngine(@NonNull FlutterEngine flutterEngine) {
    GeneratedPluginRegistrant.registerWith(flutterEngine);

    BinaryMessenger messenger = flutterEngine.getDartExecutor().getBinaryMessenger();
    _channel = new MethodChannel(messenger, CHANNEL); // Assign to member variable
    _channel.setMethodCallHandler(new VpnChannelHandler(this));
  }

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
  }

  // Added: Handle result of the VPN permission request activity
  @Override
  protected void onActivityResult(int requestCode, int resultCode, Intent data) {
      if (requestCode == VPN_REQUEST_CODE) {
          if (resultCode == RESULT_OK) {
              // Permission granted, start the VPN service using stored args and result
              if (_vpnResult != null && _vpnConnectArgs != null) {
                  startVpnService(_vpnConnectArgs, _vpnResult);
              } else {
                  Log.e("MainActivity", "onActivityResult: _vpnResult or _vpnConnectArgs is null after permission granted.");
                  if (_vpnResult != null) {
                      _vpnResult.error("INTERNAL_ERROR", "Failed to retrieve connection details after permission grant.", null);
                  }
              }
          } else {
              // Permission denied by the user
              if (_vpnResult != null) {
                  _vpnResult.error("VPN_PERMISSION_DENIED", "User denied VPN permission", null);
              } else {
                   Log.e("MainActivity", "onActivityResult: _vpnResult is null when permission denied.");
              }
          }
          // Clear stored values regardless of success or failure
          _vpnResult = null;
          _vpnConnectArgs = null;
          return; // Handled, so return
      }
      // For other activity results, call the superclass method
      super.onActivityResult(requestCode, resultCode, data);
  }

  // Added: Helper method to start the VpnServiceImpl
  private void startVpnService(Object args, MethodChannel.Result result) {
      try {
          Intent serviceIntent = new Intent(this, VpnServiceImpl.class);
          serviceIntent.setAction("connect");
          // The arguments passed from Dart are Map<String, Object>, which is Serializable
          serviceIntent.putExtra("arguments", (java.io.Serializable) args);
          startService(serviceIntent);
          result.success(null);
      } catch (Exception e) {
          Log.e("MainActivity", "Error starting VpnServiceImpl: " + e.getMessage(), e);
          result.error("VPN_START_ERROR", "Failed to start VPN service", e.getMessage());
      }
  }


  /** Routes VPN connect/disconnect calls from Dart to the Android VpnService. */
  private static class VpnChannelHandler implements MethodChannel.MethodCallHandler {
    private final MainActivity activity; // This is how VpnChannelHandler gets MainActivity instance

    VpnChannelHandler(MainActivity activity) {
      this.activity = activity;
    }

    @Override
    public void onMethodCall(@NonNull MethodCall call, @NonNull MethodChannel.Result result) {
      switch (call.method) {
        case "connect":
          // Check for VPN permission before starting the service
          Intent prepareIntent = VpnService.prepare(activity); // Use 'activity' from VpnChannelHandler
          if (prepareIntent == null) {
            // Permission already granted, start the service directly
            activity.startVpnService(call.arguments, result); // Call helper method on MainActivity
          } else {
            // Permission not granted, request it
            activity._vpnConnectArgs = call.arguments; // Store arguments in MainActivity member
            activity._vpnResult = result;              // Store the result callback in MainActivity member
            activity.startActivityForResult(prepareIntent, VPN_REQUEST_CODE); // Start activity for result
          }
          break;
        case "disconnect":
          Intent disconnectIntent = new Intent(activity, VpnServiceImpl.class);
          disconnectIntent.setAction("disconnect");
          activity.startService(disconnectIntent);
          result.success(null);
          break;
        default:
          result.notImplemented();
      }
    }
  }
}
