export function readBounded(path:string,max:number):Promise<Buffer>;
export function readGLTFFile(input:string):Promise<{json:any;binary?:Uint8Array;sourceHash:string;read:(uri:string,max:number)=>Promise<Buffer>}>;
