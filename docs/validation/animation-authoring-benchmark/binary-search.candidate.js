export default scene({audio:__narration.audioAssetId,end:__narration.endMode},s=>{
const parts=s.compose('binary-search-comparison',{range:{kind:'rectangle',props:{"width":5,"height":1,"fill":"none","stroke":"BLUE"}},probe:{kind:'circle',props:{"radius":0.2,"position":[-2,0],"fill":"YELLOW"}},label:{kind:'text',props:{"text":"Choose the middle","position":[0,1],"fontSize":0.3}}});
const range=parts.get('range');const probe=parts.get('probe');const label=parts.get('label');const group=parts.group;
s.schedule(__narration,[{id:'setup',cue:'setup',actions:group.fadeIn()},{id:'move',cue:'move',actions:probe.moveTo([0,0])},{id:'relationship',cue:'relationship',actions:range.scaleTo(.5)},{id:'conclusion',cue:'conclusion',actions:label.fadeOut()}]);
s.keep(group);
});