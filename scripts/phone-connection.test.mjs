import {test} from 'node:test';
import assert from 'node:assert/strict';
import {phoneOptions,privateOrigin,matchingServe} from './start-phone-lecture.mjs';

test('phone setup requires trusted origins and separate bounded listener ports',()=>{
  assert.equal(phoneOptions(['--origin','https://capture.example/']).origin,'https://capture.example');
  for(const origin of ['http://example.com','https://user:pass@example.com','https://example.com/path','https://example.com/?token=x','https://example.com/#token'])assert.throws(()=>phoneOptions(['--origin',origin]));
  for(const args of [['--port','8081'],['--port','65536'],['--capture-port','NaN'],['--unknown','x']])assert.throws(()=>phoneOptions(args));
  assert.equal(privateOrigin({BackendState:'Running',Self:{DNSName:'host.tail123.ts.net.'}},8443),'https://host.tail123.ts.net:8443');
  assert.throws(()=>privateOrigin({BackendState:'Stopped'},8443));
});

test('private receiver setup never overwrites another service or enables public Funnel',()=>{
  const origin='https://host.tail123.ts.net:8443',target='http://127.0.0.1:8081';
  assert.equal(matchingServe({},origin,target),false);
  const config={TCP:{8443:{HTTPS:true}},Web:{'host.tail123.ts.net:8443':{Handlers:{'/':{Proxy:target}}}}};
  assert.equal(matchingServe(config,origin,target),true);
  assert.throws(()=>matchingServe(config,origin,'http://127.0.0.1:8080'));
  assert.throws(()=>matchingServe({...config,AllowFunnel:{'host.tail123.ts.net:8443':true}},origin,target));
});
