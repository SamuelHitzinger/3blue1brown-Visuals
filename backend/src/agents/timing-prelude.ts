export interface SpeechCue {
  id: string;
  phrase: string;
  /** One-based occurrence, after optional utterance filtering. Required when ambiguous. */
  occurrence?: number;
  utteranceId?: string;
}
export interface ResolvedSpeechCue {
  id: string; phrase: string; utteranceId: string; wordIds: string[]; startSec: number; endSec: number;
}
interface Span { startSec: number; endSec: number }
interface TimingWord extends Span { id: string; text?: string }
interface TimingUtterance { id?: string; role?: string; text?: string; spokenText?: string; startSec?: number; endSec?: number; words: TimingWord[] }
export interface NarrationTimingScene {
  durationSec: number; utterances: TimingUtterance[]; pauses?: (Span & { id: string })[];
}
export interface HostTimingInput {
  audioAssetId: string; endMode: 'hold' | 'advance'; scene: NarrationTimingScene;
  speechCues?: readonly SpeechCue[];
  resolvedCues?: Readonly<Record<string, ResolvedSpeechCue>>;
}

// Ignore sentence punctuation, preserve decimal/grouping punctuation, numeric signs,
// apostrophes and operators. NFC does not flatten superscripts or numeric notation.
function tokenSpans(text: string) {
  // Find ranges before normalization: NFC and Unicode case folding can change
  // code-unit lengths. These offsets belong to spokenText, not characterRange.
  const pattern=/(?:[+\-−](?=\p{N}))?[\p{L}\p{M}\p{N}]+(?:(?:['’\-]|[.,:/](?=\p{N}))[\p{L}\p{M}\p{N}]+)*(?:[%‰])?|[+\-=<>×÷^−]/gu;
  return [...text.matchAll(pattern)].map(match=>({
    token:match[0].normalize('NFC').toLowerCase().replaceAll('’',"'").replaceAll('−','-'),
    start:match.index!,end:match.index!+match[0].length,
  }));
}
function tokens(text: string): string[] { return tokenSpans(text).map(span=>span.token); }
interface TokenUtterance { id: string; tokens: string[] }
function matchCues(utterances: readonly TokenUtterance[], cues: readonly SpeechCue[]) {
  if (!Array.isArray(cues) || cues.length > 100) throw new Error('Speech cues must be an array with at most 100 entries');
  if (new Set(utterances.map(u=>u.id)).size !== utterances.length) throw new Error('Duplicate narration utterance ID');
  const ids = new Set<string>();
  return cues.map(cue => {
    if (!cue || typeof cue.id !== 'string' || !/^[a-z][a-z0-9_-]{0,127}$/.test(cue.id)) throw new Error('Invalid speech cue ID');
    if (ids.has(cue.id)) throw new Error('Duplicate speech cue ID: '+cue.id);
    ids.add(cue.id);
    if (typeof cue.phrase !== 'string' || !cue.phrase.trim() || cue.phrase.length > 1000) throw new Error('Invalid speech cue phrase: '+cue.id);
    if (cue.occurrence !== undefined && (!Number.isInteger(cue.occurrence) || cue.occurrence < 1)) throw new Error('Invalid speech cue occurrence: '+cue.id);
    if (cue.utteranceId !== undefined && !utterances.some(u=>u.id===cue.utteranceId)) throw new Error('Unknown speech cue utterance: '+cue.utteranceId);
    const phrase=tokens(cue.phrase);
    if (!phrase.length) throw new Error('Speech cue '+cue.id+' has no spoken tokens');
    const matches: {utteranceIndex:number; start:number; end:number}[]=[];
    for (const [utteranceIndex,utterance] of utterances.entries()) {
      if (cue.utteranceId !== undefined && utterance.id !== cue.utteranceId) continue;
      for (let start=0;start<=utterance.tokens.length-phrase.length;start++) {
        if (phrase.every((token,i)=>token===utterance.tokens[start+i])) matches.push({utteranceIndex,start,end:start+phrase.length});
      }
    }
    if (!matches.length || (cue.occurrence ?? 1)>matches.length) throw new Error('Speech cue '+cue.id+' phrase not found: '+cue.phrase);
    if (cue.occurrence === undefined && matches.length > 1) throw new Error('Speech cue '+cue.id+' is ambiguous ('+matches.length+' occurrences); specify occurrence or utteranceId');
    return {cue,...matches[(cue.occurrence??1)-1]};
  });
}

/** Validate against approved speech before synthesis; uses the measured resolver's tokenizer. */
export function validateSpeechCuePhrases(utterances: readonly {id:string;text:string}[], cues: readonly SpeechCue[]): void {
  matchCues(utterances.map(u=>({id:u.id,tokens:tokens(u.text)})),cues);
}

function validateSpan(span: Span, duration: number, label: string): void {
  if (![span.startSec,span.endSec].every(Number.isFinite) || span.startSec<0 || span.endSec<span.startSec || span.endSec>duration+1e-6) throw new Error('Invalid narration '+label+' timing');
}

/** Reconstruct exact monotone word spans without treating provider character-array
 * indices as UTF-16 offsets. Every lexical character must belong to a timed word;
 * only punctuation/whitespace may occur between words. Never guess from source
 * wording when an authoritative spokenText exists. */
function measuredUtterance(utterance: TimingUtterance, duration: number) {
  if (!utterance.id) throw new Error('Speech cue resolution requires narration utterance IDs');
  const text=utterance.spokenText??utterance.text;
  if (typeof text!=='string') throw new Error('Cannot map narration words without spokenText or verified source text: '+utterance.id);
  let cursor=0;
  const lexical=/[\p{L}\p{N}\p{M}]/u;
  const wordSpans=utterance.words.map((word,index)=>{
    if (typeof word.text!=='string' || !word.text.length) throw new Error('Speech cue resolution requires word text: '+word.id);
    validateSpan(word,duration,'word');
    const previous=utterance.words[index-1];
    if (previous && (word.startSec<previous.startSec || word.endSec<previous.endSec)) throw new Error('Cannot map unordered narration word timing: '+word.id);
    const start=text.indexOf(word.text,cursor),end=start+word.text.length;
    if (start<0 || lexical.test(text.slice(cursor,start))) throw new Error('Cannot map narration word exactly to spoken text: '+word.id);
    cursor=end;
    return {start,end};
  });
  if (lexical.test(text.slice(cursor))) throw new Error('Cannot map all spoken text to narration words: '+utterance.id);
  let nextWord=0;
  const indexed=tokenSpans(text).map(token=>{
    while (nextWord<wordSpans.length && wordSpans[nextWord].end<=token.start) nextWord++;
    let last=nextWord;
    while (last+1<wordSpans.length && wordSpans[last+1].start<token.end) last++;
    const overlaps=nextWord<wordSpans.length && wordSpans[nextWord].start<token.end;
    return {...token,first:overlaps?nextWord:-1,last:overlaps?last:-1};
  });
  return {id:utterance.id,text,words:utterance.words,wordSpans,indexed,tokens:indexed.map(t=>t.token)};
}

/** Resolve named semantic anchors to immutable, measured local word spans. */
export function resolveSpeechCues(scene: NarrationTimingScene, cues: readonly SpeechCue[]): Record<string, ResolvedSpeechCue> {
  if (!Number.isFinite(scene.durationSec) || scene.durationSec<0) throw new Error('Invalid narration duration');
  if (!cues.length) return {};
  const utterances=scene.utterances.map(u=>measuredUtterance(u,scene.durationSec));
  const result: Record<string,ResolvedSpeechCue>=Object.create(null);
  for (const {cue,utteranceIndex,start,end} of matchCues(utterances,cues)) {
    const utterance=utterances[utteranceIndex];
    const selected=utterance.indexed.slice(start,end),timed=selected.filter(token=>token.first>=0);
    if (!timed.length) throw new Error('Speech cue '+cue.id+' has no measured words');
    const first=timed[0].first,last=timed.at(-1)!.last;
    // Subtitle words can include several lexical tokens (for example x=1).
    // A partial match cannot claim a more precise span than its timed word.
    if (tokens(utterance.text.slice(utterance.wordSpans[first].start,selected[0].start)).length
      || tokens(utterance.text.slice(selected.at(-1)!.end,utterance.wordSpans[last].end)).length) throw new Error('Speech cue '+cue.id+' cannot map to a partial measured word');
    const words=utterance.words.slice(first,last+1);
    result[cue.id]={id:cue.id,phrase:cue.phrase,utteranceId:utterance.id,wordIds:words.map(w=>w.id),startSec:words[0].startSec,endSec:words.at(-1)!.endSec};
  }
  return result;
}

export const TIMING_PRELUDE_INSTRUCTIONS = [
'The host supplies a read-only __narration constant before your source. Do not declare it or copy its timing table into your output. Its API is:',
'__narration.audioAssetId (exact assigned audio ID), __narration.endMode, __narration.durationSec,',
'__narration.start(fullWordId) and __narration.end(fullWordId) (exact local startSec/endSec; unknown IDs throw).',
'Frozen words, utterances, pauses and cues maps contain measured startSec/endSec. cue(id), utterance(id), and pause(id) return exact frozen intervals and throw on unknown IDs.',
"Prefer s.compose(prefix, parts) for reusable named parts and s.schedule(__narration, operations) for chronological speech-aligned operations. An operation has a stable id and may use cue:'named-cue' for its full measured span, or at:{cue:'named-cue'} (or word/utterance/pause ID), through:{cue:'named-cue',edge:'end'} OR duration, and actions or reveal:[handles]. No timestamp arithmetic or final wait is needed: schedule fills the gaps and holds to durationSec. Omit through/duration for an instant change. Operations cannot overlap or change information during explicit pauses. Use notBefore:{utterance:'reveal-utterance-id'} for answer-bearing changes. Top-level actions run concurrently. For ordered changes within one cue/window, use steps instead of top-level actions/reveal: 1–64 flat {actions,reveal,weight} entries; weight defaults to 1, must be finite and nonnegative, and weight:0 is instant. Positive windows require positive total weight. The host divides the window and applies the operation's ease to every step. Custom geometry and direct s.play/s.wait remain available. Direct timed actions before schedule must finish before its first anchor. Do not append timed actions after schedule, which finishes at measured duration.",
"LaTeX morphTo always needs an explicit {map:...}; an empty map crossfades parts. For whole-label replacement without visible glyph overlap, hide, update instantly while hidden, then reveal: {id:'replace-label',cue:'new-value',steps:[{actions:label.fadeOut()},{weight:0,actions:label.morphTo({kind:'latex',tex:'y'},{map:{}})},{reveal:[label]}]}.",
'Preserve explanatory operations, composition, labels, pauses and timing. Return a complete default-exported scene as usual. Validation and playback prepend the same one-line host constant automatically; diagnostics include that extra source line.',
].join('\n');

/** Deterministic source assembly; saved source contains all resolved host timing. */
export function attachTimingPrelude(source: string, input: HostTimingInput): string {
  const {durationSec}=input.scene;
  if (!Number.isFinite(durationSec) || durationSec<0) throw new Error('Invalid narration duration');
  const words:Record<string,Span>=Object.create(null),utterances:Record<string,Span & {role?:string}>=Object.create(null),pauses:Record<string,Span>=Object.create(null);
  for (const utterance of input.scene.utterances) {
    if (utterance.id!==undefined) {
      if (Object.hasOwn(utterances,utterance.id)) throw new Error('Duplicate narration utterance ID: '+utterance.id);
      const span={startSec:utterance.startSec!,endSec:utterance.endSec!};validateSpan(span,durationSec,'utterance');
      utterances[utterance.id]={...span,...(utterance.role?{role:utterance.role}:{})};
    }
    for (const word of utterance.words) {
      if (Object.hasOwn(words,word.id)) throw new Error('Duplicate narration word ID: '+word.id);
      validateSpan(word,durationSec,'word');
      words[word.id]={startSec:word.startSec,endSec:word.endSec};
    }
  }
  for (const pause of input.scene.pauses??[]) {
    if (Object.hasOwn(pauses,pause.id)) throw new Error('Duplicate narration pause ID: '+pause.id);
    validateSpan(pause,durationSec,'pause');pauses[pause.id]={startSec:pause.startSec,endSec:pause.endSec};
  }
  const cues=input.resolvedCues??resolveSpeechCues(input.scene,input.speechCues??[]);
  for (const [id,cue] of Object.entries(cues)) {
    const utterance=input.scene.utterances.find(u=>u.id===cue.utteranceId);
    const start=utterance?.words.findIndex(w=>w.id===cue.wordIds[0])??-1;
    const span=start<0?[]:utterance!.words.slice(start,start+cue.wordIds.length);
    if (cue.id!==id || !span.length || span.length!==cue.wordIds.length || span.some((w,i)=>w.id!==cue.wordIds[i])
      || cue.startSec!==span[0].startSec || cue.endSec!==span.at(-1)!.endSec) throw new Error('Resolved speech cue '+id+' does not match this narration');
  }
  const data=JSON.stringify({audioAssetId:input.audioAssetId,endMode:input.endMode,durationSec,words,utterances,pauses,cues});
  // JSON.parse preserves keys such as __proto__; deep freeze protects all timing maps.
  const prelude="const __narration=(()=>{const data=JSON.parse("+JSON.stringify(data)+");const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};const get=(map,id,label)=>{if(!Object.hasOwn(map,id))throw new Error('Unknown narration '+label+' ID: '+id);return map[id];};return freeze({...data,start:id=>get(data.words,id,'word').startSec,end:id=>get(data.words,id,'word').endSec,cue:id=>get(data.cues,id,'cue'),utterance:id=>get(data.utterances,id,'utterance'),pause:id=>get(data.pauses,id,'pause')});})();";
  return prelude+'\n'+source;
}
