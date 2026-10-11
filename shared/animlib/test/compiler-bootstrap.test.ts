import {expect,it,vi} from 'vitest';
import {getQuickJS} from 'quickjs-emscripten';
import {createSceneProgram} from '../src/compiler.js';

it.each([20,200])('starts the %i ms scene budget after trusted runtime initialization',async executionLimitMs=>{
 const QuickJS=await getQuickJS(),newContext=QuickJS.newContext.bind(QuickJS);
 let clock=0;
 vi.spyOn(Date,'now').mockImplementation(()=>clock);
 vi.spyOn(QuickJS,'newContext').mockImplementation(options=>{
  const vm=newContext(options),evalCode=vm.evalCode.bind(vm);
  vi.spyOn(vm,'evalCode').mockImplementation((source,...args)=>{
   const result=evalCode(source,...args);
   // Simulate slow library setup without timing assumptions or sleeping.
   if(args[0]==='runtime.js')clock+=1000;
   return result;
  });
  return vm;
 });
 try {
  const program=await createSceneProgram(`export default scene({},s=>{for(let i=0;i<20000;i++){}s.circle('dot');s.wait(1);});`,{}, {executionLimitMs});
  try {expect(program.scene.duration).toBe(1);expect(program.scene.lifecycle[0].ids).toEqual(['dot']);}
  finally {program.dispose();}
 }finally {vi.restoreAllMocks();}
});
