import type {ModelPrimitive} from './models.js';
export interface PackedModelVertices {
  vertices:Float32Array;
  sumX:number;sumY:number;sumZ:number;
  retentionUnsafe:boolean;
}
/** One exact world-packed sample per active imported-model slot. Camera changes
 * only require new depths. Style/transform changes replace, never accumulate.
 * The byte cap also bounds retention when one active scene is unusually large.
 */
export class ModelPackingCache {
  private slots=new Map<string,{model:ModelPrimitive;key:string;value:PackedModelVertices}>();
  private used=new Set<string>();
  private bytes=0;
  constructor(private readonly maxBytes=128*1024*1024) {}
  beginFrame():void {this.used.clear();}
  endFrame():void {for(const [slot,entry] of this.slots)if(!this.used.has(slot)){this.bytes-=entry.value.vertices.byteLength;this.slots.delete(slot);}}
  clear():void {this.slots.clear();this.used.clear();this.bytes=0;}
  get(slot:string,model:ModelPrimitive,key:string):PackedModelVertices|undefined {
    this.used.add(slot);const entry=this.slots.get(slot);
    if(entry?.model===model && entry.key===key)return entry.value;
    if(entry){this.bytes-=entry.value.vertices.byteLength;this.slots.delete(slot);}
    return undefined;
  }
  set(slot:string,model:ModelPrimitive,key:string,value:PackedModelVertices):void {
    this.used.add(slot);const previous=this.slots.get(slot);
    if(previous){this.bytes-=previous.value.vertices.byteLength;this.slots.delete(slot);}
    if(this.bytes+value.vertices.byteLength>this.maxBytes)return;
    this.slots.set(slot,{model,key,value});this.bytes+=value.vertices.byteLength;
  }
}
