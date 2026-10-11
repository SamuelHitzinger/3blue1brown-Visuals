/** Preserve reviewed queue mechanics while applying the current visual contract. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const directory = resolve('data/animlib-expansion/compact-frontier-3b1b');
await mkdir(directory, { recursive: true });
let source = await readFile(new URL('./compact-frontier.js', import.meta.url), 'utf8');
// Native graph labels already use the quiet mathematical typography required by
// the new contract. Remove the historical source-channel sans replacements.
source = source.split('\n').filter(line => !line.startsWith('  for(const n of data.nodes)') &&
  !line.startsWith('  for(const e of data.edges)')).join('\n');
source = source.replaceAll("'PURPLE_E'", "'BLACK'").replaceAll("'PURPLE_A'", "'GREY_A'")
  .replaceAll("'ORANGE'", "'BLUE'").replaceAll("'GREEN'", "'TEAL'")
  .replaceAll('strokeWidth:.06', 'strokeWidth:.035').replaceAll('strokeWidth:.05', 'strokeWidth:.035')
  .replaceAll('strokeWidth:.018', 'strokeWidth:.022').replaceAll('strokeWidth:.012', 'strokeWidth:.016');
const replacements = [
  ["tex:'\\\\mathsf{'+route+'}'", 'tex:route'],
  ["tex:'\\\\mathsf{'+cost+'}'", 'tex:String(cost)'],
  ["tex:'\\\\mathsf{'+destination+'}'", 'tex:destination'],
  ["tex:'\\\\mathsf{frontier}'", "tex:'\\\\text{frontier}'"],
  ["tex:'\\\\mathsf{1+2=3<7}',fontSize:.32,position:[2.4,-2.75]", "tex:'1+2=3<7',fontSize:.32,position:[3.3,-1.85]"],
  ["tex:'\\\\mathsf{3+1=4<5}',fontSize:.32,position:[2.4,-2.75]", "tex:'3+1=4<5',fontSize:.32,position:[4,2.2]"],
];
for (const [from, to] of replacements) {
  if (source.split(from).length !== 2) throw Error('Expected one known source fragment: ' + from);
  source = source.replace(from, to);
}
// Local edge-weight offsets keep the crossing diagonals legible.
source = source.replace("  const record=", "  s.play(g.weights.get('DB').fadeOut(),{duration:0});\n  const dbWeight=s.latex('weight/DB',{tex:'1',fontSize:.25});\n  s.attach(dbWeight,g.edges.get('DB'),{anchor:'midpoint',offset:[.35,.7]});\n  const record=");
const palette = { background: 'BLACK', foreground: 'WHITE', colors: {
  BLACK: '#080D18', WHITE: '#F0F2F8', GREY_A: '#B9C2D2', GREY_B: '#596577',
  BLUE: '#7EA8FF', TEAL: '#47D7C8', YELLOW: '#FFD37E',
} };
await writeFile(join(directory, 'compact-frontier.js'), source);
await writeFile(join(directory, 'manifest.json'), JSON.stringify({ palette,
  scenes: [{ id: 'compact-frontier', file: 'compact-frontier.js', duration: 9 }], captions: [] }, null, 2));
await writeFile(join(directory, 'frames.json'), JSON.stringify({ source, palette,
  times: [0, .8, 1.125, 1.45, 2.7, 3.025, 3.35, 4, 4.325, 4.65, 5.8, 6.45, 7.425, 8.8],
  directory: join(directory, 'frames') }));
console.log(JSON.stringify({ directory, sourceCharacters: source.length }));
