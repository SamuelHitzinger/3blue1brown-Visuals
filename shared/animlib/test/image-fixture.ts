import {model} from './asset-fixture.js';
export function imageInput(id='corners') {
  return {id,kind:'image' as const,version:1 as const,width:2,height:2,storage:'rgba8' as const,
    encoding:'srgb' as const,origin:'top-left' as const,alpha:'straight' as const,colorPolicy:'source' as const,
    pixels:new Uint8Array([203,71,19,255, 17,139,221,255, 31,219,63,128, 171,43,197,0]),provenance:model().provenance};
}

export function secondImageInput(){const image=imageInput('second');for(let i=0;i<image.pixels.length;i+=4)image.pixels.set([41,83,127,255],i);return image;}
