import type { Terminal } from '@xterm/headless';
import type { InputCommand } from './terminal-input.js';
export type NativeCommand = { row: number; text: string; selected: boolean };
/** Read only native command popup rows adjacent to the composer. */
export function nativeCommands(terminal: Terminal, query: string): NativeCommand[] {
  const buffer = terminal.buffer.active, result: NativeCommand[] = [];
  for (let row = Math.max(0, buffer.cursorY - 8); row < buffer.cursorY; row++) {
    const text = buffer.getLine(buffer.baseY + row)?.translateToString(true) || '';
    const match = /^\s*([›>]?)\s*(\/\S+)\s{2,}(\S.*)$/.exec(text);
    if (match && match[2]!.startsWith(query)) result.push({ row, text: `${match[2]}  ${match[3]}`, selected: !!match[1] });
  }
  return result;
}
export function commandCompletionRows(terminal: Terminal, query: string, selected: number | null, commands: InputCommand[]) {
  const native = nativeCommands(terminal, query);
  const bottom = native.length ? native[0]!.row : terminal.buffer.active.cursorY - 1;
  const count = Math.min(commands.length, 6, Math.max(0, bottom));
  const offset = selected === null ? 0 : Math.max(0, selected - count + 1);
  return [
    ...commands.slice(offset, offset + count).map((command, index) => ({ row: bottom - count + index, text: `${command.name}    ${command.description}`, selected: selected === offset + index })),
    ...native.map(item => ({ ...item, selected: selected === null && item.selected })),
  ];
}
