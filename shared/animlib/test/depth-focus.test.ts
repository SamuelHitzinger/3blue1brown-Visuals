import {expect,it} from 'vitest';
import {apertureSamples,focusShift,normalizeFocus,focusPreflight,FocusBudgetError} from '../src/depth-focus.js';
import {GLDepthFocus} from '../src/gl-depth-focus.js';

it('keeps a focal plane fixed while nearer and farther geometry shifts in opposite directions',()=>{
  expect(focusShift(10,10,[.5,.25])).toEqual([0,0]);
  expect(focusShift(5,10,[.5,.25])).toEqual([-.25,-.125]);
  expect(focusShift(20,10,[.5,.25])).toEqual([.5,.25]);
  expect(focusShift(5,5,[.5,.25])).toEqual([0,0]);
});
it('uses deterministic centered equal-weight disk samples',()=>{
  for(const n of [8,16,32] as const){const a=apertureSamples(n);expect(a).toEqual(apertureSamples(n));expect(a).toHaveLength(n);
    expect(a.reduce((s,p)=>s+p[0],0)).toBeCloseTo(0,12);expect(a.reduce((s,p)=>s+p[1],0)).toBeCloseTo(0,12);
    expect(a.every(p=>Math.hypot(...p)<=1)).toBe(true);expect(a.some(p=>Math.hypot(...p)>.9)).toBe(true);
  }
});
it('validates raw focus data, defaults quality, and preserves the disabled path',()=>{
  expect(normalizeFocus(undefined)).toBeUndefined();expect(normalizeFocus({distance:10,aperture:0})).toEqual({distance:10,aperture:0,samples:16});
  for(const value of [{distance:0,aperture:1},{distance:10,aperture:-1},{distance:Infinity,aperture:1},{distance:10,aperture:NaN},{distance:10,aperture:1,samples:9}])expect(()=>normalizeFocus(value)).toThrow();
});
it('rejects oversized focus before resource work and counts independent views',()=>{
  expect(focusPreflight(1280,720,[{samples:16,vertices:1000}]).bytes).toBe(1280*720*44);
  expect(()=>focusPreflight(8192,8192,[{samples:8,vertices:1}])).toThrow(FocusBudgetError);
  expect(()=>focusPreflight(1280,720,[{samples:32,vertices:2_000_000}])).toThrow(FocusBudgetError);
  expect(()=>focusPreflight(1920,1080,[{samples:32,vertices:1},{samples:32,vertices:1}])).toThrow(FocusBudgetError);
  expect(()=>focusPreflight(128,128,[{samples:32,vertices:100,draws:2001}])).toThrow('draw submissions');
  expect(focusPreflight(8192,8192,[]).bytes).toBe(0);
});
it('rejects missing half-float support before touching framebuffer resources',()=>{
 expect(()=>GLDepthFocus.validate({getExtension:()=>null} as unknown as WebGL2RenderingContext)).toThrow(FocusBudgetError);
});
