/** Resolve evidence-qualified speech phrases; never backdate live world playback. */
import {measuredTiming} from './timing.js';
import {resolveSpeechCues} from '../../src/agents/timing-prelude.js';
import type {LocalAsrTrial} from './replay.js';
import type {SourceClock} from './events.js';

export interface SpeechAnchor {evidenceId:string;version:number;phrase:string;occurrence:number|null;utteranceId:string|null}
export interface JoinedSpeechTiming {timing:ReturnType<typeof measuredTiming>;clock:Required<SourceClock>}
interface SpeechEvidence {
 id:string;version:number;kind:'transcript'|'frame';sourceId:string;sourceStartMs:number;sourceEndMs:number;
 sourceReadyAtMs:number;availableAtMs:number;speech?:JoinedSpeechTiming;
}
export interface ResolvedOperationSpeechAnchor {
 evidenceId:string;version:number;sourceId:string;phrase:string;utteranceId:string;wordIds:string[];
 sourceStartMs:number;sourceEndMs:number;hostStartMs:number;hostEndMs:number;availableAtMs:number;
 deadlineMs:number;minWordProbability:number;timingBasis:'measured-asr-estimate';
}
function check(value:unknown,message:string):asserts value {if(!value)throw Error(message);}
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1e12;
const close=(a:number,b:number)=>Math.abs(a-b)<=1e-4;
const mapped=(sourceMs:number,clock:Required<SourceClock>)=>clock.monotonicStartMs+(sourceMs-clock.sourceStartMs)/clock.rate;

export function joinSpeechTiming(trial:LocalAsrTrial,sourceClock:SourceClock):JoinedSpeechTiming {
 const clock={sourceStartMs:sourceClock.sourceStartMs??0,monotonicStartMs:sourceClock.monotonicStartMs,rate:sourceClock.rate??1};
 check(finite(clock.sourceStartMs)&&finite(clock.monotonicStartMs)&&finite(clock.rate)&&clock.rate>0&&clock.rate<=100,'Invalid speech source clock');
 const duration=trial.windowEndSec-trial.windowStartSec;
 check([trial.windowStartSec,trial.windowEndSec,trial.sourceWindowStartSec,trial.sourceWindowEndSec,trial.availableAfterSourceSec].every(finite)
  &&close(trial.sourceWindowEndSec-trial.sourceWindowStartSec,duration)&&close(trial.availableAfterSourceSec,trial.sourceWindowEndSec),'Invalid speech source window');
 const timing=measuredTiming({id:'window',durationSec:duration,sourceOffsetSec:trial.sourceWindowStartSec,segments:trial.segments});
 check(trial.segments.map(segment=>segment.text).join('').trim()===trial.text,'ASR text disagrees with measured segments');
 check(finite(mapped(trial.sourceWindowStartSec*1000,clock)),'Speech precedes host clock');
 return {timing,clock};
}

/** Null is only valid when released frame evidence can support a frame-only operation.
 * Phrase matches are per evidence version/window. Cross-window phrases are not guessed. */
export function resolveOperationSpeechAnchor(anchor:SpeechAnchor|null,evidence:readonly SpeechEvidence[],nowMs:number):ResolvedOperationSpeechAnchor|null {
 check(finite(nowMs),'Invalid speech resolution clock');
 if(anchor===null){
  check(evidence.some(item=>item.kind==='frame'&&item.availableAtMs<=nowMs),'A speech anchor is required without released frame evidence');
  return null;
 }
 check(anchor&&typeof anchor.evidenceId==='string'&&Number.isSafeInteger(anchor.version)&&anchor.version>0,'Invalid speech anchor identity');
 const matches=evidence.filter(item=>item.id===anchor.evidenceId&&item.version===anchor.version);
 check(matches.length===1,'Speech anchor evidence/version is unavailable or duplicated');
 const item=matches[0];
 check(item.kind==='transcript'&&item.speech&&item.availableAtMs<=nowMs,'Measured speech evidence is not available');
 const {timing,clock}=item.speech;
 check(close(timing.sourceOffsetSec*1000,item.sourceStartMs)&&close((timing.sourceOffsetSec+timing.scene.durationSec)*1000,item.sourceEndMs)
  &&close(mapped(item.sourceEndMs,clock),item.sourceReadyAtMs),'Speech evidence clock mismatch');
 const cue=resolveSpeechCues(timing.scene,[{id:'operation',phrase:anchor.phrase,
  ...(anchor.occurrence===null?{}:{occurrence:anchor.occurrence}),...(anchor.utteranceId===null?{}:{utteranceId:anchor.utteranceId})}]).operation;
 const sourceStartMs=(timing.sourceOffsetSec+cue.startSec)*1000,sourceEndMs=(timing.sourceOffsetSec+cue.endSec)*1000;
 const hostStartMs=mapped(sourceStartMs,clock),hostEndMs=mapped(sourceEndMs,clock);
 const probabilities=new Map(timing.confidence.map(word=>[word.id,word.probability]));
 check(finite(hostStartMs)&&finite(hostEndMs)&&hostEndMs<=item.availableAtMs,'Speech anchor clock is not causally available');
 return {evidenceId:item.id,version:item.version,sourceId:item.sourceId,phrase:cue.phrase,utteranceId:cue.utteranceId,wordIds:cue.wordIds,
  sourceStartMs,sourceEndMs,hostStartMs,hostEndMs,availableAtMs:item.availableAtMs,deadlineMs:hostEndMs+10000,
  minWordProbability:Math.min(...cue.wordIds.map(id=>probabilities.get(id)!)),timingBasis:'measured-asr-estimate'};
}

export function measureSpeechRender(cue:ResolvedOperationSpeechAnchor,stamp:{serverLowerMs:number;serverUpperMs:number}) {
 check(finite(stamp.serverLowerMs)&&finite(stamp.serverUpperMs)&&stamp.serverUpperMs>=stamp.serverLowerMs,'Invalid render clock bounds');
 return {cueEndToRenderLowerMs:stamp.serverLowerMs-cue.hostEndMs,cueEndToRenderUpperMs:stamp.serverUpperMs-cue.hostEndMs,
  withinDeadline:stamp.serverUpperMs<=cue.deadlineMs,hardwarePresentedAtMs:null,
  limitation:'Clock bounds measure renderer submission after an ASR-estimated phrase. They do not prove hardware presentation, semantic support or synchronized audio playback.'};
}
