import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const repo = resolve(root, '../..');
const runRoot = join(repo, 'data/dimensional-prompt-eval/runs');
const readJson = async file => {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return undefined; throw error; }
};
const entries = async folder => {
  try { return await readdir(folder, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
};
function sumReported(items, field) {
  const values = items.map(item => item?.[field]).filter(value => Number.isFinite(value));
  return values.length ? values.reduce((a,b) => a+b, 0) : null;
}
function effort(tasks) {
  const turns = tasks.flatMap(task => task.metrics?.turns ?? []);
  return { tasks: tasks.length, completedTurns: turns.length,
    elapsedMs: sumReported(tasks, 'elapsedMs'),
    providerCalls: sumReported(tasks.map(task => task.metrics), 'providerCalls'),
    providerMs: sumReported(turns, 'providerMs'), inputTokens: sumReported(turns, 'inputTokens'),
    outputTokens: sumReported(turns, 'outputTokens'), reasoningTokens: sumReported(turns, 'reasoningTokens'),
    turnsReportingReasoning: turns.filter(turn => Number.isFinite(turn.reasoningTokens)).length,
    cacheReadTokens: sumReported(turns, 'cacheReadTokens') };
}
function geometry(frame) {
  const elements = frame.elements ?? [];
  const byId = new Map(elements.map(element => [element.id, element]));
  const parents = new Map(elements.flatMap(element => (element.geometry?.children ?? []).map(id => [id, element.id])));
  const effectiveOpacity = (element, seen = new Set()) => {
    if (!element || seen.has(element.id)) return 0;
    seen.add(element.id);
    const own = element.opacity ?? 1;
    return parents.has(element.id) ? own * effectiveOpacity(byId.get(parents.get(element.id)), seen) : own;
  };
  const kinds = {}, visibleKinds = {};
  let inlineVertices = 0, inlineTriangles = 0, pathPoints = 0, modelReferences = 0, assetReferences = 0;
  for (const element of elements) {
    const value = element.geometry ?? {}, kind = value.kind ?? 'unknown';
    kinds[kind] = (kinds[kind] ?? 0)+1;
    if (effectiveOpacity(element) > .01) visibleKinds[kind] = (visibleKinds[kind] ?? 0)+1;
    inlineVertices += value.vertices?.length ?? 0;
    inlineTriangles += value.triangles?.length ?? 0;
    pathPoints += value.points?.length ?? 0;
    modelReferences += value.model ? 1 : 0;
    assetReferences += value.asset ? 1 : 0;
  }
  return { elements: elements.length, primitiveElements: elements.length-(kinds.group ?? 0),
    kinds, visibleKinds, inlineVertices, inlineTriangles, pathPoints, modelReferences, assetReferences,
    camera: frame.camera, views: (frame.views ?? []).map(view => ({ id: view.id, camera: view.camera })),
    caveat: 'Final-frame stored elements, including invisible items. Visible means inherited opacity >0.01 only; it does not prove onscreen visibility. Inline geometry counts exclude primitive tessellation, text glyphs and imported/prepared asset geometry. Counts do not establish spatial fidelity or visual quality.' };
}
const matrix = await readJson(join(root, 'matrix-state.json'));
const runs = [];
for (const strategy of await entries(runRoot)) if (strategy.isDirectory()) {
  for (const topic of await entries(join(runRoot, strategy.name))) if (topic.isDirectory()) {
    for (const entry of await entries(join(runRoot, strategy.name, topic.name))) if (entry.isDirectory()) {
      const directory = join(runRoot, strategy.name, topic.name, entry.name);
      const result = await readJson(join(directory, 'result.json'));
      if (!result) { runs.push({ strategy: strategy.name, caseId: topic.name, id: entry.name, directory, status: 'missing-result' }); continue; }
      const files = await entries(directory);
      const taskMap = new Map((result.tasks ?? []).map(task => [task.number, task]));
      for (const file of files) if (/^task-\d+-.*\.metrics\.json$/.test(file.name)) {
        const task = await readJson(join(directory, file.name));
        taskMap.set(task.number, task);
      }
      const tasks = [...taskMap.values()].sort((a,b) => a.number-b.number);
      const stages = {};
      for (const stage of new Set(tasks.map(task => task.stage))) stages[stage] = effort(tasks.filter(task => task.stage === stage));
      const lesson = await readJson(join(directory, 'lesson.json'));
      const frames = [];
      for (const file of files.filter(file => /^scene-\d+\.final-frame\.json$/.test(file.name)).sort((a,b) => a.name.localeCompare(b.name))) {
        frames.push({ index: Number(file.name.match(/^scene-(\d+)/)[1]), path: join(directory, file.name), ...geometry(await readJson(join(directory, file.name))) });
      }
      const selected = matrix?.runs.find(run => run.strategy === strategy.name && run.caseId === topic.name);
      const isMatrixRun = selected?.id ? selected.id === result.id
        : selected?.startedAt ? Date.parse(result.createdAt) >= Date.parse(selected.startedAt)-1000 : false;
      runs.push({ strategy: result.strategy, caseId: result.caseId, id: result.id, directory, createdAt: result.createdAt,
        matrixSelected: isMatrixRun, status: result.status, activeStage: result.stage, elapsedMs: result.elapsedMs ?? null,
        elapsedSinceStartMs: result.status === 'running' ? Date.now()-Date.parse(result.createdAt) : null,
        error: result.error ?? null, localError: result.localError ?? null,
        model: result.model, provider: result.provider, thinking: result.thinking, timingMode: result.timingMode,
        outputMode: result.outputMode, requestSha256: result.requestSha256,
        plannedScenes: (lesson?.plan?.scenes ?? []).map(scene => ({ id: scene.id, view: scene.view ?? null,
          purpose: scene.purpose, visualDescription: scene.visualDescription })),
        editorialAttempt: lesson?.editorialReview?.attempt ?? null,
        completedSceneCount: result.scenes?.length ?? 0, durationSec: result.durationSec ?? null,
        singleSceneAdherence: result.singleSceneAdherence ?? null, durationTargetAdherence: result.durationTargetAdherence ?? null,
        effort: effort(tasks), stages,
        tools: tasks.map(task => ({ number: task.number, stage: task.stage, toolEffort: task.toolEffort ?? {} })),
        substitutionMatches: tasks.map(task => ({ number: task.number, stage: task.stage, matchedFragments: task.matchedFragments,
          matchedUserFragments: task.matchedUserFragments })), frames });
    }
  }
}
runs.sort((a,b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
const output = { generatedAt: new Date().toISOString(), matrixStatus: matrix?.status ?? null,
  queued: matrix?.runs.filter(run => run.status === 'queued').map(({strategy,caseId}) => ({strategy,caseId})) ?? [],
  caveats: ['All preserved attempts, including failures and runs outside the selected matrix, are included.',
    'Running effort includes completed task metrics only; current task usage arrives when its task finishes.',
    'Reported reasoning is a subset of output tokens; null means unavailable, never zero by assumption.',
    'Counts are diagnostics from saved endpoint frames, not visual proof; failed scenes may have no final frame.',
    'One scene per case does not exercise inter-scene handoff. Subtitle timing does not exercise TTS or acoustic sync.'], runs };
await writeFile(join(root, 'summary.json'), JSON.stringify(output, null, 2)+'\n');
const esc = text => String(text ?? '—').replaceAll('|','\\|').replaceAll('\n',' ');
const seconds = value => Number.isFinite(value) ? (value/1000).toFixed(1) : '—';
const lines = ['# Dimensional prompt experiment status', '', output.caveats.join(' '), '',
  '| Variant / case | Matrix | Status / stage | View | Run seconds | Tasks | Output tokens | Endpoint elements / vertices |',
  '| --- | --- | --- | --- | ---: | ---: | ---: | ---: |'];
for (const run of runs) lines.push(`| ${esc(run.strategy)} / ${esc(run.caseId)} (${run.id.slice(0,8)}) | ${run.matrixSelected ? 'selected' : 'other attempt'} | ${esc(run.status)} / ${esc(run.activeStage)} | ${esc(run.plannedScenes?.map(scene => scene.view?.mode ?? 'unspecified').join(', '))} | ${seconds(run.elapsedMs)} | ${run.effort?.tasks ?? 0} | ${run.effort?.outputTokens ?? '—'} | ${run.frames?.map(frame => `${frame.elements} / ${frame.inlineVertices}`).join(', ') || '—'} |`);
for (const run of runs) if (run.error || run.localError) lines.push('', `- ${run.strategy}/${run.caseId} ${run.id}: ${esc(run.error?.code)} — ${esc(run.localError ?? run.error?.message)}`);
lines.push('', 'Stage effort, exact view rationale, source locations and diagnostic count caveats are recorded in `summary.json`.');
await writeFile(join(root, 'summary.md'), lines.join('\n')+'\n');
console.log(JSON.stringify({ runs: runs.length, statuses: runs.reduce((counts,run) => (counts[run.status]=(counts[run.status]??0)+1,counts), {}),
  queued: output.queued.length, summary: join(root, 'summary.json') }));
