export default scene({background:'BLACK',end:'hold'},s=>{
  // Primary synthetic timestamps retained; this proof adds documented weak fine events.
  const rows=[[.28,.44,.59,1.25,1.90,2,2.14,2.81,3.48],[.35,1.1,1.23,1.37,1.56,2.3,3.3,3.42],[.3,.91,1.71,1.83,1.95,2.1,2.24,2.91,3.61],[.5,.69,1.25,1.4,1.57,2.01,2.72,2.86,3.12],[.31,.85,1.37,1.92,2.03,2.2,2.67,2.77,3.26,3.35]];
  const colors=['RED','GREEN','PURPLE','YELLOW','BLUE'];
  const clamp=v=>Math.max(0,Math.min(1,v)),smooth=v=>{const u=clamp(v);return u*u*(3-2*u);};
  const layout=t=>smooth((t-.5)/1.1),time=t=>.3+3.4*clamp((t-2.4)/6.1);
  const x=(u,t)=>-4.45+u*(1.5-.57*layout(t));
  const entryX=t=>3.1-3.2*layout(t);
  const rowY=(r,t)=>2.25-r*1.15+layout(t)*(.48+r*.65),rateScale=t=>.075-.04*layout(t);
  const times=Array.from({length:321},(_,i)=>i/80);
  const kernel=(t,e,sigma)=>Math.exp(-.5*((t-e)/sigma)**2)/(sigma*Math.sqrt(2*Math.PI));
  const fine=rows.map((_,r)=>Array.from({length:39},(_,j)=>[.10+.10*j+.023*Math.sin(j*(1.3+r*.1)+r),.045+.035*((j*7+r*3)%5)/4]));
  const values=times.map(t=>rows.map((events,r)=>events.reduce((sum,e)=>sum+.85*kernel(t,e,.13)+.15*kernel(t,e,.035),0)+fine[r].reduce((sum,[e,w])=>sum+w*kernel(t,e,.04),0)));
  const data=s.sampledState({times,values,projection:[[.2,0,0,0,0],[0,.2,0,0,0],[0,0,0,0,.2]]});
  const state=t=>data.at(time(t));
  const entries=[];
  for(let r=0;r<5;r++){
    const y=2.25-r*1.15,c=colors[r];
    const full=s.path('full-'+r,{points:times.map((u,i)=>[x(u,0),y+.075*values[i][r]]),stroke:c,strokeWidth:.011,opacity:.19});
    s.bind(full,[s.time],t=>({points:times.map((u,i)=>[x(u,t),rowY(r,t)+rateScale(t)*values[i][r]])}));
    const trace=s.path('trace-'+r,{points:times.map(()=>[x(0,0),y]),stroke:c,strokeWidth:.020});
    s.bind(trace,[s.time],t=>{const v=state(t).values[r];return{points:times.map((u,i)=>u<=time(t)?[x(u,t),rowY(r,t)+rateScale(t)*values[i][r]]:[x(time(t),t),rowY(r,t)+rateScale(t)*v])};});
    const axis=s.line('row-axis-'+r,{points:[[x(0,0),y-.08],[x(4,0),y-.08]],stroke:'GREY_C',strokeWidth:.009,opacity:.55});
    s.bind(axis,[s.time],t=>({points:[[x(0,t),rowY(r,t)-.04],[x(4,t),rowY(r,t)-.04]]}));
    const marker=s.circle('sample-'+r,{radius:.04,fill:c,position:[x(.3,0),y]});
    s.bind(marker,[s.time],t=>({position:[x(time(t),t),rowY(r,t)+rateScale(t)*state(t).values[r]]}));
    const entry=s.latex('entry-'+r,{tex:'f_'+(r+1)+'=\\animnum{r}',numbers:{r:state(0).values[r]},numberFormat:{decimals:2,digits:2},position:[3.1,y+.17],fontSize:.3,fill:c});
    s.bind(entry,[s.time],t=>({position:[entryX(t),rowY(r,t)+.10],scale:1-.32*layout(t)}));entries.push(entry);
  }
  const cursor=s.line('cursor',{points:[[x(.3,0),-2.68],[x(.3,0),3.0]],stroke:'GREY',strokeWidth:.012,dashArray:[.06,.08]});
  s.bind(cursor,[s.time],t=>({points:[[x(time(t),t),rowY(4,t)-.14],[x(time(t),t),rowY(0,t)+.65]]}));
  const clock=s.latex('clock',{tex:'t=\\animnum{t}\\,\\mathrm{s}',numbers:{t:.3},numberFormat:{decimals:2,digits:1},position:[-3,-3.0],fontSize:.3,fill:'GREY_A'});

  s.bind(clock,[s.time],t=>({position:[-3,-3+3.38*layout(t)],scale:1-.16*layout(t)}));
  s.latex('synthetic',{tex:'\\mathsf{Synthetic\\ rates}',position:[-3.1,3.45],fontSize:.24,fill:'GREY_B'});
  const unit=s.latex('units',{tex:'\\mathbf f(t)\\;[\\mathrm{s}^{-1}]',position:[3.1,3.3],fontSize:.32});
  s.bind(unit,[s.time],t=>({position:[entryX(t),3.3],scale:1-.28*layout(t)}));
  for(const side of[-1,1]){
    const b=s.path('bracket-'+side,{points:[[0,0],[0,0],[0,0],[0,0]],stroke:'WHITE',strokeWidth:.018});
    s.bind(b,[s.time],t=>{const center=entryX(t),edge=center+side*(.92-.32*layout(t)),top=rowY(0,t)+.45,bottom=rowY(4,t)-.22;return{points:[[edge-side*.1,top],[edge,top],[edge,bottom],[edge-side*.1,bottom]]};});
  }
  const formula=s.latex('projection',{tex:'\\mathbf p(t)=\\frac{1}{5}(f_1,f_2,f_5)',position:[2.8,3.0],fontSize:.34,opacity:0});
  const projectionLabel=s.latex('projection-label',{tex:'\\mathsf{Fixed\\ 3D\\ projection}',position:[2.8,3.5],fontSize:.25,fill:'GREY_B',opacity:0});
  const timeColors=['PURPLE_E','PURPLE_D','PURPLE_C','PURPLE_B','BLUE_E','BLUE_D','BLUE_C','BLUE_A'];
  const legend=timeColors.map((c,i)=>s.line('time-color-'+i,{points:[[2.05+i*.15,2.42],[2.2+i*.15,2.42]],stroke:c,strokeWidth:.025,opacity:0}));
  legend.push(s.latex('time-color-label',{tex:'t\\;\\longrightarrow',position:[3.7,2.42],fontSize:.23,fill:'GREY_B',opacity:0}));
  let spatial=[],guides=[],head,viewCamera;
  s.view('state-space',{rect:[.17,.25,.82,.74],camera:{height:3.55,target:[.8,.75,.8],yaw:.72,pitch:.4,perspective:.12,distance:12}},v=>{
    viewCamera=v.camera;
    for(let k=0;k<3;k++){
      const end=[0,0,0];end[k]=2.15;
      const axis=v.arrow3D('axis-'+k,{points:[[0,0,0],end],stroke:'GREY_B',strokeWidth:.018,opacity:0});spatial.push(axis);
      for(let n=1;n<=8;n++){
        const a=[0,0,0],b=[0,0,0];a[k]=b[k]=n*.25;a[(k+1)%3]=-.025;b[(k+1)%3]=.025;
        spatial.push(v.line3D('tick-'+k+'-'+n,{points:[a,b],stroke:'GREY_B',strokeWidth:.012,opacity:0}));
      }
      const label=[...end];label[k]+=.17;
      spatial.push(v.latex('spatial-label-'+k,{tex:['f_1/5','f_2/5','f_5/5'][k],position:label,fontSize:.18,fill:[colors[0],colors[1],colors[4]][k],billboard:true,billboardOffset:k===1?[.38,0,0]:[0,0,0],opacity:0}));
    }
    // Contiguous time bins use duplicated boundary samples, never a false bridge.
    for(let i=0;i<8;i++){
      const first=i*40,last=first+40;
      const trail=v.path('trajectory-'+i,{points:data.prefix(0,.3).slice(first,last+1),stroke:timeColors[i],strokeWidth:.018,strokeProfile:'round',opacity:0});
      v.bind(trail,[v.time],t=>({points:data.prefix(0,time(t)).slice(first,last+1),opacity:time(t)>=times[first]?smooth((t-2.4)/.2):0}));
    }
    head=v.sphere('state-point',{position:state(0).position,radius:.044,fill:'WHITE',opacity:0});
    v.bind(head,[v.time],t=>({position:state(t).position}));

    for(let k=0;k<3;k++){
      const guide=v.line3D('component-'+k,{points:[[0,0,0],[0,0,0]],stroke:[colors[0],colors[1],colors[4]][k],strokeWidth:.014,opacity:0});
      v.bind(guide,[v.time],t=>{const p=state(t).position;const a=p.map((n,i)=>i<k?n:0),b=p.map((n,i)=>i<=k?n:0);return{points:[a,b]};});guides.push(guide);
    }




  });
  s.wait(1.6);s.play([formula.fadeIn(),projectionLabel.fadeIn(),...legend.map(h=>h.fadeIn()),...spatial.map(h=>h.fadeIn())],{duration:.35});
  s.play([...guides.map(h=>h.fadeIn()),head.fadeIn()],{duration:.45});
  for(let i=25;i<=296;i++)s.play([...entries.map((h,r)=>h.countTo({r:values[i][r]})),clock.countTo({t:times[i]}),viewCamera.animate({yaw:.72+.60*smooth((i-24)/272),pitch:.4+.18*smooth((i-24)/272)})],{duration:6.1/272,ease:'linear'});
  s.wait(1);
});
