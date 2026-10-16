import {expect,test} from 'bun:test';
import {joinSpeechTiming,resolveOperationSpeechAnchor,measureSpeechRender} from './speech-anchor.js';
import type {LocalAsrTrial} from './replay.js';
const trial=():LocalAsrTrial=>({windowStartSec:0,windowEndSec:4,sourceWindowStartSec:100,sourceWindowEndSec:104,
 availableAfterSourceSec:104,inferenceMs:200,text:'move right then move right',segments:[{text:'move right then move right',words:
 ['move','right','then','move','right'].map((word,i)=>({word,startSec:i*.5,endSec:(i+1)*.5,sourceStartSec:100+i*.5,sourceEndSec:100+(i+1)*.5,probability:.8}))}]});
const evidence=(id='chunk-1',version=1)=>({id,version,kind:'transcript' as const,sourceId:'lecture',sourceStartMs:100000,sourceEndMs:104000,
 sourceReadyAtMs:5000,availableAtMs:5300,text:trial().text,speech:joinSpeechTiming(trial(),{sourceStartMs:100000,monotonicStartMs:1000,rate:1})});
const anchor=(more={})=>({evidenceId:'chunk-1',version:1,phrase:'move right',occurrence:1,utteranceId:null,...more});
test('host resolves exact phrase without timestamp arithmetic from the model',()=>{
 const input=evidence(),before=structuredClone(input),cue=resolveOperationSpeechAnchor(anchor(),[input],6000)!;
 expect(cue).toMatchObject({evidenceId:'chunk-1',version:1,wordIds:['window.u1.w1','window.u1.w2'],sourceStartMs:100000,sourceEndMs:101000,hostStartMs:1000,hostEndMs:2000,deadlineMs:12000});
 expect(input).toEqual(before);
});
test('phrase age can fail while four-second chunk endpoint passes',()=>{
 const cue=resolveOperationSpeechAnchor(anchor(),[evidence()],6000)!;
 const measurement=measureSpeechRender(cue,{serverLowerMs:14490,serverUpperMs:14500});
 expect(14500-evidence().sourceReadyAtMs).toBeLessThan(10000);
 expect(measurement).toMatchObject({cueEndToRenderLowerMs:12490,cueEndToRenderUpperMs:12500,withinDeadline:false,hardwarePresentedAtMs:null});
});
test('evidence/version qualification prevents identical local word IDs crossing chunks',()=>{
 expect(resolveOperationSpeechAnchor(anchor({evidenceId:'chunk-2'}),[evidence(),evidence('chunk-2')],6000)?.evidenceId).toBe('chunk-2');
 for(const request of [anchor({version:2}),anchor({evidenceId:'missing'}),anchor({phrase:'invented'})])
  expect(()=>resolveOperationSpeechAnchor(request,[evidence()],6000)).toThrow();
 expect(()=>resolveOperationSpeechAnchor(anchor(),[evidence()],5200)).toThrow('available');
});
test('ambiguous, cross-window and absent speech anchors never acquire guessed times',()=>{
 expect(()=>resolveOperationSpeechAnchor(anchor({occurrence:null}),[evidence()],6000)).toThrow('ambiguous');
 expect(()=>resolveOperationSpeechAnchor(anchor({phrase:'right next window'}),[evidence()],6000)).toThrow('not found');
 expect(()=>resolveOperationSpeechAnchor(null,[evidence()],6000)).toThrow('speech anchor');
 expect(resolveOperationSpeechAnchor(null,[{...evidence(),kind:'frame',speech:undefined}],6000)).toBeNull();
});
test('source offsets and non-unit playback rates map both edges, retaining measured confidence',()=>{
 const input=evidence();input.speech=joinSpeechTiming(trial(),{sourceStartMs:100000,monotonicStartMs:1000,rate:2});
 input.sourceReadyAtMs=3000;input.availableAtMs=3300;
 const cue=resolveOperationSpeechAnchor(anchor({occurrence:2}),[input],4000)!;
 expect(cue).toMatchObject({sourceStartMs:101500,sourceEndMs:102500,hostStartMs:1750,hostEndMs:2250,minWordProbability:.8});
 expect(measureSpeechRender(cue,{serverLowerMs:4000,serverUpperMs:4010}).cueEndToRenderUpperMs).toBe(1760);
});
test('rejects invalid source clocks, mismatched transcript and reversed browser clock bounds',()=>{
 expect(()=>joinSpeechTiming(trial(),{monotonicStartMs:0,rate:0})).toThrow();
 const wrong=trial();wrong.text='different';expect(()=>joinSpeechTiming(wrong,{monotonicStartMs:0})).toThrow('text');
 const cue=resolveOperationSpeechAnchor(anchor(),[evidence()],6000)!;
 expect(()=>measureSpeechRender(cue,{serverLowerMs:7000,serverUpperMs:6990})).toThrow();
 const malformed=evidence();malformed.sourceReadyAtMs=9999;
 expect(()=>resolveOperationSpeechAnchor(anchor(),[malformed],10000)).toThrow('clock');
});
