import type { AnimationAction, Ease, ElementHandle, ElementProps, SceneContext } from './types.js';

export type CompositionKind = 'circle' | 'sphere' | 'rectangle' | 'path' | 'line' | 'arrow' | 'text' | 'latex' | 'mesh';
export type CompositionPart = { kind: CompositionKind; props?: ElementProps }
  | ((scene: SceneContext, scopedId: string) => ElementHandle);
export interface Composition {
  readonly group: ElementHandle;
  /** Exact local part name; unknown names throw. */
  get(name: string): ElementHandle;
}
export interface TimingSpan { readonly startSec: number; readonly endSec: number }
/** Host narration data; each map uses stable IDs, never spoken-text lookup. */
export interface TimingPacket {
  readonly durationSec: number;
  readonly words?: Readonly<Record<string, TimingSpan>>;
  readonly utterances?: Readonly<Record<string, TimingSpan & { readonly role?: string }>>;
  readonly pauses?: Readonly<Record<string, TimingSpan>>;
  readonly cues?: Readonly<Record<string, TimingSpan>>;
}
export type TimingAnchor = ({ cue: string } | { word: string } | { utterance: string } | { pause: string })
  & { edge?: 'start' | 'end' };
export interface ScheduledStep {
  actions?: AnimationAction | AnimationAction[];
  reveal?: readonly ElementHandle[];
  /** Relative share of the operation window; default 1. Zero applies an instant update. */
  weight?: number;
}
export interface ScheduledOperation {
  id: string;
  /** Full named cue span; mutually exclusive with at/through/duration. */
  cue?: string;
  at?: TimingAnchor;
  /** Use through OR duration. Omitting both makes the operation instantaneous. */
  through?: TimingAnchor;
  duration?: number;
  actions?: AnimationAction | AnimationAction[];
  reveal?: readonly ElementHandle[];
  /** 1–64 sequential steps; mutually exclusive with top-level actions/reveal. No nesting. */
  steps?: readonly ScheduledStep[];
  /** Guard answer-bearing operations with their reveal utterance or named answer cue. */
  notBefore?: TimingAnchor;
  ease?: Ease;
}
export interface ScheduledWindow { readonly id: string; readonly startSec: number; readonly endSec: number }
export interface AuthoringBuilders {
  compose(prefix: string, parts: Readonly<Record<string, CompositionPart>>): Composition;
  /** Ordered, nonoverlapping operations followed by a hold to the measured end. */
  schedule(narration: TimingPacket, operations: readonly ScheduledOperation[]): readonly ScheduledWindow[];
}
