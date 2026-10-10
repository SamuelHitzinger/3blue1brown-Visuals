import type { PreparedModelInput } from '../src/asset-types.js';
export function localAssetURI(uri:string):string;
export function parseGLB(bytes:Uint8Array):{json:any;binary?:Uint8Array};
export function importStaticGLTF(input:unknown,options:any):Promise<{images:any[];model:PreparedModelInput;report:any}>;
