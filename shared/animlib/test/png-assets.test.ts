import {expect,it} from 'vitest';
import {decodePNG} from '../tools/png-assets.mjs';
import {createRequire} from 'node:module';
const {PNG}=createRequire(import.meta.url)('pngjs');
const pixels=Buffer.from([12,47,193,255,241,92,3,127,19,201,117,0,87,66,41,255]);
const valid=()=>PNG.sync.write({width:2,height:2,data:pixels});
it('preserves exact RGBA rows and non-palette RGB without premultiplication',()=>{
 const image=decodePNG(valid());expect([image.width,image.height]).toEqual([2,2]);expect([...image.pixels]).toEqual([...pixels]);
});
it.each(['dimensions','bit-depth','interlace','CRC','truncation'])('rejects invalid PNG %s before returning pixels',kind=>{
 const b=valid();if(kind==='dimensions')b.writeUInt32BE(4097,16);if(kind==='bit-depth')b[24]=16;if(kind==='interlace')b[28]=1;if(kind==='CRC')b[29]^=1;
 expect(()=>decodePNG(kind==='truncation'?b.subarray(0,42):b)).toThrow();
});
