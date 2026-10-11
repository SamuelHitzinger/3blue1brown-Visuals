#!/usr/bin/env node
// Assemble locally available reviewed films. No scene generation or dependency install.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--help') {
    console.log('node shared/animlib/tools/build-capability-showcase.mjs [--ffmpeg PATH] [--output DIR]\nRequires exact reviewed local films listed in demo/expansion/showcase-catalog.json.');
    process.exit(0);
  }
  if (!['--ffmpeg', '--output'].includes(args[i]) || !args[i + 1]) throw Error(`Unknown or incomplete option: ${args[i]}`);
  options[args[i].slice(2)] = args[++i];
}
const ffmpeg = options.ffmpeg || process.env.FFMPEG || path.join(root, 'data/video-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe');
const output = path.resolve(root, options.output || 'data/animlib-expansion/showcase');
const catalogPath = path.join(root, 'shared/animlib/demo/expansion/showcase-catalog.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const ensure = condition => { if (!condition) throw Error('Showcase validation failed'); };
const local = relative => {
  const absolute = path.resolve(root, relative);
  if (!absolute.startsWith(root + path.sep) || !fs.existsSync(absolute)) throw Error(`Missing local input: ${relative}. Generate/render the reviewed proof first.`);
  return absolute;
};
const write = (name, value) => { const file = path.join(output, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value); return file; };
const run = args => {
  const result = spawnSync(ffmpeg, ['-hide_banner', '-nostdin', ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw Error(`FFmpeg failed: ${result.error || result.stderr}`);
  return result;
};
function decode(file, id) {
  const result = run(['-v', 'info', '-xerror', '-i', file, '-map', '0:v:0', '-an', '-fps_mode', 'passthrough', '-f', 'framemd5', '-']);
  write(`verification/${id}-decode.log`, result.stderr);
  write(`verification/${id}.framemd5`, result.stdout);
  const tb = result.stdout.match(/#tb 0: (\d+)\/(\d+)/);
  const dimensions = result.stdout.match(/#dimensions 0: (\d+)x(\d+)/);
  if (!tb || !dimensions || /Stream #\d+:\d+.*Audio:/.test(result.stderr)) throw Error(`Invalid or non-silent input: ${file}`);
  const frames = result.stdout.split('\n').filter(line => line && !line.startsWith('#')).map(line => {
    const fields = line.split(',').map(part => part.trim());
    return { pts: Number(fields[2]), duration: Number(fields[3]), md5: fields[5] };
  });
  const secondsPerTick = Number(tb[1]) / Number(tb[2]);
  ensure(frames.length > 0 && frames.every((f, i) => f.pts === i && f.duration === 1));
  return { width: Number(dimensions[1]), height: Number(dimensions[2]), fps: 1 / secondsPerTick, frames: frames.length, duration: frames.length * secondsPerTick, audio: false, frameHashes: frames.map(f => f.md5) };
}
const inputs = [...catalog.chapters, ...catalog.supplements];
if (catalog.chapters.length !== 11 || new Set(inputs.map(c => c.id)).size !== inputs.length) throw Error('Catalog must identify eleven distinct main scenes.');
// Resolve and check every dependency before doing any expensive assembly.
for (const c of inputs) {
  if (sha(local(c.film)) !== c.sha256) throw Error(`Reviewed SHA-256 mismatch: ${c.film}`);
  for (const field of ['review', 'apiDoc', 'reuse', 'hashEvidence']) if (c[field]) local(c[field]);
}
fs.mkdirSync(output, { recursive: true });
const chapters = [];
let frameOffset = 0;
for (const c of catalog.chapters) {
  const media = decode(local(c.film), c.id);
  ensure(media.width === 1280 && media.height === 720 && media.fps === 30);
  ensure(Number.isFinite(c.posterTime) && c.posterTime >= 0 && c.posterTime < media.duration);
  chapters.push({ ...c, ...media, startFrame: frameOffset, start: frameOffset / 30, end: (frameOffset + media.frames) / 30 });
  frameOffset += media.frames;
  console.log(`${c.id}: ${media.frames} frames, ${media.duration}s, reviewed hash matches`);
}
const supplements = catalog.supplements.map(c => {
  const media = decode(local(c.film), c.id);
  ensure(media.width === 1280 && media.height === 720 && c.posterTime >= 0 && c.posterTime < media.duration);
  const file = `supplemental/${c.id}.mp4`;
  fs.mkdirSync(path.dirname(path.join(output, file)), { recursive: true });
  fs.copyFileSync(local(c.film), path.join(output, file));
  ensure(sha(path.join(output, file)) === c.sha256);
  return { ...c, ...media, file };
});
const concatQuote = s => s.replaceAll('\\', '/').replaceAll("'", "'\\''");
write('assembly.ffconcat', 'ffconcat version 1.0\n' + chapters.map(c => `file '${concatQuote(local(c.film))}'\nduration ${c.duration}`).join('\n') + '\n');
write('chapters.ffmetadata', ';FFMETADATA1\n' + chapters.map(c => `[CHAPTER]\nTIMEBASE=1/30\nSTART=${c.startFrame}\nEND=${c.startFrame + c.frames}\ntitle=${c.title}`).join('\n') + '\n');
run(['-v', 'warning', '-y', '-safe', '0', '-f', 'concat', '-i', path.join(output, 'assembly.ffconcat'), '-i', path.join(output, 'chapters.ffmetadata'), '-map', '0:v:0', '-map_metadata', '1', '-map_chapters', '1', '-c:v', 'copy', '-an', '-movflags', '+faststart', path.join(output, 'showcase.mp4')]);
const final = decode(path.join(output, 'showcase.mp4'), 'showcase');
const chapterLog = fs.readFileSync(path.join(output, 'verification/showcase-decode.log'), 'utf8');
for (const c of chapters) if (!chapterLog.includes(`: ${c.title}`)) throw Error(`Missing muxed chapter title: ${c.title}`);
const sourceFrames = chapters.flatMap(c => c.frameHashes);
ensure(final.frames === frameOffset && final.width === 1280 && final.height === 720 && final.fps === 30);
if (final.frameHashes.some((hash, i) => hash !== sourceFrames[i])) throw Error('Assembled decoded frames differ from source frames.');
// Extract every join at exact frame indices, plus full-resolution chapter previews.
for (const c of [...chapters, ...supplements]) {
  const source = c.file ? path.join(output, c.file) : path.join(output, 'showcase.mp4');
  const t = (c.start || 0) + c.posterTime;
  fs.mkdirSync(path.join(output, 'previews'), { recursive: true });
  run(['-v', 'error', '-y', '-ss', String(t), '-i', source, '-frames:v', '1', '-q:v', '2', '-update', '1', path.join(output, 'previews', `${c.id}.jpg`)]);
  if (!c.file) {
    for (const [label, index] of [['first', c.startFrame], ['last', c.startFrame + c.frames - 1]]) {
      run(['-v', 'error', '-y', '-i', source, '-vf', `select=eq(n\\,${index})`, '-frames:v', '1', '-fps_mode', 'vfr', '-update', '1', path.join(output, 'verification', `${c.id}-${label}.png`)]);
    }
  }
}
// Ordered first/last pairs; the last two cells repeat the final frame as padding.
const boundaryFiles = chapters.flatMap(c => [`${c.id}-first.png`, `${c.id}-last.png`]);
while (boundaryFiles.length % 12) boundaryFiles.push(boundaryFiles.at(-1));
write('verification/boundaries.ffconcat', 'ffconcat version 1.0\n' + boundaryFiles.map(file => `file '${file}'\nduration 0.04`).join('\n') + '\n');
run(['-v', 'error', '-y', '-safe', '0', '-f', 'concat', '-i', path.join(output, 'verification/boundaries.ffconcat'), '-vf', 'scale=320:180,tile=4x3', '-fps_mode', 'vfr', '-q:v', '2', path.join(output, 'verification/boundaries-%02d.jpg')]);
fs.copyFileSync(path.join(output, 'previews/shear.jpg'), path.join(output, 'poster.jpg'));
const referencePaths = new Set(inputs.flatMap(c => [c.review, c.apiDoc, c.reuse, c.hashEvidence]).filter(Boolean));
referencePaths.add('shared/animlib/docs/explanatory-motion.md');
referencePaths.add('shared/animlib/demo/expansion/README.md');
referencePaths.add('docs/animlib-expansion/final-visual-coverage.md');
referencePaths.add('docs/animlib-expansion/showcase-style-contract.md');
for (const relative of referencePaths) {
  const target = path.join(output, 'references', relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(local(relative), target);
}
const withoutHashes = ({ frameHashes, ...value }) => value;
const manifest = {
  version: 1, title: catalog.title, scope: catalog.scope,
  assembly: 'Full native clips in catalog order; hard cuts; stream copy; no audio, overlays, crop or speed changes.',
  file: 'showcase.mp4', sha256: sha(path.join(output, 'showcase.mp4')),
  ...withoutHashes(final), decodedFrameEquality: 'Every assembled frame equals the corresponding decoded source frame (MD5).',
  chapters: chapters.map(withoutHashes), supplements: supplements.map(withoutHashes),
};
write('manifest.json', JSON.stringify(manifest, null, 2) + '\n');
fs.copyFileSync(catalogPath, path.join(output, 'showcase-catalog.json'));
const stamp = s => `${Math.floor(s / 3600).toString().padStart(2, '0')}:${Math.floor(s / 60 % 60).toString().padStart(2, '0')}:${(s % 60).toFixed(3).padStart(6, '0')}`;
write('chapters.vtt', 'WEBVTT\n\n' + chapters.map(c => `${c.id}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.title}\n`).join('\n'));
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const shortTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const links = c => `<a href="references/${escape(c.apiDoc)}">API guide</a><a href="references/${escape(c.reuse)}">Reuse source</a><a href="references/${escape(c.review)}">Review &amp; limits</a>`;
write('index.html', `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(catalog.title)}</title>
<style>
:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#090e18;color:#eef1f7}*{box-sizing:border-box}body{margin:0}main{max-width:1440px;margin:auto;padding:42px 36px 60px}a{color:#83b6ff;text-underline-offset:4px}h1{font-size:clamp(2rem,4vw,3.3rem);font-weight:500;letter-spacing:-.045em;margin:.3em 0}h2{font-size:1.5rem;font-weight:500}p{line-height:1.6;color:#acb8ca}.eyebrow{text-transform:uppercase;font-size:.72rem;letter-spacing:.19em;color:#55d6c5}.intro{max-width:780px;margin-bottom:30px}.layout{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:28px;align-items:start}.screen{min-width:0}video{display:block;width:100%;aspect-ratio:16/9;background:#080d18;border:1px solid #263044}#current{margin-bottom:8px}.meta{font-size:.85rem;color:#8d9cb3}.api{font-family:ui-monospace,monospace;color:#77d7ca;font-size:.86rem;line-height:1.7}.links{display:flex;gap:20px;flex-wrap:wrap;font-size:.85rem;margin:18px 0}.chapters{max-height:720px;overflow:auto;padding-right:7px}.chapters h2{margin:0 0 12px;font-size:1rem}.chapter{width:100%;border:0;border-left:2px solid #263044;padding:12px 12px;display:grid;grid-template-columns:42px 1fr;gap:10px;color:#c2cddd;background:transparent;text-align:left;font:inherit;cursor:pointer}.chapter:hover{background:#131e30}.chapter[aria-current=true]{border-color:#55d6c5;background:#13242c;color:#fff}.chapter time{font: .8rem ui-monospace,monospace;color:#91a4bb;padding-top:2px}.chapter small{display:block;font-size:.7rem;color:#8d9cb3;margin-top:5px}.chapter:focus-visible,a:focus-visible{outline:2px solid #ffd17a;outline-offset:3px}.details{min-height:218px}.supplemental{border-top:1px solid #263044;margin-top:32px;padding-top:20px}.supp-grid{display:grid;grid-template-columns:1fr 1fr;gap:28px}.supp-grid video{max-height:340px}.supp-grid h3{font-weight:500}.supp-grid p{font-size:.9rem}.foot{border-top:1px solid #263044;padding-top:20px;margin-top:36px;font-size:.82rem}.foot p{max-width:960px}.quiet{font-size:.8rem;color:#8391a7}@media(max-width:950px){main{padding:24px 18px}.layout{grid-template-columns:1fr}.chapters{max-height:none;display:grid;grid-template-columns:1fr 1fr}.chapters h2{grid-column:1/-1}.details{min-height:0}.supp-grid{grid-template-columns:1fr}}@media(max-width:540px){.chapters{grid-template-columns:1fr}.links{gap:15px}h1{font-size:2.25rem}}
</style>
<main><header class="intro"><div class="eyebrow">Animlib / capability collection</div><h1>Motion you can reuse.</h1><p>From moving coordinates to persistent molecular chains. Eleven complete scenes show the operation, preserve its objects, and hold the result.</p><div class="meta">${shortTime(final.duration)} · 11 chapters · 1280 × 720 · 30 fps · silent</div></header>
<div class="layout"><section class="screen" aria-label="Showcase player"><video id="reel" controls playsinline preload="metadata" poster="poster.jpg" aria-label="Eleven-scene capability reel"><source src="showcase.mp4" type="video/mp4"><track kind="chapters" src="chapters.vtt" srclang="en" label="Scenes"><a href="showcase.mp4">Download the showcase</a></video><div class="details"><p class="eyebrow" id="group"></p><h2 id="current"></h2><p id="look"></p><div class="api" id="api"></div><nav class="links" id="reuse" aria-label="Current scene references"></nav><p class="quiet" id="limit"></p></div></section>
<nav class="chapters" aria-label="Choose a chapter"><h2>Explore the operations</h2>${chapters.map((c, i) => `<button class="chapter" data-chapter="${i}" aria-controls="reel"><time>${shortTime(c.start)}</time><span>${escape(c.title)}<small>${escape(c.group)} · ${c.duration} s</small></span></button>`).join('')}</nav></div>
<section class="supplemental"><h2>Additional rendering capabilities</h2><p>Separate technical demonstrations, outside the main reel. Each retains its own reviewed scope and artwork.</p><div class="supp-grid">${supplements.map(c => `<article><video controls playsinline preload="none" poster="previews/${c.id}.jpg" aria-label="${escape(c.title)}"><source src="${c.file}" type="video/mp4"></video><h3>${escape(c.title)}</h3><p>${escape(c.look)}</p><div class="api">${escape(c.api)}</div><nav class="links" aria-label="${escape(c.title)} references">${links(c)}</nav></article>`).join('')}</div></section>
<footer class="foot"><nav class="links" aria-label="Collection files"><a href="showcase.mp4" download>Download reel</a><a href="manifest.json">Timings &amp; provenance</a><a href="references/shared/animlib/demo/expansion/README.md">Generation workflows</a><a href="references/shared/animlib/docs/explanatory-motion.md">Authoring guide</a></nav><p>Built from the exact accepted native renders. Complete clips and original reading holds are preserved, with hard cuts between scenes. The reference files are portable reading copies; run generators in the repository with their documented dependencies and inputs. Nested documentation links require the repository; this folder is not a complete documentation or runnable source bundle.</p><p class="quiet">${escape(catalog.scope)}</p></footer></main>
<script>
const chapters=${JSON.stringify(chapters.map(withoutHashes)).replaceAll('<', '\\u003c')};
const reel=document.getElementById('reel');const buttons=[...document.querySelectorAll('[data-chapter]')];let active=-1;
function show(index){if(index===active)return;active=index;const c=chapters[index];document.getElementById('group').textContent=c.group;document.getElementById('current').textContent=c.title;document.getElementById('look').textContent=c.look;document.getElementById('api').textContent=c.api;document.getElementById('limit').textContent=c.limit;const links=document.getElementById('reuse');links.replaceChildren();for(const [label,field] of [['API guide','apiDoc'],['Reuse source','reuse'],['Review & limits','review']]){const a=document.createElement('a');a.href='references/'+c[field];a.textContent=label;links.append(a)}buttons.forEach((b,i)=>b.setAttribute('aria-current',String(i===index)));}
buttons.forEach((button,index)=>button.addEventListener('click',()=>{reel.currentTime=chapters[index].start;show(index);reel.play().catch(()=>{});}));
reel.addEventListener('timeupdate',()=>{let i=chapters.findIndex(c=>reel.currentTime<c.end);show(i<0?chapters.length-1:i)});
document.querySelectorAll('video').forEach(video=>video.addEventListener('play',()=>document.querySelectorAll('video').forEach(other=>{if(other!==video)other.pause()})));
show(0);
</script></html>`);
console.log(JSON.stringify({ output, duration: final.duration, frames: final.frames, sha256: manifest.sha256, decodedFramesIdentical: true }, null, 2));
