import { createHash } from 'node:crypto';

export interface VisualVerification {
  approved: boolean;
  findings: { timeSec: number | null; objectIds: string[]; problem: string; fix: string }[];
}
export const sourceHash = (source: string) => createHash('sha256').update(source).digest('hex');

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}

/** Verification cannot smuggle edits or replacement source into a review response. */
export function parseVisualVerification(output: string, duration: number): VisualVerification {
  const result: unknown = JSON.parse(output);
  if (!record(result) || !exactKeys(result, ['approved', 'findings']) || typeof result.approved !== 'boolean'
    || !Array.isArray(result.findings) || result.findings.length > 40) throw new Error('Return only approved and at most 40 findings; verification never edits source.');
  for (const finding of result.findings) {
    if (!record(finding) || !exactKeys(finding, ['timeSec', 'objectIds', 'problem', 'fix'])
      || !(finding.timeSec === null || typeof finding.timeSec === 'number' && Number.isFinite(finding.timeSec) && finding.timeSec >= 0 && finding.timeSec <= duration)
      || !Array.isArray(finding.objectIds) || finding.objectIds.length > 100 || finding.objectIds.some(id => typeof id !== 'string' || !id || id.length > 128)
      || typeof finding.problem !== 'string' || !finding.problem.trim() || finding.problem.length > 4000
      || typeof finding.fix !== 'string' || !finding.fix.trim() || finding.fix.length > 4000) throw new Error('Each finding needs an in-range time or null, objectIds, a concrete problem and a fix.');
  }
  if (result.approved !== (result.findings.length === 0)) throw new Error('Approval requires no findings; rejection requires concrete findings.');
  return result as unknown as VisualVerification;
}

/** Apply a bounded patch atomically against original bytes; never use regex replacement. */
export function applyVisualEdits(output: string, source: string, findingCount: number): string {
  const patch: unknown = JSON.parse(output);
  if (!record(patch) || !exactKeys(patch, ['sourceSha256', 'edits']) || patch.sourceSha256 !== sourceHash(source)) throw new Error('Patch must contain sourceSha256 and edits, matching the exact candidate hash.');
  if (!Array.isArray(patch.edits) || !patch.edits.length || patch.edits.length > 80) throw new Error('Return 1–80 targeted edits, never full replacement source.');
  const addressed = new Set<number>();
  let removed = 0, added = 0;
  const edits = patch.edits.map(edit => {
    if (!record(edit) || !exactKeys(edit, ['finding', 'before', 'after'])
      || !Number.isInteger(edit.finding) || (edit.finding as number) < 0 || (edit.finding as number) >= findingCount
      || typeof edit.before !== 'string' || !edit.before || edit.before.length > 16000
      || typeof edit.after !== 'string' || edit.after.length > 16000 || edit.before === edit.after) throw new Error('Each edit needs a valid finding index, unique nonempty before text and a changed after string.');
    const start = source.indexOf(edit.before);
    if (start < 0 || source.indexOf(edit.before, start + 1) >= 0) throw new Error('The before text must match exactly once in the original source. Include enough unique context; preserve JSON backslash escaping.');
    // Count changed spans, not the unchanged context used to identify an edit.
    // Aggregate across edits so splitting a rewrite cannot bypass the limit.
    let prefix = 0, suffix = 0;
    while (prefix < Math.min(edit.before.length, edit.after.length) && edit.before[prefix] === edit.after[prefix]) prefix++;
    while (suffix < Math.min(edit.before.length, edit.after.length) - prefix
      && edit.before[edit.before.length - 1 - suffix] === edit.after[edit.after.length - 1 - suffix]) suffix++;
    removed += edit.before.length - prefix - suffix;
    added += edit.after.length - prefix - suffix;
    addressed.add(edit.finding as number);
    return { start, end: start + edit.before.length, after: edit.after };
  }).sort((a, b) => a.start - b.start);
  if (Math.max(removed, added) > source.length * 0.25) throw new Error('Targeted repairs may change at most 25% of original source; narrow each edit to the verified defect and preserve unrelated code.');
  if (addressed.size !== findingCount) throw new Error('Every finding must have at least one targeted edit.');
  for (let i = 1; i < edits.length; i++) if (edits[i].start < edits[i - 1].end) throw new Error('Patch edits must not overlap in the original source.');
  let result = source;
  for (const edit of edits.reverse()) result = result.slice(0, edit.start) + edit.after + result.slice(edit.end);
  if (result === source || result.length > 256000) throw new Error('Patch must change source and stay within the source size limit.');
  return result;
}
