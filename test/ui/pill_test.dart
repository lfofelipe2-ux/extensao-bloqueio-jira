import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jira_pill/core/pill_state.dart';
import 'package:jira_pill/ui/pill.dart';

void main() {
  late int taps;
  late int drags;

  Future<void> pump(WidgetTester tester) async {
    taps = 0;
    drags = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Center(
          child: SizedBox(
            width: 200,
            height: 36,
            child: Pill(
              state: const PillState(
                kind: PillKind.primary,
                label: 'ABC-1 · In Progress',
              ),
              onTap: () => taps++,
              onDragStart: () => drags++,
            ),
          ),
        ),
      ),
    );
  }

  testWidgets('click without movement toggles', (tester) async {
    await pump(tester);
    await tester.tap(find.byType(Pill));
    expect(taps, 1);
    expect(drags, 0);
  });

  testWidgets('movement past the slop drags and does not toggle', (
    tester,
  ) async {
    await pump(tester);
    await tester.drag(find.byType(Pill), const Offset(30, 0));
    expect(drags, 1);
    expect(taps, 0);
  });

  testWidgets('shows label with the state color', (tester) async {
    await pump(tester);
    expect(find.text('ABC-1 · In Progress'), findsOneWidget);
    final box = tester.widget<AnimatedContainer>(
      find.byType(AnimatedContainer),
    );
    expect((box.decoration! as BoxDecoration).color, PillKind.primary.color);
  });
}
