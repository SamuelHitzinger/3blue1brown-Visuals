/** Offline deployment proof: the shipped worker must produce nonblank pixels. */
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { inflateSync } from 'node:zlib';
import { modelSmokeFixture } from './model-smoke-fixture.mjs';

const directory = await mkdtemp(join(tmpdir(), 'animlib-frame-smoke-'));
try {
  const request = join(directory, 'input.json');
  await writeFile(request, JSON.stringify({ directory, models:await modelSmokeFixture(), times: [0.5], source:
    `export default scene({orbit:false},s=>{s.circle('dot',{radius:1,fill:Color.TEAL,position:[2,0]});s.model('panel',{asset:'fixture',position:[-2,0]});s.text('label',{text:'DNA',position:[0,2]});s.wait(1);});` }));
  const manifest = JSON.parse(execFileSync(process.execPath, [fileURLToPath(new URL('./render-frames.mjs', import.meta.url)), request],
    { encoding: 'utf8', timeout: 120_000, windowsHide: true }));
  if (manifest.frames.length !== 2 || manifest.sheets.length !== 2) throw new Error('Missing viewport evidence');
  for (const frame of manifest.frames) {
    const png = await readFile(frame.path), chunks = [];
    for (let offset = 8; offset < png.length;) {
      const size = png.readUInt32BE(offset), type = png.toString('ascii', offset + 4, offset + 8);
      if (type === 'IDAT') chunks.push(png.subarray(offset + 8, offset + 8 + size));
      offset += size + 12;
    }
    const rows = inflateSync(Buffer.concat(chunks));
    let colored = 0, red = 0, green = 0, blue = 0;
    // Worker writes unfiltered RGBA rows. Ignore alpha when checking nonblack content.
    for (let y = 0; y < frame.height; y++) for (let x = 0; x < frame.width; x++) {
      const p = y * (frame.width * 4 + 1) + 1 + x * 4;
      if (rows[p] + rows[p + 1] + rows[p + 2] > 30) colored++;
      if(rows[p]>240&&rows[p+1]<20&&rows[p+2]<20)red++;
      if(rows[p]<20&&rows[p+1]>240&&rows[p+2]<20)green++;
      if(rows[p]<20&&rows[p+1]<20&&rows[p+2]>240)blue++;
    }
    if (colored < 1000) throw new Error(`Blank render at ${frame.width}x${frame.height}`);
    if(Math.min(red,green,blue)<100)throw new Error('Imported model texture is missing from visual review');
  }
  console.log('Production frame renderer: both aspects contain rendered geometry and text.');
} finally {
  await rm(directory, { recursive: true, force: true });
}
