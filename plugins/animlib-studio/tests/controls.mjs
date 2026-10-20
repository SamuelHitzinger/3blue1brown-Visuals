/** Browser interaction regression: parameters, orbit, pan, zoom, and reload. */
import {createBridge} from '../src/bridge.mjs';
import {createTools} from '../src/tools.mjs';
import puppeteer from 'puppeteer-core';
import {mkdir,mkdtemp,readFile,readdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {PNG} from 'pngjs';

function samePixels(a,b){
  const left=PNG.sync.read(Buffer.from(a,'base64')),right=PNG.sync.read(Buffer.from(b,'base64'));
  if(left.width!==right.width||left.height!==right.height)return false;
  let delta=0,changed=0;
  for(let i=0;i<left.data.length;i++){const d=Math.abs(left.data[i]-right.data[i]);delta+=d;if(d>3)changed++;}
  console.log(JSON.stringify({meanChannelError:delta/left.data.length,changedChannelFraction:changed/left.data.length}));
  return delta/left.data.length<.001;
}

await mkdir('.tmp',{recursive:true});
const dataDir=await mkdtemp(path.resolve('.tmp/studio-controls-'));
const bridge=await createBridge({dataDir}),invoke=createTools(bridge);bridge.setRpc(invoke);
const chromiumRoot=path.join(process.env.LOCALAPPDATA,'ms-playwright');
const chromium=(await readdir(chromiumRoot)).find(name=>name.startsWith('chromium-'));
const browser=await puppeteer.launch({executablePath:process.env.STUDIO_CHROMIUM??path.join(chromiumRoot,chromium,'chrome-win64/chrome.exe'),
  headless:true,args:['--enable-unsafe-webgpu','--disable-gpu-sandbox','--no-sandbox'],defaultViewport:{width:1100,height:800}});
const errors=[];
try{
  const session=await bridge.create({title:'Interactive controls test'}),page=await browser.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(session.viewerUrl);
  await page.waitForFunction(()=>!document.querySelector('#pause').disabled);
  const rpc=(name,args={})=>invoke(`animlib_${name}`,{sessionId:session.sessionId,...args});
  // Test navigation with the real wave geometry. Headless WebGPU text readback
  // is independently unstable even without interaction; labels are checked in
  // the visible installed viewer, not used as a camera-reset pixel oracle.
  const source=(await readFile(new URL('../examples/interference/scene.js',import.meta.url),'utf8'))
    .split('\n').filter(line=>!line.includes('s.text(')).join('\n');
  await rpc('program',{id:'interference',source});
  await page.waitForSelector('input[type=range]');
  assert.equal(await page.$$eval('input[type=range]',nodes=>nodes.length),3);
  const selector=id=>`input[data-parameter-id="${id}"]`;
  async function slide(id,value){
    await page.$eval(selector(id),(input,value)=>{input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));},value);
    // An inspect command queues behind the accepted local edit.
    const state=await rpc('inspect');
    assert.ok(Math.abs(state.programs[0].parameters.find(p=>p.id===id).value-value)<1e-10);
  }
  await slide('amplitude',.55);await slide('phase',Math.PI);await slide('wavelength',3);
  await rpc('parameters',{programId:'interference',values:{amplitude:.8}});
  assert.equal(await page.$eval(selector('amplitude'),input=>Number(input.value)),.8);
  // Native keyboard range behavior is usable without pointer dragging.
  await page.focus(selector('amplitude'));await page.keyboard.press('ArrowRight');
  assert.ok((await rpc('inspect')).programs[0].parameters.find(p=>p.id==='amplitude').value>.8);
  await rpc('control',{operation:'pause'});
  // Browser compositor screenshots test what the user sees, after presentation.
  const capture=async()=>{
    await rpc('verify',{checks:[]});
    return (await (await page.$('canvas')).screenshot({encoding:'base64'}));
  };
  const original=await capture(),bounds=await page.$eval('canvas',canvas=>{const r=canvas.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};});
  assert.ok(samePixels(await capture(),original),'Paused captures must be stable before navigation');
  const x=bounds.x+bounds.width*.5,y=bounds.y+bounds.height*.5;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+180,y+60,{steps:12});await page.mouse.up();
  const orbited=await capture();assert.ok(!samePixels(orbited,original));
  await page.mouse.wheel({deltaY:180});
  const zoomed=await capture();assert.ok(!samePixels(zoomed,orbited));
  await page.keyboard.down('Shift');await page.mouse.down();await page.mouse.move(x+240,y+100,{steps:5});await page.mouse.up();await page.keyboard.up('Shift');
  assert.ok(!samePixels(await capture(),zoomed));
  await page.click('#reset-view');
  const reset=await capture();
  await writeFile(path.join(dataDir,'before.png'),Buffer.from(original,'base64'));
  await writeFile(path.join(dataDir,'reset.png'),Buffer.from(reset,'base64'));
  assert.ok(samePixels(reset,original),`Reset differs from initial camera; captures: ${dataDir}`);
  await slide('amplitude',.55);
  await page.reload();await page.waitForFunction(()=>!document.querySelector('#pause').disabled);
  assert.equal(await page.$eval(selector('amplitude'),input=>Number(input.value)),.55);
  assert.equal(await page.$eval(selector('wavelength'),input=>Number(input.value)),3);
  await slide('amplitude',1);
  await page.setViewport({width:420,height:800});
  await page.screenshot({path:path.join(dataDir,'mobile.png')});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,checks:['three live sliders','native keyboard slider','external parameter sync','drag orbit','wheel zoom','shift pan','reset camera','reload values','edit after reload','mobile layout'],evidence:dataDir}));
}finally{await browser.close();await bridge.close();}
