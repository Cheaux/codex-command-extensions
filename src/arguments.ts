/** Only interactive chat entry points get a terminal overlay. All other commands pass through. */
export function interactiveArguments(args: string[]) {
  const takesValue = new Set(['-c', '--config', '-m', '--model', '-p', '--profile', '-s', '--sandbox', '-a', '--ask-for-approval', '-C', '--cd', '--add-dir', '--enable', '--disable', '--image', '-i', '--local-provider']);
  const commands = new Set(['agents', 'exec', 'e', 'review', 'login', 'logout', 'mcp', 'mcp-server', 'app-server', 'remote-control', 'completion', 'sandbox', 'debug', 'apply', 'a', 'cloud', 'features', 'plugin', 'help', 'update', 'doctor', 'queue', 'archive', 'delete', 'unarchive', 'migrate-rollouts', 'exec-server']);
  for (let index = 0; index < args.length; index++) {
    const value = args[index]!;
    if (value === '--remote' || value.startsWith('--remote=')) return false;
    if (['--help', '-h', '--version', '-V'].includes(value)) return false;
    if (takesValue.has(value)) { index++; continue; }
    if (value.startsWith('-')) continue;
    return !commands.has(value);
  }
  return true;
}

/** Carry explicit model, profile and permission settings into views opened by the picker. */
export function inheritedArguments(args: string[]) {
  const valued = new Set(['-c', '--config', '-m', '--model', '-p', '--profile', '-s', '--sandbox', '-a', '--ask-for-approval', '--add-dir', '--enable', '--disable', '--local-provider']);
  const flags = new Set(['--oss', '--strict-config', '--approve-for-me', '--full-auto', '--dangerously-bypass-approvals-and-sandbox', '--dangerously-bypass-hook-trust', '--search', '--no-alt-screen', '--no-daemon']);
  const result: string[] = [];
  for (let index = 0; index < args.length; index++) {
    const value = args[index]!; if (value === '--') break;
    if (valued.has(value) && args[index + 1] !== undefined) { result.push(value, args[++index]!); continue; }
    if (flags.has(value) || (value.includes('=') && valued.has(value.split('=')[0]!)) || /^-c.+/.test(value)) result.push(value);
    else if (['-C', '--cd', '-i', '--image'].includes(value)) index++;
  }
  return result;
}
