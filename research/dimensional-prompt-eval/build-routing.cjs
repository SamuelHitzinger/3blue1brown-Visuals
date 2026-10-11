const fs = require('fs');
const path = require('path');
const root = process.cwd();
const out = path.join(root, 'research/dimensional-prompt-eval/routing');
const changed = [];
function patch(name, replacements) {
  let content = fs.readFileSync(path.join(root, 'backend/prompts', name+'.md'), 'utf8');
  const eol=content.includes('\r\n')?'\r\n':'\n';
  for (const [rawBefore, rawAfter] of replacements) {
    const before=rawBefore.replaceAll('\n',eol), after=rawAfter.replaceAll('\n',eol);
    const index=content.indexOf(before);
    if(index<0 || content.indexOf(before,index+before.length)>=0) throw Error(name+': replacement not uniquely found: '+before.slice(0,75));
    content=content.slice(0,index)+after+content.slice(index+before.length);
  }
  fs.writeFileSync(path.join(out,name+'.md'),content);
  changed.push(name+'.md');
}
patch('guidance', [[
  'Prefer a genuine 3D setting when spatial form or arrangement matters, then select the scale and representation that expose the mechanism. For eukaryotic transcription, for example, move from cell to nucleus to a selected DNA region; show its helix opening, then map the same strands into a simpler 2D view when pairing is easier to follow there. This is an example of orientation and continuity, not a required cell tour for every biology lesson.',
  'Choose dimensions from the inference, not the topic. Start with 2D when the needed relationships remain clear and faithful in a plane. Use genuine 3D when flattening would hide a defining shape, depth ordering, enclosure, orientation, surface height or spatial contact that supplies evidence for the claim. A biological sequence comparison can be 2D; a two-input function benefits from a 3D surface when height and slope are the evidence. Do not add a spatial introduction merely because the subject exists in three dimensions. Use the scene view rationale to name what the chosen view lets the viewer observe, and what flattening would lose when choosing 3D.'
], [
  'In existing scene fields, specify the encoding, meaningful operation/comparison, what changes or stays fixed, and the observation supporting the inference.',
  'In existing scene fields, specify the concrete objects/geometry, meaningful operation/comparison, what changes or stays fixed, and the observation supporting the inference. In visualDescription, name the working scale (whole object, selected region or component) and the geometric relationship the viewer must see; a topic name or "use 3D" is insufficient.'
]]);
patch('viewing-mode', [[
  "Follow the quality policy's preference for 3D when spatial form or arrangement matters, with 2D for inherently planar relationships or a clearer explanatory step. Record the choice and its reason in each scene's `view` field. A flat mechanism view can stand alone without a compulsory return to 3D. Both Classic and Interactive support authored 3D; dimensionality never overrides their input restrictions.",
  "Choose dimensions independently of viewing mode. Default to 2D when a plane preserves the relationships needed for the inference; choose 3D when flattening loses defining shape, depth, enclosure, orientation, surface height or spatial contact that the viewer needs as evidence. Topic labels alone do not decide. Record the choice in each scene's `view`: the rationale names the observable relationship and, for 3D, what flattening would hide. Generic claims such as 'clearer' or 'more engaging' are insufficient. A purposeful flat mechanism view can stand alone without a compulsory spatial introduction or return to 3D. Both Classic and Interactive support authored 3D; dimensionality never overrides their input restrictions."
]]);
patch('animation-quality', [[
  '## Prefer spatial models where they teach',
  '## Choose dimensions for the inference'
], [
  'Prefer genuine 3D for spatial subjects: molecules, proteins, DNA, cells, solids,\nspatial graphs, fields and surfaces. Invest construction and review effort in',
  'Default to 2D when it preserves the relationships needed for the current inference.\nChoose genuine 3D when flattening loses defining shape, depth ordering, enclosure,\norientation, surface height or spatial contact that supports the claim. Route by\nthat evidence, not by topic: sequence matching can be planar, while a two-input\nfunction needs spatial height when rise and slope supply the evidence. For chosen\nspatial models, invest construction and review effort in'
], [
  'Choose 2D when the relationship is inherently planar or a particular explanatory\nstep is clearer flat. Record that reason in the scene view contract and map\nmeaningful parts through any 3D-to-2D change.',
  'In the scene view rationale, name the relationship the viewer will observe and,\nfor 3D, what flattening would lose. "Clearer", "simpler" or the subject name alone\nis insufficient. In visualDescription, identify concrete geometry, the operation,\nthe working scale and its visible consequence. Map meaningful parts through any\n3D-to-2D change.'
]]);
patch('scene-craft', [[
  'Prefer complex 3D forms when shape, depth or spatial arrangement explains the\nsubject. Allocate effort to constructing and checking those forms before adding',
  'Implement the planned dimensional choice through its named visible evidence.\nUse 2D when the inference is preserved in a plane; use developed 3D when flattening\nloses the defining shape or spatial relationship needed for the claim. A 3D camera\nalone does not supply that evidence. Allocate effort to the chosen forms before adding'
]]);
patch('scene-request-guidance', [[
  'Prefer developed 3D geometry when spatial form matters; use recognizable contours and parts in any simpler 2D mechanism view.',
  'Default to 2D when it preserves the relationships needed for this inference; choose 3D when flattening would lose defining shape, depth, enclosure, orientation, surface height or spatial contact that supplies its evidence. Route by that relationship, not the topic. State the observable relation in view.rationale and the concrete geometry, operation and working scale in visualDescription. Retain recognizable contours and parts in a simplified mechanism view.'
]]);
patch('story-review', [[
  'For spatial subjects, prefer developed 3D forms and verify any 2D choice has an explanatory reason.',
  'Check dimensions against the inference, not the subject category. Default to 2D when it preserves the needed relation; require developed 3D when flattening loses defining shape or a spatial relationship that supplies evidence. Reject generic view rationales such as "clearer" without a named observable relation. Check that visualDescription supplies concrete geometry, an operation and a working scale. Flag lost explanatory spatial evidence as a material error; do not demand 3D for a planar sequence or calculation.'
]]);
patch('scene-verify', [[
  'For spatial subjects, check that 3D form was developed where it helps: recognizable\nsilhouette, depth, meaningful subparts and actual mechanism motion. Flag generic\ntokens that erase defining shape, or a flat substitute without an explanatory\nreason.',
  'Check the rendered evidence named in view.rationale and visualDescription. A\nplanar inference can remain 2D. When the claim depends on shape or a spatial\nrelationship, check recognizable silhouette, depth, meaningful subparts and\nmechanism motion at the planned scale; a spatial camera alone is insufficient.\nFlag a flattened or generic substitute that erases that evidence. Do not reward\nextra depth or rotation that adds no explanatory relationship.'
]]);
patch('scene-review', [[
  'Check spatial subjects for developed 3D form and recognizable parts; report generic shapes that lose the mechanism, while preserving purposeful 2D simplifications.',
  'Check the named dimensional rationale against the actual inference: preserve 2D when its plane carries the needed relationship, and require visible developed 3D form when flattening loses defining shape or spatial evidence. Report generic shapes that lose the mechanism; a spatial camera alone is insufficient.'
]]);
let source=fs.readFileSync(path.join(root,'backend/src/agents/planning.ts'),'utf8');
let contract=source.match(/export const PLANNING_CONTRACT = `([\s\S]*?)`;/)?.[1];
if(!contract)throw Error('PLANNING_CONTRACT not found');
contract=contract.replace('"view": {"mode": "2d", "rationale": "why this representation makes the relationship clear"}', '"view": {"mode": "2d", "rationale": "the relationship the viewer can observe in this plane; choose 3d instead when flattening loses defining shape or spatial evidence, naming what is lost"}');
contract=contract.replace('"visualDescription": "the ordered visual construction, what changes or stays constant, speech cues, and evidence supporting the inference; avoid exact layout or API calls"', '"visualDescription": "concrete objects/geometry, ordered operation, working scale, what changes or stays constant, speech cues and visible evidence supporting the inference; avoid exact layout or API calls"');
contract=contract.replace('Plan and write the script together in this one response.', 'Choose 2D or 3D for each scene from the explanatory relationship, not its subject category. Default to 2D when flattening preserves the inference; choose 3D when defining shape, depth ordering, enclosure, orientation, surface height or spatial contact is necessary evidence. A generic clarity claim is not a view rationale. Name the visible evidence and working scale in visualDescription, preserving needed correspondences across representation changes.\nPlan and write the script together in this one response.');
fs.writeFileSync(path.join(out,'planning-contract.txt'),contract+'\n');
fs.writeFileSync(path.join(out,'candidate.json'),JSON.stringify({id:'routing',basis:'current working-tree prompts; all replacements preserve unmodified baseline content',promptFiles:changed,planningContract:'planning-contract.txt',hypothesis:'Inference-based 2D default and explicit lost-information test improve dimensional choices without spatial topic bias.',productionEdits:false},null,2)+'\n');
console.log(JSON.stringify({out,promptFiles:changed,planningContractCharacters:contract.length}));
