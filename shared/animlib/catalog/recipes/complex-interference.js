// Two coherent amplitudes; intensity is unnormalized squared magnitude.
export default scene({end:'hold'},s=>{
  const field=s.complexInterference({waves:[
    {amplitude:[1,0]},
    {amplitude:[1,0],angularFrequency:1},
  ]});
  s.line('real-axis',{points:[[-2.4,0],[2.4,0]],stroke:Color.GREY,strokeWidth:.012});
  s.line('imag-axis',{points:[[0,-2.4],[0,2.4]],stroke:Color.GREY,strokeWidth:.012});
  const first=s.arrow('first',{points:[[0,0],[1,0]],stroke:Color.TEAL,strokeWidth:.035});
  const second=s.arrow('second',{points:[[1,0],[2,0]],stroke:Color.YELLOW,strokeWidth:.035});
  const sum=s.arrow('sum',{points:[[0,0],[2,0]],stroke:Color.WHITE,strokeWidth:.025});
  s.bind(first,[s.time],t=>({points:[[0,0],field.at(t).components[0]]}));
  s.bind(second,[s.time],t=>({points:[field.at(t).components[0],field.at(t).amplitude]}));
  s.bind(sum,[s.time],t=>({points:[[0,0],field.at(t).amplitude]}));
  s.latex('sum-label',{tex:'a_1+a_2',position:[2.4,.4],fontSize:.3});
  // Show the geometric squared magnitude before interpreting detection intensity.
  s.wait(2*Math.PI);
});
