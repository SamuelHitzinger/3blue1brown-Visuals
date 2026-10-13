import type { ModelMaterial } from './models.js';
import { MAX_INSTANCES } from './retained-geometry.js';
import type { RetainedMesh } from './retained-geometry.js';
import { VERTEX_FLOATS } from './texture-shader.js';
import type { ImageTexture, ResolvedImage } from './asset-types.js';
export interface ImageBinding { texture: ImageTexture; image: ResolvedImage }
export function imageBindingKey(binding?:ImageBinding):string { return binding?JSON.stringify([binding.image.hash,binding.texture.filter,binding.texture.wrap]):''; }
/** Internal layer operations shared by both compositors. */
export interface LayerEffect {
  /** Opaque receiver: apply lighting to accumulated coverage, before saturation. */
  receiverLight?: number;
  /** Linear palette albedo, applied only after accumulating coverage. */
  receiverColor?: [number, number, number];
  /** Direct-light reduction per unit of encoded coverage (includes normalization). */
  receiverShadow?: number;
  /** Add a silhouette's coverage without attenuating earlier samples. */
  additive?: boolean;
}
/** Shared draw order for the two native graphics backends. */
export type RenderCommand =
  | { first: number; count: number; opaque: boolean; modelMaterial?: ModelMaterial; mesh?: RetainedMesh; instances?: Float32Array[]; imageBinding?: ImageBinding }
  | ({ children: RenderCommand[]; opacity: number; opaque: boolean } & LayerEffect);
export interface DrawItem {
  modelMaterial?: ModelMaterial;
  depth: number; vertices: Float32Array; transparent: boolean; screen: boolean;
  /** Requires world-space packing after the effective camera is known. */
  cameraDependentGeometry?: boolean;
  mesh?: RetainedMesh; instance?: Float32Array;
  imageBinding?:ImageBinding;
  groups?: ({ id: string; opacity: number } & LayerEffect)[];
}

/** Isolated groups form atomic compositing units; ordinary groups remain flattened. */
export function composeItems(items: DrawItem[], first: number): { commands: RenderCommand[]; items: DrawItem[] } {
  // Material names identify authored parts, not shader state. Equal materials
  // can share a draw after depth sorting; texture identity and sampler state
  // must still match. Keys live only for this composition, so edits stay live.
  const materialKeys=new Map<ModelMaterial,string>(),images=new Map<object,number>();
  const materialKey=(material?:ModelMaterial):string=>{
    if(!material)return '';
    let key=materialKeys.get(material);if(key!==undefined)return key;
    const {name:_name,maps,...factors}=material;
    key=JSON.stringify([factors,maps.map(map=>{
      if(!map)return null;
      const {image,...sampling}=map;
      if(!images.has(image))images.set(image,images.size);
      return [images.get(image),sampling];
    })]);materialKeys.set(material,key);return key;
  };
  interface Unit extends LayerEffect { depth: number; transparent: boolean; item?: DrawItem; children?: Unit[]; opacity: number; }
  const root: Unit[] = [], groups = new Map<string, Unit>();
  for (const item of items) {
    let children = root;
    for (const group of item.groups ?? []) {
      let unit = groups.get(group.id);
      if (!unit) { unit = { depth: item.depth, transparent: group.opacity < 0.999999, children: [], opacity: group.opacity, receiverLight: group.receiverLight, receiverColor: group.receiverColor, receiverShadow: group.receiverShadow, additive: group.additive }; groups.set(group.id, unit); children.push(unit); }
      unit.depth = Math.min(unit.depth, item.depth);
      unit.transparent ||= item.transparent;
      children = unit.children!;
    }
    children.push({ depth: item.depth, transparent: item.transparent, item, opacity: 1 });
  }
  const ordered: DrawItem[] = [];
  const build = (units: Unit[]): RenderCommand[] => {
    // A nested translucent layer makes its enclosing layer translucent as well.
    // A receiver layer contains an opaque finite plane beneath all of its masks.
    // Resolve it before unrelated transparency; its projected masks are not scene glass.
    const transparent = (unit: Unit): boolean => unit.receiverLight === undefined
      && (unit.transparent || Boolean(unit.children?.some(transparent)));
    for (const unit of units) unit.transparent = transparent(unit);
    units.sort((a,b) => Number(a.transparent)-Number(b.transparent) || b.depth-a.depth);
    const merged: RenderCommand[] = [];
    for (const unit of units) {
      if (unit.children) {
        merged.push({ children: build(unit.children), opacity: unit.opacity, opaque: !unit.transparent, ...(unit.receiverLight !== undefined ? { receiverLight: unit.receiverLight, receiverColor: unit.receiverColor, receiverShadow: unit.receiverShadow } : {}), ...(unit.additive ? { additive: true } : {}) });
        continue;
      }
      const item=unit.item!,count=item.vertices.length/VERTEX_FLOATS,previous=merged.at(-1);
      ordered.push(item);
      const compatible=previous && 'first' in previous && previous.opaque===!item.transparent
        && materialKey(previous.modelMaterial)===materialKey(item.modelMaterial)
        && imageBindingKey(previous.imageBinding)===imageBindingKey(item.imageBinding);
      // Transparent models can contain thousands of adjacent triangles with the
      // same material. Merge directly instead of allocating a discarded command
      // and instances array for every triangle after the global depth sort.
      if(compatible && 'first' in previous && previous.mesh && previous.mesh===item.mesh && previous.instances!.length<MAX_INSTANCES)previous.instances!.push(item.instance!);
      else if(compatible && 'first' in previous && !previous.mesh && !item.mesh && previous.first+previous.count===first)previous.count+=count;
      else merged.push({first,count,opaque:!item.transparent,...(item.imageBinding?{imageBinding:item.imageBinding}:{}),...(item.modelMaterial?{modelMaterial:item.modelMaterial}:{}),...(item.mesh?{mesh:item.mesh,instances:[item.instance!]}:{})});
      first+=count;
    }
    return merged;
  };
  return { commands: build(root), items: ordered };
}
