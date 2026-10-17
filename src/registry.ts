import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { z } from 'zod';

const program = { executable: z.string().min(1), args: z.array(z.string()).default([]), env: z.record(z.string(), z.string()).default({}) };
export const commandSchema = z.object({
  name: z.string().regex(/^\/[a-z][a-z0-9-]{0,47}$/), description: z.string().min(1).max(160),
  suggest: z.boolean().default(true), preferNative: z.boolean().default(false), replaceNative: z.boolean().default(false),
  shortcut: z.string().regex(/^[a-z]$/).optional(),
  action: z.discriminatedUnion('type', [
    z.object({ type: z.literal('view'), ...program }),
    z.object({ type: z.literal('overlay'), ...program }),
    z.object({ type: z.literal('native-alias'), target: z.string().regex(/^\/[a-z][a-z0-9-]*$/) }),
  ]),
});
export const extensionSchema = z.object({ schemaVersion: z.literal(1), id: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/), commands: z.array(commandSchema).min(1).max(64) });
export type Command = z.infer<typeof commandSchema> & { extensionId: string; root: string };
export const dataDirectory = () => process.env.CODEX_TERMINAL_DATA_DIR || join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'terminal-extensions');
const registrations = () => join(dataDirectory(), 'providers');
const nativeNames = new Set(['/quit','/exit','/help','/model','/permissions','/new','/clear','/resume','/fork','/plugins','/hooks','/compact']);

export function readExtension(path: string) {
  path = resolve(path);
  const raw = readFileSync(path, 'utf8');
  if (raw.length > 65536) throw Error('Extension manifest exceeds 64 KiB.');
  const extension = extensionSchema.parse(JSON.parse(raw));
  for (const command of extension.commands) {
    if (nativeNames.has(command.name) && !command.replaceNative) throw Error(`${command.name} requires explicit replaceNative: true.`);
    if (command.shortcut === 'b') throw Error('Ctrl+X B belongs to the shared view switcher.');
    if (command.action.type === 'native-alias' && (!command.name.startsWith(command.action.target) || command.name === command.action.target)) throw Error('A native alias must extend its target name so only the suffix is erased.');
  }
  return { id: extension.id, path, commands: extension.commands.map(command => ({ ...command, extensionId: extension.id, root: dirname(path) })) };
}
export function validateCommands(commands: Command[]) {
  const names = new Set<string>(), shortcuts = new Set<string>();
  for (const command of commands) {
    if (names.has(command.name)) throw Error(`Command conflict: ${command.name}. Remove one registration first.`);
    names.add(command.name);
    if (command.shortcut) {
      if (shortcuts.has(command.shortcut)) throw Error(`Shortcut conflict: Ctrl+X ${command.shortcut.toUpperCase()}.`);
      shortcuts.add(command.shortcut);
    }
  }
  return commands;
}
export function loadExtensions(extra: string[] = []) {
  const providers = new Map<string, ReturnType<typeof readExtension>>();
  const warnings: string[] = [];
  if (existsSync(registrations())) for (const file of readdirSync(registrations()).filter(name => name.endsWith('.json')).sort()) {
    try {
      const saved = JSON.parse(readFileSync(join(registrations(), file), 'utf8'));
      const provider = readExtension(saved.path);
      if (file !== `${provider.id}.json`) throw Error('Provider identity changed; register its new identity explicitly.');
      providers.set(provider.id, provider);
    } catch (error) { warnings.push(`${file}: ${error instanceof Error ? error.message : String(error)}`); }
  }
  for (const path of extra) { const provider = readExtension(path); providers.set(provider.id, provider); }
  const commands = validateCommands([...providers.values()].flatMap(provider => provider.commands));
  return { providers: [...providers.values()].map(({ id, path }) => ({ id, path })), commands, warnings };
}
export function register(path: string) {
  const provider = readExtension(path);
  const current = loadExtensions();
  validateCommands([...current.commands.filter(command => command.extensionId !== provider.id), ...provider.commands]);
  mkdirSync(registrations(), { recursive: true, mode: 0o700 });
  const destination = join(registrations(), `${provider.id}.json`), temporary = `${destination}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify({ path: provider.path }) + '\n', { mode: 0o600 });
  renameSync(temporary, destination);
  return { registered: provider.id, commands: provider.commands.map(command => command.name) };
}
export function unregister(id: string) {
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(id)) throw Error('Invalid extension ID.');
  const path = join(registrations(), `${id}.json`);
  if (existsSync(path)) unlinkSync(path);
  return { unregistered: id, otherExtensionsPreserved: true };
}
export function expandProgram(command: Command, codex: string) {
  if (command.action.type === 'native-alias') throw Error('Native aliases do not launch a program.');
  const expand = (value: string) => value.replace(/\$\{(NODE|EXTENSION_ROOT|CODEX_BIN)\}/g, (_, name: string) => ({ NODE: process.execPath, EXTENSION_ROOT: command.root, CODEX_BIN: codex })[name]!);
  const executable = expand(command.action.executable);
  if (executable.includes('${')) throw Error('Unknown executable placeholder.');
  return { executable, args: command.action.args.map(expand), env: Object.fromEntries(Object.entries(command.action.env).map(([key, value]) => [key, expand(value)])) };
}
