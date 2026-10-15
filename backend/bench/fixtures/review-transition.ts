/** Reduced from measured binary trial2 scene1 (source 35c1923d85525c3c...).
 * Preserve its operation windows, competing samples and three risky transitions;
 * remove narration text and the previous scene's unrelated array geometry.
 */
export const transitionCues = {
  'operation-1': { startSec: 4.911, endSec: 6.107 },
  'operation-2': { startSec: 12.399, endSec: 13.329 },
};
// Captured before semantic prioritization; the compact fixture reproduced the
// measured source's complete first-review timestamp and native-frame plans.
export const transitionOriginalPlan = {
  sourceSha256: '35c1923d85525c3cd88c99ab3da5b65e8353f2a3900849f78d3238bdb2687b0a',
  evidence: 'live/trial2/binary/candidate/eaf8c3f7-0c91-4fc8-bd97-5f248c217f76/scene-1.visual/0/review.json',
  times: [0,.5,2.4555,4.911,6.107,8.812,10.275,11.598500000000001,13.329,14.925,
    15.847999999999999,16.887,19.4355,21.3685,23.969687500000003,26.14875],
  nativeTimes: [8.812,26.14875],
};
const windows = [[4.911,6.107],[8.591,9.033],[9.416,11.134],[11.297,11.9],
  [12.399,13.329],[13.479,14.246],[14.71,15.14],[15.43,16.266],
  [16.719,17.055],[17.229,18.193],[18.832,20.039],[20.631,22.106]];
const timing = { durationSec: 26.14875, cues: Object.fromEntries(windows.map(([startSec,endSec],i) => [`w${i}`,{startSec,endSec}])) };
export const transitionSource = `export default scene({mode:'2d'},s=>{
  const marker=s.rectangle('marker',{space:'screen',width:68,height:68,position:[114,20],stroke:'YELLOW'});
  const comparison=s.latex('compare',{space:'screen',tex:'23 < 31',fontSize:32,position:[0,-106],fill:'YELLOW'});
  const excluded=s.line('excluded',{space:'screen',points:[[80,-65],[300,-65]],stroke:'YELLOW'});
  const found=s.text('found',{space:'screen',text:'Found',fontSize:26,position:[38,100]});
  function interval(id,tex,width,x,y){return s.compose(id,{
    bar:{kind:'rectangle',props:{space:'screen',width,height:16,position:[x,y],fill:'TEAL'}},
    label:{kind:'latex',props:{space:'screen',tex,fontSize:24,position:[-178,y],fill:'TEAL'}}
  });}
  const n=interval('length-n','N',160,-50,-94), half=interval('length-half','N/2',160,-50,-94);
  const quarter=interval('length-quarter','N/4',80,-90,-130), doubled=interval('length-double','2N',160,-50,-94);
  const extra=s.text('extra',{space:'screen',text:'+1 comparison',fontSize:24,position:[180,-134]});
  s.schedule(${JSON.stringify(timing)},[
    {id:'lower-middle',cue:'w0',reveal:[marker]},
    {id:'smaller',cue:'w1',reveal:[comparison]},
    {id:'ordered-range',cue:'w2',actions:comparison.morphTo({kind:'latex',tex:'23 < 31 < 42 < 56',fontSize:32},{map:{}}),reveal:[excluded]},
    {id:'rule-out',cue:'w3',actions:[marker.fadeOut(),excluded.fadeOut(),comparison.fadeOut()]},
    {id:'remaining',cue:'w4',actions:[marker.moveTo([38,20]),marker.fadeIn()]},
    {id:'equals',cue:'w5',actions:[comparison.morphTo({kind:'latex',tex:'23 = 23',fontSize:32},{map:{}}),comparison.fadeIn()]},
    {id:'found-result',cue:'w6',actions:marker.animate({stroke:'TEAL'}),reveal:[found]},
    {id:'generalize',cue:'w7',actions:comparison.fadeOut(),reveal:[n.group]},
    {id:'halve',cue:'w8',reveal:[half.group],actions:[half.get('bar').morphTo({kind:'rectangle',width:80,height:16}),half.get('bar').moveTo([-90,-130])]},
    {id:'halve-again',cue:'w9',reveal:[quarter.group],actions:[quarter.get('bar').morphTo({kind:'rectangle',width:40,height:16}),quarter.get('bar').moveTo([-110,-166])]},
    {id:'double-list',cue:'w10',reveal:[doubled.group],actions:[doubled.get('bar').morphTo({kind:'rectangle',width:320,height:16}),doubled.get('bar').moveTo([30,-58])]},
    {id:'one-extra',cue:'w11',reveal:[extra]}
  ]);
});`;
