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
];

/** Production scene-authoring reference; preserves retained sections verbatim (LF). */
export function buildAuthoringReference(reference: string): string {
  const lines = reference.replaceAll('\r\n', '\n').split('\n');
  const sections: { heading: string; line: number }[] = [];
  let fence: { marker: string; length: number } | undefined;
  for (const [line, text] of lines.entries()) {
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(text);
    if (fence) {
      if (marker && marker[1][0] === fence.marker && marker[1].length >= fence.length && !marker[2].trim()) fence = undefined;
      continue;
    }
    if (marker) { fence = { marker: marker[1][0], length: marker[1].length }; continue; }
    if (/^ {0,3}#{1,6}(?:\s|$)/.test(text)) sections.push({ heading: text, line });
  }
  if (fence) throw new Error('Unclosed fence in animlib reference.');
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
