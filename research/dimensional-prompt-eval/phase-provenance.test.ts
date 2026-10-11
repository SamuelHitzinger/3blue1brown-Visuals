import { describe, expect, test } from 'bun:test';
import { PhaseTaskEvents, sumEffort } from './phase-provenance.js';
const input=(systemPrompt:string,prompt='packet')=>({systemPrompt,prompt,outputMode:'text' as const,logContext:{videoId:'fresh',sceneIndex:0,stage:'scene' as const},images:undefined});
const event=(taskId:string,role:'construction-specialist'|'scene',system:string)=>({taskId,sceneKey:'fresh:0',role,kind:'start' as const,originalInput:input(system),effectiveInput:input(system)});
describe('phase task provenance',()=>{
  test('helper and author sharing production scene context retain separate identities exactly once',()=>{
    const ledger=new PhaseTaskEvents();
    ledger.start(event('helper','construction-specialist','helper-system'));
    expect(ledger.take(input('helper-system'))?.role).toBe('construction-specialist');
    expect(ledger.take(input('helper-system'))).toBeUndefined();
    ledger.start(event('author','scene','author-system'));
    expect(ledger.take(input('author-system'))?.taskId).toBe('author');
    expect(ledger.size).toBe(0);
  });
  test('ambiguous pending identity fails rather than assigning wrong role',()=>{
    const ledger=new PhaseTaskEvents();ledger.start(event('one','scene','same'));
    expect(()=>ledger.start(event('two','scene','same'))).toThrow('Ambiguous');
  });
  test('counts distinct actual model tasks once and keeps reasoning as output subset',()=>{
    const tasks=[{metrics:{providerCalls:2,turns:[{inputTokens:10,outputTokens:9,reasoningTokens:5,cacheReadTokens:4}]}},{metrics:{providerCalls:1,turns:[{inputTokens:20,outputTokens:7,reasoningTokens:3,cacheReadTokens:8}]}}];
    expect(sumEffort(tasks)).toEqual({taskCount:2,providerCalls:3,inputTokens:30,outputTokens:16,reasoningTokens:8,cacheReadTokens:12,coverage:{metricTasks:2,totalTasks:2,reasoningTurns:2,totalTurns:2}});
    expect(sumEffort([]).providerCalls).toBe(0);
  });
});

import { createConstructionRunner } from './construction-runner.js';
test('decorator and final-input ledger account one helper plus scene, reviewer, and repair once',async()=>{
  const ledger=new PhaseTaskEvents(),calls:any[]=[];
  const brief={schemaVersion:1,representation:'connected schematic',majorPartsAndConnections:'joined domains',activeRegion:'open pocket',operationAndClearance:'collision-free path',viewEvidence:'depth',compileCostRisks:'bounded mesh'};
  const metrics={elapsedMs:1,providerCalls:1,turns:[{index:1,elapsedMs:1,providerMs:1,stopReason:'stop' as const,inputTokens:10,outputTokens:4,reasoningTokens:2,cacheReadTokens:5,cacheWriteTokens:0,textChars:0,toolArgumentChars:0}],validations:[]};
  const decorated=createConstructionRunner({async run(task){
    const event=ledger.take(task);expect(event).toBeDefined();
    calls.push({role:event!.role,system:task.systemPrompt,user:task.prompt,metrics});
    task.onMetrics?.(metrics);
    return event!.role==='construction-specialist'?JSON.stringify(brief):'output';
  }},{mode:'specialist',checklist:'CHECK\n',apiReference:'api',referenceExcerpts:['api'],specialistPrompt:'design',
    contextForScene:async()=>({viewMode:'3d',prompt:'bounded authoritative packet'}),onEvent(event){if(event.kind==='start')ledger.start(event);}});
  const base={...input('before CHECK\nafter api'),signal:new AbortController().signal};
  await decorated.run(base);
  await decorated.run({...base,logContext:{...base.logContext,stage:'review'}});
  await decorated.run({...base,logContext:{...base.logContext,stage:'repair'}});
  expect(calls.map(call=>call.role)).toEqual(['construction-specialist','scene','review','repair']);
  expect(calls.slice(1).every(call=>call.user.endsWith(JSON.stringify(brief)))).toBe(true);
  expect(calls.slice(1).every(call=>call.system==='before after apiCHECK\n')).toBe(true);
  expect(sumEffort(calls).providerCalls).toBe(4);
  expect(sumEffort(calls).inputTokens).toBe(40);
  expect(ledger.size).toBe(0);
});


test('missing metrics and missing reasoning remain unknown rather than zero',()=>{
  const incomplete=sumEffort([{},{metrics:{providerCalls:1,turns:[{inputTokens:3,outputTokens:2,cacheReadTokens:1}]}}]);
  expect(incomplete.providerCalls).toBeNull();
  expect(incomplete.reasoningTokens).toBeNull();
  expect(incomplete.coverage).toEqual({metricTasks:1,totalTasks:2,reasoningTurns:0,totalTurns:1});
  const omittedReasoning=sumEffort([{metrics:{providerCalls:1,turns:[{inputTokens:3,outputTokens:2,cacheReadTokens:1}]}}]);
  expect(omittedReasoning.inputTokens).toBe(3);
  expect(omittedReasoning.reasoningTokens).toBeNull();
});
