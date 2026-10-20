export default scene({mode:"3d",end:"hold",orbit:false,lighting:{ambient:1.15,directional:{intensity:.65}}},s=>{
  const phase=s.slider("phase",{reactive:true,label:"Source B phase",default:0,min:0,max:6.283185307179586});
  const amplitude=s.slider("amplitude",{reactive:true,label:"Source B amplitude",default:1,min:0,max:1.5});
  const wavelength=s.slider("wavelength",{reactive:true,label:"Wavelength",default:2.2,min:1.2,max:4});
  const xs=38,zs=26,extentX=4.4,extentZ=2.6;
  const grid=[],triangles=[];
  for(let j=0;j<=zs;j++)for(let i=0;i<=xs;i++)grid.push([-extentX+2*extentX*i/xs,0,-extentZ+2*extentZ*j/zs]);
  for(let j=0;j<zs;j++)for(let i=0;i<xs;i++){
    const a=j*(xs+1)+i,b=a+1,c=a+xs+1,d=c+1;
    triangles.push([a,c,b],[b,c,d]);
  }
  function parts(x,z,t,p,a,w){
    const r1=Math.hypot(x+2,z),r2=Math.hypot(x-2,z),k=2*Math.PI/w;
    return [.54*Math.cos(k*r1-1.7*t)/Math.sqrt(1+.15*r1),.54*a*Math.cos(k*r2-1.7*t+p)/Math.sqrt(1+.15*r2)];
  }
  function height(x,z,t,p,a,w){const v=parts(x,z,t,p,a,w);return v[0]+v[1];}
  const field=s.mesh("wave-field",{vertices:grid,triangles,fill:"TEAL_D",shading:"smooth",opacity:.8,
    material:{roughness:.48,metalness:.1}});
  s.bind(field,[s.time,phase,amplitude,wavelength],(t,p,a,w)=>({
    vertices:grid.map(v=>[v[0],height(v[0],v[2],t,p,a,w),v[2]])
  }));
  // Quiet mesh lines expose continuous deformation instead of hiding it in shading.
  for(let j=0;j<=12;j++){
    const z=-extentZ+2*extentZ*j/12;
    const line=s.path("grid-row-"+j,{points:Array.from({length:65},(_,i)=>[-extentX+2*extentX*i/64,0,z]),
      stroke:"TEAL_A",strokeWidth:.012,opacity:.28,fill:"none"});
    s.bind(line,[s.time,phase,amplitude,wavelength],(t,p,a,w)=>({
      points:Array.from({length:65},(_,i)=>{const x=-extentX+2*extentX*i/64;return [x,height(x,z,t,p,a,w)+.015,z];})
    }));
  }
  for(let i=0;i<=16;i++){
    const x=-extentX+2*extentX*i/16;
    const line=s.path("grid-col-"+i,{points:Array.from({length:41},(_,j)=>[x,0,-extentZ+2*extentZ*j/40]),
      stroke:"TEAL_A",strokeWidth:.012,opacity:.22,fill:"none"});
    s.bind(line,[s.time,phase,amplitude,wavelength],(t,p,a,w)=>({
      points:Array.from({length:41},(_,j)=>{const z=-extentZ+2*extentZ*j/40;return [x,height(x,z,t,p,a,w)+.015,z];})
    }));
  }
  s.line("center-reference",{points:[[0,0,-2.9],[0,0,2.9]],stroke:"GREY_B",strokeWidth:.018,opacity:.5});
  const cross=s.path("equal-distance",{points:Array.from({length:101},(_,i)=>[0,0,-2.6+5.2*i/100]),
    stroke:"WHITE",strokeWidth:.065,fill:"none"});
  s.bind(cross,[s.time,phase,amplitude,wavelength],(t,p,a,w)=>({
    points:Array.from({length:101},(_,i)=>{const z=-2.6+5.2*i/100;return [0,height(0,z,t,p,a,w)+.035,z];})
  }));
  const probe=s.sphere("probe",{radius:.09,fill:"WHITE",position:[0,0,2.15]});
  s.bind(probe,[s.time,phase,amplitude,wavelength],(t,p,a,w)=>({position:[0,height(0,2.15,t,p,a,w)+.07,2.15]}));
  for(const [id,x,color,text] of [["source-a",-2,"BLUE","A"],["source-b",2,"GOLD","B"]]){
    s.line(id+"-stem",{points:[[x,-.9,0],[x,1.45,0]],stroke:color,strokeWidth:.022,opacity:.7});
    const emitter=s.sphere(id,{position:[x,1.45,0],radius:.16,fill:color});
    s.text(id+"-label",{text,position:[x,1.9,0],fontSize:.33,fill:color,billboard:true});
    const ring=s.circle(id+"-ring",{radius:.32,rotation:[Math.PI/2,0,0],position:[x,0,0],fill:"none",stroke:color,strokeWidth:.035});
    s.bind(ring,[s.time,phase,amplitude,wavelength],(t,p,a,w)=>({position:[x,height(x,0,t,p,a,w)+.035,0]}));
  }
  s.text("distance-label",{text:"equal distance",position:[0,-.5,3.15],fontSize:.25,fill:"WHITE",billboard:true});
  s.text("phase-zero",{text:"A + B",position:[2.7,2.25,0],fontSize:.34,fill:"WHITE",billboard:true});
  s.text("phase-pi",{text:"A - B",position:[2.7,2.25,0],fontSize:.34,fill:"WHITE",billboard:true,opacity:0});
  s.wait(3600);
});
