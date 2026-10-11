// Run with Bun after building a clean baseline checkout:
// bun bench/compatibility.ts /tmp/baseline/shared/animlib/dist/core.js /tmp/report.json
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import * as current from '../src/core.js';
import { initialSources } from '../demo/scenes.js';
import { interactionSource } from '../demo/interaction.js';
import { compositionCases } from '../test/composition-cases.js';
import { generalControlSources, reactiveCases } from '../test/reactive-cases.js';
import { lessonScenes } from '../../../frontend/app/src/lessonScenes.js';
import { lessons } from '../../../frontend/app/tests/fixtures/lessons.js';
import type { SceneSource } from '../src/types.js';

if (!process.argv[2]) throw new Error('Pass the baseline dist/core.js path');
const before = await import(pathToFileURL(resolve(process.argv[2])).href) as typeof current;
const cases: { name: string; scenes: SceneSource[] }[] = [
  { name: 'production demo sequence', scenes: initialSources },
  { name: 'two-view interaction', scenes: [interactionSource] },
  ...compositionCases.map(c=>({name:c.name,scenes:[{id:'a',source:c.source}]})),
  ...generalControlSources.map((source,i)=>({name:`general authoring ${i+1}`,scenes:[{id:'a',source}]})),
  ...reactiveCases.map(c=>({name:`ordinary equivalent: ${c.name}`,scenes:[{id:'a',source:c.legacy}]})),
  ...lessons.flatMap(lesson=>[false,true].map(dark=>({name:`${lesson.title} ${dark?'dark':'light'}`,scenes:lessonScenes(lesson,{background:dark?'BLACK':'WHITE',ink:dark?'WHITE':'GREY_E',accent:dark?'BLUE':'BLUE_E'})}))),
];
let comparisons=0,controlChanges=0;
const results: {name:string;ok:boolean;error?:string}[]=[];
for (const fixture of cases) {
  const a=new before.SceneSequence(),b=new current.SceneSequence();
  try {
    for (const seq of [a,b]) {
      const result=await seq.submit({type:'load',scenes:fixture.scenes});
      if(!result.ok)throw new Error(JSON.stringify(result));
    }
    const compare=()=>{
      if(!isDeepStrictEqual(a.compiled,b.compiled))throw new Error('Compiled data differ');
      for(let i=0;i<a.compiled.length;i++)for(const fraction of [0,0.01,0.25,0.5,0.75,0.999,1,0.25]) {
        const time=a.compiled[i].duration*fraction;
        if(!isDeepStrictEqual(a.frame(i,time),b.frame(i,time)))throw new Error(`Frame differs: scene ${i}, time ${time}`);
        comparisons++;
      }
    };
    compare();
    for(let i=0;i<a.compiled.length;i++)for(const control of a.compiled[i].controls) {
      const values=control.kind==='slider'?[control.min!,control.max!,control.default]:control.kind==='toggle'?[false,true]:control.options!;
      for(const value of values) {
        await a.setControl(fixture.scenes[i].id,control.id,value);
        await b.setControl(fixture.scenes[i].id,control.id,value);
        controlChanges++;compare();
      }
    }
    results.push({name:fixture.name,ok:true});
  } catch(error) {results.push({name:fixture.name,ok:false,error:String(error)});}
  finally {a.dispose();b.dispose();}
}
const report={baseline:process.argv[2],cases:results.length,frameComparisons:comparisons,controlChanges,failed:results.filter(r=>!r.ok).length,results};
if(process.argv[3])await writeFile(process.argv[3],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(report.failed)process.exitCode=1;
