import type { ProceduralTexture } from '../src/types.js';

export const textureCases: { pattern: ProceduralTexture['pattern']; source: string }[] =
  (['checker', 'stripes', 'noise', 'marble', 'wood'] as const).map(pattern => ({
    pattern,
    // Only two triangles: variation must come from fragments, not vertex coloring.
    source: `export default scene({},s=>{
      const sheet=s.mesh('sheet',{vertices:[[-2,-2,0],[2,-2,0],[2,2,0],[-2,2,0]],
        triangles:[[0,1,2],[0,2,3]],fill:'PURE_RED',
        texture:{pattern:'${pattern}',color:'PURE_BLUE',scale:2,offset:[0.25,0.25,0.5],seed:17}});
      s.play(sheet.moveTo([1,0,0]),{duration:1,ease:'linear'});
    });`,
  }));

/** The same behavioral assertions run against actual pixels on each backend. */
export function texturePixelIssues(pattern: string, at: (x: number, y: number) => number[]): string[] {
  const issues: string[] = [];
  const reds: number[] = [];
  for (let y = 150; y < 330; y += 5) for (let x = 230; x < 410; x += 5) {
    const [r,g,b] = at(x,y); reds.push(r);
    if (g > 2 || Math.abs(r+b-255) > 3) issues.push('Texture escaped the two authored colors');
  }
  const contrast = Math.max(...reds)-Math.min(...reds);
  if (contrast < (pattern === 'noise' ? 30 : 80)) issues.push('Pattern lacks per-fragment variation');
  if (pattern === 'noise' && contrast > 140) issues.push('Noise color variation is too strong');
  if (pattern === 'checker' || pattern === 'stripes') {
    if (at(335,225)[0] < 250 || at(365,225)[2] < 250) issues.push('Wrong primary/secondary cells');
  }
  return [...new Set(issues)];
}

// At 60 pixels per local unit, scale 30 resolves broad color variation but
// neither relief octave. Scale 120 resolves none of the noise layers.
export const noiseFilteringSources = [
  {scale:2,shading:'unlit',bump:0},
  {scale:30,shading:'unlit',bump:0},
  {scale:120,shading:'unlit',bump:0},
  {scale:30,shading:'smooth',bump:0},
  {scale:30,shading:'smooth',bump:0.5},
].map(({scale,shading,bump})=>`export default scene({},s=>{
  s.mesh('sheet',{vertices:[[-2,-2,0],[2,-2,0],[2,2,0],[-2,2,0]],
    triangles:[[0,1,2],[0,2,3]],fill:'PURE_RED',shading:'${shading}',
    texture:{pattern:'noise',color:'PURE_BLUE',scale:${scale},offset:[0.25,0.25,0.5],seed:17,bumpStrength:${bump}}});
  s.wait(1);
});`);

export function noiseFilteringIssues(images: ((x:number,y:number)=>number[])[]): string[] {
  const reds=images.map(at=>{
    const values:number[]=[];
    for(let y=150;y<330;y+=3)for(let x=230;x<410;x+=3)values.push(at(x,y)[0]);
    return values;
  });
  const range=(values:number[])=>Math.max(...values)-Math.min(...values);
  const issues:string[]=[];
  if(range(reds[0])<30)issues.push('Close noise lost its detail');
  if(range(reds[1])<10)issues.push('Broad color faded before fine detail');
  if(reds[2].some(v=>Math.abs(v-127.5)>1))issues.push('Unresolved noise did not converge to its mean');
  if(reds[3].some((v,i)=>Math.abs(v-reds[4][i])>1))issues.push('Unresolved bump survived after its detail faded');
  return issues;
}
