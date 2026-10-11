export default scene({background:'BLACK',end:'hold'},s=>{
  const data={directed:true,nodes:[{id:'A',position:[1.2,.2]},{id:'B',position:[2,-1.7]},{id:'C',position:[4,.2]},{id:'D',position:[2.4,2.3]}],edges:[{id:'AB',from:'A',to:'B',weight:1},{id:'AC',from:'A',to:'C',weight:7},{id:'AD',from:'A',to:'D',weight:5},{id:'BC',from:'B',to:'C',weight:2},{id:'CD',from:'C',to:'D',weight:1},{id:'DB',from:'D',to:'B',weight:1}]};
  const trace=s.dijkstra(data,'A'),accepted=trace.events.find(e=>e.type==='relax'&&e.node==='C'&&e.predecessor==='B'&&e.accepted);
  const g=s.graph('search',data,{radius:.3,nodeStyle:{fill:'PURPLE_E',stroke:'PURPLE_A',strokeWidth:.025},edgeStyle:{stroke:'GREY_B',strokeWidth:.025},fontSize:.28,weightOffset:[0,.24],costOffset:[0,-.6]});
  for(const n of data.nodes){s.play(g.labels.get(n.id).fadeOut(),{duration:0});const h=s.latex('sans/'+n.id,{tex:'\\mathsf{'+n.id+'}',fontSize:.3});s.attach(h,g.nodes.get(n.id));}
  for(const e of data.edges){s.play(g.weights.get(e.id).fadeOut(),{duration:0});const h=s.latex('weight/'+e.id,{tex:'\\mathsf{'+e.weight+'}',fontSize:.25});s.attach(h,g.edges.get(e.id),{anchor:'midpoint',offset:e.id==='AC'?[0,.25]:e.id==='DB'?[.35,.7]:[0,.25]});}
  function record(id,route,cost,destination){
    const box=s.rectangle(id+'/box',{width:1.3,height:1.4,fill:'PURPLE_E',stroke:'PURPLE_A',strokeWidth:.018});
    const routeLabel=s.latex(id+'/route',{tex:route,fontSize:.2,position:[0,.53]});
    // Candidate costs belong to immutable records; a cheaper route gets a new record.
    const costLabel=s.latex(id+'/cost',{tex:'\\mathsf{'+cost+'}',fontSize:.24,position:[0,.18]});
    const dest=s.latex(id+'/destination',{tex:'\\mathsf{'+destination+'}',fontSize:.36,position:[0,-.34]});
    const dividers=[.35,.02].map((y,i)=>s.line(id+'/divider-'+i,{points:[[-.65,y],[.65,y]],stroke:'PURPLE_A',strokeWidth:.012}));
    return {id,value:destination,handle:s.group(id+'/record',[box,routeLabel,costLabel,dest,...dividers])};
  }
  const records=[record('direct-C','\\mathsf{A}\\to\\mathsf{C}',7,'C'),record('direct-D','\\mathsf{A}\\to\\mathsf{D}',5,'D'),record('via-B-C','\\mathsf{A}\\to\\mathsf{B}\\to\\mathsf{C}',accepted.cost,'C')];
  // Initial order is D5,C7; dormant candidate has its own identity and slot.
  const frontier=s.collection('frontier',[records[1],records[0],records[2]],{orientation:'vertical',origin:[-3.85,2.15],width:1.3,height:1.4,gap:.26});
  const candidate=frontier.items.get('via-B-C');s.play(candidate.fadeOut(),{duration:0});
  s.latex('frontier-heading',{tex:'\\mathsf{frontier}',fontSize:.32,position:[-3.85,3.2]});
  const arithmetic=s.latex('candidate-arithmetic',{tex:'\\mathsf{1+2=3<7}',fontSize:.32,position:[3.2,-2.75],fill:'YELLOW',opacity:0});
  s.play([g.state('A','source',{stroke:'ORANGE',strokeWidth:.06}),g.state('D','goal',{stroke:'GREEN',strokeWidth:.06}),g.state('B','active',{stroke:'YELLOW',strokeWidth:.06}),g.edges.get('AB').animate({stroke:'YELLOW'}),g.costs.get('C').countTo({cost:7}),g.costs.get('C').fadeIn()],{duration:0});
  s.wait(.8);
  s.play([g.edges.get('BC').animate({stroke:'YELLOW',strokeWidth:.05}),arithmetic.fadeIn()],{duration:.7});s.wait(.55);
  s.play([candidate.fadeIn(),g.costs.get('C').countTo({cost:accepted.cost})],{duration:0});
  s.play(g.state('C','frontier',{stroke:'YELLOW',strokeWidth:.06}),{duration:.35});s.wait(.5);
  // Insertion is stable: the old candidate keeps route7 and its C badge.
  frontier.reorder(['via-B-C','direct-D','direct-C'],{start:2.9,duration:2,clearance:.15});
  s.wait(2);
  s.play(arithmetic.fadeOut(),{duration:.35});
  const stale=s.latex('stale-marker',{tex:'\\mathsf{stale}',fontSize:.24,fill:'GREY_B',position:[-2.4,-1.17],opacity:0});
  s.play([stale.fadeIn(),records[0].handle.animate({opacity:.4})],{duration:.4});s.wait(1.85);
});
