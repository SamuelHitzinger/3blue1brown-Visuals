/** Offline authored torsion staging. This is inverse kinematics, not folding physics. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createPeptideBuilders} from '../dist/peptide-motion.js';

const rig=JSON.parse(await readFile(resolve('shared/animlib/fixtures/biological/illustrative-peptide/rig.json'),'utf8'));
const output=resolve('shared/animlib/fixtures/biological/peptide-staged');await mkdir(output,{recursive:true});
const api=createPeptideBuilders(),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]);
const unit=a=>{const d=Math.hypot(...a);return a.map(v=>v/d);},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const geometry=angles=>api.peptidePose(rig.spec,...['phi','psi'].map(key=>angles[key].map(v=>Math.atan2(Math.sin(v),Math.cos(v)))));
function frame(pose){
  const a=pose.anchors.map(a=>a.position),center=a.slice(0,12).reduce((s,p)=>s.map((v,k)=>v+p[k]/12),[0,0,0]);
  const x=unit(sub(a[10],a[1])),y=unit(sub([0,1,0],x.map(v=>v*x[1]))),z=cross(x,y);
  return {center,basis:[x,y,z]};
}
const aligned=(p,f)=>f.basis.map(a=>dot(sub(p,f.center),a));
function linearSolve(a,b){
  const n=b.length,m=a.map((r,i)=>[...r,b[i]]);
  for(let k=0;k<n;k++){let pivot=k;for(let i=k+1;i<n;i++)if(Math.abs(m[i][k])>Math.abs(m[pivot][k]))pivot=i;[m[k],m[pivot]]=[m[pivot],m[k]];const q=m[k][k];if(Math.abs(q)<1e-12)return Array(n).fill(0);for(let j=k;j<=n;j++)m[k][j]/=q;for(let i=0;i<n;i++)if(i!==k){const q=m[i][k];for(let j=k;j<=n;j++)m[i][j]-=q*m[k][j];}}
  return m.map(r=>r[n]);
}
let angles=structuredClone(rig.extended);const samples=[],start=performance.now();
const steps=240,iterations=160;
for(let step=0;step<=steps;step++){
  const progress=(step/steps)**2;
  for(let i=0;i<72;i++)if(i%20<12)for(const [key,a,b]of [['phi',-120,-60],['psi',130,-45]]){
    // These boundary torsions belong to the orienting loop. Preserve their warm
    // starts: resetting either one makes equivalent IK solutions jump between
    // adjacent keyframes even when the desired helix motion barely changes.
    if(key==='phi'&&i>0&&i%20===0||key==='psi'&&i<60&&i%20===11)continue;
    angles[key][i]=(a+(b-a)*progress)*Math.PI/180;
  }
  const pose=geometry(angles),f=frame(pose),template=pose.anchors.slice(0,12).map(a=>aligned(a.position,f));
  const errors=[];
  for(let block=1;block<4;block++){
    const start=block*20,variables=[['psi',start-9]];
    for(let i=start-8;i<start;i++)variables.push(['phi',i],['psi',i]);variables.push(['phi',start]);
    const direction=block%2?-1:1,selected=Array.from({length:12},(_,i)=>i);
    const target=selected.flatMap(j=>[template[j][0]*direction,template[j][1]*direction+block*10,template[j][2]]);
    const evaluate=values=>{const p=geometry(values);return selected.flatMap(j=>aligned(p.anchors[start+j].position,f));};
    let current=evaluate(angles),cost=current.reduce((s,v,i)=>s+(v-target[i])**2,0),damping=.08;
    for(let it=0;it<iterations&&cost>1e-7;it++){
      const epsilon=1e-4,columns=variables.map(([key,index])=>{angles[key][index]+=epsilon;const p=evaluate(angles);angles[key][index]-=epsilon;return p.map((v,i)=>(v-current[i])/epsilon);});
      const matrix=columns.map((c,i)=>columns.map((d,j)=>dot(c,d)+(i===j?damping:0)));
      const error=target.map((v,i)=>v-current[i]),delta=linearSolve(matrix,columns.map(c=>dot(c,error))),scale=Math.min(1,.3/Math.max(...delta.map(Math.abs)));
      const candidate=structuredClone(angles);variables.forEach(([key,index],j)=>candidate[key][index]+=delta[j]*scale);
      const next=evaluate(candidate),nextCost=next.reduce((s,v,i)=>s+(v-target[i])**2,0);
      if(nextCost<cost){angles=candidate;current=next;cost=nextCost;damping=Math.max(.0001,damping*.75);}else damping=Math.min(1000,damping*4);
    }
    errors.push(Math.sqrt(cost/selected.length));
  }
  if(Math.max(...errors)>.001)throw Error('Side-view staging did not converge');
  samples.push({progress,angles:structuredClone(angles),frame:f,errors});
}
await writeFile(join(output,'staging.json'),JSON.stringify({provenance:'Original deterministic inverse-kinematic staging of idealized peptide. Stable side-view helix layout; not a physical trajectory.',samples},null,2));
console.log(JSON.stringify({samples:samples.length,maxTargetRMSError:Math.max(...samples.flatMap(s=>s.errors)),elapsedMs:performance.now()-start}));
