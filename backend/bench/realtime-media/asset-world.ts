import {LiveWorld,type WorldOptions,type WorldTransactionOptions} from '../realtime-world/world.js';
import type {ModelStore} from '../../../shared/animlib/src/model-store.js';
import type {ModelAsset} from '../../../shared/animlib/src/model-types.js';

/** Caller owns/disposes models; registerAssetBackedModels appends session assets.
 * Model decoding may finish/cache after cancellation; publication still checks
 * the transaction signal before renderer preparation and inside LiveWorld.
 */
export function createAssetBackedWorld(models:Pick<ModelStore,'metadata'|'prepare'>,options:Omit<WorldOptions,'models'>={}){
 return new LiveWorld({...options,models:models.metadata,prepare:async(scene,assets,signal)=>{
  signal.throwIfAborted();
  await models.prepare([scene]);
  signal.throwIfAborted();
  await options.prepare?.(scene,assets,signal);
  signal.throwIfAborted();
 }});
}

/** Copy data descriptors without invoking getters or serialization hooks. Optional
 * object fields may be undefined; array entries and root asset IDs may not. */
function plainSnapshot(value:unknown,depth=0):unknown{
 if(depth>16)throw new Error('Model registration nesting limit exceeded');
 if(value===null||typeof value==='string'||typeof value==='boolean')return value;
 if(typeof value==='number'&&Number.isFinite(value))return value;
 if(typeof value!=='object'||value===null||!Array.isArray(value)&&Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)
  throw new Error('Model registration requires plain JSON data');
 const descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(descriptors);
 if(keys.length>20_000)throw new Error('Model registration item limit exceeded');
 const array=Array.isArray(value),snapshot:Record<string,unknown>=array?[] as unknown as Record<string,unknown>:Object.create(null);
 for(const key of keys){
  if(typeof key!=='string'||['__proto__','prototype','constructor'].includes(key))throw new Error('Unsafe model registration member');
  const descriptor=descriptors[key];
  if(descriptor.get||descriptor.set)throw new Error('Unsafe model registration member');
  if(array&&key==='length')continue;
  if(!array&&depth>0&&descriptor.value===undefined)continue;
  const field=plainSnapshot(descriptor.value,depth+1);
  if(descriptor.enumerable)snapshot[key]=field;
 }
 if(array&&Object.keys(snapshot).length!==(value as unknown[]).length)throw new Error('Model registration requires complete arrays');
 return snapshot;
}

/** Trusted host operation. The concrete ModelStore.register validates and stages
 * its entire batch before writing. Keep it synchronous and free of host hooks:
 * after the guard, store and world publication share one JavaScript transaction.
 * Admitted resources survive later scene cancellation; scene revision is untouched.
 */
export function registerAssetBackedModels(world:LiveWorld,models:Pick<ModelStore,'register'|'metadata'>,
 assets:Record<string,ModelAsset>,options:WorldTransactionOptions={}):{inventoryRevision:number;added:string[]}{
 const {signal,beforeCommit}=options;signal?.throwIfAborted();
 if(!assets||typeof assets!=='object'||Array.isArray(assets))throw new Error('Invalid model registration');
 const input=plainSnapshot(assets) as Record<string,ModelAsset>;
 for(const asset of Object.values(input))if(!asset||asset.kind!=='model')throw new Error('Invalid model registration asset');
 const staged=world.stageModelRegistration(Object.fromEntries(Object.entries(input).map(([id,asset])=>[id,asset.metadata])));
 const result:unknown=beforeCommit?.();
 if(result!==null&&(typeof result==='object'||typeof result==='function')&&typeof (result as {then?:unknown}).then==='function'){
  void Promise.resolve(result).catch(()=>{});throw new Error('beforeCommit must be synchronous');
 }
 signal?.throwIfAborted();staged.assertCurrent();
 models.register(input);
 const inventoryRevision=staged.commit();
 return {inventoryRevision,added:staged.added};
}
