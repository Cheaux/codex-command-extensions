---
title: Custom commands for Codex CLI
description: Add custom slash commands, Tab autocomplete and retained views to Codex CLI. Use the shared host with Folders, Remote or your own plugins.
permalink: /
---
{% include nav.html %}

# Custom slash commands for Codex CLI

**Codex Command Extensions adds command discovery, Tab autocomplete and retained terminal views to Codex CLI.** Install one shared host, then enable independent extensions such as chat folders or phone pairing.

[Install the host]({{ '/install/' | relative_url }}) · [Download v0.1.2](https://github.com/Cheaux/codex-command-extensions/releases/tag/v0.1.2) · [Source on GitHub](https://github.com/Cheaux/codex-command-extensions)

## What happens in the terminal?

1. Install the host and an extension, then open a new `codex` terminal.
2. Type a registered command prefix such as `/q` to discover matching commands.
3. Press **Tab** to complete, **Up/Down** to select, and **Enter** to run. **Escape** dismisses custom suggestions.
4. Return from an extension view to your chat. **Ctrl+X, then B** cycles retained views.

The host provides the terminal behavior; each extension supplies its own features. Installing the host alone does not add `/folders` or `/qr`.

## Choose the extension you need

| Project | Adds | How it connects |
| --- | --- | --- |
| [Codex Folders](https://cheaux.github.io/codex-folders/) | Conversation folders, a keyboard chat browser and shared project context. | Independently registers `/folders`, `/resume` and `/resumedbg`. |
| [Codex Remote](https://cheaux.github.io/codex-remote/) | ChatGPT mobile QR pairing and remote-device management. | Independently registers `/qr`; phone pairing also works without the terminal host. |
| [Your own extension]({{ '/extensions/' | relative_url }}) | Commands and views defined by your program. | Registers a small `terminal-extension.json` manifest. |

Use either feature, both, or your own provider. Removing one registration preserves the other extensions.

## Requirements and compatibility

Requires **Node.js 24+**, **Python 3**, and the official Codex CLI. Linux with Codex CLI 0.163.0 is the tested baseline. The current Python PTY backend supports Linux/macOS, but macOS is untested. Windows terminal integration is unavailable in this version.

The host installs one reversible user-local launcher. It preserves the original Codex executable and does not restart its native daemon. Open a new terminal after changes; existing sessions retain their loaded version.

## Commands for setup and maintenance

| Command | Purpose |
| --- | --- |
| `codex-terminal enable` | Enable the shared launcher. |
| `codex-terminal status --json` | Inspect the launcher, providers, commands and warnings. |
| `codex-terminal register /absolute/path/terminal-extension.json` | Register an extension. |
| `codex-terminal unregister EXTENSION_ID` | Remove only one extension's registration. |
| `codex-terminal disable` | Remove the host's owned launcher, keeping registrations. |

[Installation, updates and removal]({{ '/install/' | relative_url }}) · [Extension manifest reference]({{ '/extensions/' | relative_url }}) · [FAQ and troubleshooting]({{ '/faq/' | relative_url }}) · [Documentation index]({{ '/llms.txt' | relative_url }})

Community software by [Cheaux](https://github.com/Cheaux), licensed under MIT. OpenAI does not maintain or endorse it. The public project was formerly called **Codex Terminal Extensions**; the package remains `codex-terminal-extensions` and the executable remains `codex-terminal`.
