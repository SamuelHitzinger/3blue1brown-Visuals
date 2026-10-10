import type { AssetGeometryRef, AssetGeometryResolver } from './asset-types.js';
import type { CompiledScene, Geometry } from './types.js';
import { assetCheck } from './asset-validation.js';

type ReferencedGeometry = Geometry & { asset?: AssetGeometryRef };
// Weak identity metadata holds neither registry entries nor mesh arrays alive.
const identities = new WeakMap<Geometry,string>();
export function assetGeometryIdentity(geometry:Geometry):string|undefined { return identities.get(geometry); }
/** The only asset-to-geometry bridge: immutable arrays stay outside serialized Frames. */
export function resolveAssetGeometry(geometry: ReferencedGeometry, resolver?: AssetGeometryResolver): Geometry {
  if (!geometry.asset) return geometry;
  assetCheck(resolver, `model ${geometry.asset.id} requires a held asset lease`);
  assetCheck(geometry.kind === 'mesh' && geometry.vertices === undefined && geometry.triangles === undefined && geometry.normals === undefined, 'referenced mesh cannot contain inline arrays');
  const { asset:_asset, ...appearance } = geometry;
  const resolved = { ...resolver.resolve(geometry.asset), ...appearance };
  identities.set(resolved,JSON.stringify([geometry.asset.hash,geometry.asset.part]));
  return resolved;
}
/** Includes dormant lifecycle elements and track snapshots before a candidate is committed. */
export function sceneAssetRefs(scenes: readonly CompiledScene[]): AssetGeometryRef[] {
  const refs = new Map<string,AssetGeometryRef>();
  const visit = (geometry?: ReferencedGeometry) => { if (geometry?.asset) refs.set(JSON.stringify(geometry.asset),geometry.asset); };
  for (const scene of scenes) {
    for (const element of [...scene.initial,...scene.lifecycle.flatMap(event=>event.elements??[])]) { visit(element.geometry); visit(element.morph?.from); visit(element.morph?.to); }
    for (const track of scene.tracks) { visit(track.action.geometry); for (const element of Object.values(track.from)) { visit(element.geometry); visit(element.morph?.from); visit(element.morph?.to); } }
  }
  return [...refs.values()];
}
