export interface ImageCase {name:string;props:string;probes:number[][];background?:string;uvScale?:number;body?:string}
export const imageCases:ImageCase[]=[
  {name:'source RGB and straight alpha',props:"filter:'nearest'",probes:[[32,32,203,71,19],[96,32,17,139,221],[32,96,16,110,32],[96,96,0,0,0]]},
  {name:'linear sample interpolation',props:"filter:'linear',alphaMode:'opaque'",probes:[[63,16,111,104,118]]},
  {name:'repeat UV sampling',props:"filter:'nearest',alphaMode:'opaque',wrap:'repeat'",uvScale:2,probes:[[16,16,203,71,19],[80,16,203,71,19]]},
  {name:'clamp UV sampling',props:"filter:'nearest',alphaMode:'opaque',wrap:'clamp'",uvScale:2,probes:[[16,16,203,71,19],[80,16,17,139,221]]},
  {name:'declared opaque alpha',props:"filter:'nearest',alphaMode:'opaque'",probes:[[32,96,31,219,63],[96,96,171,43,197]]},
  {name:'explicit palette tint',props:"filter:'nearest',tint:'PURE_RED'",probes:[[32,32,203,0,0],[96,32,17,0,0]]},
  {name:'independent images',props:'',body:"s.image('a',{asset:'corners',width:2,position:[-1,0],filter:'nearest'});s.image('b',{asset:'second',width:2,position:[1,0],filter:'nearest'});",probes:[[16,48,203,71,19],[80,48,41,83,127]]},
  {name:'transparent triangles sorted front to back',props:'',body:"s.image('front',{asset:'corners',width:4,position:[0,0,1],filter:'nearest',tint:'PURE_RED',opacity:0.5});s.image('back',{asset:'corners',width:4,filter:'nearest',tint:'PURE_BLUE',alphaMode:'opaque'});",probes:[[32,32,102,0,10],[96,32,9,0,111]]},
  {name:'opacity over palette background',props:"filter:'nearest',alphaMode:'opaque',opacity:0.5",background:'PURE_BLUE',probes:[[32,32,102,36,137],[96,32,9,70,238]]},
];
export function imageCaseSource(entry:ImageCase,hash:string):string {
  const shape=entry.body??(entry.uvScale?`s.mesh('card',{vertices:[[-2,2,0],[-2,-2,0],[2,-2,0],[2,2,0]],triangles:[[0,1,2],[0,2,3]],uv0:[[0,0],[0,2],[2,2],[2,0]],imageTexture:{image:{id:'corners',hash:'${hash}'},${entry.props}}});`: `s.image('card',{asset:'corners',width:4,${entry.props}});`);
  return `export default scene({background:'${entry.background??'BLACK'}'},s=>{${shape}s.play(s.camera.animate({height:4}),{duration:0});s.wait(1);});`;
}
