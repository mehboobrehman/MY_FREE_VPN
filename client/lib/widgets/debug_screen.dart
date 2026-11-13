import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:my_free_vpn/config/version_config.dart';
import 'package:my_free_vpn/config/api_config.dart';
import '../services/agent_logger.dart';

import '../services/vpn_service.dart';
import '../services/device_agent_core.dart';

/// Debug UI / Debug Drawer / activity in the Android client to view recent log entries,
/// server status, device/emulator details, node-fetch results, `adb reverse` instructions,
/// and export/copy debug reports.
class DebugScreen extends StatefulWidget {
  const DebugScreen({super.key});

  @override
  State<DebugScreen> createState() => _DebugScreenState();
}

class _DebugScreenState extends State<DebugScreen> {
  List<LogEntry> _logs = [];
  bool _isLoading = true;
  String _serverStatus = 'Checking...';
  bool _isFetchingNodes = false;
  String? _customHost;
  final TextEditingController _ipController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  @override
  void dispose() {
    _ipController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    final logs = await AgentLogger.getRecentLogs(limit: 150);
    final customHost = await ApiConfig.getCustomHost();
    setState(() {
      _logs = logs;
      _isLoading = false;
      _customHost = customHost;
      _ipController.text = customHost ?? '';
      _serverStatus = DeviceAgentCore.currentState == AgentConnectionState.connected
          ? 'Online (Connected)'
          : DeviceAgentCore.currentState == AgentConnectionState.degraded
              ? 'Degraded (Relay)'
              : 'Offline / Connecting';
    });
  }

  Future<void> _saveCustomHost() async {
    final ip = _ipController.text.trim();
    await ApiConfig.setCustomHost(ip.isEmpty ? null : ip);
    await DeviceAgentCore.updateManualIp(ip.isEmpty ? null : ip);
    await _loadData();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ip.isEmpty ? 'Reset to default backend host.' : 'Custom backend host saved: $ip')),
      );
    }
  }

  Future<void> _resetCustomHost() async {
    _ipController.clear();
    await ApiConfig.setCustomHost(null);
    await DeviceAgentCore.updateManualIp(null);
    await _loadData();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Backend host reset to default.')),
      );
    }
  }

  Future<void> _clearLogs() async {
    await AgentLogger.clearLogs();
    await _loadData();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Telemetry logs cleared successfully.')),
      );
    }
  }

  Future<void> _refreshNodes() async {
    setState(() => _isFetchingNodes = true);
    await VpnService.fetchNodes();
    await _loadData();
    setState(() => _isFetchingNodes = false);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Nodes refreshed. Count: ${VpnService.lastNodeFetchCount}')),
      );
    }
  }

  Future<void> _exportDebugReport() async {
    final logs = await AgentLogger.getRecentLogs(limit: 50);
    final buffer = StringBuffer();
    buffer.writeln('# MY_FREE_VPN Debug & Telemetry Report');
    buffer.writeln('- App Version: v${VersionConfig.version}');
    buffer.writeln('- Platform: ${Platform.operatingSystem} (${Platform.operatingSystemVersion})');
    buffer.writeln('- Debug Mode: $kDebugMode');
    buffer.writeln('- Device Architecture / Target: ${Platform.isAndroid ? "Android Emulator/Device" : Platform.operatingSystem}');
    buffer.writeln('- Active Telemetry Endpoint: ${DeviceAgentCore.discoveredEndpoint ?? "None"}');
    buffer.writeln('- Last Node Fetch Status: ${VpnService.lastNodeFetchStatus}');
    buffer.writeln('- Last Node Fetch Count: ${VpnService.lastNodeFetchCount}');
    buffer.writeln('- Last Node Fetch Duration: ${VpnService.lastNodeFetchDurationMs}ms');
    buffer.writeln('- Last Node Fetch Timestamp: ${VpnService.lastNodeFetchTimestamp != null ? DateTime.fromMillisecondsSinceEpoch(VpnService.lastNodeFetchTimestamp!) : "Never"}');
    buffer.writeln('\n## Recent Sanitized Logs (${logs.length})');
    for (final log in logs) {
      buffer.writeln('- [${log.level}] [${log.tag}] ${DateTime.fromMillisecondsSinceEpoch(log.timestamp)}: ${log.message}');
      if (log.metadata != null) {
        buffer.writeln('  Metadata: ${log.metadata}');
      }
    }

    await Clipboard.setData(ClipboardData(text: buffer.toString()));
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Debug report copied to clipboard (Markdown format)!')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final String platformName = Platform.isAndroid
        ? 'Android Emulator / Device'
        : Platform.isWindows
            ? 'Windows Desktop'
            : Platform.operatingSystem;

    final String nodeFetchTimeStr = VpnService.lastNodeFetchTimestamp != null
        ? DateTime.fromMillisecondsSinceEpoch(VpnService.lastNodeFetchTimestamp!).toIso8601String()
        : 'Never fetched';

    return Scaffold(
      appBar: AppBar(
        title: const Text('MY FREE VPN - Debug & Telemetry'),
        actions: [
          IconButton(
            icon: const Icon(Icons.copy),
            onPressed: _exportDebugReport,
            tooltip: 'Export Debug Report',
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadData,
            tooltip: 'Refresh Logs',
          ),
          IconButton(
            icon: const Icon(Icons.delete_sweep),
            onPressed: _clearLogs,
            tooltip: 'Clear Logs',
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 1. Server Status & Version Header Card
            Container(
              padding: const EdgeInsets.all(16.0),
              color: Colors.blue.shade50,
              child: Row(
                children: [
                  const Icon(Icons.shield, color: Colors.blueAccent, size: 32),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Server Status: $_serverStatus (v${VersionConfig.version})',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Zero-Setup Encryption: Ed25519 Verified\nRAM-Only Ephemeral Exit Nodes Active',
                          style: TextStyle(fontSize: 12, color: Colors.black87),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),

            // 2. Device & Emulator Details Card
            Card(
              margin: const EdgeInsets.all(12),
              elevation: 2,
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.phone_android, color: Colors.indigo, size: 20),
                        SizedBox(width: 8),
                        Text(
                          'Device & Emulator Diagnostics',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                        ),
                      ],
                    ),
                    const Divider(),
                    Text('Platform: $platformName'),
                    const SizedBox(height: 4),
                    Text('OS Version: ${Platform.operatingSystemVersion}'),
                    const SizedBox(height: 4),
                    Text('Debug Mode: $kDebugMode (Dart SDK: ${Platform.version.split(" ").first})'),
                    const SizedBox(height: 4),
                    Text('Telemetry Endpoint: ${DeviceAgentCore.discoveredEndpoint ?? "None"}'),
                  ],
                ),
              ),
            ),
            // Development API Host / LAN IP Card (Debug-gated)
            if (kDebugMode)
              Card(
                margin: const EdgeInsets.all(12),
                elevation: 2,
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.router, color: Colors.deepOrange, size: 20),
                          SizedBox(width: 8),
                          Text(
                            'Development API Host / LAN IP',
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                          ),
                        ],
                      ),
                      const Divider(),
                      Text('Current Custom Host: ${_customHost ?? "Not set (Using default 10.0.2.2 / 127.0.0.1)"}'),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _ipController,
                        decoration: const InputDecoration(
                          labelText: 'PC LAN IP (e.g. 192.168.1.50)',
                          border: OutlineInputBorder(),
                          isDense: true,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          TextButton.icon(
                            onPressed: _resetCustomHost,
                            icon: const Icon(Icons.restore),
                            label: const Text('Reset'),
                          ),
                          const SizedBox(width: 8),
                          ElevatedButton.icon(
                            onPressed: _saveCustomHost,
                            icon: const Icon(Icons.save),
                            label: const Text('Save IP'),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),

            // 3. Last Node-Fetch Results Card
            Card(
              margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              elevation: 2,
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.cloud_download, color: Colors.teal, size: 20),
                            SizedBox(width: 8),
                            Text(
                              'Last Node-Fetch Results',
                              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                            ),
                          ],
                        ),
                        ElevatedButton.icon(
                          onPressed: _isFetchingNodes ? null : _refreshNodes,
                          icon: _isFetchingNodes
                              ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                              : const Icon(Icons.sync, size: 16),
                          label: const Text('Fetch Now', style: TextStyle(fontSize: 12)),
                        ),
                      ],
                    ),
                    const Divider(),
                    Text('Status: ${VpnService.lastNodeFetchStatus}'),
                    const SizedBox(height: 4),
                    Text('Node Count: ${VpnService.lastNodeFetchCount}'),
                    const SizedBox(height: 4),
                    Text('Duration: ${VpnService.lastNodeFetchDurationMs} ms'),
                    const SizedBox(height: 4),
                    Text('Timestamp: $nodeFetchTimeStr'),
                  ],
                ),
              ),
            ),

            // 4. `adb reverse` Instructions Card
            Card(
              margin: const EdgeInsets.all(12),
              elevation: 2,
              color: Colors.amber.shade50,
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Row(
                      children: [
                        Icon(Icons.terminal, color: Colors.deepOrange, size: 20),
                        SizedBox(width: 8),
                        Text(
                          'Android Emulator `adb reverse` Instructions',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                        ),
                      ],
                    ),
                    Divider(),
                    Text(
                      'To allow the Android emulator to connect to your local backend runner on port 48392, run the following command in your terminal:',
                      style: TextStyle(fontSize: 12),
                    ),
                    SizedBox(height: 8),
                    SelectableText(
                      'adb reverse tcp:48392 tcp:48392',
                      style: TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.bold, fontSize: 13, color: Colors.deepPurple),
                    ),
                    SizedBox(height: 6),
                    Text(
                      'This forwards port 48392 from the emulator back to the host machine (localhost).',
                      style: TextStyle(fontSize: 11, color: Colors.black54),
                    ),
                  ],
                ),
              ),
            ),

            // Logs Header & List
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Recent Telemetry & HTTP Logs (${_logs.length})',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                  TextButton.icon(
                    onPressed: _loadData,
                    icon: const Icon(Icons.sync, size: 16),
                    label: const Text('Sync Data'),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            SizedBox(
              height: 350,
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : _logs.isEmpty
                      ? const Center(
                          child: Padding(
                            padding: EdgeInsets.all(24.0),
                            child: Text(
                              'No telemetry logs recorded yet.\nConnect to VPN or fetch nodes to populate logs.',
                              textAlign: TextAlign.center,
                              style: TextStyle(color: Colors.grey),
                            ),
                          ),
                        )
                      : ListView.builder(
                          itemCount: _logs.length,
                          itemBuilder: (context, index) {
                            final log = _logs[index];
                            Color levelColor;
                            switch (log.level) {
                              case 'ERROR':
                                levelColor = Colors.red;
                                break;
                              case 'WARN':
                                levelColor = Colors.orange;
                                break;
                              case 'HTTP':
                                levelColor = Colors.purple;
                                break;
                              default:
                                levelColor = Colors.green;
                            }

                            return ExpansionTile(
                              leading: CircleAvatar(
                                backgroundColor: levelColor.withOpacity(0.2),
                                child: Text(
                                  log.level[0],
                                  style: TextStyle(color: levelColor, fontWeight: FontWeight.bold),
                                ),
                              ),
                              title: Text(
                                '${log.tag}: ${log.message}',
                                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
                              ),
                              subtitle: Text(
                                DateTime.fromMillisecondsSinceEpoch(log.timestamp).toString(),
                                style: const TextStyle(fontSize: 10, color: Colors.grey),
                              ),
                              children: [
                                if (log.metadata != null)
                                  Container(
                                    padding: const EdgeInsets.all(12),
                                    width: double.infinity,
                                    color: Colors.grey.shade100,
                                    child: SelectableText(
                                      log.metadata!,
                                      style: const TextStyle(fontFamily: 'monospace', fontSize: 11),
                                    ),
                                  ),
                              ],
                            );
                          },
                        ),
            ),
          ],
        ),
      ),
    );
  }
}
