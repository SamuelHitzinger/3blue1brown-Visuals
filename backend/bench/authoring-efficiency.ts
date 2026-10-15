import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { compileSource, evaluateScene } from '../../shared/animlib/src/core.js';
import { attachTimingPrelude, resolveSpeechCues } from '../src/agents/timing-prelude.js';

/** Synthetic fixed timing isolates authoring cost; this is not an audio/acoustic benchmark. */
const phrases=['Show the starting arrangement','Move the selected element','Mark the changed relationship','Hold the visible conclusion'];
const scene={durationSec:10,utterances:phrases.map((text,i)=>({
  id:`beat-1.u${i+1}`,role:'narration',text,startSec:1+i*2,endSec:2+i*2,
  words:text.split(' ').map((word,j,words)=>({id:`beat-1.u${i+1}.w${j+1}`,text:word,
    startSec:1+i*2+j/words.length,endSec:1+i*2+(j+1)/words.length})),
})),pauses:[]};
const names=['setup','move','relationship','conclusion'];
const speechCues=phrases.map((phrase,i)=>({id:names[i],phrase}));
const packet={audioAssetId:'benchmark-audio',endMode:'hold' as const,scene,resolvedCues:resolveSpeechCues(scene,speechCues)};
const fixtures=[
  {id:'binary-search',prefix:'binary-search-comparison',parts:[
    {name:'range',kind:'rectangle',props:{width:5,height:1,fill:'none',stroke:'BLUE'}},
    {name:'probe',kind:'circle',props:{radius:.2,position:[-2,0],fill:'YELLOW'}},
    {name:'label',kind:'text',props:{text:'Choose the middle',position:[0,1],fontSize:.3}},
  ],actions:['group.fadeIn()', 'probe.moveTo([0,0])', 'range.scaleTo(.5)', 'label.fadeOut()']},
  {id:'derivative',prefix:'derivative-local-change',parts:[
    {name:'range',kind:'path',props:{points:[[-2,2],[-1,.5],[0,0],[1,.5],[2,2]],stroke:'BLUE',fill:'none'}},
    {name:'probe',kind:'circle',props:{radius:.15,position:[0,0],fill:'YELLOW'}},
    {name:'label',kind:'text',props:{text:'Local change',position:[0,2.8],fontSize:.3}},
  ],actions:['group.fadeIn()', 'probe.moveTo([1,.5])', 'range.animate({stroke:Color.TEAL})', 'label.fadeOut()']},
  {id:'molecular-transport',prefix:'molecular-channel-transport',parts:[
    {name:'range',kind:'rectangle',props:{width:.4,height:3,fill:'TEAL'}},
    {name:'probe',kind:'circle',props:{radius:.25,position:[-2,0],fill:'YELLOW'}},
    {name:'label',kind:'text',props:{text:'Transport through the channel',position:[0,2],fontSize:.3}},
  ],actions:['group.fadeIn()', 'probe.moveTo([0,0])', 'probe.moveTo([2,0])', 'label.fadeOut()']},
];
const bytes=(text:string)=>Buffer.byteLength(text);
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
const percentile=(values:number[],p:number)=>[...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*p))];

export async function runAuthoringEfficiencyBenchmark() {
  const results=[];
  for(const fixture of fixtures){
    const baselineComposition=fixture.parts.map(p=>`const ${p.name}=s.${p.kind}('${fixture.prefix}/${p.name}',${JSON.stringify(p.props)});`).join('\n')
      +`\nconst group=s.group('${fixture.prefix}',[${fixture.parts.map(p=>p.name).join(',')}]);`;
    const candidateComposition=`const parts=s.compose('${fixture.prefix}',{${fixture.parts.map(p=>`${p.name}:{kind:'${p.kind}',props:${JSON.stringify(p.props)}}`).join(',')}});\n`
      +fixture.parts.map(p=>`const ${p.name}=parts.get('${p.name}');`).join('')+'const group=parts.group;';
    // A compact shared timing helper is the control, not repeated inlined cursor bookkeeping.
    const baselineTiming=`let cursor=0;const play=(start,end,actions)=>{s.wait(start-cursor);s.play(actions,{duration:end-start});cursor=end;};\n`
      +fixture.actions.map((action,i)=>`play(__narration.start('beat-1.u${i+1}.w1'),__narration.end('beat-1.u${i+1}.w${scene.utterances[i].words.length}'),${action});`).join('\n')
      +'\ns.wait(__narration.durationSec-cursor);';
    const candidateTiming=`s.schedule(__narration,[${fixture.actions.map((action,i)=>`{id:'${names[i]}',cue:'${names[i]}',actions:${action}}`).join(',')}]);`;
    const wrap=(construction:string,timing:string)=>`export default scene({audio:__narration.audioAssetId,end:__narration.endMode},s=>{\n${construction}\n${timing}\ns.keep(group);\n});`;
    const baseline=wrap(baselineComposition,baselineTiming),candidate=wrap(candidateComposition,candidateTiming);
    const sources=[baseline,candidate].map(source=>attachTimingPrelude(source,packet));
    const [a,b]=await Promise.all(sources.map(source=>compileSource(source)));
    const times=[0,.5,1,1.5,2,2.5,3,3.5,4,4.5,5,5.5,6,6.5,7,7.5,8,9,10,5.5,0];
    const equivalent=isDeepStrictEqual(a,b)&&times.every(t=>isDeepStrictEqual(evaluateScene(a,t),evaluateScene(b,t)));
    if(!equivalent)throw new Error(`Authored fixture differs from handwritten control: ${fixture.id}`);
    const costs:number[][]=[[],[]];
    // Alternate order to reduce warmup/order bias; both compilers use the same runtime.
    for(let run=0;run<8;run++)for(const index of run%2?[1,0]:[0,1]){
      const start=performance.now();await compileSource(sources[index]);costs[index].push(performance.now()-start);
    }
    const unavoidableGeometryBytes=fixture.parts.reduce((sum,p)=>sum+bytes(JSON.stringify(p.props)),0);
    const actionBytes=fixture.actions.reduce((sum,action)=>sum+bytes(action),0);
    const baselineBoilerplate=bytes(baselineComposition+baselineTiming)-unavoidableGeometryBytes-actionBytes;
    const candidateBoilerplate=bytes(candidateComposition+candidateTiming)-unavoidableGeometryBytes-actionBytes;
    results.push({id:fixture.id,baseline,candidate,baselineSha256:hash(baseline),candidateSha256:hash(candidate),
      sourceBytes:{baseline:bytes(baseline),candidate:bytes(candidate)},unavoidableGeometryBytes,
      compositionBytes:{baseline:bytes(baselineComposition),candidate:bytes(candidateComposition)},
      timingBytes:{baseline:bytes(baselineTiming),candidate:bytes(candidateTiming)},
      timingArithmeticExpressions:{baseline:3,candidate:0},
      compositionAndTimingBoilerplateBytes:{baseline:baselineBoilerplate,candidate:candidateBoilerplate},
      boilerplateReduction:1-candidateBoilerplate/baselineBoilerplate,
      compileMs:{baseline:{p50:percentile(costs[0],.5),p95:percentile(costs[0],.95),samples:costs[0]},candidate:{p50:percentile(costs[1],.5),p95:percentile(costs[1],.95),samples:costs[1]}},
      equivalent,sampledTimes:times,tracks:a.tracks.length,durationSec:a.duration});
  }
  return {schemaVersion:1,scope:'Deterministic synthetic timing and VM/state equivalence; no claim of visual quality, speech alignment accuracy or model generation speed.',
    runtime:process.version,fixtureTiming:scene,results,allEquivalent:results.every(r=>r.equivalent),
    meetsBoilerplateTarget:results.every(r=>r.boilerplateReduction>=.30)};
}

if(import.meta.main){
  const report=await runAuthoringEfficiencyBenchmark();
  const directory=resolve('docs/validation/animation-authoring-benchmark');await mkdir(directory,{recursive:true});
  await writeFile(resolve(directory,'results.json'),JSON.stringify(report,null,2));
  for(const result of report.results){
    await writeFile(resolve(directory,result.id+'.baseline.js'),result.baseline);
    await writeFile(resolve(directory,result.id+'.candidate.js'),result.candidate);
  }
  console.log(JSON.stringify({allEquivalent:report.allEquivalent,meetsBoilerplateTarget:report.meetsBoilerplateTarget,
    results:report.results.map(({id,sourceBytes,timingBytes,boilerplateReduction,compileMs})=>({id,sourceBytes,timingBytes,boilerplateReduction,compileMs:{baseline:compileMs.baseline.p50,candidate:compileMs.candidate.p50}}))},null,2));
}
