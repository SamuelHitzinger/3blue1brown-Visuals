import { describe, expect, it } from 'vitest';
import { buildDrawItems } from '../src/render-geometry.js';
import { getScreenBounds } from '../src/bounds.js';
import { paletteResolver } from '../src/palette.js';
import { project } from '../src/geometry.js';
import { VERTEX_FLOATS as stride } from '../src/texture-shader.js';
import type { CameraState, ElementState, Frame, Vec3 } from '../src/types.js';

const camera: CameraState = { yaw: 0, pitch: 0, target: [0, 0, 0], height: 8, distance: 20, perspective: 1 };
const label = (extra: Partial<ElementState> = {}): ElementState => ({
  id: 'label', geometry: { kind: 'latex', tex: '46', fontSize: .4, labelOcclusion: 'overlay' },
  position: [0, -3.5, 0], rotation: [0, 0, 0], scale: 1, opacity: 1, fill: 'WHITE',
  stroke: 'none', strokeWidth: 0, space: 'world', persistent: false, billboard: true,
  billboardOffset: [0, -1.65, 0], ...extra,
});
const render = (elements: ElementState[], view = camera, width = 800, height = 400) => {
  const frame: Frame = { elements, camera: view, cameraAnimated: false };
  const items = buildDrawItems(frame, view, width, height, paletteResolver());
  const points = items.filter(item => item.elementId === 'label').flatMap(item => {
    const points: number[][] = [], data = item.vertices;
    for (let i = 0; i < data.length; i += stride) {
      const p = data[i+7] ? { x: width/2+data[i], y: height/2-data[i+1] }
        : project([data[i],data[i+1],data[i+2]],view,width,height);
      points.push([p.x+data[i+13]*width,p.y-data[i+14]*height]);
    }
    return points;
  });
  return { items, points, left: Math.min(...points.map(p=>p[0])), right: Math.max(...points.map(p=>p[0])),
    top: Math.min(...points.map(p=>p[1])), bottom: Math.max(...points.map(p=>p[1])) };
};

describe('anchored billboard label viewport fitting', () => {
  it.each([
    [[0,-3.5,0],[0,-1.65,0]], [[0,3.5,0],[0,1.65,0]],
    [[7.5,0,0],[1.65,0,0]], [[-7.5,0,0],[-1.65,0,0]],
  ] as [Vec3,Vec3][])('keeps complete glyph ink inside the view at anchor %j', (position,billboardOffset) => {
    const element=label({position,billboardOffset}), before=structuredClone(element);
    const fitted=render([element]);
    expect(fitted.points.length).toBeGreaterThan(0);
    expect(fitted.left).toBeGreaterThanOrEqual(0);
    expect(fitted.right).toBeLessThanOrEqual(800);
    expect(fitted.top).toBeGreaterThanOrEqual(0);
    expect(fitted.bottom).toBeLessThanOrEqual(400);
    expect(element).toEqual(before);
    // Fitting is a rigid translation: no rescaling, clipping, or glyph deformation.
    const central=render([label({position:[0,0,0],billboardOffset:[0,0,0]})]);
    expect(fitted.points).toHaveLength(central.points.length);
    expect(fitted.right-fitted.left).toBeCloseTo(central.right-central.left,3);
    expect(fitted.bottom-fitted.top).toBeCloseTo(central.bottom-central.top,3);
  });

  it.each([[1024,460.8],[819.2,491.52]])('keeps the crambin endpoint readable through orbit and pan in a %j by %j view', (width,height) => {
    const endpoint=label({position:[.64207,-1.05941,1.49578]});
    for(const yaw of [.1,.65,1.2,2.1]) for(const pitch of [-.3,.1,.5]) for(const y of [-.25,0,.25]) {
      const view={...camera,yaw,pitch,height:5.9,target:[0,y,0] as Vec3};
      const ink=render([endpoint],view,width,height);
      expect(ink.points.length).toBeGreaterThan(0);
      expect(ink.left).toBeGreaterThanOrEqual(0); expect(ink.right).toBeLessThanOrEqual(width);
      expect(ink.top).toBeGreaterThanOrEqual(0); expect(ink.bottom).toBeLessThanOrEqual(height);
    }
  });

  it('includes viewport offsets and the true transformed attachment when fitting', () => {
    const child=label({position:[0,0,0],viewportOffset:[0,-.1]});
    const group=label({id:'group',geometry:{kind:'group',children:['label']},position:[0,-2.5,0],billboard:false});
    const ink=render([child,group]);
    expect(ink.bottom).toBeLessThanOrEqual(400);
    expect(ink.top).toBeGreaterThan(350);
  });

  it('reports the fitted painted footprint in public screen bounds and offset views', () => {
    const element=label(), ink=render([element]);
    const frame:Frame={elements:[element],camera,cameraAnimated:false};
    const box=getScreenBounds(frame,'label',{width:800,height:400,clip:false})!;
    expect(box).toEqual({left:ink.left,right:ink.right,top:ink.top,bottom:ink.bottom});
    element.view='molecule';
    frame.views=[{id:'molecule',rect:[.2,.1,.5,.5],camera,orbit:true,cameraAnimated:false}];
    const subview=getScreenBounds(frame,'label',{width:1600,height:800,clip:false})!;
    expect(subview).toEqual({left:ink.left+320,right:ink.right+320,top:ink.top+80,bottom:ink.bottom+80});
  });

  it('does not pin an offscreen attachment to a visible viewport edge', () => {
    const ink=render([label({position:[0,-6,0]})]);
    expect(ink.top).toBeGreaterThan(400);
  });

  it('leaves oversized glyphs at their authored anchor instead of pinning an arbitrary fragment', () => {
    const oversized=label({geometry:{kind:'latex',tex:'46',fontSize:40,labelOcclusion:'overlay'},position:[0,0,0]});
    const original=render([{...oversized,billboard:false,position:[0,-1.65,0]}]);
    const ink=render([oversized]);
    expect(ink.points).toEqual(original.points);
  });

  it('preserves authored in-view placement, fixed text, and default depth labels', () => {
    const centered=label({position:[0,0,0]});
    expect(render([centered]).points).toEqual(render([{...centered,billboard:false,position:[0,-1.65,0]}]).points);
    const fixed=label({space:'screen',position:[0,-410,0],geometry:{kind:'latex',tex:'46',fontSize:24,labelOcclusion:'overlay'}});
    expect(render([fixed]).top).toBeGreaterThan(400);
    const depth=label({geometry:{...label().geometry,labelOcclusion:'depth'}});
    expect(render([depth]).bottom).toBeGreaterThan(400);
  });
});
