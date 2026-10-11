export default scene({background:'BLACK',end:'hold'},s=>{
  const p=s.plane('world',{xRange:[-8,9],yRange:[-6,6],origin:[.1,-.35],scale:.85,step:1,ticks:false,grid:{stroke:'BLUE_D',strokeWidth:.009,opacity:.28},axes:{stroke:'GREY_B',strokeWidth:.015,opacity:.65}});
  const origin=p.toWorld([0,0]),a=p.toWorld([1,-1]),b=p.toWorld([2,1]),twice=p.toWorld([2,-2]),sum=p.toWorld([4,-1]);
  p.vector('a1',[1,-1],{stroke:'TEAL',strokeWidth:.04});p.vector('a2',[2,1],{stroke:'ORANGE',strokeWidth:.04});
  const first=s.arrow('scaled-a1',{points:[origin,a],stroke:'TEAL',strokeWidth:.055,opacity:0});
  const second=s.arrow('translated-a2',{points:[origin,b],stroke:'ORANGE',strokeWidth:.055,opacity:0});
  const resultant=p.vector('resultant',[4,-1],{stroke:'YELLOW',strokeWidth:.045,opacity:0});
  const resultLabel=p.label('result-label','Av',[4,-1],[.24,.22],{fill:'YELLOW',fontSize:.36,opacity:0});
  const column=(x,y)=>'\\begin{bmatrix}\\animpart{x}{'+x+'}\\\\\\animpart{y}{'+y+'}\\end{bmatrix}';
  const aTex=column('1','-1'),bTex=column('2','1');
  const propsA={tex:aTex,fontSize:.37,position:[.43,-1.93],fill:'TEAL'},propsB={tex:bTex,fontSize:.37,position:[2.48,.56],fill:'ORANGE'};
  s.latex('source-column-a',propsA);s.latex('source-column-b',propsB);
  const ca=s.latex('sum-column-a',{...propsA,opacity:0}),cb=s.latex('sum-column-b',{...propsB,opacity:0});
  s.latex('identity-lhs',{tex:'\\animpart{lhs}{Av}',anchor:'lhs',position:[-4,3.05],fontSize:.4,fill:'YELLOW'});
  s.latex('identity-equals',{tex:'=',position:[-3.38,3.05],fontSize:.4});
  s.latex('coefficient-identity',{tex:'\\animpart{two}{2}a_1',anchor:'two',position:[-2.94,3.05],fontSize:.4,fill:'TEAL'});
  s.latex('identity-plus',{tex:'+',position:[-2.08,3.05],fontSize:.4});
  s.latex('identity-second',{tex:'a_2',position:[-1.52,3.05],fontSize:.4,fill:'ORANGE'});
  const lhs=s.latex('sum-lhs',{tex:'Av=',position:[-3.91,1.75],fontSize:.38,opacity:0});
  const factor=s.latex('sum-factor',{tex:'2',position:[-3.02,1.75],fontSize:.4,fill:'TEAL',opacity:0});
  const plus=s.latex('sum-plus',{tex:'+',position:[-1.49,1.75],fontSize:.4,opacity:0});
  s.wait(.65);
  s.play(first.fadeIn(),{duration:0});
  s.play(first.morphTo({kind:'arrow',points:[origin,twice]}),{duration:1.1,ease:'smooth'});
  s.play(second.fadeIn(),{duration:0});
  s.play(second.morphTo({kind:'arrow',points:[twice,sum]}),{duration:1.1,ease:'smooth'});
  s.play([resultant.fadeIn(),resultLabel.fadeIn()],{duration:.35});
  s.play([ca.fadeIn(),cb.fadeIn(),lhs.fadeIn(),factor.fadeIn(),plus.fadeIn()],{duration:0});
  s.play([ca.moveTo([-2.35,1.75]),cb.moveTo([-.65,1.75])],{duration:1.1,ease:'smooth'});
  s.wait(.5);
  // Copy the assembled columns; both their local and sum sources remain visible.
  const ra=s.latex('row-a',{tex:aTex,fontSize:.37,position:[-2.35,1.75],fill:'TEAL'});
  const rb=s.latex('row-b',{tex:bTex,fontSize:.37,position:[-.65,1.75],fill:'ORANGE'});
  const map={x:'x',y:'y'};
  s.play([
    ra.moveTo([-2.69,.12]),ra.morphTo({kind:'latex',tex:'\\begin{array}{r}2\\cdot\\animpart{x}{1}\\\\2\\cdot(\\animpart{y}{-1})\\end{array}',fontSize:.37},{map}),
    rb.moveTo([-1.27,.12]),rb.morphTo({kind:'latex',tex:'\\begin{array}{l}+\\animpart{x}{2}\\\\+\\animpart{y}{1}\\end{array}',fontSize:.37},{map})
  ],{duration:1.15,ease:'smooth'});
  const bracket=s.path('row-brackets',{points:[[-3.46,.77],[-3.58,.77],[-3.58,-.53],[-3.46,-.53]],stroke:'WHITE',strokeWidth:.018});
  s.path('row-brackets-right',{points:[[-.69,.77],[-.57,.77],[-.57,-.53],[-.69,-.53]],stroke:'WHITE',strokeWidth:.018});
  s.latex('row-equals',{tex:'=',position:[-3.91,.12],fontSize:.38});
  s.wait(.65);
  const result=s.latex('computed-result',{tex:'=\\begin{bmatrix}\\animpart{x}{4}\\\\\\animpart{y}{-1}\\end{bmatrix}',fontSize:.42,position:[-2.52,-1.78],fill:'YELLOW',opacity:0});
  const projected=p.path('result-coordinates',[[4,0],[4,-1],[0,-1]],{stroke:'YELLOW',strokeWidth:.018,opacity:0});
  s.play([result.fadeIn(),projected.fadeIn()],{duration:.45});s.wait(1.45);
});
