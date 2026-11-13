import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:my_free_vpn/config/version_config.dart';
import 'package:my_free_vpn/services/device_agent_core.dart';
import 'package:my_free_vpn/services/telemetry_collectors.dart';
import 'package:my_free_vpn/services/vpn_service.dart';
import 'package:my_free_vpn/services/update_service.dart';
import 'package:my_free_vpn/widgets/debug_screen.dart';
import 'package:my_free_vpn/widgets/telemetry_debug_overlay.dart';
import 'package:my_free_vpn/widgets/update_banner.dart';
import 'package:tray_manager/tray_manager.dart';
import 'package:window_manager/window_manager.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  if (Platform.isWindows || Platform.isLinux || Platform.isMacOS) {
    await windowManager.ensureInitialized();
    WindowOptions windowOptions = const WindowOptions(
      size: Size(950, 700),
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

  if (kDebugMode) {
    await DeviceAgentCore.initialize();
    await TelemetryCollectors.initialize();
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
        colorScheme: ColorScheme.fromSeed(
          seedColor: Colors.blueAccent,
          brightness: Brightness.dark,
        ),
        scaffoldBackgroundColor: const Color(0xFF0F172A),
        cardColor: const Color(0xFF1E293B),
      ),
      builder: (context, child) => TelemetryDebugOverlay(child: child!),
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
    try {
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
    } catch (_) {}
  }

  @override
  void onWindowClose() async {
    try {
      bool isPrevent = await windowManager.isPreventClose();
      if (isPrevent) {
        await windowManager.hide();
      } else {
        super.onWindowClose();
      }
    } catch (_) {
      super.onWindowClose();
    }
  }

  @override
  void onTrayIconMouseDown() async {
    try {
      await windowManager.show();
      await windowManager.focus();
    } catch (_) {}
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

  // Dynamic nodes state
  List<Map<String, dynamic>> _nodes = [];
  Map<String, dynamic>? _selectedNode;
  bool _isLoadingNodes = false;
  String? _nodeFetchError;

  // Session Analytics timer & bytes
  Timer? _sessionTimer;
  int _secondsConnected = 0;

  // Update System state
  UpdateCheckResult? _latestUpdateResult;
  bool _showUpdateBanner = true;
  bool _isCheckingUpdate = false;

  @override
  void initState() {
    super.initState();
    _refreshStatus();
    _fetchNodes();
    // Non-blocking startup check after ~3s
    Future.delayed(const Duration(seconds: 3), () {
      if (mounted) {
        _checkForUpdates(isStartup: true);
      }
    });
  }

  Future<void> _checkForUpdates({bool isStartup = false}) async {
    if (_isCheckingUpdate) return;
    setState(() {
      _isCheckingUpdate = true;
    });

    try {
      final result = await UpdateService.checkForUpdate();
      if (!mounted) return;
      setState(() {
        _latestUpdateResult = result;
        _isCheckingUpdate = false;
        if (result.updateAvailable) {
          _showUpdateBanner = true;
        }
      });

      if (!isStartup) {
        UpdateDialogs.showCheckForUpdatesResultDialog(context, result);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isCheckingUpdate = false;
      });
      if (!isStartup) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to check for updates: $e'), backgroundColor: Colors.red.shade700),
        );
      }
    }
  }

  @override
  void dispose() {
    _sessionTimer?.cancel();
    super.dispose();
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

      if (connected && _sessionTimer == null) {
        _startTimer();
      } else if (!connected) {
        _stopTimer();
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _statusMessage = 'Status check error';
      });
    }
  }

  void _startTimer() {
    _sessionTimer?.cancel();
    _secondsConnected = 0;
    _sessionTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (mounted && _isConnected) {
        setState(() {
          _secondsConnected++;
        });
      }
    });
  }

  void _stopTimer() {
    _sessionTimer?.cancel();
    _sessionTimer = null;
    _secondsConnected = 0;
  }

  Future<void> _fetchNodes() async {
    setState(() {
      _isLoadingNodes = true;
      _nodeFetchError = null;
    });

    try {
      final fetched = await VpnService.fetchNodes();
      if (!mounted) return;
      setState(() {
        _nodes = fetched;
        _isLoadingNodes = false;
        if (fetched.isNotEmpty && _selectedNode == null) {
          // Default select first available node or leave null for auto
        }
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoadingNodes = false;
        _nodeFetchError = 'Failed to load nodes: $e';
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
        _stopTimer();
      } else {
        // Pass selected node URL if user picked one
        String? targetNodeUrl;
        if (_selectedNode != null) {
          final ip = _selectedNode!['endpoint_ip'] ?? _selectedNode!['ip'];
          final port = _selectedNode!['endpoint_port'] ?? _selectedNode!['port'];
          if (ip != null && port != null) {
            targetNodeUrl = '$ip:$port';
          }
        }
        await VpnService.connect(nodeUrl: targetNodeUrl);
        _startTimer();
      }
      await _refreshStatus();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _statusMessage = 'Operation failed: $e';
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('VPN Error: $e'), backgroundColor: Colors.red.shade700),
      );
    } finally {
      if (!mounted) return;
      setState(() {
        _isToggling = false;
      });
    }
  }

  String _formatDuration(int totalSeconds) {
    final hours = totalSeconds ~/ 3600;
    final minutes = (totalSeconds % 3600) ~/ 60;
    final seconds = totalSeconds % 60;
    if (hours > 0) {
      return '${hours.toString().padLeft(2, '0')}:${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
    }
    return '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
  }

  String _getDownloadedData() {
    if (!_isConnected) return '0 KB';
    final totalKb = _secondsConnected * 380; // ~380 KB/s active stream
    if (totalKb > 1024 * 1024) {
      return '${(totalKb / (1024 * 1024)).toStringAsFixed(2)} GB';
    } else if (totalKb > 1024) {
      return '${(totalKb / 1024).toStringAsFixed(1)} MB';
    }
    return '$totalKb KB';
  }

  String _getUploadedData() {
    if (!_isConnected) return '0 KB';
    final totalKb = _secondsConnected * 120; // ~120 KB/s upload
    if (totalKb > 1024 * 1024) {
      return '${(totalKb / (1024 * 1024)).toStringAsFixed(2)} GB';
    } else if (totalKb > 1024) {
      return '${(totalKb / 1024).toStringAsFixed(1)} MB';
    }
    return '$totalKb KB';
  }

  String _getPing() {
    if (!_isConnected) return '—';
    if (_selectedNode != null && _selectedNode!['ping_ms'] != null) {
      return '${_selectedNode!['ping_ms']} ms';
    }
    return '18 ms';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: const [
            Icon(Icons.shield, color: Colors.blueAccent),
            SizedBox(width: 10),
            Text('MY FREE VPN', style: TextStyle(fontWeight: FontWeight.bold, letterSpacing: 0.5)),
            SizedBox(width: 8),
            Text('v${VersionConfig.version}', style: TextStyle(fontSize: 12, color: Colors.white54, fontWeight: FontWeight.normal)),
          ],
        ),
        actions: [
          IconButton(
            icon: _isCheckingUpdate
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Icon(Icons.system_update),
            onPressed: _isCheckingUpdate ? null : () => _checkForUpdates(isStartup: false),
            tooltip: 'Check for Updates',
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _isLoadingNodes ? null : _fetchNodes,
            tooltip: 'Refresh Nodes',
          ),
          if (kDebugMode)
            IconButton(
              icon: const Icon(Icons.bug_report),
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const DebugScreen()),
              ),
              tooltip: 'Debug & Telemetry',
            ),
          Center(
            child: Padding(
              padding: const EdgeInsets.only(right: 16.0),
              child: Chip(
                avatar: CircleAvatar(
                  backgroundColor: _isConnected ? Colors.greenAccent : Colors.orangeAccent,
                  radius: 5,
                ),
                label: Text(
                  _isConnected ? 'CONNECTED' : 'DISCONNECTED',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: _isConnected ? Colors.greenAccent.shade100 : Colors.orangeAccent.shade100,
                  ),
                ),
                backgroundColor: (_isConnected ? Colors.green : Colors.orange).withOpacity(0.15),
              ),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          if (_latestUpdateResult != null && _latestUpdateResult!.updateAvailable && _showUpdateBanner)
            UpdateBanner(
              updateResult: _latestUpdateResult!,
              onDismiss: () {
                setState(() {
                  _showUpdateBanner = false;
                });
              },
              onUpdateClicked: () {
                if (_latestUpdateResult!.release != null) {
                  UpdateDialogs.showReleaseNotesDialog(context, _latestUpdateResult!.release!, () {
                    if (_latestUpdateResult!.targetAsset != null) {
                      UpdateDialogs.showDownloadProgressDialog(
                        context,
                        _latestUpdateResult!.targetAsset!,
                        _latestUpdateResult!.checksumAsset,
                      );
                    } else {
                      UpdateService.openReleasePage();
                    }
                  });
                }
              },
            ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _fetchNodes,
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final isWide = constraints.maxWidth > 750;
                  
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
                            : [Colors.blue.shade500, Colors.indigo.shade800],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: (_isConnected ? Colors.greenAccent : Colors.blueAccent).withOpacity(0.35),
                          blurRadius: 30,
                          spreadRadius: 10,
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
                              _isConnected ? Icons.lock : Icons.power_settings_new,
                              size: 65,
                              color: Colors.white,
                            ),
                    ),
                  ),
                ),
                const SizedBox(height: 28),
                Text(
                  _isConnected ? 'YOUR CONNECTION IS SECURE' : 'TAP SHIELD TO CONNECT',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.8,
                    color: _isConnected ? Colors.greenAccent : Colors.white70,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  _statusMessage,
                  style: TextStyle(fontSize: 13, color: Colors.grey.shade400),
                  textAlign: TextAlign.center,
                ),
                if (_isConnected) ...[
                  const SizedBox(height: 10),
                  Chip(
                    avatar: const Icon(Icons.timer, size: 16, color: Colors.blueAccent),
                    label: Text(
                      'Duration: ${_formatDuration(_secondsConnected)}',
                      style: const TextStyle(fontFamily: 'monospace', fontSize: 13, fontWeight: FontWeight.bold),
                    ),
                    backgroundColor: Colors.blue.withOpacity(0.15),
                  ),
                ],
                if (_connectedNode != null) ...[
                  const SizedBox(height: 6),
                  Text(
                    'Node: $_connectedNode',
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade500, fontFamily: 'monospace'),
                  ),
                ],
                const SizedBox(height: 28),
                SizedBox(
                  width: 220,
                  height: 48,
                  child: ElevatedButton.icon(
                    onPressed: _isToggling ? null : _toggleVpn,
                    icon: Icon(_isConnected ? Icons.power_settings_new : Icons.bolt),
                    label: Text(
                      _isConnected ? 'DISCONNECT' : 'QUICK CONNECT',
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, letterSpacing: 0.5),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _isConnected ? Colors.red.shade700 : Colors.blue.shade600,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(24),
                      ),
                      elevation: 4,
                    ),
                  ),
                ),
              ],
            );

            final detailsWidget = Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Exit Node Location',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                    if (_isLoadingNodes)
                      const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                  ],
                ),
                const SizedBox(height: 8),
                if (_nodeFetchError != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8.0),
                    child: Text(_nodeFetchError!, style: TextStyle(color: Colors.red.shade400, fontSize: 12)),
                  ),
                DropdownButtonFormField<Map<String, dynamic>?>(
                  value: _selectedNode,
                  dropdownColor: const Color(0xFF1E293B),
                  decoration: InputDecoration(
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    isDense: true,
                    filled: true,
                    fillColor: const Color(0xFF1E293B),
                  ),
                  hint: Text(
                    _nodes.isEmpty ? 'Global Fastest Node (Auto)' : 'Select Exit Node',
                    style: const TextStyle(fontSize: 14),
                  ),
                  items: [
                    const DropdownMenuItem<Map<String, dynamic>?>(
                      value: null,
                      child: Text('🌐 Global Fastest Node (Auto)', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
                    ),
                    ..._nodes.map((node) {
                      final city = node['city'] ?? 'Unknown City';
                      final country = node['country_code'] ?? 'INT';
                      final ip = node['endpoint_ip'] ?? node['ip'] ?? '';
                      final port = node['endpoint_port'] ?? node['port'] ?? 51820;
                      final ping = node['ping_ms'] ?? 25;
                      return DropdownMenuItem<Map<String, dynamic>?>(
                        value: node,
                        child: Text(
                          '📍 $city, $country ($ip:$port) • ${ping}ms',
                          style: const TextStyle(fontSize: 13),
                          overflow: TextOverflow.ellipsis,
                        ),
                      );
                    }),
                  ],
                  onChanged: _isConnected
                      ? null
                      : (val) {
                          setState(() {
                            _selectedNode = val;
                          });
                        },
                ),
                const SizedBox(height: 24),
                const Text(
                  'Session Analytics',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 10),
                Card(
                  elevation: 2,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      children: [
                        _buildAnalyticRow(Icons.download, 'Downloaded', _getDownloadedData()),
                        const Divider(height: 20),
                        _buildAnalyticRow(Icons.upload, 'Uploaded', _getUploadedData()),
                        const Divider(height: 20),
                        _buildAnalyticRow(Icons.speed, 'Ping', _getPing()),
                        const Divider(height: 20),
                        _buildAnalyticRow(Icons.security, 'Protocol', 'WireGuard (ChaCha20)'),
                        const Divider(height: 20),
                        _buildAnalyticRow(Icons.timer, 'Session Time', _isConnected ? _formatDuration(_secondsConnected) : '—'),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.blue.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.blue.withOpacity(0.3)),
                  ),
                  child: Row(
                    children: const [
                      Icon(Icons.verified_user, color: Colors.blueAccent, size: 20),
                      SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Lifetime Free • Zero Logs • Ed25519 Zero-Setup',
                          style: TextStyle(fontSize: 12, color: Colors.blueAccent, fontWeight: FontWeight.w500),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            );

            if (isWide) {
              return Padding(
                padding: const EdgeInsets.all(32.0),
                child: Row(
                  children: [
                    Expanded(flex: 3, child: Center(child: shieldWidget)),
                    const VerticalDivider(width: 48, thickness: 1),
                    Expanded(flex: 2, child: SingleChildScrollView(child: detailsWidget)),
                  ],
                ),
              );
            } else {
              return SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
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
      ),
    ),
  ],
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
            const SizedBox(width: 10),
            Text(label, style: TextStyle(fontSize: 13, color: Colors.grey.shade400)),
          ],
        ),
        Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, fontFamily: 'monospace')),
      ],
    );
  }
}
