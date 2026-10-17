---
name: terminal-extensions
description: Set up or troubleshoot the shared Codex terminal extension host, registered slash commands, and command suggestions. Use for this host, not shell completion or unrelated Codex settings.
---

The `codex-terminal` executable owns one terminal launcher. Feature packages register JSON manifests; they retain their own tools and data. Inspect `codex-terminal status --json` before changing registrations. Registration alone does not enable the launcher. `codex-terminal enable` activates it for new terminals; existing sessions keep their loaded runtime.

Use the feature's installer or `codex-terminal register PATH` for a manifest the user chose to install. Command actions launch local executables on user invocation. Do not register arbitrary downloaded manifests or override existing command owners as a diagnostic shortcut. Duplicate names and shortcuts are rejected. `codex-terminal unregister ID` removes only that feature; `codex-terminal disable` removes the shared launcher for all features while preserving registrations.

The current PTY backend supports Linux/macOS with Python 3. Do not claim Windows terminal-host support. Standalone CLI and MCP tools do not require the host. For a previous owned launcher, use its feature's migration command; unknown or modified executables must be preserved.

Never stop/restart the native Codex daemon, disable phone access, revoke devices, or copy credentials to repair a terminal suggestion. Keep active sessions running. Terminal input, presentation, and views are owned by this runtime; feature packages should register commands rather than install another wrapper.
