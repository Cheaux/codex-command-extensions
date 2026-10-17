import test from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';
test('independent view and overlay providers preserve the original session and report failures', async () => {
  const result=await promisify(execFile)('python3',['test/host_pty.py'],{timeout:30000});
  assert.match(result.stdout,/PASS: modular views, overlay handoff, failed overlay, and retained sessions/);
});
