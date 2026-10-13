/** CPU preparation/evaluation costs; not model latency or GPU frame rates. */
import {createScientificStateBuilders,createSampledState} from '../dist/core.js';

const science=createScientificStateBuilders();
const results=[];
let sink=0;
let prepared;
function measure(name,iterations,operation){
  operation(0);
  const rounds=[];
  for(let round=0;round<5;round++){
    const start=performance.now();
    for(let i=0;i<iterations;i++)sink+=operation(i);
    rounds.push((performance.now()-start)/iterations);
  }
  rounds.sort((a,b)=>a-b);
  results.push({name,iterations,medianMillisecondsPerCall:rounds[2]});
}

const modalInput={modes:Array.from({length:16},(_,mode)=>({
  shape:Array.from({length:32},(_,coordinate)=>Math.sin((coordinate+1)*(mode+1)*Math.PI/33)),
  amplitude:1/(mode+1),angularFrequency:(mode+1)*.2,
}))};
measure('modal.prepare.16x32',100,()=>{prepared=science.modalState(modalInput);return Number(typeof prepared.at==='function');});
const modal=science.modalState(modalInput);
measure('modal.at.16x32',2000,i=>modal.at(i*.01).displacement[0]);

const transportInput={
  initial:Array.from({length:32},(_,i)=>i===0?1:0),
  transfers:Array.from({length:128},(_,i)=>({id:String(i),from:Math.floor(i/4),to:(Math.floor(i/4)+i%4+1)%32,fraction:.1})),
  steps:128,
};
measure('transport.prepare.32x128x128',100,()=>{prepared=science.conservativeTransport(transportInput);return prepared.steps;});
const transport=science.conservativeTransport(transportInput);
measure('transport.prepared.at64',2000,()=>transport.at(64).values[0]);
// Equivalent direct formulas, including snapshot flows, recomputed per seek.
function replayTransport(step){
  let values=[...transportInput.initial];
  for(let n=0;n<step;n++){
    const next=values.map(mass=>mass*.6);
    for(const edge of transportInput.transfers)next[edge.to]+=values[edge.from]*edge.fraction;
    values=next;
  }
  const flows=transportInput.transfers.map(edge=>({id:edge.id,from:edge.from,to:edge.to,amount:values[edge.from]*edge.fraction}));
  return {values,flows};
}
for(let i=0;i<32;i++)if(Math.abs(replayTransport(64).values[i]-transport.at(64).values[i])>1e-12)throw new Error('Transport comparison differs');
measure('transport.recompute.at64',100,()=>replayTransport(64).values[0]);

const interferenceInput={waves:Array.from({length:32},(_,i)=>({amplitude:[1/32,0],angularFrequency:i*.1,waveVector:[i*.2,0,0]}))};
measure('interference.prepare.32',100,()=>{prepared=science.complexInterference(interferenceInput);return Number(typeof prepared.at==='function');});
const interference=science.complexInterference(interferenceInput);
measure('interference.at.32',2000,i=>interference.at(i*.01,[.7,0,0]).intensity);

const rateInput={
  events:Array.from({length:8},(_,channel)=>Array.from({length:40},(_,i)=>i*.08+channel*.003)),
  times:Array.from({length:321},(_,i)=>i*.01),bandwidth:.13,
};
measure('eventRates.prepare.8x40x321',20,()=>science.eventRates(rateInput).values[100][0]);
const rates=science.eventRates(rateInput);
const projection=[Array(8).fill(0),Array(8).fill(0),Array(8).fill(0)];projection[0][0]=projection[1][1]=projection[2][2]=1;
const sampled=createSampledState({...rates,projection});
measure('eventRates.prepared.sampleAtKnot',2000,i=>sampled.at(rateInput.times[i%321]).values[0]);
function convolve(time){
  const scale=1/(rateInput.bandwidth*Math.sqrt(2*Math.PI));
  return rateInput.events.map(events=>events.reduce((sum,event)=>sum+Math.exp(-.5*((time-event)/rateInput.bandwidth)**2)*scale,0));
}
for(let i=0;i<321;i++)if(Math.abs(convolve(rates.times[i])[0]-sampled.at(rates.times[i]).values[0])>1e-12)throw new Error('Rate comparison differs');
measure('eventRates.recompute.sampleAtKnot',2000,i=>convolve(rateInput.times[i%321])[0]);

console.log(JSON.stringify({
  schemaVersion:1,
  scope:'Local host CPU only. Warm median of five rounds; no GPU or model latency claim. Prepared rate comparison uses exact sample knots, not interpolated off-knot values.',
  runtime:process.version,platform:process.platform,results,checksum:sink,
},null,2));
