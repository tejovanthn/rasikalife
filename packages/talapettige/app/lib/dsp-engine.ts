// DSP Engine Abstraction Layer

export type EngineType = 'tambura' | 'puretones';

export interface DSPParams {
  sa: number; // Base frequency in Hz
  cpm: number; // Cycles per minute
  ratio1: number;
  ratio2: number;
  ratio3: number;
  ratio4: number;
  volume: number;
  cycleLength: number; // Number of steps in cycle (including pauses)
  cyclePattern: string; // JSON string of cycle pattern array
}

// Default DSP parameters
export const DEFAULT_PARAMS: DSPParams = {
  sa: 130.81, // C3
  cpm: 10,
  ratio1: 1.5, // Pa
  ratio2: 1, // Sa
  ratio3: 1, // Sa
  ratio4: 0.5, // sa (low)
  volume: 0.7,
  cycleLength: 4,
  cyclePattern: '[0,1,2,3]',
};
