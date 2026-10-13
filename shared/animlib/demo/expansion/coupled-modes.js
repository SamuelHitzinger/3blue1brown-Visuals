// Original supplied-mode construction: m=1, k=1, kc=1.5, omega+=(1), omega-=(2).
export default scene({background:Color.BLACK,end:'hold',orbit:false}, s => {
  const modes=s.modalState({modes:[
    {shape:[1,1],amplitude:.4,angularFrequency:1},
    {shape:[1,-1],amplitude:.4,angularFrequency:2}
  ]});
  const phase=t=>Math.PI*Math.max(0,Math.min(1,(t-1.4)/5));
  const state=t=>modes.at(phase(t));
  const centers=[-2,2];
  const rows=[{id:'symmetric',y:2.15,color:Color.TEAL,mode:0},
    {id:'antisymmetric',y:.2,color:Color.ORANGE,mode:1},
    {id:'sum',y:-1.75,color:Color.WHITE,mode:-1}];

  // Quiet equilibrium guides link the same physical coordinates through all rows.
  centers.forEach((x,i)=>s.line('equilibrium-'+i,{
    points:[[x,2.55],[x,-2.7]],stroke:Color.GREY_B,strokeWidth:.009,opacity:.25
  }));
  const displacement=(row,i,t)=>row.mode<0?state(t).displacement[i]:state(t).contributions[row.mode][i];
  function spring(a,b,y){
    const count=48,lead=.15;
    return Array.from({length:count+1},(_,i)=>{
      const u=i/count;
      const envelope=Math.min(1,u/lead,(1-u)/lead);
      return [a+(b-a)*u,y+.095*Math.sin(12*Math.PI*u)*Math.max(0,envelope)];
    });
  }
  for(const row of rows){
    const moving=i=>t=>centers[i]+displacement(row,i,t);
    const x0=moving(0),x1=moving(1);
    [-4.45,4.45].forEach((x,i)=>{
      s.line(row.id+'-wall-'+i,{points:[[x,row.y-.27],[x,row.y+.27]],stroke:Color.GREY_B,strokeWidth:.024});
      for(let j=0;j<4;j++)s.line(row.id+'-hatch-'+i+'-'+j,{points:[[x,row.y-.21+j*.14],[x+(i?.12:-.12),row.y-.3+j*.14]],stroke:Color.GREY_B,strokeWidth:.012});
    });
    const endpoints=[t=>[-4.45,x0(t)-.22],t=>[x0(t)+.22,x1(t)-.22],t=>[x1(t)+.22,4.45]];
    endpoints.forEach((ends,i)=>{
      const shape=s.path(row.id+'-spring-'+i,{points:spring(...ends(0),row.y),stroke:row.color,strokeWidth:row.mode<0?.023:.016,opacity:row.mode<0?.8:.4});
      s.bind(shape,[s.time],t=>({points:spring(...ends(t),row.y)}));
    });
    centers.forEach((center,i)=>{
      s.circle(row.id+'-ghost-'+i,{position:[center,row.y],radius:.22,fill:Color.NONE,stroke:row.color,strokeWidth:.012,opacity:.2});
      const body=s.circle(row.id+'-mass-'+i,{position:[center+displacement(row,i,0),row.y],radius:.22,fill:row.color,stroke:Color.NONE});
      s.bind(body,[s.time],t=>({position:[center+displacement(row,i,t),row.y]}));
      const arrow=s.arrow(row.id+'-displacement-'+i,{points:[[center,row.y-.4],[center+displacement(row,i,0),row.y-.4]],stroke:row.color,strokeWidth:.028});
      s.bind(arrow,[s.time],t=>({points:[[center,row.y-.4],[center+displacement(row,i,t),row.y-.4]]}));
    });
  }

  s.latex('symmetric-name',{tex:'q_+(\\tau)\\,(1,1)',position:[0,2.9],fontSize:.31,fill:Color.TEAL});
  s.latex('symmetric-rule',{tex:'q_+=0.4\\cos\\tau',position:[0,1.62],fontSize:.24,fill:Color.TEAL});
  s.latex('antisymmetric-name',{tex:'q_-(\\tau)\\,(1,-1)',position:[0,.95],fontSize:.31,fill:Color.ORANGE});
  s.latex('antisymmetric-rule',{tex:'q_-=0.4\\cos(2\\tau)',position:[0,-.33],fontSize:.24,fill:Color.ORANGE});

  // Head-to-tail component addition remains attached to each resulting mass.
  centers.forEach((center,i)=>{
    const y=-2.45;
    const endpoints=t=>{
      const parts=state(t).contributions;
      return [center,center+parts[0][i],center+parts[0][i]+parts[1][i]];
    };
    const first=s.arrow('addition-a-'+i,{points:[[center,y],[endpoints(0)[1],y]],stroke:Color.TEAL,strokeWidth:.035});
    const second=s.arrow('addition-b-'+i,{points:[[endpoints(0)[1],y],[endpoints(0)[2],y]],stroke:Color.ORANGE,strokeWidth:.035});
    const correspondence=s.line('sum-correspondence-'+i,{points:[[endpoints(0)[2],y],[endpoints(0)[2],-1.97]],stroke:Color.GREY_B,strokeWidth:.01,opacity:.5});
    s.bind(first,[s.time],t=>({points:[[endpoints(t)[0],y],[endpoints(t)[1],y]]}));
    s.bind(second,[s.time],t=>({points:[[endpoints(t)[1],y],[endpoints(t)[2],y]]}));
    s.bind(correspondence,[s.time],t=>({points:[[endpoints(t)[2],y],[endpoints(t)[2],-1.97]]}));
    s.latex('sum-label-'+i,{tex:i?'x_2=q_+-q_-':'x_1=q_++q_-',position:[center,-3.04],fontSize:.27});
  });
  s.wait(8);
});
