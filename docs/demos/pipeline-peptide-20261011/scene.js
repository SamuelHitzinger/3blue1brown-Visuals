const __narration=(()=>{const data=JSON.parse("{\"audioAssetId\":\"subtitle-clock-beat-1\",\"endMode\":\"hold\",\"durationSec\":20.167,\"words\":{\"beat-1.u1.w1\":[0.4,0.9238095238095239],\"beat-1.u1.w2\":[0.9238095238095239,1.4476190476190478],\"beat-1.u1.w3\":[1.4476190476190478,1.9714285714285715],\"beat-1.u1.w4\":[1.9714285714285715,2.4952380952380953],\"beat-1.u1.w5\":[2.4952380952380953,3.019047619047619],\"beat-1.u1.w6\":[3.019047619047619,3.5428571428571427],\"beat-1.u1.w7\":[3.5428571428571427,4.066666666666666],\"beat-1.u2.w1\":[4.066666666666666,4.466666666666667],\"beat-1.u2.w2\":[4.466666666666667,4.866666666666666],\"beat-1.u2.w3\":[4.866666666666666,5.266666666666666],\"beat-1.u2.w4\":[5.266666666666666,5.666666666666666],\"beat-1.u2.w5\":[5.666666666666666,6.066666666666666],\"beat-1.u2.w6\":[6.066666666666666,6.466666666666666],\"beat-1.u2.w7\":[6.466666666666666,6.866666666666666],\"beat-1.u3.w1\":[6.866666666666666,7.311111111111111],\"beat-1.u3.w2\":[7.311111111111111,7.755555555555555],\"beat-1.u3.w3\":[7.755555555555555,8.2],\"beat-1.u3.w4\":[8.2,8.644444444444444],\"beat-1.u3.w5\":[8.644444444444444,9.088888888888889],\"beat-1.u3.w6\":[9.088888888888889,9.533333333333333],\"beat-1.u3.w7\":[9.533333333333333,9.977777777777778],\"beat-1.u3.w8\":[9.977777777777778,10.42222222222222],\"beat-1.u3.w9\":[10.42222222222222,10.866666666666667],\"beat-1.u3.w10\":[10.866666666666667,11.31111111111111],\"beat-1.u3.w11\":[11.31111111111111,11.755555555555555],\"beat-1.u3.w12\":[11.755555555555555,12.2],\"beat-1.u3.w13\":[12.2,12.95],\"beat-1.u3.w14\":[12.95,13.7],\"beat-1.u4.w1\":[13.7,14.233333333333333],\"beat-1.u4.w2\":[14.233333333333333,14.766666666666666],\"beat-1.u4.w3\":[14.766666666666666,15.299999999999999],\"beat-1.u4.w4\":[15.299999999999999,15.833333333333332],\"beat-1.u4.w5\":[15.833333333333332,16.275],\"beat-1.u4.w6\":[16.275,16.716666666666665],\"beat-1.u4.w7\":[16.716666666666665,17.15833333333333],\"beat-1.u4.w8\":[17.15833333333333,17.599999999999998],\"beat-1.u4.w9\":[17.599999999999998,18.041666666666664],\"beat-1.u4.w10\":[18.041666666666664,18.48333333333333],\"beat-1.u4.w11\":[18.48333333333333,18.924999999999997],\"beat-1.u4.w12\":[18.924999999999997,19.366666666666667]}}");const get=(id,index)=>{if(!Object.hasOwn(data.words,id))throw new Error('Unknown narration word ID: '+id);return data.words[id][index];};return Object.freeze({audioAssetId:data.audioAssetId,endMode:data.endMode,durationSec:data.durationSec,start:id=>get(id,0),end:id=>get(id,1)});})();
export default scene({mode:'3d',orbit:false,background:Color.BLACK,audio:__narration.audioAssetId,end:__narration.endMode},s=>{
  // Idealized explicit template, in model length units; not deposited coordinates.
  const start=__narration.start.bind(__narration),end=__narration.end.bind(__narration);
  const t0=start('beat-1.u3.w5'),t1=end('beat-1.u3.w12');
  let clock=0;
  const until=t=>{if(t>clock){s.wait(t-clock);clock=t;}};
  const play=(a,d)=>{s.play(a,{duration:d,ease:'smooth'});clock+=d;};
  const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]);
  const mul=(a,k)=>a.map(v=>v*k),dot=(a,b)=>a.reduce((v,x,i)=>v+x*b[i],0);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const norm=a=>Math.hypot(...a),unit=a=>mul(a,1/norm(a));
  const spec={residues:Array.from({length:6},(_,i)=>({id:'r'+i,component:'X'})),components:{X:{atoms:[
    {name:'N',position:[-1,1,0]},{name:'CA',position:[0,0,0]},
    {name:'C',position:[1.4,0,0]},{name:'O',position:[2,1,0]},
    {name:'CB',position:[0,0,1.3]}],bonds:[['N','CA'],['CA','C'],['C','O'],['CA','CB']]}},
    peptideLength:1.33,angleCA_C_N:2.0246,angleC_N_CA:2.1118};
  const poseAt=f=>s.peptidePose(spec,Array.from({length:6},(_,i)=>(-120+(i===2?60*f:0))*Math.PI/180),Array(6).fill(140*Math.PI/180));
  const samples=Array.from({length:13},(_,i)=>poseAt(i/12)),initial=samples[0],final=samples[12];
  // Returned ordering is residue order, then template atom order N, CA, C, O, CB.
  const ni=10,ci=11,qi=16,bi=17,index={};initial.atoms.forEach((a,i)=>index[a.id]=i);
  const moving=initial.atoms.map((a,i)=>norm(sub(final.atoms[i].position,a.position))>1e-7);
  const a=initial.atoms[ni].position,b=initial.atoms[ci].position,q=initial.atoms[qi].position;
  const u=unit(sub(b,a)),center=add(a,mul(u,dot(sub(q,a),u)));
  const radius=norm(sub(q,center)),e=unit(sub(q,center)),f=cross(u,e);
  const progress=t=>{const z=Math.max(0,Math.min(1,(t-t0)/(t1-t0)));return z*z*(3-2*z);};
  let lastTime=-1,lastPose;
  const pose=t=>{if(t!==lastTime){lastTime=t;lastPose=poseAt(progress(t));}return lastPose;};
  // Static oblique world basis and uniform scale, fitted once across every pose.
  const normal=unit(add(add(mul(unit(cross(u,e)),.8),mul(u,.5)),mul(e,.15)));
  const chain=sub(initial.atoms[26].position,initial.atoms[1].position);
  const right=unit(sub(chain,mul(normal,dot(chain,normal)))),up=unit(cross(normal,right));
  const project=p=>[dot(p,right),dot(p,up),dot(p,normal)];
  const all=samples.flatMap(p=>p.atoms.map(a=>project(a.position)));
  const lo=[0,1,2].map(k=>Math.min(...all.map(p=>p[k]))),hi=[0,1,2].map(k=>Math.max(...all.map(p=>p[k])));
  const mid=lo.map((v,k)=>(v+hi[k])/2),scale=Math.min(9/(hi[0]-lo[0]),4.1/(hi[1]-lo[1]));
  const world=p=>add(mul(sub(project(p),mid),scale),[0,.35,0]);
  const wp=samples.map(p=>p.atoms.map(a=>world(a.position)));
  s.play(s.camera.to3D({yaw:0,pitch:0,perspective:0,height:7.5,distance:35,target:[0,0,0]}),{duration:0});
  const length=(p,i,j)=>norm(sub(p.atoms[i].position,p.atoms[j].position));
  for(const sample of samples){
    if(JSON.stringify(sample.bonds)!==JSON.stringify(initial.bonds))throw Error('Connectivity changed');
    initial.bonds.forEach(edge=>{const i=index[edge[0]],j=index[edge[1]];if(Math.abs(length(sample,i,j)-length(initial,i,j))>1e-6)throw Error('Bond stretched');});
    moving.forEach((m,i)=>{if(!m&&norm(sub(sample.atoms[i].position,initial.atoms[i].position))>1e-6)throw Error('Fixed atom moved');});
    const r=sub(sample.atoms[qi].position,center);if(Math.abs(norm(r)-radius)>1e-6||Math.abs(dot(r,u))>1e-6)throw Error('Invalid circular locus');
  }
  const atomHandles=initial.atoms.map((atom,i)=>{
    const h=s.sphere('peptide-atom-'+i,{position:world(atom.position),radius:i===qi?.069:.054,fill:i===ni||i===ci?Color.TEAL:moving[i]?Color.ORANGE:Color.BLUE_D});
    if(moving[i])s.bind(h,[s.time],t=>({position:world(pose(t).atoms[i].position)}));return h;
  });
  let selectedBond;
  const bonds=initial.bonds.map((edge,k)=>{
    const i=index[edge[0]],j=index[edge[1]],hinge=(i===ni&&j===ci)||(j===ni&&i===ci);
    const h=s.line3D('peptide-bond-'+k,{points:[world(initial.atoms[i].position),world(initial.atoms[j].position)],stroke:hinge?Color.TEAL:moving[i]||moving[j]?Color.ORANGE:Color.BLUE_D,strokeWidth:hinge?.047:.026});
    s.connect(h,atomHandles[i],atomHandles[j],{endpoints:'surface'});
    if((i===qi&&j===bi)||(i===bi&&j===qi))selectedBond=h;return h;
  });
  s.group('peptide',[...atomHandles,...bonds]);
  const ghosts=[],ghostAtoms={};
  initial.atoms.forEach((atom,i)=>{
    if(moving[i]||i===ni||i===ci){const h=s.sphere('initial-atom-'+i,{position:world(atom.position),radius:.043,fill:Color.GREY_B,opacity:moving[i]?1:0});ghostAtoms[i]=h;ghosts.push(h);}
  });
  initial.bonds.forEach((edge,k)=>{
    const i=index[edge[0]],j=index[edge[1]];
    if(moving[i]||moving[j]){
      for(const n of [i,j])if(!ghostAtoms[n]){const h=s.sphere('initial-anchor-'+n,{position:world(initial.atoms[n].position),radius:.043,opacity:0});ghostAtoms[n]=h;ghosts.push(h);}
      const h=s.line3D('initial-bond-'+k,{points:[world(initial.atoms[i].position),world(initial.atoms[j].position)],stroke:Color.GREY_B,strokeWidth:.021});s.connect(h,ghostAtoms[i],ghostAtoms[j],{endpoints:'surface'});ghosts.push(h);
    }
  });
  const ghost=s.group('initial-branch',ghosts,{opacity:0});
  const occupied=[];
  function offsetFor(points,width){
    let best,bestScore=Infinity;
    for(const distance of [.65,.9,1.2])for(let k=0;k<16;k++){
      const angle=2*Math.PI*k/16,off=[distance*Math.cos(angle),distance*Math.sin(angle),4];let score=distance*.12;
      for(let t=0;t<points.length;t++){
        const c=add(points[t],off);
        if(Math.abs(c[0])+width/2>4.9||c[1]>2.75||c[1]<-2.35)score+=100;
        for(const p of wp[Math.min(t,12)]){const dx=Math.max(0,Math.abs(p[0]-c[0])-width/2),dy=Math.max(0,Math.abs(p[1]-c[1])-.19);score+=Math.max(0,.24-Math.hypot(dx,dy))*10;}
        for(const r of occupied)if(Math.abs(c[0]-r[0])<(width+r[2])/2+.12&&Math.abs(c[1]-r[1])<.46)score+=20;
      }
      if(score<bestScore){bestScore=score;best=off;}
    }
    occupied.push([...add(points[points.length-1],best).slice(0,2),width]);return best;
  }
  function label(id,tex,source,i,width,color){
    const offset=offsetFor(wp.map(p=>p[i]),width);
    const h=s.latex(id,{tex,fontSize:.36,fill:color});s.attach(h,source,{offset});
    const leader=s.line(id+'-leader',{stroke:color,strokeWidth:.012});s.connect(leader,h,source);
    return {h,leader};
  }
  const nLabel=label('hinge-N','\\mathrm{N}',atomHandles[ni],ni,.3,Color.TEAL);
  const cLabel=label('hinge-CA','\\mathrm{C}_{\\alpha}',atomHandles[ci],ci,.56,Color.TEAL);
  const hingeMid=mul(add(world(a),world(b)),.5),phiOffset=offsetFor(Array(13).fill(hingeMid),.35);
  const phi=s.latex('hinge-phi',{tex:'\\phi',position:add(hingeMid,phiOffset),fontSize:.38,fill:Color.TEAL});
  const phiLeader=s.line('phi-leader',{points:[add(hingeMid,mul(phiOffset,.65)),hingeMid],stroke:Color.TEAL,strokeWidth:.012});
  until(start('beat-1.u1.w3'));play([nLabel.h.fadeIn(),nLabel.leader.fadeIn(),cLabel.h.fadeIn(),cLabel.leader.fadeIn()],.4);
  until(start('beat-1.u1.w7'));play([phi.fadeIn(),phiLeader.fadeIn()],.35);
  until(start('beat-1.u2.w2'));play(ghost.animate({opacity:.22}),.5);
  until(start('beat-1.u3.w4'));
  const track=label('tracked-CA','\\mathrm{C}_{\\alpha}^{(3)}',atomHandles[qi],qi,.8,Color.ORANGE);
  const ring=s.circle('tracked-marker',{radius:.11,fill:Color.NONE,stroke:Color.ORANGE,strokeWidth:.018});s.attach(ring,atomHandles[qi],{offset:[0,0,.08]});
  play([track.h.fadeIn(),track.leader.fadeIn(),ring.fadeIn()],.35);
  until(t0);
  // Circle plane, radius, center and signed angular progress all derive from poses.
  const arcPoints=t=>{const current=sub(pose(t).atoms[qi].position,center),theta=Math.atan2(dot(current,f),dot(current,e));return Array.from({length:65},(_,i)=>{const angle=theta*i/64;return world(add(center,mul(add(mul(e,Math.cos(angle)),mul(f,Math.sin(angle))),radius)));});};
  const arc=s.path('tracked-arc',{points:arcPoints(t0),stroke:Color.ORANGE,strokeWidth:.022,fill:Color.NONE});s.bind(arc,[s.time],t=>({points:arcPoints(t)}));
  until(end('beat-1.u3.w10'));play([track.h.fadeOut(),track.leader.fadeOut()],.35);
  until(start('beat-1.u4.w1'));play(selectedBond.animate({stroke:Color.WHITE,strokeWidth:.045}),.4);
  until(start('beat-1.u4.w3'));
  const l0=length(initial,qi,bi).toFixed(2),l1=length(final,qi,bi).toFixed(2);
  const bondMid=mul(add(wp[12][qi],wp[12][bi]),.5),lengthOffset=offsetFor(Array(13).fill(bondMid),2.5);
  const mark=s.latex('bond-length-mark',{tex:'\\ell:\\;'+l0+'\\;\\longrightarrow\\;'+l1,position:add(bondMid,lengthOffset),fontSize:.32,fill:Color.WHITE});
  const markLeader=s.line('length-leader',{points:[add(bondMid,mul(lengthOffset,.72)),bondMid],stroke:Color.WHITE,strokeWidth:.012});
  play([mark.fadeIn(),markLeader.fadeIn()],.4);
  until(__narration.durationSec);
});