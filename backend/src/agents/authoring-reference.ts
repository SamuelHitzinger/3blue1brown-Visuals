import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

// Explicit coverage makes documentation changes require an authoring-scope review.
// Never silently discard a newly added API section.
const headings = [
  '# animlib reference',
  '## 1. The gist',
  '### Decisions from the interview',
  '## 2. The host interface',
  '### Color palettes',
  '### Player API',
  '### TypeScript surface',
  '## 3. Writing a scene',
  '### Source format',
  '### Local timing',
  '### Elements and coordinates',
  '### Shaded meshes',
  '### Scene lighting and planar shadows',
  '### Procedural textures and materials',
  '### Function and parametric surfaces',
  '### Basic solids and swept tubes',
  '### Molecular display beads',
  '### Curved paths and organic shapes',
  '### Choosing how objects relate and move',
  '### Fading a composed object',
  '### Behaviors and live bindings',
  '#### Custom behaviors',
  '#### Canvas navigation and camera access',
  '### Element animation and coordinates',
  '## 4. Persistence and scene handoffs',
  '### Example: a chain that folds in a later scene',
  '### Direct navigation and reconstruction',
  '## 5. Morphing shapes and LaTeX',
  '### Ordinary shapes',
  '### Named formula parts',
  '### Anchors and counting numbers',
  '## 6. Interaction and 2D/3D scenes',
  '### Controls are input values',
  '### Retained reactive bindings',
  '### Fixed-topology deformation and scene time',
  '### Control appearance',
  '### Overlay placement',
  '### Round lines and arrows in 3D',
  '### Independent view regions',
  '### Geometry and camera transitions',
  '### Domain helpers and prepared assets',
  '### General animation recipes',
  '#### Coordinate maps, basis vectors, and algebra',
  '#### Function plots and a visible residual',
  '#### Graph traversal and compact frontiers',
  '#### Stable identity in collections',
  '#### Scientific traces and projected state',
  '#### Surfaces, fields, and informative views',
  '#### Reusable images, models, and parts',
  '#### Persistent objects, controls, and export',
  '### Molecular and biological animation recipes',
  '#### Choose the representation that carries the biological claim',
  '#### Small molecules: explicit sites, explicit bonds, one shared frame',
  '#### Deposited complex proteins: import, preserve gaps, select, then stage',
  '#### Reuse biological packages and prepare new surfaces on the host',
  '#### Cutaways, sequence colors, and anchored molecular labels',
  '#### Schematic backbone folding with fixed serial-link lengths',
  '#### Atomic peptide poses: phi/psi changes with explicit component templates',
  '#### Assemblies, docking, ligand binding and molecular motors',
  '#### DNA opening and advancing transcription',
  '#### RNA splicing and pore transport: display the returned graph',
  '#### Complete translation: initiation, repeated transfer, stop and release',
  '#### Molecular budgets, seek checks and proof scope',
  '## 7. Live source submissions',
  '### Playback after successful changes',
  '### Execution environment',
  '## 8. One audio track per scene',
  '## Object bounds',
  '## Overlap inspection',
  '## 9. Engine structure and verification',
  '## 10. Current boundaries and next steps',
  '## Sections, feature edges, scalar fields, and label depth',
  '### Clipping planes and actual cross-sections',
  '### Silhouette and crease outlines',
  '### Per-vertex scalar palette colors',
  '### Configurable label occlusion',
  '## Imported static 3D models',
  '### Registering and delivering models',
  '### Scene-agent publication',
  '## Bounded scientific state',
];

function scanReferenceHeadings(text: string) {
  const sections: { heading: string; line: number; offset: number }[] = [];
  let fence: { marker: string; length: number } | undefined;
  let offset = 0;
  for (const [line, value] of text.split('\n').entries()) {
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(value);
    if (fence) {
      if (marker && marker[1][0] === fence.marker && marker[1].length >= fence.length && !marker[2].trim()) fence = undefined;
    } else if (marker) fence = { marker: marker[1][0], length: marker[1].length };
    else if (/^ {0,3}#{1,6}(?:\s|$)/.test(value)) sections.push({ heading: value, line, offset });
    offset += value.length + 1;
  }
  if (fence) throw new Error('Unclosed fence in animlib reference.');
  return sections;
}

/** Production scene-authoring reference; preserves retained sections verbatim (LF). */
export function buildAuthoringReference(reference: string): string {
  const normalized = reference.replaceAll('\r\n', '\n');
  const lines = normalized.split('\n');
  const sections = scanReferenceHeadings(normalized);
  if (sections.length !== headings.length || sections.some((section, i) => section.heading !== headings[i])) {
    throw new Error('Unexpected animlib reference structure; review authoring section coverage before extracting.');
  }
  const ranges = [
    ['### Color palettes', '### Player API'],
    ['## 3. Writing a scene', '## 7. Live source submissions'],
    ['### Execution environment', '## 8. One audio track per scene'],
    ['## 8. One audio track per scene', '## 9. Engine structure and verification'],
    ['## 10. Current boundaries and next steps', '### Registering and delivering models'],
    ['### Scene-agent publication', undefined],
  ] as const;
  const startLine = (heading: string) => sections.find(section => section.heading === heading)!.line;
  const selected = ranges.map(([start, end]) => {
    const from = startLine(start), to = end === undefined ? lines.length : startLine(end);
    if (!lines.slice(from + 1, to).some(line => line.trim() && !/^#/.test(line))) {
      throw new Error(`Authoring reference section is empty: ${start}`);
    }
    return lines.slice(from, to).join('\n').trim();
  });
  return ['# animlib scene-authoring reference', ...selected].join('\n\n') + '\n';
}

export interface AuthoringReferenceSection { id: string; title: string; content: string }

/** Lecture jobs keep core construction/interaction APIs inline; advanced APIs remain verbatim and retrievable. */
export function compactLectureAuthoringContext(context: { reference: string; sections: AuthoringReferenceSection[] }) {
  const deferred = new Set([
    '### Shaded meshes', '### Scene lighting and planar shadows', '### Procedural textures and materials',
    '### Function and parametric surfaces', '### Basic solids and swept tubes', '### Molecular display beads',
    '### Curved paths and organic shapes', '### Fixed-topology deformation and scene time',
    '### Domain helpers and prepared assets', '### Clipping planes and actual cross-sections',
    '### Silhouette and crease outlines', '### Per-vertex scalar palette colors', '### Configurable label occlusion',
  ]);
  return deferAuthoringSections(context, deferred, 'lecture-api');
}

/** Explicit planar plans can retrieve spatial detail on demand. Unknown/spatial
 * requirements retain the full contract; selection never removes tool access.
 */
export function selectSceneAuthoringContext(
  context: { reference: string; sections: AuthoringReferenceSection[] },
  view?: { mode: '2d' | '3d'; rationale: string },
) {
  if (view?.mode !== '2d') return context;
  return deferAuthoringSections(context, new Set([
    '### Shaded meshes', '### Scene lighting and planar shadows', '### Procedural textures and materials',
    '### Function and parametric surfaces', '### Basic solids and swept tubes', '### Molecular display beads',
    '### Clipping planes and actual cross-sections', '### Silhouette and crease outlines',
    '### Per-vertex scalar palette colors', '### Configurable label occlusion',
    '### Round lines and arrows in 3D', '### Geometry and camera transitions',
  ]), 'scene-api');
}

function deferAuthoringSections(context: { reference: string; sections: AuthoringReferenceSection[] }, deferred: Set<string>, prefix: string) {
  const headings = scanReferenceHeadings(context.reference);
  const sections: AuthoringReferenceSection[] = [];
  let reference = '', cursor = 0;
  for (let index = 0; index < headings.length; index++) {
    const heading = headings[index];
    if (!deferred.has(heading.heading)) continue;
    const level = heading.heading.indexOf(' ');
    const end = headings.slice(index + 1).find(next => next.heading.indexOf(' ') <= level)?.offset ?? context.reference.length;
    const title = heading.heading.replace(/^#+ /, ''), id = `${prefix}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const content = context.reference.slice(heading.offset, end);
    sections.push({ id, title, content });
    reference += context.reference.slice(cursor, heading.offset)
      + `${heading.heading}\nRead ${id} with read_animlib_reference BEFORE using this API (${content.length} characters).\n\n`;
    cursor = end;
  }
  reference += context.reference.slice(cursor);
  const fingerprint = createHash('sha256').update(JSON.stringify(sections)).digest('hex');
  reference += `\nAdvanced API snapshot SHA-256: ${fingerprint}. Full content remains available through the indexed read_animlib_reference tool; paginate when nextOffset is returned. Do not guess APIs.\n`;
  return { reference, sections: [...context.sections, ...sections] };
}

/** Keep the complete API and craft contract in context; retrieve only worked recipes on demand. */
export function buildAuthoringContext(reference: string): { reference: string; sections: AuthoringReferenceSection[] } {
  // The full builder checks every heading first, so new API content cannot disappear silently.
  const complete = buildAuthoringReference(reference);
  const headings = scanReferenceHeadings(complete);
  const start = headings.find(section => section.heading === '### General animation recipes')?.offset;
  const end = headings.find(section => section.heading === '### Execution environment')?.offset;
  if (start === undefined || end === undefined || end <= start) throw new Error('Recipe reference boundaries are missing.');
  const recipes = complete.slice(start, end);
  const boundaries = scanReferenceHeadings(recipes).map(section => ({ title: section.heading.replace(/^#+ /, ''), offset: section.offset }));
  const sections = boundaries.map((section, index) => ({
    id: section.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    title: section.title,
    content: recipes.slice(section.offset, boundaries[index + 1]?.offset ?? recipes.length),
  }));
  if (!sections.length || sections.map(section => section.content).join('') !== recipes
    || new Set(sections.map(section => section.id)).size !== sections.length) throw new Error('Incomplete or duplicate recipe reference sections.');
  const index = [
    '### Worked recipe index',
    `Recipe snapshot SHA-256: ${createHash('sha256').update(recipes).digest('hex')}.`,
    'The complete API remains above and below. Worked examples are available verbatim through read_animlib_reference({id, offset?, limit?}). Read the relevant recipe before using an unfamiliar method; follow nextOffset until the selected section is complete. All examples and host/scene execution boundaries remain authoritative. A recipe is guidance, never a restriction on the approved explanation. The tool reads only the immutable sections listed here, not arbitrary files.',
    ...sections.map(section => `- ${section.id} (${section.content.length} characters): ${section.title}`),
  ].join('\n');
  return { reference: complete.slice(0, start) + index + '\n\n' + complete.slice(end), sections };
}

/** Fixed repository sources only; author, reviewer and repair share the same immutable snapshot. */
export async function loadAuthoringContext(): Promise<ReturnType<typeof buildAuthoringContext>> {
  const sources = [
    { id: 'scientific-modal-state', title: 'Modal motion construction seed', file: 'catalog/recipes/modal-state.js' },
    { id: 'scientific-conservative-transport', title: 'Conservative transport construction seed', file: 'catalog/recipes/conservative-transport.js' },
    { id: 'scientific-complex-interference', title: 'Complex interference construction seed', file: 'catalog/recipes/complex-interference.js' },
    { id: 'scientific-event-rates', title: 'Event-rate construction seed', file: 'catalog/recipes/event-rates.js' },
    { id: 'scientific-rigid-motion', title: 'Rigid subunit motion construction seed', file: 'catalog/recipes/rigid-motion.js' },
    { id: 'scientific-rigid-motion-guide', title: 'Rigid motion coordinates, provenance and limits', file: 'docs/rigid-motion.md' },
    { id: 'scientific-state-guide', title: 'Scientific state contracts, limits and interpretation', file: 'docs/scientific-state.md' },
  ];
  const [reference, ...contents] = await Promise.all([
    readFile(new URL('../../../shared/animlib/docs/reference.md', import.meta.url), 'utf8'),
    ...sources.map(source => readFile(new URL(`../../../shared/animlib/${source.file}`, import.meta.url), 'utf8')),
  ]);
  const context = buildAuthoringContext(reference);
  const extra = sources.map(({ id, title }, i) => ({ id, title, content: contents[i] }));
  const index = [
    '### Scientific construction references',
    `Scientific reference snapshot SHA-256: ${createHash('sha256').update(JSON.stringify(extra)).digest('hex')}.`,
    'Read these exact repository sources with read_animlib_reference. Construction seeds are runnable starting points, not complete approved explanations. Keep the normal inspection and rendered review; add the causal construction and local evidence required by the storyboard.',
    ...extra.map(section => `- ${section.id} (${section.content.length} characters): ${section.title}`),
  ].join('\n');
  return { reference: context.reference + '\n' + index + '\n', sections: [...context.sections, ...extra] };
}
