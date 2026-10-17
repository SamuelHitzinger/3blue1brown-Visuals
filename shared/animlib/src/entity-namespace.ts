import type {CompiledScene,ElementState,Geometry,ReactiveUpdate} from './types.js';

export function validateEntityNamespace(value:unknown):asserts value is string {
  if(typeof value!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(value))throw new Error('Invalid entity namespace: use 1–32 letters, digits, underscores or hyphens, starting with a letter');
}

/** Remap typed entity references only. Source, text, TeX names, assets, controls
 * and sandbox-local callback state are never rewritten. */
export function namespaceScene(scene:CompiledScene,namespace:string):{scene:CompiledScene;updates:(values:ReactiveUpdate[])=>ReactiveUpdate[]} {
  validateEntityNamespace(namespace);
  const mapping=new Map<string,string>();
  for(const element of [...scene.initial,...scene.lifecycle.flatMap(event=>event.elements??[])]){
    const qualified=`${namespace}/${element.id}`;
    if(!/^[A-Za-z0-9][A-Za-z0-9_./-]*$/.test(element.id)||qualified.length>128)throw new Error('Namespaced entity IDs must use stable ID characters and fit 128 characters');
    mapping.set(element.id,qualified);
  }
  const id=(local:string):string=>{
    const qualified=mapping.get(local);
    if(qualified===undefined)throw new Error(`Unknown entity reference in namespace: ${local}`);
    return qualified;
  };
  const geometry=(value:Geometry):void=>{if(value.children)value.children=value.children.map(id);};
  const element=(value:ElementState):void=>{
    value.id=id(value.id);geometry(value.geometry);
    if(value.morph){geometry(value.morph.from);geometry(value.morph.to);}
  };
  const result=structuredClone(scene);
  for(const value of result.initial)element(value);
  for(const event of result.lifecycle){event.ids=event.ids.map(id);for(const value of event.elements??[])element(value);}
  for(const track of result.tracks){
    track.action.ids=track.action.ids.map(id);
    track.from=Object.fromEntries(Object.entries(track.from).map(([key,value])=>{element(value);return [id(key),value];}));
    if(track.action.geometry)geometry(track.action.geometry);
  }
  for(const binding of result.bindings??[]){
    binding.target=id(binding.target);
    if(binding.type==='attach')binding.source=id(binding.source);
    else {binding.from=id(binding.from);binding.to=id(binding.to);}
  }
  for(const behavior of result.behaviors??[]){
    // Custom behavior options are opaque and may embed entity IDs.
    if(behavior.behavior.type==='custom')throw new Error('Entity namespaces do not support custom behavior references');
    behavior.target=id(behavior.target);
  }
  for(const binding of result.reactiveBindings??[])binding.target=id(binding.target);
  return {scene:result,updates:values=>values.map(value=>({...structuredClone(value),target:id(value.target)}))};
}
