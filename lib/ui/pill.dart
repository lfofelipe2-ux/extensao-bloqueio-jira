import 'package:flutter/material.dart';

import '../core/pill_state.dart';

/// Distinguishes a click from a drag: [onDragStart] fires once the pointer
/// moves past [dragSlop], and [onTap] only fires when it never did.
class Pill extends StatefulWidget {
  const Pill({
    super.key,
    required this.state,
    required this.onTap,
    required this.onDragStart,
    this.onSecondaryTap,
  });

  static const dragSlop = 4.0;

  final PillState state;
  final VoidCallback onTap;
  final VoidCallback onDragStart;
  final void Function(Offset globalPosition)? onSecondaryTap;

  @override
  State<Pill> createState() => _PillState();
}

class _PillState extends State<Pill> {
  Offset? _downAt;
  bool _dragging = false;

  void _onDown(PointerDownEvent e) {
    if (e.buttons != 1) return;
    _downAt = e.position;
    _dragging = false;
  }

  void _onMove(PointerMoveEvent e) {
    final start = _downAt;
    if (start == null || _dragging) return;
    if ((e.position - start).distance > Pill.dragSlop) {
      _dragging = true;
      widget.onDragStart();
    }
  }

  void _onUp(PointerUpEvent e) {
    if (_downAt != null && !_dragging) widget.onTap();
    _downAt = null;
    _dragging = false;
  }

  @override
  Widget build(BuildContext context) {
    final state = widget.state;
    final pill = Listener(
      onPointerDown: _onDown,
      onPointerMove: _onMove,
      onPointerUp: _onUp,
      onPointerCancel: (_) => _downAt = null,
      child: GestureDetector(
        onSecondaryTapUp: widget.onSecondaryTap == null
            ? null
            : (d) => widget.onSecondaryTap!(d.globalPosition),
        child: MouseRegion(
          cursor: SystemMouseCursors.click,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            alignment: Alignment.center,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: state.kind.color,
              borderRadius: BorderRadius.circular(18),
            ),
            child: Text(
              state.label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
      ),
    );
    final tooltip = state.tooltip;
    return tooltip == null ? pill : Tooltip(message: tooltip, child: pill);
  }
}
