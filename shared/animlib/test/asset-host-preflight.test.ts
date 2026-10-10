import {expect,it} from 'vitest';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {loadAssetRegistry} from '../tools/load-assets.mjs';
import {hashAssetContent} from '../src/asset-validation.js';
import {model} from './asset-fixture.js';
import {imageInput} from './image-fixture.js';

it('rejects aggregate decoded model and image memory before opening any binary payload',async()=>{
  const root=await mkdtemp(join(tmpdir(),'animlib-aggregate-'));
  try{
    const paths:string[]=[];
    const fixture=model(),{pixels:_pixels,...image}=imageInput();
    // Each package fits its individual limit. Together they exceed 256 MiB.
    // The intentionally absent payloads make any premature blob read fail ENOENT.
    for(let i=0;i<6;i++){
      const ref={path:'must-not-read.bin',hash:'a'.repeat(64),byteLength:240000};
      const content=i<3?{...image,id:'image'+i,width:4096,height:4096,pixels:{...ref,byteLength:4096*4096*4}}
        :{...fixture,id:'model'+i,parts:Array.from({length:6},(_,j)=>({id:'p'+j,vertexCount:20000,triangleCount:20000,positions:ref,indices:ref}))};
      const path=join(root,i+'.json');await writeFile(path,JSON.stringify({...content,hash:await hashAssetContent(content)}));paths.push(path);
    }
    await expect(loadAssetRegistry(paths,{colorPolicy:'source'})).rejects.toThrow(/aggregate decoded memory limit/);
  }finally{await rm(root,{recursive:true,force:true});}
});
