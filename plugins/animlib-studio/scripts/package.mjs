import {cp,mkdir,readFile,writeFile,access,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const source=fileURLToPath(new URL('../',import.meta.url)),repo=path.resolve(source,'../..');
const destination=path.resolve(process.argv[2]??path.join(repo,'dist/animlib-studio-local'));
try{await access(destination);throw Error(`Destination exists: ${destination}`);}catch(error){if(error.code!=='ENOENT')throw error;}
await access(path.join(source,'dist/index.html'));
const plugin=path.join(destination,'plugins/animlib-studio');
await mkdir(path.join(plugin,'src'),{recursive:true});
for(const file of ['server.mjs','bridge.mjs','connections.mjs','tools.mjs'])await cp(path.join(source,'src',file),path.join(plugin,'src',file));
for(const name of ['dist','skills','.codex-plugin','.mcp.json','README.md'])await cp(path.join(source,name),path.join(plugin,name),{recursive:true});
const manifest=JSON.parse(await readFile(path.join(source,'package.json'),'utf8'));
manifest.scripts={start:'node src/server.mjs --serve',mcp:'node src/server.mjs'};
await writeFile(path.join(plugin,'package.json'),JSON.stringify(manifest,null,2));
await mkdir(path.join(destination,'.agents/plugins'),{recursive:true});
await writeFile(path.join(destination,'.agents/plugins/marketplace.json'),JSON.stringify({
  name:'animlib-local',interface:{displayName:'Animlib Studio Local'},plugins:[{name:'animlib-studio',
    source:{source:'local',path:'./plugins/animlib-studio'},policy:{installation:'AVAILABLE',authentication:'ON_INSTALL'},category:'Productivity'}]
},null,2));
const files={};
async function inventory(dir){for(const item of await readdir(dir,{withFileTypes:true})){
  const absolute=path.join(dir,item.name);
  if(item.isDirectory())await inventory(absolute);
  else files[path.relative(plugin,absolute).replaceAll('\\','/')]=createHash('sha256').update(await readFile(absolute)).digest('hex');
}}
await inventory(plugin);
await writeFile(path.join(plugin,'source-integrity.json'),JSON.stringify({
  baseRevision:'6982449',revision:execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),
  dirty:execFileSync('git',['status','--porcelain'],{cwd:repo,encoding:'utf8'}).trim().length>0,
  transportSource:{name:'Desmos Studio',version:'0.6.0',revision:'13544c8'},files
},null,2));
console.log(JSON.stringify({marketplace:destination,plugin,files:Object.keys(files).length},null,2));
