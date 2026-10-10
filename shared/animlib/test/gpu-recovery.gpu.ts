/// <reference types="@webgpu/types" />
import {afterEach,expect,it,vi} from 'vitest';
import {create,globals} from 'webgpu';
import {createPlayer} from '../src/player.js';
import {VERTEX_FLOATS} from '../src/texture-shader.js';

const small="export default scene({},s=>{s.rectangle('r',{width:3,height:2,fill:'PURE_RED'});s.wait(1)});";
const oversized=`export default scene({mode:'3d',lighting:{directional:{direction:[0,1,0],space:'world',shadow:{quality:'high'}},receiver:{size:[8,8]}}},s=>{
  for(let i=0;i<3;i++)s.parametricSurface('surface'+i,{uSegments:100,vSegments:100,fn:(u,v)=>[u,1+i*.1,v]});s.wait(1);
});`;
afterEach(()=>vi.unstubAllGlobals());

// A separate native device per case isolates intentional validation failures from
// the rendering suite. GPU work/readback is real; only DOM presentation is stubbed.
it.each([false,true])('public Player preserves an async backend error, prior budget rejection=%s',async budgetFirst=>{
  for(const [name,value] of Object.entries(globals))vi.stubGlobal(name,value);
  vi.stubGlobal('ResizeObserver',class {observe(){}disconnect(){}});
  vi.stubGlobal('devicePixelRatio',1);
  vi.stubGlobal('requestAnimationFrame',vi.fn(()=>1));vi.stubGlobal('cancelAnimationFrame',vi.fn());
  const gpu=create([]),adapter=await gpu.requestAdapter();
  if(!adapter)throw new Error('Recovery regression requires a real native WebGPU adapter.');
  const device=await adapter.requestDevice({requiredLimits:{maxBufferSize:256*1024*1024}}),format=gpu.getPreferredCanvasFormat();
  const width=640,height=480,errors:string[]=[];
  device.addEventListener('uncapturederror',event=>errors.push(event.error.message));
  const texture=device.createTexture({size:[width,height],format,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});
  const context={configure(){},unconfigure(){},getCurrentTexture:()=>texture};
  const canvas={width,height,style:{},getBoundingClientRect:()=>({width,height}),
    getContext:(kind:string)=>{expect(kind).toBe('webgpu');return context;},
    addEventListener(){},removeEventListener(){},getAttribute:()=>null,setAttribute(){},removeAttribute(){}} as unknown as HTMLCanvasElement;
  vi.stubGlobal('navigator',{gpu:{requestAdapter:async()=>({requestDevice:async()=>device}),getPreferredCanvasFormat:()=>format}});
  const player=createPlayer({canvas,executionLimitMs:1000});
  const load=(source:string)=>player.submit({type:'load',scenes:[{id:'scene',source}]});
  let invalid:GPUBuffer|undefined,readback:GPUBuffer|undefined;
  try{
    expect((await load(budgetFirst?oversized:small)).ok).toBe(true);
    expect(player.getState().status).toBe(budgetFirst?'blocked':'paused');
    // Three 100x100 surfaces, fourteen shadow copies and a six-vertex receiver.
    const oversizedBytes=(3*100*100*6*14+6)*VERTEX_FLOATS*4;
    expect(oversizedBytes).toBeGreaterThan(device.limits.maxBufferSize);
    if(budgetFirst)expect(player.getState().error).toContain(String(oversizedBytes));
    expect(errors).toEqual([]); // The shadow/budget scene itself raises no GPU error.

    // Deliberate native fault injection, outside animlib's controlled allocation.
    invalid=device.createBuffer({label:'intentional recovery-test failure',size:device.limits.maxBufferSize+4,usage:GPUBufferUsage.VERTEX});
    await vi.waitFor(()=>expect(errors).toHaveLength(1),{timeout:2000,interval:10});
    const failure=player.getState().error;
    expect(failure).toContain('exceeds the max buffer size limit');
    expect(player.getState().status).toBe('blocked');

    // Reverse ordering matters too: a later scene-budget failure cannot demote
    // the outstanding backend error to something a successful frame can clear.
    expect((await load(oversized)).ok).toBe(true);
    expect(player.getState()).toMatchObject({status:'blocked',error:failure});
    expect((await load(small)).ok).toBe(true);
    const bytesPerRow=width*4;
    readback=device.createBuffer({size:bytesPerRow*height,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
    const encoder=device.createCommandEncoder();
    encoder.copyTextureToBuffer({texture},{buffer:readback,bytesPerRow,rowsPerImage:height},[width,height]);device.queue.submit([encoder.finish()]);
    await readback.mapAsync(GPUMapMode.READ);
    const offset=(240*width+320)*4,pixel=Array.from(new Uint8Array(readback.getMappedRange()).slice(offset,offset+4));
    if(format==='bgra8unorm')[pixel[0],pixel[2]]=[pixel[2],pixel[0]];
    readback.unmap();expect(pixel).toEqual([255,0,0,255]);
    expect(player.getState()).toMatchObject({status:'blocked',error:failure});
    await expect(player.play()).rejects.toThrow(failure);
    expect(requestAnimationFrame).not.toHaveBeenCalled();expect(errors).toHaveLength(1);
  }finally{readback?.destroy();invalid?.destroy();player.dispose();texture.destroy();device.destroy();}
});
