import {afterEach,expect,it,vi} from 'vitest';
import {GPUImages,GLImages} from '../src/image-resources.js';
import type {ImageBinding} from '../src/composition.js';

afterEach(()=>vi.unstubAllGlobals());

it.each(['webgpu','webgl'])('%s can replace a full previous image working set while enforcing the current frame budget',backend=>{
  // GPU allocation/upload calls are the boundary under test; no real 320 MiB GPU allocation.
  const destroyed=new Set<object>(),textures:object[]=[];
  const makeTexture=()=>{const texture={createView:()=>({}),destroy:()=>destroyed.add(texture)};textures.push(texture);return texture;};
  vi.stubGlobal('GPUTextureUsage',{TEXTURE_BINDING:1,COPY_DST:2});
  const device={limits:{maxTextureDimension2D:4096},createTexture:makeTexture,queue:{writeTexture(){}},createSampler:()=>({}),createBindGroup:()=>({})} as unknown as GPUDevice;
  const gl={TEXTURE3:3,TEXTURE_2D:2,MAX_TEXTURE_SIZE:1,NO_ERROR:0,getParameter:()=>4096,
    activeTexture(){},createTexture:makeTexture,bindTexture(){},pixelStorei(){},texImage2D(){},getError:()=>0,deleteTexture:(texture:object)=>destroyed.add(texture),
    createSampler:()=>({}),samplerParameteri(){},bindSampler(){},deleteSampler(){}} as unknown as WebGL2RenderingContext;
  const cache=backend==='webgpu'?new GPUImages(device):new GLImages(gl);
  const binding=(id:number):ImageBinding=>({image:{id:String(id),kind:'image',hash:id.toString(16).padStart(64,'0'),width:4096,height:4096,copyPixels:()=>new Uint8Array(0)},texture:{image:{id:String(id),hash:id.toString(16).padStart(64,'0')},alphaMode:'opaque',filter:'nearest',wrap:'clamp'}});
  const bind=(id:number)=>cache instanceof GPUImages?cache.bind({setBindGroup(){}} as unknown as GPURenderPassEncoder,{getBindGroupLayout:()=>({})} as unknown as GPURenderPipeline,binding(id)):cache.bind(binding(id));
  cache.beginFrame();for(let i=0;i<4;i++)bind(i);cache.endFrame();
  expect(destroyed.size).toBe(0);
  cache.beginFrame();
  expect(()=>bind(4)).not.toThrow();
  expect(destroyed.size).toBeGreaterThan(0);
  for(let i=5;i<8;i++)bind(i);
  expect(()=>bind(8)).toThrow(/GPU memory limit/);
  for(const texture of textures.slice(4))expect(destroyed.has(texture)).toBe(false);
  cache.dispose();expect(destroyed.size).toBe(textures.length);
});
