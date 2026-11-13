package com.myfreevpn.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.net.VpnService;

import androidx.annotation.NonNull;
import androidx.core.content.FileProvider;
import io.flutter.embedding.android.FlutterActivity;
import io.flutter.embedding.engine.FlutterEngine;
import io.flutter.plugin.common.BinaryMessenger;
import io.flutter.plugin.common.MethodCall;
import io.flutter.plugin.common.MethodChannel;
import io.flutter.plugins.GeneratedPluginRegistrant;

import java.io.File;

public class MainActivity extends FlutterActivity {
  private static final String CHANNEL = "com.myfreevpn.app/vpn";
  private static final String UPDATE_CHANNEL = "com.myfreevpn.app/update";
  private static final int VPN_REQUEST_CODE = 1001; // Unique request code for VPN permission

  private MethodChannel _channel;
  private Object _vpnConnectArgs; // To store arguments for connect call
  private MethodChannel.Result _vpnResult; // To store the result callback


  @Override
  public void configureFlutterEngine(@NonNull FlutterEngine flutterEngine) {
    GeneratedPluginRegistrant.registerWith(flutterEngine);

    BinaryMessenger messenger = flutterEngine.getDartExecutor().getBinaryMessenger();
    _channel = new MethodChannel(messenger, CHANNEL);
    _channel.setMethodCallHandler(new VpnChannelHandler(this));

    // Register update channel
    new MethodChannel(messenger, UPDATE_CHANNEL).setMethodCallHandler(new UpdateChannelHandler(this));
  }

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
  }

  // Handle result of the VPN permission request activity
  @Override
  protected void onActivityResult(int requestCode, int resultCode, Intent data) {
      if (requestCode == VPN_REQUEST_CODE) {
          if (resultCode == RESULT_OK) {
              if (_vpnResult != null && _vpnConnectArgs != null) {
                  startVpnService(_vpnConnectArgs, _vpnResult);
              } else {
                  Log.e("MainActivity", "onActivityResult: _vpnResult or _vpnConnectArgs is null after permission granted.");
                  if (_vpnResult != null) {
                      _vpnResult.error("INTERNAL_ERROR", "Failed to retrieve connection details after permission grant.", null);
                  }
              }
          } else {
              if (_vpnResult != null) {
                  _vpnResult.error("VPN_PERMISSION_DENIED", "User denied VPN permission", null);
              } else {
                   Log.e("MainActivity", "onActivityResult: _vpnResult is null when permission denied.");
              }
          }
          _vpnResult = null;
          _vpnConnectArgs = null;
          return;
      }
      super.onActivityResult(requestCode, resultCode, data);
  }

  // Helper method to start the VpnServiceImpl
  private void startVpnService(Object args, MethodChannel.Result result) {
      try {
          Intent serviceIntent = new Intent(this, VpnServiceImpl.class);
          serviceIntent.setAction("connect");
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
    private final MainActivity activity;

    VpnChannelHandler(MainActivity activity) {
      this.activity = activity;
    }

    @Override
    public void onMethodCall(@NonNull MethodCall call, @NonNull MethodChannel.Result result) {
      switch (call.method) {
        case "connect":
          Intent prepareIntent = VpnService.prepare(activity);
          if (prepareIntent == null) {
            activity.startVpnService(call.arguments, result);
          } else {
            activity._vpnConnectArgs = call.arguments;
            activity._vpnResult = result;
            activity.startActivityForResult(prepareIntent, VPN_REQUEST_CODE);
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

  /** Handles APK installation requests via FileProvider and Intent.ACTION_VIEW */
  private static class UpdateChannelHandler implements MethodChannel.MethodCallHandler {
    private final MainActivity activity;

    UpdateChannelHandler(MainActivity activity) {
      this.activity = activity;
    }

    @Override
    public void onMethodCall(@NonNull MethodCall call, @NonNull MethodChannel.Result result) {
      if (call.method.equals("installApk")) {
        String filePath = call.argument("filePath");
        try {
          File file = new File(filePath);
          Intent intent = new Intent(Intent.ACTION_VIEW);
          Uri apkUri;
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            apkUri = FileProvider.getUriForFile(
                activity,
                activity.getApplicationContext().getPackageName() + ".fileprovider",
                file
            );
            intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
          } else {
            apkUri = Uri.fromFile(file);
            intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
          }
          intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
          activity.startActivity(intent);
          result.success(true);
        } catch (Exception e) {
          Log.e("MainActivity", "Error installing APK: " + e.getMessage(), e);
          result.error("INSTALL_ERROR", e.getMessage(), null);
        }
      } else {
        result.notImplemented();
      }
    }
  }
}
