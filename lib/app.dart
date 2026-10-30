import 'package:flutter/material.dart';

import 'core/pill_state.dart';
import 'ui/pill.dart';
import 'window/window_controller.dart';

class JiraPillApp extends StatelessWidget {
  const JiraPillApp({super.key, required this.window});

  final WindowController window;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Jira Pill',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: PillKind.primary.color,
      ),
      color: Colors.transparent,
      home: Material(
        type: MaterialType.transparency,
        child: PrototypePill(window: window),
      ),
    );
  }
}

/// T03 prototype: cycles the three colors on click. Replaced by TaskService in PR 2.
class PrototypePill extends StatefulWidget {
  const PrototypePill({super.key, required this.window});

  final WindowController window;

  @override
  State<PrototypePill> createState() => _PrototypePillState();
}

class _PrototypePillState extends State<PrototypePill> {
  static const _states = [
    PillState(
      kind: PillKind.neutral,
      label: 'No task',
      tooltip: 'Prototype: click to cycle',
    ),
    PillState(kind: PillKind.primary, label: 'DEMO-1 · In Progress'),
    PillState(kind: PillKind.secondary, label: 'DEMO-1 · Paused'),
  ];

  int _index = 0;

  @override
  Widget build(BuildContext context) {
    return Pill(
      state: _states[_index],
      onTap: () => setState(() => _index = (_index + 1) % _states.length),
      onDragStart: widget.window.startDragging,
    );
  }
}
