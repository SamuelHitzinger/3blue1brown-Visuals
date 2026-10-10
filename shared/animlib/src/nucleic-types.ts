import type {Geometry,PaletteColor,Vec3} from './types.js';
export type DNABase='A'|'C'|'G'|'T';
export type RNABase='A'|'C'|'G'|'U';
export interface NucleicSite {id:string;base:DNABase;}
export interface NucleicDuplexProps {
  axis:Vec3[];template:NucleicSite[];coding:NucleicSite[];pairs:[string,string][];
  templateDirection:'3to5';codingDirection:'5to3';initialNormal:Vec3;
  radius:number;backboneRadius:number;twistPerBase:number;
  window:{start:number;end:number;separation:number};
  radialSegments?:number;samplesPerLink?:number;baseColors?:PaletteColor[];
}
export interface NucleicAnchor {id:string;base:DNABase|RNABase;strand:'template'|'coding'|'rna';shape:'purine'|'pyrimidine';backbone:Vec3;tip:Vec3;tangent:Vec3;normal:Vec3;}
export interface NucleicPart {id:string;role:string;geometry:Geometry;opacity:number;}
export interface NucleicDuplexResult {
  parts:NucleicPart[];anchors:NucleicAnchor[];pairs:{templateId:string;codingId:string;pairedFraction:number}[];
  ends:{template:{fivePrime:string;threePrime:string};coding:{fivePrime:string;threePrime:string}};
  linkLengths:{template:number[];coding:number[]};opening:number;
  provenance:{kind:'schematic';description:string};
}
export interface NucleicTranscriptProps {
  id:string;bases:{id:string;base:RNABase;templateId:string}[];duplex:NucleicDuplexResult;
  start:number;secondsPerBase:number;approachFraction:number;radius:number;incomingOffset?:Vec3;
}
export interface NucleicTranscriptResult {
  parts:NucleicPart[];anchors:NucleicAnchor[];incorporated:number;incomingId?:string;
  bonds:[string,string][];linkLengths:number[];ends?:{fivePrime:string;threePrime:string};triplets:[string,string,string][];
  provenance:{kind:'schematic';description:string};
}
