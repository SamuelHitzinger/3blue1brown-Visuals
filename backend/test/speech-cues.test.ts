import { expect, test } from 'bun:test';
import * as timing from '../src/agents/timing-prelude.js';
import { compileSource, evaluateScene } from '../../shared/animlib/src/core.js';
import { alignWords } from '../src/narration/alignment.js';

const scene = {durationSec:8, utterances:[
  {id:'beat-1.u1',role:'narration',text:'Move the blue point. Move the red point.',startSec:0,endSec:4,
    words:['Move','the','blue','point.','Move','the','red','point.'].map((text,i)=>({id:`w${i}`,text,startSec:i*.5,endSec:(i+1)*.5}))},
  {id:'beat-1.u2',role:'reveal',text:'The answer is two.',startSec:5,endSec:7,
    words:['The','answer','is','two.'].map((text,i)=>({id:`a${i}`,text,startSec:5+i*.5,endSec:5+(i+1)*.5}))},
],pauses:[{id:'p1',startSec:4,endSec:5}]};

test('resolves punctuation and case to exact measured word spans',()=>{
  expect(typeof timing.resolveSpeechCues).toBe('function');
  expect(timing.resolveSpeechCues(scene,[{id:'move-blue',phrase:'MOVE the blue point!'}])).toEqual({
    'move-blue':{id:'move-blue',phrase:'MOVE the blue point!',utteranceId:'beat-1.u1',wordIds:['w0','w1','w2','w3'],startSec:0,endSec:2},
  });
});

test('requires explicit occurrence for repeated phrases, and never crosses utterances',()=>{
  expect(typeof timing.resolveSpeechCues).toBe('function');
  expect(()=>timing.resolveSpeechCues(scene,[{id:'move',phrase:'Move the'}])).toThrow('ambiguous');
  expect(timing.resolveSpeechCues(scene,[{id:'move',phrase:'Move the',occurrence:2}]).move.wordIds).toEqual(['w4','w5']);
  expect(()=>timing.resolveSpeechCues(scene,[{id:'cross',phrase:'red point the answer'}])).toThrow('not found');
  expect(()=>timing.resolveSpeechCues(scene,[{id:'answer',phrase:'answer',utteranceId:'absent'}])).toThrow('utterance');
});

test('pre-speech validation shares exact phrase matching and rejects meaning-changing numeric normalization',()=>{
  expect(typeof timing.validateSpeechCuePhrases).toBe('function');
  const utterances=[{id:'u1',text:'Compare -1, 1.5, 15, and 1,000.'}];
  timing.validateSpeechCuePhrases(utterances,[{id:'decimal',phrase:'1.5'}]);
  timing.validateSpeechCuePhrases(utterances,[{id:'integer',phrase:'15'}]);
  for(const phrase of ['1','1000','+1','1.50']) expect(()=>timing.validateSpeechCuePhrases(utterances,[{id:'bad',phrase}])).toThrow('not found');
  expect(()=>timing.validateSpeechCuePhrases(scene.utterances,[{id:'move',phrase:'move the'}])).toThrow('ambiguous');
  expect(()=>timing.validateSpeechCuePhrases(utterances,[{id:'a',phrase:'15'},{id:'a',phrase:'1.5'}])).toThrow('Duplicate');
});

test('never matches part of an alphanumeric or superscript word',()=>{
  const utterances=[{id:'u1',text:'Compare H2O, x², and 1e3.'}];
  for(const phrase of ['H','2','O','x','1','3']) expect(()=>timing.validateSpeechCuePhrases(utterances,[{id:'partial',phrase}])).toThrow('not found');
  for(const phrase of ['H2O','x²','1e3']) timing.validateSpeechCuePhrases(utterances,[{id:'whole',phrase}]);
});

function alignedScene(spokenText:string) {
  // Astral characters make character-array indices differ from UTF-16 offsets.
  const characters=Array.from(spokenText), aligned=alignWords({characters,
    character_start_times_seconds:characters.map((_,i)=>i/10),
    character_end_times_seconds:characters.map((_,i)=>(i+1)/10)},'u1',0);
  return {durationSec:characters.length/10,utterances:[{id:'u1',text:spokenText,spokenText:aligned.text,
    startSec:0,endSec:characters.length/10,words:aligned.words}],pauses:[]};
}

test('production alignment resolves signed decimals, grouping and percentages without flattening meaning',()=>{
  const measured=alignedScene('😀 Compare -1, 1.5, 1,000, 50%, and +2.');
  expect(measured.utterances[0].words.map(w=>w.text)).toEqual(['Compare','1','1','5','1','000','50','and','2']);
  const cues=[{id:'negative',phrase:'-1'},{id:'decimal',phrase:'1.5'},{id:'grouped',phrase:'1,000'},
    {id:'percent',phrase:'50%'},{id:'positive',phrase:'+2'}];
  timing.validateSpeechCuePhrases(measured.utterances,cues);
  const resolved=timing.resolveSpeechCues(measured,cues), words=measured.utterances[0].words;
  for(const [id,first,last] of [['negative',1,1],['decimal',2,3],['grouped',4,5],['percent',6,6],['positive',8,8]] as const){
    expect(resolved[id].wordIds).toEqual(words.slice(first,last+1).map(w=>w.id));
    expect(resolved[id].startSec).toBe(words[first].startSec);
    expect(resolved[id].endSec).toBe(words[last].endSec);
  }
  for(const phrase of ['1','5','000','1000','50','2']) expect(()=>timing.resolveSpeechCues(measured,[{id:'partial',phrase}])).toThrow('not found');
});

test('production alignment preserves compounds and chooses repeated numeric spans by occurrence',()=>{
  const measured=alignedScene('Use H2O, x², twenty-two, and 1e3. Compare -1 and -1.');
  const result=timing.resolveSpeechCues(measured,[{id:'compound',phrase:'H2O, x², twenty-two, and 1e3'},
    {id:'second',phrase:'-1',occurrence:2}]);
  expect(result.compound.wordIds).toEqual(['u1.w2','u1.w3','u1.w4','u1.w5','u1.w6']);
  expect(result.second.wordIds).toEqual(['u1.w10']);
  expect(()=>timing.resolveSpeechCues(measured,[{id:'ambiguous',phrase:'-1'}])).toThrow('ambiguous');
  for(const phrase of ['H','2','O','x','twenty','two','1','3']) expect(()=>timing.resolveSpeechCues(measured,[{id:'partial',phrase}])).toThrow('not found');
});

test('spoken text is authoritative and source fallback requires a complete exact word mapping',()=>{
  const measured=alignedScene('The value is sixty four.');
  measured.utterances[0].text='The value is 64.';
  expect(timing.resolveSpeechCues(measured,[{id:'expanded',phrase:'sixty four'}]).expanded.wordIds).toEqual(['u1.w4','u1.w5']);
  expect(()=>timing.resolveSpeechCues(measured,[{id:'original',phrase:'64'}])).toThrow('not found');
  const noSpokenText=structuredClone(measured) as {durationSec:number;utterances:{id:string;text:string;spokenText?:string;startSec:number;endSec:number;words:typeof measured.utterances[0]['words']}[]};
  delete noSpokenText.utterances[0].spokenText;
  expect(()=>timing.resolveSpeechCues(noSpokenText,[{id:'invalid',phrase:'sixty four'}])).toThrow('map');
  noSpokenText.utterances[0].text='The value is sixty four.';
  expect(timing.resolveSpeechCues(noSpokenText,[{id:'fallback',phrase:'sixty four'}]).fallback.wordIds).toEqual(['u1.w4','u1.w5']);
  measured.utterances[0].words.splice(0,1);
  expect(()=>timing.resolveSpeechCues(measured,[{id:'omitted',phrase:'sixty four'}])).toThrow('map');
});

test('named cues retime automatically and remain immutable in a standalone saved scene',async()=>{
  expect(typeof timing.resolveSpeechCues).toBe('function');
  const source=`export default scene({audio:__narration.audioAssetId,end:__narration.endMode},s=>{
    const dot=s.circle('dot');
    __narration.cues.answer.startSec=0;__narration.pauses.p1.startSec=0;
    s.schedule(__narration,[{id:'answer',at:{cue:'answer'},through:{cue:'answer',edge:'end'},reveal:[dot],notBefore:{utterance:'beat-1.u2'}}]);
  });`;
  const input={audioAssetId:'audio',endMode:'hold' as const,scene,speechCues:[{id:'answer',phrase:'The answer is two'}]};
  const compiled=await compileSource(timing.attachTimingPrelude(source,input));
  expect(compiled.tracks.map(t=>[t.start,t.duration])).toEqual([[5,2]]);
  expect(compiled.duration).toBe(8);
  expect(evaluateScene(compiled,4.5).elements.find(e=>e.id==='dot')!.opacity).toBe(0);
  const changed=structuredClone(input);changed.scene.utterances[1].startSec=5.5;
  changed.scene.utterances[1].words.forEach(w=>{w.startSec+=.5;w.endSec+=.5;});changed.scene.utterances[1].endSec=7.5;
  const retimed=await compileSource(timing.attachTimingPrelude(source,changed));
  expect(retimed.tracks[0].start).toBe(5.5);
});
