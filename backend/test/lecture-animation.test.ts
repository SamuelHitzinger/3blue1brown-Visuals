import {afterEach,expect,test} from 'bun:test';
import {LectureService} from '../src/lectures.js';
import {LectureAnimationService,type LectureAnimationInput,type LectureAnimationOptions} from '../src/lecture-animation.js';
import {createHandler} from '../src/server.js';

const services:LectureService[]=[],animations:LectureAnimationService[]=[];
afterEach(async()=>{for(const animation of animations.splice(0))animation.close();await Promise.all(services.splice(0).map(service=>service.close()));});
const submission={action:'add',source:'export default scene({},s=>{s.box("cube");});',changes:[],remove:[],parameterProgramId:'',parameterValues:[],motionChanges:[],replacementProgramId:'',speechAnchor:null};
const body={sourceCursor:0,baseRevision:0,world:{summary:{revision:0}}};
function request(id:string,input:unknown=body,options:RequestInit={}){
 const headers=new Headers({'x-user-id':'alice','Content-Type':'application/json'});new Headers(options.headers).forEach((value,key)=>headers.set(key,value));
 return new Request(`http://localhost/api/lectures/${id}/animation`,{method:'POST',...options,
  headers,
  ...(options.method==='GET'?{}:{body:JSON.stringify(input)})});
}
async function setup(generate:LectureAnimationOptions['generate']=async()=>submission,timeoutMs=10000){
 const lectures=new LectureService(':memory:');services.push(lectures);
 const response=await lectures.handle(new Request('http://localhost/api/lectures',{method:'POST',headers:{'x-user-id':'alice','Idempotency-Key':'create'},body:'{}'}));
 const {id}=await response.json();const animation=new LectureAnimationService(lectures,{generate,timeoutMs});animations.push(animation);
 return {id:id as string,lectures,animation,append:(text:string,key=crypto.randomUUID())=>lectures.appendSource('user:alice',id,key,text)};
}
function deferred<T=void>(){let resolve!:(value:T)=>void;return {promise:new Promise<T>(r=>resolve=r),resolve};}

test('idle makes no generation request and rejects cursors beyond server evidence',async()=>{
 let calls=0;const {id,animation}=await setup(async()=>{calls++;return submission;});
 expect(await (await animation.handle(request(id))).json()).toEqual({sourceCursor:0,baseRevision:0,idle:true});
 expect((await animation.handle(request(id,{...body,sourceCursor:1}))).status).toBe(409);expect(calls).toBe(0);
});
test('uses arrived server sources without waiting for notes and returns authentic evidence references',async()=>{
 let input:LectureAnimationInput|undefined;const {id,animation,append}=await setup(async value=>{input=value;return submission;});
 const saved=append('A cube is present.');
 const response=await animation.handle(request(id,{...body,world:{summary:{revision:0},changes:[{text:'client invented speed'}]}}));
 expect(response.status).toBe(200);const result=await response.json();
 expect(input!.changes.map(source=>source.text)).toEqual(['A cube is present.']);expect(input!.context).toEqual([]);
 expect(result.sourceCursor).toBe(1);expect(result.baseRevision).toBe(0);expect(result.programId).toMatch(/^live-/);
 expect(result.evidence.changes).toEqual([{id:saved.sources[0].id,version:1}]);expect(result.submission.action).toBe('add');
});
test('owner, origin, reader credentials, method and request limits fail before generation',async()=>{
 let calls=0;const {id,animation,append}=await setup(async()=>{calls++;return submission;});append('Evidence.');
 expect((await animation.handle(request(id,body,{headers:{'x-user-id':'bob'}}))).status).toBe(404);
 expect((await animation.handle(request(id,body,{headers:{origin:'https://attacker.test'}}))).status).toBe(403);
 expect((await animation.handle(request(id,body,{headers:{authorization:'Bearer reader'}}))).status).toBe(401);
 expect((await animation.handle(request(id,body,{method:'GET'}))).status).toBe(405);
 expect((await animation.handle(request(id,{...body,evidence:['forged']}))).status).toBe(400);
 expect((await animation.handle(request(id,{...body,world:{text:'x'.repeat(40001)}}))).status).toBe(413);
 expect((await animation.handle(request(id,{...body,world:{summary:{revision:1}}}))).status).toBe(409);expect(calls).toBe(0);
});
test('selects bounded whole source batches and only earlier context',async()=>{
 let input:LectureAnimationInput|undefined;const {id,animation,append}=await setup(async value=>{input=value;return {...submission,action:'defer',source:'',reason:'More detail is needed.'};});
 for(let i=0;i<7;i++)append(`source ${i+1}`);
 const response=await (await animation.handle(request(id,{...body,sourceCursor:1}))).json();
 expect(input!.changes.map(source=>source.sequence)).toEqual([2,3,4,5]);expect(input!.context.map(source=>source.sequence)).toEqual([1]);
 expect(response.sourceCursor).toBe(5);expect(response.submission.action).toBe('defer');
});

test('preserves arrived visual evidence and capture provenance without claiming speech times',async()=>{
 let input:LectureAnimationInput|undefined;const {id,lectures,animation}=await setup(async value=>{input=value;return submission;});
 const capture={kind:'photo' as const,itemId:crypto.randomUUID(),sequence:7,capturedAt:'2026-10-16T12:00:00.000Z',visualEvidence:'Three blue nodes form a triangle; red arrow connects left to top.'};
 lectures.appendSource('user:alice',id,'photo','A graph diagram.',capture);
 expect((await animation.handle(request(id))).status).toBe(200);
 expect(input!.changes[0]).toMatchObject({text:'A graph diagram.',capture});
});

test('uses latest already-arrived frame beyond audio batch without skipping queued audio',async()=>{
 let frame:unknown,selected:LectureAnimationInput|undefined;const {id,lectures,append}=await setup();
 const resolved:string[]=[];
 const animation=new LectureAnimationService(lectures,{generate:async(input,_signal,image)=>{selected=input;frame=image;expect(JSON.stringify(input)).not.toContain('bytes');return submission;},
  resolveFrame:(owner,lectureId,sourceId)=>{expect(owner).toBe('user:alice');expect(lectureId).toBe(id);resolved.push(sourceId);return {bytes:new Uint8Array([255,216,255,1]),mimeType:'image/jpeg'};}});animations.push(animation);
 for(let i=0;i<6;i++)append(`Audio ${i}`);
 const photo=lectures.appendSource('user:alice',id,'photo','A diagram',{kind:'photo',itemId:crypto.randomUUID(),sequence:1,capturedAt:'2026-10-16T12:00:00.000Z'}).sources.at(-1)!;
 const first=await animation.handle(request(id));expect(first.status).toBe(200);expect(resolved).toEqual([photo.id]);
 expect((await first.json()).sourceCursor).toBe(4);
 expect(selected!.changes.map(source=>source.sequence)).toEqual([1,2,3,4]);
 expect(selected!.context.map(source=>source.id)).toEqual([photo.id]);
 expect((await animation.handle(request(id,{...body,sourceCursor:4}))).status).toBe(200);expect(resolved).toEqual([photo.id,photo.id]);
 expect(selected!.changes.map(source=>source.sequence)).toEqual([5,6,7]);
 expect(selected!.context.some(source=>source.id===photo.id)).toBe(false);
 expect(frame).toMatchObject({sourceId:photo.id,capturedAt:photo.capture!.capturedAt,mimeType:'image/jpeg'});
});

test('retains latest prior visual source beyond four recent audio sources, without duplicate context',async()=>{
 let input:LectureAnimationInput|undefined;const {id,lectures,animation,append}=await setup(async value=>{input=value;return submission;});
 const photo=(sequence:number)=>({kind:'photo' as const,itemId:crypto.randomUUID(),sequence,capturedAt:'2026-10-16T12:00:00.000Z',visualEvidence:`Diagram ${sequence}`});
 lectures.appendSource('user:alice',id,'old-photo','Old diagram',photo(1));
 lectures.appendSource('user:alice',id,'current-photo','Current diagram',photo(2));
 for(let i=0;i<6;i++)append(`Audio ${i}`);
 append('New arriving detail');
 expect((await animation.handle(request(id,{...body,sourceCursor:8}))).status).toBe(200);
 expect(input!.context.map(source=>source.sequence)).toEqual([2,5,6,7,8]);
 expect((await animation.handle(request(id,{...body,sourceCursor:2}))).status).toBe(200);
 expect(input!.context.map(source=>source.sequence)).toEqual([1,2]);
});

test('rejects changed visual evidence before publication even when source text stays identical',async()=>{
 const entered=deferred(),gate=deferred<unknown>();const {id,lectures,animation}=await setup(async()=>{entered.resolve();return gate.promise;});
 lectures.appendSource('user:alice',id,'photo','Same caption',{kind:'photo',itemId:crypto.randomUUID(),sequence:1,capturedAt:'2026-10-16T12:00:00.000Z',visualEvidence:'Blue triangle'});
 const pending=animation.handle(request(id));await entered.promise;
 const original=lectures.getOwned.bind(lectures);
 lectures.getOwned=(owner,lectureId)=>{const session=original(owner,lectureId);if(session?.sources[0].capture)session.sources[0].capture.visualEvidence='Red square';return session;};
 gate.resolve(submission);expect((await pending).status).toBe(409);
});

test('fails explicitly rather than clipping oversized retained photo context',async()=>{
 let calls=0;const {id,lectures,animation,append}=await setup(async()=>{calls++;return submission;});
 lectures.appendSource('user:alice',id,'photo','Diagram '.repeat(1200),{kind:'photo',itemId:crypto.randomUUID(),sequence:1,capturedAt:'2026-10-16T12:00:00.000Z'});
 append('New detail');
 expect((await animation.handle(request(id,{...body,sourceCursor:1}))).status).toBe(413);expect(calls).toBe(0);
});
test('keeps one underlying generation active per lecture through request cancellation',async()=>{
 const entered=deferred(),gate=deferred<unknown>();let signal:AbortSignal|undefined;
 const {id,animation,append}=await setup(async(_,s)=>{signal=s;entered.resolve();return gate.promise;});append('Evidence.');
 const controller=new AbortController(),pending=animation.handle(request(id,body,{signal:controller.signal}));await entered.promise;
 expect((await animation.handle(request(id))).status).toBe(409);controller.abort();expect((await pending).status).toBe(408);expect(signal!.aborted).toBe(true);
 expect((await animation.handle(request(id))).status).toBe(409);gate.resolve(submission);await Bun.sleep(0);
 expect((await animation.handle(request(id))).status).toBe(200);
});
test('enforces deadline even if injected provider ignores cancellation',async()=>{
 let signal:AbortSignal|undefined;const {id,animation,append}=await setup(async(_,s)=>{signal=s;return new Promise(()=>{});},20);append('Evidence.');
 expect((await animation.handle(request(id))).status).toBe(504);expect(signal!.aborted).toBe(true);
});
test('deleting lecture during generation prevents publication',async()=>{
 const entered=deferred(),gate=deferred<unknown>();const {id,lectures,animation,append}=await setup(async()=>{entered.resolve();return gate.promise;});append('Evidence.');
 const pending=animation.handle(request(id));await entered.promise;
 await lectures.handle(new Request(`http://localhost/api/lectures/${id}`,{method:'DELETE',headers:{'x-user-id':'alice'}}));gate.resolve(submission);
 expect((await pending).status).toBe(404);
});
test('invalid generated branches and unmeasured speech anchors are never returned',async()=>{
 for(const result of [{...submission,action:'unsupported'},{...submission,reason:null},{...submission,speechAnchor:{evidenceId:'invented',version:1,phrase:'x',occurrence:null,utteranceId:null}}]){
  const {id,animation,append}=await setup(async()=>result);append('Evidence.');const response=await animation.handle(request(id));
  expect(response.status).toBe(502);expect(await response.text()).not.toContain('invented');
 }
});
test('accepts normalized edit properties returned by the strict probe',async()=>{
 const {id,animation,append}=await setup(async()=>({...submission,action:'edit',source:'',changes:[{id:'cube',props:{fill:'RED'},duration:0}]}));append('The cube is red.');
 const response=await animation.handle(request(id));expect(response.status).toBe(200);
 expect((await response.json()).submission.changes).toEqual([{id:'cube',props:{fill:'RED'},duration:0}]);
});
test('preserves motion, replacement and parameter branches through the main-app endpoint',async()=>{
 const branches=[
  {...submission,action:'motion',source:'',motionChanges:[{id:'cube',velocity:[1,0,0]}]},
  {...submission,action:'replace',replacementProgramId:'existing-program'},
  {...submission,action:'parameters',source:'',parameterProgramId:'existing-program',parameterValues:[{id:'speed',value:2}]},
 ];
 for(const branch of branches){
  const {id,animation,append}=await setup(async()=>branch);append('Supported new evidence.');
  const response=await animation.handle(request(id));expect(response.status).toBe(200);expect((await response.json()).submission).toEqual(branch);
 }
});
test('fits whole maximally escaped source and bounded client world without clipping evidence',async()=>{
 let input:LectureAnimationInput|undefined;const {id,animation,append}=await setup(async value=>{input=value;return submission;});
 const text='"'.repeat(40000);append(text);append('x'.repeat(3000));
 const response=await animation.handle(request(id,{...body,world:{text:'x'.repeat(39900)}}));
 expect(response.status).toBe(200);expect(input!.changes.map(source=>source.text)).toEqual([text]);
 expect(JSON.stringify(input).length).toBeLessThanOrEqual(123000);expect((await response.json()).sourceCursor).toBe(1);
});
test('server routes the main-app animation endpoint to the injected service',async()=>{
 const {id,lectures,animation}=await setup();const app=createHandler(undefined,undefined,undefined,undefined,lectures,undefined,undefined,animation);
 expect(await (await app(request(id))).json()).toEqual({sourceCursor:0,baseRevision:0,idle:true});
});
