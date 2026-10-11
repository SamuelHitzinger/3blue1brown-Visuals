import {it,expect} from 'vitest';
import {compileSource} from '../src/compiler.js';
import {evaluateScene} from '../src/timeline.js';
const source=(body:string)=>`export default scene({mode:'3d'},s=>{${body}});`;
it('animates optical distance and aperture smoothly, with deterministic backwards seek',async()=>{
 const scene=await compileSource(source(`s.play(s.camera.animate({focus:{distance:12,aperture:0}}),{duration:0});s.play(s.camera.animate({focus:{distance:24,aperture:1}}),{duration:2,ease:'linear'});`));
 const mid=evaluateScene(scene,1);expect((mid.camera as any).focus).toEqual({distance:18,aperture:.5,samples:16});expect(evaluateScene(scene,0)).not.toEqual(mid);expect(evaluateScene(scene,1)).toEqual(mid);
});
it('allows focus introduction with a zero-aperture start and isolates per-view focus',async()=>{
 const scene=await compileSource(source(`s.view('left',{rect:[0,0,.5,1],camera:{focus:{distance:8,aperture:.4,samples:8}}},v=>{});s.play(s.camera.animate({focus:{distance:16,aperture:1}}),{duration:2,ease:'linear'});`));
 const frame=evaluateScene(scene,1);expect((frame.camera as any).focus).toEqual({distance:16,aperture:.5,samples:16});expect((frame.views![0].camera as any).focus).toEqual({distance:8,aperture:.4,samples:8});
});
it('rejects malformed lens settings and animated quality changes at compile boundary',async()=>{
 for(const focus of ['{distance:0,aperture:1}','{distance:10,aperture:-1}','{distance:10,aperture:1,samples:9}','{distance:10,aperture:1,unknown:2}'])await expect(compileSource(source(`s.play(s.camera.animate({focus:${focus}}),{duration:1});`))).rejects.toThrow();
 await expect(compileSource(source(`s.play(s.camera.animate({focus:{distance:10,aperture:1,samples:8}}),{duration:0});s.play(s.camera.animate({focus:{distance:20,aperture:1,samples:32}}),{duration:1});`))).rejects.toThrow('samples');
});
