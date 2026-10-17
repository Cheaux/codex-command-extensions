export type InputCommand = { name: string; description: string; suggest?: boolean; preferNative?: boolean; shortcut?: string };
export type TerminalAction = string;
export type CommandCompletion = { commands: InputCommand[]; nativeSelection(): { index: number; count: number }; repaint(): void };

/** Intercept only exact commands typed into an empty composer; preserve raw terminal input. */
export class TerminalInput {
  private candidate = '';
  private sequence: number[] = [];
  private paste = false;
  private chord = false;
  private timer?: NodeJS.Timeout;
  private escapeTimer?: NodeJS.Timeout;
  private draftBytes = 0;
  private selectedIndex: number | null = 0;
  private completionDismissed = false;
  constructor(private emptyComposer: () => boolean, private composerVisible: () => boolean,
    private forward: (data: Buffer) => void, private action: (action: TerminalAction, clearCommand: boolean) => void,
    private control?: (sequence: Buffer) => boolean, private qr?: CommandCompletion) {}
  reset() { this.candidate = ''; this.sequence = []; this.paste = false; this.chord = false; this.draftBytes = 0; this.selectedIndex = 0; this.completionDismissed = false; clearTimeout(this.timer); clearTimeout(this.escapeTimer); }
  commandCompletion() {
    const matches = this.candidate.length > 1 ? (this.qr?.commands || []).filter(command => command.suggest !== false && command.name.startsWith(this.candidate)) : [];
    return !this.completionDismissed && this.qr && matches.length && this.composerVisible()
      ? { query: this.candidate, matches, selectedIndex: this.selectedIndex, selected: this.selectedIndex !== null } : undefined;
  }
  feed(data: Buffer) {
    const forwarded: number[] = [];
    const forward = (value: Buffer) => { for (const byte of value) forwarded.push(byte); };
    const flush = () => { if (forwarded.length) { this.forward(Buffer.from(forwarded)); forwarded.length = 0; } };
    for (let index = 0; index < data.length; index++) {
      const byte = data[index]!;
      if (this.sequence.length) {
        clearTimeout(this.escapeTimer);
        this.sequence.push(byte);
        const second = this.sequence[1];
        const complete = second === 0x5b ? this.sequence.length > 2 && byte >= 0x40 && byte <= 0x7e
          : second === 0x5d ? byte === 7 || (byte === 0x5c && this.sequence.at(-2) === 0x1b)
          : this.sequence.length >= 2;
        if (complete || this.sequence.length > 65536) {
          const sequence = Buffer.from(this.sequence); const text = sequence.toString('ascii');
          if (!this.paste && this.control?.(sequence)) { this.sequence = []; continue; }
          if (!this.paste && this.commandCompletion() && ['\x1b[A', '\x1b[B', '\x1bOA', '\x1bOB'].includes(text)) {
            const down = text.endsWith('B'), native = this.qr!.nativeSelection(), count = this.commandCompletion()!.matches.length;
            if (this.selectedIndex !== null) {
              const next = this.selectedIndex + (down ? 1 : -1);
              if (next >= 0 && next < count) this.selectedIndex = next;
              else if (native.count) {
                this.selectedIndex = null;
                forward(Buffer.from((down ? '\x1b[A' : '\x1b[B').repeat(down ? native.index : Math.max(0, native.count - 1 - native.index))));
              } else this.selectedIndex = down ? 0 : count - 1;
              flush(); this.qr!.repaint();
            } else if (!native.count || (!down && native.index <= 0) || (down && native.index === native.count - 1)) {
              this.selectedIndex = down ? 0 : count - 1; flush(); this.qr!.repaint();
            } else forward(sequence);
            this.sequence = []; continue;
          }
          if (text === '\x1b[200~') { this.paste = true; this.draftBytes = Infinity; }
          if (text === '\x1b[201~') this.paste = false;
          const mouse = /^\x1b\[<(\d+);\d+;\d+[Mm]$/.exec(text);
          const report = /^\x1b\[(?:\d+;\d+R|[IO])$/.test(text)
            || (mouse && (Number(mouse[1]) & (32 | 64)) !== 0);
          if (!report) { this.candidate = ''; this.draftBytes = Infinity; }
          forward(sequence); this.sequence = [];
        }
        continue;
      }
      if (this.chord) {
        this.chord = false; clearTimeout(this.timer);
        const shortcut = this.qr?.commands.find(command => command.shortcut === String.fromCharCode(byte).toLowerCase());
        if (shortcut) { this.candidate = ''; flush(); this.action(shortcut.name, false); return; }
        if (byte === 0x62 || byte === 0x42) { this.candidate = ''; flush(); this.action('@back', false); return; }
        forwarded.push(0x18);
      }
      if (byte === 0x1b) {
        this.sequence = [byte];
        this.escapeTimer = setTimeout(() => { if (this.sequence.length === 1) { this.sequence = []; if (this.commandCompletion()) this.completionDismissed = true; else this.candidate = ''; this.forward(Buffer.from([0x1b])); this.qr?.repaint(); } }, 40);
        this.escapeTimer.unref(); continue;
      }
      if (this.paste) { forwarded.push(byte); continue; }
      if (byte === 9 && this.commandCompletion()?.selected) {
        const completion = this.commandCompletion()!;
        const command = completion.matches[completion.selectedIndex!]!.name;
        const suffix = command.slice(this.candidate.length); this.candidate = command; this.selectedIndex = 0; this.draftBytes += suffix.length;
        forward(Buffer.from(suffix)); flush(); this.qr!.repaint(); continue;
      }
      if (byte === 0x18) {
        this.chord = true;
        this.timer = setTimeout(() => { if (this.chord) { this.chord = false; this.forward(Buffer.from([0x18])); } }, 500);
        this.timer.unref(); continue;
      }
      if (byte === 0x0d || byte === 0x0a) {
        if (this.commandCompletion()?.selected && index === data.length - 1) {
          const completion = this.commandCompletion()!;
          // Native resume forwarding removes only "dbg", so materialize the full alias first.
          const command = completion.matches[completion.selectedIndex!]!.name;
          forward(Buffer.from(command.slice(this.candidate.length)));
          this.candidate = ''; this.draftBytes = 0; flush(); this.action(command, true); return;
        }
        const command = this.candidate; this.candidate = ''; this.draftBytes = 0;
        if (this.qr?.commands.some(item => item.name === command) && this.composerVisible() && index === data.length - 1) { flush(); this.action(command, true); return; }
      } else if (byte === 0x15 || byte === 0x03) { this.candidate = ''; this.draftBytes = 0; }
      else if (byte === 0x7f || byte === 0x08) { this.candidate = this.candidate.slice(0, -1); this.draftBytes = Math.max(0, this.draftBytes - 1); }
      else if (byte >= 0x20) {
        this.completionDismissed = false;
        if (!this.candidate && byte === 0x2f && this.draftBytes === 0 && this.emptyComposer()) this.candidate = '/';
        else if (this.candidate) this.candidate += String.fromCharCode(byte);
        this.draftBytes++;
        if (this.candidate && !this.qr?.commands.some(command => command.name.startsWith(this.candidate))) this.candidate = '';
        const matches = (this.qr?.commands || []).filter(command => command.suggest !== false && command.name.startsWith(this.candidate));
        const preferred = matches.findIndex(command => !command.preferNative || command.name === this.candidate);
        this.selectedIndex = preferred < 0 ? null : preferred;
      } else this.candidate = '';
      forwarded.push(byte);
    }
    flush(); this.qr?.repaint();
  }
}
