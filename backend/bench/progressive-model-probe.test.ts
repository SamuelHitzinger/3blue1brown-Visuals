import {expect,test} from 'bun:test';
import type {ElementState,Frame} from '../../shared/animlib/src/types.js';
import {assertMoleculeAddition} from './progressive-model-probe.js';

const element=(id:string,geometry:ElementState['geometry'],position:ElementState['position']=[0,0,0]):ElementState=>({
 id,geometry,position,rotation:[0,0,0],scale:1,opacity:1,fill:'WHITE',stroke:'none',strokeWidth:.04,space:'world',persistent:false,
});
const frame=(elements:ElementState[]):Frame=>({elements,camera:{yaw:0,pitch:0,target:[0,0,0],height:8,distance:12,perspective:0},cameraAnimated:false,views:[]});
// Saved run progressive-model-01: A at x=1/r=.5, C0 at x=1.1/r=.12.
// The complete ring used R=1.1, outward hydrogens R=1.62, all at z=0.
function capturedPlacement(round=true){
 const before=frame([element('cube',{kind:'sphere',radius:.5},[1,0,0])]);
 const atoms=Array.from({length:12},(_,i)=>{const a=(i%6)*Math.PI/3,r=i<6?1.1:1.62;
  return element(`atom-${i}`,{kind:'sphere',radius:i<6?.12:.08},[r*Math.cos(a),r*Math.sin(a),0]);});
 const bonds=Array.from({length:15},(_,i)=>({...element(`bond-${i}`,{kind:'line',points:[[0,0,0],[1,0,0]]}),...(round?{strokeProfile:'round' as const}:{})}));
 return {before,after:frame([...structuredClone(before.elements),...atoms,...bonds])};
}
function separate(after:Frame){for(const e of after.elements)if(e.id!=='cube')e.position[0]+=5;}

test('rejects captured atom overlap with retained A',()=>{
 const {before,after}=capturedPlacement();
 expect(()=>assertMoleculeAddition(before,after,'cube')).toThrow(/atom-0 overlaps retained sphere cube/);
});
test('accepts separated atoms and round spatial bonds',()=>{
 const {before,after}=capturedPlacement();separate(after);
 expect(()=>assertMoleculeAddition(before,after,'cube')).not.toThrow();
});
test('rejects captured flat strokes despite correct atom placement',()=>{
 const {before,after}=capturedPlacement(false);separate(after);
 expect(()=>assertMoleculeAddition(before,after,'cube')).toThrow(/round spatial bonds/);
});
test('accounts for group translation instead of comparing local atom positions',()=>{
 const {before,after}=capturedPlacement();
 after.elements.push(element('molecule-group',{kind:'group',children:after.elements.filter(e=>e.id!=='cube').map(e=>e.id)},[5,0,0]));
 expect(()=>assertMoleculeAddition(before,after,'cube')).not.toThrow();
});
