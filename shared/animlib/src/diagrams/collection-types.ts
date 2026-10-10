import type {ElementHandle,ElementStyle,Vec2} from '../types.js';
export interface CollectionItem {readonly id:string;readonly value:string|number;}
export interface CollectionOptions {origin?:Vec2;width?:number;height?:number;gap?:number;style?:ElementStyle;fontSize?:number;}
export interface SwapOptions {start:number;duration:number;/** Extra edge-to-edge separation at crossing. */clearance?:number;}
export interface CollectionDiagram {readonly items:ReadonlyMap<string,ElementHandle>;readonly slots:ReadonlyMap<string,number>;readonly data:readonly CollectionItem[];swap(a:string,b:string,options:SwapOptions):void;}
