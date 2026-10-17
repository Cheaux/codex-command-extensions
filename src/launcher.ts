import { spawn, spawnSync, type ChildProcess, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Terminal, type IBufferCell } from '@xterm/headless';
import { fit } from './terminal-text.js';
import { loadExtensions, expandProgram, type Command } from './registry.js';
import { z } from 'zod';
import { TerminalInput } from './terminal-input.js';
import { TerminalTheme } from './terminal-theme.js';
import { TerminalPresentation, TerminalState } from './terminal-presentation.js';
import { nativeCommands, commandCompletionRows } from './terminal-completion.js';
import { interactiveArguments, inheritedArguments } from './arguments.js';
import { officialCodex } from './install.js';

type Session = { host: ChildProcessWithoutNullStreams; terminal: Terminal; state: TerminalState; label: string; visibleCursor: boolean; alive: boolean; ready: Promise<void>; native: boolean };
const CSI = '\x1b[';
function cellStyle(cell: IBufferCell) {
  const codes = [0];
  for (const [set, code] of [[cell.isBold(), 1], [cell.isDim(), 2], [cell.isItalic(), 3], [cell.isUnderline(), 4], [cell.isBlink(), 5], [cell.isInverse(), 7], [cell.isInvisible(), 8], [cell.isStrikethrough(), 9]]) if (set) codes.push(code!);
  for (const foreground of [true, false]) {
    const color = foreground ? cell.getFgColor() : cell.getBgColor();
    if (foreground ? cell.isFgRGB() : cell.isBgRGB()) codes.push(foreground ? 38 : 48, 2, (color >> 16) & 255, (color >> 8) & 255, color & 255);
    else if (foreground ? cell.isFgPalette() : cell.isBgPalette()) codes.push(foreground ? 38 : 48, 5, color);
  }
  return `${CSI}${codes.join(';')}m`;
}
function renderLine(terminal: Terminal, row: number) {
  const line = terminal.buffer.active.getLine(terminal.buffer.active.baseY + row);
  if (!line) return '';
  let rendered = ''; let previous = '';
  for (let x = 0; x < terminal.cols; x++) {
    const cell = line.getCell(x); if (!cell || !cell.getWidth()) continue;
    const style = cellStyle(cell); if (style !== previous) { rendered += style; previous = style; }
    rendered += cell.getChars() || ' ';
  }
  return rendered;
}
export async function launch(args: string[], manifests: string[] = []) {
  const executable = officialCodex();
  const env = { ...process.env, CODEX_TERMINAL_CODEX_BIN: executable, CODEX_TERMINAL_WRAPPED: '1' };
  if (!process.stdin.isTTY || !process.stdout.isTTY || !interactiveArguments(args) || process.env.CODEX_TERMINAL_WRAPPED === '1') {
    const child = spawn(executable, args, { stdio: 'inherit', env });
    process.exitCode = await new Promise<number>((resolve, reject) => { child.once('error', reject); child.once('exit', (code, signal) => resolve(code ?? (signal ? 128 : 0))); }); return;
  }
  const python = process.env.CODEX_TERMINAL_PYTHON || 'python3';
  if (spawnSync(python, ['-c', 'import pty, termios'], { stdio: 'ignore' }).status !== 0) throw new Error('The terminal host requires Python 3 with pty/termios on Linux/macOS. Use codex-terminal disable to use Codex directly.');
  process.env.CODEX_TERMINAL_CODEX_BIN = executable;
  const hostScript = join(dirname(fileURLToPath(import.meta.url)), '../runtime/pty_host.py');
  const sharedArgs = inheritedArguments(args);
  const registry = loadExtensions(manifests);
  const commands = registry.commands;
  for (const warning of registry.warnings) process.stderr.write(`Skipped extension: ${warning}\n`);
  let overlayChild: ChildProcess | undefined;
  let notice = '';
  const selectionSchema = z.object({ type: z.literal('codex'), args: z.array(z.string()), label: z.string().max(100).optional() });
  let columns = Math.max(20, process.stdout.columns || 80); let rows = Math.max(4, (process.stdout.rows || 24) - 1);
  const sessions: Session[] = []; let active: Session | undefined; let overlay = false; let finished = false; let paintTimer: NodeJS.Timeout | undefined;
  let nextView = 1;
  let renderedLines: string[] = []; let footer = ''; let finish!: () => void;

  const completion = new Promise<void>(resolve => { finish = resolve; });
  const theme = new TerminalTheme(query => process.stdout.write(query));
  const presentation = new TerminalPresentation();
  let qrHighlight = `${CSI}0;30;104m`;
  function send(session: Session, message: object) { if (!session.host.stdin.destroyed) session.host.stdin.write(JSON.stringify(message) + '\n'); }
  function write(session: Session, data: Buffer | string) { send(session, { type: 'write', data: Buffer.from(data).toString('base64') }); }
  function paint(full = false) {
    if (finished || overlay || !active) return;
    const terminal = active.terminal; const buffer = terminal.buffer.active;
    const completion = input.commandCompletion();
    const completionRows = completion ? commandCompletionRows(terminal, completion.query, completion.selectedIndex, completion.matches) : [];
    if (completion) {
      const selectedNative = nativeCommands(terminal, completion.query).find(row => row.selected);
      const cell = selectedNative && buffer.getLine(buffer.baseY + selectedNative.row)?.getCell(0);
      if (cell && !cell.isBgDefault()) qrHighlight = cellStyle(cell);
    }
    const normalCell = buffer.getLine(buffer.baseY + buffer.cursorY)?.getCell(0);
    const normalStyle = normalCell ? cellStyle(normalCell) : `${CSI}0m`;
    let output = `${CSI}?25l${CSI}?7l`;
    if (full) { output += `${CSI}0m${CSI}2J`; renderedLines = []; footer = ''; }
    for (let row = 0; row < rows; row++) {
      const suggestion = completionRows.find(item => item.row === row);
      const line = suggestion
        ? `${suggestion.selected ? qrHighlight : normalStyle}${fit(`${suggestion.selected ? '› ' : '  '}${suggestion.text}`, columns).padEnd(columns)}${CSI}0m`
        : renderLine(terminal, row);
      if (renderedLines[row] !== line) { output += `${CSI}${row + 1};1H${line}${CSI}0m`; renderedLines[row] = line; }
    }
    const label = ` ${commands.map(command => command.name).join(' · ')}${sessions.length > 1 ? ' · Ctrl+X B back' : ''} · ${notice || active.label}`;
    const nextFooter = fit(label, columns - 1);
    if (footer !== nextFooter) { output += `${CSI}${rows + 1};1H${CSI}0;2m${nextFooter}${CSI}K${CSI}0m`; footer = nextFooter; }
    output += presentation.apply(active.state);
    output += `${CSI}${Math.min(rows, buffer.cursorY + 1)};${Math.min(columns, buffer.cursorX + 1)}H${CSI}?7h${CSI}?25${active.visibleCursor ? 'h' : 'l'}`;
    process.stdout.write(output);
  }
  function schedule() { if (!paintTimer && !overlay && !finished) paintTimer = setTimeout(() => { paintTimer = undefined; paint(); }, 33); }
  function focus(session: Session) { active = session; input.reset(); paint(true); }
  function previous() {
    if (!active || sessions.length < 2) return;
    const index = sessions.indexOf(active); focus(sessions[(index + sessions.length - 1) % sessions.length]!);
  }
  function exitSession(session: Session, code: number) {
    if (!session.alive) return; session.alive = false;
    const index = sessions.indexOf(session); if (index >= 0) sessions.splice(index, 1);
    if (!sessions.length) { process.exitCode = Math.max(0, code); overlayChild?.kill(); finish(); }
    else if (active === session) focus(sessions.at(-1)!);
    session.terminal.dispose();
  }
  function start(command: { executable: string; args: string[]; env?: Record<string, string> }, label: string, initial = false, inheritFlags = true, native = true) {
    // Always resume the exact selected ID. A retained TUI can change chats via /new,
    // so its launch-time thread ID cannot safely identify its current conversation.
    const terminal = new Terminal({ cols: columns, rows, allowProposedApi: true, scrollback: 2000 });
    const host = spawn(python, [hostScript, '--rows', String(rows), '--cols', String(columns), '--', command.executable, ...(initial || !inheritFlags ? [] : sharedArgs), ...command.args], { stdio: 'pipe', env: { ...env, ...command.env } });
    const session: Session = { host, terminal, state: new TerminalState(terminal), label, visibleCursor: true, alive: true, ready: Promise.resolve(), native };
    terminal.onData(data => write(session, data)); terminal.onBinary(data => write(session, Buffer.from(data, 'binary')));
    for (const code of [10, 11] as const) terminal.parser.registerOscHandler(code, data => {
      if (data !== '?') return false;
      theme.request(code, reply => { if (session.alive) write(session, reply); }); return true;
    });
    terminal.onBell(() => { if (active === session && !overlay) process.stdout.write('\x07'); });
    for (const final of ['h', 'l']) terminal.parser.registerCsiHandler({ prefix: '?', final }, params => { if (params.includes(25)) session.visibleCursor = final === 'h'; return false; });
    const lines = createInterface({ input: host.stdout });
    host.stdin.on('error', () => { /* The host may exit between a keypress and its final exit message. */ });
    lines.on('line', line => {
      try {
        const message = JSON.parse(line);
        if (message.type === 'data') {
          session.ready = new Promise(resolve => terminal.write(Buffer.from(message.data, 'base64'), () => { resolve(); if (active === session) schedule(); }));
        } else if (message.type === 'exit') void session.ready.then(() => exitSession(session, message.code));
      } catch { /* Ignore malformed private host messages; host exit closes this view. */ }
    });
    let hostError = '';
    host.stderr.on('data', data => { hostError = (hostError + data).slice(-2000); });
    host.once('error', error => { process.stderr.write(`Codex terminal: ${error.message}\n`); exitSession(session, 1); });
    host.once('exit', code => { void session.ready.then(() => { if (session.alive && hostError) process.stderr.write(hostError); exitSession(session, code || 0); }); });
    sessions.push(session); focus(session);
  }
  function composer(empty: boolean) {
    if (!active || !active.native) return false;
    const terminal = active.terminal; const buffer = terminal.buffer.active;
    const row = buffer.cursorY;
    const line = buffer.getLine(buffer.baseY + row)?.translateToString(false) || '';
    const match = /^(\s*)› /.exec(line);
    return !!match && !/^\d+\./.test(line.slice(match[0].length)) && (!empty || buffer.cursorX === match[0].length);
  }
  async function openOverlay(command: Command, clearCommand: boolean) {
    if (overlay || !active || finished) return;
    if (clearCommand) write(active, '\x15');
    overlay = true; input.reset(); process.stdin.off('data', onInput); process.stdin.pause();
    process.stdout.write(`${presentation.apply()}${CSI}?25h${CSI}0m${CSI}2J${CSI}H`);
    let selected: z.infer<typeof selectionSchema> | undefined;
    try {
      const program = expandProgram(command, executable);
      const child = spawn(program.executable, program.args, { stdio: ['inherit', 'inherit', 'inherit', 'pipe'], env: { ...env, ...program.env, CODEX_TERMINAL_RESULT_FD: '3' } });
      overlayChild = child;
      let response = '', overflow = false;
      child.stdio[3]?.on('data', (data: Buffer) => { response += data.toString('utf8'); if (response.length > 65536) { overflow = true; child.kill(); } });
      const code = await new Promise<number>((resolve, reject) => { child.once('error', reject); child.once('close', code => resolve(code ?? 1)); });
      if (overflow) throw Error('Overlay result exceeds 64 KiB.');
      if (code !== 0) throw Error(`Extension exited with status ${code}.`);
      if (response.trim()) selected = selectionSchema.parse(JSON.parse(response));
    } catch (error) { notice = `${command.name}: ${error instanceof Error ? error.message : String(error)}`; }
    finally {
      overlayChild = undefined; overlay = false;
      if (!finished) {
        process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.on('data', onInput);
        if (selected) start({ executable, args: selected.args }, selected.label || `view ${++nextView}`);
        else paint(true);
      }
    }
  }
  const input: TerminalInput = new TerminalInput(() => composer(true), () => composer(false), data => { if (active) write(active, data); }, (name, clear) => {
    if (name === '@back') { previous(); return; }
    const command = commands.find(command => command.name === name);
    if (!command) return;
    notice = '';
    if (command.action.type === 'native-alias') {
      // Erase only the alias suffix. A fresh text+Enter burst triggers native paste detection.
      if (active) write(active, '\x7f'.repeat(command.name.length - command.action.target.length) + '\r');
    } else if (command.action.type === 'view') {
      if (active && clear) write(active, '\x15');
      start(expandProgram(command, executable), command.description, false, false, false);
    } else void openOverlay(command, clear);
  }, sequence => theme.accept(sequence), {
    commands,
    nativeSelection: () => {
      const completion = input.commandCompletion();
      const native = active && completion ? nativeCommands(active.terminal, completion.query) : [];
      return { index: Math.max(0, native.findIndex(item => item.selected)), count: native.length };
    },
    repaint: schedule,
  });
  const onInput = (data: Buffer) => { input.feed(data); };
  function resize() {
    overlayChild?.kill('SIGWINCH');
    columns = Math.max(20, process.stdout.columns || 80); rows = Math.max(4, (process.stdout.rows || 24) - 1);
    for (const session of sessions) { session.terminal.resize(columns, rows); send(session, { type: 'resize', rows, cols: columns }); }
    paint(true);
  }
  function stop() { overlayChild?.kill(); finish(); }
  const originalRaw = process.stdin.isRaw;
  process.stdout.write(`${CSI}22;0t${CSI}?1049h${presentation.reset()}${CSI}2J${CSI}H`);
  process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.on('data', onInput);
  process.stdout.on('resize', resize); process.once('SIGTERM', stop); process.once('SIGHUP', stop); process.once('SIGINT', stop);
  try {
    start({ executable, args }, 'original session', true);
    await completion;
  } finally {
    finished = true; clearTimeout(paintTimer); input.reset(); theme.dispose(); overlayChild?.kill();
    process.stdin.off('data', onInput); process.stdin.setRawMode(originalRaw || false); process.stdin.pause(); process.stdout.off('resize', resize);
    process.off('SIGTERM', stop); process.off('SIGHUP', stop); process.off('SIGINT', stop);
    for (const session of sessions) { send(session, { type: 'close' }); session.host.stdin.end(); session.terminal.dispose(); }
    process.stdout.write(`${CSI}0m${presentation.reset()}${CSI}?7h${CSI}?25h${CSI}?1049l${CSI}23;0t`);
  }
}
