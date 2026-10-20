import {createBridge} from '../src/bridge.mjs';
import puppeteer from 'puppeteer-core';
import {mkdtemp,readdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.join(process.env.LOCALAPPDATA,'ms-playwright');
const folder=(await readdir(root)).find(p=>p.startsWith('chromium-'));
const executablePath=process.env.STUDIO_CHROMIUM??path.join(root,folder,'chrome-win64/chrome.exe');
const bridge=await createBridge({dataDir:await mkdtemp(path.resolve('.tmp/studio-timeout-')),commandTimeoutMs:200});
const browser=await puppeteer.launch({executablePath,headless:true,args:['--enable-unsafe-webgpu','--disable-gpu-sandbox','--no-sandbox']});
try{
  const session=await bridge.create(),page=await browser.newPage();
  await page.goto(session.viewerUrl);
  await page.waitForFunction(()=>!document.querySelector('#pause').disabled);
  let delay=true;
  await page.setRequestInterception(true);
  page.on('request',request=>{
    if(delay&&request.url().includes('/result?')){delay=false;setTimeout(()=>void request.continue(),400);}
    else void request.continue();
  });
  await assert.rejects(bridge.command(session.sessionId,'inspect'),/outcome unknown/);
  await new Promise(r=>setTimeout(r,700));
  assert.equal(bridge.list()[0].connected,true,'Expired result must not disconnect healthy renderer');
  const inspected=await bridge.command(session.sessionId,'inspect');assert.equal(inspected.revision,0);
  console.log('PASS: late result keeps renderer connected; inspect resolves unknown outcome.');
}finally{await browser.close();await bridge.close();}
