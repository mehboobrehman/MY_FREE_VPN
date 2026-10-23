#include <flutter/dart_project.h>
#include <flutter/flutter_view_controller.h>
#include <flutter/flutter_engine.h>
#include <windows.h>

#include "../flutter/generated_plugin_registrant.h"

int APIENTRY wWinMain(_In_ HINSTANCE hInstance, _In_opt_ HINSTANCE hPrevInstance,
                      _In_writes_(nCmdShow) LPWSTR lpCmdLine, _In_ int nCmdShow) {
  UNREFERENCED_PARAMETER(hPrevInstance);
  UNREFERENCED_PARAMETER(lpCmdLine);

  flutter::DartProject project(L".");
  flutter::FlutterViewController flutter_controller(project);

  if (!flutter_controller.SetWindow(
          flutter_controller.CreateFlutterWindow(L"my_free_vpn", 1024, 768))) {
    return EXIT_FAILURE;
  }

  // Register all platform plugins (including the Windows No-Admin VPN plugin).
  GeneratedPluginRegistrantRegisterWith(flutter_controller.engine());

  flutter_controller.Run();

  return EXIT_SUCCESS;
}
