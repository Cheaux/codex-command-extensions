import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
const version: string = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { enable, disable, launcherStatus } from './install.js';
import { register, unregister, loadExtensions } from './registry.js';
import { launch } from './launcher.js';

async function run() {
  const [command = 'help', ...args] = process.argv.slice(2);
  if (command === '--version') { console.log(version); return; }
  if (command === 'backend-path') { console.log(fileURLToPath(new URL('../runtime/pty_host.py', import.meta.url))); return; }
  if (['help','--help','-h'].includes(command)) {
    console.log(`Codex Terminal Extensions ${version} — shared terminal command host

codex-terminal enable [--migrate-from FILE]  Enable one user-local Codex launcher
codex-terminal disable                     Remove only the owned launcher
codex-terminal register MANIFEST            Register an extension's commands
codex-terminal unregister EXTENSION_ID      Remove only that extension
codex-terminal status [--json]              Inspect host and registrations
codex-terminal launch [--extension FILE] -- [CODEX_ARGS]
codex-terminal install                     Install the optional Codex setup skill

Ctrl+X then B switches retained views. Commands come from registered extensions.
No chat data, account credentials, remote relay, or feature logic is stored here.
The current PTY backend supports Linux/macOS. It requires Python 3.
CODEX_HOME, CODEX_TERMINAL_DATA_DIR, CODEX_TERMINAL_BIN_DIR,
CODEX_TERMINAL_CODEX_BIN and CODEX_TERMINAL_PYTHON are respected.`); return;
  }
  if (command === 'launch') {
    const separator = args.indexOf('--');
    const options = separator < 0 ? [] : args.slice(0, separator);
    const parsed = parseArgs({ args: options, options: { extension: { type: 'string', multiple: true } } });
    await launch(separator < 0 ? args : args.slice(separator + 1), parsed.values.extension || []); return;
  }
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { json: { type: 'boolean' }, 'migrate-from': { type: 'string' } } });
  let result: unknown;
  if (command === 'enable') result = enable(values['migrate-from']);
  else if (command === 'disable') result = disable();
  else if (command === 'status') result = { version, ...launcherStatus(), ...loadExtensions() };
  else if (command === 'register' && positionals.length === 1) result = register(positionals[0]!);
  else if (command === 'unregister' && positionals.length === 1) result = unregister(positionals[0]!);
  else if (command === 'install') {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const native = process.env.CODEX_TERMINAL_CODEX_BIN || 'codex';
    execFileSync(native, ['plugin','marketplace','add',root,'--json'], { stdio: 'pipe' });
    execFileSync(native, ['plugin','add','codex-terminal-extensions@codex-terminal-extensions-local','--json'], { stdio: 'pipe' });
    result = { installed: true, next: 'Run codex-terminal enable and open a new terminal to load registered commands.' };
  } else throw Error('Unknown command or invalid arguments. Run codex-terminal --help.');
  console.log(JSON.stringify(result, null, 2));
}
try { await run(); } catch (error) { process.stderr.write(`Codex Terminal: ${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; }
