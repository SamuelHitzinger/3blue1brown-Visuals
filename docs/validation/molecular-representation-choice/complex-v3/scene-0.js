const __narration=(()=>{const data=JSON.parse("{\"audioAssetId\":\"subtitle-clock-beat-1\",\"endMode\":\"advance\",\"durationSec\":26.8,\"words\":{\"beat-1.u1.w1\":[0.4,0.8],\"beat-1.u1.w2\":[0.8,1.2000000000000002],\"beat-1.u1.w3\":[1.2000000000000002,1.6],\"beat-1.u1.w4\":[1.6,2],\"beat-1.u1.w5\":[2,2.52],\"beat-1.u1.w6\":[2.52,3.04],\"beat-1.u1.w7\":[3.04,3.56],\"beat-1.u1.w8\":[3.56,4.08],\"beat-1.u1.w9\":[4.08,4.6],\"beat-1.u1.w10\":[4.6,5.011111111111111],\"beat-1.u1.w11\":[5.011111111111111,5.422222222222222],\"beat-1.u1.w12\":[5.422222222222222,5.833333333333333],\"beat-1.u1.w13\":[5.833333333333333,6.2444444444444445],\"beat-1.u1.w14\":[6.2444444444444445,6.655555555555555],\"beat-1.u1.w15\":[6.655555555555555,7.066666666666666],\"beat-1.u1.w16\":[7.066666666666666,7.477777777777778],\"beat-1.u1.w17\":[7.477777777777778,7.888888888888889],\"beat-1.u1.w18\":[7.888888888888889,8.3],\"beat-1.u1.w19\":[8.3,8.711111111111112],\"beat-1.u1.w20\":[8.711111111111112,9.122222222222222],\"beat-1.u1.w21\":[9.122222222222222,9.533333333333333],\"beat-1.u1.w22\":[9.533333333333333,9.933333333333334],\"beat-1.u1.w23\":[9.933333333333334,10.333333333333334],\"beat-1.u1.w24\":[10.333333333333334,10.733333333333334],\"beat-1.u1.w25\":[10.733333333333334,11.133333333333333],\"beat-1.u1.w26\":[11.133333333333333,11.533333333333333],\"beat-1.u1.w27\":[11.533333333333333,11.933333333333334],\"beat-1.u1.w28\":[11.933333333333334,12.333333333333332],\"beat-1.u1.w29\":[12.333333333333332,12.733333333333334],\"beat-1.u1.w30\":[12.733333333333334,13.133333333333333],\"beat-1.u2.w1\":[13.133333333333333,13.533333333333333],\"beat-1.u2.w2\":[13.533333333333333,13.933333333333334],\"beat-1.u2.w3\":[13.933333333333334,14.333333333333332],\"beat-1.u2.w4\":[14.333333333333332,14.733333333333333],\"beat-1.u2.w5\":[14.733333333333333,15.133333333333333],\"beat-1.u2.w6\":[15.133333333333333,15.542857142857143],\"beat-1.u2.w7\":[15.542857142857143,15.952380952380953],\"beat-1.u2.w8\":[15.952380952380953,16.36190476190476],\"beat-1.u2.w9\":[16.36190476190476,16.771428571428572],\"beat-1.u2.w10\":[16.771428571428572,17.18095238095238],\"beat-1.u2.w11\":[17.18095238095238,17.59047619047619],\"beat-1.u2.w12\":[17.59047619047619,18],\"beat-1.u2.w13\":[18,18.43076923076923],\"beat-1.u2.w14\":[18.43076923076923,18.861538461538462],\"beat-1.u2.w15\":[18.861538461538462,19.29230769230769],\"beat-1.u2.w16\":[19.29230769230769,19.723076923076924],\"beat-1.u2.w17\":[19.723076923076924,20.153846153846153],\"beat-1.u2.w18\":[20.153846153846153,20.584615384615383],\"beat-1.u2.w19\":[20.584615384615383,21.015384615384615],\"beat-1.u2.w20\":[21.015384615384615,21.446153846153845],\"beat-1.u2.w21\":[21.446153846153845,21.876923076923077],\"beat-1.u2.w22\":[21.876923076923077,22.307692307692307],\"beat-1.u2.w23\":[22.307692307692307,22.738461538461536],\"beat-1.u2.w24\":[22.738461538461536,23.16923076923077],\"beat-1.u2.w25\":[23.16923076923077,23.6],\"beat-1.u2.w26\":[23.6,24],\"beat-1.u2.w27\":[24,24.400000000000002],\"beat-1.u2.w28\":[24.400000000000002,24.8],\"beat-1.u2.w29\":[24.8,25.200000000000003],\"beat-1.u2.w30\":[25.200000000000003,25.6],\"beat-1.u2.w31\":[25.6,26]}}");const get=(id,index)=>{if(!Object.hasOwn(data.words,id))throw new Error('Unknown narration word ID: '+id);return data.words[id][index];};return Object.freeze({audioAssetId:data.audioAssetId,endMode:data.endMode,durationSec:data.durationSec,start:id=>get(id,0),end:id=>get(id,1)});})();
export default scene({mode:'2d',background:Color.BLACK,orbit:false,audio:__narration.audioAssetId,end:__narration.endMode},s=>{
  // Zuo & Steitz (2015), Molecular Cell 58:534–540, doi:10.1016/j.molcel.2015.03.010.
  // CC0 4YLN: https://files.rcsb.org/download/4YLN.pdb. One deposited complex,
  // 5.50 A; no symmetry expansion. Three DISJOINT selections of the same asset
  // preserve one unscaled angstrom frame. No atoms or molecules are displaced.
  // Protein CA traces are not surfaces; all importer gaps are preserved.
  const asset='model-b395b900e5008e039b988a865814311a9d55cc5ff1bf0675b01621265236e450';
  const start=id=>__narration.start(id),end=id=>__narration.end(id);
  let t=0;
  const until=x=>{if(x>t){s.wait(x-t);t=x;}};
  const play=(a,d)=>{s.play(a,{duration:d,ease:'smooth'});t+=d;};
  let protein,dna,rna,proteinParts=[],dnaLabels=[],dnaLeaders=[],anchors=[];
  s.view('complex-view',{rect:[.06,.26,.88,.58],orbit:true,orbitHitTest:'geometry',camera:{yaw:-.25,pitch:.12,height:184.21,distance:394.74,perspective:1,target:[0,-3.947,0]}},v=>{
    const subset=(id,indices)=>{
      const m=v.model(id,{asset,tint:Color.WHITE});
      for(let i=0;i<12;i++) if(!indices.includes(i)) s.play(m.part('node-'+i).animate({opacity:0}),{duration:0});
      return m;
    };
    protein=subset('protein-machinery',[0,1,2,3,4,5]);
    dna=subset('dna',[6,7,8,9]);
    rna=subset('rna',[10,11]);
    proteinParts=Array.from({length:6},(_,i)=>protein.part('node-'+i));
    // Retained source landmarks: chain 1 residue 32 P and chain 2 residue 4 C4'.
    // They identify DNA, not active sites or atomic contacts.
    const specs=[
      {id:'dna-1',point:[23.3285,-10.105,-33.4845],offset:[45,3,0],tip:[28,3,0],text:'DNA 1'},
      {id:'dna-2',point:[-4.7795,30.142,14.0785],offset:[-110,-12,0],tip:[-93,-12,0],text:'DNA 2'}
    ];
    for(const a of specs){
      const anchor=v.circle(a.id+'-anchor',{radius:.001,position:a.point,fill:Color.NONE,stroke:Color.NONE});
      const tip=v.circle(a.id+'-label-end',{radius:.001,position:a.point.map((x,i)=>x+a.tip[i]),fill:Color.NONE,stroke:Color.NONE});
      const label=v.text(a.id+'-label',{text:a.text,fontSize:10,fill:Color.TEAL,billboard:true,labelOcclusion:'overlay'});
      v.attach(label,anchor,{offset:a.offset});
      const leader=v.line(a.id+'-leader',{stroke:Color.TEAL,strokeWidth:.42});
      v.connect(leader,tip,anchor,{endpoints:'center'});
      dnaLabels.push(label);dnaLeaders.push(leader);anchors.push(anchor,tip);
    }
  });
  const title=s.text('assembly-title',{text:'E. coli RNA polymerase',space:'screen',position:[0,238],fontSize:26,fill:Color.WHITE});
  const tag=s.text('assembly-tag',{text:'One deposited initiation complex',space:'screen',position:[0,201],fontSize:18,fill:Color.GREY_B});
  play([protein.fadeIn(),dna.fadeIn(),rna.fadeIn(),title.fadeIn(),tag.fadeIn()],.4);
  until(start('beat-1.u1.w11'));
  play([title.fadeOut(),tag.fadeOut()],.3);s.remove(title);s.remove(tag);
  const traces=s.text('trace-note',{text:'Protein chains',space:'screen',position:[0,238],fontSize:26,fill:Color.GREY_A});
  play(traces.fadeIn(),.4);
  until(start('beat-1.u1.w25'));
  const traceScope=s.text('trace-scope',{text:'Chain paths, not a solid surface',space:'screen',position:[0,201],fontSize:19,fill:Color.GREY_B});
  play(traceScope.fadeIn(),.35);
  until(start('beat-1.u2.w1'));
  play([traces.fadeOut(),traceScope.fadeOut()],.35);s.remove(traces);s.remove(traceScope);
  until(start('beat-1.u2.w4'));
  play([...dnaLabels.map(h=>h.fadeIn()),...dnaLeaders.map(h=>h.fadeIn())],.6);
  const dnaNote=s.text('dna-note',{text:'Two DNA strands',space:'screen',position:[0,238],fontSize:26,fill:Color.TEAL});
  until(start('beat-1.u2.w6'));play(dnaNote.fadeIn(),.4);
  // Uncover the existing routes before the observation word 'separate'.
  until(start('beat-1.u2.w13'));
  play(proteinParts.map((h,i)=>h.animate({opacity:[.5,.5,.13,.13,.5,.2][i]})),start('beat-1.u2.w17')-t);
  until(end('beat-1.u2.w17'));
  const fixed=s.text('fixed-coordinates',{text:'Visibility changes; coordinates stay fixed',space:'screen',position:[0,201],fontSize:18,fill:Color.GREY_B});
  play(fixed.fadeIn(),.35);
  until(start('beat-1.u2.w24'));
  play(dnaNote.fadeOut(),.2);s.remove(dnaNote);
  const bubble=s.text('bubble-name',{text:'Transcription bubble',space:'screen',position:[0,238],fontSize:26,fill:Color.TEAL});
  play(bubble.fadeIn(),.3);
  // RNA stays present and unaccented. No pairing or template answer before beat 2.
  for(const h of [protein,dna,rna,...dnaLabels,...dnaLeaders,...anchors,bubble,fixed]) s.keep(h);
  until(__narration.durationSec);
});