/** Packed vertex layout shared by tessellation, composition, inspection and both GPUs. */
export const VERTEX_FLOATS = 34;
export const texturePatterns = ['checker', 'stripes', 'noise', 'marble', 'wood'] as const;

// Equivalent bounded value-noise and filtered pattern functions for the two backends.
// Texture coordinates are local, interpolated per fragment (no extra tessellation).
export const textureWGSL = `
fn bumpNormal(n:vec3f,dx:vec3f,dy:vec3f,dh:vec2f,strength:f32)->vec3f {
  let rx=cross(dy,n);let ry=cross(n,dx);let determinant=dot(dx,rx);
  // Degenerate projections and grazing faces keep their finite base normal.
  if(abs(determinant)<=0.000001*max(length(dx)*length(dy),1e-20)){return n;}
  let gradient=(rx*dh.x+ry*dh.y)/determinant;
  return normalize(n-strength*gradient);
}

fn textureHash(cell:vec3f,seed:f32)->f32 {
  var p=fract(cell*0.1031+vec3f(seed*0.001));
  p+=vec3f(dot(p,p.yzx+vec3f(33.33)));
  return fract((p.x+p.y)*p.z);
}
fn textureNoise(p:vec3f,seed:f32)->f32 {
  let cell=floor(p);let f=fract(p);let u=f*f*(vec3f(3.)-2.*f);
  return mix(mix(mix(textureHash(cell,seed),textureHash(cell+vec3f(1,0,0),seed),u.x),
    mix(textureHash(cell+vec3f(0,1,0),seed),textureHash(cell+vec3f(1,1,0),seed),u.x),u.y),
    mix(mix(textureHash(cell+vec3f(0,0,1),seed),textureHash(cell+vec3f(1,0,1),seed),u.x),
    mix(textureHash(cell+vec3f(0,1,1),seed),textureHash(cell+vec3f(1,1,1),seed),u.x),u.y),u.z);
}
fn textureBand(x:f32,width:f32)->f32 {
  let edge=max(0.0001,min(width,1.)*3.14159265);
  return mix(smoothstep(-edge,edge,sin(x*3.14159265)),0.5,clamp(width-0.5,0.,1.));
}
fn textureMix(p:vec3f,kind:f32,seed:f32,footprint:vec3f)->f32 {
  let width=max(footprint.x,max(footprint.y,footprint.z));
  if(kind<1.5){
    let bands=vec3f(textureBand(p.x,footprint.x),textureBand(p.y,footprint.y),textureBand(p.z,footprint.z))*2.-vec3f(1.);
    return 0.5-0.5*bands.x*bands.y*bands.z;
  }
  if(kind<2.5){return 1.-textureBand(p.x,footprint.x);}
  let noise=textureNoise(p,seed);
  if(kind<3.5){return mix(noise,0.5,clamp(width,0.,1.));}
  if(kind<4.5){return textureBand(p.x+4.*noise,width*5.);}
  return textureBand(length(p.xz)*2.+2.*noise,width*4.);
}
`;

export const textureGLSL = `
vec3 bumpNormal(vec3 n,vec3 dx,vec3 dy,vec2 dh,float strength) {
  vec3 rx=cross(dy,n),ry=cross(n,dx);float determinant=dot(dx,rx);
  if(abs(determinant)<=0.000001*max(length(dx)*length(dy),1e-20)){return n;}
  vec3 gradient=(rx*dh.x+ry*dh.y)/determinant;
  return normalize(n-strength*gradient);
}

float textureHash(vec3 cell,float seed) {
  vec3 p=fract(cell*0.1031+vec3(seed*0.001));
  p+=vec3(dot(p,p.yzx+vec3(33.33)));
  return fract((p.x+p.y)*p.z);
}
float textureNoise(vec3 p,float seed) {
  vec3 cell=floor(p),f=fract(p),u=f*f*(vec3(3.)-2.*f);
  return mix(mix(mix(textureHash(cell,seed),textureHash(cell+vec3(1,0,0),seed),u.x),
    mix(textureHash(cell+vec3(0,1,0),seed),textureHash(cell+vec3(1,1,0),seed),u.x),u.y),
    mix(mix(textureHash(cell+vec3(0,0,1),seed),textureHash(cell+vec3(1,0,1),seed),u.x),
    mix(textureHash(cell+vec3(0,1,1),seed),textureHash(cell+vec3(1,1,1),seed),u.x),u.y),u.z);
}
float textureBand(float x,float width) {
  float edge=max(0.0001,min(width,1.)*3.14159265);
  return mix(smoothstep(-edge,edge,sin(x*3.14159265)),0.5,clamp(width-0.5,0.,1.));
}
float textureMix(vec3 p,float kind,float seed,vec3 footprint) {
  float width=max(footprint.x,max(footprint.y,footprint.z));
  if(kind<1.5){
    vec3 bands=vec3(textureBand(p.x,footprint.x),textureBand(p.y,footprint.y),textureBand(p.z,footprint.z))*2.-vec3(1.);
    return 0.5-0.5*bands.x*bands.y*bands.z;
  }
  if(kind<2.5){return 1.-textureBand(p.x,footprint.x);}
  float noise=textureNoise(p,seed);
  if(kind<3.5){return mix(noise,0.5,clamp(width,0.,1.));}
  if(kind<4.5){return textureBand(p.x+4.*noise,width*5.);}
  return textureBand(length(p.xz)*2.+2.*noise,width*4.);
}
`;
