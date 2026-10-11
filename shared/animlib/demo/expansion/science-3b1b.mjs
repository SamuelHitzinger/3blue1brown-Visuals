/** Reuse inspected scientific motion in the current mathematical visual language. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const palette={background:'BLACK',foreground:'WHITE',colors:{BLACK:'#080D18',WHITE:'#F0F2F8',GREY_A:'#B9C2D2',GREY_B:'#8793AA',GREY_C:'#596577',GREY:'#B9C2D2',BLUE:'#7EA8FF',TEAL:'#47D7C8',YELLOW:'#FFD37E',RED:'#FFAC66',GREEN:'#47D7C8',PURPLE:'#C7A0FF',PURPLE_E:'#8470B5',PURPLE_D:'#8D7DC2',PURPLE_C:'#968BCF',PURPLE_B:'#9E9ADC',BLUE_E:'#8CA2E7',BLUE_D:'#7EA8FF',BLUE_C:'#70B8E7',BLUE_A:'#65C8D8'}};
for(const [name,duration] of [['artem-state',7.5],['logistic-residual',7],['neural-trajectory',9.5]]){
  const directory=resolve('data/animlib-expansion/science-3b1b',name);
  await mkdir(directory,{recursive:true});
  let source=await readFile(new URL(`./${name==='logistic-residual'?'logistic-residual-3b1b':name}.js`,import.meta.url),'utf8');
  if(name!=='logistic-residual')source=source.replaceAll('\\\\mathsf{','\\\\mathrm{');
  await writeFile(join(directory,`${name}.js`),source);
  await writeFile(join(directory,'manifest.json'),JSON.stringify({palette,scenes:[{id:name,file:`${name}.js`,duration}],captions:[]},null,2));
  const times=name==='neural-trajectory'?[0,1.6,2.4,3.4,5.45,7.3,8.5,9.49,3.4]:[0,.8,1.6,2.6,3.8,4.4,5.2,6.3,6.99,3.8];
  await writeFile(join(directory,'frames-input.json'),JSON.stringify({source,palette,times,directory:join(directory,'frames')}));
  console.log(JSON.stringify({name,directory,duration}));
}
