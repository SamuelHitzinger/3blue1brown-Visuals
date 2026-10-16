import {describe,expect,test} from 'bun:test';
import {directVideoFrameReceipt,liveDemoInjection,liveLectureWatch,watchDecision,watchTranscript} from './live-lecture-watch.js';

const audio=(text:string,start:number,durationMs=2000)=>({text,capture:{kind:'audio',capturedAt:new Date(start).toISOString(),durationMs}});
describe('live lecture watch display',()=>{
  test('direct image receipt requires explicit flag and photo, never bypasses audio or describes unseen contents',()=>{
    expect(directVideoFrameReceipt(undefined,'photo','now')).toBeUndefined();
    expect(directVideoFrameReceipt('true','photo','now')).toBeUndefined();
    expect(directVideoFrameReceipt(true,'audio','now')).toBeUndefined();
    expect(directVideoFrameReceipt(true,'photo','now')).toEqual({text:'Lecture video frame received at now.',visualEvidence:'Original captured frame is available as direct image evidence.'});
  });
  test('trims longest normalized overlap across arrived overlapping audio, retaining original records',()=>{
    const sources=[audio('Wir haben eine Kraft.',0),audio('Eine Kraft wirkt nach unten.',1000),audio('wirkt nach unten. Und hier?',2000)];
    const original=JSON.stringify(sources);
    expect(watchTranscript(sources)).toBe('Wir haben eine Kraft.\nwirkt nach unten.\nUnd hier?');
    expect(JSON.stringify(sources)).toBe(original);
  });
  test('keeps genuine repetition outside overlap and ambiguous one-word repetition',()=>{
    expect(watchTranscript([audio('Das ist richtig.',0),audio('Das ist richtig.',2500)])).toBe('Das ist richtig.\nDas ist richtig.');
    expect(watchTranscript([audio('Eine Kraft.',0),audio('Kraft ist wichtig.',1000)])).toBe('Eine Kraft.\nKraft ist wichtig.');
  });
  test('orders arrived audio by capture time and separates photos from transcript',()=>{
    expect(watchTranscript([audio('Kraft wirkt weiter.',1000),{text:'Photo: triangle',capture:{kind:'photo'}},audio('Eine Kraft wirkt.',0)])).toBe('Eine Kraft wirkt.\nweiter.');
  });
  test('decision display bounds prose and never dumps generated source',()=>{
    const output=watchDecision({epochMs:0,status:200,reply:{submission:{action:'add',reason:'x'.repeat(1000)}}});
    expect(output.length).toBeLessThan(270);
    expect(watchDecision({epochMs:0,status:502,reply:{detail:'Invalid source'}})).toContain('Error 502: Invalid source');
  });
  test('generated browser scripts parse and untrusted title cannot close script',()=>{
    const page=liveLectureWatch('id','</script><script>bad()</script>',['clip']);
    expect(page).not.toContain('</script><script>bad()');
    for(const html of [page,liveDemoInjection])for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g))expect(()=>new Function(match[1])).not.toThrow();
  });
});
