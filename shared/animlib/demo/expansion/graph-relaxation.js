export default scene({background:'BLACK',end:'hold'},s=>{
  const data={directed:true,nodes:[{id:'A',position:[-3,-.7]},{id:'B',position:[0,-1.6]},{id:'C',position:[2.7,1]},{id:'D',position:[-2,2]}],edges:[{id:'AC',from:'A',to:'C',weight:5},{id:'AB',from:'A',to:'B',weight:1},{id:'BC',from:'B',to:'C',weight:1},{id:'CD',from:'C',to:'D',weight:2},{id:'DA',from:'D',to:'A',weight:1}]};
  const trace=s.dijkstra(data,'A');
  const improve=trace.events.find(e=>e.type==='relax'&&e.node==='C'&&e.predecessor==='B'&&e.accepted);
  const g=s.graph('search',data,{radius:.34,nodeStyle:{fill:'PURPLE_D',stroke:'PURPLE_A',strokeWidth:.025},edgeStyle:{stroke:'GREY_B',strokeWidth:.035},fontSize:.3,weightOffset:[0,.28],costOffset:[0,-.65]});
  const record=s.latex('frontier-C',{tex:'\\mathsf{C}\\quad\\animnum{cost}',numbers:{cost:5},numberFormat:{decimals:0,digits:1},fontSize:.43,position:[3.3,-2.7],opacity:0});
  const route=s.text('route-C',{text:'A → B → C',fontSize:.3,position:[3.3,-3.2],opacity:0});
  s.play(g.state('A','source',{fill:'ORANGE'}),{duration:.1});s.wait(.9);
  s.play([g.edges.get('AC').animate({stroke:'YELLOW'}),g.costs.get('C').countTo({cost:5}),g.costs.get('C').fadeIn(),record.fadeIn()],{duration:1});
  s.play([g.edges.get('AC').animate({stroke:'GREY_B'}),g.edges.get('AB').animate({stroke:'YELLOW'}),g.state('B','active',{fill:'YELLOW'})],{duration:1});
  s.play([g.edges.get(improve.edge).animate({stroke:'YELLOW'}),g.costs.get(improve.node).countTo({cost:improve.cost}),record.countTo({cost:improve.cost}),route.fadeIn(),g.state('C','frontier',{fill:'GREEN'})],{duration:1.2});
  s.wait(2.8);
});
