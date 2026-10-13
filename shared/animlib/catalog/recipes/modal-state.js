// Runnable starting point, not a universal composition template.
// Two equal masses: m=1, wall springs k=1, coupling spring kc=1.5.
export default scene({end:'hold'},s=>{
  const state=s.modalState({modes:[
    {shape:[1,1],amplitude:.4,angularFrequency:1},
    {shape:[1,-1],amplitude:.4,angularFrequency:2},
  ]});
  const centers=[-2,2];
  for(let i=0;i<2;i++){
    s.line('track-'+i,{points:[[centers[i]-1,-.4],[centers[i]+1,-.4]],stroke:Color.GREY,strokeWidth:.012});
    const mass=s.circle('mass-'+i,{radius:.2,position:[centers[i]+state.at(0).displacement[i],0],fill:i?Color.YELLOW:Color.TEAL});
    const shift=s.arrow('displacement-'+i,{points:[[centers[i],0],[centers[i]+state.at(0).displacement[i],0]],stroke:i?Color.YELLOW:Color.TEAL,strokeWidth:.04});
    s.bind(mass,[s.time],t=>({position:[centers[i]+state.at(t).displacement[i],0]}));
    s.bind(shift,[s.time],t=>({points:[[centers[i],0],[centers[i]+state.at(t).displacement[i],0]]}));
    s.latex('label-'+i,{tex:'x_'+(i+1),position:[centers[i],-.8],fontSize:.35,fill:i?Color.YELLOW:Color.TEAL});
  }
  // Build the springs and mode-to-sum correspondence for a complete explanation.
  s.wait(8);
});
