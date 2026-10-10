import type { IntegrationHost } from './integration-cases.js';

/** A renderer test fixture, not an artist/reference fidelity proof. */
export const pathRenderSource=`export default scene({},s=>{
 const p=s.path('path',{points:[[-3,-1],[-2,1],[1,1],[3,-1]],stroke:'BLUE',strokeWidth:.08,fill:'none',dashArray:[.42,.18]});
 s.bind(p,[s.time],t=>({points:[[-3,-1],[-2,1+t*.3],[1,1],[3,-1]],strokeEnd:.2+.4*t,dashOffset:t*.2}));
 const a=s.arrow('arrow',{points:[[-3,-2],[3,-2]],stroke:'YELLOW',strokeWidth:.08,strokeEnd:.2});
 s.path('closed',{d:'M-1 -.5L0 .5L1 -.5Z',fill:'TEAL',stroke:'WHITE',strokeEnd:.6,strokeWidth:.06});
 s.play(a.animate({strokeEnd:1}),{duration:2,ease:'linear'});
});`;
const difference=(a:Uint8Array,b:Uint8Array)=>a.reduce((n,v,i)=>n+Number(Math.abs(v-b[i])>3),0);
export async function pathRenderCase(host:IntegrationHost):Promise<void> {
 const loaded=await host.sequence.submit({type:'load',scenes:[{id:'paths',source:pathRenderSource}]});
 if(!loaded.ok)throw Error(JSON.stringify(loaded));
 const images:Uint8Array[]=[];
 for(const time of [0,.5,1,1.5,2,.5]) {
  const frame=await host.sequence.evaluate(0,time),options=host.sequence.compiled[0].options;
  const actual=await host.draw(frame,options),reference=await host.draw(frame,options,true);
  if(difference(actual.pixels,reference.pixels)>24)throw Error('Path retained and streamed pixels differ');
  if(actual.pixels.filter((v,i)=>i%4!==3 && v>30).length<100)throw Error('Path frame empty');
  images.push(actual.pixels);
 }
 if(difference(images[0],images[2])<100 || difference(images[2],images[4])<100)throw Error('Path stroke and points do not change pixels');
 if(difference(images[1],images[5])!==0)throw Error('Path reverse seek changed pixels');
}
