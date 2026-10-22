import { useCallback, useEffect, useRef, useState } from 'react';
import type { Akshara } from '~/lib/tala-configs';

export interface TalaParams {
  sa: number; // Base frequency in Hz
  bpm: number; // Aksharas per minute
  volume: number; // 0-1
  pattern: Akshara[]; // Akshara pattern with isSam flags
  nadaiCount: number; // Subdivisions per akshara
  nonSamRatio: number; // Ratio for non-Sam beats (from firstString)
}

const DEFAULT_TALA_PARAMS: TalaParams = {
  sa: 130.81,
  bpm: 60,
  volume: 0.5,
  pattern: [{ isSam: true, angaIndex: 0 }],
  nadaiCount: 4,
  nonSamRatio: 1.5, // Default to Pa (3/2)
};

interface UseTalaDSPReturn {
  isPlaying: boolean;
  isLoading: boolean;
  currentBeat: number; // Current akshara index (for visualization)
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  setParam: (name: keyof TalaParams, value: number | Akshara[]) => void;
}

export function useTalaDSP(): UseTalaDSPReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const paramsRef = useRef<TalaParams>({ ...DEFAULT_TALA_PARAMS });
  const startTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  const getAudioContext = useCallback(async (): Promise<AudioContext> => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const loadProcessor = useCallback(async (): Promise<AudioWorkletNode> => {
    const ctx = await getAudioContext();

    // Pitched metallic cymbal synthesis processor
    const processorCode = `
      class TalaProcessor extends AudioWorkletProcessor {
        constructor() {
          super();
          this.reset();
          this.params = {
            sa: 130.81,
            bpm: 60,
            volume: 0.5,
            pattern: [{ isSam: true, angaIndex: 0 }],
            nadaiCount: 4,
            nonSamRatio: 1.5
          };
          this.port.onmessage = (e) => {
            if (e.data.type === 'param') {
              if (e.data.name === 'pattern') {
                this.params.pattern = e.data.value;
                this.reset();
              } else {
                this.params[e.data.name] = e.data.value;
              }
            } else if (e.data.type === 'reset') {
              this.reset();
            }
          };
        }

        reset() {
          this.triggerPhase = 0;
          this.currentAkshara = -1;
          this.samplesSinceTrigger = 99999;
          this.firstTrigger = true;
          this.currentSubdivision = 0;
          this.subdivisionSamplesSinceTrigger = 99999;
          // Phase accumulators for each partial (6 partials)
          this.phases = new Float32Array(6);
          // Separate phases for subdivision sounds
          this.subdivPhases = new Float32Array(6);
        }

        // Inharmonic partials for metallic/bell timbre
        static get PARTIALS() {
          return [1, 2.32, 3.15, 4.73, 5.28, 6.91];
        }

        static get PARTIAL_GAINS() {
          return [1, 0.6, 0.4, 0.25, 0.15, 0.1];
        }

        // Decay rates for each partial (higher partials decay faster)
        static get PARTIAL_DECAYS() {
          return [4, 6, 8, 10, 12, 14];
        }

        // ADSR envelope for percussive sound
        // attack: 2ms, decay: 150ms, sustain: 0, release: 50ms
        getEnvelope(samplesSinceTrigger, sr) {
          const attackSamples = 0.002 * sr;  // 2ms
          const decaySamples = 0.15 * sr;    // 150ms
          const releaseSamples = 0.05 * sr;  // 50ms
          const totalSamples = attackSamples + decaySamples + releaseSamples;

          const t = samplesSinceTrigger;

          if (t < attackSamples) {
            // Attack phase - linear ramp up
            return t / attackSamples;
          } else if (t < attackSamples + decaySamples) {
            // Decay phase - exponential decay to 0
            const decayProgress = (t - attackSamples) / decaySamples;
            return Math.pow(1 - decayProgress, 2);
          } else if (t < totalSamples) {
            // Release phase
            return 0;
          }
          return 0;
        }

        // Get partial envelope with different decay rates
        getPartialEnvelope(samplesSinceTrigger, sr, partialIndex) {
          const baseEnv = this.getEnvelope(samplesSinceTrigger, sr);
          const decayRate = TalaProcessor.PARTIAL_DECAYS[partialIndex];
          return baseEnv * Math.exp(-samplesSinceTrigger / (sr / decayRate));
        }

        process(inputs, outputs, parameters) {
          const output = outputs[0];
          const channel0 = output[0];
          const channel1 = output[1] || channel0;

          if (!channel0) return true;

          const sr = globalThis.sampleRate || 44100;
          const pattern = this.params.pattern;
          const patternLength = pattern.length;
          const nadaiCount = this.params.nadaiCount || 4;

          // Time per akshara in samples
          const aksharaInterval = (60 / this.params.bpm) * sr;
          // Time per subdivision in samples
          const subdivisionInterval = aksharaInterval / nadaiCount;

          // Non-Sam beats use the ratio from firstString (dynamic)
          const nonSamRatio = this.params.nonSamRatio || 1.5;

          for (let i = 0; i < channel0.length; i++) {
            // Handle first trigger
            if (this.firstTrigger) {
              this.firstTrigger = false;
              this.currentAkshara = 0;
              this.currentSubdivision = 0;
              this.samplesSinceTrigger = 0;
              this.subdivisionSamplesSinceTrigger = 0;
              this.triggerPhase = 0;
              // Reset phases
              for (let p = 0; p < 6; p++) {
                this.phases[p] = 0;
                this.subdivPhases[p] = 0;
              }
            }

            this.triggerPhase++;

            // Check for new akshara trigger
            if (this.triggerPhase >= aksharaInterval) {
              this.triggerPhase = 0;
              this.currentAkshara = (this.currentAkshara + 1) % patternLength;
              this.currentSubdivision = 0;
              this.samplesSinceTrigger = 0;
              this.subdivisionSamplesSinceTrigger = 0;
              // Reset phases for new strike
              for (let p = 0; p < 6; p++) {
                this.phases[p] = 0;
                this.subdivPhases[p] = 0;
              }
            }
            // Check for subdivision trigger (skip first subdivision as it's the main beat)
            else if (nadaiCount > 1) {
              const positionInAkshara = this.triggerPhase;
              const expectedSubdivision = Math.floor(positionInAkshara / subdivisionInterval);
              if (expectedSubdivision > this.currentSubdivision && expectedSubdivision < nadaiCount) {
                this.currentSubdivision = expectedSubdivision;
                this.subdivisionSamplesSinceTrigger = 0;
                // Reset subdivision phases for new strike
                for (let p = 0; p < 6; p++) {
                  this.subdivPhases[p] = 0;
                }
              }
            }

            this.samplesSinceTrigger++;
            this.subdivisionSamplesSinceTrigger++;

            // Determine if this is a Sam (strong) or weak beat
            const akshara = pattern[this.currentAkshara];
            const isSam = akshara ? akshara.isSam : false;
            const isMuted = akshara ? akshara.muted : false;

            let sample = 0;

            // Only synthesize if not muted
            if (!isMuted) {
              // Base frequency: Sa for Sam, firstString note for weak beats
              const baseFreq = isSam ? this.params.sa : this.params.sa * nonSamRatio;

              // Synthesize metallic timbre with inharmonic partials
              const partials = TalaProcessor.PARTIALS;
              const gains = TalaProcessor.PARTIAL_GAINS;

              // Main beat sound (full volume)
              const mainBeatVolume = isSam ? 1.0 : 0.6;
              for (let p = 0; p < partials.length; p++) {
                const freq = baseFreq * partials[p];
                const phaseInc = (2 * Math.PI * freq) / sr;

                this.phases[p] += phaseInc;
                if (this.phases[p] > 2 * Math.PI) {
                  this.phases[p] -= 2 * Math.PI;
                }

                const env = this.getPartialEnvelope(this.samplesSinceTrigger, sr, p);
                sample += Math.sin(this.phases[p]) * gains[p] * env * mainBeatVolume;
              }

              // Subdivision sound (softer, only if nadaiCount > 1 and not first subdivision)
              if (nadaiCount > 1 && this.currentSubdivision > 0) {
                const subdivVolume = isSam ? 0.35 : 0.25; // Much softer
                for (let p = 0; p < partials.length; p++) {
                  const freq = baseFreq * partials[p];
                  const phaseInc = (2 * Math.PI * freq) / sr;

                  this.subdivPhases[p] += phaseInc;
                  if (this.subdivPhases[p] > 2 * Math.PI) {
                    this.subdivPhases[p] -= 2 * Math.PI;
                  }

                  const env = this.getPartialEnvelope(this.subdivisionSamplesSinceTrigger, sr, p);
                  sample += Math.sin(this.subdivPhases[p]) * gains[p] * env * subdivVolume;
                }
              }

              // Apply volume and normalize
              sample *= this.params.volume * 0.3;

              // Soft clip
              sample = Math.tanh(sample * 1.5);
            }

            channel0[i] = sample;
            channel1[i] = sample;
          }

          return true;
        }
      }

      registerProcessor('tala-processor', TalaProcessor);
    `;

    const blob = new Blob([processorCode], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);

    try {
      await ctx.audioWorklet.addModule(url);
    } catch {
      // Module might already be registered
    }

    URL.revokeObjectURL(url);

    const node = new AudioWorkletNode(ctx, 'tala-processor');
    return node;
  }, [getAudioContext]);

  // Animation frame loop to calculate beat from AudioContext time
  const startBeatAnimation = useCallback(() => {
    const animate = () => {
      const ctx = audioContextRef.current;
      if (!ctx || ctx.state !== 'running') {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      const params = paramsRef.current;
      const elapsedTime = ctx.currentTime - startTimeRef.current;
      const secondsPerAkshara = 60 / params.bpm;
      const patternLength = params.pattern.length;

      // Calculate current beat index
      const totalAksharas = elapsedTime / secondsPerAkshara;
      const beatIndex = Math.floor(totalAksharas) % patternLength;

      setCurrentBeat(beatIndex);
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  }, []);

  const stopBeatAnimation = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const node = await loadProcessor();
      workletNodeRef.current = node;

      const ctx = await getAudioContext();
      node.connect(ctx.destination);

      // Send current params to processor
      const params = paramsRef.current;
      node.port.postMessage({ type: 'param', name: 'sa', value: params.sa });
      node.port.postMessage({ type: 'param', name: 'bpm', value: params.bpm });
      node.port.postMessage({ type: 'param', name: 'volume', value: params.volume });
      node.port.postMessage({ type: 'param', name: 'pattern', value: params.pattern });
      node.port.postMessage({ type: 'param', name: 'nadaiCount', value: params.nadaiCount });
      node.port.postMessage({ type: 'param', name: 'nonSamRatio', value: params.nonSamRatio });

      node.port.postMessage({ type: 'reset' });

      // Record start time and begin animation loop
      startTimeRef.current = ctx.currentTime;
      startBeatAnimation();

      setIsPlaying(true);
      setCurrentBeat(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start tala audio');
    } finally {
      setIsLoading(false);
    }
  }, [loadProcessor, getAudioContext, startBeatAnimation]);

  const stop = useCallback(() => {
    stopBeatAnimation();
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    setIsPlaying(false);
    setCurrentBeat(-1);
  }, [stopBeatAnimation]);

  const setParam = useCallback((name: keyof TalaParams, value: number | Akshara[]) => {
    (paramsRef.current as unknown as Record<string, number | Akshara[]>)[name] = value;
    if (workletNodeRef.current) {
      workletNodeRef.current.port.postMessage({ type: 'param', name, value });
    }
  }, []);

  useEffect(() => {
    return () => {
      stopBeatAnimation();
      stop();
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [stop, stopBeatAnimation]);

  return {
    isPlaying,
    isLoading,
    currentBeat,
    error,
    start,
    stop,
    setParam,
  };
}
