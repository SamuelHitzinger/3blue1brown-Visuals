import {expect,test} from 'bun:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {parseModelGLB} from 'animlib/core';
import * as bundled from '../src/bundled-models.js';

test('bundled conversion runs once across concurrent callers and survives a fresh preparer',async()=>{
  expect(typeof bundled.createBundledModelPreparer).toBe('function');
  const directory=await mkdtemp(join(tmpdir(),'bundle-cache-'));
  try{
    const first=bundled.createBundledModelPreparer({directory});
    const controller=new AbortController();
    const aborted=first.prepare('1crn-beads',controller.signal);void aborted.catch(()=>{});
    const active=Array.from({length:3},()=>first.prepare('1crn-beads'));controller.abort(new Error('cancelled'));
    await expect(aborted).rejects.toThrow('cancelled');
    const results=await Promise.all(active);expect(first.stats().conversions).toBe(1);
    const digest=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
    const hash=digest(results[0].bytes);expect(results.map(r=>digest(r.bytes))).toEqual([hash,hash,hash]);
    expect((await parseModelGLB(results[0].bytes)).metadata.triangles).toBe(7328);
    results[0].bytes[0]=0;results[0].context.representation='mutated';
    const fresh=bundled.createBundledModelPreparer({directory});const reused=await fresh.prepare('1crn-beads');
    expect(fresh.stats().conversions).toBe(0);expect(digest(reused.bytes)).toBe(hash);expect(reused.context.representation).not.toBe('mutated');
    await fresh.prepare('1crn-surface');expect(fresh.stats().conversions).toBe(1);
    await expect(first.prepare('../../outside')).rejects.toThrow();
  }finally{await rm(directory,{recursive:true,force:true});}
});
