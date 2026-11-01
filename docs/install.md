---
title: Install Codex CLI command extensions
description: Install the Codex Command Extensions release, enable its user-local launcher, register plugins, check PATH, update or remove terminal integration.
permalink: /install/
---
{% include nav.html %}

# Install Codex Command Extensions

Use a regular Bash or Zsh terminal on a computer with **Node.js 24+**, npm, **Python 3**, and Codex CLI. Linux is tested; macOS is untested. The host does not provide a Windows terminal backend.

## Download and enable the host

Download the built `.tgz` package from [release v0.1.2](https://github.com/Cheaux/codex-command-extensions/releases/tag/v0.1.2). The source ZIP and directory-submission draft are not the normal install package.

```sh
export PATH="$HOME/.local/bin:$PATH"
curl --fail --location --output codex-terminal-extensions-0.1.2.tgz \
  https://github.com/Cheaux/codex-command-extensions/releases/download/v0.1.2/codex-terminal-extensions-0.1.2.tgz
npm install --global --prefix "$HOME/.local" --ignore-scripts ./codex-terminal-extensions-0.1.2.tgz
codex-terminal enable
codex-terminal status --json
```

This is a user-account installation without `sudo`. Downloading first also works with npm's restriction on direct URL installation. To verify the archive, download `SHA256SUMS` from the same release and compare its entry with `sha256sum codex-terminal-extensions-0.1.2.tgz` on Linux or `shasum -a 256 codex-terminal-extensions-0.1.2.tgz` on macOS.

Add `export PATH="$HOME/.local/bin:$PATH"` to your shell startup file if newly opened terminals cannot find the commands. The launcher normally lives at `~/.local/bin/codex`, ahead of the original Codex executable on PATH.

## Add the feature you want

- [Install Codex Folders](https://cheaux.github.io/codex-folders/install/) for `/folders`, `/resume`, `/resumedbg` and shared project context.
- [Install Codex Remote](https://cheaux.github.io/codex-remote/install/) for phone pairing; run `codex-remote terminal enable` for `/qr`.
- [Register your own extension]({{ '/extensions/' | relative_url }}) using its manifest.

Open a **new Codex terminal** to load the launcher and registrations. Existing sessions and the native daemon can keep running. `codex-terminal install` optionally registers the conversational setup skill; it is not required to execute registered commands.

## Update

Download the current `.tgz` from [GitHub Releases](https://github.com/Cheaux/codex-command-extensions/releases/latest), install its local path with the npm command above, and open a new Codex terminal. Providers remain independent of the host package.

## Disable or remove

```sh
codex-terminal disable
npm uninstall --global --prefix "$HOME/.local" codex-terminal-extensions
```

Disable the launcher before uninstalling the package. The disable operation removes only the host's owned launcher; registrations and feature data are preserved. To remove just one provider, use `codex-terminal unregister EXTENSION_ID`, or its own disable command. Feature-specific data removal follows that feature's documentation.

## Custom paths

`CODEX_HOME` selects the Codex home. Registrations and ownership normally live in `~/.codex/terminal-extensions`; `CODEX_TERMINAL_DATA_DIR` overrides that directory. `CODEX_TERMINAL_BIN_DIR` selects another user-owned launcher directory. `CODEX_TERMINAL_CODEX_BIN` selects the original executable, and `CODEX_TERMINAL_PYTHON` selects Python. Keep the same overrides when enabling, checking and disabling.
