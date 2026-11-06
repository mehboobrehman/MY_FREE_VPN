import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import '../services/device_agent_core.dart';
import '../services/agent_logger.dart';

class TelemetryDebugOverlay extends StatefulWidget {
  final Widget child;

  const TelemetryDebugOverlay({super.key, required this.child});

  @override
  State<TelemetryDebugOverlay> createState() => _TelemetryDebugOverlayState();
}

class _TelemetryDebugOverlayState extends State<TelemetryDebugOverlay> {
  AgentConnectionState _state = AgentConnectionState.offline;
  List<LogEntry> _recentLogs = [];

  @override
  void initState() {
    super.initState();
    if (kDebugMode) {
      _state = DeviceAgentCore.currentState;
      DeviceAgentCore.stateStream.listen((state) {
        if (mounted) {
          setState(() {
            _state = state;
          });
        }
      });
      _refreshLogs();
    }
  }

  Future<void> _refreshLogs() async {
    final logs = await AgentLogger.getRecentLogs(limit: 10);
    if (mounted) {
      setState(() {
        _recentLogs = logs;
      });
    }
  }

  Color _getStatusColor(AgentConnectionState state) {
    switch (state) {
      case AgentConnectionState.connected:
        return Colors.green;
      case AgentConnectionState.degraded:
        return Colors.orange;
      case AgentConnectionState.connecting:
        return Colors.blue;
      case AgentConnectionState.offline:
      default:
        return Colors.red;
    }
  }

  IconData _getStatusIcon(AgentConnectionState state) {
    switch (state) {
      case AgentConnectionState.connected:
        return Icons.check_circle;
      case AgentConnectionState.degraded:
        return Icons.warning;
      case AgentConnectionState.connecting:
        return Icons.sync;
      case AgentConnectionState.offline:
      default:
        return Icons.error;
    }
  }

  void _showDebugSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF1E293B),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => _DebugSheet(
        initialState: _state,
        onRefreshLogs: _refreshLogs,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (!kDebugMode) return widget.child;

    return Stack(
      children: [
        widget.child,
        Positioned(
          bottom: 16,
          right: 16,
          child: SafeArea(
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: () => _showDebugSheet(context),
                borderRadius: BorderRadius.circular(24),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.black54,
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: _getStatusColor(_state).withOpacity(0.5)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        _getStatusIcon(_state),
                        color: _getStatusColor(_state),
                        size: 16,
                      ),
                      const SizedBox(width: 8),
                      const Text(
                        'DEBUG',
                        style: TextStyle(
                          color: Colors.white70,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _DebugSheet extends StatefulWidget {
  final AgentConnectionState initialState;
  final VoidCallback onRefreshLogs;

  const _DebugSheet({
    required this.initialState,
    required this.onRefreshLogs,
  });

  @override
  State<_DebugSheet> createState() => _DebugSheetState();
}

class _DebugSheetState extends State<_DebugSheet> {
  late AgentConnectionState _state;
  final TextEditingController _ipController = TextEditingController();
  List<LogEntry> _logs = [];

  @override
  void initState() {
    super.initState();
    _state = widget.initialState;
    _ipController.text = DeviceAgentCore.manualIpOverride ?? '';
    _loadLogs();
    DeviceAgentCore.stateStream.listen((state) {
      if (mounted) {
        setState(() {
          _state = state;
        });
      }
    });
  }

  Future<void> _loadLogs() async {
    final logs = await AgentLogger.getRecentLogs(limit: 10);
    if (mounted) {
      setState(() {
        _logs = logs;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
        left: 16,
        right: 16,
        top: 16,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Telemetry Debug',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close, color: Colors.white54),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _buildStatusRow(),
          const SizedBox(height: 16),
          Text(
            'Endpoint: ${DeviceAgentCore.discoveredEndpoint ?? "None"}',
            style: const TextStyle(color: Colors.white70, fontSize: 12, fontFamily: 'monospace'),
          ),
          const SizedBox(height: 24),
          const Text(
            'Manual IP Override',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _ipController,
                  style: const TextStyle(color: Colors.white, fontFamily: 'monospace'),
                  decoration: InputDecoration(
                    hintText: 'e.g. 192.168.1.100',
                    hintStyle: const TextStyle(color: Colors.white24),
                    filled: true,
                    fillColor: Colors.black26,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: BorderSide.none,
                    ),
                    isDense: true,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              ElevatedButton(
                onPressed: () async {
                  await DeviceAgentCore.updateManualIp(_ipController.text);
                  widget.onRefreshLogs();
                  _loadLogs();
                },
                child: const Text('Connect'),
              ),
              const SizedBox(width: 8),
              TextButton(
                onPressed: () async {
                  _ipController.clear();
                  await DeviceAgentCore.updateManualIp(null);
                  widget.onRefreshLogs();
                  _loadLogs();
                },
                child: const Text('Reset', style: TextStyle(color: Colors.redAccent)),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Recent Logs',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
              ),
              TextButton.icon(
                onPressed: _loadLogs,
                icon: const Icon(Icons.refresh, size: 14),
                label: const Text('Refresh', style: TextStyle(fontSize: 12)),
              ),
            ],
          ),
          Container(
            height: 200,
            decoration: BoxDecoration(
              color: Colors.black26,
              borderRadius: BorderRadius.circular(8),
            ),
            child: ListView.builder(
              itemCount: _logs.length,
              itemBuilder: (context, index) {
                final log = _logs[index];
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            DateTime.fromMillisecondsSinceEpoch(log.timestamp).toIso8601String().substring(11, 19),
                            style: const TextStyle(color: Colors.white24, fontSize: 10, fontFamily: 'monospace'),
                          ),
                          const SizedBox(width: 4),
                          Text(
                            log.level,
                            style: TextStyle(
                              color: _getLogLevelColor(log.level),
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(width: 4),
                          Text(
                            '[${log.tag}]',
                            style: const TextStyle(color: Colors.blueAccent, fontSize: 10),
                          ),
                        ],
                      ),
                      Text(
                        log.message,
                        style: const TextStyle(color: Colors.white70, fontSize: 11),
                      ),
                      const Divider(color: Colors.white10),
                    ],
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _buildStatusRow() {
    Color color;
    IconData icon;
    String text;

    switch (_state) {
      case AgentConnectionState.connected:
        color = Colors.green;
        icon = Icons.check_circle;
        text = 'CONNECTED';
        break;
      case AgentConnectionState.degraded:
        color = Colors.orange;
        icon = Icons.warning;
        text = 'DEGRADED (Relay)';
        break;
      case AgentConnectionState.connecting:
        color = Colors.blue;
        icon = Icons.sync;
        text = 'CONNECTING';
        break;
      case AgentConnectionState.offline:
      default:
        color = Colors.red;
        icon = Icons.error;
        text = 'OFFLINE';
    }

    return Row(
      children: [
        Icon(icon, color: color, size: 20),
        const SizedBox(width: 8),
        Text(
          text,
          style: TextStyle(color: color, fontWeight: FontWeight.bold),
        ),
      ],
    );
  }

  Color _getLogLevelColor(String level) {
    switch (level) {
      case 'ERROR':
        return Colors.redAccent;
      case 'WARN':
        return Colors.orangeAccent;
      case 'INFO':
        return Colors.greenAccent;
      case 'DEBUG':
        return Colors.blueAccent;
      case 'HTTP':
        return Colors.purpleAccent;
      default:
        return Colors.white54;
    }
  }
}
