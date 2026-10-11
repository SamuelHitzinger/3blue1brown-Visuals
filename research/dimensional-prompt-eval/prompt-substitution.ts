export function replacePromptFragments(text: string, fragments: Record<string, { original: string; candidate: string }>) {
  const originals = new Map<string, { names: string[]; candidate: string }>();
  for (const [name, { original, candidate }] of Object.entries(fragments)) {
    if (!original) throw new Error(`Empty original fragment: ${name}`);
    const prior = originals.get(original);
    if (prior && prior.candidate !== candidate) throw new Error(`Ambiguous original fragments: ${prior.names.join(', ')} and ${name}`);
    if (prior) prior.names.push(name);
    else originals.set(original, { names: [name], candidate });
  }
  const matches: Record<string, number> = {};
  if (!originals.size) return { text, matches };
  const pattern = [...originals.keys()].sort((a, b) => b.length - a.length)
    .map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const replaced = text.replace(new RegExp(pattern, 'g'), original => {
    const fragment = originals.get(original)!;
    for (const name of fragment.names) matches[name] = (matches[name] ?? 0) + 1;
    return fragment.candidate;
  });
  return { text: replaced, matches };
}
