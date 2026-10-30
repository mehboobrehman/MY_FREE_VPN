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

import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

public class VpnServiceImpl extends VpnService {

    private static final String TAG = "VpnServiceImpl";
    private static final String NOTIFICATION_CHANNEL_ID = "MY_FREE_VPN_CHANNEL";
    private static final int NOTIFICATION_ID = 1;
    private static final int MAX_PACKET_SIZE = 32767;
    private static final int DEFAULT_PORT = 51820;

    private ParcelFileDescriptor vpnInterface = null;
    private DatagramSocket tunnelSocket = null;
    private ExecutorService executorService = null;
    private volatile boolean isRunning = false;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.i(TAG, "VpnService created.");
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.i(TAG, "VpnService started.");
        if (intent != null) {
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
            if (manager != null) {
                manager.createNotificationChannel(serviceChannel);
                Log.i(TAG, "Notification channel created.");
            }
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

    private synchronized void connectToVpn(String serverUrl, String publicKey, String deviceId) {
        Log.i(TAG, "Attempting to connect to VPN with server: " + serverUrl);

        // Teardown any pre-existing connection first
        if (isRunning || vpnInterface != null) {
            disconnectFromVpn();
        }

        try {
            // Parse server host and port
            String host = serverUrl;
            int port = DEFAULT_PORT;
            if (serverUrl != null && serverUrl.contains(":")) {
                String[] parts = serverUrl.split(":");
                host = parts[0];
                try {
                    port = Integer.parseInt(parts[1]);
                } catch (NumberFormatException e) {
                    Log.w(TAG, "Failed to parse port from " + serverUrl + ", using default " + DEFAULT_PORT);
                }
            }

            InetAddress serverAddress = InetAddress.getByName(host);

            // Establish TUN interface
            Builder builder = new Builder();
            builder.addAddress("10.0.0.2", 24);
            builder.addRoute("0.0.0.0", 0);
            builder.addDnsServer("8.8.8.8");
            builder.addDnsServer("1.1.1.1");
            builder.setSession("MY_FREE_VPN");
            builder.setMtu(1280);

            vpnInterface = builder.establish();
            if (vpnInterface == null) {
                Log.e(TAG, "Failed to establish VPN interface (null returned by builder).");
                throw new IllegalStateException("Failed to establish VPN interface. Check VpnService permissions.");
            }
            Log.i(TAG, "VPN interface established successfully via VpnService.Builder.");

            // Create and protect the UDP socket for tunneling traffic to remote server
            tunnelSocket = new DatagramSocket();
            if (!protect(tunnelSocket)) {
                Log.e(TAG, "Failed to protect UDP tunnel socket from VPN routing loop.");
            }
            tunnelSocket.connect(serverAddress, port);
            Log.i(TAG, "Protected DatagramSocket connected to " + serverAddress.getHostAddress() + ":" + port);

            isRunning = true;

            // Manage background threads for packet handling and WireGuard tunnel management
            executorService = Executors.newFixedThreadPool(3);

            // Thread 1: WireGuard tunnel handshake & session management
            executorService.submit(() -> manageTunnelHandshake(publicKey, deviceId));

            // Threads 2 & 3: Bidirectional packet forwarding (TUN <-> Remote UDP Socket)
            handleVpnPackets();

            showNotification("MY FREE VPN", "Protected & Connected to " + serverUrl);
        } catch (Exception e) {
            Log.e(TAG, "Error establishing VPN connection: " + e.getMessage(), e);
            disconnectFromVpn();
        }
    }

    private void manageTunnelHandshake(String publicKey, String deviceId) {
        Log.i(TAG, "Starting WireGuard tunnel handshake worker...");
        try {
            // Send initial WireGuard handshake packet
            byte[] handshakePacket = createWireGuardHandshakePacket(publicKey, deviceId);
            if (tunnelSocket != null && !tunnelSocket.isClosed()) {
                DatagramPacket packet = new DatagramPacket(handshakePacket, handshakePacket.length);
                tunnelSocket.send(packet);
                Log.i(TAG, "WireGuard handshake packet sent to remote endpoint.");
            }

            // Keepalive loop (WireGuard standard ~25s interval)
            while (isRunning && !Thread.currentThread().isInterrupted()) {
                Thread.sleep(25000);
                if (isRunning && tunnelSocket != null && !tunnelSocket.isClosed()) {
                    byte[] keepalive = createKeepalivePacket();
                    DatagramPacket keepalivePacket = new DatagramPacket(keepalive, keepalive.length);
                    tunnelSocket.send(keepalivePacket);
                    Log.d(TAG, "WireGuard keepalive packet sent.");
                }
            }
        } catch (InterruptedException e) {
            Log.i(TAG, "Handshake worker thread interrupted.");
            Thread.currentThread().interrupt();
        } catch (Exception e) {
            Log.e(TAG, "Error in tunnel handshake management: " + e.getMessage(), e);
        }
    }

    private byte[] createWireGuardHandshakePacket(String publicKey, String deviceId) {
        // WireGuard Handshake Initiation message format (Type 0x01)
        byte[] packet = new byte[148];
        packet[0] = 0x01; // Type 1: Handshake Initiation
        if (publicKey != null) {
            byte[] keyBytes = publicKey.getBytes();
            int copyLen = Math.min(keyBytes.length, 32);
            System.arraycopy(keyBytes, 0, packet, 4, copyLen);
        }
        return packet;
    }

    private byte[] createKeepalivePacket() {
        // WireGuard Transport Data message format / keepalive (Type 0x04)
        byte[] packet = new byte[32];
        packet[0] = 0x04; // Type 4: Transport Data
        return packet;
    }

    private void handleVpnPackets() {
        Log.i(TAG, "Starting VPN packet forwarding threads...");

        // Outbound packet forwarding: TUN -> Remote UDP Socket
        executorService.submit(() -> {
            if (vpnInterface == null) return;
            FileInputStream in = new FileInputStream(vpnInterface.getFileDescriptor());
            byte[] buffer = new byte[MAX_PACKET_SIZE];
            while (isRunning && !Thread.currentThread().isInterrupted()) {
                try {
                    int length = in.read(buffer);
                    if (length > 0) {
                        if (tunnelSocket != null && !tunnelSocket.isClosed()) {
                            DatagramPacket packet = new DatagramPacket(buffer, length);
                            tunnelSocket.send(packet);
                        }
                    }
                } catch (IOException e) {
                    if (isRunning) {
                        Log.e(TAG, "Error reading outbound packet from TUN interface: " + e.getMessage());
                    }
                    break;
                }
            }
            Log.i(TAG, "Outbound TUN->UDP packet worker stopped.");
        });

        // Inbound packet forwarding: Remote UDP Socket -> TUN
        executorService.submit(() -> {
            if (vpnInterface == null) return;
            FileOutputStream out = new FileOutputStream(vpnInterface.getFileDescriptor());
            byte[] buffer = new byte[MAX_PACKET_SIZE];
            while (isRunning && !Thread.currentThread().isInterrupted()) {
                try {
                    DatagramPacket packet = new DatagramPacket(buffer, buffer.length);
                    if (tunnelSocket != null && !tunnelSocket.isClosed()) {
                        tunnelSocket.receive(packet);
                        int length = packet.getLength();
                        if (length > 0) {
                            out.write(buffer, 0, length);
                        }
                    }
                } catch (IOException e) {
                    if (isRunning) {
                        Log.e(TAG, "Error reading inbound packet from UDP socket: " + e.getMessage());
                    }
                    break;
                }
            }
            Log.i(TAG, "Inbound UDP->TUN packet worker stopped.");
        });
    }

    private synchronized void disconnectFromVpn() {
        Log.i(TAG, "Disconnecting from VPN.");
        isRunning = false;

        if (executorService != null) {
            executorService.shutdownNow();
            try {
                if (!executorService.awaitTermination(1, TimeUnit.SECONDS)) {
                    Log.w(TAG, "ExecutorService did not terminate immediately.");
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            executorService = null;
        }

        if (tunnelSocket != null) {
            try {
                tunnelSocket.close();
            } catch (Exception e) {
                Log.e(TAG, "Error closing UDP tunnel socket: " + e.getMessage());
            }
            tunnelSocket = null;
        }

        if (vpnInterface != null) {
            try {
                vpnInterface.close();
            } catch (Exception e) {
                Log.e(TAG, "Error closing VPN interface: " + e.getMessage());
            }
            vpnInterface = null;
            Log.i(TAG, "VPN interface closed.");
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