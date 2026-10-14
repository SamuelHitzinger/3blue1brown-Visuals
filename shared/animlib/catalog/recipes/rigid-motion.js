// Authored illustration of rigid movement; not molecular dynamics or flexing.
export default scene({end:'hold'},s=>{
  const motion=s.rigidMotion({pivot:[0,0,0],interpolation:'smooth',
    provenance:{kind:'illustrative',description:'Authored rigid movement of fixed landmarks'},
    keyframes:[{time:0,translation:[-1,0,0],rotation:[0,0,0]},
      {time:2,translation:[1,0,0],rotation:[0,0,Math.PI/2]}]});
  const points=[[-.6,0,0],[.6,0,0],[0,.8,0]];
  points.forEach((point,i)=>{
    const dot=s.circle('landmark-'+i,{radius:.12,fill:i?Color.YELLOW:Color.TEAL});
    s.bind(dot,[s.time],t=>({position:motion.transformPoint(point,t)}));
  });
  const outline=s.line('fixed-shape',{points:points.concat([points[0]]),stroke:Color.GREY,strokeWidth:.025});
  s.bind(outline,[s.time],t=>({points:points.concat([points[0]]).map(point=>motion.transformPoint(point,t))}));
  s.wait(2);
});
