# Codex Command Extensions

**Custom slash commands and autocomplete for Codex CLI.** Install this shared host once, then choose the extensions you want to use. Each extension supplies its own commands and features.

## What can I do with it?

- Discover installed extensions' commands as you type.
- Complete and select commands with Tab, arrow keys, and Enter.
- Open extension views and return to your chat.
- Add or remove extensions independently.

## Commands

| Command | Purpose |
| --- | --- |
| `codex-terminal status --json` | Inspect the launcher, registrations, commands, and stale-registration warnings |
| `codex-terminal register /path/to/terminal-extension.json` | Register one feature |
| `codex-terminal unregister EXTENSION_ID` | Remove only that feature's commands |
| `codex-terminal enable` | Enable the shared launcher |
| `codex-terminal disable` | Remove its owned launcher; keep registrations |
| `codex-terminal launch -- CODEX_ARGS` | Launch without installing a shim |
| `codex-terminal launch --extension MANIFEST -- CODEX_ARGS` | Add a provider for this invocation only |

Type a registered command prefix to see suggestions. **Tab** completes; **Up/Down** selects custom or native suggestions; **Enter** runs the selected command; **Escape** dismisses custom suggestions. **Ctrl+X, then B** cycles retained views. A feature may register its own Ctrl+X shortcut.

Unregistering an extension removes only its commands. Use `codex-terminal disable` to remove the shared launcher for every extension.

Script and service commands, remote CLI connections, `--help`, and `--version` pass through without a PTY. The original Codex binary is not modified. The host does not stop or restart the native daemon.

## Install

Requires **Node 24+**, **Python 3**, and official **Codex CLI**. The current PTY backend supports Linux/macOS; Linux is tested. Windows needs a separate terminal backend and is not supported by this host version.

```sh
export PATH="$HOME/.local/bin:$PATH"
curl --fail --location --output codex-terminal-extensions-0.1.2.tgz \
  https://github.com/Cheaux/codex-command-extensions/releases/download/v0.1.2/codex-terminal-extensions-0.1.2.tgz
npm install --global --prefix "$HOME/.local" --ignore-scripts ./codex-terminal-extensions-0.1.2.tgz
codex-terminal enable
```

Then install and enable an extension to add its commands. See [Recommended extensions](#recommended-extensions) below, or [build your own](#add-an-extension).

Open a **new Codex terminal** to load registrations. Existing sessions stay running. If you need the setup skill in Codex, run `codex-terminal install`; it is optional for command execution.

The launcher is placed in `~/.local/bin/codex`, before the original Codex executable on PATH. Set `CODEX_TERMINAL_BIN_DIR` for another user-owned directory. Unknown or modified executables are preserved. Previous Folders installations migrate through `codex-folders enable`, which supplies the exact prior ownership record.

## Recommended extensions

Choose the features you want to add:

| Extension | What it adds |
| --- | --- |
| [Codex Remote](https://github.com/Cheaux/codex-remote) | Pair terminal Codex with the ChatGPT phone app and manage remote access. |
| [Codex Folders](https://github.com/Cheaux/codex-folders) | Organize conversations into folders and share project instructions and memory. |

Install these separately using their own setup guides. You can use either one on its own, or install both. Other developers can also [register their own extensions](#add-an-extension).

## Add an extension

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

## Configuration and development

Registrations and launcher ownership live under `$CODEX_HOME/terminal-extensions`, defaulting to `~/.codex/terminal-extensions`. `CODEX_TERMINAL_DATA_DIR` overrides that directory. `CODEX_TERMINAL_CODEX_BIN` selects the original native executable; `CODEX_TERMINAL_PYTHON` selects Python. Feature data stays with the feature.

```sh
npm ci
npm run check
npm test
npm run test:package
```

Tests cover registration conflicts, safe ownership/migration, input routing, multiple suggestions, native selection, aliases, escape/paste behavior, titles, terminal modes, and clean package installation. Report problems through [GitHub issues](https://github.com/Cheaux/codex-command-extensions/issues), without private conversation content or pairing credentials.

Community project by [Cheaux](https://github.com/Cheaux), licensed under [MIT](LICENSE). OpenAI does not maintain or endorse it.

## Official directory status

GitHub releases are available. This plugin has **not been submitted to or approved for the official ChatGPT/Codex plugin directory**. [Submission preparation](submission/README.md), [data handling](PRIVACY.md), and [license/service information](TERMS.md) are public.

The public name is **Codex Command Extensions** (formerly Codex Terminal Extensions). The `codex-terminal` executable, package ID `codex-terminal-extensions`, environment variables, and registry paths remain compatible with existing installations.
