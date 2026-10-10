import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {withOfflineScene} from '../src/offline-sampling.js';
const source=(name:string)=>readFileSync(new URL(`../demo/expansion/${name}.js`,import.meta.url),'utf8');
describe('integrated diagram source proofs',()=>{
  it('samples original shear geometry, quiet scaffold, labels and coefficients through the production VM',async()=>{
    await withOfflineScene(source('shear'),{},sampler=>{
      expect(sampler.scene.duration).toBe(6.5);
      for(const u of [0,.25,.5,.75,1,.5,0]){
        const time=1+2.5*u,k=u*u*(3-2*u),frame=sampler.sample(time);
        const get=(id:string)=>frame.elements.find(e=>e.id===id)!;
        const endpoint=get('sheared/v').geometry.points![1];
        expect(endpoint[0]).toBeCloseTo(-2+1.3*(2+k));expect(endpoint[1]).toBeCloseTo(.2);
        expect(get('original/v').geometry.points![1][0]).toBeCloseTo(.6);
        expect(get('sheared/e2').geometry.points![1][0]).toBeCloseTo(-2+1.3*k);
        expect(get('sheared/e2-label').rotation).toEqual([0,0,0]);
        expect(get('sheared/x-coefficient').geometry.tex).toBe('2e_1');
      }
    });
  });
  it('keeps the graph cost and C frontier record synchronized with the actual improving trace',async()=>{
    await withOfflineScene(source('graph-relaxation'),{},sampler=>{
      expect(sampler.scene.duration).toBeCloseTo(7);
      const frame=sampler.sample(7),get=(id:string)=>frame.elements.find(e=>e.id===id)!;
      expect(get('search/cost/C').geometry.numbers?.cost).toBe(2);
      expect(get('frontier-C').geometry.numbers?.cost).toBe(2);
      expect(get('search/edge/BC').stroke).toBe('YELLOW');
    });
  });
  it('seeks the same duplicate items directly and backward with exact endpoints',async()=>{
    await withOfflineScene(source('collection-swap'),{},sampler=>{
      const get=(t:number,id:string)=>sampler.sample(t).elements.find(e=>e.id===id)!;
      const middle=get(2,'values/item/a');
      expect(get(3,'values/item/a').position).toEqual([1.4,0,0]);
      expect(get(0,'values/item/a').position).toEqual([-1.4,0,0]);
      expect(get(2,'values/item/a')).toEqual(middle);
      expect(middle.position[1]-get(2,'values/item/b').position[1]).toBeCloseTo(2.4);
    });
  });
});
