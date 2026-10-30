# Agent rules

## Workflow (spec-driven)

1. Behavior lives in `docs/spec.md`; architecture in `docs/plan.md`; work items in `docs/tasks.md`.
   Change the spec first when behavior changes, then the code.
2. All changes go through pull requests. Nothing is pushed straight to `main`.
3. Every PR cites the task IDs it closes and ticks them in `docs/tasks.md`.
4. Every PR gets exactly one review by a context-free reviewer agent running Sonnet 5.5
   (`claude-sonnet-5-5`) before it is marked ready. The reviewer sees only the diff, the docs and the
   repository, not the authoring conversation. Fix or answer each finding before marking ready.

## Code

- Repository content in English.
- Flutter version pinned in `.fvmrc` and CI; use `fvm flutter` locally when available.
- Before pushing: `flutter analyze` and `flutter test` must pass.
- Minimal comments: only what the code does not say (business rule, workaround, edge case).
- Business rules from the spec are referenced by ID in tests (e.g. `B1`).
