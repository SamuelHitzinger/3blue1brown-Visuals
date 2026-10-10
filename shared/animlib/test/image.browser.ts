import {CanvasRenderer} from '../src/renderer.js';
import {SceneSequence} from '../src/sequence.js';
import {createAssetRegistry} from '../src/asset-registry.js';
import {imageInput,secondImageInput} from './image-fixture.js';
import {imageCases,imageCaseSource} from './image-render-cases.js';
async function run(){
  document.querySelector('#results')!.textContent='Creating registry';
  Object.defineProperty(navigator,'gpu',{configurable:true,value:undefined});
  Object.defineProperty(window,'devicePixelRatio',{configurable:true,value:1});
  const registry=await createAssetRegistry([imageInput(),secondImageInput()],{colorPolicy:'source'}),canvas=document.createElement('canvas');
  canvas.width=128;canvas.height=128;document.querySelector('#stage')!.append(canvas);
  document.querySelector('#results')!.textContent='Creating renderer';
  const renderer=new CanvasRenderer(canvas),errors:string[]=[];renderer.onError=e=>errors.push(e.message);
  const sequence:SceneSequence=new SceneSequence({modelAssets:registry,prepare:scenes=>renderer.prepare(scenes,sequence.assetGeometry)});
  const results:{name:string;ok:boolean;actual?:number[][];error?:string}[]=[];
  try {
    for(const entry of imageCases){
      const loaded=await sequence.submit({type:'load',scenes:[{id:'image',source:imageCaseSource(entry,registry.catalog[0].hash)}]});
      if(!loaded.ok)throw new Error(JSON.stringify(loaded));renderer.render(sequence.frame(0,0),sequence.compiled[0].options);
      const gl=canvas.getContext('webgl2')!,data=new Uint8Array(128*128*4);gl.readPixels(0,0,128,128,gl.RGBA,gl.UNSIGNED_BYTE,data);
      const actual=entry.probes.map(([x,y])=>[...data.slice(((127-y)*128+x)*4,((127-y)*128+x)*4+3)]);
      results.push({name:entry.name,ok:actual.every((p,i)=>p.every((v,j)=>Math.abs(v-entry.probes[i][j+2])<=1))&&gl.getError()===gl.NO_ERROR,actual});
    }
    document.querySelector('#results')!.textContent=JSON.stringify(results,null,2)+'\nTesting context recovery';
    const gl=canvas.getContext('webgl2')!,loss=gl.getExtension('WEBGL_lose_context');
    if(!loss)throw new Error('Context loss extension unavailable');
    await new Promise<void>(resolve=>{canvas.addEventListener('webglcontextlost',()=>resolve(),{once:true});loss.loseContext();});
    const restored=new Promise<void>(resolve=>canvas.addEventListener('webglcontextrestored',()=>resolve(),{once:true}));
    await new Promise(resolve=>setTimeout(resolve,100));loss.restoreContext();await restored;
    renderer.render(sequence.frame(0,0),sequence.compiled[0].options);
    const data=new Uint8Array(128*128*4);gl.readPixels(0,0,128,128,gl.RGBA,gl.UNSIGNED_BYTE,data);
    const index=((127-32)*128+32)*4,actual=[[...data.slice(index,index+3)]];
    results.push({name:'context recovery reuploads source pixels',ok:actual[0].every((v,i)=>Math.abs(v-[102,36,137][i])<=1),actual});
    results.push({name:'backend',ok:renderer.backend==='webgl2'&&errors.every(e=>e.includes('context lost'))});
  }catch(error){results.push({name:'harness',ok:false,error:String(error)});}
  finally{sequence.dispose();renderer.dispose();results.push({name:'leases disposed',ok:registry.stats().leases===0&&registry.stats().pinnedBytes===0});}
  document.querySelector('#results')!.textContent=JSON.stringify(results,null,2);return results;
}
(window as any).imageTests=run().then(result=>((window as any).imageResult=result)).catch(error=>{document.querySelector('#results')!.textContent=String(error.stack??error);throw error;});
