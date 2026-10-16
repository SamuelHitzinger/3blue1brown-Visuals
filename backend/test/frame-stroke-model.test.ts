import { expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileSource, createModelGLB, detectLabelStrokeOverlaps, evaluateScene, parseModelGLB } from 'animlib/core';
import { ModelStore } from '../../shared/animlib/src/model-store.js';
import { renderSceneFrames } from '../src/agents/frame-renderer.js';

test('native review resolves sparse GLB holes before inspecting hide-mode labels', async () => {
  const bytes = await createModelGLB({parts:[{name:'Open middle',
    vertices:[[-3,-2,0],[-1,-2,0],[-1,2,0],[-3,2,0],[1,-2,0],[3,-2,0],[3,2,0],[1,2,0]],
    triangles:[[0,1,2],[0,2,3],[4,5,6],[4,6,7]],baseColor:[0,0,1,1]}]});
  const {metadata} = await parseModelGLB(bytes);
  const asset = {kind:'model' as const,url:'/open-middle.glb',metadata};
  const models = {assets:{hollow:asset},files:{[asset.url]:Buffer.from(bytes).toString('base64')}};
  const store = new ModelStore(models.assets,{read:async()=>new Uint8Array(bytes)});
  const directory=await mkdtemp(join(tmpdir(),'stroke-model-native-'));
  try {
    const source=`export default scene({mode:'3d'},s=>{
      s.play(s.camera.to3D({yaw:0,pitch:0,height:8,distance:10,perspective:0}),{duration:0});
      s.model('hollow',{asset:'hollow'});
      s.text('label',{text:'H',fontSize:2,position:[0,0,-2],labelOcclusion:'hide'});
      s.line3D('crossing',{points:[[-.8,0,-1],[.8,0,-1]],stroke:'YELLOW',strokeWidth:.08});s.wait(1);
    });`;
    const scene=await compileSource(source,{models:store.metadata});await store.prepare([scene]);
    const raw=evaluateScene(scene,1),resolved=store.resolve(raw),twice=store.resolve(resolved);
    expect(detectLabelStrokeOverlaps(raw,{width:1280,height:720})).toEqual([]);
    const warnings=detectLabelStrokeOverlaps(resolved,{width:1280,height:720});
    expect(warnings.map(w=>w.elements)).toContainEqual(['crossing','label']);
    expect(twice).toEqual(resolved);
    expect(twice.elements.every((element,i)=>element===resolved.elements[i])).toBe(true);
    const evidence=await renderSceneFrames({source,models,directory,times:[1],includeStrokeWarnings:true,signal:AbortSignal.timeout(120000)});
    expect(evidence.frames).toHaveLength(2);
    expect(evidence.strokeWarnings?.records.map(record=>[record.width,record.warning.elements])).toEqual([
      [1280,['crossing','label']],[960,['crossing','label']],
    ]);
    expect(evidence.strokeWarnings?.failedFrames??0).toBe(0);
  } finally {store.dispose();await rm(directory,{recursive:true,force:true});}
},120000);
