# Pre-Action Plan: WireGuard Android Tunnel Integration

## 1. Objective
Integrate the official WireGuard Android tunnel library (`com.wireguard.android:tunnel`) into the `client/android` project to replace the custom `DatagramSocket` raw packet handling with `GoBackend`.

## 2. Context Audit
- `client/android/app/src/main/java/com/myfreevpn/app/VpnServiceImpl.java` currently implements a custom `DatagramSocket` based VPN protocol.
- `client/android/app/build.gradle` needs the new `com.wireguard.android:tunnel` dependency.
- WireGuard standard config (`[Interface]`, `[Peer]`) is needed for `GoBackend`. We have the client's private key (seed) and public key from `VpnService.dart`. We need to determine how to retrieve or construct the server's public key and endpoint from the backend response.

## 3. Strategy
1. Add `com.wireguard.android:tunnel` dependency to `client/android/app/build.gradle`.
2. Update `VpnServiceImpl.java` to use `GoBackend` and a `Tunnel` instance.
3. Construct the WireGuard `Config` object using `Config.Builder`.
   - Need to fetch the server public key from the backend, if not already present in the existing arguments or registration response.
4. Update `connectToVpn` to initialize `GoBackend` and set the tunnel state to `UP` with the constructed `Config`.
5. Update `disconnectFromVpn` to set the tunnel state to `DOWN`.
6. Implement `Tunnel` callbacks.
7. Verify functionality.

## 4. Scope
- `client/android/app/build.gradle`
- `client/android/app/src/main/java/com/myfreevpn/app/VpnServiceImpl.java`

## 5. Risk Assessment
- High: VPN connectivity is a critical feature. Incorrect WireGuard configuration will break VPN functionality.
- Dependency compatibility: Ensure `com.wireguard.android:tunnel` version is compatible with existing project constraints.
- Configuration handling: We must ensure we have the correct server public key.

## 6. Acceptance Criteria
1. `com.wireguard.android:tunnel` is successfully added as a dependency and the project builds.
2. The Android VPN service uses `GoBackend` instead of `DatagramSocket`.
3. VPN connection is successfully established and traffic is tunneled correctly via `GoBackend`.
4. Disconnection cleanly shuts down the tunnel.
5. All critical requirements of the WireGuard protocol are maintained (no-logs, ephemeral exit nodes).
