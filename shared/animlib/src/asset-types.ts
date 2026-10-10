import type { Bounds3D, ElementStyle, Geometry, Vec3 } from './types.js';

export interface AssetGeometryRef { id: string; hash: string; part: string }
export interface AssetProvenance {
  source: string;
  sourceHash: string;
  creator: string;
  license: string;
  preparedAt: string;
  converter: { name: string; version: string; options: Record<string, unknown> };
  selection: string;
  modifications: string[];
  fidelity: string;
}
export interface PreparedModelPart {
  id: string;
  vertices: Vec3[];
  triangles: [number, number, number][];
  normals?: Vec3[];
}
export interface PreparedModelInput {
  id: string;
  kind: 'model';
  version: 1;
  /** Explicit physical units, or an explicit source-defined unit declaration. */
  units: string;
  provenance: AssetProvenance;
  parts: PreparedModelPart[];
}
export interface ModelPartDescriptor {
  id: string; vertexCount: number; triangleCount: number; bounds: Bounds3D;
}
export interface ModelAssetDescriptor {
  id: string; kind: 'model'; hash: string; bounds: Bounds3D; parts: ModelPartDescriptor[];
}
export interface ModelProps extends ElementStyle {
  asset: string;
  shading?: Geometry['shading'];
  material?: Geometry['material'];
  texture?: Geometry['texture'];
  clipPlanes?: Geometry['clipPlanes'];
  outline?: Geometry['outline'];
}
/** Explicit host capability. Resolution never mutates or expands a Frame. */
export interface AssetGeometryResolver { resolve(ref: AssetGeometryRef): Geometry }
export interface AssetLease extends AssetGeometryResolver { dispose(): void }
export interface AssetRegistry {
  readonly catalog: ModelAssetDescriptor[];
  acquire(refs: readonly AssetGeometryRef[]): AssetLease;
  stats(): { decodedBytes: number; pinnedBytes: number; leases: number; models: number };
}
export interface AssetBlobRef { path: string; hash: string; byteLength: number }
/** Schema reserved for the subsequent image-renderer slice, not accepted by model loading. */
export interface ImageAssetDescriptor {
  id: string; kind: 'image'; version: 1; hash: string;
  width: number; height: number;
  storage: 'rgba8'; encoding: 'srgb'; origin: 'top-left'; alpha: 'straight';
  colorPolicy: 'source'; pixels: AssetBlobRef; provenance: AssetProvenance;
}
export interface ModelPackage {
  kind: 'model'; version: 1; id: string; hash: string; units: string; provenance: AssetProvenance;
  parts: { id: string; vertexCount: number; triangleCount: number;
    positions: AssetBlobRef; indices: AssetBlobRef; normals?: AssetBlobRef }[];
}
