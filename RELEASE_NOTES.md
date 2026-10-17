Codex Command Extensions 0.1.2

Fixed native command autocomplete bypassing registered replacements. Accepting `/resume` from the native popup with Enter or Tab now opens Folders when its provider is registered, just like typing the full command. `/resumedbg` still opens the original picker; `/resume THREAD_ID` remains native.

Validated with 20 host tests, clean-package checks, and real isolated Codex 0.163 terminal checks for full typing, Tab/Enter acceptance, and the original-picker alias.

Install the `.tgz` asset, then open a new Codex terminal; existing sessions and phone pairing stay running. The `-directory.zip` is a submission draft, not an official directory listing. See [submission preparation](https://github.com/Cheaux/codex-command-extensions/blob/main/submission/README.md).
