import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';

const directory=resolve(process.argv[2]??'');
if(!process.argv[2])throw Error('Supply the completed latency evidence directory.');
const manifest=JSON.parse(await readFile(join(directory,'manifest.json'),'utf8'));
const events=(await readFile(join(directory,'events.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
const logs=JSON.parse(await readFile(join(directory,'browser-timing.json'),'utf8'));
const browser=logs.map(entry=>JSON.parse(entry.message.slice(entry.message.indexOf('LIVE_ANIMATION_TIMING ')+22)));
const stream=events.find(event=>event.type==='stream_start');if(!stream)throw Error('Missing stream clock.');
const completed=events.filter(event=>event.type==='animation_request_complete'&&event.reply?.submission);
const rounded=value=>Math.round(value*1000)/1000;
const actions={create:reply=>reply.action==='add',motion:reply=>reply.action==='motion'&&reply.motionChanges?.some(change=>change.velocity.some(value=>value!==0)),stop:reply=>reply.action==='motion'&&reply.motionChanges?.length&&reply.motionChanges.every(change=>change.velocity.every(value=>value===0)),replace:reply=>reply.action==='replace'};
const outcomes=manifest.cues.map(cue=>{
  const completion=completed.find(event=>actions[cue.id]?.(event.reply.submission));
  if(!completion)return {cue:cue.id,text:cue.text,status:'not-applied',speechStartEpochMs:stream.epochMs+cue.speechStartMs,speechEndEpochMs:stream.epochMs+cue.speechEndMs};
  const sourceIds=completion.reply.evidence.changes.map(ref=>ref.id);
  const response=browser.find(event=>event.kind==='response'&&event.sourceCursor===completion.reply.sourceCursor&&event.baseRevision===completion.reply.baseRevision);
  if(!response)throw Error('Missing browser response timing.');
  const observed=kind=>browser.find(event=>event.kind===kind&&event.requestId===response.requestId);
  const rendered=observed('render-submitted'),next=observed('next-frame-opportunity'),request=observed('request-start'),commit=observed('commit');
  if(!rendered||!next||!request||!commit)throw Error('Missing render timing.');
  const sources=events.filter(event=>event.type==='source_appended'&&sourceIds.includes(event.sourceId));
  const latest=sources.reduce((a,b)=>a.epochMs>b.epochMs?a:b);
  const lastWindowEnd=Math.max(...sources.map(source=>Date.parse(source.capture.capturedAt)+source.capture.durationMs));
  const speechStart=stream.epochMs+cue.speechStartMs,speechEnd=stream.epochMs+cue.speechEndMs;
  return {cue:cue.id,text:cue.text,status:'applied-not-necessarily-visible',sourceIds,transcriptUsed:sources.map(source=>source.text),
    completePhraseCoveredByRequest:lastWindowEnd>=speechEnd,
    fromSpeechStartToFrameOpportunityMs:rounded(next.epochMs-speechStart),fromSpeechEndToRenderSubmissionMs:rounded(rendered.epochMs-speechEnd),fromSpeechEndToFrameOpportunityMs:rounded(next.epochMs-speechEnd),
    stagesMs:{speechEndToLastUsedSource:rounded(latest.epochMs-speechEnd),sourceToBrowserRequest:rounded(request.epochMs-latest.epochMs),requestToResponse:rounded(response.epochMs-request.epochMs),responseToCommit:rounded(commit.epochMs-response.epochMs),commitToRender:rounded(rendered.epochMs-commit.epochMs),renderToNextFrameOpportunity:rounded(next.epochMs-rendered.epochMs)},
    renderBackend:rendered.backend};
});
const transcription=events.filter(event=>event.type==='transcription_complete').map(event=>event.monotonicMs-events.find(start=>start.type==='transcription_start'&&start.clientId===event.clientId).monotonicMs);
const sorted=transcription.toSorted((a,b)=>a-b);
const result={test:'Paced synthetic speech through actual capture ingestion, ElevenLabs ASR, OpenAI model and main-app WebGPU renderer',
  excluded:'Phone/network hardware, MediaRecorder encoding and physical monitor presentation. Notes synthesis disabled in isolated fixture.',
  outcomes,transcription:{count:sorted.length,minMs:rounded(sorted[0]),medianMs:rounded(sorted[Math.floor(sorted.length/2)]),maxMs:rounded(sorted.at(-1)),empty:events.filter(event=>event.type==='transcription_complete'&&!event.text).length},
  modelDecisions:completed.map(event=>({action:event.reply.submission.action,reason:event.reply.submission.reason,sourceCursor:event.reply.sourceCursor})),
  visualReview:{create:'Cube visible in first-visible.png.',motion:'Applied exact speed before complete per-second evidence reached the request; not a grounded exact-speed success.',stop:'Applied after cube left viewport; final screenshot blank, so not a visible stop success.',replace:'Model deferred despite complete shape evidence; no replacement rendered.'}};
await writeFile(join(directory,'summary.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
