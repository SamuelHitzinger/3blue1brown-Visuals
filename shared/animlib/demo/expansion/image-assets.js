export default scene({mode:'3d',background:'BLACK',end:'hold'},s=>{
 const map=s.image('source-map',{asset:'suzanne-textured-image-0',width:3.3,position:[2.15,0,0],alphaMode:'opaque'});
 const model=s.model('mapped-model',{asset:'suzanne-textured',shading:'unlit',position:[-2.15,0,0],scale:1.35});
 const a=s.latex('model-label',{tex:'\\mathrm{UV\\ mapped\\ surface}',position:[-2.15,2.2,0],fontSize:.3});
 const b=s.latex('map-label',{tex:'\\mathrm{Source\\ color\\ map}',position:[2.15,2.2,0],fontSize:.3});
 const c=s.latex('local-note',{tex:'\\mathrm{One\\ image,\\ unchanged\\ RGB}',position:[2.15,-2.05,0],fontSize:.24,fill:'GREY_B'});
 s.bind(model,[s.time],t=>{const u=Math.max(0,Math.min(1,(t-1)/3.6));return{rotation:[0,1.35*u*u*(3-2*u),0]};});
 s.play(s.camera.animate({height:6.5,yaw:0,pitch:0}),{duration:0});
 s.keep(map,model,a,b,c);s.wait(6);
});
