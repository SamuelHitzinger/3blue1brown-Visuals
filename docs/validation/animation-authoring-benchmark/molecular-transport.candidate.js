export default scene({audio:__narration.audioAssetId,end:__narration.endMode},s=>{
const parts=s.compose('molecular-channel-transport',{range:{kind:'rectangle',props:{"width":0.4,"height":3,"fill":"TEAL"}},probe:{kind:'circle',props:{"radius":0.25,"position":[-2,0],"fill":"YELLOW"}},label:{kind:'text',props:{"text":"Transport through the channel","position":[0,2],"fontSize":0.3}}});
const range=parts.get('range');const probe=parts.get('probe');const label=parts.get('label');const group=parts.group;
s.schedule(__narration,[{id:'setup',cue:'setup',actions:group.fadeIn()},{id:'move',cue:'move',actions:probe.moveTo([0,0])},{id:'relationship',cue:'relationship',actions:probe.moveTo([2,0])},{id:'conclusion',cue:'conclusion',actions:label.fadeOut()}]);
s.keep(group);
});