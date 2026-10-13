import {meshTriangles} from './mesh-shading.js';
import type {ModelPrimitive} from './models.js';

// A decoded primitive is immutable and owned by ModelStore. Weak ownership
// releases expansions with the model; large models cannot evict each other from
// the small content cache used for mutable, inline authored meshes.
const expanded = new WeakMap<ModelPrimitive, ReturnType<typeof expand>>();
function expand(model:ModelPrimitive) {
  const mesh=meshTriangles(model.geometry),faces=model.geometry.triangles!;
  return {...mesh,colors:faces.flatMap(face=>face.map(i=>model.colors?.[i]??[1,1,1,1] as [number,number,number,number])),
    uvs:faces.flatMap(face=>face.map(i=>[...(model.uv0[i]??[0,0]),...(model.uv1[i]??[0,0])]))};
}
export function modelRenderGeometry(model:ModelPrimitive):ReturnType<typeof expand> {
  let result=expanded.get(model);
  if(!result){result=expand(model);expanded.set(model,result);}
  return result;
}
