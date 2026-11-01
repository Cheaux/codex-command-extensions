---
title: Build a slash-command plugin
description: Build a Codex CLI command plugin with a terminal-extension.json manifest, retained views, overlays, native aliases and keyboard shortcuts.
permalink: /extensions/
---
{% include nav.html %}

# Build a Codex CLI command extension

The shared host reads a provider manifest. It does not require Codex Folders or Codex Remote to register your own commands. Install the [host]({{ '/install/' | relative_url }}) first.


Put `terminal-extension.json` at your package root and include it in your release:

```json
{
  "schemaVersion": 1,
  "id": "my-extension",
  "commands": [{
    "name": "/mytool",
    "description": "Open my tool",
    "action": {
      "type": "view",
      "executable": "${NODE}",
      "args": ["${EXTENSION_ROOT}/dist/cli.js", "interactive"]
    }
  }]
}
```

Your installer calls `codex-terminal register /absolute/path/to/terminal-extension.json`. Registrations save the manifest path, so updating the package at that path updates its definitions for newly opened terminals. Duplicate command names and shortcuts are rejected. Missing or malformed providers are skipped with a diagnostic. Registering a provider does not execute its actions.

Supported placeholders are `${NODE}` (the host's Node executable), `${EXTENSION_ROOT}` (the manifest directory), and `${CODEX_BIN}` (the original Codex executable). Programs receive their own `args` and optional `env`; Codex model/sandbox flags are not forwarded to feature programs.

Command options:

- `suggest: false`: intercept the exact command without adding a duplicate suggestion.
- `preferNative: true`: keep the native suggestion selected until the custom command is chosen or typed in full.
- `replaceNative: true`: explicitly opt into a built-in name such as `/resume`. Accepting that native suggestion with Enter or Tab also uses the registered action.
- `shortcut: "f"`: register Ctrl+X, then F. B is reserved for switching views.

Actions:

- **`view`** launches an executable in a retained PTY. Exiting it returns to the previous chat.
- **`overlay`** hands the outer terminal to a feature process. On successful exit, it may write one JSON result to the file descriptor in `CODEX_TERMINAL_RESULT_FD`: `{"type":"codex","args":["resume","THREAD_ID"]}`. With no result, the original draft/view returns. Codex model/profile/permission flags are preserved when a selected chat is launched. The result channel is separate from UI output and capped at 64 KiB.
- **`native-alias`** accepts a `target` prefix, for example `/resumedbg` targeting `/resume`. Only the suffix is erased before Enter, preserving native paste handling.


## Register and inspect

```sh
codex-terminal register /absolute/path/to/terminal-extension.json
codex-terminal enable
codex-terminal status --json
```

Open a new Codex terminal and try the command. To use a provider for one launch without saving its registration:

```sh
codex-terminal launch --extension /absolute/path/to/terminal-extension.json --
```

Treat extension programs as code you choose to run. Registration itself does not execute the action. [Source and tests](https://github.com/Cheaux/codex-command-extensions) document the current implementation; [report issues](https://github.com/Cheaux/codex-command-extensions/issues) without private chats or pairing credentials.
