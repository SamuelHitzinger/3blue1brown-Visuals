import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const directory=resolve('data/animlib-expansion/depth-focus-proof');await mkdir(directory,{recursive:true});
const source=`export default scene({mode:'3d',background:'GREY_E',lighting:{ambient:1.1,directional:{direction:[-.4,.6,1],space:'camera',intensity:1.2}},end:'hold'},s=>{
 s.play(s.camera.to3D({yaw:0,pitch:0,distance:24,height:8,perspective:1,focus:{distance:18,aperture:.35,samples:32}}),{duration:0});
 const body=(id,x,y,z,color,scale=1)=>{
  const material={roughness:.25,specular:.65};
  s.sphere(id+'s',{position:[x,y,z],radius:.48*scale,fill:'GREEN',material});
  s.sphere(id+'l',{position:[x-.28*scale,y+.25*scale,z],radius:.32*scale,fill:'GREEN',material});
  s.sphere(id+'r',{position:[x+.28*scale,y+.15*scale,z],radius:.34*scale,fill:'GREEN',material});
  s.sphere(id+'b',{position:[x,y-.8*scale,z],radius:.38*scale,fill:color,material});
  s.sphere(id+'q',{position:[x+.2*scale,y-.58*scale,z],radius:.25*scale,fill:color,material});
  s.line(id+'link',{points:[[x,y-.3*scale,z],[x,y-.6*scale,z]],stroke:'GREEN_D',strokeWidth:.13*scale,strokeProfile:'round'});
 };
 for(let i=0;i<3;i++)body('triplet'+i,(i-1)*1.5,.4,0,i===2?'GOLD':'PINK');
 s.line('middle-backbone',{points:[[-1.5,.4,0],[0,.4,0],[1.5,.4,0]],stroke:'GREEN_D',strokeWidth:.18,strokeProfile:'round'});
 body('near',-2.6,-1.1,6,'BLUE_B',.8);
 for(let i=0;i<6;i++)body('rear'+i,(i-2.5)*1.8,1.3*Math.sin(i*.8)+.4,-8,'PURPLE_B',.7);
 s.line('rear-backbone',{points:Array.from({length:6},(_,i)=>[(i-2.5)*1.8,1.3*Math.sin(i*.8)+.4,-8]),stroke:'PURPLE_C',strokeWidth:.16,strokeProfile:'round'});
 s.line('bracket',{space:'screen',points:[[-185,140],[-185,160],[185,160],[185,140]],stroke:'WHITE',strokeWidth:2});
 s.text('label',{space:'screen',position:[0,187],text:'Selected triplet',fontSize:24,fill:'WHITE'});
 s.wait(1);s.play(s.camera.animate({focus:{distance:24,aperture:.35,samples:32}}),{duration:3,ease:'smooth'});s.wait(2);
});`;
await writeFile(join(directory,'focus.js'),source);
await writeFile(join(directory,'manifest.json'),JSON.stringify({title:'Optical depth selection',scenes:[{id:'focus',file:'focus.js',duration:6}],captions:[]},null,2));
await writeFile(join(directory,'frames-input.json'),JSON.stringify({source,times:[0,1,1.5,2,2.5,3,3.5,4,5,5.9],directory:join(directory,'frames')},null,2));
console.log(directory);
