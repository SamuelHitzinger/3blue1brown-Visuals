import {CanvasRenderer} from '../src/renderer.js';
import {compileSource} from '../src/compiler.js';
import {evaluateScene} from '../src/timeline.js';
import {createAssetRegistry} from '../src/asset-registry.js';
import {sceneAssetRefs} from '../src/asset-geometry.js';
import {ModelStore} from '../src/model-store.js';
import {parseModelGLB} from '../src/models.js';
import {RetainedGeometry} from '../src/retained-geometry.js';
import {imageInput} from './image-fixture.js';
import {model} from './asset-fixture.js';
import {modelFixture} from './model-fixture.js';

async function run(){
 Object.defineProperty(navigator,'gpu',{configurable:true,value:undefined});
 Object.defineProperty(window,'devicePixelRatio',{configurable:true,value:1});
 const results:{name:string;ok:boolean;actual?:unknown;error?:string}[]=[];
 const output=document.querySelector('#results')!;
 const check=(condition:unknown,message:string)=>{if(!condition)throw new Error(message);};
 const record=(name:string,actual?:unknown)=>{results.push({name,ok:true,actual});output.textContent=JSON.stringify(results,null,2);};
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;canvas.style.cssText='width:256px;height:128px';document.querySelector('#stage')!.append(canvas);
 const mesh=model('science');mesh.parts[0].vertices=[[-.5,-.5,0],[.5,-.5,0],[0,.5,0]];
 const registry=await createAssetRegistry([imageInput(),mesh],{colorPolicy:'source'});
 const bytes=await modelFixture({uv1:true,transform:true}),parsed=await parseModelGLB(bytes);
 const models=new ModelStore({fixture:{kind:'model',url:'fixture.glb',metadata:parsed.metadata}},{read:async()=>bytes});
 const source=(isolated:boolean)=>`export default scene({background:'BLACK'},s=>{
  const image=s.image('image',{asset:'corners',width:2,position:[-2,0,0],filter:'nearest'});
  const imported=s.model('imported',{asset:'fixture',position:[2,0,0]});
  const prepared=s.model('prepared',{asset:'science',fill:'PURE_RED',shading:'unlit',strokeWidth:0});
  ${isolated?"s.group('mixed',[image,imported,prepared],{isolated:true,opacity:.5});":''}
  s.play(s.camera.animate({height:4,distance:12}),{duration:0});s.wait(1);
 });`;
 const scenes=await Promise.all([false,true].map(isolated=>compileSource(source(isolated),{assetCatalog:registry.catalog,models:models.metadata})));
 const lease=registry.acquire(sceneAssetRefs(scenes)),renderer=new CanvasRenderer(canvas,undefined,lease,models),errors:string[]=[];
 renderer.onError=e=>errors.push(e.message);
 try{
  await models.prepare(scenes);await renderer.prepare(scenes);check(renderer.backend==='webgl2','Expected WebGL2');
  const gl=canvas.getContext('webgl2')!;
  const capture=(isolated=false,focus=false)=>{
   const scene=scenes[isolated?1:0],frame=evaluateScene(scene,0);if(focus)frame.camera.focus={distance:12,aperture:.8,samples:16};
   renderer.render(frame,scene.options);
   const pixels=new Uint8Array(256*128*4);gl.readPixels(0,0,256,128,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
   check(gl.getError()===gl.NO_ERROR,'WebGL error during readback');check(errors.every(e=>e.includes('context lost')),errors.join('\n'));return pixels;
  };
  const at=(p:Uint8Array,x:number,y:number)=>[...p.slice(((127-y)*256+x)*4,((127-y)*256+x)*4+3)];
  const near=(actual:number[],expected:number[],tolerance=1)=>actual.every((v,i)=>Math.abs(v-expected[i])<=tolerance);
  const sharp=capture(),probes=[[48,48],[176,48],[128,64]],expected=[[203,71,19],[0,255,0],[255,0,0]];
  const colors=probes.map(([x,y])=>at(sharp,x,y));check(colors.every((c,i)=>near(c,expected[i])),`Mixed colors: ${JSON.stringify(colors)}`);record('prepared image + prepared mesh + GLB UV1 texture transform',colors);
  const focus=capture(false,true);check(focus.every((v,i)=>Math.abs(v-sharp[i])<=1),'Focus altered focal-plane pixels');record('focus samples preserve mixed focal plane and sampler state');
  const faded=capture(true,true),fadedColors=probes.map(([x,y])=>at(faded,x,y));check(fadedColors.every((c,i)=>near(c,expected[i].map(v=>v*.5))),'Isolated opacity differs');record('isolated group depth/color passes under focus',fadedColors);
  check(capture().every((v,i)=>v===sharp[i]),'Replaying sharp scene changed pixels');
  const get=RetainedGeometry.prototype.get;try{RetainedGeometry.prototype.get=()=>undefined;check(capture().every((v,i)=>Math.abs(v-sharp[i])<=1),'Streamed pixels differ');}finally{RetainedGeometry.prototype.get=get;}
  record('retained/streamed geometry and repeated frame equivalence');
  const loss=gl.getExtension('WEBGL_lose_context');check(loss,'Context loss extension unavailable');
  await new Promise<void>(resolve=>{canvas.addEventListener('webglcontextlost',()=>resolve(),{once:true});loss!.loseContext();});
  const restored=new Promise<void>(resolve=>canvas.addEventListener('webglcontextrestored',()=>resolve(),{once:true}));
  await new Promise(resolve=>setTimeout(resolve,100));loss!.restoreContext();await restored;
  check(capture(false,true).every((v,i)=>Math.abs(v-focus[i])<=1),'Restored mixed focus pixels differ');record('context restore reuploads image and GLB resources with focus');
  const img=document.createElement('img');img.src=canvas.toDataURL();document.querySelector('#gallery')!.append(img);
 }catch(error){results.push({name:'mixed WebGL regression',ok:false,error:String(error)});}
 finally{renderer.dispose();renderer.dispose();lease.dispose();models.dispose();results.push({name:'asset leases disposed',ok:registry.stats().leases===0});}
 output.textContent=JSON.stringify(results,null,2);return results;
}
(window as any).mixedAssetTests=run().then(result=>((window as any).mixedAssetResult=result)).catch(error=>{document.querySelector('#results')!.textContent=String(error.stack??error);throw error;});
