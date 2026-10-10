import type {SceneContext,Vec2} from '../types.js';
import type {CollectionDiagram,CollectionItem,CollectionOptions,SwapOptions} from './collection-types.js';
/** Ordinary groups and absolute-time position bindings; identity is never a slot. */
export function createCollectionBuilders(s:SceneContext) {
  return {collection(id:string,input:readonly CollectionItem[],options:CollectionOptions={}):CollectionDiagram {
    if(!Array.isArray(input)||input.length>256)throw new Error('Collection budget is 256 items');
    const width=options.width??1,height=options.height??1,gap=options.gap??.2,origin=[...(options.origin??[0,0])];
    if(![width,height,gap,...origin].every(Number.isFinite)||width<=0||height<=0||gap<0||origin.length!==2)throw new Error('Invalid collection dimensions');
    const slots=new Map<string,number>(),items=new Map();
    const data=Object.freeze(input.map((item,i)=>{if(typeof item.id!=='string'||!item.id||item.id.length>100||slots.has(item.id))throw new Error('Invalid or duplicate item ID');if(typeof item.value!=='string'&&!(typeof item.value==='number'&&Number.isFinite(item.value)))throw new Error('Invalid collection value');slots.set(item.id,i);return Object.freeze({...item});}));
    type Move={start:number;end:number;from:number;to:number;height:number};
    const moves=new Map<string,Move[]>();
    const position=(slot:number):Vec2=>[origin[0]+slot*(width+gap),origin[1]];
    for(const [index,item] of data.entries()) {
      const cell=s.rectangle(`${id}/cell/${item.id}`,{width,height,fill:'none',stroke:'WHITE',...options.style});
      const label=s.text(`${id}/label/${item.id}`,{text:String(item.value),fontSize:options.fontSize??.3});
      const group=s.group(`${id}/item/${item.id}`,[cell,label]);items.set(item.id,group);const path:Move[]=[];moves.set(item.id,path);
      s.bind(group,[s.time],time=>{
        let slot=index;
        for(const m of path){if(time<m.start)break;if(time>=m.end){slot=m.to;continue;}
          const t=(time-m.start)/(m.end-m.start),a=position(m.from),b=position(m.to);
          return {position:[a[0]+(b[0]-a[0])*t,a[1]+4*m.height*t*(1-t)]};
        }
        return {position:position(slot)};
      });
    }
    return {items,slots,data,swap(a:string,b:string,{start,duration,clearance=.2}:SwapOptions){
      if(a===b||!slots.has(a)||!slots.has(b))throw new Error('Swap requires two distinct existing item IDs');
      if(![start,duration,clearance].every(Number.isFinite)||start<0||duration<=0||clearance<0||start+duration>86400)throw new Error('Invalid swap timing or clearance');
      const pa=moves.get(a)!,pb=moves.get(b)!;
      if([pa,pb].some(p=>p.length&&p[p.length-1].end>start))throw new Error('Swap schedules overlap or are out of order');
      const from=slots.get(a)!,to=slots.get(b)!,lift=(height+clearance)/2;
      pa.push({start,end:start+duration,from,to,height:lift});pb.push({start,end:start+duration,from:to,to:from,height:-lift});slots.set(a,to);slots.set(b,from);
    }};
  }};
}
