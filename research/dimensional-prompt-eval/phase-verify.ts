import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sumEffort } from './phase-provenance.js';
import { moveConstructionChecklist, parseConstructionBrief } from './construction-runner.js';
import { constructionAnchors } from './phase-support.js';
import { buildAuthoringReference } from '../../backend/src/agents/authoring-reference.js';
const root=fileURLToPath(new URL('.',import.meta.url)),repo=resolve(root,'../..');
const index=process.argv.indexOf('--manifest');if(index<0)throw Error('Required --manifest');
const manifestPath=resolve(process.argv[index+1]),manifestText=await readFile(manifestPath,'utf8'),manifest=JSON.parse(manifestText);
const phaseDirectory=join(root,'phases',manifest.id),hash=(v:string)=>createHash('sha256').update(v).digest('hex');
const reference=buildAuthoringReference(await readFile(join(repo,'shared/animlib/docs/reference.md'),'utf8'));
const anchors=constructionAnchors(await readFile(join(root,'spatial/scene-craft.md'),'utf8'),reference);
const expected:Record<string,string[]>={draft:['guidance.md','viewing-mode.md','planning-contract.txt','animation-quality.md'],review:['story-review.md','guidance.md','viewing-mode.md','planning-contract.txt','animation-quality.md'],scene:['viewing-mode.md','scene-craft.md','animation-quality.md'],'visual-review':['viewing-mode.md','scene-craft.md','animation-quality.md','scene-verify.md'],'visual-repair':['viewing-mode.md','scene-craft.md','animation-quality.md','scene-repair.md']};
const audit=[];
for(const arm of manifest.arms){
  let result:any;try{result=JSON.parse(await readFile(join(phaseDirectory,arm.strategy+'-'+arm.caseId+'.result.json'),'utf8'));}catch(error:any){if(error.code==='ENOENT')continue;throw error;}
  const failures:string[]=[],eventIds=new Set<string>();
  if(result.formalExperimentId!==manifest.id || result.manifestSha256!==hash(manifestText))failures.push('Manifest identity mismatch');
  if(result.requestSha256!==arm.requestSha256)failures.push('Request identity mismatch');
  let brief:string|undefined;
  if(result.status==='complete' && result.construction.pendingEventCount!==0)failures.push('Unconsumed construction events remain');
  for(const task of result.tasks??[]){
    const prefix=join(result.directory,`task-${task.number}-${task.stage}`);
    const metadata=JSON.parse(await readFile(prefix+'.effective.json','utf8'));
    const system=await readFile(prefix+'.system.txt','utf8'),user=await readFile(prefix+'.user.txt','utf8'),completion=await readFile(prefix+'.completion.txt','utf8');
    if(hash(system)!==metadata.effectiveSystemSha256 || hash(user)!==metadata.userSha256 || hash(system+completion)!==metadata.effectiveSystemWithCompletionSha256)failures.push('Task '+task.number+' effective hash mismatch');
    if((expected[task.stage]??[]).some(name=>!metadata.matchedFragments[name]))failures.push('Task '+task.number+' missing prompt fragment');
    if(task.stage==='construction-specialist'){
      try {const output=await readFile(prefix+'.output.txt','utf8');brief=JSON.stringify(parseConstructionBrief(output));}
      catch(error:any){if(result.status==='complete'||error.code!=='ENOENT')throw error;}
    }
    const expectedRole=task.stage==='construction-specialist'?'construction-specialist':task.stage==='visual-review'?'review':task.stage==='visual-repair'?'repair':task.stage==='scene'?'scene':undefined;
    let spatial=false;
    if(expectedRole && task.sceneIndex!==undefined){
      const context=JSON.parse(await readFile(join(result.directory,'scene-'+task.sceneIndex+'.construction-context.json'),'utf8'));
      spatial=context.viewMode==='3d';
    }
    if(spatial && (!task.constructionTaskId || task.constructionRole!==expectedRole))failures.push('Spatial task missing correct construction event identity');
    if(task.constructionTaskId){
      if(eventIds.has(task.constructionTaskId))failures.push('Duplicate construction task accounting');eventIds.add(task.constructionTaskId);
      const event=JSON.parse(await readFile(join(result.directory,task.constructionTaskId+'.start.json'),'utf8'));
      if(event.role!==expectedRole || event.taskId!==task.constructionTaskId)failures.push('Construction event role/identity mismatch');
      if(event.effectiveInput.systemPrompt!==system || event.effectiveInput.prompt!==user || event.modelSystemPrompt!==system+completion)failures.push('Decorator/final-input provenance mismatch');
      if(task.stage!=='construction-specialist'){
        if(moveConstructionChecklist(event.originalInput.systemPrompt,anchors.checklist,reference)!==system || event.originalInput.systemPrompt.length!==system.length)failures.push('Checklist movement is not byte-preserving');
        if(arm.constructionMode==='order-only' && event.originalInput.prompt!==user)failures.push('Order-only changed user input');
        if(arm.constructionMode==='specialist' && (!brief || !user.endsWith(brief)))failures.push('Specialist proposal missing from author/review/repair');
      }
    }
  }
  if(result.effort && JSON.stringify(sumEffort(result.tasks))!==JSON.stringify(result.effort))failures.push('Effort totals differ from actual model tasks');
  const actualHelperCount=result.tasks.filter((task:any)=>task.stage==='construction-specialist').length;
  if(result.construction && actualHelperCount!==result.construction.helperTaskCount)failures.push('Reported helper count differs from actual tasks');
  if(result.status==='complete' && arm.constructionMode==='specialist' && actualHelperCount!==result.construction.spatialSceneCount)failures.push('Unexpected helper count for spatial enzyme');
  if(arm.constructionMode==='order-only' && result.tasks.some((task:any)=>task.stage==='construction-specialist'))failures.push('Order-only invoked specialist');
  for(const scene of result.scenes??[]){const source=await readFile(join(result.directory,`scene-${scene.index}.subtitles.js`),'utf8');const review=JSON.parse(await readFile(join(result.directory,`scene-${scene.index}.visual-review.json`),'utf8'));if(hash(source)!==scene.sourceSha256 || hash(source)!==review.sourceSha256 || !review.approved)failures.push('Final source/approval mismatch');}
  audit.push({strategy:arm.strategy,caseId:arm.caseId,id:result.id,status:result.status,auditPassed:result.status==='running'?null:failures.length===0,failures,boundary:'Prompt/effective-input/provenance and actual-call accounting audit, not visual/scientific judgment.'});
}
await writeFile(join(phaseDirectory,'provenance-audit.json'),JSON.stringify(audit,null,2));console.log(JSON.stringify(audit,null,2));if(audit.some(item=>item.auditPassed===false))process.exitCode=1;
