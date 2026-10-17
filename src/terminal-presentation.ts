import type { Terminal } from '@xterm/headless';
import { clean } from './terminal-text.js';

const CSI = '\x1b[';
const tracking = { none: 0, x10: 9, vt200: 1000, drag: 1002, any: 1003 };
const encodings = [1005, 1006, 1015, 1016];
const controlled = [1, 9, 1000, 1002, 1003, 1004, ...encodings, 1007, 2004];
const setModes = (modes: number[], enabled: boolean) => modes.length ? `${CSI}?${modes.join(';')}${enabled ? 'h' : 'l'}` : '';
export const terminalTitle = (title: string) => Array.from(clean(title).trim()).slice(0, 512).join('') || 'Codex';

/** State owned by one child terminal, including modes not exposed by xterm's public API. */
export class TerminalState {
  title = 'Codex';
  private encoding = 0;
  private alternateScroll = false;
  constructor(readonly terminal: Terminal) {
    terminal.onTitleChange(title => { this.title = terminalTitle(title); });
    for (const final of ['h', 'l']) terminal.parser.registerCsiHandler({ prefix: '?', final }, params => {
      for (const mode of params) {
        if (typeof mode !== 'number') continue;
        if (encodings.includes(mode)) this.encoding = final === 'h' ? mode : 0;
        if (mode === 1007) this.alternateScroll = final === 'h';
      }
      return false;
    });
  }
  modes() {
    const modes = this.terminal.modes;
    return new Set([
      modes.applicationCursorKeysMode ? 1 : 0,
      tracking[modes.mouseTrackingMode],
      modes.sendFocusMode ? 1004 : 0,
      this.encoding,
      this.alternateScroll ? 1007 : 0,
      modes.bracketedPasteMode ? 2004 : 0,
    ].filter(Boolean));
  }
}

/** Synchronize only the foreground child's input modes and title with the outer terminal. */
export class TerminalPresentation {
  private applied = new Set<number>();
  private title = '';
  reset() {
    this.applied.clear();
    return setModes(controlled, false);
  }
  apply(state?: TerminalState) {
    const wanted = state?.modes() ?? new Set<number>();
    // Disable obsolete tracking/encoding modes before enabling their replacements.
    // Many terminals clear all mouse tracking when any tracking mode is reset.
    let output = setModes(controlled.filter(mode => this.applied.has(mode) && !wanted.has(mode)), false);
    output += setModes(controlled.filter(mode => wanted.has(mode) && !this.applied.has(mode)), true);
    this.applied = wanted;
    if (state && state.title !== this.title) {
      this.title = state.title;
      output += `\x1b]0;${this.title}\x1b\\`;
    }
    return output;
  }
}
