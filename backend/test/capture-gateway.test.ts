import {expect,test} from 'bun:test';
import {createCaptureGateway} from '../src/capture-gateway.js';

test('phone gateway never forwards owner APIs or private asset/model routes',async()=>{
  const forwarded:string[]=[];
  const app=async(request:Request)=>{forwarded.push(new URL(request.url).pathname);return new Response('app');};
  const capture={handleDevice:async()=>Response.json({connected:true})};
  const gateway=createCaptureGateway(app,capture);
  for(const path of ['/','/api/lectures','/api/lectures/123/capture-pairings','/api/videos','/api/models/a.glb','/api/me','/settings','/static/../package.json','/capture%2f..%2fapi%2flectures'])expect((await gateway(new Request('http://localhost'+path))).status).toBe(404);
  expect(forwarded).toEqual([]);
  expect(await (await gateway(new Request('http://localhost/capture'))).text()).toBe('app');
  expect((await gateway(new Request('http://localhost/static/assets/capture-Ab123456.js'))).status).toBe(200);
  expect((await gateway(new Request('http://localhost/api/capture/status'))).status).toBe(200);
});

test('capture shell disables referrer leakage, embedding and cross-origin capture',async()=>{
  const gateway=createCaptureGateway(async()=>new Response('app'),{handleDevice:async()=>Response.json({})});
  const page=await gateway(new Request('http://localhost/capture'));
  expect(page.headers.get('Referrer-Policy')).toBe('no-referrer');
  expect(page.headers.get('Permissions-Policy')).toContain('camera=(self)');
  expect(page.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
  expect(page.headers.get('Cache-Control')).toBe('private, no-store');
  expect((await gateway(new Request('http://localhost/capture',{method:'POST'}))).status).toBe(405);
});

test('reader compiler permits WebAssembly without enabling JavaScript eval or external workers',async()=>{
  const gateway=createCaptureGateway(async()=>new Response('app'),{handleDevice:async()=>Response.json({})});
  for(const path of ['/live/11111111-1111-1111-1111-111111111111','/static/assets/compiler-worker-Ab123456.js']){
    const response=await gateway(new Request('https://reader.example'+path));
    const policy=response.headers.get('Content-Security-Policy')!;
    expect(policy).toContain("script-src 'self' 'wasm-unsafe-eval'");
    expect(policy).toContain("worker-src 'self'");
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).not.toContain('https:');
  }
  const capture=await gateway(new Request('https://reader.example/capture'));
  expect(capture.headers.get('Content-Security-Policy')).not.toContain('wasm-unsafe-eval');
  const reader=await gateway(new Request('https://reader.example/live/11111111-1111-1111-1111-111111111111'));
  expect(reader.headers.get('Content-Security-Policy')).toContain("connect-src 'self' blob:");
  expect(capture.headers.get('Content-Security-Policy')).not.toContain("connect-src 'self' blob:");
});
