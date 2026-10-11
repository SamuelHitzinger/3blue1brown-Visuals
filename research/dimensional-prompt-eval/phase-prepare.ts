import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAuthoringReference } from '../../backend/src/agents/authoring-reference.js';
import { constructionAnchors } from './phase-support.js';
const root=fileURLToPath(new URL('.',import.meta.url)), repo=resolve(root,'../..');
const hash=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
const args=process.argv.slice(2), freeze=args.includes('--freeze');
const formal=JSON.parse(await readFile(join(root,'formal-experiment.json'),'utf8'));
const draftPath=join(root,'phase2-manifest.draft.json');
const sourceText=await readFile(join(root,'baseline/production-source-hashes.json'),'utf8');
if(hash(sourceText)!==formal.sourceSnapshotSha256)throw Error('Phase-1 source snapshot changed.');
const source=JSON.parse(sourceText);
for(const [name,expected] of Object.entries(source.files))if(hash(await readFile(join(repo,name)))!==expected)throw Error('Production source changed: '+name);
const originalCasesText=await readFile(join(root,'cases.json'),'utf8');
if(hash(originalCasesText)!==formal.casesSha256)throw Error('Phase-1 cases changed.');
const originalCases=JSON.parse(originalCasesText);
const enzyme=originalCases.find((item:any)=>item.id==='enzyme');
if(!enzyme)throw Error('Missing original enzyme case.');
const casesPath=join(root,'phase2-cases.json');
const casesText=JSON.stringify([enzyme],null,2);
try{await writeFile(casesPath,casesText,{flag:'wx'});}catch(error:any){if(error.code!=='EEXIST')throw error;if(await readFile(casesPath,'utf8')!==casesText)throw Error('Phase-2 cases changed.');}
const reference=buildAuthoringReference(await readFile(join(repo,'shared/animlib/docs/reference.md'),'utf8'));
const anchors=constructionAnchors(await readFile(join(root,'spatial/scene-craft.md'),'utf8'),reference);
const experimentInputs:Record<string,string>={};
for(const name of ['phase-run.ts','phase-matrix.ts','phase-prepare.ts','phase-support.ts','phase-support.test.ts','phase-provenance.ts','phase-provenance.test.ts','phase-verify.ts','construction-runner.ts','construction-runner.test.ts','construction-specialist.md','prompt-substitution.ts','run.ts','matrix.ts','cases.json',
  ...['animation-quality.md','guidance.md','scene-craft.md','scene-request-guidance.md','scene-review.md','scene-verify.md','story-review.md','viewing-mode.md','planning-contract.txt'].map(name=>'spatial/'+name)]) {
  const file=join(root,name);experimentInputs[relative(repo,file).replaceAll('\\','/')]=hash(await readFile(file));
}
let prior:any;
try{prior=JSON.parse(await readFile(draftPath,'utf8'));}catch(error:any){if(error.code!=='ENOENT')throw error;}
const manifest={schemaVersion:2,id:prior?.id??randomUUID(),phase:'construction-enzyme',status:freeze?'frozen':'draft',
  createdAt:prior?.createdAt??new Date().toISOString(),...(freeze?{frozenAt:new Date().toISOString()}:{}),
  checkoutPath:repo,branch:formal.branch,revision:formal.revision,priorExperimentId:formal.id,
  sourceSnapshotSha256:formal.sourceSnapshotSha256,promptSettingsSnapshotSha256:formal.promptSettingsSnapshotSha256,
  casesSha256:hash(casesText),maximumConcurrency:2,expectedTrials:2,experimentInputs,
  construction:{checklistSha256:hash(anchors.checklist),apiReferenceSha256:hash(reference),excerptSha256:anchors.referenceExcerpts.map(hash),
    checklistChars:anchors.checklist.length,excerptChars:anchors.referenceExcerpts.map(item=>item.length),helperMaximum:3},
  arms:['order-only','specialist'].map(mode=>({strategy:mode,caseId:'enzyme',constructionMode:mode,
    strategyDirectory:relative(repo,join(root,'spatial')).replaceAll('\\','/'),requestSha256:hash(JSON.stringify(enzyme.request))})),
  boundary:'Two fresh complete production lesson runs, exact frozen spatial prompts and unchanged enzyme request. Order-only relocates exact checklist; specialist adds a real bounded helper call to the same ordering. All helper effort counted once. Native gates and runtime budgets unchanged; no manual source edits or retries.'};
if(freeze){
  if(!prior)throw Error('Review a draft manifest and dry runs before freezing.');
  const comparable=(value:any)=>JSON.stringify({...value,status:undefined,frozenAt:undefined});
  if(comparable(prior)!==comparable(manifest))throw Error('Draft inputs changed after review; regenerate draft and review again.');
  const directory=join(root,'phases',manifest.id);await mkdir(directory,{recursive:true});
  const target=join(directory,'manifest.json');await writeFile(target,JSON.stringify(manifest,null,2),{flag:'wx'});console.log(target);
}else{await writeFile(draftPath,JSON.stringify(manifest,null,2));console.log(draftPath);}
