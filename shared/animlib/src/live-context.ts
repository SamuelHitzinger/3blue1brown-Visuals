import type {LiveWorld} from './live-world.js';
import type {Frame} from './types.js';
import type {CommittedContextJournal,CommittedContextSnapshot} from './live-journal.js';

export interface WorldContextInput {
  summary:ReturnType<LiveWorld['summary']>;
  sampledRevision:number;
  sampledAt:unknown;
  frame?:Frame;
  requestOverheadBytes:number;
  journal:CommittedContextJournal;
}

type Summary=WorldContextInput['summary'];
type Parameter=Summary['programs'][number]['parameters'][number];
type ContextParameter=Omit<Parameter,'label'|'dependents'> & {
  label?:string;labelOmitted:boolean;dependents:Parameter['dependents'];dependentCount:number;omittedDependentCount:number;
  usable:boolean;reason?:'dependent-target-removed';opaque:boolean;
};
type ContextProgram=Omit<Summary['programs'][number],'ids'|'parameters'> & {
  ids:string[];parameters:ContextParameter[];omittedIdCount:number;omittedParameterCount:number;
};
type ContextElement=Pick<Frame['elements'][number],'id'|'position'|'rotation'|'scale'|'opacity'|'fill'> & {kind:Frame['elements'][number]['geometry']['kind']};
const CHARACTERS=60000,REQUEST_BYTES=120000,field=',"committedOperations":',encoder=new TextEncoder();
function check(value:unknown,message:string):asserts value{if(!value)throw new Error(message);}
/** Find the journal's own smallest honest snapshot. Never manufacture omitted
 * ranges or slice a retained source/patch to make it fit. The binary search is
 * bounded and independent of world size; final history gets all remaining room. */
function minimumJournal(journal:CommittedContextJournal,maxBytes:number):CommittedContextSnapshot{
  let low=1,high=Math.min(CHARACTERS,maxBytes);
  check(high>0,'World context budget cannot fit omission metadata');
  try{journal.snapshot(high,high);}catch{throw new Error('World context budget cannot fit journal omission metadata');}
  while(low<high){
    const middle=Math.floor((low+high)/2);
    try{journal.snapshot(middle,middle);high=middle;}catch{low=middle+1;}
  }
  return journal.snapshot(low,low);
}

/** A bounded, detached description of current state, not a complete scene or
 * semantic proof. IDs/values/bounds are included exactly or omitted as whole
 * records. Dependency omissions are explicit and never imply absent ownership. */
export function buildWorldContext(input:WorldContextInput){
  check(Number.isSafeInteger(input.requestOverheadBytes)&&input.requestOverheadBytes>=0&&input.requestOverheadBytes<REQUEST_BYTES,'Invalid world request overhead budget');
  const maxBytes=REQUEST_BYTES-input.requestOverheadBytes,minJournal=minimumJournal(input.journal,maxBytes);
  const reserved=JSON.stringify(minJournal),reservedBytes=encoder.encode(reserved).length;
  const infos=input.summary.programs.map(program=>{
    const ids=new Set(program.ids);
    return {program,usable:program.parameters.map(parameter=>parameter.dependents.every(dependent=>ids.has(dependent.target)))};
  });
  const parameterCount=infos.reduce((n,{program})=>n+program.parameters.length,0);
  const description={
    summary:{revision:input.summary.revision,disposed:input.summary.disposed,pendingPrograms:input.summary.pendingPrograms,
      programs:[] as ContextProgram[],entityIds:[] as string[],motions:[] as Summary['motions'],reservedIdCount:input.summary.reservedIdCount,limitations:[] as string[]},
    sampledRevision:input.sampledRevision,sampledAt:null as unknown,frameCurrent:input.sampledRevision===input.summary.revision&&input.frame!==undefined,
    // Reserve the longer JSON boolean (false) until final completeness is known.
    elements:[] as ContextElement[],elementsTruncated:false,
    unusableParameterCount:infos.reduce((n,info)=>n+info.usable.filter(usable=>!usable).length,0),
    omissions:{programs:infos.length,parameters:parameterCount,motions:input.summary.motions?.length??0,
      dependencies:infos.reduce((n,{program})=>n+program.parameters.reduce((count,parameter)=>count+parameter.dependents.length,0),0),
      programEntityIds:infos.reduce((n,{program})=>n+program.ids.length,0),entityIds:input.summary.entityIds.length,
      elements:input.frame?.elements.length??0,labels:parameterCount,limitations:input.summary.limitations.length,sampledAt:input.sampledAt!=null},
    opaque:false,limitation:'Omitted world records and dependency details are unknown, not absent. Parameters marked unusable cannot be updated.',
  };
  const fits=()=>{
    const serialized=JSON.stringify(description);
    return serialized.length+field.length+reserved.length<=CHARACTERS
      &&encoder.encode(serialized).length+field.length+reservedBytes<=maxBytes;
  };
  check(fits(),'World context budget cannot fit omission metadata');
  const attempt=(add:()=>void,undo:()=>void)=>{add();if(fits())return true;undo();return false;};

  for(const motion of (input.summary.motions??[]).slice(0,256)){
    if(!attempt(()=>{description.summary.motions.push(structuredClone(motion));description.omissions.motions--;},
      ()=>{description.summary.motions.pop();description.omissions.motions++;}))break;
  }

  // Program identities precede parameter descriptors; round-robin parameters
  // preserve breadth across programs when the complete inventory cannot fit.
  const included:{source:typeof infos[number];context:ContextProgram}[]=[];
  for(const info of infos.slice(0,32)){
    const program=info.program,context:ContextProgram={id:program.id,epoch:program.epoch,duration:program.duration,
      ids:[],parameters:[],omittedIdCount:program.ids.length,omittedParameterCount:program.parameters.length};
    if(attempt(()=>{description.summary.programs.push(context);description.omissions.programs--;},()=>{description.summary.programs.pop();description.omissions.programs++;}))included.push({source:info,context});
  }
  const parameters:{source:Parameter;context:ContextParameter}[]=[];
  const maxParameters=Math.max(0,...included.map(({source})=>source.program.parameters.length));
  for(let index=0;index<maxParameters;index++)for(const program of included){
    const parameter=program.source.program.parameters[index];if(!parameter)continue;
    const usable=program.source.usable[index],context:ContextParameter={id:parameter.id,default:parameter.default,value:parameter.value,
      min:parameter.min,max:parameter.max,step:parameter.step,labelOmitted:true,dependents:[],dependentCount:parameter.dependents.length,
      omittedDependentCount:parameter.dependents.length,usable,...(!usable?{reason:'dependent-target-removed' as const}:{}),opaque:false};
    if(attempt(()=>{program.context.parameters.push(context);program.context.omittedParameterCount--;description.omissions.parameters--;},
      ()=>{program.context.parameters.pop();program.context.omittedParameterCount++;description.omissions.parameters++;}))parameters.push({source:parameter,context});
  }
  // Optional text and ownership details are whole fields, never clipped strings.
  for(const parameter of parameters){
    attempt(()=>{parameter.context.label=parameter.source.label;parameter.context.labelOmitted=false;description.omissions.labels--;},
      ()=>{delete parameter.context.label;parameter.context.labelOmitted=true;description.omissions.labels++;});
    for(const dependent of parameter.source.dependents.slice(0,4)){
      if(!attempt(()=>{parameter.context.dependents.push({target:dependent.target,properties:[...dependent.properties]});parameter.context.omittedDependentCount--;description.omissions.dependencies--;},
        ()=>{parameter.context.dependents.pop();parameter.context.omittedDependentCount++;description.omissions.dependencies++;}))break;
    }
    parameter.context.opaque=parameter.context.labelOmitted||parameter.context.omittedDependentCount>0;
  }
  for(const {source,context} of included)for(const id of source.program.ids.slice(0,32)){
    if(!attempt(()=>{context.ids.push(id);context.omittedIdCount--;description.omissions.programEntityIds--;},
      ()=>{context.ids.pop();context.omittedIdCount++;description.omissions.programEntityIds++;}))break;
  }
  for(const id of input.summary.entityIds.slice(0,256)){
    if(!attempt(()=>{description.summary.entityIds.push(id);description.omissions.entityIds--;},()=>{description.summary.entityIds.pop();description.omissions.entityIds++;}))break;
  }
  if(description.frameCurrent)for(const element of input.frame!.elements.slice(0,256)){
    const context:ContextElement=structuredClone({id:element.id,kind:element.geometry.kind,position:element.position,rotation:element.rotation,scale:element.scale,opacity:element.opacity,fill:element.fill});
    if(!attempt(()=>{description.elements.push(context);description.omissions.elements--;},()=>{description.elements.pop();description.omissions.elements++;}))break;
  }
  for(const limitation of input.summary.limitations){
    if(!attempt(()=>{description.summary.limitations.push(limitation);description.omissions.limitations--;},()=>{description.summary.limitations.pop();description.omissions.limitations++;}))break;
  }
  if(input.sampledAt!=null){
    // Unknown/oversized stamps are omitted as a field. A cyclic stamp must not
    // prevent a valid world inventory from being described.
    try{
      const serialized=JSON.stringify(input.sampledAt);
      if(serialized&&serialized.length<=CHARACTERS){const stamp:unknown=JSON.parse(serialized);
        attempt(()=>{description.sampledAt=stamp;description.omissions.sampledAt=false;},()=>{description.sampledAt=null;description.omissions.sampledAt=true;});}
    }catch{/* Explicit sampledAt omission remains. */}
  }
  description.elementsTruncated=description.omissions.elements>0;
  const serialized=JSON.stringify(description);
  const committedOperations=input.journal.snapshot(CHARACTERS-serialized.length-field.length,maxBytes-encoder.encode(serialized).length-field.length);
  description.opaque=Object.values(description.omissions).some(value=>Boolean(value))||committedOperations.opaque
    ||!description.frameCurrent&&input.summary.entityIds.length>0;
  const result={...description,committedOperations},output=JSON.stringify(result);
  check(output.length<=CHARACTERS&&encoder.encode(output).length<=maxBytes,'World context exceeded its serialization budget');
  return result;
}
