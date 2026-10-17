/** Relay read-only theme queries to the real terminal, keeping responses with their requesting PTYs. */
export class TerminalTheme {
  private colors = new Map<number, Buffer>();
  private waiting = new Map<number, { replies: ((data: Buffer) => void)[]; timer: NodeJS.Timeout }>();
  constructor(private output: (query: string) => void) {}
  request(code: 10 | 11, reply: (data: Buffer) => void) {
    const cached = this.colors.get(code); if (cached) { reply(cached); return; }
    const pending = this.waiting.get(code); if (pending) { pending.replies.push(reply); return; }
    const timer = setTimeout(() => this.waiting.delete(code), 2000); timer.unref();
    this.waiting.set(code, { replies: [reply], timer });
    this.output(`\x1b]${code};?\x1b\\`);
  }
  accept(sequence: Buffer) {
    const match = /^\x1b\](10|11);(?:rgb:[0-9a-f]{1,4}\/[0-9a-f]{1,4}\/[0-9a-f]{1,4}|#[0-9a-f]{6}(?:[0-9a-f]{6})?)(?:\x07|\x1b\\)$/i.exec(sequence.toString('ascii'));
    if (!match) return false;
    const code = Number(match[1]); this.colors.set(code, Buffer.from(sequence));
    const pending = this.waiting.get(code); this.waiting.delete(code);
    if (pending) { clearTimeout(pending.timer); for (const reply of pending.replies) reply(sequence); }
    return true;
  }
  dispose() { for (const entry of this.waiting.values()) clearTimeout(entry.timer); this.waiting.clear(); this.colors.clear(); }
}
