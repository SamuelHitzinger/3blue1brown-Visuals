import {readFile,mkdtemp} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {mcpClient} from './mcp-client.mjs';
const root=path.resolve(process.argv[2]??'dist/animlib-studio-local');
const marketplace=JSON.parse(await readFile(path.join(root,'.agents/plugins/marketplace.json'),'utf8'));
assert.equal(marketplace.plugins[0].source.source,'local');
const plugin=path.resolve(root,marketplace.plugins[0].source.path);
assert.ok(plugin.startsWith(root+path.sep));
const inventory=JSON.parse(await readFile(path.join(plugin,'source-integrity.json'),'utf8'));
for(const [file,hash] of Object.entries(inventory.files)){
  assert.equal(createHash('sha256').update(await readFile(path.join(plugin,file))).digest('hex'),hash,file);
}
const client=await mcpClient(await mkdtemp(path.resolve('.tmp/studio-package-')),path.join(plugin,'src/server.mjs'));
try{
  assert.equal(client.initialization.serverInfo.name,'animlib-studio');
  const {tools}=await client.request('tools/list');assert.equal(tools.length,14);
  const help=await client.call('help',{topic:'flow'});assert.ok(help.example.cues.length);
  const session=await client.call('create',{title:'Portable package smoke'});
  const response=await fetch(session.viewerUrl);
  assert.equal(response.status,200);assert.match(await response.text(),/Animlib Studio/);
  const key=new URLSearchParams(new URL(session.viewerUrl).hash.slice(1)).get('token');
  const boot=await fetch(new URL(`/s/${session.sessionId}/bootstrap?token=${key}`,session.viewerUrl));
  assert.equal((await boot.json()).title,'Portable package smoke');
  console.log(`PASS: ${Object.keys(inventory.files).length} package hashes; 14 MCP tools; standalone viewer delivery.`);
}finally{await client.close();}
