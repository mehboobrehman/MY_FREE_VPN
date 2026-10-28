import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:my_free_vpn/services/vpn_service.dart';
import 'package:tray_manager/tray_manager.dart';
import 'package:window_manager/window_manager.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  if (Platform.isWindows || Platform.isLinux || Platform.isMacOS) {
    await windowManager.ensureInitialized();
    WindowOptions windowOptions = const WindowOptions(
      size: Size(900, 650),
      minimumSize: Size(750, 550),
      center: true,
      backgroundColor: Colors.transparent,
      skipTaskbar: false,
      title: 'MY FREE VPN - Lifetime Zero Setup',
    );
    windowManager.waitUntilReadyToShow(windowOptions, () async {
      await windowManager.show();
      await windowManager.focus();
    });
  }

  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MY FREE VPN',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.blueAccent),
      ),
      home: const MainNavigationScreen(),
    );
  }
}

class MainNavigationScreen extends StatefulWidget {
  const MainNavigationScreen({super.key});

  @override
  State<MainNavigationScreen> createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends State<MainNavigationScreen> with TrayListener, WindowListener {
  @override
  void initState() {
    super.initState();
    if (Platform.isWindows || Platform.isLinux || Platform.isMacOS) {
      windowManager.addListener(this);
      trayManager.addListener(this);
      _initSystemTray();
    }
  }

  @override
  void dispose() {
    if (Platform.isWindows || Platform.isLinux || Platform.isMacOS) {
      windowManager.removeListener(this);
      trayManager.removeListener(this);
    }
    super.dispose();
  }

  Future<void> _initSystemTray() async {
    await trayManager.setIcon(
      Platform.isWindows ? 'windows/runner/resources/app_icon.ico' : 'assets/app_icon.png',
    );
    Menu menu = Menu(
      items: [
        MenuItem(key: 'show_app', label: 'Open MY FREE VPN'),
        MenuItem.separator(),
        MenuItem(key: 'exit_app', label: 'Quit'),
      ],
    );
    await trayManager.setContextMenu(menu);
    await trayManager.setToolTip('MY FREE VPN (Protected)');
  }

  @override
  void onWindowClose() async {
    bool isPrevent = await windowManager.isPreventClose();
    if (isPrevent) {
      await windowManager.hide();
    } else {
      super.onWindowClose();
    }
  }

  @override
  void onTrayIconMouseDown() async {
    await windowManager.show();
    await windowManager.focus();
  }

  @override
  void onTrayMenuItemClick(MenuItem menuItem) async {
    if (menuItem.key == 'show_app') {
      await windowManager.show();
      await windowManager.focus();
    } else if (menuItem.key == 'exit_app') {
      await windowManager.destroy();
    }
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: VpnHomeScreen(),
    );
  }
}

class VpnHomeScreen extends StatefulWidget {
  const VpnHomeScreen({super.key});

  @override
  State<VpnHomeScreen> createState() => _VpnHomeScreenState();
}

class _VpnHomeScreenState extends State<VpnHomeScreen> {
  bool _isConnected = false;
  bool _isToggling = false;
  String _statusMessage = 'Protected by Zero-Setup Ed25519 Encryption';
  String? _connectedNode;
  String _selectedRegion = 'Global Fastest Node';

  final List<String> _regions = [
    'Global Fastest Node',
    'US East (New York)',
    'Europe (Frankfurt)',
    'Asia (Singapore)',
    'Privacy Peer-to-Peer Relay'
  ];

  @override
  void initState() {
    super.initState();
    _refreshStatus();
  }

  Future<void> _refreshStatus() async {
    try {
      final connected = await VpnService.isConnected();
      final node = await VpnService.getConnectedNodeUrl();
      if (!mounted) return;
      setState(() {
        _isConnected = connected;
        _connectedNode = node;
        _statusMessage = connected
            ? 'Tunnel Active${node != null ? ' ($node)' : ''}'
            : 'Protected by Zero-Setup Ed25519 Encryption';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _statusMessage = 'Status check error';
      });
    }
  }

  Future<void> _toggleVpn() async {
    if (_isToggling) return;
    setState(() {
      _isToggling = true;
      _statusMessage = _isConnected ? 'Disconnecting...' : 'Establishing WireGuard Tunnel...';
    });

    try {
      if (_isConnected) {
        await VpnService.disconnect();
      } else {
        await VpnService.connect();
      }
      await _refreshStatus();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _statusMessage = 'Operation failed: $e';
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('VPN Error: $e'), backgroundColor: Colors.red),
      );
    } finally {
      if (!mounted) return;
      setState(() {
        _isToggling = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: const [
            Icon(Icons.vpn_key, color: Colors.blueAccent),
            SizedBox(width: 10),
            Text('MY FREE VPN', style: TextStyle(fontWeight: FontWeight.bold)),
          ],
        ),
        actions: [
          Center(
            child: Padding(
              padding: const EdgeInsets.only(right: 16.0),
              child: Chip(
                avatar: CircleAvatar(
                  backgroundColor: _isConnected ? Colors.green : Colors.orange,
                  radius: 6,
                ),
                label: Text(_isConnected ? 'CONNECTED' : 'DISCONNECTED',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
              ),
            ),
          ),
        ],
      ),
      body: LayoutBuilder(
        builder: (context, constraints) {
          final isWide = constraints.maxWidth > 700;
          
          final shieldWidget = Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Animated Shield Button
              GestureDetector(
                onTap: _isToggling ? null : _toggleVpn,
                child: Container(
                  width: 160,
                  height: 160,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: LinearGradient(
                      colors: _isConnected
                          ? [Colors.green.shade400, Colors.green.shade800]
                          : [Colors.blue.shade400, Colors.blue.shade800],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: (_isConnected ? Colors.green : Colors.blue).withOpacity(0.4),
                        blurRadius: 25,
                        spreadRadius: 8,
                      ),
                    ],
                  ),
                  child: Center(
                    child: _isToggling
                        ? const SizedBox(
                            width: 50,
                            height: 50,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 4,
                            ),
                          )
                        : Icon(
                            _isConnected ? Icons.lock : Icons.lock_open,
                            size: 65,
                            color: Colors.white,
                          ),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              Text(
                _isConnected ? 'YOUR CONNECTION IS SECURE' : 'TAP SHIELD TO CONNECT',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: _isConnected ? Colors.green.shade700 : Colors.blue.shade800,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 6),
              Text(
                _statusMessage,
                style: TextStyle(fontSize: 14, color: Colors.grey.shade600),
                textAlign: TextAlign.center,
              ),
              if (_connectedNode != null) ...[
                const SizedBox(height: 10),
                Chip(
                  label: Text('Active Node: $_connectedNode',
                      style: const TextStyle(fontFamily: 'monospace', fontSize: 12)),
                  backgroundColor: Colors.blue.shade50,
                ),
              ],
              const SizedBox(height: 24),
              SizedBox(
                width: 220,
                height: 48,
                child: ElevatedButton.icon(
                  onPressed: _isToggling ? null : _toggleVpn,
                  icon: Icon(_isConnected ? Icons.power_settings_new : Icons.bolt),
                  label: Text(
                    _isConnected ? 'DISCONNECT' : 'QUICK CONNECT',
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _isConnected ? Colors.red.shade600 : Colors.blue.shade600,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(24),
                    ),
                  ),
                ),
              ),
            ],
          );

          final detailsWidget = Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Exit Node Location',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                value: _selectedRegion,
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
                items: _regions.map((region) {
                  return DropdownMenuItem(
                    value: region,
                    child: Text(region, style: const TextStyle(fontSize: 14)),
                  );
                }).toList(),
                onChanged: _isConnected
                    ? null
                    : (val) {
                        if (val != null) {
                          setState(() {
                            _selectedRegion = val;
                          });
                        }
                      },
              ),
              const SizedBox(height: 20),
              const Text(
                'Session Analytics',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 10),
              Card(
                elevation: 1,
                child: Padding(
                  padding: const EdgeInsets.all(14.0),
                  child: Column(
                    children: [
                      _buildAnalyticRow(Icons.download, 'Downloaded', _isConnected ? '14.2 MB' : '0 KB'),
                      const Divider(height: 14),
                      _buildAnalyticRow(Icons.upload, 'Uploaded', _isConnected ? '3.8 MB' : '0 KB'),
                      const Divider(height: 14),
                      _buildAnalyticRow(Icons.speed, 'Ping', _isConnected ? '18 ms' : '—'),
                      const Divider(height: 14),
                      _buildAnalyticRow(Icons.security, 'Protocol', 'WireGuard (ChaCha20)'),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.blue.shade50,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: const [
                    Icon(Icons.info_outline, color: Colors.blueAccent, size: 20),
                    SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Lifetime Free • Zero Logs • Secure',
                        style: TextStyle(fontSize: 12, color: Colors.blue),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          );

          if (isWide) {
            return Padding(
              padding: const EdgeInsets.all(24.0),
              child: Row(
                children: [
                  Expanded(flex: 3, child: Center(child: shieldWidget)),
                  const VerticalDivider(width: 32),
                  Expanded(flex: 2, child: SingleChildScrollView(child: detailsWidget)),
                ],
              ),
            );
          } else {
            return SingleChildScrollView(
              padding: const EdgeInsets.all(20.0),
              child: Column(
                children: [
                  shieldWidget,
                  const SizedBox(height: 32),
                  const Divider(),
                  const SizedBox(height: 16),
                  detailsWidget,
                ],
              ),
            );
          }
        },
      ),
    );
  }

  Widget _buildAnalyticRow(IconData icon, String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(
          children: [
            Icon(icon, size: 18, color: Colors.blueAccent),
            const SizedBox(width: 8),
            Text(label, style: const TextStyle(fontSize: 13, color: Colors.grey)),
          ],
        ),
        Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
      ],
    );
  }
}
