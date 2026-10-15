import type { Frame } from 'animlib/core';

// Experimental bounded transport, not a general animlib authoring language.
// No removal, grouping, controls, imported assets, cameras, or arbitrary code.
// This validates protocol/data only; the caller must compile in QuickJS and run
// rendering, semantic coverage and quality checks before publishing the result.
const MAX_BYTES = 256 * 1024;
const MAX_RECORDS = 256;
const MAX_ELEMENTS = 256;
const MAX_POINTS = 2048;
const MAX_SECONDS = 300;
const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
const kinds = new Set(['box', 'circle', 'rectangle', 'path', 'line', 'arrow', 'text']);
const colors = new Set(['BLUE', 'TEAL', 'YELLOW', 'WHITE', 'none']);
const commonProps = ['position', 'rotation', 'fill', 'stroke', 'strokeEnd'];
const geometryProps: Record<string, string[]> = {
  box: ['width', 'height', 'depth'], circle: ['radius'], rectangle: ['width', 'height'],
  path: ['points'], line: ['points'], arrow: ['points'], text: ['text', 'fontSize'],
};
const animationProps = new Set(['position', 'rotation', 'fill', 'stroke', 'opacity', 'strokeEnd']);

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid operation batch: ${message}`);
}
function record(value: unknown, label: string): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: string[], label: string) {
  check(Object.keys(value).every(key => allowed.includes(key)), `${label} has unknown fields`);
  check(allowed.every(key => Object.hasOwn(value, key)), `${label} has missing fields`);
}
function id(value: unknown): string {
  check(typeof value === 'string' && value.length > 0 && value.length <= 256 &&
    !value.startsWith('@') && !/[\u0000-\u001f\u007f]/.test(value) && !forbidden.has(value), 'invalid ID');
  return value;
}
function finite(value: unknown, label: string): number {
  check(typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1e6, `${label} must be a bounded finite number`);
  return value;
}
function vector(value: unknown, label: string) {
  check(Array.isArray(value) && (value.length === 2 || value.length === 3), `${label} must have 2 or 3 components`);
  value.forEach(component => finite(component, label));
}
function properties(value: unknown, kind?: string): Record<string, unknown> {
  const props = record(value, 'props');
  const allowed = kind ? new Set([...commonProps, ...geometryProps[kind]]) : animationProps;
  check(Object.keys(props).length > 0, 'props cannot be empty');
  for (const [key, property] of Object.entries(props)) {
    check(allowed.has(key), `unsupported ${kind ?? 'animation'} property ${key}`);
    switch (key) {
      case 'position': vector(property, key); break;
      case 'rotation':
        if (typeof property === 'number') finite(property, key); else vector(property, key);
        break;
      case 'fill': case 'stroke':
        check(typeof property === 'string' && colors.has(property), `unsupported ${key} color`); break;
      case 'text': check(typeof property === 'string' && property.length <= 4096, 'text exceeds 4096 characters'); break;
      case 'points':
        check(Array.isArray(property) && property.length >= 2 && property.length <= MAX_POINTS, `points must contain 2-${MAX_POINTS} vectors`);
        property.forEach(point => vector(point, 'point')); break;
      case 'opacity': case 'strokeEnd':
        check(finite(property, key) >= 0 && (property as number) <= 1, `${key} must be in [0,1]`); break;
      default: check(finite(property, key) > 0, `${key} must be positive`);
    }
  }
  if (kind === 'text') check(Object.hasOwn(props, 'text'), 'text primitive requires text');
  if (kind === 'path' || kind === 'line' || kind === 'arrow') check(Object.hasOwn(props, 'points'), `${kind} requires points`);
  return props;
}

/** Lower a fully committed NDJSON batch without executing or partially applying it. */
export function lowerOperations(text: string, previous?: Frame): string {
  check(typeof text === 'string' && Buffer.byteLength(text, 'utf8') <= MAX_BYTES, `input exceeds ${MAX_BYTES} bytes`);
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  check(lines.length >= 2 && lines.length <= MAX_RECORDS, `expected 2-${MAX_RECORDS} records`);
  let nodes = 0;
  const inspect = (value: unknown, depth = 0): void => {
    check(++nodes <= 20000 && depth <= 8, 'JSON structural limit exceeded');
    if (typeof value === 'number') finite(value, 'JSON number');
    if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        check(!forbidden.has(key), `forbidden key ${key}`);
        inspect(child, depth + 1);
      }
    }
  };
  const records = lines.map((line, index) => {
    let value: unknown;
    try { value = JSON.parse(line); } catch { throw new Error(`Invalid operation batch: malformed JSON at line ${index + 1}`); }
    inspect(value);
    return record(value, `line ${index + 1}`);
  });
  const header = records[0];
  keys(header, ['op', 'mode', 'end'], 'scene');
  check(header.op === 'scene' && (header.mode === '2d' || header.mode === '3d') && header.end === 'hold', 'first record must declare a 2d/3d hold scene');
  keys(records.at(-1)!, ['op'], 'commit');
  check(records.at(-1)!.op === 'commit', 'last record must commit');

  const handles = new Map<string, string>();
  const inherited = new Set<string>();
  const kept = new Set<string>();
  const source: string[] = [`export default scene(${JSON.stringify({ mode: header.mode, end: 'hold', orbit: false })},s=>{`];
  const literal = (value: unknown) => JSON.stringify(value).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const register = (name: string) => {
    check(!handles.has(name), `duplicate ID ${name}`);
    check(handles.size < MAX_ELEMENTS, `element limit ${MAX_ELEMENTS} exceeded`);
    const handle = `h${handles.size}`;
    handles.set(name, handle);
    return handle;
  };
  const resolve = (value: unknown) => {
    const name = id(value), handle = handles.get(name);
    check(handle !== undefined, `missing persistent/new ID ${name}`);
    return { name, handle };
  };
  if (previous) {
    check(Array.isArray(previous.elements) && previous.elements.length <= MAX_ELEMENTS, 'previous frame exceeds element limit');
    const seen = new Set<string>();
    for (const element of previous.elements) {
      const name = id(element.id);
      check(!seen.has(name), `duplicate previous ID ${name}`); seen.add(name);
      if (!element.persistent) continue;
      const handle = register(name); inherited.add(name);
      source.push(`const ${handle}=s.previous.get(${literal(name)});`);
    }
  }
  let elapsed = 0;
  const duration = (value: unknown) => {
    const seconds = finite(value, 'duration');
    check(seconds >= 0 && seconds <= MAX_SECONDS, `duration must be in [0,${MAX_SECONDS}]`);
    elapsed += seconds;
    check(elapsed <= MAX_SECONDS, `batch duration exceeds ${MAX_SECONDS} seconds`);
    return seconds;
  };
  for (const operation of records.slice(1, -1)) {
    switch (operation.op) {
      case 'add': {
        keys(operation, ['op', 'kind', 'id', 'props'], 'add');
        check(typeof operation.kind === 'string' && kinds.has(operation.kind), 'unsupported primitive kind');
        const name = id(operation.id), props = properties(operation.props, operation.kind);
        const handle = register(name);
        source.push(`const ${handle}=s.${operation.kind}(${literal(name)},${literal(props)});`);
        break;
      }
      case 'animate': {
        keys(operation, ['op', 'duration', 'changes'], 'animate');
        const seconds = duration(operation.duration);
        check(Array.isArray(operation.changes) && operation.changes.length > 0 && operation.changes.length <= MAX_ELEMENTS, 'invalid animation changes');
        const targets = new Set<string>();
        const actions = operation.changes.map(value => {
          const change = record(value, 'change'); keys(change, ['id', 'props'], 'change');
          const { name, handle } = resolve(change.id);
          check(!targets.has(name), `duplicate simultaneous target ${name}`); targets.add(name);
          return `${handle}.animate(${literal(properties(change.props))})`;
        });
        source.push(`s.play([${actions.join(',')}],{duration:${seconds}});`);
        break;
      }
      case 'wait':
        keys(operation, ['op', 'duration'], 'wait');
        source.push(`s.wait(${duration(operation.duration)});`);
        break;
      case 'keep': {
        keys(operation, ['op', 'ids'], 'keep');
        check(Array.isArray(operation.ids) && operation.ids.length > 0 && operation.ids.length <= MAX_ELEMENTS, 'invalid keep IDs');
        const targets = new Set<string>();
        for (const value of operation.ids) {
          const { name, handle } = resolve(value);
          check(!targets.has(name), `duplicate keep ID ${name}`); targets.add(name); kept.add(name);
          source.push(`s.keep(${handle});`);
        }
        break;
      }
      default: throw new Error(`Invalid operation batch: unknown or misplaced operation ${String(operation.op)}`);
    }
  }
  for (const name of inherited) if (!kept.has(name)) source.push(`s.keep(${handles.get(name)});`);
  source.push('});');
  return source.join('\n');
}
