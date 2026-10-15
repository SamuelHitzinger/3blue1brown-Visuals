/** Resolve a semantic phrase against a retained local ASR trial. */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {createHash} from 'node:crypto';
import {measuredCues} from './realtime-media/timing.js';
const [trialPath,phrase]=process.argv.slice(2);
if(!trialPath||!phrase)throw new Error('Usage: realtime-cue-probe.ts ASR_TRIAL_JSON "exact spoken phrase"');
const path=resolve(trialPath),raw=await readFile(path,'utf8'),trial=JSON.parse(raw);
const identity=JSON.parse(await readFile(join(dirname(path),'started.json'),'utf8'));
const durationSec=trial.windowEndSec===undefined?identity.audioInfo.durationSec:trial.windowEndSec-trial.windowStartSec;
const sourceOffsetSec=trial.sourceWindowStartSec??identity.sourceOffsetSec;
const started=performance.now();
const packet=measuredCues({id:`asr${trial.index}`,durationSec,sourceOffsetSec,segments:trial.segments},[{id:'selected',phrase}]);
const report={evidenceKind:'measured-asr-cue-resolution',trialPath:path,trialSha256:createHash('sha256').update(raw).digest('hex'),
  resolverMs:performance.now()-started,...packet};
const output=resolve('data/realtime-workshop/cues',new Date().toISOString().replaceAll(':','-'));
await mkdir(output,{recursive:true});await writeFile(join(output,'result.json'),JSON.stringify(report,null,2),{flag:'wx'});
console.log(JSON.stringify({report:join(output,'result.json'),resolverMs:report.resolverMs,cues:packet.sourceCues},null,2));
