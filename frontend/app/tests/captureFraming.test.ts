import test from 'node:test'
import assert from 'node:assert/strict'
import { detectBoard, zoomFrame } from '../src/captureFraming.ts'
import { pairingSecretFromLink } from '../src/captureClient.ts'

function scene(background: number, board?: number) {
  const width=240, height=180, data=new Uint8ClampedArray(width*height*4)
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
    const value=board !== undefined && x>=30 && x<210 && y>=35 && y<140 ? board : background
    const i=(y*width+x)*4; data[i]=data[i+1]=data[i+2]=value; data[i+3]=255
  }
  return {width,height,data}
}
test('frames bright screens and dark boards with safety margin',()=>{
  for(const image of [scene(70,235),scene(195,35)]) {
    const frame=detectBoard(image)
    assert.ok(frame)
    assert.ok(frame.x<=30/240 && frame.x>.07)
    assert.ok(frame.y<=35/180 && frame.y>.12)
    assert.ok(frame.x+frame.width>=210/240)
    assert.ok(frame.y+frame.height>=140/180)
  }
})
test('does not invent a board in blank or unbounded striped scenes',()=>{
  assert.equal(detectBoard(scene(160)),null)
  const image=scene(160)
  for(let y=0;y<image.height;y++) for(let x=0;x<image.width;x++) for(let c=0;c<3;c++) image.data[(y*image.width+x)*4+c]=x%24<12?30:220
  assert.equal(detectBoard(image),null)
})
test('manual zoom remains inside source frame and preserves chosen framing centre',()=>{
  assert.deepEqual(zoomFrame(2,{x:.1,y:.2,width:.6,height:.4}),{x:.25,y:.30000000000000004,width:.3,height:.2})
  assert.deepEqual(zoomFrame(1),{x:0,y:0,width:1,height:1})
})
test('in-app QR accepts only this recorder origin and never navigates scanned URLs',()=>{
  const origin='https://phone.example:8443',secret='a'.repeat(64)
  assert.equal(pairingSecretFromLink(`${origin}/capture#pair=${secret}`,origin),secret)
  for(const url of [`https://evil.example/capture#pair=${secret}`,`${origin}/lectures#pair=${secret}`,`${origin}/capture#pair=bad`,'javascript:alert(1)']) assert.throws(()=>pairingSecretFromLink(url,origin))
})
