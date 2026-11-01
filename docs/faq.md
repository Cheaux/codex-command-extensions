---
title: Slash-command FAQ
description: Fix missing custom Codex CLI commands, understand host and feature plugins, check platform support and disable the launcher safely.
permalink: /faq/
---
{% include nav.html %}

# Codex command extensions: FAQ and troubleshooting

## How do I add custom slash commands to Codex CLI?

[Install and enable the host]({{ '/install/' | relative_url }}), then register a feature's `terminal-extension.json`. Open a new Codex terminal to load it. Type its command prefix, complete with Tab, and run with Enter. Extension authors can [define their own commands]({{ '/extensions/' | relative_url }}).

## Why do `/folders` and `/qr` not appear after installing the host?

The host supplies autocomplete and terminal routing; the feature packages supply commands. Install [Codex Folders](https://cheaux.github.io/codex-folders/install/) or [Codex Remote](https://cheaux.github.io/codex-remote/install/), enable its registration, then open a new terminal. Inspect `codex-terminal status --json` for missing or stale providers.

## Does phone pairing require Folders?

No. Remote and Folders register independently. Remote's CLI and conversational pairing do not require the terminal host; its `/qr` shortcut does. Removing one feature preserves the other feature's registration.

## Is this an official OpenAI plugin or a patched Codex binary?

It is an independent MIT-licensed community project by Cheaux. It installs a reversible user-local launcher that invokes the original Codex executable. OpenAI does not maintain or endorse it. Its directory-submission ZIP is a draft, not an approved directory listing.

## Which operating systems work?

Linux with Node.js 24+, Python 3 and Codex CLI 0.163.0 is the tested baseline. The Python PTY backend supports Linux/macOS, but macOS remains untested. Windows terminal integration is unavailable in this release. Compatibility with future native Codex interfaces is not guaranteed.

## Why does accepting `/resume` still open the original picker?

Use host v0.1.2 or newer for the native autocomplete replacement fix, enable the Folders provider, and open a new terminal. With Folders enabled, bare `/resume` opens its browser. `/resumedbg` opens the original picker and `/resume THREAD_ID` keeps its native behavior.

## Does installation restart my running chats or daemon?

No. Existing terminals keep their loaded version. Open a new terminal to use updated registrations. Retained terminal views remain running until you exit them and continue to use system resources.

## What if the launcher refuses to replace an existing executable?

The host preserves unknown or modified executables. Check `codex-terminal status --json`, confirm PATH ordering and use a user-owned `CODEX_TERMINAL_BIN_DIR` if needed. Do not overwrite an unrelated executable to bypass the ownership check. [Custom paths]({{ '/install/#custom-paths' | relative_url }})

## How do I turn it off?

Run `codex-terminal disable` to remove the host's owned launcher while preserving registrations. To remove one feature, use its own disable command or `codex-terminal unregister EXTENSION_ID`. [Removal instructions]({{ '/install/#disable-or-remove' | relative_url }})

## Does this work with Claude CLI?

This host targets Codex CLI. No Claude integration is provided or claimed.

For other issues, include the host and native Codex versions, operating system, expected command and sanitized status output in a [GitHub issue](https://github.com/Cheaux/codex-command-extensions/issues). Do not upload private chats, pairing QR codes or credentials.
