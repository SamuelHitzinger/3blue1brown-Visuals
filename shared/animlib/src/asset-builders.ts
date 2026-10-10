import type { ModelAssetDescriptor, ModelProps } from './asset-types.js';
import type { Geometry } from './types.js';

/** Self-contained descriptor-only factory installed verbatim in QuickJS. */
export function createAssetBuilders(catalog: ModelAssetDescriptor[] = []) {
  return {
    modelInfo(id: string): ModelAssetDescriptor {
      const asset=catalog.find(asset=>asset.id===id);
      if(!asset) throw new Error(`Missing model asset: ${id}`);
      return JSON.parse(JSON.stringify(asset));
    },
    model(props: ModelProps): {id:string; geometry:Geometry}[] {
      const asset=catalog.find(asset=>asset.id===props?.asset);
      if(!asset) throw new Error(`Missing model asset: ${props?.asset}`);
      return asset.parts.map(part=>({id:part.id,geometry:{kind:'mesh',asset:{id:asset.id,hash:asset.hash,part:part.id},shading:props.shading??'smooth'}}));
    },
  };
}
