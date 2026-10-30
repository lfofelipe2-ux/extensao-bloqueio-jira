# Jira Pill

A small floating pill, always on top of every window, that shows the status of your current Jira
task and toggles it between a primary and a secondary status with one click. Flutter desktop app for
Windows and macOS, distributed as a portable build.

- Behavior: [`docs/spec.md`](docs/spec.md)
- Architecture: [`docs/plan.md`](docs/plan.md)
- Work items: [`docs/tasks.md`](docs/tasks.md)
- Contribution workflow: [`AGENTS.md`](AGENTS.md)

## Current state

Pill prototype (task T03): frameless, always on top, drag to move, remembers its position, click
cycles the three colors. Tray / menu bar icon with show/hide, always-on-top and quit. No Jira yet.

## Download

Every CI run uploads the build as an artifact on the
[Actions page](https://github.com/lfofelipe2-ux/extensao-bloqueio-jira/actions/workflows/build.yml):

- **Windows** (every PR and `main`): `jira-pill-windows` — unzip anywhere and run `jira_pill.exe`.
- **macOS** (`main` and manual runs): `jira-pill-macos` — unzip, move `Jira Pill.app` anywhere.
  The app is not signed: on first open, macOS blocks it. Open System Settings → Privacy & Security
  and click "Open Anyway".

## Development

```bash
fvm flutter pub get      # or plain `flutter` matching .fvmrc
fvm flutter analyze
fvm flutter test
fvm flutter run -d windows   # or -d macos
```

Windows builds need Visual Studio with the "Desktop development with C++" workload.
