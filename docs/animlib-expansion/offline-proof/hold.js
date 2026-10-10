export default scene({}, s => {
  s.previous.get('probe');
  s.wait(1);
});
