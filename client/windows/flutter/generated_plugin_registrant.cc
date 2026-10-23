#include "generated_plugin_registrant.h"

#include <flutter/flutter_engine.h>
#include <flutter/plugin_registrar.h>
#include <flutter/standard_method_codec.h>
#include <flutter/encodable_value.h>
#include <flutter/method_channel.h>
#include <flutter/method_result.h>

#include <memory>
#include <string>

namespace {

// Channel name must match the Dart side (vpn_service.dart / windows_vpn_service.dart).
const char kVpnChannel[] = "com.myfreevpn.app/vpn";

// Handles connect/disconnect calls from Dart on the Windows No-Admin proxy path.
class VpnChannelHandler {
 public:
  explicit VpnChannelHandler(flutter::BinaryMessenger* messenger)
      : channel_(messenger, kVpnChannel,
                 &flutter::StandardMethodCodec::GetInstance()) {
    channel_.SetMethodCallHandler(
        [](const auto& call, auto result) {
          const std::string& method = call.method_name();
          if (method == "connect") {
            // TODO: Extract serverUrl/publicKey/deviceId from call.arguments()
            // and invoke the native Windows proxy (WinTUN / no-admin helper).
            result->Success(flutter::EncodableValue(true));
          } else if (method == "disconnect") {
            // TODO: Tear down the Windows proxy tunnel.
            result->Success(flutter::EncodableValue(true));
          } else {
            result->NotImplemented();
          }
        });
  }

 private:
  flutter::MethodChannel<flutter::EncodableValue> channel_;
};

}  // namespace

void GeneratedPluginRegistrantRegisterWith(flutter::FlutterEngine* engine) {
  if (engine == nullptr) {
    return;
  }

  auto* registrar = engine->GetRegistrarForPlugin("my_free_vpn_windows_vpn");
  if (registrar == nullptr) {
    return;
  }

  // Register the VPN MethodChannel handler so Dart can drive the Windows proxy.
  std::unique_ptr<VpnChannelHandler> vpn_handler =
      std::make_unique<VpnChannelHandler>(registrar->messenger());
  // The handler is owned by the channel registration; keep it alive for the
  // lifetime of the engine via the registrar's plugin registration mechanism.
  static std::unique_ptr<VpnChannelHandler>* persistent = new std::unique_ptr<VpnChannelHandler>(
      std::move(vpn_handler));
  (void)persistent;
}
