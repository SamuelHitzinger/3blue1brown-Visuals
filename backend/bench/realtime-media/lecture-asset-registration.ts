import {basename} from 'node:path';
import type {createLocalAssetIndex} from './asset-index.js';
import type {createLectureAssetSession,LectureAssetAppendOptions,LectureAssetManifest} from './lecture-assets.js';

type LocalAssetIndex=Awaited<ReturnType<typeof createLocalAssetIndex>>;
type LectureAssetSession=Awaited<ReturnType<typeof createLectureAssetSession>>;

export function requireKnownAssetInventory(received:unknown,session:Pick<LectureAssetSession,'knowsInventory'>):void {
  if(typeof received!=='string'||!session.knowsInventory(received))throw Error('Unknown or missing asset inventory');
}

export async function registerPublishedLectureAssets(session:Pick<LectureAssetSession,'append'>,nextIndex:LocalAssetIndex,
  runtimeIds:unknown,options:LectureAssetAppendOptions={}):Promise<LectureAssetManifest> {
  options.signal?.throwIfAborted();
  if(!Array.isArray(runtimeIds)||runtimeIds.length<1||runtimeIds.length>4||new Set(runtimeIds).size!==runtimeIds.length)
    throw Error('Select one to four unique published runtime asset IDs');
  const requested=new Map<string,{sidecar:string;recordId?:string}>();
  for(const id of runtimeIds){
    const identity=typeof id==='string'?/^model-([a-f0-9]{64})(?:-([a-f0-9]{64}))?$/.exec(id):null;
    if(!identity)throw Error('Invalid published runtime asset ID; paths and URLs are not allowed');
    requested.set(id,{sidecar:identity[1]+(identity[2]?'.'+identity[2]:'')+'.json'});
  }
  // The freshly built host index is bounded at 2,000 records. Scan all pages so
  // even a second canonical publication after the first match is rejected.
  for(let offset=0,total=1,pages=0;offset<total;){
    options.signal?.throwIfAborted();
    if(++pages>2000)throw Error('Asset index pagination limit exceeded');
    const page=nextIndex.query({format:'published-glb',offset,limit:20});
    total=page.total;
    if(!Number.isSafeInteger(total)||total<0||total>2000)throw Error('Invalid asset index total');
    for(const record of page.entries){
      const candidate=requested.get(record.assetId);
      if(!candidate||record.format!=='published-glb'||!record.manifestPath||basename(record.manifestPath)!==candidate.sidecar)continue;
      if(candidate.recordId!==undefined)throw Error(`Ambiguous canonical publication: ${record.assetId}`);
      candidate.recordId=record.id;
    }
    const next=page.nextOffset??total;
    if(!Number.isSafeInteger(next)||next>total||next<=offset&&total!==0)throw Error('Invalid asset index pagination');
    offset=next;
  }
  const ids=[...requested].map(([id,entry])=>{
    if(entry.recordId===undefined)throw Error(`Unknown canonical published asset: ${id}`);
    return entry.recordId;
  });
  options.signal?.throwIfAborted();
  return session.append(nextIndex,ids,options);
}
