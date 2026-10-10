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
});
