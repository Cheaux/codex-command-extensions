Initial public release of the shared terminal host for modular Codex CLI extensions.

- One command registry and user-local launcher, with independent provider manifests.
- Generic autocomplete, keyboard routing, retained PTY views, overlay handoff, and native aliases.
- Preserves tested terminal scrolling, titles, per-view input modes, resize, and cleanup.
- Safe migration of an unchanged previous launcher; unregistering one feature preserves others.
- Remote0.2.0 registers /qr without requiring Folders. Folders registers its browser and aliases independently.

Requires Node24+, Python3, and native Codex CLI. The current PTY backend supports Linux/macOS; Linux/Codex0.163.0 is tested. Windows needs a separate backend. Feature CLI/MCP tools do not require the host.

[Installation and provider API](https://github.com/Cheaux/codex-terminal-extensions#install)

Install the built .tgz asset, not the automatic source ZIP. SHA256SUMS verifies the download.
