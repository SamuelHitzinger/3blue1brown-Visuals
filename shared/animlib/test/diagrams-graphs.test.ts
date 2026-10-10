import {describe,expect,it} from 'vitest';
import {createGraphAlgorithms,createGraphBuilders} from '../src/diagrams/graphs.js';
import {buildScene} from '../src/runtime.js';
import {evaluateScene} from '../src/timeline.js';
const data={directed:true,nodes:[{id:'a',position:[-2,0] as [number,number]},{id:'b',position:[0,1] as [number,number]},{id:'c',position:[2,0] as [number,number]},{id:'d',position:[0,2] as [number,number]},{id:'u',position:[0,-2] as [number,number]}],edges:[{id:'ab',from:'a',to:'b',weight:5},{id:'ac',from:'a',to:'c',weight:1},{id:'cb',from:'c',to:'b',weight:1},{id:'bd',from:'b',to:'d',weight:1},{id:'da',from:'d',to:'a',weight:2}]};
describe('identity graphs and immutable search events',()=>{
  it('handles cycles, cheaper alternatives, stale duplicate candidates and unreachable nodes deterministically',()=>{
    const a=createGraphAlgorithms(), trace=a.dijkstra(data,'a');
    expect(trace.distances).toEqual({a:0,b:2,c:1,d:3,u:Infinity});
    expect(trace.predecessors.b).toEqual({node:'c',edge:'cb'});
    expect(trace.events.filter(e=>e.type==='pop').map(e=>e.node)).toEqual(['a','c','b','d']);
    expect(trace.events.filter(e=>e.type==='stale').map(e=>e.node)).toEqual(['b']);
    expect(trace).toEqual(a.dijkstra(data,'a'));expect(Object.isFrozen(trace.events[0])).toBe(true);
    const graph=a.graph(data);expect(Object.isFrozen(graph.nodes[0].position)).toBe(true);
    expect(trace.events.find(e=>e.type==='relax'&&e.edge==='cb')).toMatchObject({node:'b',cost:2,predecessor:'c',accepted:true,frontier:[{node:'b',cost:2},{node:'b',cost:5}]});
    expect(a.dijkstra({...data,directed:false,edges:data.edges.slice(0,3)},'b').distances.a).toBe(2);
  });
  it('bounds graph data and handles unusual stable IDs without prototype collisions',()=>{
    const a=createGraphAlgorithms();
    const graph={nodes:[{id:'__proto__',position:[0,0] as [number,number]},{id:'constructor',position:[1,0] as [number,number]}],edges:[{id:'edge',from:'__proto__',to:'constructor',weight:0}]};
    expect(a.dijkstra(graph,'__proto__').distances.constructor).toBe(0);
    expect(()=>a.graph({nodes:Array.from({length:257},(_,i)=>({id:String(i),position:[0,0] as [number,number]})),edges:[]})).toThrow(/budget/);
    expect(()=>a.graph({nodes:[{id:'a',position:[0,,] as unknown as [number,number]}],edges:[]})).toThrow(/position/);
  });
  it('rejects negative/nonfinite weights, loops, parallel edges, missing or duplicate IDs',()=>{
    const a=createGraphAlgorithms();
    for(const edge of [{id:'bad',from:'a',to:'b',weight:-1},{id:'bad',from:'a',to:'a',weight:1},{id:'bad',from:'a',to:'missing',weight:1},{id:'bad',from:'a',to:'b',weight:NaN}]) expect(()=>a.graph({...data,edges:[edge]})).toThrow();
    expect(()=>a.graph({...data,edges:[data.edges[0],{...data.edges[0],id:'dup'}]})).toThrow(/parallel/i);
    expect(()=>a.graph({...data,edges:[data.edges[0],{id:'ba',from:'b',to:'a',weight:1}]})).toThrow(/opposite|parallel/i);
    expect(()=>a.graph({...data,nodes:[data.nodes[0],data.nodes[0]]})).toThrow(/ID/);
  });
  it('uses native surface connectors, attached labels and numeric cost slots while keeping semantic handles',()=>{
    const scene=buildScene({},s=>{
      const g=createGraphBuilders(s,createGraphAlgorithms()).graph('g',data);
      expect(g.nodes.get('a')!.id).toBe('g/node/a');
      s.play(g.costs.get('b')!.countTo({cost:2}),{duration:1});
      s.play(g.state('b','settled',{fill:'GREEN'}),{duration:1});
      expect(g.states.get('b')).toBe('settled');
    });
    expect(scene.bindings?.filter(b=>b.type==='connect')).toHaveLength(5);
    expect(scene.bindings?.filter(b=>b.type==='connect').every(b=>b.endpoints==='surface')).toBe(true);
    expect(scene.bindings?.some(b=>b.type==='attach'&&b.target==='g/label/a')).toBe(true);
  });
  it('keeps edge endpoints on moved node surfaces and weight labels at the connected midpoint',()=>{
    const scene=buildScene({},s=>{const g=createGraphBuilders(s,createGraphAlgorithms()).graph('g',data);s.play(g.nodes.get('b')!.moveTo([0,3]),{duration:2,ease:'linear'});});
    for(const t of [0,.5,1,2,.5]){
      const frame=evaluateScene(scene,t),edge=frame.elements.find(e=>e.id==='g/edge/ab')!,weight=frame.elements.find(e=>e.id==='g/weight/ab')!;
      const [a,b]=edge.geometry.points!;const center=[0,1+t];
      expect(Math.hypot(a[0]+2,a[1])).toBeCloseTo(.25);
      expect(Math.hypot(b[0]-center[0],b[1]-center[1])).toBeCloseTo(.25);
      expect(weight.position[0]).toBeCloseTo((a[0]+b[0])/2);
      expect(weight.position[1]).toBeCloseTo((a[1]+b[1])/2+.18);
    }
  });
});
