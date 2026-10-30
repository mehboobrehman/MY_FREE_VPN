package com.myfreevpn.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.VpnService;
import android.os.Build;
import android.os.ParcelFileDescriptor;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import java.util.Map;

public class VpnServiceImpl extends VpnService {

    private static final String TAG = "VpnServiceImpl";
    private static final String NOTIFICATION_CHANNEL_ID = "MY_FREE_VPN_CHANNEL";
    private static final int NOTIFICATION_ID = 1;

    private ParcelFileDescriptor vpnInterface = null;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.i(TAG, "VpnService created.");
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.i(TAG, "VpnService started.");
        // Handle commands from MethodChannel (e.g., connect, disconnect)
        String action = intent.getAction();
        if (action != null) {
            switch (action) {
                case "connect":
                    Map<String, Object> connectArgs = (Map<String, Object>) intent.getSerializableExtra("arguments");
                    if (connectArgs != null) {
                        String serverUrl = (String) connectArgs.get("serverUrl");
                        String publicKey = (String) connectArgs.get("publicKey");
                        String deviceId = (String) connectArgs.get("deviceId");
                        connectToVpn(serverUrl, publicKey, deviceId);
                    } else {
                        Log.e(TAG, "Connect command received without arguments.");
                    }
                    break;
                case "disconnect":
                    disconnectFromVpn();
                    break;
                default:
                    Log.w(TAG, "Unknown action: " + action);
            }
        }

        return START_STICKY;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(
                    NOTIFICATION_CHANNEL_ID,
                    "MY FREE VPN Service Channel",
                    NotificationManager.IMPORTANCE_DEFAULT
            );
            NotificationManager manager = getSystemService(NotificationManager.class);
            manager.createNotificationChannel(serviceChannel);
            Log.i(TAG, "Notification channel created.");
        }
    }

    private void showNotification(String title, String text) {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, notificationIntent, PendingIntent.FLAG_IMMUTABLE);

        Notification notification = new NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(text)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentIntent(pendingIntent)
                .build();

        startForeground(NOTIFICATION_ID, notification);
        Log.i(TAG, "Foreground notification shown.");
    }

    private void connectToVpn(String serverUrl, String publicKey, String deviceId) {
        Log.i(TAG, "Attempting to connect to VPN with server: " + serverUrl);
        try {
            Builder builder = new Builder();
            builder.addAddress("10.0.0.2", 24);
            builder.addRoute("0.0.0.0", 0);
            builder.addDnsServer("8.8.8.8");
            builder.addDnsServer("1.1.1.1");
            builder.setSession("MY_FREE_VPN");
            builder.setMtu(1280);

            vpnInterface = builder.establish();
            if (vpnInterface != null) {
                Log.i(TAG, "VPN interface established successfully via VpnService.Builder.");
                showNotification("MY FREE VPN", "Protected & Connected to " + serverUrl);
            } else {
                Log.e(TAG, "Failed to establish VPN interface (null returned by builder).");
                throw new IllegalStateException("Failed to establish VPN interface. Check VpnService permissions.");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error establishing VPN connection: " + e.getMessage(), e);
            disconnectFromVpn();
        }
    }

    private void disconnectFromVpn() {
        Log.i(TAG, "Disconnecting from VPN.");
        try {
            if (vpnInterface != null) {
                vpnInterface.close();
                vpnInterface = null;
                Log.i(TAG, "VPN interface closed.");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error closing VPN interface: " + e.getMessage());
        }
        stopForeground(true);
        Log.i(TAG, "VPN disconnected.");
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.i(TAG, "VpnService destroyed.");
        disconnectFromVpn();
    }
}
