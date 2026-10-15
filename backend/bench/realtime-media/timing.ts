/** Adapt measured ASR words to the existing cue resolver. No timestamp guessing. */
import { resolveSpeechCues, type NarrationTimingScene, type SpeechCue } from '../../src/agents/timing-prelude.js';

export interface AsrWord { word: string; startSec: number; endSec: number; sourceStartSec: number; sourceEndSec: number; probability: number }
export interface AsrSegment { text: string; words: AsrWord[] }
export interface AsrWindow { id: string; durationSec: number; sourceOffsetSec: number; segments: AsrSegment[] }
const finite=(value:number)=>typeof value==='number'&&Number.isFinite(value);
const close=(a:number,b:number)=>Math.abs(a-b)<=1e-5;

export function measuredTiming(window:AsrWindow) {
  if(!/^[A-Za-z][A-Za-z0-9_-]{0,80}$/.test(window.id)||!finite(window.durationSec)||window.durationSec<=0||!finite(window.sourceOffsetSec)||window.sourceOffsetSec<0)
    throw new Error('Invalid ASR window identity or duration');
  if(!Array.isArray(window.segments)||window.segments.length>200)throw new Error('Invalid ASR segments');
  let previousStart=-1,previousEnd=-1;
  const confidence:{id:string;probability:number}[]=[];
  const utterances=window.segments.map((segment,segmentIndex)=>{
    if(!Array.isArray(segment.words)||!segment.words.length||segment.words.length>2000)throw new Error('Each ASR segment needs bounded measured words');
    const id=`${window.id}.u${segmentIndex+1}`;
    const words=segment.words.map((word,index)=>{
      if(typeof word.word!=='string'||!word.word.trim()||word.word.length>1000||![word.startSec,word.endSec,word.sourceStartSec,word.sourceEndSec,word.probability].every(finite)
        ||word.startSec<0||word.endSec<word.startSec||word.endSec>window.durationSec+1e-5||word.startSec<previousStart||word.endSec<previousEnd
        ||word.probability<0||word.probability>1||!close(word.sourceStartSec,window.sourceOffsetSec+word.startSec)||!close(word.sourceEndSec,window.sourceOffsetSec+word.endSec))
        throw new Error('Invalid or out-of-window measured ASR word');
      previousStart=word.startSec;previousEnd=word.endSec;
      const wordId=`${id}.w${index+1}`;confidence.push({id:wordId,probability:word.probability});
      return {id:wordId,text:word.word.trim(),startSec:word.startSec,endSec:word.endSec};
    });
    const measuredText=words.map(word=>word.text).join('');
    // Word spacing can differ from segment spacing; lexical content cannot.
    if(typeof segment.text!=='string'||measuredText.replace(/\s+/g,'')!==segment.text.replace(/\s+/g,''))throw new Error('ASR segment text disagrees with its measured words');
    // Keep the supplied boundaries: concatenating unprefixed words invents compounds.
    const spokenText=segment.text;
    return {id,spokenText,text:spokenText,startSec:words[0].startSec,endSec:words.at(-1)!.endSec,words};
  });
  const scene:NarrationTimingScene={durationSec:window.durationSec,utterances,pauses:[]};
  return {scene,confidence,sourceOffsetSec:window.sourceOffsetSec,
    limitation:'Word times are ASR estimates. This adapter does not prove transcript accuracy, live capture latency, or no future context in the ASR input.'};
}

export function measuredCues(window:AsrWindow,cues:readonly SpeechCue[]){
  const packet=measuredTiming(window),resolved=resolveSpeechCues(packet.scene,cues);
  return {...packet,cues:resolved,sourceCues:Object.fromEntries(Object.entries(resolved).map(([id,cue])=>[id,{
    ...cue,sourceStartSec:window.sourceOffsetSec+cue.startSec,sourceEndSec:window.sourceOffsetSec+cue.endSec,
  }]))};
}
