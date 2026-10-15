import type { Format } from './metrics.js';

export const cases = {
  cube: {
    mode: '3d',
    create: 'Create a blue cube named cube, dimensions 1.5 on each axis, centered at the origin. Add a readable label cube-label above it saying "Rotation preserves shape". Rotate the cube from zero to [0,0.8,0] radians over 1 second, then hold 1 second. Keep both objects.',
    world: [{ id: 'cube', kind: 'box', props: { width: 1.5, height: 1.5, depth: 1.5, position: [0,0,0], rotation: [0,.8,0], fill: 'BLUE' } }, { id: 'cube-label', kind: 'text', props: { text: 'Rotation preserves shape', position: [0,1.5,0], fontSize: .28 } }],
    edit: 'Move the existing cube to [1,0,0] and color it TEAL together over 0.5 seconds. Retain its shape, orientation and label; hold 0.5 seconds. Do not recreate existing objects.',
  },
  curve: {
    mode: '2d',
    create: 'Draw x and y axes with arrowheads from [-2.5,0] to [2.5,0] and [0,-0.5] to [0,2.5], IDs x-axis and y-axis. Draw a blue parabola named curve through points [[-2,2],[-1.5,1.125],[-1,0.5],[-0.5,0.125],[0,0],[0.5,0.125],[1,0.5],[1.5,1.125],[2,2]]. Place a yellow circle marker of radius 0.1 at [1,0.5]. Add a label curve-label "y = x²/2" at [-1,2.6], fontSize 0.28. Reveal curve over 1 second; hold 1 second; keep all objects.',
    world: [{ id: 'curve', kind: 'path', props: { points: [[-2,2],[-1.5,1.125],[-1,.5],[-.5,.125],[0,0],[.5,.125],[1,.5],[1.5,1.125],[2,2]], stroke: 'BLUE', fill: 'none' } }, { id: 'marker', kind: 'circle', props: { position: [1,.5], radius: .1, fill: 'YELLOW' } }, { id: 'x-axis', kind: 'arrow', props: { points: [[-2.5,0],[2.5,0]] } }, { id: 'y-axis', kind: 'arrow', props: { points: [[0,-.5],[0,2.5]] } }, { id: 'curve-label', kind: 'text', props: { text: 'y = x²/2', position: [-1,2.6], fontSize: .28 } }],
    edit: 'Move the existing marker to [1.5,1.125] over 0.5 seconds. Add tangent as a TEAL line from [0.75,0] to [2.25,2.25]. Preserve the existing curve, axes and label; hold 0.5 seconds. Do not recreate existing objects.',
  },
  diagram: {
    mode: '2d',
    create: 'Draw three rectangles named input, process, output at [-3,0], [0,0], [3,0], width 2 and height 1, with BLUE strokes and no fill. Add centered labels input-label "Input", process-label "Process", output-label "Output", fontSize 0.3. Connect the boxes with WHITE arrows named left-link from [-2,0] to [-1,0] and right-link from [1,0] to [2,0]. Highlight process with TEAL stroke over 1 second; hold 1 second; keep all objects.',
    world: [{id:'input',kind:'rectangle',props:{position:[-3,0],width:2,height:1,stroke:'BLUE',fill:'none'}},{id:'process',kind:'rectangle',props:{position:[0,0],width:2,height:1,stroke:'TEAL',fill:'none'}},{id:'output',kind:'rectangle',props:{position:[3,0],width:2,height:1,stroke:'BLUE',fill:'none'}},{id:'input-label',kind:'text',props:{position:[-3,0],text:'Input',fontSize:.3}},{id:'process-label',kind:'text',props:{position:[0,0],text:'Process',fontSize:.3}},{id:'output-label',kind:'text',props:{position:[3,0],text:'Output',fontSize:.3}},{id:'left-link',kind:'arrow',props:{points:[[-2,0],[-1,0]],stroke:'WHITE'}},{id:'right-link',kind:'arrow',props:{points:[[1,0],[2,0]],stroke:'WHITE'}}],
    edit: 'Highlight existing output with a YELLOW stroke over 0.5 seconds. Add a readable caption named result below it at [3,-1], fontSize 0.28, saying "Result". Preserve all existing objects and arrows; hold 0.5 seconds. Do not recreate existing objects.',
  },
} as const;
export type ProbeCase = keyof typeof cases;
export function buildPrompt(which: ProbeCase, format: Format, action: 'create' | 'edit') {
  const fixture = cases[which];
  const common = 'Author the requested visual exactly. Use concise code/data, stable IDs and readable geometry. No prose, markdown, comments or external resources. Colors are BLUE, TEAL, YELLOW, WHITE or none. Position arrays have 2 or 3 numbers. Keep every required object. This is a generic authoring protocol, not a subject-template library.';
  const native = 'Return complete animlib JavaScript: export default scene({mode:"2d"|"3d",end:"hold",orbit:false},s=>{...});. Constructors s.box/circle/rectangle/path/line/arrow/text(id,props) return handles. Props: position, rotation (radians), width,height,depth,radius,points,text,fontSize,fill,stroke. Handles: animate(props),moveTo(position),rotateTo(rotation),fadeIn(). Schedule parallel actions with s.play([actions],{duration:seconds}); s.wait(seconds); s.keep(handle). For edit, obtain existing handles with s.previous.get(id); preserve every existing object with s.keep. New objects use constructors. Do not import. Emit one statement per line; short loops are allowed.';
  const ops = 'Return NDJSON, one JSON object per line. Protocol v1: {"op":"scene","mode":"2d"|"3d","end":"hold"}; {"op":"add","kind":"box"|"circle"|"rectangle"|"path"|"line"|"arrow"|"text","id":string,"props":object}; {"op":"animate","duration":seconds,"changes":[{"id":string,"props":object}]}; {"op":"wait","duration":seconds}; {"op":"keep","ids":[string]}; {"op":"commit"}. Add props: position,rotation (radians),width,height,depth,radius,points,text,fontSize,fill,stroke. Animate props include position,rotation,fill,stroke,opacity,strokeEnd. All changes in an animate record run together. Additions are immediately visible; reveal a path by adding with strokeEnd:0 and animating strokeEnd:1. Existing IDs in the supplied world can be animated/kept directly. A commit atomically ends the batch; include one at the end. No templates or hidden operations exist.';
  return { systemPrompt: `${common}\n${format === 'native-js' ? native : ops}`,
    prompt: `${action === 'edit' ? `Current committed world (revision 1): ${JSON.stringify(fixture.world)}\n` : ''}Mode: ${fixture.mode}. ${fixture[action]}` };
}
