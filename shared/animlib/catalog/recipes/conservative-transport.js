// Illustrative two-compartment migration. Fractions are per discrete step.
export default scene({end:'hold'},s=>{
  const state=s.conservativeTransport({initial:[.8,.2],transfers:[
    {id:'a-to-b',from:0,to:1,fraction:.25},
    {id:'b-to-a',from:1,to:0,fraction:.1},
  ],steps:5});
  const colors=[Color.TEAL,Color.YELLOW];
  for(let i=0;i<2;i++){
    const x=i?1.5:-1.5;
    const bar=s.line('population-'+i,{points:[[x,-1.5],[x,-1.5+3*state.at(0).values[i]]],stroke:colors[i],strokeWidth:.24});
    // Only the transfer itself is interpolated; no intermediate Markov step is claimed.
    s.bind(bar,[s.time],t=>{
      const step=Math.min(4,Math.floor(t)),u=Math.min(1,t-step),before=state.at(step),after=state.at(step+1);
      return{points:[[x,-1.5],[x,-1.5+3*(before.values[i]+u*(after.values[i]-before.values[i]))]]};
    });
    s.text('label-'+i,{text:i?'B':'A',position:[x,-1.9],fontSize:.3,fill:colors[i]});
  }
  s.arrow('direction',{points:[[-1,.4],[1,.4]],stroke:Color.WHITE,strokeWidth:.025});
  s.text('fraction',{text:'25% of A each step',position:[0,.8],fontSize:.25});
  // A complete explanation should show both directed edge amounts locally.
  s.wait(5);
});
