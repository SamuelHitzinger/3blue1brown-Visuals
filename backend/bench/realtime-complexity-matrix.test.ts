import {expect,test} from 'bun:test';
import {matrixArms,matrixSampleTimes} from './realtime-complexity-matrix.js';

test('legacy matched manifests retain two arms while a frozen single-arm screen stays single-arm',()=>{
 expect(matrixArms({})).toEqual(['baseline','candidate']);
 expect(matrixArms({arms:['baseline']})).toEqual(['baseline']);
 for(const arms of [[],['baseline','baseline'],['../escape'],null,'baseline'])expect(()=>matrixArms({arms})).toThrow();
});

test('under-length outputs can be inspected without stretching or out-of-range sampling',()=>{
 expect(matrixSampleTimes(6)).toEqual([0,1,3,5,6]);
 expect(matrixSampleTimes(6.05)).toEqual([0,1,3,5,6,6.05]);
 expect(matrixSampleTimes(8)).toEqual([0,1,3,5,6,8]);
 for(const duration of [0,-1,NaN,Infinity,31])expect(()=>matrixSampleTimes(duration)).toThrow();
});
