/** Explicit mode shapes and angular frequencies; no eigenproblem is solved. */
export interface ModalStateOptions {
  modes: readonly {shape: readonly number[]; amplitude: number; angularFrequency: number; phase?: number}[];
  equilibrium?: readonly number[];
}
export interface ModalSnapshot {
  /** Motion relative to equilibrium. */
  displacement: number[];
  position: number[];
  velocity: number[];
  contributions: number[][];
}
export interface ModalState { at(time: number): ModalSnapshot; }

export interface ConservativeTransportOptions {
  initial: readonly number[];
  /** Fractions of each source's mass at the beginning of a discrete step. */
  transfers: readonly {id: string; from: number; to: number; fraction: number}[];
  steps?: number;
}
export interface TransportSnapshot {
  values: number[];
  /** Simultaneous outgoing transfers to the next step; empty at the final step. */
  flows: {id: string; from: number; to: number; amount: number}[];
}
export interface ConservativeTransport {
  readonly steps: number;
  at(step: number): TransportSnapshot;
}

export interface ComplexInterferenceOptions {
  waves: readonly {
    amplitude: readonly [number, number];
    /** Phase is phase + waveVector dot position - angularFrequency * time. */
    angularFrequency?: number;
    waveVector?: readonly [number, number, number];
    phase?: number;
  }[];
}
export interface InterferenceSnapshot {
  components: [number, number][];
  amplitude: [number, number];
  /** Squared magnitude, not a normalized probability. */
  intensity: number;
}
export interface ComplexInterference {
  at(time: number, position?: readonly [number, number, number]): InterferenceSnapshot;
}

export interface EventRatesOptions {
  /** One event-time array per channel. Empty channels are valid. */
  events: readonly (readonly number[])[];
  times: readonly number[];
  /** Positive Gaussian standard deviation in the same units as event times. */
  bandwidth: number;
}
export interface EventRates {
  times: number[];
  /** Aligned sample-by-channel kernel-density rates, in inverse time units. */
  values: number[][];
}

export interface ScientificStateBuilders {
  rigidMotion(options: RigidMotionOptions): RigidMotion;
  modalState(options: ModalStateOptions): ModalState;
  conservativeTransport(options: ConservativeTransportOptions): ConservativeTransport;
  complexInterference(options: ComplexInterferenceOptions): ComplexInterference;
  eventRates(options: EventRatesOptions): EventRates;
}

export interface RigidMotionOptions {
  pivot: readonly [number,number,number];
  keyframes: readonly {time:number; translation:readonly [number,number,number]; rotation:readonly [number,number,number]}[];
  /** Componentwise Euler interpolation; default linear, smooth uses cubic smoothstep. */
  interpolation?: 'linear'|'smooth';
  provenance: {kind:'illustrative';description:string;source?:string}|{kind:'supplied';description:string;source:string};
}
export interface RigidPose {
  position: [number,number,number];
  /** Radians, applied X then Y then Z. */
  rotation: [number,number,number];
}
export interface RigidMotion {
  /** Holds the endpoint pose outside the keyframe interval. */
  at(time:number): RigidPose;
  transformPoint(point:readonly [number,number,number],time:number): [number,number,number];
}
