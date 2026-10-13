// Synthetic event times, seconds. A Gaussian integrates to one on the real line.
export default scene({end:'hold'},s=>{
  const rates=s.eventRates({events:[[.4,.8,1.2,2.2],[.7,1.5,1.8,2.6]],times:Array.from({length:121},(_,i)=>i/40),bandwidth:.16});
  const state=s.sampledState({...rates,projection:[[1,0],[0,1],[0,0]]});
  for(let channel=0;channel<2;channel++){
    const y=channel?-1.5:.5,color=channel?Color.YELLOW:Color.TEAL;
    s.line('baseline-'+channel,{points:[[-3,y],[3,y]],stroke:Color.GREY,strokeWidth:.012});
    s.path('rate-'+channel,{points:rates.times.map((t,i)=>[-3+2*t,y+.23*rates.values[i][channel]]),stroke:color,strokeWidth:.025});
    const marker=s.circle('sample-'+channel,{radius:.07,fill:color});
    s.bind(marker,[s.time],t=>({position:[-3+2*Math.min(t,3),y+.23*state.at(Math.min(t,3)).values[channel]]}));
    s.latex('channel-'+channel,{tex:'f_'+(channel+1)+'(t)',position:[-3.6,y+.3],fontSize:.28,fill:color});
  }
  // Add the original event ticks and individual kernels for causal exposition.
  s.wait(3);
});
