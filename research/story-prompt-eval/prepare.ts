import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { PLANNING_CONTRACT } from '../../backend/src/agents/planning.ts';

const base = import.meta.dir;
const prompts = new URL('../../backend/prompts/', import.meta.url);
const files = ['guidance.md', 'story-review.md'] as const;
await mkdir(`${base}/baseline`, { recursive: true });
await mkdir(`${base}/outputs`, { recursive: true });
for (const name of files) {
  const destination = `${base}/baseline/${name}`;
  if (!(await Bun.file(destination).exists())) await writeFile(destination, await readFile(new URL(name, prompts), 'utf8'));
}
const capabilities = await readFile(new URL('../../shared/animlib/docs/capabilities.md', import.meta.url), 'utf8');
const viewingMode = await readFile(new URL('./legacy-prompts/viewing-mode.md', import.meta.url), 'utf8');
const quality = await readFile(new URL('./legacy-prompts/animation-quality.md', import.meta.url), 'utf8');
const old = await readFile(`${base}/baseline/guidance.md`, 'utf8');
if (!(await Bun.file(`${base}/baseline-system.txt`).exists()))
  await writeFile(`${base}/baseline-system.txt`, `${old}\n\n${viewingMode}\n\n${capabilities}\n\n${PLANNING_CONTRACT}\n\n${quality}`);
if (!(await Bun.file(`${base}/control-system.txt`).exists()))
  await writeFile(`${base}/control-system.txt`, `Write an accurate original explanatory video script and plan for the user's request.\n\n## Output contract\n${old.split('## Output contract')[1]}\n\n${viewingMode}\n\n${capabilities}\n\n${PLANNING_CONTRACT}\n\n${quality}`);
const cases = [
  { id: 'bayes', title: 'Why a positive screen is not a diagnosis', topic: 'Write a roughly 3-minute lesson in exactly 3 scenes for adults who know percentages but not conditional probability. Explain why a positive test need not mean the condition is likely. Use a hypothetical population of 1,000: 10 have the condition; the test is positive for 9 of them and for 99 of the 990 without it. Derive the positive-test probability of actually having the condition, then explain how changing prevalence while keeping sensitivity and false-positive rate fixed changes the result. Include one brief thinking pause. This is a toy probability example, not medical guidance.', videoMode: 'classic' },
  { id: 'leaf', title: 'A leaf trades water for carbon', topic: 'Write a roughly 2-minute lesson in exactly 3 scenes for a curious 12-year-old. Explain how opening stomata lets carbon dioxide enter for photosynthesis while water vapor escapes, and why closing them in dry conditions protects water but restricts carbon uptake. Show the causal tradeoff rather than list plant parts. No equations and no scripted pauses. Do not imply plants consciously decide, that stomata are one-way valves, or that closing instantly stops all water loss.', videoMode: 'classic' },
  { id: 'protocol', title: 'Why retrying can charge twice', topic: 'Write a roughly 3-minute lesson in exactly 4 scenes for junior developers. Explain idempotency keys using a payment request whose response is lost after the server commits it. Include the case where the first request never arrived, show why timeout alone cannot distinguish these cases, and explain how an atomic stored key/result association makes a retry return the prior result instead of repeating the operation. Distinguish retrying the same intended purchase from a new purchase; state that key reuse must reject a changed payload, and that retention scope limits the guarantee. No pauses. A request/response diagram is appropriate; no equations needed.', videoMode: 'classic' },
  { id: 'uniform', title: 'Pointwise is not uniform', topic: 'Write a roughly 4-minute lesson in exactly 4 scenes for second-year mathematics students who know limits and epsilon notation. Begin with the definitions of pointwise and uniform convergence, then make the quantifier difference meaningful using f_n(x)=x^n on [0,1] and on [0,a] for fixed 0<a<1. Explain why taking n large for each fixed x does not give one n for every x, and why the restricted interval fixes this. A plot may support the argument but must not stand in for it. Include one reachable prediction and one brief pause. Preserve the endpoint x=1 and the distinction between pointwise limit and uniform error.', videoMode: 'classic' },
  { id: 'history', title: 'Can one source tell us why workers protested?', topic: 'Write a roughly 90-second lesson in exactly 2 scenes for secondary-school history students, using only the supplied fictional source packet. Explain the difference between what a source directly reports and what it can justify about motives. Reach a qualified interpretation, not an invented definitive cause. No equations, no scripted pauses, no fabricated facts or additional sources. A timeline or evidence comparison may help. Do not force a mathematical proof or a single causal explanation.', videoMode: 'classic', documents: [{ name: 'fictional-source-packet.txt', text: 'All events and sources here are fictional. A factory notice dated 4 May announces a 10% wage cut starting 10 May. A worker diary dated 11 May reports that several workers stopped work and records: "My pay will not cover rent now." A manager letter dated 12 May attributes the stoppage to outside agitators but identifies none. No interviews with other workers, attendance totals, earlier wage records, or additional evidence are supplied.' }] },
];
for (const c of cases) await writeFile(`${base}/${c.id}.request.json`, JSON.stringify({title:c.title,topic:c.topic,videoMode:c.videoMode,documents:c.documents??[]},null,2));
await writeFile(`${base}/cases.json`,JSON.stringify(cases.map(c=>c.id),null,2));
console.log('Saved frozen baseline, contract-only control, and five script/plan requests. No video or audio tools used.');
