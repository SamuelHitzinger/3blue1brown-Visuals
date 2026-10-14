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
