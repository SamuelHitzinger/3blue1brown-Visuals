import {expect,test} from 'bun:test';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {prepareCaffeineCases} from './prepare.js';

const hash=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');
const dataFile=fileURLToPath(new URL('./caffeine-cid2519.data.json',import.meta.url));
const fixtureFile=fileURLToPath(new URL('./caffeine-cid2519.fixture.json',import.meta.url));
const dataSha256='c9258f019dcaad8754b4f171dd379f6b78e33bd27b8aa90b949378cd7079dce1';
const promptHashes={
  'caffeine-heavy':'f7d5c9da1da00d08a899445427cd7d20bfdedd1fa2dd036a7cbf6ba9cb94ac9c',
  'caffeine-full':'c3e2d70d1c646c9294ad77b1e9e710a451f87fabd137681270d2d6362c83da4d',
};

test('tracked public fixture and prepared cases preserve screen-01 prompt bytes',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'caffeine-prepare-'));
  try{
    const dataBytes=await readFile(dataFile),fixtureBytes=await readFile(fixtureFile);
    expect(hash(dataBytes)).toBe(dataSha256);
    expect(hash(fixtureBytes)).toBe('40dfa2aa0ca54639a9f94f673fc62c9b8fa2b590674559e37df0b1032da707fd');
    const fixture=JSON.parse(fixtureBytes.toString()),data=JSON.parse(dataBytes.toString());
    expect(fixture.dataSha256).toBe(dataSha256);expect(data.atoms).toHaveLength(24);expect(data.bonds).toHaveLength(25);
    const manifest={schemaVersion:1,cases:['line-basic'],createdAt:'preserved',model:'preserved'};
    await writeFile(join(directory,'manifest.json'),JSON.stringify(manifest));
    await prepareCaffeineCases(directory);
    expect(JSON.parse(await readFile(join(directory,'manifest.json'),'utf8'))).toEqual({...manifest,cases:['line-basic','caffeine-heavy','caffeine-full']});
    for(const [id,detail,atoms,bonds] of [['caffeine-heavy','low',14,15],['caffeine-full','high',24,25]] as const){
      expect(JSON.parse(await readFile(join(directory,id,'case.json'),'utf8'))).toEqual({id,subject:'organic chemistry',detail,dimension:3,dataFile,dataSha256,expectedAtoms:atoms,expectedBonds:bonds,source:fixture.source.url,formula:'C8H10N4O2'});
      expect(hash(await readFile(join(directory,id,'prompt.txt')))).toBe(promptHashes[id]);
    }
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('preparation appends only missing case IDs and is idempotent',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'caffeine-repeat-'));
  try{
    await writeFile(join(directory,'manifest.json'),JSON.stringify({cases:['caffeine-full','line-basic']}));
    await prepareCaffeineCases(directory);
    const first=await readFile(join(directory,'manifest.json'),'utf8');
    expect(JSON.parse(first).cases).toEqual(['caffeine-full','line-basic','caffeine-heavy']);
    await prepareCaffeineCases(directory);
    expect(await readFile(join(directory,'manifest.json'),'utf8')).toBe(first);
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('preparation refuses to replace an existing case or change its manifest',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'caffeine-conflict-'));
  try{
    const manifest='{"cases":["line-basic"]}',original='{"id":"original"}';
    await writeFile(join(directory,'manifest.json'),manifest);await mkdir(join(directory,'caffeine-heavy'));
    await writeFile(join(directory,'caffeine-heavy','case.json'),original);
    await expect(prepareCaffeineCases(directory)).rejects.toThrow(/existing.*differs/i);
    expect(await readFile(join(directory,'caffeine-heavy','case.json'),'utf8')).toBe(original);
    expect(await readFile(join(directory,'manifest.json'),'utf8')).toBe(manifest);
  }finally{await rm(directory,{recursive:true,force:true});}
});
