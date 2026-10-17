import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const metadata=JSON.parse(await readFile('package.json','utf8'));
const run=promisify(execFile), root=await mkdtemp(join(tmpdir(),'terminal-package-'));
try {
  const json=JSON.parse((await run('npm',['pack','--json','--ignore-scripts','--pack-destination',root])).stdout);
  const pack=Array.isArray(json)?json[0]:Object.values(json)[0];
  for(const path of ['dist/cli.js','runtime/pty_host.py','.agents/plugins/marketplace.json','plugins/codex-terminal-extensions/.codex-plugin/plugin.json','plugins/codex-terminal-extensions/skills/terminal-extensions/SKILL.md']) assert.ok(pack.files.some(file=>file.path===path),`Missing ${path}`);
  const prefix=join(root,'prefix');
  await run('npm',['install','--global','--prefix',prefix,'--ignore-scripts','--no-audit','--no-fund',join(root,pack.filename)],{timeout:180000});
  const binary=join(prefix,'bin/codex-terminal');
  assert.equal((await run(binary,['--version'])).stdout.trim(),metadata.version);
  const env={...process.env,CODEX_TERMINAL_DATA_DIR:join(root,'data'),CODEX_TERMINAL_BIN_DIR:join(root,'bin'),CODEX_TERMINAL_CODEX_BIN:process.execPath};
  const manifest=join(root,'example.json');
  await writeFile(manifest,JSON.stringify({schemaVersion:1,id:'example',commands:[{name:'/example',description:'Example command',action:{type:'view',executable:process.execPath,args:['--version']}}]}));
  await run(binary,['register',manifest],{env});
  const status=JSON.parse((await run(binary,['status','--json'],{env})).stdout);assert.equal(status.commands[0].name,'/example');assert.equal(status.enabled,false);
  await run(binary,['enable'],{env});
  assert.equal((await run(join(root,'bin/codex'),['--version'],{env})).stdout.trim(),process.version);
  await run(binary,['unregister','example'],{env});
  assert.equal(JSON.parse((await run(binary,['status','--json'],{env})).stdout).enabled,true);
  await run(binary,['disable'],{env});
  console.log('Host package passed: clean install, Python backend, hidden plugin files, independent registration, single reversible shim, native passthrough.');
} finally { await rm(root,{recursive:true,force:true}); }
