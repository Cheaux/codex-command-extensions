import { accessSync, closeSync, constants, existsSync, lstatSync, mkdirSync, openSync, readFileSync, readSync, realpathSync, unlinkSync, writeFileSync } from 'node:fs';
import { delimiter, dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dataDirectory } from './registry.js';

type Installation = { realCodex: string; shimPath: string; content: string };
const marker = '# codex-terminal-extensions-launcher';
const configuration = () => join(dataDirectory(), 'launcher.json');
const fileStatus = (path: string) => { try { return lstatSync(path); } catch { return undefined; } };
const quote = (value: string) => `'${value.replace(/'/g, `'"'"'`)}'`;
const read = (path: string): Installation | undefined => { try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return undefined; } };
function executable(path: string) { try { accessSync(path, constants.X_OK); return true; } catch { return false; } }
function wrapper(path: string) {
  let fd: number | undefined;
  try { fd = openSync(path, 'r'); const prefix = Buffer.alloc(100); const size = readSync(fd, prefix, 0, prefix.length, 0); return /^#!\/bin\/sh\n# codex-(?:terminal-extensions-launcher|folders-terminal-launcher)\n/.test(prefix.toString('utf8', 0, size)); }
  catch { return false; } finally { if (fd !== undefined) closeSync(fd); }
}
export function installation() { return read(configuration()); }
export function officialCodex(legacy?: Installation) {
  const override = process.env.CODEX_TERMINAL_CODEX_BIN;
  const saved = installation() || legacy;
  const candidates = override ? override.includes('/') ? [resolve(override)] : (process.env.PATH || '').split(delimiter).map(path => resolve(path, override))
    : [...(saved ? [saved.realCodex] : []), ...(process.env.PATH || '').split(delimiter).map(path => resolve(path, 'codex'))];
  const found = candidates.find(path => executable(path) && !wrapper(path));
  if (!found) throw Error('Cannot find the original Codex executable. Set CODEX_TERMINAL_CODEX_BIN to its path.');
  return found;
}
export function launcherStatus() {
  const saved = installation();
  return { enabled: !!saved && existsSync(saved.shimPath) && !lstatSync(saved.shimPath).isSymbolicLink() && readFileSync(saved.shimPath, 'utf8') === saved.content, ...(saved || {}) };
}
export function enable(migrateFrom?: string) {
  if (process.platform === 'win32') throw Error('The current PTY backend supports Linux/macOS; Windows needs a separate backend. CLI/MCP features remain independent.');
  const legacy = migrateFrom ? read(resolve(migrateFrom)) : undefined;
  if (migrateFrom && !legacy) throw Error('Cannot read the previous launcher ownership record.');
  const previous = installation();
  const realCodex = officialCodex(legacy);
  const shimPath = resolve(process.env.CODEX_TERMINAL_BIN_DIR || join(homedir(), '.local/bin'), 'codex');
  const owner = previous || legacy;
  const stat = fileStatus(shimPath);
  if (stat) {
    if (stat.isSymbolicLink() || !stat.isFile() || !owner || resolve(owner.shimPath) !== shimPath || readFileSync(shimPath, 'utf8') !== owner.content) throw Error(`${shimPath} is not an unchanged owned launcher. It was preserved. Use codex-terminal launch -- instead.`);
  }
  if (realpathSync(realCodex) === shimPath) throw Error('The original Codex executable must differ from the launcher.');
  const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url)).replace(/\/dist\/dist\/cli\.js$/, '/dist/cli.js');
  const content = `#!/bin/sh\n${marker}\nexec ${quote(process.execPath)} ${quote(cli)} launch -- "$@"\n`;
  mkdirSync(dirname(shimPath), { recursive: true }); mkdirSync(dataDirectory(), { recursive: true, mode: 0o700 });
  writeFileSync(shimPath, content, { mode: 0o755 });
  writeFileSync(configuration(), JSON.stringify({ realCodex, shimPath, content }, null, 2), { mode: 0o600 });
  return { enabled: true, realCodex, shimPath, migrated: !!legacy, next: 'Open a new Codex terminal. Existing sessions stay running.' };
}
export function disable() {
  const saved = installation();
  if (!saved) return { disabled: true, removed: false };
  const stat = fileStatus(saved.shimPath);
  if (stat) {
    if (stat.isSymbolicLink() || !stat.isFile() || readFileSync(saved.shimPath, 'utf8') !== saved.content) throw Error('The launcher was modified and has been preserved.');
    unlinkSync(saved.shimPath);
  }
  unlinkSync(configuration());
  return { disabled: true, removed: true, registrationsPreserved: true };
}
