import {expect,it} from 'vitest';
import {buildScene} from '../src/runtime.js';
import {compileSource} from '../src/compiler.js';
import {withOfflineScene} from '../src/offline-sampling.js';
import * as core from '../src/core.js';
import type {SceneContext,NucleicTranslationProps} from '../src/types.js';
const builder=(s:SceneContext)=>{
  const props:NucleicTranslationProps={sites:Array.from('AUGGGUGCUUAA',(base,i)=>({id:'rna-'+i,base:base as 'A'})),
    direction:'5to3',anticodonDirection:'3to5',
    carriers:[{id:'t0',anticodon:'UAC',residueId:'p0',aminoAcid:'Met'},{id:'t1',anticodon:'CCA',residueId:'p1',aminoAcid:'Gly'},{id:'t2',anticodon:'CGA',residueId:'p2',aminoAcid:'Ala'}],
    origin:[0,0,0],axis:[1,0,0],normal:[0,1,0],pitch:.6,carrierHeight:2.2,peptideSpacing:.45,
    arrivalOffset:[-4,1,2],exitOffset:[-3,-1,2],subunitSeparation:2,
    assembly:{start:0,duration:2},start:3,cycleDuration:4,releaseDuration:2,disassemblyDuration:2};
  const vertices=(time:number)=>{
    const p=s.nucleicTranslationCycle(props,time);
    return [p.rna.anchors[0].backbone,p.carriers[0].position,p.product.residues[0].position,
      p.carriers[1].position,p.product.residues[1].position,p.subunits[0].position];
  };
  const h=s.mesh('translation',{vertices:vertices(0),triangles:[[0,1,2],[3,4,5]]});
  s.bind(h,[s.time],time=>({vertices:vertices(time)}));s.wait(20);
};
const source=`export default scene({},${builder.toString()});`;
const rounded=(v:unknown)=>JSON.parse(JSON.stringify(v,(_,x)=>typeof x==='number'?Math.round(x*1e10)/1e10:x));
it('exports the pure translation factory through core',()=>{
  expect(typeof core.createNucleicTranslationBuilders).toBe('function');
  expect(Object.keys(core.createNucleicTranslationBuilders())).toEqual(['nucleicTranslationCycle']);
});
it('compiles the same translation in host and QuickJS',async()=>{
  const host=buildScene({},builder),vm=await compileSource(source);expect(rounded(vm.lifecycle)).toEqual(rounded(host.lifecycle));
});
it('retains translation callbacks across docking, transfer, translocation, release and reverse seeks',async()=>{
  await withOfflineScene(source,{},sampler=>{
    const times=[0,2,3,15,16,17,19,20];
    for(let i=0;i<3;i++)for(const f of [.249999,.25,.250001,.499999,.5,.500001,.7,.95,1])times.push(3+4*(i+f));
    const frames=times.map(time=>sampler.sample(time));
    expect(frames[0].elements[0].geometry.vertices).not.toEqual(frames[7].elements[0].geometry.vertices);
    for(let i=times.length-1;i>=0;i--)expect(sampler.sample(times[i])).toEqual(frames[i]);
  });
});
