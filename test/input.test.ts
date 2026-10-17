import test from 'node:test';
import assert from 'node:assert/strict';
import { TerminalInput } from '../src/terminal-input.js';
import { TerminalTheme } from '../src/terminal-theme.js';
import { interactiveArguments, inheritedArguments } from '../src/arguments.js';
import { createRequire } from 'node:module';
import { nativeCommands, commandCompletionRows } from '../src/terminal-completion.js';
const { Terminal } = createRequire(import.meta.url)('@xterm/headless') as typeof import('@xterm/headless');

const commands = [
  { name: '/folders', description: 'Browse chat folders', shortcut: 'f', suggest: false },
  { name: '/resume', description: 'Browse chat folders', suggest: false },
  { name: '/resumedbg', description: 'Open the original chat picker', preferNative: true },
  { name: '/qr', description: 'pair ChatGPT mobile' },
];
const legacyAction = (name: string) => ({ '/folders':'folders', '/resume':'folders', '/resumedbg':'native-resume', '/qr':'remote-qr', '@back':'back' })[name as '/folders'] || name;
function router(empty = true) {
  const chunks: Buffer[] = []; const actions: unknown[] = [];
  const input = new TerminalInput(() => empty, () => true, data => chunks.push(data), (action, clear) => actions.push([legacyAction(action), clear]), undefined, { commands: commands.map(command => ({ ...command, suggest: false })), nativeSelection: () => ({ index: 0, count: 0 }), repaint: () => {} });
  return { input, actions, text: () => Buffer.concat(chunks).toString() };
}
test('only exact freshly typed folder/resume commands are intercepted', () => {
  for (const command of ['/folders', '/resume']) {
    const r = router(); r.input.feed(Buffer.from(command)); r.input.feed(Buffer.from('\r'));
    assert.deepEqual(r.actions, [['folders', true]]); assert.equal(r.text(), command); r.input.reset();
  }
  for (const value of ['/folders more\r', '/resume id\r', '/resumedbg id\r', 'normal /folders\r', 'normal /resumedbg\r', '\x1b[200~/folders\r\x1b[201~', '\x1b[200~/resumedbg\r\x1b[201~']) {
    const r = router(); r.input.feed(Buffer.from(value)); assert.deepEqual(r.actions, []); assert.equal(r.text(), value); r.input.reset();
  }
  const draft = router(false); draft.input.feed(Buffer.from('/folders\r')); assert.deepEqual(draft.actions, []); assert.equal(draft.text(), '/folders\r');
});
test('/resumedbg dispatches native resume and mouse/focus reports preserve command detection', () => {
  const r = router();
  r.input.feed(Buffer.from('\x1b[I\x1b[<64;10;5M\x1b[<35;11;5M'));
  r.input.feed(Buffer.from('/resu'));
  r.input.feed(Buffer.from('\x1b[O\x1b[<65;10;5M'));
  r.input.feed(Buffer.from('medbg\r'));
  assert.deepEqual(r.actions, [['native-resume', true]]);
  assert.equal(r.text(), '\x1b[I\x1b[<64;10;5M\x1b[<35;11;5M/resu\x1b[O\x1b[<65;10;5Mmedbg');
  r.input.reset();
  const draft = router(false); draft.input.feed(Buffer.from('/resumedbg\r'));
  assert.deepEqual(draft.actions, []); assert.equal(draft.text(), '/resumedbg\r'); draft.input.reset();
});
test('shortcuts preserve the composer and unrelated terminal bytes', () => {
  const r = router(false); r.input.feed(Buffer.from('draft\x18f')); assert.equal(r.text(), 'draft'); assert.deepEqual(r.actions, [['folders', false]]);
  r.input.feed(Buffer.from('\x18b')); assert.deepEqual(r.actions[1], ['back', false]);
  r.input.feed(Buffer.from('\x18z\x1b[A\x1b[1;5C')); assert.equal(r.text(), 'draft\x18z\x1b[A\x1b[1;5C'); r.input.reset();
});
test('remote pairing intercepts only a freshly typed exact /qr command', () => {
  const r = router(); r.input.feed(Buffer.from('/q')); r.input.feed(Buffer.from('r\r'));
  assert.deepEqual(r.actions, [['remote-qr', true]]); assert.equal(r.text(), '/qr'); r.input.reset();
  for (const value of ['/qr extra\r', 'show /qr\r', '\x1b[200~/qr\r\x1b[201~']) {
    const r = router(); r.input.feed(Buffer.from(value)); assert.deepEqual(r.actions, []); assert.equal(r.text(), value); r.input.reset();
  }
  const draft = router(false); draft.input.feed(Buffer.from('/qr\r')); assert.deepEqual(draft.actions, []); assert.equal(draft.text(), '/qr\r'); draft.input.reset();
});
function qrRouter(available = true) {
  const chunks: Buffer[] = [], actions: unknown[] = [];
  const input = new TerminalInput(() => true, () => true, data => chunks.push(data), (action, clear) => actions.push([legacyAction(action), clear]), undefined,
    { commands: commands.filter(command => available || command.name !== '/qr'), nativeSelection: () => ({ index: 0, count: 1 }), repaint: () => {} });
  return { input, actions, text: () => Buffer.concat(chunks).toString() };
}
test('QR autocomplete completes with Tab or Enter and preserves selectable native quit', () => {
  const tab = qrRouter(); tab.input.feed(Buffer.from('/q\t'));
  assert.equal(tab.text(), '/qr'); assert.equal(tab.input.commandCompletion()?.selected, true);
  tab.input.feed(Buffer.from('\r')); assert.deepEqual(tab.actions, [['remote-qr', true]]); tab.input.reset();
  const enter = qrRouter(); enter.input.feed(Buffer.from('/q\r'));
  assert.deepEqual(enter.actions, [['remote-qr', true]]); enter.input.reset();
  const native = qrRouter(); native.input.feed(Buffer.from('/q\x1b[B'));
  assert.equal(native.input.commandCompletion()?.selected, false);
  native.input.feed(Buffer.from('\r')); assert.deepEqual(native.actions, []); assert.equal(native.text(), '/q\r'); native.input.reset();
  const cycle = qrRouter(); cycle.input.feed(Buffer.from('/q\x1b[B\x1b[A\r'));
  assert.deepEqual(cycle.actions, [['remote-qr', true]]); cycle.input.reset();
});
test('QR suggestions dismiss with Escape and never intercept pastes, unrelated input or unavailable integrations', async () => {
  const escaped = qrRouter(); escaped.input.feed(Buffer.from('/q\x1b'));
  await new Promise(resolve => setTimeout(resolve, 60)); assert.equal(escaped.input.commandCompletion(), undefined); escaped.input.reset();
  for (const text of ['normal /q\r', '\x1b[200~/q\r\x1b[201~', '/quit\r']) {
    const r = qrRouter(); r.input.feed(Buffer.from(text)); assert.equal(r.input.commandCompletion(), undefined); assert.deepEqual(r.actions, []); assert.equal(r.text(), text); r.input.reset();
  }
  const missing = qrRouter(false); missing.input.feed(Buffer.from('/q\r')); assert.deepEqual(missing.actions, []); assert.equal(missing.text(), '/q\r'); missing.input.reset();
});
test('QR completion adds one row alongside the native popup and leaves the composer in place', async () => {
  const terminal = new Terminal({ cols: 60, rows: 15, allowProposedApi: true });
  await new Promise<void>(resolve => terminal.write('\x1b[10;1H› /quit  exit Codex\x1b[12;1H› /q', resolve));
  assert.deepEqual(nativeCommands(terminal, '/q'), [{ row: 9, text: '/quit  exit Codex', selected: true }]);
  const rows = commandCompletionRows(terminal, '/q', 0, commands.filter(command => command.name === '/qr'));
  assert.equal(rows[0]!.row, 8); assert.match(rows[0]!.text, /\/qr.*pair ChatGPT/);
  assert.equal(rows[0]!.selected, true); assert.equal(rows[1]!.selected, false); assert.equal(terminal.buffer.active.cursorY, 11);
  assert.equal(commandCompletionRows(terminal, '/q', null, commands.filter(command => command.name === '/qr'))[1]!.selected, true); terminal.dispose();
});
test('original picker completion preserves default /resume, supports arrows/Tab and completes the alias before dispatch', () => {
  const normal = qrRouter(false); normal.input.feed(Buffer.from('/resume'));
  assert.equal(normal.input.commandCompletion()?.matches[0]?.name, '/resumedbg'); assert.equal(normal.input.commandCompletion()?.selected, false);
  normal.input.feed(Buffer.from('\r')); assert.deepEqual(normal.actions, [['folders', true]]); normal.input.reset();
  const alias = qrRouter(false); alias.input.feed(Buffer.from('/res\x1b[A\t'));
  assert.equal(alias.text(), '/resumedbg'); alias.input.feed(Buffer.from('\r')); assert.deepEqual(alias.actions, [['native-resume', true]]); alias.input.reset();
  const enter = qrRouter(false); enter.input.feed(Buffer.from('/res\x1b[A\r'));
  assert.equal(enter.text(), '/resumedbg'); assert.deepEqual(enter.actions, [['native-resume', true]]); enter.input.reset();
  const exact = qrRouter(false); exact.input.feed(Buffer.from('/resumedbg\r')); assert.deepEqual(exact.actions, [['native-resume', true]]); exact.input.reset();
  for (const value of ['message /res\r', '\x1b[200~/resumedbg\r\x1b[201~', '/resumedbg id\r']) {
    const r = qrRouter(false); r.input.feed(Buffer.from(value)); assert.equal(r.input.commandCompletion(), undefined); assert.deepEqual(r.actions, []); assert.equal(r.text(), value); r.input.reset();
  }
});
test('explicit native overrides apply when the native suggestion is accepted with Enter or Tab', () => {
  function overridden(alias = true, native = '/resume', empty = true) {
    const chunks: Buffer[] = [], actions: unknown[] = [];
    const input = new TerminalInput(() => empty, () => true, data => chunks.push(data), (name, clear) => actions.push([name, clear]), undefined, {
      commands: [{ name: '/resume', description: 'Browse chat folders', suggest: false, replaceNative: true },
        ...(alias ? [{ name: '/resumedbg', description: 'Open the original chat picker', preferNative: true }] : [])],
      nativeSelection: () => ({ index: 0, count: native ? 1 : 0, name: native || undefined }), repaint: () => {},
    });
    return { input, actions, text: () => Buffer.concat(chunks).toString() };
  }
  for (const alias of [true, false]) {
    const enter = overridden(alias); enter.input.feed(Buffer.from('/res')); enter.input.feed(Buffer.from('\r'));
    assert.deepEqual(enter.actions, [['/resume', true]]); assert.equal(enter.text(), '/resume'); enter.input.reset();
    const tab = overridden(alias); tab.input.feed(Buffer.from('/res\t'));
    assert.equal(tab.text(), '/resume'); assert.deepEqual(tab.actions, []);
    tab.input.feed(Buffer.from('\r')); assert.deepEqual(tab.actions, [['/resume', true]]); tab.input.reset();
  }
  const args = overridden(); args.input.feed(Buffer.from('/res\t thread-id\r'));
  assert.deepEqual(args.actions, []); assert.equal(args.text(), '/resume thread-id\r'); args.input.reset();
  const alias = overridden(); alias.input.feed(Buffer.from('/res\x1b[A\r'));
  assert.deepEqual(alias.actions, [['/resumedbg', true]]); alias.input.reset();
  for (const value of ['message /res\r', '\x1b[200~/res\x1b[201~\r']) {
    const pasted = overridden(); pasted.input.feed(Buffer.from(value)); assert.deepEqual(pasted.actions, []); pasted.input.reset();
  }
  for (const selected of ['/restart', '']) {
    const other = overridden(true, selected); other.input.feed(Buffer.from('/res\r'));
    assert.deepEqual(other.actions, []); assert.equal(other.text(), '/res\r'); other.input.reset();
  }
  const draft = overridden(true, '/resume', false); draft.input.feed(Buffer.from('/res\r'));
  assert.deepEqual(draft.actions, []); draft.input.reset();
});
test('original picker description appears alongside native resume without selecting it by default', async () => {
  const terminal = new Terminal({ cols: 80, rows: 15, allowProposedApi: true });
  await new Promise<void>(resolve => terminal.write('\x1b[10;1H› /resume  resume a saved chat\x1b[12;1H› /res', resolve));
  const rows = commandCompletionRows(terminal, '/res', null, commands.filter(command => command.name === '/resumedbg'));
  assert.match(rows[0]!.text, /\/resumedbg.*Open the original chat picker/); assert.equal(rows[0]!.selected, false); assert.equal(rows[1]!.selected, true);
  assert.equal(terminal.buffer.active.cursorY, 11); terminal.dispose();
});
test('scripts and service commands bypass the interactive launcher', () => {
  for (const args of [['--version'], ['--help'], ['-c', 'a=b', 'exec', 'task'], ['app-server', '--stdio'], ['plugin', 'list'], ['mcp', 'list'], ['--remote', 'ws://localhost:1234'], ['archive', 'id'], ['doctor']]) assert.equal(interactiveArguments(args), false);
  for (const args of [[], ['hello'], ['-C', '/project'], ['resume', 'thread-id'], ['-m', 'gpt-6', 'fork', 'thread-id']]) assert.equal(interactiveArguments(args), true);
});
test('picker launches preserve explicit sandbox, approvals, model and profile options', () => {
  assert.deepEqual(inheritedArguments(['-C', '/original', '--sandbox', 'read-only', '--ask-for-approval=never', '-m', 'gpt-6', '-c', 'model_provider="test"', '--no-daemon', 'resume', 'id', '--last', '--image', '/pic.png']),
    ['--sandbox', 'read-only', '--ask-for-approval=never', '-m', 'gpt-6', '-c', 'model_provider="test"', '--no-daemon']);
});
test('Escape reaches Codex without requiring a second key', async () => {
  const r = router(); r.input.feed(Buffer.from('\x1b')); await new Promise(resolve => setTimeout(resolve, 60)); assert.equal(r.text(), '\x1b'); r.input.reset();
});
test('native theme queries reach the real terminal and return to the requesting views', () => {
  const queries: string[] = [], first: string[] = [], second: string[] = [], input: Buffer[] = [];
  const theme = new TerminalTheme(query => queries.push(query));
  theme.request(11, data => first.push(data.toString())); theme.request(11, data => second.push(data.toString()));
  assert.deepEqual(queries, ['\x1b]11;?\x1b\\']);
  const router = new TerminalInput(() => true, () => true, data => input.push(data), () => {}, sequence => theme.accept(sequence));
  const reply = '\x1b]11;rgb:0b0b/0c0c/1818\x1b\\';
  router.feed(Buffer.from(reply.slice(0, 7))); router.feed(Buffer.from(reply.slice(7)));
  assert.deepEqual(first, [reply]); assert.deepEqual(second, [reply]); assert.equal(input.length, 0);
  theme.request(11, data => first.push(data.toString())); assert.equal(queries.length, 1); assert.equal(first.length, 2);
  router.feed(Buffer.from('draft\x1b[A')); assert.equal(Buffer.concat(input).toString(), 'draft\x1b[A');
  assert.equal(theme.accept(Buffer.from('\x1b]52;c;clipboard\x07')), false);
  assert.equal(theme.accept(Buffer.from('\x1b]11;not-a-color\x07')), false);
  router.reset(); theme.dispose();
});
