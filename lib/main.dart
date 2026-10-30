import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app.dart';
import 'window/tray_controller.dart';
import 'window/window_controller.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();
  final window = WindowController(prefs);
  await window.init();
  await TrayController(window).init();
  runApp(JiraPillApp(window: window));
}
