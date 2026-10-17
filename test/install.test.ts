import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync, symlinkSync, existsSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { enable, disable, launcherStatus } from '../src/install.js';
import { register, unregister, loadExtensions } from '../src/registry.js';

test('one owned launcher migrates safely and feature removal preserves other registrations', t => {
  const root=mkdtempSync(join(tmpdir(),'terminal-install-'));
  const names=['CODEX_TERMINAL_DATA_DIR','CODEX_TERMINAL_BIN_DIR','CODEX_TERMINAL_CODEX_BIN'] as const;
  const previous=Object.fromEntries(names.map(name=>[name,process.env[name]]));
  process.env.CODEX_TERMINAL_DATA_DIR=join(root,'data');process.env.CODEX_TERMINAL_BIN_DIR=join(root,'bin');process.env.CODEX_TERMINAL_CODEX_BIN=process.execPath;
  t.after(()=>{ for(const name of names) { if(previous[name]===undefined) delete process.env[name]; else process.env[name]=previous[name]; } rmSync(root,{recursive:true,force:true}); });
  mkdirSync(join(root,'bin'));
  const shim=join(root,'bin/codex'), legacy=join(root,'legacy.json'), content='#!/bin/sh\n# previous owned terminal launcher\n';
  writeFileSync(shim,content,{mode:0o755});writeFileSync(legacy,JSON.stringify({shimPath:shim,realCodex:process.execPath,content}));
  assert.throws(()=>enable(),/preserved/);
  assert.equal(readFileSync(shim,'utf8'),content);
  assert.equal(enable(legacy).migrated,true);assert.equal(launcherStatus().enabled,true);enable();
  for(const id of ['one','two']) { const path=join(root,`${id}.json`);writeFileSync(path,JSON.stringify({schemaVersion:1,id,commands:[{name:`/${id}`,description:id,action:{type:'view',executable:process.execPath}}]}));register(path); }
  unregister('one');assert.equal(launcherStatus().enabled,true);assert.deepEqual(loadExtensions().providers.map(provider=>provider.id),['two']);
  writeFileSync(shim,'#!/bin/sh\necho user wrapper\n');assert.throws(()=>disable(),/preserved/);assert.ok(readFileSync(shim,'utf8').includes('user wrapper'));
  rmSync(shim);symlinkSync(join(root,'missing-target'),shim);assert.throws(()=>enable(),/preserved/);assert.ok(lstatSync(shim).isSymbolicLink());
  rmSync(shim);disable();assert.equal(existsSync(shim),false);assert.equal(loadExtensions().providers.length,1);
});
