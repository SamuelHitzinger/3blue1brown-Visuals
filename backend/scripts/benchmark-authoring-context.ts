/** Deterministic context accounting; no provider calls or private lecture inputs. */
import {readFile} from 'node:fs/promises';
import {buildAuthoringReference,loadAuthoringContext} from '../src/agents/authoring-reference.js';
import {createReferenceTools} from '../src/agents/reference-tools.js';

const reference=await readFile(new URL('../../shared/animlib/docs/reference.md',import.meta.url),'utf8');
const complete=buildAuthoringReference(reference);
const compact=await loadAuthoringContext();
const tool=createReferenceTools(compact.sections);
let retrievedChars=0;
for(const section of compact.sections){
  let offset=0,actual='';
  do{
    const page=await tool.read({id:section.id,offset,limit:1000},new AbortController().signal);
    actual+=page.content;
    if(page.nextOffset===undefined)break;
    offset=page.nextOffset;
  }while(true);
  if(actual!==section.content)throw new Error(`Incomplete reference: ${section.id}`);
  retrievedChars+=actual.length;
}
console.log(JSON.stringify({kind:'authoring-context-characters',fullReferenceChars:reference.length,
  completeAuthoringChars:complete.length,compactAuthoringChars:compact.reference.length,
  savedChars:complete.length-compact.reference.length,
  savedPercent:100*(complete.length-compact.reference.length)/complete.length,
  onDemandSections:compact.sections.length,retrievedChars,
  limits:['Character counts are not tokenizer counts or model latency.',
    'Compact context retains core API and scientific signatures; craft and delivery prompts are separate.',
    'Complete baseline has the current scientific API but excludes the additional standalone guide and four seeds; those are indexed only in compact context.']},null,2));
