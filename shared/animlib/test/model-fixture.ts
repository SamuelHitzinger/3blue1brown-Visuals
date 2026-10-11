import { WebIO } from '@gltf-transform/core';
import { KHRMaterialsUnlit, KHRTextureTransform } from '@gltf-transform/extensions';
import { createModelGLB } from '../src/model-export.js';
export const textureBytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR4nGP4z8DwHwyBNBgAAEnICff5q7YNAAAAAElFTkSuQmCC'),c=>c.charCodeAt(0));
export interface FixtureOptions { textured?:boolean; unlit?:boolean; alpha?:number; alphaMode?:'OPAQUE'|'MASK'|'BLEND'; doubleSided?:boolean; uv1?:boolean; transform?:boolean; normal?:boolean; emission?:boolean; metallic?:boolean; occlusion?:boolean; mirrored?:boolean; nested?:boolean }
export async function modelFixture(o:FixtureOptions={}):Promise<Uint8Array<ArrayBuffer>> {
  const bytes=await createModelGLB({parts:[{name:'Panel',vertices:[[-1,-1,0],[1,-1,0],[1,1,0],[-1,1,0]],triangles:[[0,1,2],[0,2,3]],uv:[[0,1],[1,1],[1,0],[0,0]],baseColor:[1,1,1,o.alpha??1],unlit:o.unlit??true,...(o.textured===false?{}:{texture:{bytes:textureBytes,mime:'image/png' as const}})}]});
  const io=new WebIO().registerExtensions([KHRMaterialsUnlit,KHRTextureTransform]),doc=await io.readBinary(bytes),root=doc.getRoot(),m=root.listMaterials()[0],p=root.listMeshes()[0].listPrimitives()[0];
  m.setDoubleSided(o.doubleSided??true);if(o.alphaMode)m.setAlphaMode(o.alphaMode);
  const t=m.getBaseColorTexture();if(t){
    const info=m.getBaseColorTextureInfo()!;info.setMagFilter(9728).setMinFilter(9728);
    if(o.uv1){p.setAttribute('TEXCOORD_1',p.getAttribute('TEXCOORD_0')!.clone());info.setTexCoord(1);p.getAttribute('TEXCOORD_0')!.setArray(new Float32Array(8));}
    if(o.transform)info.setExtension('KHR_texture_transform',doc.createExtension(KHRTextureTransform).createTransform().setOffset([0.5,0]).setScale([0.5,1]));
    if(o.normal)m.setNormalTexture(t);
    if(o.emission)m.setEmissiveTexture(t).setEmissiveFactor([0.5,0.5,0.5]);
    if(o.metallic)m.setMetallicRoughnessTexture(t).setMetallicFactor(1);
    if(o.occlusion)m.setOcclusionTexture(t);
  }
  if(o.mirrored)root.listNodes()[0].setScale([-1,2,1]);
  if(o.nested){const node=root.listNodes()[0];root.listScenes()[0].removeChild(node).addChild(doc.createNode('Assembly').setTranslation([2,0,0]).addChild(node.setTranslation([0,1,0])));}
  return new Uint8Array(await io.writeBinary(doc));
}
export const modelSource=`export default scene({mode:'2d'},s=>{
  const model=s.model('panel',{asset:'fixture'});
  s.play(model.fadeIn(),{duration:1});
  s.play(model.part('Panel').moveTo([1,0,0]),{duration:1});
  s.keep(model);
});`;
