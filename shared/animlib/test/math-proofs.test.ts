import {readFile} from 'node:fs/promises';
import {describe,expect,it} from 'vitest';
import {withOfflineScene} from '../src/offline-sampling.js';
import type {Frame} from '../src/types.js';

const get=(frame:Frame,id:string)=>frame.elements.find(element=>element.id===id)!;
async function proof(name:string,check:Parameters<typeof withOfflineScene>[2]) {
  return withOfflineScene(await readFile(new URL(`../demo/expansion/${name}.js`,import.meta.url),'utf8'),{},check);
}

describe('mathematical proof continuity',()=>{
  it('carries visible component correspondence through the complete shear',async()=>{
    await proof('shear',sampler=>{
      for(const time of [0,.5,1,1.5,2.5,3.5,6.5,1.5]) {
        const frame=sampler.sample(time);
        const x=get(frame,'sheared/components/x'),y=get(frame,'sheared/components/y');
        expect(x.opacity).toBeGreaterThan(.5);expect(y.opacity).toBeGreaterThan(.5);
        expect(get(frame,'sheared/x-coefficient').opacity).toBe(1);
        expect(get(frame,'sheared/y-coefficient').opacity).toBe(1);
        expect(x.geometry.points![1]).toEqual(y.geometry.points![0]);
        expect(y.geometry.points![1]).toEqual(get(frame,'sheared/v').geometry.points![1]);
      }
    });
  });
  it('shows only exact established costs, synchronized across graph and record',async()=>{
    await proof('graph-relaxation',sampler=>{
      for(let i=10;i<=70;i++) {
        const frame=sampler.sample(i/10),local=get(frame,'search/cost/C'),record=get(frame,'frontier-C');
        expect([5,2]).toContain(local.geometry.numbers!.cost);
        expect(record.geometry.numbers!.cost).toBe(local.geometry.numbers!.cost);
      }
      expect(get(sampler.sample(2.5),'search/node/B').fill).not.toBe('#FFFF00');
      const at=sampler.sample(3.8);sampler.sample(7);sampler.sample(0);expect(sampler.sample(3.8)).toEqual(at);
    });
  });
  it('retains vector and column sources through scaling, translation and named row transport',async()=>{
    await proof('matrix-transport',sampler=>{
      const source=sampler.sample(0),originalA=get(source,'world/a1'),originalB=get(source,'world/a2');
      for(const time of [0,1.2,2.3,3.75,4.8,5.5,6.2,8.5,2.3]) {
        const f=sampler.sample(time);
        expect(get(f,'world/a1')).toEqual(originalA);expect(get(f,'world/a2')).toEqual(originalB);
        for(const id of ['source-column-a','source-column-b','coefficient-identity'])expect(get(f,id)).toEqual(get(source,id));
      }
      const final=sampler.sample(8.5),first=get(final,'scaled-a1').geometry.points!,second=get(final,'translated-a2').geometry.points!;
      expect(first[1]).toEqual(second[0]);expect(second[1]).toEqual(get(final,'world/resultant').geometry.points![1]);
      expect(first[1][0]-first[0][0]).toBeCloseTo(2*(originalA.geometry.points![1][0]-originalA.geometry.points![0][0]));
      const middle=sampler.sample(5.5);
      for(const id of ['row-a','row-b'])expect(get(middle,id).morph!.map).toEqual({x:'x',y:'y'});
      expect(get(final,'computed-result').geometry.tex).toContain('animpart{x}{4}');
      const snapshot=sampler.sample(5.5);sampler.sample(8.5);sampler.sample(0);expect(sampler.sample(5.5)).toEqual(snapshot);
    });
  });
  it('inserts and reorders three route identities without inventing intermediate costs',async()=>{
    await proof('frontier-reorder',sampler=>{
      for(let i=0;i<=75;i++) {
        const f=sampler.sample(i/10);
        expect(get(f,'direct-C/cost').geometry.tex).toBe('\\mathsf{7}');
        expect(get(f,'direct-D/cost').geometry.tex).toBe('\\mathsf{5}');
        expect(get(f,'via-B-C/cost').geometry.tex).toBe('\\mathsf{3}');
        expect(get(f,'search/cost/C').geometry.numbers!.cost).toBe(i/10<2.05?7:3);
        for(const id of ['direct-C','direct-D','via-B-C'])expect(get(f,'frontier/item/'+id).geometry.children).toEqual([id+'/record']);
      }
      const f=sampler.sample(4.9);
      expect(get(f,'frontier/item/via-B-C').position[1]).toBeCloseTo(2.15);
      expect(get(f,'frontier/item/direct-D').position[1]).toBeCloseTo(.49);
      expect(get(f,'frontier/item/direct-C').position[1]).toBeCloseTo(-1.17);
      expect(get(f,'via-B-C/destination').geometry.tex).toBe(get(f,'direct-C/destination').geometry.tex);
      expect(get(f,'via-B-C/route').geometry.tex).not.toBe(get(f,'direct-C/route').geometry.tex);
      const snapshot=sampler.sample(3.9);sampler.sample(7.5);sampler.sample(0);expect(sampler.sample(3.9)).toEqual(snapshot);
    });
  });
});
