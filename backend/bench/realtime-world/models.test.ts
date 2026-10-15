import {expect,test} from 'bun:test';
import {LiveWorld} from './world.js';
import {modelFixture} from '../../../shared/animlib/test/model-fixture.js';
import {parseModelGLB} from '../../../shared/animlib/src/models.js';
import {ModelStore} from '../../../shared/animlib/src/model-store.js';

Object.defineProperty(globalThis,'Worker',{configurable:true,writable:true,value:undefined});
const source=`export default scene({mode:'3d',end:'hold'},s=>{
 const model=s.model('specimen',{asset:'fixture'});
 s.bind(model,[s.time],t=>({rotation:[0,t,0]}));s.wait(60);
});`;

test('published GLB inventory compiles into persistent references and keeps geometry outside the VM',async()=>{
  const bytes=await modelFixture({textured:false}),data=await parseModelGLB(bytes);
  const models=new ModelStore({fixture:{kind:'model',url:'fixture:local.glb',metadata:data.metadata}},{read:async()=>bytes});
  let now=0,loads=0;
  const world=new LiveWorld({models:models.metadata,clock:()=>now,prepare:async scene=>{loads++;await models.prepare([scene]);}});
  try{
    await world.addProgram({id:'model-program',source,baseRevision:0},now);
    const initial=await world.sample(1);
    expect(initial.elements.some(element=>element.geometry.model?.asset==='fixture')).toBe(true);
    expect(initial.elements.some(element=>element.geometry.vertices?.length)).toBe(false);
    expect(models.resolve(initial).elements.some(element=>element.geometry.vertices?.length)).toBe(true);
    now=2;await world.apply({baseRevision:1,changes:[{id:'specimen',props:{position:[2,0,0]}}]},now);
    const moved=(await world.sample(3)).elements.find(element=>element.id==='specimen')!;
    expect(moved.position).toEqual([2,0,0]);expect(moved.rotation[1]).toBeCloseTo(3);expect(loads).toBe(1);
  }finally{world.dispose();models.dispose();}
});

test('world snapshots host model metadata and rejects unknown model IDs atomically',async()=>{
  const data=await parseModelGLB(await modelFixture({textured:false}));
  const inventory={fixture:data.metadata},world=new LiveWorld({models:inventory,clock:()=>0});
  try{
    inventory.fixture.parts[0].name='changed outside world';
    await expect(world.addProgram({id:'unknown',source:source.replace("asset:'fixture'","asset:'missing'"),baseRevision:0},0)).rejects.toThrow();
    expect(world.revision).toBe(0);expect(world.summary().entityIds).toEqual([]);
    await world.addProgram({id:'known',source:source.replace('s.bind(model',"model.part('Panel');s.bind(model"),baseRevision:0},0);
    expect((await world.sample(0)).elements.some(element=>element.geometry.model?.asset==='fixture')).toBe(true);
  }finally{world.dispose();}
});
