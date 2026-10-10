export default scene({background:'BLACK',end:'hold'},s=>{
  // Synthetic events, seconds. Each Gaussian integrates to one event on R.
  const rows=[[.28,.44,.59,1.25,1.90,2.0,2.14,2.81,3.48],[.35,1.1,1.23,1.37,1.56,2.3,3.3,3.42],[.3,.91,1.71,1.83,1.95,2.1,2.24,2.91,3.61],[.5,.69,1.25,1.4,1.57,2.01,2.72,2.86,3.12],[.31,.85,1.37,1.92,2.03,2.2,2.67,2.77,3.26,3.35]];
  const colors=['RED','GREEN','PURPLE','YELLOW','BLUE'];
  const sigma=.13, selected=2, rateScale=.075;
  const kernel=(t,event)=>Math.exp(-.5*((t-event)/sigma)**2)/(sigma*Math.sqrt(2*Math.PI));
  const rate=(r,t)=>rows[r].reduce((n,event)=>n+kernel(t,event),0);
  const clamp=v=>Math.max(0,Math.min(1,v)),smooth=v=>{const u=clamp(v);return u*u*(3-2*u);};
  const layout=t=>smooth((t-3.5)/1.2);
  const x=(u,t)=>-4.65+u*(2.325-.8*layout(t));
  const ticks=[],kernels=[],traces=[],markers=[],entries=[];
  for(let r=0;r<5;r++){
    const y=2.25-r*1.15,c=colors[r];
    const p=s.plane('row-'+r,{xRange:[0,4],yRange:[0,10],origin:[-4.65,y],scale:[2.325,rateScale],grid:false,axes:false,ticks:false});
    rows[r].forEach((event,j)=>{
      const tick=p.path('event-'+j,[[event,-2],[event,2]],{stroke:c,strokeWidth:.022});ticks.push(tick);
      const points=Array.from({length:41},(_,i)=>{const t=Math.max(0,event-.52)+i*(Math.min(4,event+.52)-Math.max(0,event-.52))/40;return[t,kernel(t,event)];});
      const k=p.path('kernel-'+j,points,{stroke:c,strokeWidth:.012,opacity:0,strokeEnd:0});kernels.push(k);
    });
    const trace=p.curve('rate',t=>[t,rate(r,t)],[0,4],321,{stroke:c,strokeWidth:.036,strokeEnd:0});traces.push(trace);
    // Map only the horizontal domain: vertical rates and row baselines stay fixed.
    p.map([s.time],([u,v],t)=>[u*(1-.8/2.325*layout(t)),v]);
    const m=s.circle('sample-'+r,{position:[x(selected,0),y+rateScale*rate(r,selected)],radius:.066,fill:c,opacity:0});
    s.bind(m,[s.time],t=>({position:[x(selected,t),y+rateScale*rate(r,selected)]}));markers.push(m);
    const e=s.latex('entry-'+r,{tex:'f_'+(r+1)+'(2)=\\animnum{r}',numbers:{r:rate(r,selected)},numberFormat:{decimals:2,digits:1},position:[3.1,y+.15],fontSize:.37,fill:c,opacity:0});entries.push(e);
  }
  const provenance=s.latex('synthetic',{tex:'\\mathsf{Synthetic\\ events}',fontSize:.28,position:[-3.4,3.1],fill:'GREY_B'});
  const timeAxis=s.line('time-axis',{points:[[-4.65,-2.95],[4.65,-2.95]],stroke:'GREY_C',strokeWidth:.012});
  s.bind(timeAxis,[s.time],t=>({points:[[x(0,t),-2.95],[x(4,t),-2.95]]}));
  for(const t of[0,1,2,3,4]){const label=s.latex('second-'+t,{tex:String(t),fontSize:.25,position:[x(t,0),-3.22],fill:'GREY_B'});s.bind(label,[s.time],v=>({position:[x(t,v),-3.22]}));}
  const seconds=s.latex('seconds',{tex:'t\\;[\\mathrm{s}]',fontSize:.3,position:[4.6,-3.57],fill:'GREY_B'});s.bind(seconds,[s.time],t=>({position:[x(4,t),-3.57]}));
  const equation=s.latex('kernel-definition',{tex:'f_i(t)=\\sum_j K_{0.13}(t-t_{ij})',fontSize:.34,position:[.9,3.1],fill:'GREY_A',opacity:0});
  s.bind(equation,[s.time],t=>({position:[.9-2.6*layout(t),3.1]}));
  const cursor=s.line('sample-cursor',{points:[[x(2,7),-2.8],[x(2,7),2.93]],stroke:'GREY',strokeWidth:.013,dashArray:[.065,.07],strokeEnd:0});
  const state=s.latex('state-units',{tex:'\\mathbf f(2)\\;[\\mathrm{s}^{-1}]',fontSize:.36,position:[3.1,3.05],opacity:0});
  const left=s.path('vector-left',{points:[[2.1,2.84],[1.96,2.84],[1.96,-2.54],[2.1,-2.54]],stroke:'WHITE',strokeWidth:.023,strokeEnd:0});
  const right=s.path('vector-right',{points:[[4.22,2.84],[4.36,2.84],[4.36,-2.54],[4.22,-2.54]],stroke:'WHITE',strokeWidth:.023,strokeEnd:0});
  s.wait(.55);
  s.play([...kernels.map(k=>k.animate({opacity:.44,strokeEnd:1})),equation.fadeIn()],{duration:.65});
  s.play(traces.map(t=>t.animate({strokeEnd:1})),{duration:1.7,ease:'linear'});
  s.play([...ticks.map(t=>t.fadeOut()),...kernels.map(k=>k.fadeOut()),provenance.fadeOut()],{duration:.5});
  s.wait(1.3);
  s.play([cursor.animate({strokeEnd:1}),...markers.map(m=>m.fadeIn())],{duration:.55});
  s.play([...entries.map(e=>e.fadeIn()),state.fadeIn(),left.animate({strokeEnd:1}),right.animate({strokeEnd:1})],{duration:.6});
  s.wait(1.65);
});
