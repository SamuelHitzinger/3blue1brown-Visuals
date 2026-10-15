export default scene({audio:__narration.audioAssetId,end:__narration.endMode},s=>{
const range=s.path('derivative-local-change/range',{"points":[[-2,2],[-1,0.5],[0,0],[1,0.5],[2,2]],"stroke":"BLUE","fill":"none"});
const probe=s.circle('derivative-local-change/probe',{"radius":0.15,"position":[0,0],"fill":"YELLOW"});
const label=s.text('derivative-local-change/label',{"text":"Local change","position":[0,2.8],"fontSize":0.3});
const group=s.group('derivative-local-change',[range,probe,label]);
let cursor=0;const play=(start,end,actions)=>{s.wait(start-cursor);s.play(actions,{duration:end-start});cursor=end;};
play(__narration.start('beat-1.u1.w1'),__narration.end('beat-1.u1.w4'),group.fadeIn());
play(__narration.start('beat-1.u2.w1'),__narration.end('beat-1.u2.w4'),probe.moveTo([1,.5]));
play(__narration.start('beat-1.u3.w1'),__narration.end('beat-1.u3.w4'),range.animate({stroke:Color.TEAL}));
play(__narration.start('beat-1.u4.w1'),__narration.end('beat-1.u4.w4'),label.fadeOut());
s.wait(__narration.durationSec-cursor);
s.keep(group);
});