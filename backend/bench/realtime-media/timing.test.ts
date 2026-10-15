import {expect,test} from 'bun:test';
import {measuredCues,measuredTiming,type AsrWindow} from './timing.js';
const fixture=():AsrWindow=>({id:'window1',durationSec:4,sourceOffsetSec:885,segments:[{text:' minus omega square x.',words:[
  {word:' minus',startSec:.5,endSec:.8,sourceStartSec:885.5,sourceEndSec:885.8,probability:.9},
  {word:' omega',startSec:.8,endSec:1.2,sourceStartSec:885.8,sourceEndSec:886.2,probability:.7},
  {word:' square',startSec:1.3,endSec:1.6,sourceStartSec:886.3,sourceEndSec:886.6,probability:.8},
  {word:' x.',startSec:1.6,endSec:1.9,sourceStartSec:886.6,sourceEndSec:886.9,probability:.5},
]}]});
test('resolves a semantic phrase through exact measured word IDs and source offset',()=>{
  const input=fixture(),before=structuredClone(input),result=measuredCues(input,[{id:'restoring',phrase:'minus omega square x'}]);
  expect(result.cues.restoring.startSec).toBe(.5);expect(result.cues.restoring.endSec).toBe(1.9);
  expect(result.sourceCues.restoring.sourceStartSec).toBe(885.5);expect(result.sourceCues.restoring.sourceEndSec).toBe(886.9);
  expect(result.cues.restoring.wordIds).toHaveLength(4);expect(result.confidence.at(-1)?.probability).toBe(.5);
  expect(input).toEqual(before);
});
test('preserves segment word boundaries when ASR words omit their leading spaces',()=>{
  const input=fixture();
  input.segments[0].text='hello world';
  input.segments[0].words=input.segments[0].words.slice(0,2).map((word,index)=>({...word,word:['hello','world'][index]}));
  const before=structuredClone(input),result=measuredCues(input,[{id:'greeting',phrase:'hello world'}]);
  expect(result.scene.utterances[0].spokenText).toBe('hello world');
  expect(result.cues.greeting.wordIds).toEqual(['window1.u1.w1','window1.u1.w2']);
  expect(result.cues.greeting.startSec).toBe(.5);expect(result.cues.greeting.endSec).toBe(1.2);
  expect(result.sourceCues.greeting.sourceEndSec).toBe(886.2);
  expect(input).toEqual(before);
});
test('maps provider word whitespace to exact segment text without changing punctuation or compounds',()=>{
  const input=fixture();
  input.segments[0].text="Hello, world! It's something.";
  input.segments[0].words=input.segments[0].words.map((word,index)=>({...word,word:[' Hello, ','world! '," It's",' something. '][index]}));
  const result=measuredCues(input,[{id:'phrase',phrase:"world it's something"}]);
  expect(result.scene.utterances[0].spokenText).toBe(input.segments[0].text);
  expect(result.cues.phrase.wordIds).toEqual(['window1.u1.w2','window1.u1.w3','window1.u1.w4']);
  expect(result.cues.phrase.startSec).toBe(.8);expect(result.cues.phrase.endSec).toBe(1.9);
});
test('rejects timing outside the supplied window and inconsistent source clocks',()=>{
  const outside=fixture();outside.segments[0].words[3].endSec=5;
  expect(()=>measuredTiming(outside)).toThrow('out-of-window');
  const wrongClock=fixture();wrongClock.segments[0].words[0].sourceStartSec=886;
  expect(()=>measuredTiming(wrongClock)).toThrow('out-of-window');
});
test('never invents words, repairs transcript content, or silently picks missing cues',()=>{
  const wrongText=fixture();wrongText.segments[0].text='plus omega square x';
  expect(()=>measuredTiming(wrongText)).toThrow('disagrees');
  expect(()=>measuredCues(fixture(),[{id:'missing',phrase:'plus omega'}])).toThrow('not found');
  const unordered=fixture();unordered.segments[0].words.reverse();expect(()=>measuredTiming(unordered)).toThrow();
});
