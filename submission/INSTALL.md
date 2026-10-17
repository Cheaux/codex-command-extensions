# Codex Command Extensions: directory installation prerequisites

The ZIP is a draft for OpenAI directory review, not evidence of approval or publication. It packages a skill.

Install Node 24+ and the official Codex CLI first. Before enabling this plugin, install the matching standalone CLI from the public release:

```sh
curl --fail --location --output codex-terminal-extensions-0.1.2.tgz \
  https://github.com/Cheaux/codex-command-extensions/releases/download/v0.1.2/codex-terminal-extensions-0.1.2.tgz
npm install --global --prefix "$HOME/.local" --ignore-scripts ./codex-terminal-extensions-0.1.2.tgz
export PATH="$HOME/.local/bin:$PATH"
```

The command host also requires Python 3 on Linux/macOS. Run `codex-terminal enable`, register a feature, then open a new Codex terminal. The existing command and package identifiers remain stable for compatibility.

Existing Codex sessions and paired phones should remain running. Reviewers must use isolated test data/accounts; never ask for real pairing credentials.
