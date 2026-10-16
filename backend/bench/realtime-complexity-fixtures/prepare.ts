/** Public data only; reproduces the chemistry cases used in screen-01 without author calls. */
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const fixturePath=fileURLToPath(new URL('./caffeine-cid2519.fixture.json',import.meta.url));
const dataFile=fileURLToPath(new URL('./caffeine-cid2519.data.json',import.meta.url));

/** Add the two caffeine cases to an existing prepared manifest; never replace different case evidence. */
export async function prepareCaffeineCases(directory:string):Promise<string[]> {
  const root=resolve(directory),fixture=JSON.parse(await readFile(fixturePath,'utf8'));
  const data=await readFile(dataFile);
  if(createHash('sha256').update(data).digest('hex')!==fixture.dataSha256)throw Error('Tracked caffeine data hash mismatch');
  const manifestPath=join(root,'manifest.json'),manifest=JSON.parse(await readFile(manifestPath,'utf8'));
  if(!manifest||!Array.isArray(manifest.cases)||!manifest.cases.every((id:unknown)=>typeof id==='string'))throw Error('Invalid complexity case manifest');
  const files:{path:string;content:string}[]=[],ids:string[]=[];
  for(const [variant,id] of [['low','caffeine-heavy'],['high','caffeine-full']] as const){
    const v=fixture.variants[variant];const c={id,subject:'organic chemistry',detail:variant==='low'?'low':'high',dimension:3,dataFile,dataSha256:fixture.dataSha256,expectedAtoms:v.expectedAtoms,expectedBonds:v.expectedBonds,source:fixture.source.url,formula:fixture.promptContext.formula};
    const operation=variant==='low'?'Use detail:0 in s.molecule for each atom. Show all heavy atoms from setup; sequentially emphasize the two oxygen atoms and four nitrogen atoms so the viewer can count them. Retain bonds and atom identities. State locally that hydrogens are omitted.':'Use detail:2 in s.molecule for each atom. Start with complete heavy-atom scaffold; reveal all10hydrogens and their bonds together in1–3s, then rotate the whole molecule modestly as one rigid group over3–6s to expose depth. End with every24atom and25bond visible; final2s completely hold. No invented molecular motion.';
    const prompt=`Controlled instruction authoring screen, not live lecture ingestion. Subject: organicchemistry, required3D. Exactly8s total, final2s readinghold.\nSource:${fixture.source.url}; computed3D conformer, not experimental or dynamics. Host defines read-only lexical DATA before your exact submittedsource is compiled. Do not redeclare DATA or reproduce numericarrays.\n${fixture.hostContract.schema}\n${fixture.hostContract.sourceCoordinates}\nCounts/bounds:${JSON.stringify(fixture.promptContext)}\n${fixture.promptContext.sharedInstructions}\n${v.instructions}\n${operation}\nUse s.molecule(id,{positions:[x,y,z],radius,detail,fill}) for an individual low/high-detail atom. Bonds use s.line3D; doublebonds must showtwo parallelsticks without changing atompositions. Local formula/legend are scientificannotations, not detachedtitle/footer. Use stable IDs atom-<PubChemID> and bond-<bondIndex>-<strokeIndex> so completeness can be audited.`;
    files.push({path:join(root,id,'case.json'),content:JSON.stringify(c,null,2)},{path:join(root,id,'prompt.txt'),content:prompt});ids.push(id);
  }
  // Check all conflicts before writing anything, preserving an already authored screen.
  const missing:typeof files=[];
  for(const file of files){
    try{if(await readFile(file.path,'utf8')!==file.content)throw Error(`Existing case evidence differs: ${file.path}`);}
    catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;missing.push(file);}
  }
  for(const id of ids)await mkdir(join(root,id),{recursive:true});
  for(const file of missing)await writeFile(file.path,file.content,{flag:'wx'});
  const next=[...manifest.cases];for(const id of ids)if(!next.includes(id))next.push(id);
  if(next.length!==manifest.cases.length)await writeFile(manifestPath,JSON.stringify({...manifest,cases:next},null,2));
  return next;
}
