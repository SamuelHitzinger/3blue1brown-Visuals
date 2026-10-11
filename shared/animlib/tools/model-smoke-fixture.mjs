import { createCanvas } from '@napi-rs/canvas';
import { createHash } from 'node:crypto';
import { createModelGLB, parseModelGLB } from '../dist/core.js';

/** Tiny offline texture makes placeholder bounds visibly distinguishable from model rendering. */
export async function modelSmokeFixture() {
  const canvas=createCanvas(32,32),context=canvas.getContext('2d');
  for(const [i,color] of ['red','lime','blue','white'].entries()) {
    context.fillStyle=color;context.fillRect((i%2)*16,Math.floor(i/2)*16,16,16);
  }
  const bytes=await createModelGLB({parts:[{name:'Panel',unlit:true,
    vertices:[[-1,-1,0],[1,-1,0],[1,1,0],[-1,1,0]],triangles:[[0,1,2],[0,2,3]],
    uv:[[0,1],[1,1],[1,0],[0,0]],texture:{bytes:new Uint8Array(canvas.toBuffer('image/png')),mime:'image/png'},
  }]});
  const {metadata}=await parseModelGLB(bytes),sha256=createHash('sha256').update(bytes).digest('hex'),url=`/api/models/${sha256}.glb`;
  return {assets:{fixture:{kind:'model',url,sha256,metadata}},files:{[url]:Buffer.from(bytes).toString('base64')}};
}
