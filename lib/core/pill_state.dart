import 'package:flutter/material.dart';

enum PillKind { neutral, primary, secondary }

extension PillKindColors on PillKind {
  Color get color => switch (this) {
    PillKind.primary => const Color(0xFF2E9E5B),
    PillKind.secondary => const Color(0xFFE8892B),
    PillKind.neutral => const Color(0xFF7A7F87),
  };
}

class PillState {
  const PillState({required this.kind, required this.label, this.tooltip});

  final PillKind kind;
  final String label;
  final String? tooltip;
}
