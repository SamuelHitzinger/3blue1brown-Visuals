import type {AssetRegistry,PreparedImageInput,PreparedModelInput} from '../src/asset-types.js';
import type {AssetRegistryOptions} from '../src/asset-registry.js';

export function loadModelPackage(manifestPath:string):Promise<PreparedModelInput|PreparedImageInput>;
export function loadAssetRegistry(manifestPaths:string[],options?:AssetRegistryOptions):Promise<AssetRegistry>;
