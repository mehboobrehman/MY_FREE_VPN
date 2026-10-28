package com.myfreevpn.app;

import android.content.Intent;
import android.os.Bundle;

import androidx.annotation.NonNull;
import io.flutter.embedding.android.FlutterActivity;
import io.flutter.embedding.engine.FlutterEngine;
import io.flutter.embedding.engine.plugins.FlutterPlugin;
import io.flutter.plugin.common.BinaryMessenger;
import io.flutter.plugin.common.MethodCall;
import io.flutter.plugin.common.MethodChannel;
import io.flutter.plugins.GeneratedPluginRegistrant;

public class MainActivity extends FlutterActivity {
  private static final String CHANNEL = "com.myfreevpn.app/vpn";
  private MethodChannel _channel;

  @Override
  public void configureFlutterEngine(@NonNull FlutterEngine flutterEngine) {
    GeneratedPluginRegistrant.registerWith(flutterEngine);

    BinaryMessenger messenger = flutterEngine.getDartExecutor().getBinaryMessenger();
    _channel = new MethodChannel(messenger, CHANNEL);
    _channel.setMethodCallHandler(new VpnChannelHandler(this));
  }

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
  }

  /** Routes VPN connect/disconnect calls from Dart to the Android VpnService. */
  private static class VpnChannelHandler implements MethodChannel.MethodCallHandler, FlutterPlugin {
    private final MainActivity activity;

    VpnChannelHandler(MainActivity activity) {
      this.activity = activity;
    }

    @Override
    public void onMethodCall(@NonNull MethodCall call, @NonNull MethodChannel.Result result) {
      switch (call.method) {
        case "connect":
          Intent connectIntent = new Intent(activity, VpnServiceImpl.class);
          connectIntent.setAction("connect");
          connectIntent.putExtra("arguments", (java.io.Serializable) call.arguments);
          activity.startService(connectIntent);
          result.success(null);
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

    @Override
    public void onAttachedToEngine(@NonNull FlutterPluginBinding binding) {
      // Not used; handler is attached via MethodChannel in configureFlutterEngine
    }

    @Override
    public void onDetachedFromEngine(@NonNull FlutterPluginBinding binding) {
      // No-op
    }
  }
}
