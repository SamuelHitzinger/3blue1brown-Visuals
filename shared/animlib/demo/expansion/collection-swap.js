export default scene({background:'BLACK',end:'hold'},s=>{
  const c=s.collection('values',[{id:'a',value:7},{id:'b',value:7}],{origin:[-1.4,0],width:1.2,height:1.2,gap:1.6,fontSize:.55,style:{stroke:'GREY_A',strokeWidth:.025}});
  const a=s.text('id-a',{text:'a',fill:'TEAL',fontSize:.3});s.attach(a,c.items.get('a'),{offset:[0,-.9]});
  const b=s.text('id-b',{text:'b',fill:'ORANGE',fontSize:.3});s.attach(b,c.items.get('b'),{offset:[0,-.9]});
  c.swap('a','b',{start:1,duration:2,clearance:1.2});s.wait(4);
});
