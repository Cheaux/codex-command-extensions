import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { register, unregister, loadExtensions, readExtension, expandProgram } from '../src/registry.js';
import { TerminalInput } from '../src/terminal-input.js';

test('independent providers register, reject conflicting commands, and unregister separately', t => {
  const root=mkdtempSync(join(tmpdir(),'terminal-registry-')), previous=process.env.CODEX_TERMINAL_DATA_DIR;
  process.env.CODEX_TERMINAL_DATA_DIR=root;
  t.after(()=>{ if(previous===undefined) delete process.env.CODEX_TERMINAL_DATA_DIR; else process.env.CODEX_TERMINAL_DATA_DIR=previous; rmSync(root,{recursive:true,force:true}); });
  const provider=(id:string,name:string)=>{ const path=join(root,`${id}.json`); writeFileSync(path,JSON.stringify({schemaVersion:1,id,commands:[{name,description:id,action:{type:'view',executable:'${NODE}',args:['${EXTENSION_ROOT}/handler.js'],env:{NATIVE:'${CODEX_BIN}'}}}]})); return path; };
  const one=provider('one','/one'), two=provider('two','/two');
  register(one); register(two); register(one);
  assert.deepEqual(loadExtensions().commands.map(command=>command.name),['/one','/two']);
  assert.throws(()=>register(provider('duplicate','/one')),/conflict/);
  unregister('one'); assert.deepEqual(loadExtensions().commands.map(command=>command.name),['/two']);
  const program=expandProgram(readExtension(two).commands[0]!,'/usr/bin/codex');
  assert.equal(program.executable,process.execPath); assert.deepEqual(program.args,[join(root,'handler.js')]); assert.equal(program.env.NATIVE,'/usr/bin/codex');
  assert.throws(()=>readExtension(provider('protected','/quit')),/replaceNative/);
  rmSync(two); assert.equal(loadExtensions().commands.length,0); assert.equal(loadExtensions().warnings.length,1);
});
test('multiple custom suggestions can be selected independently without submitting them as prompts', () => {
  const chunks:Buffer[]=[], actions:string[]=[];
  const input=new TerminalInput(()=>true,()=>true,data=>chunks.push(data),name=>actions.push(name),undefined,{
    commands:[{name:'/tool-a',description:'First tool'},{name:'/tool-b',description:'Second tool'}],nativeSelection:()=>({index:0,count:0}),repaint:()=>{},
  });
  input.feed(Buffer.from('/tool-\x1b[B\t\r'));
  assert.deepEqual(actions,['/tool-b']); assert.equal(Buffer.concat(chunks).toString(),'/tool-b'); input.reset();
});
