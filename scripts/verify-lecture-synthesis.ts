/** Opt-in live model smoke test using synthetic classroom content only. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { agentConfig } from '../backend/src/agents/config.ts';
import { PiAgentRunner } from '../backend/src/agents/runtime.ts';
import { generateLectureNotes } from '../backend/src/agents/lecture.ts';
import type { LectureSource } from '../shared/lecture.ts';

const runner = new PiAgentRunner({ ...agentConfig(), model: process.env.LECTURE_MODEL ?? 'gpt-6.1-sol', thinking: 'medium' });
const question = 'Find the length of vector v = (3, 4).';
const source = (id: string, sequence: number, text: string): LectureSource => ({ id, sequence, kind: 'text', text, createdAt: '2026-10-15T08:00:00Z' });
const output = resolve('../.tmp/lecture-notes-format');
await mkdir(output, { recursive: true });
const questionOnly = await generateLectureNotes(runner, { title: 'Vectors', sources: [source('problem', 1, `Please work individually for two minutes. ${question}`)], previousNotes: null }, AbortSignal.timeout(120_000));
assert.equal(questionOnly.sections.length, 0);
assert.equal(questionOnly.concepts.length, 0);
assert.equal(questionOnly.summary, '');
assert.ok(questionOnly.questions[0]?.text.includes(question));
console.log('Question-only lecture: no invented notes, exact assignment preserved.');
const mixed = await generateLectureNotes(runner, { title: 'Vectors', instructions: 'Write concise notes in German. Use a simple diagram only when helpful.', previousNotes: null, sources: [
  source('teaching', 1, 'Good morning everyone. Can you hear me? Okay. Today: a vector has magnitude and direction. Let me repeat that: magnitude and direction. Its horizontal and vertical components tell us the displacement along each axis. A positive scalar multiplies its length without changing direction. That is the main idea. Please put your phones away.'),
  source('problem', 2, `Now work individually. ${question} Do not call out the answer yet.`),
] }, AbortSignal.timeout(120_000));
const prose = [mixed.summary, ...mixed.sections.flatMap(section => section.points.map(point => point.text))].join(' ');
assert.ok(mixed.sections.length > 0);
assert.ok(prose.split(/\s+/).length < 120);
assert.ok(mixed.sections.every(section => section.points.every(point => point.text.length <= 180 && point.text.trim().split(/\s+/).length <= 18)));
assert.ok(mixed.concepts.every(concept => concept.explanation.length <= 120 && concept.explanation.trim().split(/\s+/).length <= 12));
assert.ok(!prose.includes(question));
assert.ok(!/good morning|phones away|can you hear|professor says/i.test(prose));
assert.ok(mixed.questions[0]?.text.includes(question));
assert.ok(mixed.concepts.every(concept => ['static', 'animation', 'interactive'].includes(concept.visualKind!)));
assert.ok(/Vektor|Richtung|Betrag|Komponente/i.test(prose));
await writeFile(resolve(output, 'live-synthesis.json'), JSON.stringify({ questionOnly, mixed }, null, 2));
console.log(JSON.stringify({ passed: true, words: prose.split(/\s+/).length, sections: mixed.sections.length, visualKinds: mixed.concepts.map(concept => concept.visualKind), question: mixed.questions[0]?.text, output }));
