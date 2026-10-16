/** Offline instruction fixtures, not authored scenes or evidence of live readiness. */
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';

export type DetailPairId='line-sampling'|'saddle-mesh'|'caffeine-spheres';
export type DetailAxis='curveSamples'|'surfaceSegmentsPerAxis'|'sphereDetail';
export interface MolecularProvenance {
 dataFile:string; dataSha256:string;
 source:{url:string;sha256:string;[key:string]:unknown};
 formulaSource:{url:string;sha256:string;[key:string]:unknown};
 transformation:string; fidelity:string;
 hostContract:{schema:string;sourceCoordinates:string;[key:string]:unknown};
 [key:string]:unknown;
}
export interface DetailInvariants {
 subject:string; dimension:2|3; durationSeconds:number; readingHoldSeconds:number;
 claims:string[]; camera:string; motion:string; geometry:string; annotations:string;
 data:unknown; provenance?:MolecularProvenance;
}
export interface DetailVariant {id:string;detail:number;invariants:DetailInvariants;instruction:string}
export interface DetailPair {id:DetailPairId;axis:DetailAxis;low:DetailVariant;high:DetailVariant}
export interface DetailEvidenceContract {
 pairId:DetailPairId; axis:DetailAxis; invariantSha256:string;
 durationSeconds:number; readingHoldSeconds:number; sampleTimes:number[];
 variants:Record<'low'|'high',{id:string;expectedGeometry:Record<string,number>;maxCurveInterpolationError?:number}>;
 reviewRequired:string[]; limitation:string;
}
export type DetailOverrides=Partial<Record<DetailPairId,readonly [number,number]>>;
const specs={
 'line-sampling':{axis:'curveSamples',limits:[2,4096],defaults:[17,129]},
 'saddle-mesh':{axis:'surfaceSegmentsPerAxis',limits:[1,100],defaults:[10,40]},
 'caffeine-spheres':{axis:'sphereDetail',limits:[0,3],defaults:[0,2]},
} as const;
const hash=(bytes:string|Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
// Stable hashes survive JSON serialization and object key reordering in a runner.
function canonical(value:unknown):string {
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value!==null&&typeof value==='object')return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
 return JSON.stringify(value);
}
function detailClause(axis:DetailAxis,detail:number):string {
 switch(axis){
  case 'curveSamples':return `Visual detail only: draw the parabola as a polyline with exactly ${detail} uniformly spaced inclusive samples on [-2,2]. All other geometry, labels and motion remain fixed.`;
  case 'surfaceSegmentsPerAxis':return `Visual detail only: use exactly ${detail} by ${detail} surface cells (xSegments=ySegments=${detail}), smooth shading. Trace samples and all other geometry remain fixed.`;
  case 'sphereDetail':return `Visual detail only: use s.molecule detail:${detail} for every atom sphere. Atom selection, positions, radii, colors, all bonds and motion remain fixed.`;
 }
}
function instruction(invariants:DetailInvariants,axis:DetailAxis,detail:number):string {
 const i=invariants;
 return [
  `Controlled offline instruction fixture. Subject: ${i.subject}; required ${i.dimension}D. Exactly ${i.durationSeconds}s; final ${i.readingHoldSeconds}s reading hold.`,
  `Claims: ${i.claims.join(' ')}`,`Geometry: ${i.geometry}`,`Camera: ${i.camera}`,`Motion: ${i.motion}`,`Annotations: ${i.annotations}`,
  i.provenance?`Source: ${i.provenance.source.url}. ${i.provenance.fidelity} Host supplies read-only lexical DATA before compilation; do not redeclare DATA or reproduce its numeric arrays. ${i.provenance.hostContract.schema} ${i.provenance.hostContract.sourceCoordinates} Preserve raw source, host data SHA-256 and combined-source hash.`:`Supplied mathematical data: ${JSON.stringify(i.data)}`,
  detailClause(axis,detail),
 ].join('\n');
}

/** Builds fresh, non-aliasing records from tracked local public data. No network or model calls. */
export async function buildControlledDetailPairs(overrides:DetailOverrides={}):Promise<DetailPair[]> {
 for(const id of Object.keys(overrides))if(!(id in specs))throw Error(`Unknown detail pair: ${id}`);
 const fixtureURL=new URL('./caffeine-cid2519.fixture.json',import.meta.url);
 const dataURL=new URL('./caffeine-cid2519.data.json',import.meta.url);
 const [fixtureBytes,dataBytes]=await Promise.all([readFile(fixtureURL),readFile(dataURL)]);
 const receipt=JSON.parse(fixtureBytes.toString()) as MolecularProvenance;
 if(hash(dataBytes)!==receipt.dataSha256)throw Error('Tracked caffeine data hash mismatch');
 const provenance={...receipt,dataFile:fileURLToPath(dataURL),receiptSha256:hash(fixtureBytes)};
 const common={durationSeconds:8,readingHoldSeconds:2};
 const invariants:Record<DetailPairId,DetailInvariants>={
  'line-sampling':{
   ...common,subject:'algebra',dimension:2,
   claims:['The moving point satisfies y=x².','The ordinate shows the square of its x coordinate.'],
   data:{equation:'y=x*x',domain:[-2,2],xAxisRange:[-2.2,2.2],yAxisRange:[-.3,4.5]},
   camera:'Fixed 2D view with common x range [-2.2,2.2] and y range [-0.3,4.5]; no zoom or pan.',
   geometry:'One blue parabola y=x² on [-2,2], labeled x/y axes, a yellow moving point at exact (x,x²), and yellow vertical ordinate from (x,0) to (x,x²). Keep the entire curve visible. Use no extra curves.',
   motion:'x=-1 for 0–1s; x=-1+2*(t-1)/5 for 1–6s, with linear timing; x=1 for 6–8s. Point and ordinate follow the exact equation, not polyline interpolation.',
   annotations:'Keep y=x² beside the curve and x/y axis labels visible; keep a numeric x label attached to the moving point. Native numeric labels use s.latex with tex:"x=\\\\animnum{x}", numbers:{x:-1}, numberFormat:{digits:1,decimals:2}, then label.countTo({x:1}) over the same 1–6s linear interval. Move the label with the point. No additional explanatory steps.',
  },
  'saddle-mesh':{
   ...common,subject:'multivariable calculus',dimension:3,
   claims:['The x-direction trace z=(x²-c²)/2 curves upward at y=c.','The fixed y-direction trace z=-y²/2 curves downward at x=0.'],
   data:{equation:'z=(x*x-y*y)/2',xRange:[-1.6,1.6],yRange:[-1.6,1.6],traceSamples:129},
   camera:'Fixed 3D camera yaw=0.6, pitch=0.45, height=8; no camera motion.',
   geometry:'Teal smooth-shaded saddle z=(x²-y²)/2 on x,y∈[-1.6,1.6], opacity 0.7. Yellow moving x trace in plane y=c; blue fixed y trace at x=0. Each trace has exactly 129 inclusive uniform samples. Translucent yellow rectangular slicing plane y=c spans x,z∈[-1.6,1.6], opacity 0.12. Use x/y/z axes; retain both traces throughout.',
   motion:'c=-1 for 0–1s; c=-1+2*(t-1)/5 for 1–6s, with linear timing; c=1 for 6–8s. Update the moving trace and slicing plane together; every trace point uses the exact equation.',
   annotations:'Keep x/y/z labels, local formulas z=(x²-c²)/2 and z=-y²/2, and numeric c attached to the moving plane visible throughout. Native numeric labels use s.latex with tex:"c=\\\\animnum{c}", numbers:{c:-1}, numberFormat:{digits:1,decimals:2}, then label.countTo({c:1}) over the same 1–6s linear interval. Move the label with the plane.',
  },
  'caffeine-spheres':{
   ...common,subject:'organic chemistry',dimension:3,
   claims:['Caffeine has formula C8H10N4O2.','This is one computed 3D conformer, not molecular dynamics.'],
   data:JSON.parse(dataBytes.toString()),provenance,
   camera:'Fixed 3D camera yaw=0.6, pitch=0.45, height=10; no camera motion.',
   geometry:'Show all DATA.atoms (24, including 10 H) and all DATA.bonds (25) from the first frame. Subtract DATA.center, use uniform scale 1. Radius H=0.13 and C/N/O=0.22; C=GREY_B,H=WHITE,N=BLUE,O=RED. Use GREY_B bond sticks of width 0.045. Draw each double bond as two parallel sticks with total separation 0.12. Preserve all exact positions, IDs, endpoints and orders. Stable IDs atom-<PubChemID> and bond-<bondIndex>-<strokeIndex>.',
   motion:'Rigid rotation of the entire centered molecule around z: angle=0 for 0–1s; angle=0.45*(t-1)/5 radians for 1–6s, with linear timing; angle=0.45 for 6–8s. No atom reveal, deformation or invented atomic motion.',
   annotations:'Keep the local chemical formula C₈H₁₀N₄O₂ with correctly rendered subscripts, computed conformer label and compact element legend visible throughout. Maintain depth readability without hiding atoms or bonds.',
  },
 };
 return (Object.keys(specs) as DetailPairId[]).map(id=>{
  const {axis}=specs[id],[low,high]=overrides[id]??specs[id].defaults;
  const variant=(level:'low'|'high',detail:number):DetailVariant=>({id:`${id}-${level}`,detail,invariants:structuredClone(invariants[id]),instruction:instruction(invariants[id],axis,detail)});
  const pair={id,axis,low:variant('low',low),high:variant('high',high)};
  validateDetailPair(pair);return pair;
 });
}

/** Rejects instruction/contract confounds; this validates trial design, not generated-scene quality. */
export function validateDetailPair(pair:DetailPair):DetailEvidenceContract {
 const spec=specs[pair.id];
 if(!spec||pair.axis!==spec.axis)throw Error('Unknown or mismatched detail axis');
 for(const level of ['low','high'] as const){
  const v=pair[level];
  if(v.id!==`${pair.id}-${level}`||!Number.isInteger(v.detail)||v.detail<spec.limits[0]||v.detail>spec.limits[1])throw Error('Invalid detail variant');
  if(v.instruction!==instruction(v.invariants,pair.axis,v.detail))throw Error('Instruction differs from declared contract');
 }
 if(pair.low.detail>=pair.high.detail)throw Error('Higher detail must strictly exceed lower detail');
 if(!isDeepStrictEqual(pair.low.invariants,pair.high.invariants))throw Error('Pair differs outside allowed detail dimension');
 const i=pair.low.invariants;
 if(i.durationSeconds!==8||i.readingHoldSeconds!==2)throw Error('Invalid duration or reading hold');
 const evidence=(v:DetailVariant)=>{
  const expectedGeometry:Record<string,number>={[pair.axis]:v.detail};
  if(pair.id==='caffeine-spheres')Object.assign(expectedGeometry,{atoms:24,bonds:25,bondStrokes:29});
  return {id:v.id,expectedGeometry,...(pair.id==='line-sampling'?{maxCurveInterpolationError:(4/(v.detail-1))**2/4}:{})};
 };
 return {pairId:pair.id,axis:pair.axis,invariantSha256:hash(canonical(i)),durationSeconds:i.durationSeconds,readingHoldSeconds:i.readingHoldSeconds,
  sampleTimes:[0,1,2.5,3.5,5,6,8],variants:{low:evidence(pair.low),high:evidence(pair.high)},
  reviewRequired:['exact generated geometry and declared detail','claims, data, topology, camera and motion invariants','full-motion geometry and readability','separate curve interpolation error from mathematical point correctness'],
  limitation:'Offline controlled instruction contract only. Sampled frames do not prove full-motion quality, model reliability or live ten-second latency.'};
}
