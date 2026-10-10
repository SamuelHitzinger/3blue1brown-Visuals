import type { Frame, CompiledScene, Geometry } from '../src/types.js';
import type { SceneSequence } from '../src/sequence.js';
import { pathRenderCase } from './path-render-cases.js';

/** Shared assertions against real native WebGPU and browser WebGL2 readback. */
export interface IntegrationSample { pixels: Uint8Array; resources: number; indexed: number; uploads: number; }
export interface IntegrationHost {
  sequence: SceneSequence;
  draw(frame: Frame, options: CompiledScene['options'], reference?: boolean): Promise<IntegrationSample>;
}
const check = (value: unknown, message: string): void => { if (!value) throw Error(message); };
const difference = (a: Uint8Array, b: Uint8Array, tolerance = 3) => a.reduce((n,v,i)=>n+Number(i%4!==3 && Math.abs(v-b[i])>tolerance),0);
const colored = (p: Uint8Array) => p.reduce((n,v,i)=>n+Number(i%4!==3 && v>30),0);
const redEnergy = (p:Uint8Array) => p.reduce((n,v,i)=>n+(i%4===0?v:0),0);
const red = (p: Uint8Array) => {let n=0;for(let i=0;i<p.length;i+=4)if(p[i]>p[i+2]+15 && p[i]>p[i+1]+15)n++;return n;};
async function load(host:IntegrationHost, source:string) {
  const r=await host.sequence.submit({type:'load',scenes:[{id:'integration',source}]});check(r.ok,JSON.stringify(r));
  return host.sequence.compiled[0];
}
async function compare(host:IntegrationHost, frame:Frame, options:CompiledScene['options'], bypass:boolean) {
  const a=await host.draw(frame,options),b=await host.draw(frame,options,true);
  check(colored(b.pixels)>100,'Empty integration reference');
  check(difference(a.pixels,b.pixels)<24,'Retained and world-packed integration pixels differ');
  if(bypass)check(a.resources===0 && a.indexed===0,'Whole-frame dependency retained GPU resources or indexed draws');
  return a;
}
export const combinedSource = `export default scene({mode:'3d',lighting:{ambient:0.7,
 directional:{direction:[1,2,1],space:'world',shadow:{quality:'medium',softness:0.08,opacity:0.7}},
 receiver:{position:[0,-1.5,0],size:[10,10],fill:'GREY_B'}}},s=>{
 const a=s.slider('amount',{reactive:true,default:0.3,min:0,max:1});
 function study(v,id,opacity) {
  const b=v.box(id,{width:2,height:2,depth:2,fill:'WHITE',
   clipPlanes:[{normal:[1,0.3,0.2],offset:0.25,section:{color:'YELLOW',cap:'GOLD',width:0.025}}],
   outline:{color:'BLACK',width:0.035},texture:{pattern:'stripes',color:'BLUE',scale:1.5},material:{roughness:0.4}});
  v.deform(b,[s.time,a],([x,y,z],i,t,a)=>[x+0.25*y*Math.sin(t)*a,y+0.15*Math.cos(t+x)*a,z]);
  v.bind(b,[a],a=>({scalarColors:{values:Array.from({length:24},(_,i)=>a+(i%4)/5),domain:[0,1],colors:['BLUE','RED']},
   material:{roughness:0.1+0.8*a,metalness:a/2},texture:{pattern:'stripes',color:'TEAL',scale:1+a}}));
  v.group(id+'-g',[b],{isolated:true,opacity,rotation:[0.1,0.2,0],position:[0,0.1,0]});
  v.sphere(id+'-stable',{radius:0.3,position:[2.5,0,0],fill:'GREEN'});
 }
 s.view('left',{rect:[0,0,0.5,1],camera:{yaw:0.5,pitch:-0.35,height:6,perspective:0}},v=>study(v,'left-solid',1));
 s.view('right',{rect:[0.5,0,0.5,1],camera:{yaw:-0.7,pitch:-0.5,height:6,perspective:0}},v=>study(v,'right-solid',0.65));
 s.wait(3);
});`;

export const integrationCases: {name:string;run:(host:IntegrationHost)=>Promise<void>}[] = [
{name:'arc-length paths, continuous dashes, retained points and reverse seeks',run:pathRenderCase},
 {name:'deformed capped scalar solids use final lit geometry and shadows in isolated views',run:async host=>{
  const scene=await load(host,combinedSource),identity=scene;
  let first:Uint8Array|undefined;
  for(const time of [0,1.25,2.5,0]) {
   const frame=await host.sequence.evaluate(0,time);
   const sample=await compare(host,frame,scene.options,true);
   if(!first)first=sample.pixels;else if(time===0)check(difference(first,sample.pixels,0)===0,'Backward seek changed combined pixels');
   const plain=structuredClone(frame);
   for(const e of plain.elements)if(e.geometry.kind==='mesh'){delete e.geometry.clipPlanes;delete e.geometry.outline;}
   check(difference(sample.pixels,(await host.draw(plain,scene.options)).pixels)>100,'Clipping/caps/outlines had no visible effect');
   const unshadowed=structuredClone(frame);
   if(unshadowed.lighting && unshadowed.lighting!=='studio')delete unshadowed.lighting.directional!.shadow;
   check(difference(sample.pixels,(await host.draw(unshadowed,scene.options)).pixels)>100,'Final clipped/deformed caster had no shadow');
  }
  const outlineFrame=structuredClone(await host.sequence.evaluate(0,0.7));
  if(outlineFrame.lighting && outlineFrame.lighting!=='studio') {
   delete outlineFrame.lighting.receiver;delete outlineFrame.lighting.directional!.shadow;
  }
  const outlineBase=await compare(host,outlineFrame,scene.options,false);
  check(outlineBase.resources>0,'Explanatory opt-out disabled unaffected spheres without a receiver');
  const orbited=structuredClone(outlineFrame);orbited.views![0].camera.yaw+=0.9;
  const outlineTurn=await compare(host,orbited,scene.options,false);
  check(outlineTurn.resources>0,'Camera-dependent outlines disabled unaffected retention');
  check(difference(outlineBase.pixels,outlineTurn.pixels)>500,'Regional outline camera change did not render');
  const noOutline=structuredClone(orbited);for(const e of noOutline.elements)delete e.geometry.outline;
  check(difference(outlineTurn.pixels,(await host.draw(noOutline,scene.options)).pixels)>100,'Orbited outlines did not render');
  const before=await host.sequence.evaluate(0,1);
  const beforePixels=(await host.draw(before,scene.options)).pixels;
  await host.sequence.setControl('integration','amount',0.9);
  check(host.sequence.compiled[0]===identity,'Reactive update replaced the compiled scene');
  const after=await host.sequence.evaluate(0,1);
  check(after.elements.find(e=>e.id==='left-solid')!.geometry.clipPlanes?.length===1,'Update lost clipping');
  const afterPixels=(await compare(host,after,scene.options,true)).pixels;
  check(difference(beforePixels,afterPixels)>1000,'Effective geometry/material/scalar update did not render');
  const noScalar=structuredClone(after);for(const e of noScalar.elements)delete e.geometry.scalarColors;
  check(difference(afterPixels,(await host.draw(noScalar,scene.options)).pixels)>1000,'Scalar colors were ignored');
 }},
 {name:'stable identity effective streams promote back to warm indexed geometry',run:async host=>{
  const scene=await load(host,`export default scene({mode:'3d',lighting:{ambient:0.8,directional:{direction:[1,1,1],space:'world'}}},s=>{
   const a=s.slider('a',{reactive:true,default:0.2,min:0,max:1});
   const m=s.mesh('m',{vertices:[[-1,-1,0],[1,-1,0],[1,1,0],[-1,1,0]],triangles:[[0,1,2],[0,2,3]],shading:'smooth',fill:'WHITE'});
   s.deform(m,[s.time,a],([x,y,z],i,t,a)=>[x,y,z+Math.min(t,1)*a*x]);
   s.bind(m,[a],a=>({material:{roughness:0.1+a/2,metalness:a},texture:{pattern:'checker',color:'BLUE',scale:1+a}}));
   s.wait(3);
  });`);
  const frames:Uint8Array[]=[];
  for(const time of [0,0.4,0.8,1,1,1,0]) {
   const f=await host.sequence.evaluate(0,time);const result=await compare(host,f,scene.options,false);frames.push(result.pixels);
   if(time===0.4 || time===0.8)check(result.resources===0 && result.indexed===0,'Changing geometry did not stream until stable');
   // compare() releases optimized resources; restore before testing warm state.
   await host.draw(f,scene.options);
   const warm=await host.draw(f,scene.options);
   check(warm.resources>0 && warm.indexed>0,'Stable effective sample did not promote to indexed rendering');
   check(warm.uploads===0,'Stable eligible sample uploaded geometry');
  }
  check(difference(frames[0],frames[2])>100,'Deformation was stale');
  check(difference(frames[0],frames.at(-1)!)<24,'Backward effective sample was stale');
  await host.sequence.setControl('integration','a',0.9);check(host.sequence.compiled[0]===scene,'Appearance update rebuilt scene');
  const f=await host.sequence.evaluate(0,0.8),changed=await compare(host,f,scene.options,false);
  check(difference(frames[2],changed.pixels)>100,'Paused material/texture update was stale');
  const scalar=structuredClone(f);scalar.elements[0].geometry.scalarColors={values:[0,1,1,0],domain:[0,1],colors:['GREEN','RED']};
  await compare(host,scalar,scene.options,true);
 }},
 {name:'transformed world label modes and morph endpoints bypass all occluder retention',run:async host=>{
  const scene=await load(host,`export default scene({},s=>{
   const b=s.box('b',{width:3,height:2,depth:1,fill:'PURE_BLUE',shading:'unlit'});
   s.group('transform',[b],{position:[0.8,0,0],rotation:[0,0,0.2],scale:1.1});
   const l=s.text('label',{text:'MMMM',fontSize:0.8,position:[0.8,0,-2],fill:'PURE_RED',billboard:true});
   s.group('isolated',[l],{isolated:true,opacity:0.65});s.wait(2);
  });`);
  const frame=await host.sequence.evaluate(0,0);
  const base=await compare(host,frame,scene.options,false);check(base.resources>0,'Default-depth scene lost unaffected retention');
  let overlayRed=0,overlayEnergy=0;
  for(const mode of ['overlay','hide','fade','depth'] as const) {
   const f=structuredClone(frame),label=f.elements.find(e=>e.id==='label')!;label.geometry.labelOcclusion=mode;
   const p=await compare(host,f,scene.options,mode!=='depth');
   if(mode==='overlay'){overlayRed=red(p.pixels);overlayEnergy=redEnergy(p.pixels);check(overlayRed>100,'Overlay label missing');}
   if(mode==='hide'||mode==='depth')check(red(p.pixels)===0,'Occluded label remains visible');
   if(mode==='fade')check(Math.abs(redEnergy(p.pixels)/overlayEnergy-0.2)<0.025,'Occluded label did not preserve 20% red coverage through isolated opacity');
   if(mode==='depth')check(p.resources>0,'Explicit depth disabled unaffected retention');
   if(mode!=='depth')for(const endpoint of ['from','to'] as const) {
    const m=structuredClone(frame),l=m.elements.find(e=>e.id==='label')!;
    const geometry:Geometry={...l.geometry,labelOcclusion:mode};
    l.morph={from:endpoint==='from'?geometry:l.geometry,to:endpoint==='to'?geometry:l.geometry,progress:endpoint==='from'?0:1};
    const actual=await compare(host,m,scene.options,true);check(difference(actual.pixels,p.pixels)<24,'Morph label mode changed pixels');
    l.opacity=0;await compare(host,m,scene.options,true); // Hidden endpoint still gates all occluders.
   }
  }
 }},
];
