export default scene({audio:__narration.audioAssetId,end:__narration.endMode},s=>{
const parts=s.compose('derivative-local-change',{range:{kind:'path',props:{"points":[[-2,2],[-1,0.5],[0,0],[1,0.5],[2,2]],"stroke":"BLUE","fill":"none"}},probe:{kind:'circle',props:{"radius":0.15,"position":[0,0],"fill":"YELLOW"}},label:{kind:'text',props:{"text":"Local change","position":[0,2.8],"fontSize":0.3}}});
const range=parts.get('range');const probe=parts.get('probe');const label=parts.get('label');const group=parts.group;
s.schedule(__narration,[{id:'setup',cue:'setup',actions:group.fadeIn()},{id:'move',cue:'move',actions:probe.moveTo([1,.5])},{id:'relationship',cue:'relationship',actions:range.animate({stroke:Color.TEAL})},{id:'conclusion',cue:'conclusion',actions:label.fadeOut()}]);
s.keep(group);
});