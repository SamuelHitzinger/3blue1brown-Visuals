export default scene({background:'BLACK',end:'hold'},s=>{
  const data={directed:true,nodes:[{id:'A',position:[.8,.2]},{id:'B',position:[1.6,-1.7]},{id:'C',position:[3.8,.2]},{id:'D',position:[2.4,2.3]}],edges:[{id:'AB',from:'A',to:'B',weight:1},{id:'AC',from:'A',to:'C',weight:7},{id:'AD',from:'A',to:'D',weight:5},{id:'BC',from:'B',to:'C',weight:2},{id:'CD',from:'C',to:'D',weight:1},{id:'DB',from:'D',to:'B',weight:1}]};
  const trace=s.dijkstra(data,'A'),toC=trace.events.find(e=>e.type==='relax'&&e.node==='C'&&e.predecessor==='B'&&e.accepted),toD=trace.events.find(e=>e.type==='relax'&&e.node==='D'&&e.predecessor==='C'&&e.accepted);
  const g=s.graph('search',data,{radius:.3,nodeStyle:{fill:'PURPLE_E',stroke:'PURPLE_A',strokeWidth:.025},edgeStyle:{stroke:'GREY_B',strokeWidth:.025},fontSize:.28,weightOffset:[0,.24],costOffset:[0,.6],costFormat:{digits:1,decimals:0}});
  for(const n of data.nodes){s.play(g.labels.get(n.id).fadeOut(),{duration:0});const h=s.latex('sans/'+n.id,{tex:'\\mathsf{'+n.id+'}',fontSize:.3});s.attach(h,g.nodes.get(n.id));}
  for(const e of data.edges){s.play(g.weights.get(e.id).fadeOut(),{duration:0});const h=s.latex('weight/'+e.id,{tex:'\\mathsf{'+e.weight+'}',fontSize:.25});s.attach(h,g.edges.get(e.id),{anchor:'midpoint',offset:e.id==='AC'?[0,.25]:e.id==='DB'?[.35,.7]:[0,.25]});}
  const record=(id,route,cost,destination)=>{
    const box=s.rectangle(id+'/box',{width:1.05,height:1.4,fill:'PURPLE_E',stroke:'PURPLE_A',strokeWidth:.018});
    const label=s.latex(id+'/route',{tex:'\\mathsf{'+route+'}',fontSize:.13,position:[0,.49]});
    const costLabel=s.latex(id+'/cost',{tex:'\\mathsf{'+cost+'}',fontSize:.23,position:[0,.14]});
    const dest=s.latex(id+'/destination',{tex:'\\mathsf{'+destination+'}',fontSize:.34,position:[0,-.36]});
    const lines=[.32,-.02].map((y,i)=>s.line(id+'/line/'+i,{points:[[-.525,y],[.525,y]],stroke:'PURPLE_A',strokeWidth:.012}));
    return {id,value:cost,handle:s.group(id+'/record',[box,label,costLabel,dest,...lines])};
  };
  const records=[record('B1','A\\to B',1,'B'),record('D5','A\\to D',5,'D'),record('C7','A\\to C',7,'C'),record('C3','A\\to B\\to C',toC.cost,'C'),record('D4','A\\to B\\to C\\to D',toD.cost,'D')];
  const q=s.compactQueue('queue',records,{initialOrder:['B1','D5','C7'],origin:[-3.65,2.05],width:1.05,height:1.4,gap:.16});
  q.remove('B1',{start:.8,duration:.65});q.insert('C3',0,{start:2.7,duration:.65});
  q.remove('C3',{start:4,duration:.65});q.insert('D4',0,{start:5.8,duration:.65});q.remove('D4',{start:7.1,duration:.65});
  s.latex('heading',{tex:'\\mathsf{frontier}',fontSize:.32,position:[-3.65,3.05]});
  const sumC=s.latex('sum-C',{tex:'\\mathsf{1+2=3<7}',fontSize:.32,position:[2.4,-2.75],fill:'YELLOW',opacity:0});
  const sumD=s.latex('sum-D',{tex:'\\mathsf{3+1=4<5}',fontSize:.32,position:[2.4,-2.75],fill:'YELLOW',opacity:0});
  s.play([g.state('A','source',{stroke:'ORANGE',strokeWidth:.06}),g.state('D','goal',{stroke:'GREEN',strokeWidth:.06}),g.costs.get('C').countTo({cost:7}),g.costs.get('D').countTo({cost:5}),g.costs.get('C').fadeIn(),g.costs.get('D').fadeIn()],{duration:0});
  s.wait(.8);s.play([g.state('B','active',{stroke:'YELLOW',strokeWidth:.06}),g.edges.get('AB').animate({stroke:'YELLOW',strokeWidth:.05})],{duration:.65});
  s.wait(.45);s.play([g.edges.get('BC').animate({stroke:'YELLOW',strokeWidth:.05}),sumC.fadeIn()],{duration:.55});s.wait(.25);
  s.play(g.costs.get('C').countTo({cost:toC.cost}),{duration:.65});s.wait(.65);
  s.play([sumC.fadeOut(),g.state('B','settled',{stroke:'PURPLE_A'}),g.state('C','active',{stroke:'YELLOW',strokeWidth:.06})],{duration:.65});
  s.wait(.35);s.play([g.edges.get('CD').animate({stroke:'YELLOW',strokeWidth:.05}),sumD.fadeIn()],{duration:.55});s.wait(.25);
  s.play(g.costs.get('D').countTo({cost:toD.cost}),{duration:.65});s.wait(.65);
  s.play([sumD.fadeOut(),g.state('C','settled',{stroke:'PURPLE_A'}),g.state('D','settled',{stroke:'GREEN',strokeWidth:.06}),records[1].handle.animate({opacity:.4}),records[2].handle.animate({opacity:.4})],{duration:.65});s.wait(1.25);
});
