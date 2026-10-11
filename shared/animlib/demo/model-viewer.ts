import { createPlayer, parseModelGLB, createModelGLB } from '../src/index.js';
import type { ModelMetadata, Vec2, Vec3, Player } from '../src/index.js';
const stage=document.querySelector<HTMLDivElement>('#stage')!,status=document.querySelector<HTMLElement>('#status')!,parts=document.querySelector<HTMLSelectElement>('#parts')!;
let player:Player|undefined,url:string|undefined,metadata:ModelMetadata|undefined;
async function scene(){
 if(!player||!metadata)return;
 const center=metadata.bounds.min.map((v,i)=>(v+metadata!.bounds.max[i])/2),size=Math.max(...metadata.bounds.max.map((v,i)=>v-metadata!.bounds.min[i]),.001);
 const source=`export default scene({mode:'3d',orbit:true},s=>{
  const model=s.model('model',{asset:'model',position:${JSON.stringify(center.map(v=>-v))}});
  const display=s.group('display',[model]);
  s.play(display.scaleTo(${4/size}),{duration:0});
  ${parts.value?`s.play(model.part(${JSON.stringify(parts.value)}).tintTo(Color.BLUE),{duration:0});`:''}
  s.play(display.rotateTo([0,Math.PI*2,0]),{duration:12,ease:'linear'});
 });`;
 const result=await player.submit({type:'load',scenes:[{id:'model',source}]});if(!result.ok)throw new Error(result.diagnostics.map(d=>d.message).join('\n'));
 status.textContent=`${metadata.triangles.toLocaleString()} triangles · ${metadata.parts.length} parts · ${player.backend}`;
}
async function open(bytes:Uint8Array<ArrayBuffer>){
 const data=await parseModelGLB(bytes);
 player?.dispose();if(url)URL.revokeObjectURL(url);stage.replaceChildren();
 const canvas=document.createElement('canvas');stage.append(canvas);
 url=URL.createObjectURL(new Blob([bytes],{type:'model/gltf-binary'}));metadata=data.metadata;
 parts.replaceChildren(new Option('Original materials',''),...metadata.parts.map(p=>new Option(p.name||p.id,p.id)));
 player=createPlayer({canvas,assets:{model:{kind:'model',url,metadata}}});await scene();
}
async function example(){
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;const c=canvas.getContext('2d')!;
 for(let y=0;y<4;y++)for(let x=0;x<8;x++){c.fillStyle=['#f3b35d','#e96766','#6377cc','#5dbdc0'][(x+y)%4];c.fillRect(x*32,y*32,32,32);}
 c.font='bold 18px system-ui';c.fillStyle='#fff';c.fillText('U →  •  V ↓',18,72);
 const texture=new Uint8Array(await (await new Promise<Blob>(resolve=>canvas.toBlob(b=>resolve(b!)))).arrayBuffer());
 const vertices:Vec3[]=[],uv:Vec2[]=[],triangles:[number,number,number][]=[];
 for(let r=0;r<=24;r++)for(let s=0;s<=48;s++){const v=r/24,u=s/48,a=u*Math.PI*2,b=v*Math.PI;vertices.push([Math.cos(a)*Math.sin(b),Math.cos(b),Math.sin(a)*Math.sin(b)]);uv.push([u,v]);}
 for(let r=0;r<24;r++)for(let s=0;s<48;s++){const a=r*49+s,b=a+49;if(r>0)triangles.push([a,a+1,b]);if(r<23)triangles.push([a+1,b+1,b]);}
 await open(await createModelGLB({parts:[{name:'Textured sphere',vertices,triangles,uv,texture:{bytes:texture,mime:'image/png'},roughness:.65},{name:'Companion',vertices:vertices.map(p=>p.map(v=>v*.4) as Vec3),triangles,position:[1.7,0,0],baseColor:[.15,.55,.85,1],metalness:.7,roughness:.3}]}));
}
const run=(work:()=>Promise<void>)=>void work().catch(e=>{status.textContent=String(e);});
document.querySelector<HTMLInputElement>('#file')!.onchange=e=>{const file=(e.target as HTMLInputElement).files?.[0];if(file)run(async()=>open(new Uint8Array(await file.arrayBuffer())));};
document.querySelector<HTMLButtonElement>('#example')!.onclick=()=>run(example);
parts.onchange=()=>run(scene);document.querySelector<HTMLButtonElement>('#replay')!.onclick=()=>run(async()=>{await player?.seek({scene:'model',time:0});await player?.play();});
window.addEventListener('pagehide',()=>{player?.dispose();if(url)URL.revokeObjectURL(url);});run(example);
