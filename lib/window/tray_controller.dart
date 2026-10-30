import 'dart:io';

import 'package:tray_manager/tray_manager.dart';
import 'package:window_manager/window_manager.dart';

import 'window_controller.dart';

/// Tray (Windows) / menu bar (macOS) icon. Settings entry arrives with T11.
class TrayController with TrayListener {
  TrayController(this._window);

  final WindowController _window;

  Future<void> init() async {
    trayManager.addListener(this);
    await trayManager.setIcon(
      Platform.isWindows ? 'assets/tray_icon.ico' : 'assets/tray_icon.png',
      isTemplate: true,
    );
    if (!Platform.isLinux) await trayManager.setToolTip('Jira Pill');
    await _buildMenu();
  }

  Future<void> _buildMenu() async {
    final visible = await windowManager.isVisible();
    await trayManager.setContextMenu(
      Menu(
        items: [
          MenuItem(
            key: 'toggle_visible',
            label: visible ? 'Hide pill' : 'Show pill',
          ),
          MenuItem.checkbox(
            key: 'always_on_top',
            label: 'Always on top',
            checked: _window.alwaysOnTop,
          ),
          MenuItem.separator(),
          MenuItem(key: 'quit', label: 'Quit'),
        ],
      ),
    );
  }

  @override
  void onTrayIconMouseDown() => trayManager.popUpContextMenu();

  @override
  void onTrayIconRightMouseDown() => trayManager.popUpContextMenu();

  @override
  Future<void> onTrayMenuItemClick(MenuItem menuItem) async {
    switch (menuItem.key) {
      case 'toggle_visible':
        if (await windowManager.isVisible()) {
          await windowManager.hide();
        } else {
          await windowManager.show(inactive: true);
        }
      case 'always_on_top':
        await _window.setAlwaysOnTop(!_window.alwaysOnTop);
      case 'quit':
        await trayManager.destroy();
        await _window.quit();
        return;
    }
    await _buildMenu();
  }
}
