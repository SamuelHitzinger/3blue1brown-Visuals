import { modelFixture, modelSource } from './model-fixture.js';
import { parseModelGLB } from '../src/models.js';
import { ModelStore } from '../src/model-store.js';
import { CanvasRenderer } from '../src/renderer.js';
import { SceneSequence } from '../src/sequence.js';
import { RetainedGeometry } from '../src/retained-geometry.js';
import { createPlayer } from '../src/player.js';
import type { FixtureOptions } from './model-fixture.js';
export async function runModelBrowserTests(backend:'webgl2'|'webgpu') {
  const original=Object.getOwnPropertyDescriptor(navigator,'gpu');
  if(backend==='webgl2')Object.defineProperty(navigator,'gpu',{configurable:true,value:undefined});
  const results:{name:string;ok:boolean;error?:string}[]=[];
  const check=(v:unknown,m:string)=>{if(!v)throw new Error(m);};
  const record=async(name:string,fn:()=>Promise<void>)=>{try{await fn();results.push({name,ok:true});}catch(e){results.push({name,ok:false,error:String(e)});}document.querySelector('#results')!.textContent=JSON.stringify({backend,results},null,2);};
  async function setup(options:FixtureOptions={},source=modelSource){
    const bytes=await modelFixture(options),data=await parseModelGLB(bytes),url=URL.createObjectURL(new Blob([bytes],{type:'model/gltf-binary'}));
    const asset={kind:'model' as const,url,metadata:data.metadata},store=new ModelStore({fixture:asset});
    const canvas=document.createElement('canvas');canvas.style.cssText='width:320px;height:320px';document.querySelector('#stage')!.append(canvas);
    const renderer=new CanvasRenderer(canvas,undefined,store),errors:string[]=[];renderer.onError=e=>errors.push(e.message);
    const sequence=new SceneSequence({models:store.metadata,prepare:async scenes=>{await store.prepare(scenes);await renderer.prepare(scenes);}});
    const result=await sequence.submit({type:'load',scenes:[{id:'model',source}]});check(result.ok,JSON.stringify(result));check(renderer.backend===backend,`Expected ${backend}, got ${renderer.backend}`);
    const read=(t=1)=>{
      renderer.render(sequence.frame(0,t),sequence.compiled[0].options);
      const copy=document.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;const ctx=copy.getContext('2d')!;ctx.drawImage(canvas,0,0);const pixels=ctx.getImageData(0,0,copy.width,copy.height).data;
      check(errors.length===0,errors.join('\n'));return pixels;
    };
    const pixel=(p:Uint8ClampedArray,x:number,y:number)=>{const i=(Math.floor(canvas.height*y)*canvas.width+Math.floor(canvas.width*x))*4;return Array.from(p.slice(i,i+4));};
    return {renderer,sequence,store,asset,canvas,read,pixel,dispose:()=>{sequence.dispose();renderer.dispose();store.dispose();canvas.remove();URL.revokeObjectURL(url);}};
  }
  try {
    await record('embedded PNG orientation, UVs and sRGB color',async()=>{const s=await setup();try{const p=s.read();for(const [x,y,r,g,b] of [[.44,.44,255,0,0],[.56,.44,0,255,0],[.44,.56,0,0,255],[.56,.56,255,255,255]]){const c=s.pixel(p,x,y);check(Math.abs(c[0]-r)<8&&Math.abs(c[1]-g)<8&&Math.abs(c[2]-b)<8,`Unexpected texel ${x},${y}: ${c}`);}const img=document.createElement('img');img.src=s.canvas.toDataURL();img.width=240;document.querySelector('#gallery')!.append(img);}finally{s.dispose();}});
    await record('UV1 and KHR_texture_transform',async()=>{const s=await setup({uv1:true,transform:true});try{const c=s.pixel(s.read(),.44,.44);check(c[1]>240&&c[0]<10,`Expected transformed green texel: ${c}`);}finally{s.dispose();}});
    await record('linear material factor encodes to sRGB',async()=>{const s=await setup({textured:false});try{const model=s.store.resolve(s.sequence.frame(0,1)).elements.find(e=>e.geometry.kind==='mesh')!;const material=(model.geometry as any)._model.material;material.base=[0.5,0.5,0.5,1];const c=s.pixel(s.read(),.5,.5);check(c[0]>180&&c[0]<195,`Expected linear 0.5 encoded near 188: ${c}`);}finally{s.dispose();}});
    await record('backwards seeking and retained/streamed pixel equivalence',async()=>{const s=await setup();try{const a=s.read(1.3);s.read(2);s.read(0.2);const b=s.read(1.3);check(a.every((v,i)=>v===b[i]),'Seek changed pixels');const get=RetainedGeometry.prototype.get;let streamed;try{RetainedGeometry.prototype.get=()=>undefined;streamed=s.read(1.3);}finally{RetainedGeometry.prototype.get=get;}check(a.every((v,i)=>Math.abs(v-streamed![i])<=1),'Retained path differs');}finally{s.dispose();}});
    for(const mode of ['OPAQUE','MASK','BLEND'] as const)await record(`alpha ${mode} and object fades`,async()=>{const s=await setup({textured:false,alpha:.25,alphaMode:mode});try{const c=s.pixel(s.read(),.5,.5);const expected=mode==='OPAQUE'?255:mode==='MASK'?0:64;check(Math.abs(c[0]-expected)<8,`Alpha ${mode}: ${c}`);if(mode==='OPAQUE'){const fade=s.pixel(s.read(.5),.5,.5);check(fade[0]>110&&fade[0]<145,`Fade did not blend: ${fade}`);}}finally{s.dispose();}});
    await record('single-sided culling respects mirrored node transforms',async()=>{const s=await setup({mirrored:true,doubleSided:false});try{check(s.pixel(s.read(),.5,.5).slice(0,3).some(v=>v>20),'Mirrored front face was culled');}finally{s.dispose();}});
    await record('normal, metal/roughness, occlusion and emission maps affect lighting',async()=>{const plain=await setup({unlit:false}),mapped=await setup({unlit:false,normal:true,metallic:true,occlusion:true,emission:true});try{const a=plain.read(),b=mapped.read();check(a.some((v,i)=>Math.abs(v-b[i])>20),'PBR maps had no visible effect');check(b.some((v,i)=>i%4!==3&&v>30),'Mapped model is empty');}finally{plain.dispose();mapped.dispose();}});
    await record('isolated group fade composites textured models',async()=>{const s=await setup({},`export default scene({},s=>{const m=s.model('panel',{asset:'fixture'});const g=s.group('assembly',[m],{isolated:true});s.play(g.fadeIn(),{duration:1});s.wait(1);});`);try{const c=s.pixel(s.read(.5),.44,.44);check(c[0]>110&&c[0]<145&&c[1]<10,`Isolated alpha: ${c}`);}finally{s.dispose();}});
    await record('public player preloads, seeks, rejects missing assets and keeps last scene',async()=>{const s=await setup();const canvas=document.createElement('canvas');canvas.style.cssText='width:320px;height:320px';document.querySelector('#stage')!.append(canvas);const player=createPlayer({canvas,assets:{fixture:s.asset}});try{check((await player.submit({type:'load',scenes:[{id:'public',source:modelSource}]})).ok,'Player submission failed');await player.seek({scene:'public',time:1.5});check(player.getState().time===1.5,'Player seek failed');const rejected=await player.submit({type:'replace',scene:'public',source:modelSource.replace('fixture','missing')});check(!rejected.ok,'Unknown asset accepted');check(player.getState().scene==='public','Last valid scene lost');}finally{player.dispose();canvas.remove();s.dispose();}});
  }finally{if(backend==='webgl2'){if(original)Object.defineProperty(navigator,'gpu',original);else delete (navigator as any).gpu;}}
  return {backend,failed:results.filter(r=>!r.ok).length,results};
}
