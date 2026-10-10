export default scene({}, s => {
  const p = s.circle('probe', { radius: 0.45, fill: 'YELLOW', stroke: 'none' });
  s.bind(p, [s.time], t => ({ position: [-2 + 2*t, 0, 0] }));
  s.keep(p);
  s.wait(2);
});
