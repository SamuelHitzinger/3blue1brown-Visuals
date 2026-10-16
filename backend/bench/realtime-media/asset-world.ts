import {LiveWorld,type WorldOptions} from '../realtime-world/world.js';
import type {ModelStore} from '../../../shared/animlib/src/model-store.js';

/** Session inventory is fixed before world creation. Caller owns/disposes models.
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
