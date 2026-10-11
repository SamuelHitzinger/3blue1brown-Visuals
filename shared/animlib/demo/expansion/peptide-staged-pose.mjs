/** Absolute-time authored pose; every displayed atom comes from peptidePose. */
export function createStagedPeptideSampler(api,rig,keyframes){
  const smooth=(t,a,d)=>{const u=Math.max(0,Math.min(1,(t-a)/d));return u*u*(3-2*u);};
  const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]);
  const unit=a=>{const d=Math.hypot(...a);return a.map(v=>v/d);},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const variables=[];for(let block=1;block<4;block++){const start=block*20;variables.push(['psi',start-9]);for(let i=start-8;i<start;i++)variables.push(['phi',i],['psi',i]);variables.push(['phi',start]);}
  const expand=(progress,values)=>{const angles={phi:Array(72).fill((-120+60*progress)*Math.PI/180),psi:Array(72).fill((130-175*progress)*Math.PI/180)};variables.forEach(([key,index],i)=>angles[key][index]=values[i]);return angles;};
  const lastAngles=expand(1,keyframes[keyframes.length-1].values);
  return t=>{
    const progress=smooth(t,.4,2.7);let hi=1;while(hi<keyframes.length-1&&keyframes[hi].progress<progress)hi++;
    const a=keyframes[hi-1],b=keyframes[hi],u=(progress-a.progress)/(b.progress-a.progress);
    const values=a.values.map((v,i)=>v+(b.values[i]-v)*u),formation=expand(progress,values),packing=smooth(t,4.2,2.4),angles={};
    for(const key of ['phi','psi'])angles[key]=formation[key].map((value,i)=>{
      const last=lastAngles[key][i];
      const delta=Math.atan2(Math.sin(rig.compact[key][i]-last),Math.cos(rig.compact[key][i]-last));
      const x=value+delta*packing;return Math.atan2(Math.sin(x),Math.cos(x));
    });
    const pose=api.peptidePose(rig.spec,angles.phi,angles.psi),x=unit(sub(pose.anchors[10].position,pose.anchors[1].position)),y=unit(sub([0,1,0],x.map(v=>v*x[1]))),basis=[x,y,cross(x,y)],center=pose.center;
    const transform=p=>basis.map(a=>dot(sub(p,center),a));
    for(const atom of pose.atoms)atom.position=transform(atom.position);
    for(const anchor of pose.anchors)anchor.position=transform(anchor.position);
    pose.center=[0,0,0];return {pose,basis,angles};
  };
}
