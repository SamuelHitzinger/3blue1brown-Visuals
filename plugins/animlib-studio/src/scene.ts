/** Compact data authoring lowers to the existing sandbox, never browser eval. */
const constructors=new Set(['circle','sphere','rectangle','box','line','arrow','path','text','latex','mesh']);
export function assert(value:unknown,message:string):asserts value{if(!value)throw Error(message);}
export function identifier(value:unknown):asserts value is string{
  assert(typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_./-]{0,100}$/.test(value),'Invalid stable ID');
}
export function plain(value:unknown,depth=0):void{
  assert(depth<=20,'Data nesting limit exceeded');
  if(value===null||typeof value==='string'||typeof value==='boolean')return;
  if(typeof value==='number'){assert(Number.isFinite(value),'Nonfinite number');return;}
  assert(value&&typeof value==='object'&&(Array.isArray(value)||Object.getPrototypeOf(value)===Object.prototype),'Expected JSON data');
  for(const [key,d] of Object.entries(Object.getOwnPropertyDescriptors(value))){
    assert(!['__proto__','constructor','prototype'].includes(key)&&!d.get&&!d.set,'Unsafe data member');
    plain(d.value,depth+1);
  }
}
export type SceneSpec={mode?:'2d'|'3d';objects:{id:string;type:string;props?:Record<string,unknown>}[]};
export function sceneSource(scene:SceneSpec):string{
  plain(scene);assert(scene&&['2d','3d'].includes(scene.mode??'2d'),'Invalid scene mode');
  assert(Array.isArray(scene.objects)&&scene.objects.length>0&&scene.objects.length<=256,'Scene requires 1–256 objects');
  const seen=new Set<string>();
  const lines=scene.objects.map(object=>{
    identifier(object.id);assert(!seen.has(object.id),'Duplicate object ID');seen.add(object.id);
    assert(constructors.has(object.type),'Unsupported primitive');
    assert(object.props===undefined||object.props!==null&&typeof object.props==='object'&&!Array.isArray(object.props),'Invalid object props');
    return `s.${object.type}(${JSON.stringify(object.id)},${JSON.stringify(object.props??{})});`;
  });
  return `export default scene(${JSON.stringify({mode:scene.mode??'2d',end:'hold',orbit:false})},s=>{\n${lines.join('\n')}\ns.wait(3600);\n});`;
}
export function recipeSource(name:string):string{
  if(name==='orbit')return `export default scene({mode:'3d',end:'hold',orbit:false},s=>{
    s.sphere('sun',{radius:.7,fill:'YELLOW'});
    const planet=s.sphere('planet',{radius:.3,position:[2.3,0,0],fill:'BLUE'});
    s.bind(planet,[s.time],t=>({position:[2.3*Math.cos(t),0,2.3*Math.sin(t)]}));
    s.wait(3600);
  });`;
  if(name==='molecule')return sceneSource({mode:'3d',objects:[
    {id:'oxygen',type:'sphere',props:{radius:.55,fill:'RED'}},
    {id:'hydrogen-left',type:'sphere',props:{position:[-1,.8,0],radius:.32,fill:'WHITE'}},
    {id:'hydrogen-right',type:'sphere',props:{position:[1,.8,0],radius:.32,fill:'WHITE'}},
    {id:'bond-left',type:'line',props:{points:[[0,0,0],[-1,.8,0]],stroke:'GREY',strokeWidth:.12}},
    {id:'bond-right',type:'line',props:{points:[[0,0,0],[1,.8,0]],stroke:'GREY',strokeWidth:.12}},
  ]});
  if(name==='wave')return `export default scene({mode:'2d',end:'hold'},s=>{
    s.line('axis',{points:[[-5,0,0],[5,0,0]],stroke:'GREY',strokeWidth:.02});
    const points=Array.from({length:81},(_,i)=>[-4+i/10,Math.sin(-4+i/10),0]);
    const wave=s.path('wave',{points,stroke:'TEAL',strokeWidth:.06,fill:'none'});
    s.bind(wave,[s.time],t=>({points:points.map(p=>[p[0],Math.sin(p[0]-t),0])}));
    s.wait(3600);
  });`;
  throw Error('Unknown recipe. Available: orbit, molecule, wave');
}
