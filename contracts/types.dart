/// Dart Data Models for MY_FREE_VPN Flutter Client

class DeviceRegistration {
  final String deviceUuid;
  final String publicKey;
  final String signature;
  final String platform;
  final String? appVersion;

  DeviceRegistration({
    required this.deviceUuid,
    required this.publicKey,
    required this.signature,
    required this.platform,
    this.appVersion,
  });

  Map<String, dynamic> toJson() => {
        'device_uuid': deviceUuid,
        'public_key': publicKey,
        'signature': signature,
        'platform': platform,
        if (appVersion != null) 'app_version': appVersion,
      };
}

class VpnNode {
  final String nodeId;
  final String countryCode;
  final String city;
  final String endpointIp;
  final int endpointPort;
  final String publicKey;
  final int currentLoadPercent;
  final int? pingMs;

  VpnNode({
    required this.nodeId,
    required this.countryCode,
    required this.city,
    required this.endpointIp,
    required this.endpointPort,
    required this.publicKey,
    required this.currentLoadPercent,
    this.pingMs,
  });

  factory VpnNode.fromJson(Map<String, dynamic> json) => VpnNode(
        nodeId: json['node_id'],
        countryCode: json['country_code'],
        city: json['city'],
        endpointIp: json['endpoint_ip'],
        endpointPort: json['endpoint_port'],
        publicKey: json['public_key'],
        currentLoadPercent: json['current_load_percent'] ?? 0,
        pingMs: json['ping_ms'],
      );
}

class ConnectionConfig {
  final String sessionToken;
  final String clientIp;
  final String serverEndpoint;
  final String serverPublicKey;
  final List<String> allowedIps;
  final List<String>? dnsServers;
  final int persistentKeepalive;

  ConnectionConfig({
    required this.sessionToken,
    required this.clientIp,
    required this.serverEndpoint,
    required this.serverPublicKey,
    required this.allowedIps,
    this.dnsServers,
    required this.persistentKeepalive,
  });

  factory ConnectionConfig.fromJson(Map<String, dynamic> json) => ConnectionConfig(
        sessionToken: json['session_token'],
        clientIp: json['client_ip'],
        serverEndpoint: json['server_endpoint'],
        serverPublicKey: json['server_public_key'],
        allowedIps: List<String>.from(json['allowed_ips']),
        dnsServers: json['dns_servers'] != null ? List<String>.from(json['dns_servers']) : null,
        persistentKeepalive: json['persistent_keepalive'] ?? 25,
      );
}
