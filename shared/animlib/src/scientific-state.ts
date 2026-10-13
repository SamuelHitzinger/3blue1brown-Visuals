import type {ScientificStateBuilders} from './scientific-state-types.js';

/** Pure, self-contained factory installed verbatim in the scene VM. */
export function createScientificStateBuilders(): ScientificStateBuilders {
  const finite=(value:number,label:string)=>{
    if(!Number.isFinite(value)||Math.abs(value)>1e6)throw new Error(`${label} must be finite with magnitude <= 1,000,000`);
    return value;
  };
  const list=<T>(value:readonly T[],min:number,max:number,label:string):readonly T[]=>{
    if(!Array.isArray(value)||value.length<min||value.length>max)throw new Error(`${label} requires ${min}–${max} entries`);
    return value;
  };
  const vector=(value:readonly number[],size:number,label:string)=>Array.from(list(value,size,size,label),n=>finite(n,label));
  const integer=(value:number,min:number,max:number,label:string)=>{
    if(!Number.isInteger(value)||value<min||value>max)throw new Error(`${label} must be an integer in [${min}, ${max}]`);
    return value;
  };
  return {
    modalState(options){
      const input=list(options?.modes,1,32,'Modal state modes');
      const dimension=list(input[0]?.shape,1,64,'Mode shape').length;
      const modes=Array.from(input,mode=>{
        const shape=vector(mode?.shape,dimension,'Mode shape');
        const amplitude=finite(mode.amplitude,'Mode amplitude');
        const angularFrequency=finite(mode.angularFrequency,'Mode angular frequency');
        if(angularFrequency<0)throw new Error('Mode angular frequency must be nonnegative');
        return {shape,amplitude,angularFrequency,phase:finite(mode.phase??0,'Mode phase')};
      });
      const equilibrium=options.equilibrium===undefined?Array(dimension).fill(0) as number[]:vector(options.equilibrium,dimension,'Equilibrium');
      for(let i=0;i<dimension;i++){
        finite(Math.abs(equilibrium[i])+modes.reduce((sum,m)=>sum+Math.abs(m.amplitude*m.shape[i]),0),'Modal position bound');
        finite(modes.reduce((sum,m)=>sum+Math.abs(m.amplitude*m.shape[i]*m.angularFrequency),0),'Modal velocity bound');
      }
      return {at(time){
        finite(time,'Modal time');
        const displacement=Array(dimension).fill(0) as number[],velocity=Array(dimension).fill(0) as number[];
        const contributions=modes.map(mode=>{
          const phase=mode.angularFrequency*time+mode.phase;
          const scale=mode.amplitude*Math.cos(phase),speed=-mode.amplitude*mode.angularFrequency*Math.sin(phase);
          return mode.shape.map((value,i)=>{const amount=value*scale;displacement[i]+=amount;velocity[i]+=value*speed;return amount;});
        });
        return {displacement,position:displacement.map((value,i)=>value+equilibrium[i]),velocity,contributions};
      }};
    },
    conservativeTransport(options){
      const initial=Array.from(list(options?.initial,1,64,'Transport masses'),mass=>{
        finite(mass,'Transport mass');if(mass<0)throw new Error('Transport masses must be nonnegative');return mass;
      });
      finite(initial.reduce((sum,mass)=>sum+mass,0),'Total transport mass');
      const steps=integer(options.steps??1,0,256,'Transport steps');
      if((steps+1)*initial.length>20000)throw new Error('Transport state budget is 20000 component slots');
      const input=list(options.transfers,0,512,'Transport transfers');
      if(steps*(input.length+initial.length)>200000)throw new Error('Transport preparation budget is 200000 operations');
      const ids=new Set<string>(),outgoing=Array(initial.length).fill(0) as number[];
      const transfers=Array.from(input,edge=>{
        if(!edge||typeof edge.id!=='string'||!edge.id.length||edge.id.length>64||ids.has(edge.id))throw new Error('Transport edge IDs must be unique, nonempty strings of at most 64 characters');
        ids.add(edge.id);
        const from=integer(edge.from,0,initial.length-1,'Transfer source'),to=integer(edge.to,0,initial.length-1,'Transfer destination');
        if(from===to)throw new Error('Transport self-transfers are implicit retention; omit them');
        const fraction=finite(edge.fraction,'Transfer fraction');
        if(fraction<0||fraction>1)throw new Error('Transfer fractions must be in [0, 1]');
        outgoing[from]+=fraction;
        if(outgoing[from]>1)throw new Error('Outgoing fractions cannot exceed one for any source');
        return {id:edge.id,from,to,fraction};
      });
      const states=[initial];
      for(let step=0;step<steps;step++){
        const before=states[step],after=before.map((mass,i)=>mass*(1-outgoing[i]));
        for(const edge of transfers)after[edge.to]+=before[edge.from]*edge.fraction;
        states.push(after);
      }
      return {steps,at(step){
        integer(step,0,steps,'Transport sample step');
        const values=[...states[step]];
        const flows=step===steps?[]:transfers.map(edge=>({id:edge.id,from:edge.from,to:edge.to,amount:values[edge.from]*edge.fraction}));
        return {values,flows};
      }};
    },
    complexInterference(options){
      let amplitudeBound=0;
      const waves=Array.from(list(options?.waves,1,64,'Interference waves'),wave=>{
        const amplitude=vector(wave?.amplitude,2,'Complex amplitude');
        amplitudeBound+=Math.hypot(amplitude[0],amplitude[1]);
        if(amplitudeBound>1000)throw new Error('Sum of wave amplitude magnitudes must not exceed 1000');
        return {amplitude,waveVector:vector(wave.waveVector??[0,0,0],3,'Wave vector'),angularFrequency:finite(wave.angularFrequency??0,'Wave angular frequency'),phase:finite(wave.phase??0,'Wave phase')};
      });
      return {at(time,position=[0,0,0]){
        finite(time,'Interference time');const point=vector(position,3,'Interference position');
        const amplitude:[number,number]=[0,0];
        const components=waves.map(wave=>{
          const phase=wave.phase-wave.angularFrequency*time+wave.waveVector.reduce((sum,k,i)=>sum+k*point[i],0);
          const c=Math.cos(phase),s=Math.sin(phase),[real,imaginary]=wave.amplitude;
          const component:[number,number]=[real*c-imaginary*s,real*s+imaginary*c];
          amplitude[0]+=component[0];amplitude[1]+=component[1];return component;
        });
        return {components,amplitude,intensity:amplitude[0]**2+amplitude[1]**2};
      }};
    },
    eventRates(options){
      const channels=list(options?.events,1,64,'Event channels');
      const inputTimes=list(options.times,1,20000,'Rate sample times');
      if(inputTimes.length*channels.length>20000)throw new Error('Event rates require at most 20000 output component slots');
      const bandwidth=finite(options.bandwidth,'Kernel bandwidth');
      if(bandwidth<=0)throw new Error('Kernel bandwidth must be positive');
      let eventCount=0;
      for(const channel of channels){eventCount+=list(channel,0,10000,'Channel events').length;}
      if(eventCount>10000||eventCount*inputTimes.length>1000000)throw new Error('Event rates permit 10000 events and 1000000 kernel evaluations');
      const scale=1/(bandwidth*Math.sqrt(2*Math.PI));
      for(const channel of channels)finite(channel.length*scale,'Peak event rate bound');
      const events=Array.from(channels,channel=>Array.from(channel,event=>finite(event,'Event time')));
      const times=Array.from(inputTimes,time=>finite(time,'Rate sample time'));
      if(times.some((time,i)=>i>0&&time<=times[i-1]))throw new Error('Rate sample times must strictly increase');
      const values=times.map(time=>events.map(channel=>channel.reduce((sum,event)=>{
        const distance=(time-event)/bandwidth;return sum+Math.exp(-.5*distance*distance)*scale;
      },0)));
      return {times,values};
    },
  };
}
