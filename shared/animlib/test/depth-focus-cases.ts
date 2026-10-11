import type {CameraState} from '../src/types.js';
export const opticalSource=`export default scene({mode:'3d',background:'BLACK'},s=>{
 s.play(s.camera.to3D({yaw:0,pitch:0,height:8,distance:20,perspective:0}),{duration:0});
 for(let i=0;i<3;i++)s.mesh('p'+i,{vertices:[[-.5,-1,0],[.5,-1,0],[.5,1,0],[-.5,1,0]],triangles:[[0,1,2],[0,2,3]],position:[(i-1)*2.5,0,(1-i)*10],fill:'WHITE'});
 s.rectangle('HUD',{space:'screen',position:[0,65],width:50,height:2,fill:'PURE_RED',stroke:'none'});s.wait(1);
});`;
export const focusViewSource=`export default scene({mode:'3d',background:'BLACK'},s=>{
 for(let i=0;i<2;i++)s.view('v'+i,{rect:[i*.5,0,.5,1],camera:{yaw:0,pitch:0,height:8,distance:20,perspective:0,${''}focus:{distance:20,aperture:i===0?.8:0}}},v=>{
 const a=v.sphere('a'+i,{radius:.8,position:[0,0,10],fill:'BLUE'});const b=v.sphere('b'+i,{radius:.8,position:[.7,0,0],fill:'YELLOW'});v.group('g'+i,[a,b],{isolated:true,opacity:.7});
 const hud=v.rectangle('localHUD'+i,{space:'screen',position:[0,60],width:40,height:2,fill:'WHITE',stroke:'none'});v.group('hudGroup'+i,[hud],{isolated:true,opacity:.7});
 });s.rectangle('globalHUD',{space:'screen',position:[0,-70],width:90,height:2,fill:'WHITE',stroke:'none'});s.wait(1);
});`;
export function opticalIssues(sharp:Uint8Array,zero:Uint8Array,focused:Uint8Array,rack:Uint8Array):string[]{
 const issues:string[]=[],row=(a:Uint8Array,left:number,right:number)=>Array.from({length:right-left},(_,i)=>a[(96*256+left+i)*4]);
 const equal=(a:readonly number[]|Uint8Array,b:readonly number[]|Uint8Array)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
 if(!equal(zero,sharp))issues.push('Zero aperture changed pixels');
 if(!equal(row(focused,108,148),row(sharp,108,148)))issues.push('Focal plane lost sharpness');
 for(const [left,right] of [[48,88],[168,208]])if(row(focused,left,right).filter(v=>v>8&&v<240).length<=row(sharp,left,right).filter(v=>v>8&&v<240).length+4)issues.push('Depth-separated edge did not soften');
 if(!equal(row(rack,48,88),row(sharp,48,88)))issues.push('Rack focus did not sharpen near plane');
 if(equal(rack,focused))issues.push('Focus distance did not affect pixels');
 for(let y=20;y<40;y++)for(let x=90;x<166;x++)for(let c=0;c<4;c++)if(sharp[(y*256+x)*4+c]!==focused[(y*256+x)*4+c]){issues.push('Screen annotation changed');return issues;}
 return issues;
}
export const focusSettings: (CameraState['focus'])[]=[undefined,{distance:20,aperture:0},{distance:20,aperture:.8},{distance:10,aperture:.8}];
export const focusOcclusionSource=`export default scene({mode:'3d',background:'BLACK'},s=>{
 s.play(s.camera.to3D({yaw:0,pitch:0,height:8,distance:20,perspective:0,focus:{distance:20,aperture:.8}}),{duration:0});
 s.rectangle('behind',{width:3,height:2,fill:'PURE_RED',stroke:'none'});
 s.rectangle('front',{width:1,height:2,position:[0,0,10],fill:'PURE_GREEN',stroke:'none'});s.wait(1);
});`;
export function focusOcclusionIssues(pixel:(x:number,y:number)=>number[]):string[]{
 const core=pixel(128,96),edge=pixel(139,96),rear=pixel(157,96),issues:string[]=[];
 if(core[0]>1||core[1]<254)issues.push('Occluded rear color leaked through the solid foreground core');
 if(edge[0]<20||edge[1]<20)issues.push('Defocused silhouette did not reveal the rear surface across aperture rays');
 if(rear[0]<254||rear[1]>1)issues.push('Sharp rear plane changed outside the foreground blur footprint');
 return issues;
}
