import 'dart:async';
import 'dart:ui';

import 'package:flutter/material.dart' show Colors;
import 'package:screen_retriever/screen_retriever.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:window_manager/window_manager.dart';

/// Owns the native window: pill geometry, saved position and always-on-top.
class WindowController with WindowListener {
  WindowController(this._prefs);

  static const pillSize = Size(200, 36);
  static const _margin = 24.0;
  static const _keyX = 'pill.x';
  static const _keyY = 'pill.y';
  static const _keyOnTop = 'pill.alwaysOnTop';

  final SharedPreferences _prefs;
  Timer? _saveDebounce;

  bool get alwaysOnTop => _prefs.getBool(_keyOnTop) ?? true;

  Future<void> init() async {
    await windowManager.ensureInitialized();
    windowManager.addListener(this);
    const options = WindowOptions(
      size: pillSize,
      minimumSize: pillSize,
      maximumSize: pillSize,
      backgroundColor: Colors.transparent,
      skipTaskbar: true,
      titleBarStyle: TitleBarStyle.hidden,
      windowButtonVisibility: false,
      title: 'Jira Pill',
    );
    await windowManager.waitUntilReadyToShow(options, () async {
      await windowManager.setAsFrameless();
      await windowManager.setResizable(false);
      await windowManager.setAlwaysOnTop(alwaysOnTop);
      await windowManager.setPosition(await _initialPosition());
      await windowManager.show(inactive: true);
    });
  }

  Future<void> startDragging() => windowManager.startDragging();

  Future<void> setAlwaysOnTop(bool value) async {
    await _prefs.setBool(_keyOnTop, value);
    await windowManager.setAlwaysOnTop(value);
  }

  Future<void> quit() async {
    await _savePosition();
    await windowManager.destroy();
  }

  @override
  void onWindowMoved() {
    _saveDebounce?.cancel();
    _saveDebounce = Timer(const Duration(milliseconds: 300), _savePosition);
  }

  Future<void> _savePosition() async {
    final pos = await windowManager.getPosition();
    await _prefs.setDouble(_keyX, pos.dx);
    await _prefs.setDouble(_keyY, pos.dy);
  }

  Future<Offset> _initialPosition() async {
    final displays = await screenRetriever.getAllDisplays();
    final primary = await screenRetriever.getPrimaryDisplay();
    final x = _prefs.getDouble(_keyX);
    final y = _prefs.getDouble(_keyY);
    return pillPosition(
      saved: x != null && y != null ? Offset(x, y) : null,
      visibleAreas: displays.map(_visibleArea).toList(),
      primaryArea: _visibleArea(primary),
    );
  }

  /// The saved position if the whole pill still fits on one display (a
  /// monitor may have been unplugged since), else the primary display's
  /// top-right corner.
  static Offset pillPosition({
    required Offset? saved,
    required List<Rect> visibleAreas,
    required Rect primaryArea,
  }) {
    if (saved != null) {
      final pill = saved & pillSize;
      if (visibleAreas.any((a) => _contains(a, pill))) return saved;
    }
    return Offset(
      primaryArea.right - pillSize.width - _margin,
      primaryArea.top + _margin,
    );
  }

  static bool _contains(Rect outer, Rect inner) =>
      inner.left >= outer.left &&
      inner.top >= outer.top &&
      inner.right <= outer.right &&
      inner.bottom <= outer.bottom;

  static Rect _visibleArea(Display d) {
    final pos = d.visiblePosition ?? Offset.zero;
    final size = d.visibleSize ?? d.size;
    return pos & size;
  }
}
