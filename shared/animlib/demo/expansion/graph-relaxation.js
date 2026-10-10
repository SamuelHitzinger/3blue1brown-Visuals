export default scene({background:'BLACK',end:'hold'},s=>{
  const data={directed:true,nodes:[{id:'A',position:[-3,-.7]},{id:'B',position:[0,-1.6]},{id:'C',position:[2.7,1]},{id:'D',position:[-2,2]}],edges:[{id:'AC',from:'A',to:'C',weight:5},{id:'AB',from:'A',to:'B',weight:1},{id:'BC',from:'B',to:'C',weight:1},{id:'CD',from:'C',to:'D',weight:2},{id:'DA',from:'D',to:'A',weight:1}]};
  const trace=s.dijkstra(data,'A');
  const improve=trace.events.find(e=>e.type==='relax'&&e.node==='C'&&e.predecessor==='B'&&e.accepted);
  const g=s.graph('search',data,{radius:.34,nodeStyle:{fill:'PURPLE_E',stroke:'PURPLE_A',strokeWidth:.025},edgeStyle:{stroke:'GREY_B',strokeWidth:.035},fontSize:.3,weightOffset:[0,.28],costOffset:[0,-.65]});
  for(const n of data.nodes){
    s.play(g.labels.get(n.id).fadeOut(),{duration:0});
    const label=s.latex('sans-node-'+n.id,{tex:'\\mathsf{'+n.id+'}',fontSize:.3});s.attach(label,g.nodes.get(n.id));
  }
  for(const e of data.edges){
    s.play(g.weights.get(e.id).fadeOut(),{duration:0});
    const label=s.latex('sans-weight-'+e.id,{tex:'\\mathsf{'+e.weight+'}',fontSize:.3});s.attach(label,g.edges.get(e.id),{anchor:'midpoint',offset:[0,.28]});
  }
  const panel=s.rectangle('frontier-record',{position:[3.8,-2.6],width:3.7,height:1.5,fill:'PURPLE_E',stroke:'PURPLE_A',strokeWidth:.02,opacity:0});
  const heading=s.latex('frontier-heading',{tex:'\\mathsf{frontier}',position:[3.8,-1.61],fontSize:.27,fill:'GREY_A',opacity:0});
  const initialRoute=s.latex('route-initial',{tex:'\\mathsf{A}\\rightarrow\\mathsf{C}',position:[3.2,-2.3],fontSize:.32,opacity:0});
  const route=s.latex('route-C',{tex:'\\mathsf{A}\\rightarrow\\mathsf{B}\\rightarrow\\mathsf{C}',position:[3.2,-2.3],fontSize:.32,opacity:0});
  const destination=s.latex('frontier-destination',{tex:'\\mathsf{C}',position:[5,-2.3],fontSize:.33,opacity:0});
  const badge=s.circle('destination-ring',{position:[5,-2.3],radius:.32,fill:'none',stroke:'PURPLE_A',strokeWidth:.025,opacity:0});
  const record=s.latex('frontier-C',{tex:'\\mathsf{cost}\\quad\\animnum{cost}',numbers:{cost:5},numberFormat:{decimals:0,digits:1},fontSize:.33,position:[3.7,-2.97],opacity:0});
  const candidate=s.latex('candidate-C',{tex:'1+1=2',position:[1.53,.02],fontSize:.36,fill:'YELLOW',opacity:0});
  // Algorithm costs change discretely when a candidate is accepted.
  s.play(g.costs.get('C').countTo({cost:5}),{duration:0});
  s.play(g.state('A','source',{stroke:'ORANGE',strokeWidth:.065}),{duration:.1});s.wait(.9);
  s.play([g.edges.get('AC').animate({stroke:'YELLOW'}),g.costs.get('C').fadeIn(),...[panel,heading,initialRoute,destination,badge,record].map(h=>h.fadeIn())],{duration:1});
  s.play([g.edges.get('AC').animate({stroke:'GREY_B'}),g.edges.get('AB').animate({stroke:'YELLOW'}),g.state('B','active',{stroke:'YELLOW',strokeWidth:.075})],{duration:1});
  s.play([g.edges.get(improve.edge).animate({stroke:'YELLOW'}),candidate.fadeIn()],{duration:.6});s.wait(.6);
  s.play([g.costs.get(improve.node).countTo({cost:improve.cost}),record.countTo({cost:improve.cost}),initialRoute.fadeOut(),route.fadeIn(),g.state('C','frontier',{stroke:'GREEN',strokeWidth:.075})],{duration:0});
  s.play(candidate.fadeOut(),{duration:.3});s.wait(2.5);
});
