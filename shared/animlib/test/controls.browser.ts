import { ControlOverlay } from '../src/controls.js';

/** Native DOM layout regression; stubs cannot establish whether a slider is clipped. */
export async function controlPlacementRegression() {
  const root=document.createElement('div'),canvas=document.createElement('canvas');
  root.style.cssText='position:relative;width:390px;height:300px;padding:0;border:0;';
  canvas.style.cssText='display:block;width:100%;height:300px;';
  root.append(canvas);document.body.append(root);
  const changes:{id:string;value:unknown}[]=[];
  const overlay=new ControlOverlay(root,(id,value)=>{changes.push({id,value});},canvas);
  const control={id:'length',kind:'slider' as const,label:'Second-vector length k',default:1,value:1,min:.25,max:1.5,step:.01,position:[.73,.2] as [number,number],width:190};
  const check=(condition:unknown,message:string)=>{if(!condition)throw new Error(message);};
  const close=(actual:number,expected:number,message:string)=>check(Math.abs(actual-expected)<.6,`${message}: ${actual} != ${expected}`);
  const settled=async()=>{await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);};
  const positions:{canvasWidth:number;left:number;width:number}[]=[];
  try{
    overlay.update('vectors',[control]);await settled();
    const row=root.querySelector<HTMLLabelElement>('.animlib-control')!,input=row.querySelector<HTMLInputElement>('input')!;
    function bounded(expectedLeft:number,expectedWidth:number){
      const bounds=canvas.getBoundingClientRect(),label=row.getBoundingClientRect(),range=input.getBoundingClientRect();
      check(label.left>=bounds.left-.5&&label.right<=bounds.right+.5,'Authored control extends outside the canvas');
      check(range.left>=bounds.left-.5&&range.right<=bounds.right+.5,'Slider track extends outside the canvas');
      close(label.left-bounds.left,expectedLeft,'Control horizontal placement');close(label.width,expectedWidth,'Control usable width');
      positions.push({canvasWidth:bounds.width,left:label.left-bounds.left,width:label.width});
    }
    bounded(200,190);
    input.focus();input.value='1.5';input.dispatchEvent(new Event('input',{bubbles:true}));await settled();
    check(changes.length===1&&changes[0].id==='length'&&changes[0].value===1.5,'Clamped slider did not dispatch its value');
    root.style.width='1000px';await settled();
    bounded(730,190);
    check(root.querySelector('input')===input&&document.activeElement===input,'Resize recreated or defocused the slider');
    root.style.width='390px';await settled();bounded(200,190);
    overlay.update('vectors',[{...control,position:[1,.2]}]);await settled();bounded(200,190);
    overlay.update('vectors',[{...control,position:[0,.2]}]);await settled();bounded(0,190);
    overlay.update('vectors',[{...control,width:600}]);await settled();bounded(0,390);
    overlay.update('vectors',[{...control,position:undefined,width:undefined}]);await settled();
    close(row.getBoundingClientRect().left-canvas.getBoundingClientRect().left,142,'Default flow placement');
    close(row.getBoundingClientRect().width,220,'Default flow width');
    check(row.style.position==='relative','Default flow became absolute');
    check(root.querySelector('input')===input,'Placement update recreated the slider');
    return {positions,defaultFlow:true,resizePreservesFocus:true,inputDispatch:true};
  }finally{overlay.dispose();root.remove();}
}
