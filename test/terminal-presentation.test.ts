import test from 'node:test';
import assert from 'node:assert/strict';
import headless from '@xterm/headless';
import type { Terminal } from '@xterm/headless';
import { TerminalPresentation, TerminalState, terminalTitle } from '../src/terminal-presentation.js';

const create = () => new headless.Terminal({ cols: 80, rows: 24, allowProposedApi: true });
const write = (terminal: Terminal, text: string) => new Promise<void>(resolve => terminal.write(text, resolve));

test('native mouse encoding, tracking, focus and paste modes survive the outer terminal', async () => {
  const child = create(), outer = create();
  try {
    const state = new TerminalState(child), presentation = new TerminalPresentation();
    await write(outer, presentation.reset());
    await write(child, '\x1b[?1000h\x1b[?1002h\x1b[?1003h\x1b[?1006h\x1b[?1004h\x1b[?1007l\x1b[?2004h');
    await write(outer, presentation.apply(state));
    assert.equal(outer.modes.mouseTrackingMode, 'any');
    assert.equal(outer.modes.sendFocusMode, true);
    assert.equal(outer.modes.bracketedPasteMode, true);
    const replies: string[] = [];
    outer.onData(data => replies.push(data));
    await write(outer, '\x1b[?1006$p');
    assert.deepEqual(replies, ['\x1b[?1006;1$y']);
    assert.equal(presentation.apply(state), '');
    await write(outer, presentation.apply());
    assert.equal(outer.modes.mouseTrackingMode, 'none');
    assert.equal(outer.modes.sendFocusMode, false);
    assert.equal(outer.modes.bracketedPasteMode, false);
    await write(outer, presentation.apply(state));
    assert.equal(outer.modes.mouseTrackingMode, 'any');
    await write(outer, presentation.reset());
    assert.equal(outer.modes.mouseTrackingMode, 'none');
    assert.equal(outer.modes.sendFocusMode, false);
  } finally { child.dispose(); outer.dispose(); }
});

test('view switches replace input modes and foreground titles without background leakage', async () => {
  const first = create(), second = create(), outer = create();
  try {
    const a = new TerminalState(first), b = new TerminalState(second), presentation = new TerminalPresentation();
    const titles: string[] = [];
    outer.onTitleChange(title => titles.push(title));
    await write(outer, presentation.reset());
    await write(first, '\x1b[?1003h\x1b[?1006h\x1b[?1004h\x1b]0;Scraping groceries\x07');
    await write(second, '\x1b[?1002h\x1b[?1h\x1b[?1007h\x1b]2;Plugin creation\x1b\\');
    await write(outer, presentation.apply(a));
    await write(second, '\x1b]0;Background renamed\x07');
    assert.equal(presentation.apply(a), '');
    assert.deepEqual(titles, ['Scraping groceries']);
    await write(outer, presentation.apply(b));
    assert.equal(outer.modes.mouseTrackingMode, 'drag');
    assert.equal(outer.modes.sendFocusMode, false);
    assert.equal(outer.modes.applicationCursorKeysMode, true);
    await write(outer, presentation.apply(a));
    assert.equal(outer.modes.mouseTrackingMode, 'any');
    assert.equal(outer.modes.applicationCursorKeysMode, false);
    assert.deepEqual(titles, ['Scraping groceries', 'Background renamed', 'Scraping groceries']);
    await write(first, '\x1b]0;Renamed chat\x07');
    assert.equal(a.title, 'Renamed chat');
    assert.equal(terminalTitle('Renamed\u009b title\x1b\x07'), 'Renamed  title');
    assert.equal(presentation.apply(a).includes('\u009b'), false);
    await write(first, `\x1b]0;${'x'.repeat(900)}\x07`);
    assert.equal(a.title.length, 512);
  } finally { first.dispose(); second.dispose(); outer.dispose(); }
});
