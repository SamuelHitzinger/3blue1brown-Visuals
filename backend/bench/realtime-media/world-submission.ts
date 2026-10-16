import type {LiveWorld,WorldPatch,WorldTransactionOptions} from '../realtime-world/world.js';
import type {CommittedOperationInput} from './committed-context.js';

export type LectureSubmission = {action:'add';source:string}
  | {action:'edit';changes:WorldPatch['changes'];remove:string[]}
  | {action:'parameters';parameterProgramId:string;parameterValues:{id:string;value:number}[]}
  | {action:'defer';reason:string};

/** Dispatch only accepted tool submissions. World remains the transaction boundary. */
export async function commitLectureSubmission(world:LiveWorld,submission:Exclude<LectureSubmission,{action:'defer'}>,
  baseRevision:number,programId:string,nowSeconds:number,options:WorldTransactionOptions={}){
  let operation:CommittedOperationInput['operation'];
  if(submission.action==='add'){
    operation={action:'add',programId,source:submission.source};
    const commit=await world.addProgram({id:programId,source:submission.source,baseRevision},nowSeconds,options);
    return {commit,operation,changed:commit.revision!==baseRevision};
  }
  if(submission.action==='edit'){
    const patch={baseRevision,changes:submission.changes,remove:submission.remove};
    operation={action:'edit',patch};
    const commit=await world.apply(patch,nowSeconds,options);
    return {commit,operation,changed:commit.revision!==baseRevision};
  }
  if(submission.action!=='parameters')throw Error('Unknown submission action');
  if(!Array.isArray(submission.parameterValues)||submission.parameterValues.length===0||submission.parameterValues.length>32)
    throw Error('Invalid parameter update count');
  const values:Record<string,number>=Object.create(null);
  for(const entry of submission.parameterValues){
    if(!entry||typeof entry.id!=='string'||Object.hasOwn(values,entry.id))throw Error('Invalid or duplicate parameter ID');
    values[entry.id]=entry.value;
  }
  const patch={baseRevision,programId:submission.parameterProgramId,values};
  operation={action:'parameters',patch};
  const commit=await world.setParameters(patch,nowSeconds,options);
  return {commit,operation,changed:commit.revision!==baseRevision};
}
