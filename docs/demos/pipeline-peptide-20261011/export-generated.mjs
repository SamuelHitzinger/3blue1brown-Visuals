/** Local adapter over the repository's native video exporter. No scene source is rewritten.
 * --manifest export-manifest.json --output demo.mp4 --ffmpeg /path/to/ffmpeg
 * Optional --start/--end select absolute lesson seconds, retaining the original scene clock.
 * The manifest must declare narrationMode:"subtitles" and each scene must use its
 * production subtitle-clock-<scene-id> audio ID. Other audio is never silently discarded.
 * All renderer, geometry, source loading, encoding and cleanup code comes from render-video.mjs.
 */
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const exporter = new URL('../../../shared/animlib/tools/render-video.mjs', import.meta.url);
const requireFromExporter = createRequire(exporter);
let program = (await readFile(exporter, 'utf8')).replaceAll('\r\n', '\n');

function replaceOnce(before, after) {
  if (program.split(before).length !== 2) throw new Error(`Exporter changed; review adapter anchor: ${before.slice(0, 100)}`);
  program = program.replace(before, after);
}

replaceOnce("'crf', 'preset']);", "'crf', 'preset', 'start', 'end']);");
replaceOnce("['width', 'height', 'fps', 'crf'].includes(key)", "['width', 'height', 'fps', 'crf', 'start', 'end'].includes(key)");
replaceOnce('  const duration = validateManifest(manifest);', `  const duration = validateManifest(manifest);
  if (manifest.narrationMode !== 'subtitles') throw new Error('This adapter accepts only explicit subtitles manifests.');
  const exportStart = options.start ?? 0, exportEnd = options.end ?? duration;
  if (!Number.isFinite(exportStart) || !Number.isFinite(exportEnd) || exportStart < 0 || exportEnd > duration || exportEnd <= exportStart) {
    throw new Error('Expected 0 <= start < end <= full lesson duration.');
  }
  manifest.captions = (manifest.captions ?? []).filter(cue => cue.end > exportStart && cue.start < exportEnd)
    .map(cue => ({ ...cue, start: Math.max(cue.start, exportStart) - exportStart, end: Math.min(cue.end, exportEnd) - exportStart }));`);
replaceOnce('Math.ceil(duration * fps - 1e-8)', 'Math.ceil((exportEnd - exportStart) * fps - 1e-8)');
replaceOnce('        if (compiled.options.audio) throw new Error(`Scene ${entry.id} declares audio; silent export requires silent source scenes.`);',
  '        if (compiled.options.audio !== `subtitle-clock-${entry.id}`) throw new Error(`Scene ${entry.id} must use its exact production subtitle clock; arbitrary audio is not accepted.`);');
replaceOnce('Math.min(frameCount, Math.ceil(sceneEnd * fps - 1e-8))', 'Math.min(frameCount, Math.max(0, Math.ceil((sceneEnd - exportStart) * fps - 1e-8)))');
replaceOnce('frameIndex / fps - sceneStart', 'exportStart + frameIndex / fps - sceneStart');
replaceOnce('duration: frameCount / fps, audio: false', 'duration: frameCount / fps, sourceStart: exportStart, sourceEnd: exportEnd, audio: false');

// A data module has no filesystem base. Resolve every file/package import against
// the original exporter, keeping its exact dependency graph and avoiding copies.
program = program.replace(/^(import .+ from )'([^']+)';$/gm, (_, prefix, specifier) => {
  if (specifier.startsWith('node:')) return `${prefix}'${specifier}';`;
  const resolved = specifier.startsWith('.') ? new URL(specifier, exporter).href : requireFromExporter.resolve(specifier);
  const url = specifier.startsWith('.') ? resolved : pathToFileURL(resolved).href;
  return `${prefix}${JSON.stringify(url)};`;
});
program += '\n//# sourceURL=animlib-export-generated-adapter.mjs\n';
await import(`data:text/javascript;base64,${Buffer.from(program).toString('base64')}`);
