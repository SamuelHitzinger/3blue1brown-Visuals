export default scene({audio:__narration.audioAssetId,end:__narration.endMode},s=>{
const range=s.rectangle('binary-search-comparison/range',{"width":5,"height":1,"fill":"none","stroke":"BLUE"});
const probe=s.circle('binary-search-comparison/probe',{"radius":0.2,"position":[-2,0],"fill":"YELLOW"});
const label=s.text('binary-search-comparison/label',{"text":"Choose the middle","position":[0,1],"fontSize":0.3});
const group=s.group('binary-search-comparison',[range,probe,label]);
let cursor=0;const play=(start,end,actions)=>{s.wait(start-cursor);s.play(actions,{duration:end-start});cursor=end;};
play(__narration.start('beat-1.u1.w1'),__narration.end('beat-1.u1.w4'),group.fadeIn());
play(__narration.start('beat-1.u2.w1'),__narration.end('beat-1.u2.w4'),probe.moveTo([0,0]));
play(__narration.start('beat-1.u3.w1'),__narration.end('beat-1.u3.w4'),range.scaleTo(.5));
play(__narration.start('beat-1.u4.w1'),__narration.end('beat-1.u4.w4'),label.fadeOut());
s.wait(__narration.durationSec-cursor);
s.keep(group);
});