/** Style contract: approved native Euler references; continuous spatial world,
 * stable blue object and teal surface, local object label, no inferred speed.
 * Scripted proof demonstrates identity through late motion and topology edits.
 * UI carries test evidence; canvas carries geometry, never a slide template.
 */
export const markerSource=`export default scene({mode:'3d',end:'hold',orbit:false},s=>{
  s.line3D('reference-line',{points:[[-6,-1.5,0],[6,-1.5,0]],stroke:'GREY_B',strokeWidth:.012});
  const marker=s.box('epoch-marker',{position:[-5,2.4,0],width:.35,height:.35,depth:.35,fill:'YELLOW'});
  s.bind(marker,[s.time],t=>({rotation:[t*.3,t*.5,t*.2]}));
  s.text('marker-label',{text:'independent clock',position:[-3.5,2.4,0],fontSize:.22,fill:'GREY_B'});
  s.wait(20);
});`;

export function objectSource(shape:'cube'|'sphere'){
  const geometry=shape==='cube'?"s.box('object',{width:1,height:1,depth:1,rotation:[.25,.4,0],position:[-2,0,0],fill:'BLUE'})"
    :"s.sphere('object',{radius:.6,position:[-2,0,0],fill:'BLUE'})";
  return `export default scene({mode:'3d',end:'hold',orbit:false},s=>{
    const object=${geometry};
    const label=s.text('object-label',{text:'object',fontSize:.25,fill:'BLUE'});
    s.attach(label,object,{anchor:'origin',offset:[0,-1,0]});s.wait(2);
  });`;
}

export const surfaceSource=`export default scene({mode:'3d',end:'hold',orbit:false},s=>{
  const surface=s.parametricSurface('novel-surface',{
    fn:(u,v)=>[u,v,.45*Math.sin(2*u)*Math.cos(2*v)],uRange:[-1.3,1.3],vRange:[-1.2,1.2],
    uSegments:32,vSegments:32,position:[3,0,0],rotation:[-.7,.35,0],fill:'TEAL',shading:'smooth'});
  s.text('surface-label',{text:'z = 0.45 sin(2u) cos(2v)',position:[3,-2,0],fontSize:.23,fill:'TEAL'});
  s.wait(20);
});`;
