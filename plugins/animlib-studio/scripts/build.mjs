import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const repo=path.resolve(root,'../..');
await build({configFile:false,root:path.join(root,'web'),
  plugins:[{name:'built-animlib',enforce:'pre',resolveId(source){
    const match=source.match(/shared\/animlib\/src\/(.+\.js)$/);
    if(match)return path.join(repo,'shared/animlib/dist',match[1]);
  }}],
  build:{outDir:path.join(root,'dist'),emptyOutDir:true,target:'es2022'},
  worker:{format:'es'},
});
