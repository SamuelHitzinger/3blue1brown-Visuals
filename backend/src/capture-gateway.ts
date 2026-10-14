/** Deliberately narrow listener for private HTTPS forwarding from a phone. */
export function createCaptureGateway(app:(request:Request)=>Promise<Response>,capture:{handleDevice(request:Request):Promise<Response>}) {
  return async(request:Request):Promise<Response>=>{
    let path:string;
    try{path=decodeURIComponent(new URL(request.url).pathname);}catch{return Response.json({detail:'Not Found'},{status:404});}
    let response:Response;
    if(path.startsWith('/api/capture/'))response=await capture.handleDevice(request);
    else if(path==='/capture'||/^\/static\/assets\/[a-zA-Z0-9_.-]+$/.test(path)){
      if(!['GET','HEAD'].includes(request.method))return Response.json({detail:'Method Not Allowed'},{status:405,headers:{Allow:'GET, HEAD'}});
      response=await app(request);
    }else if(path==='/healthz'&&request.method==='GET')response=Response.json({ok:true,capture:true});
    else return Response.json({detail:'Not Found'},{status:404});
    response.headers.set('Referrer-Policy','no-referrer');
    response.headers.set('X-Content-Type-Options','nosniff');
    response.headers.set('Cross-Origin-Resource-Policy','same-origin');
    response.headers.set('Permissions-Policy','camera=(self), microphone=(self), screen-wake-lock=(self)');
    response.headers.set('Content-Security-Policy',`default-src 'self'; script-src 'self'; worker-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`);
    if(!path.startsWith('/static/'))response.headers.set('Cache-Control','private, no-store');
    return response;
  };
}
