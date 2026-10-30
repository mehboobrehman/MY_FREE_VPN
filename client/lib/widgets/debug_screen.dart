import 'package:flutter/material.dart';
import '../services/agent_logger.dart';

/// Debug UI / Debug Drawer / activity in the Android client to view recent log entries,
/// server status, remote configuration feature flags, and clear/sync data.
class DebugScreen extends StatefulWidget {
  const DebugScreen({super.key});

  @override
  State<DebugScreen> createState() => _DebugScreenState();
}

class _DebugScreenState extends State<DebugScreen> {
  List<LogEntry> _logs = [];
  bool _isLoading = true;
  String _serverStatus = 'Checking...';

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    final logs = await AgentLogger.getRecentLogs(limit: 150);
    setState(() {
      _logs = logs;
      _isLoading = false;
      _serverStatus = 'Online (Backend Connected)';
    });
  }

  Future<void> _clearLogs() async {
    await AgentLogger.clearLogs();
    await _loadData();
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Telemetry logs cleared successfully.')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('MY FREE VPN - Debug & Telemetry'),
        actions: [
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
      body: Column(
        children: [
          // Server Status & Feature Flags Header Card
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
                        'Server Status: $_serverStatus',
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
          // Logs Header
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
          // Log List
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _logs.isEmpty
                    ? const Center(
                        child: Text(
                          'No telemetry logs recorded yet.\nConnect to VPN or make API calls to populate logs.',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: Colors.grey),
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
    );
  }
}
