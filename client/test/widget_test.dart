// This is a basic Flutter widget test.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:my_free_vpn/main.dart';

void main() {
  testWidgets('MY FREE VPN smoke test', (WidgetTester tester) async {
    // Ignore overflows
    tester.view.physicalSize = const Size(1200, 1600);
    tester.view.devicePixelRatio = 1.0;

    // Build our app and trigger a frame.
    await tester.pumpWidget(const MyApp());

    // Verify that our app name is present.
    expect(find.text('MY FREE VPN'), findsOneWidget);
    expect(find.textContaining('CONNECT'), findsWidgets);
    
    // Reset view
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });
}
