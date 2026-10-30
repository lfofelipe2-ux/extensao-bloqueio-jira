import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:jira_pill/window/window_controller.dart';

void main() {
  const primary = Rect.fromLTWH(0, 0, 1920, 1040);
  const secondary = Rect.fromLTWH(1920, 0, 1280, 1000);
  const fallback = Offset(1920 - 200 - 24, 24);

  test('keeps a saved position that fits on a display', () {
    expect(
      WindowController.pillPosition(
        saved: const Offset(2000, 500),
        visibleAreas: [primary, secondary],
        primaryArea: primary,
      ),
      const Offset(2000, 500),
    );
  });

  test('falls back when the saved display is gone', () {
    expect(
      WindowController.pillPosition(
        saved: const Offset(2000, 500),
        visibleAreas: [primary],
        primaryArea: primary,
      ),
      fallback,
    );
  });

  test('falls back when the pill would be cut at the edge', () {
    expect(
      WindowController.pillPosition(
        saved: const Offset(1800, 10),
        visibleAreas: [primary],
        primaryArea: primary,
      ),
      fallback,
    );
  });

  test('falls back with no saved position', () {
    expect(
      WindowController.pillPosition(
        saved: null,
        visibleAreas: [primary],
        primaryArea: primary,
      ),
      fallback,
    );
  });
}
