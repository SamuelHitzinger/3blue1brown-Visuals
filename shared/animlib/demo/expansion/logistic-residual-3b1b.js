export default scene({background:'BLACK',end:'hold'},s=>{
  const clamp=x=>Math.max(0,Math.min(1,x));
  const weight=t=>.6+.8*clamp((t-2.7)/2.2);
  const prediction=(x,t)=>1/(1+Math.exp(-(weight(t)*x-2)));
  const p=s.plane('plot',{xRange:[-.65,4.65],yRange:[-.3,1.43],origin:[-4,-2.4],scale:[2,4.5],step:.25,grid:{stroke:'GREY_C',strokeWidth:.007,opacity:.18},ticks:false,axes:{stroke:'GREY_A',strokeWidth:.014}});
  for(const x of[0,1,2,3,4]){
    p.path('tick-x-'+x,[[x,-.012],[x,.012]],{stroke:'GREY_A',strokeWidth:.012});
    p.label('x-'+x,String(x),[x,0],[0,-.3],{fontSize:.26,fill:'GREY_A'});
  }
  for(const y of[.5,1]){
    p.path('tick-y-'+y,[[-.025,y],[.025,y]],{stroke:'GREY_A',strokeWidth:.012});
    p.label('y-'+y,String(y),[0,y],[-.35,0],{fontSize:.26,fill:'GREY_A'});
  }
  p.label('x-axis','x',[4.55,0],[0,-.27],{fontSize:.3});
  p.label('probability','p',[0,1.36],[-.3,0],{fontSize:.3});
  const data=[[.2,0],[.55,0],[.9,0],[1.35,0],[1.7,0],[2,1],[2.4,1],[2.8,1],[3.3,1],[3.8,1]];
  const samples=data.map(([x,y],i)=>s.circle('observation-'+i,{position:p.toWorld([x,y]),radius:.055,fill:y?'TEAL':'GREY_A'}));
  p.curve('initial',x=>[x,prediction(x,0)],[0,4.5],241,{stroke:'GREY_A',strokeWidth:.018,opacity:.2});
  const curve=p.curve('sigmoid',x=>[x,prediction(x,0)],[0,4.5],241,{stroke:'BLUE',strokeWidth:.035,strokeEnd:0});
  s.bind(curve,[s.time],t=>({points:Array.from({length:241},(_,i)=>p.toWorld([4.5*i/240,prediction(4.5*i/240,t)]))}));
  s.latex('model',{tex:'p_w(x)=\\sigma(wx-2)',position:[-2.6,.35],fontSize:.3,fill:'BLUE'});
  const w=s.latex('weight',{tex:'w=\\animnum{w}',numbers:{w:.6},numberFormat:{digits:1,decimals:1},position:[-2.8,-.22],fontSize:.35,fill:'YELLOW'});
  const guide=p.path('selected-x',[[2,0],[2,1]],{stroke:'GREY_A',strokeWidth:.012,opacity:0,dashArray:[.04,.07]});
  const pred=s.circle('prediction',{position:p.toWorld([2,prediction(2,0)]),radius:.075,fill:'YELLOW',opacity:0});
  s.bind(pred,[s.time],t=>({position:p.toWorld([2,prediction(2,t)])}));
  const predlabel=s.latex('prediction-label',{tex:'p_w(2)',position:[.6,-1],fontSize:.3,fill:'YELLOW',opacity:0});
  s.bind(predlabel,[s.time],t=>({position:[.62,-2.4+4.5*prediction(2,t)-.25]}));
  const observed=p.label('observed','y=1',[2,1],[0,.39],{fontSize:.3,fill:'TEAL',opacity:0});
  const residual=p.path('residual',[[2,prediction(2,0)],[2,1]],{stroke:'WHITE',strokeWidth:.027,dashArray:[.065,.065],strokeEnd:0});
  s.bind(residual,[s.time],t=>({points:[p.toWorld([2,prediction(2,t)]),p.toWorld([2,1])]}));
  const difference=s.latex('difference',{tex:'y-p',position:[-.75,.5],fontSize:.31,opacity:0});
  s.bind(difference,[s.time],t=>({position:[-.63,-2.4+2.25*(1+prediction(2,t))]}));
  const error=s.latex('squared-error',{tex:'(y-p)^2',position:[.38,3.17],fontSize:.36,opacity:0});
  const value=s.latex('error-value',{tex:'=\\animnum{e}',numbers:{e:(1-prediction(2,7))**2},numberFormat:{digits:1,decimals:3},position:[1.87,3.17],fontSize:.36,opacity:0});
  s.play(curve.animate({strokeEnd:1}),{duration:1,ease:'linear'});s.wait(.3);
  s.play([curve.animate({opacity:.65}),...samples.filter((_,i)=>i!==5).map(h=>h.animate({opacity:.25})),samples[5].animate({scale:1.5}),guide.animate({opacity:.3}),pred.fadeIn(),predlabel.fadeIn(),observed.fadeIn()],{duration:.6});
  s.play([residual.animate({strokeEnd:1}),difference.fadeIn()],{duration:.6});s.wait(.2);
  s.play(w.countTo({w:1.4}),{duration:2.2,ease:'linear'});
  s.play([error.fadeIn(),value.fadeIn()],{duration:.5});s.wait(1.6);
});
