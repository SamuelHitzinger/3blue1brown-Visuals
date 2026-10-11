import { createHash } from 'node:crypto';
import type { AgentTask, AgentRunMetrics } from '../../backend/src/agents/runtime.js';
import type { ConstructionEvent } from './construction-runner.js';
export const taskContextKey=(task:Pick<AgentTask,'logContext'>)=>JSON.stringify(task.logContext??{});
const inputKey=(task:Pick<AgentTask,'systemPrompt'|'prompt'|'logContext'>)=>createHash('sha256').update(task.systemPrompt+'\0'+task.prompt+'\0'+taskContextKey(task)).digest('hex');
/** Identity only. Event metrics are never added to actual Pi task metrics. */
export class PhaseTaskEvents {
  private pending=new Map<string,ConstructionEvent>();
  start(event:ConstructionEvent){
    if(event.kind!=='start')throw Error('Expected construction start event.');
    const key=inputKey(event.effectiveInput);
    if(this.pending.has(key))throw Error('Ambiguous construction event identity.');
    this.pending.set(key,event);
  }
  take(task:Pick<AgentTask,'systemPrompt'|'prompt'|'logContext'>){const key=inputKey(task),event=this.pending.get(key);this.pending.delete(key);return event;}
  get size(){return this.pending.size;}
}
export function sumEffort(tasks:{metrics?:{providerCalls:number;turns:Pick<AgentRunMetrics['turns'][number],'inputTokens'|'outputTokens'|'reasoningTokens'|'cacheReadTokens'>[]}}[]){
  const turns=tasks.flatMap(task=>task.metrics?.turns??[]);
  const coverage={metricTasks:tasks.filter(task=>task.metrics!==undefined).length,totalTasks:tasks.length,
    reasoningTurns:turns.filter(turn=>turn.reasoningTokens!==undefined).length,totalTurns:turns.length};
  const observed={providerCalls:tasks.reduce((sum,task)=>sum+(task.metrics?.providerCalls??0),0),
    inputTokens:turns.reduce((sum,turn)=>sum+turn.inputTokens,0),outputTokens:turns.reduce((sum,turn)=>sum+turn.outputTokens,0),
    reasoningTokens:turns.reduce((sum,turn)=>sum+(turn.reasoningTokens??0),0),cacheReadTokens:turns.reduce((sum,turn)=>sum+turn.cacheReadTokens,0)};
  const complete=coverage.metricTasks===coverage.totalTasks;
  return {taskCount:tasks.length,providerCalls:complete?observed.providerCalls:null,inputTokens:complete?observed.inputTokens:null,
    outputTokens:complete?observed.outputTokens:null,reasoningTokens:complete&&coverage.reasoningTurns===coverage.totalTurns?observed.reasoningTokens:null,
    cacheReadTokens:complete?observed.cacheReadTokens:null,coverage,...(!complete?{observed}: {})};
}
