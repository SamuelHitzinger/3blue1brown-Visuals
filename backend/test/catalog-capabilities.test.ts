import {expect, test} from 'bun:test';
import {catalogRoutes, searchCatalog} from '../src/visualization-catalog.js';

test('capabilities require exact all-of membership, including HTTP repeated filters', async () => {
  const found = await searchCatalog({capabilities:['s.sampledState','s.path'], limit:20});
  expect(found.entries.length).toBeGreaterThan(0);
  expect(found.entries.every(e => e.capabilities?.includes('s.sampledState') && e.capabilities.includes('s.path'))).toBe(true);
  expect((await searchCatalog({capabilities:['s.sampled']})).total).toBe(0);
  expect((await searchCatalog({query:'waves',capabilities:['gltf.animation']})).total).toBe(0);
  expect((await searchCatalog({capabilities:['s.model']})).entries.map(entry=>entry.id)).toContain('crambin-1crn');
  const response = await catalogRoutes()(new Request('http://localhost/api/visualization-catalog?capability=s.sampledState&capability=s.path'));
  expect((await response.json()).entries.map((e:{id:string})=>e.id)).toEqual(found.entries.map(e=>e.id));
  for (const capabilities of [[],[''],Array(17).fill('s.path'),['x'.repeat(101)]]) {
    await expect(searchCatalog({capabilities})).rejects.toThrow();
  }
});

test('curated semantic intent finds teaching relationships while respecting exact capabilities', async () => {
  for (const [intent,id] of [
    ['move a fixed shape without stretching it','rigid-molecular-motion'],
    ['show two waves cancel each other','waves-interference'],
    ['keep track of material moving between containers','reaction-transport'],
    ['show a spring ringing after a push','mechanical-modes'],
    ['turn spike times into a firing rate','neural-event-rates'],
  ]) expect((await searchCatalog({intent})).entries.slice(0,3).map(e=>e.id)).toContain(id);
  expect((await searchCatalog({intent:'show two waves cancel each other', capabilities:['s.rigidMotion']})).entries.every(e=>e.capabilities?.includes('s.rigidMotion'))).toBe(true);
  await expect(searchCatalog({intent:'x'.repeat(241)})).rejects.toThrow();
});
