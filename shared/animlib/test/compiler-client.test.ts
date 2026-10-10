import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SourceCompiler } from "../src/compiler-client.js";
import type { CompilerRequest, CompilerResponse } from "../src/compiler-client.js";
import { compileSource, createSceneProgram, SceneCompileError } from "../src/compiler.js";

class TestWorker {
  static instances: TestWorker[] = [];
  requests: CompilerRequest[] = [];
  terminated = false;
  onmessage: ((event: MessageEvent<CompilerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  constructor(readonly url: URL, readonly options: WorkerOptions) { TestWorker.instances.push(this); }
  postMessage(request: CompilerRequest): void { this.requests.push(structuredClone(request)); }
  terminate(): void { this.terminated = true; }
  respond(response: CompilerResponse): void { this.onmessage?.({ data: response } as MessageEvent<CompilerResponse>); }
}
const source = 'export default scene({}, s => { const dot = s.circle("dot"); s.play(dot.moveTo([2,0]), {duration:2}); });';
const compilers: SourceCompiler[] = [];
function compiler(): SourceCompiler { const instance = new SourceCompiler(); compilers.push(instance); return instance; }

beforeEach(() => { TestWorker.instances = []; });
afterEach(() => {
  for (const instance of compilers.splice(0)) instance.dispose();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("off-thread source compiler", () => {
  it('serializes retained points and stroke phase through worker requests and snapshots',async()=>{
    const source=`export default scene({},s=>{const p=s.line('p',{dashArray:[.5,.2]});s.bind(p,[s.time],t=>({points:[[0,0],[1,t]],strokeEnd:t/2,dashOffset:-t}));s.wait(2);});`;
    const program=await createSceneProgram(source);
    try {
      vi.stubGlobal('Worker',TestWorker);const instance=compiler(),loading=instance.compile(source);
      const worker=TestWorker.instances[0],session=worker.requests[0].id;worker.respond({id:session,ok:true,scene:structuredClone(program.scene)});
      const scene=await loading,updating=instance.update(scene,{},[],{},1),request=worker.requests.at(-1)!;
      if(request.type!=='update')throw Error('Expected update');
      const updates=JSON.parse(JSON.stringify(program.update(request.values,request.changed,request.time,request.duration)));
      worker.respond({id:request.id,ok:true,updates});
      expect(await updating).toEqual([{target:'p',properties:{points:[[0,0],[1,1]],strokeEnd:.5,dashOffset:-1}}]);
      expect(scene.reactiveBindings![0].properties.points).toEqual([[0,0],[1,0]]);
    } finally {program.dispose();}
  });
  it('sends callback updates to the retained worker program and releases discarded programs', async () => {
    const scene=await compileSource(`export default scene({},s=>{
      const r=s.slider('r',{reactive:true,default:1,min:0,max:3});const a=s.sphere('a');
      s.bind(a,[r],r=>({radius:r}));s.wait(1);
    });`);
    vi.stubGlobal('Worker',TestWorker);
    const instance=compiler(), loading=instance.compile('source');
    const worker=TestWorker.instances[0], session=worker.requests[0].id;
    worker.respond({id:session,ok:true,scene});
    const loaded=await loading;
    const updating=instance.update(loaded,{r:2},['r']);
    expect(worker.requests[1]).toMatchObject({type:'update',session,values:{r:2},changed:['r']});
    worker.respond({id:worker.requests[1].id,ok:true,updates:[{target:'a',properties:{radius:2}}]});
    expect(await updating).toEqual([{target:'a',properties:{radius:2}}]);
    instance.retain([]);
    expect(worker.requests[2]).toMatchObject({type:'release',sessions:[session]});
    expect(instance.canUpdate(loaded)).toBe(false);
  });
  it('sends prepared duration to an isolated retained program when sampling time', async () => {
    const program=await createSceneProgram(`export default scene({},s=>{
      const m=s.surface('m',{fn:()=>0,xSegments:1,ySegments:1});s.deform(m,[s.time],([x,y],i,t)=>[x,y,t]);s.wait(4);
    });`);
    try {
      vi.stubGlobal('Worker',TestWorker);
      const instance=compiler(),loading=instance.compile('source');
      const worker=TestWorker.instances[0],session=worker.requests[0].id;
      worker.respond({id:session,ok:true,scene:structuredClone(program.scene)});
      const loaded=await loading;loaded.duration=6;
      const sampling=instance.update(loaded,{},[],{},5),request=worker.requests.at(-1)!;
      expect(request).toMatchObject({type:'update',time:5,duration:6});
      if(request.type!=='update')throw Error('Expected update');
      const updates=program.update(request.values,request.changed,request.time,request.duration);
      worker.respond({id:request.id,ok:true,updates});
      expect((await sampling)[0].properties.vertices![0][2]).toBe(5);
      expect(program.update({},[],10,6)[0].properties.vertices![0][2]).toBe(6);
      expect(()=>program.update({},[],5,Infinity)).toThrow('duration');
    } finally {program.dispose();}
  });
  it("uses the sandbox directly for headless Node consumers", async () => {
    vi.stubGlobal("Worker", undefined);
    const instance = compiler();
    const scene = await instance.compile(source);
    expect(scene.duration).toBe(2);
    expect(scene.lifecycle[0].elements?.[0].id).toBe("dot");
    await expect(instance.compile('export default scene({}, () => fetch("/not-allowed"));')).rejects.toBeInstanceOf(SceneCompileError);
  });

  it("starts a lazy module worker and routes overlapping responses by request ID", async () => {
    const scene = await compileSource(source);
    vi.stubGlobal("Worker", TestWorker);
    const instance = compiler();
    expect(TestWorker.instances).toHaveLength(0);
    const first = instance.compile(source, { controls: { scale: 2 } }, { executionLimitMs: 50, prepare: () => undefined } as { executionLimitMs: number });
    const second = instance.compile(source.replace('duration:2', 'duration:3'));
    expect(TestWorker.instances).toHaveLength(1);
    const worker = TestWorker.instances[0];
    expect(worker.url.pathname).toMatch(/compiler-worker\.js$/);
    expect(worker.options.type).toBe("module");
    expect(worker.requests[0]).toMatchObject({ input: { controls: { scale: 2 } }, limits: { executionLimitMs: 50 } });
    worker.respond({ id: worker.requests[1].id, ok: true, scene: { ...scene, duration: 3 } });
    worker.respond({ id: worker.requests[0].id, ok: true, scene });
    expect((await first).duration).toBe(2);
    expect((await second).duration).toBe(3);
  });

  it("retains source diagnostics across the worker boundary", async () => {
    vi.stubGlobal("Worker", TestWorker);
    const instance = compiler();
    const pending = instance.compile("bad source");
    const worker = TestWorker.instances[0];
    const diagnostic = { severity: "error" as const, code: "SYNTAX", message: "Unexpected token", line: 3, column: 12 };
    worker.respond({ id: worker.requests[0].id, ok: false, diagnostic });
    await expect(pending).rejects.toMatchObject({ name: "SceneCompileError", diagnostic });
    expect(worker.terminated).toBe(false);
  });

  it("rejects pending work on worker failure and starts a fresh worker for retry", async () => {
    vi.stubGlobal("Worker", TestWorker);
    const instance = compiler();
    const pending = instance.compile(source);
    const rejected = expect(pending).rejects.toMatchObject({ diagnostic: { code: "COMPILER_WORKER", message: "Asset missing" } });
    const worker = TestWorker.instances[0];
    const preventDefault = vi.fn();
    worker.onerror?.({ message: "Asset missing", preventDefault } as unknown as ErrorEvent);
    await rejected;
    expect(preventDefault).toHaveBeenCalled();
    expect(worker.terminated).toBe(true);
    const retry = instance.compile(source);
    const retried = expect(retry).rejects.toThrow("disposed");
    expect(TestWorker.instances).toHaveLength(2);
    instance.dispose();
    await retried;
  });

  it("terminates a stalled worker, rejects all outstanding requests, and cancels late responses", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("Worker", TestWorker);
    const instance = compiler();
    const first = instance.compile(source);
    const second = instance.compile(source);
    const rejected = Promise.all([
      expect(first).rejects.toMatchObject({ diagnostic: { code: "COMPILER_TIMEOUT" } }),
      expect(second).rejects.toMatchObject({ diagnostic: { code: "COMPILER_TIMEOUT" } }),
    ]);
    await vi.advanceTimersByTimeAsync(15000);
    await rejected;
    expect(TestWorker.instances[0].terminated).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("disposes outstanding compilation and refuses subsequent work", async () => {
    vi.stubGlobal("Worker", TestWorker);
    const instance = compiler();
    const pending = instance.compile(source);
    const rejected = expect(pending).rejects.toThrow("disposed");
    instance.dispose();
    await rejected;
    expect(TestWorker.instances[0].terminated).toBe(true);
    expect(TestWorker.instances[0].onmessage).toBeNull();
    await expect(instance.compile(source)).rejects.toThrow("disposed");
    instance.dispose();
  });
});
