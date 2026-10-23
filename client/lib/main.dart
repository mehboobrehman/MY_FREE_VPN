import 'package:flutter/material.dart';
import 'package:my_free_vpn/services/vpn_service.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MY FREE VPN',
      theme: ThemeData(
        primarySwatch: Colors.blue,
      ),
      home: const VpnHomeScreen(),
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
  String _statusMessage = 'Tap Connect to start';
  String? _connectedNode;

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
            ? 'Connected${node != null ? ' to $node' : ''}'
            : 'Disconnected';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _statusMessage = 'Failed to load status';
      });
    }
  }

  Future<void> _toggleVpn() async {
    if (_isToggling) return;
    setState(() {
      _isToggling = true;
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
        SnackBar(content: Text('VPN operation failed: $e')),
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
        title: const Text('MY FREE VPN'),
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: <Widget>[
              Text(
                _isConnected ? 'VPN Connected' : 'VPN Disconnected',
                style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              Text(
                _statusMessage,
                style: TextStyle(
                  fontSize: 16,
                  color: Colors.grey[600],
                ),
                textAlign: TextAlign.center,
              ),
              if (_connectedNode != null) ...[
                const SizedBox(height: 8),
                Text(
                  'Node: $_connectedNode',
                  style: const TextStyle(fontSize: 14, fontStyle: FontStyle.italic),
                ),
              ],
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  onPressed: _isToggling ? null : _toggleVpn,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _isConnected ? Colors.red : Colors.blue,
                    foregroundColor: Colors.white,
                  ),
                  child: _isToggling
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor:
                                AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        )
                      : Text(
                          _isConnected ? 'Disconnect' : 'Connect',
                          style: const TextStyle(fontSize: 18),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
