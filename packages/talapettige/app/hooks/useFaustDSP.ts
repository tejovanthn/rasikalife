import { useCallback, useEffect, useRef, useState } from 'react';
import type { DSPParams, EngineType } from '~/lib/dsp-engine';
import { DEFAULT_PARAMS } from '~/lib/dsp-engine';

interface UseFaustDSPReturn {
  isPlaying: boolean;
  isLoading: boolean;
  currentEngine: EngineType;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  setEngine: (engine: EngineType) => Promise<void>;
  setParam: (name: keyof DSPParams, value: number | string) => void;
}

export function useFaustDSP(): UseFaustDSPReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentEngine, setCurrentEngine] = useState<EngineType>('tambura');
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const paramsRef = useRef<DSPParams>({ ...DEFAULT_PARAMS });

  const getAudioContext = useCallback(async (): Promise<AudioContext> => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const loadEngine = useCallback(
    async (engine: EngineType): Promise<AudioWorkletNode> => {
      const ctx = await getAudioContext();

      const processorCode = `
      class TanpuraProcessor extends AudioWorkletProcessor {
        constructor() {
          super();
          this.reset();
          this.params = {
            sa: 130.81,
            cpm: 10,
            ratio1: 1.5,
            ratio2: 1,
            ratio3: 1,
            ratio4: 0.5,
            volume: 0.7,
            cycleLength: 4,
            cyclePattern: [0, 1, 2, 3]
          };
          this.port.onmessage = (e) => {
            if (e.data.type === 'param') {
              if (e.data.name === 'cyclePattern') {
                try {
                  this.params.cyclePattern = JSON.parse(e.data.value);
                } catch (err) {
                  // Keep existing pattern
                }
              } else {
                this.params[e.data.name] = e.data.value;
              }
            } else if (e.data.type === 'reset') {
              this.reset();
            }
          };
        }

        reset() {
          this.stringPhases = [];
          for (let s = 0; s < 4; s++) {
            this.stringPhases[s] = {
              copy1: new Float32Array(16),
              copy2: new Float32Array(16)
            };
          }
          this.triggerPhase = 0;
          this.currentStep = -1;
          this.samplesSinceTrigger = [99999, 99999, 99999, 99999];
          this.firstTrigger = true;
        }

        adsr(attack, decay, sustain, release, samplesSinceTrigger, sr, period) {
          const attackSamples = attack * period * sr;
          const decaySamples = decay * period * sr;
          const releaseSamples = release * period * sr;
          const totalSamples = period * sr;
          const t = samplesSinceTrigger;

          if (t < attackSamples) {
            return t / attackSamples;
          } else if (t < attackSamples + decaySamples) {
            const decayProgress = (t - attackSamples) / decaySamples;
            return 1.0 - decayProgress * (1.0 - sustain);
          } else if (t < totalSamples - releaseSamples) {
            return sustain;
          } else if (t < totalSamples) {
            const releaseProgress = (t - (totalSamples - releaseSamples)) / releaseSamples;
            return sustain * (1.0 - releaseProgress);
          }
          return 0;
        }

        process(inputs, outputs, parameters) {
          const output = outputs[0];
          const channel0 = output[0];
          const channel1 = output[1] || channel0;

          if (!channel0) return true;

          const sr = globalThis.sampleRate || 44100;
          const cyclePattern = this.params.cyclePattern;
          const cycleLength = cyclePattern.length;
          const period = 60 / this.params.cpm;
          const triggerInterval = sr * period / cycleLength;

          const variance = 5;
          const delta = variance / 10000;

          const octave1gain = 0.224;
          const octave2gain = 0.312;
          const octave3gain = 0.168;
          const octave4gain = 0.04;
          const octave5gain = 0.004;

          const ratios = [
            this.params.ratio1,
            this.params.ratio2,
            this.params.ratio3,
            this.params.ratio4
          ];

          for (let i = 0; i < channel0.length; i++) {
            if (this.firstTrigger) {
              this.firstTrigger = false;
              this.currentStep = 0;
              const stringIdx = cyclePattern[0];
              if (stringIdx >= 0) {
                this.samplesSinceTrigger[stringIdx] = 0;
              }
              this.triggerPhase = 0;
            }

            this.triggerPhase++;

            if (this.triggerPhase >= triggerInterval) {
              this.triggerPhase = 0;
              this.currentStep = (this.currentStep + 1) % cycleLength;
              const stringIdx = cyclePattern[this.currentStep];
              // Only trigger if not a pause (-1)
              if (stringIdx >= 0 && stringIdx < 4) {
                this.samplesSinceTrigger[stringIdx] = 0;
              }
            }

            let sample = 0;

            for (let s = 0; s < 4; s++) {
              const baseFreq = this.params.sa * ratios[s];
              const freq1 = baseFreq * (1 + delta) / 2;
              const freq2 = baseFreq * (1 - delta) / 2;

              this.samplesSinceTrigger[s]++;
              const sst = this.samplesSinceTrigger[s];

              const env1 = this.adsr(0.1, 0.3, 0.2, 0.3, sst, sr, period);
              const env2 = this.adsr(0.2, 0.4, 0.4, 0.4, sst, sr, period);
              const env3 = this.adsr(0.1, 0.5, 0.6, 0.5, sst, sr, period);

              let stringSound = 0;

              for (let copy = 0; copy < 2; copy++) {
                const freq = copy === 0 ? freq1 : freq2;
                const phases = copy === 0 ? this.stringPhases[s].copy1 : this.stringPhases[s].copy2;

                for (let h = 1; h <= 16; h++) {
                  phases[h-1] += (2 * Math.PI * freq * h) / sr;
                  if (phases[h-1] > 2 * Math.PI) phases[h-1] -= 2 * Math.PI;
                }

                const h1 = Math.sin(phases[0]);
                const h2 = Math.sin(phases[1]);
                stringSound += (octave1gain * (h1 + 1.42 * h2)) * env3;

                const h3 = Math.sin(phases[2]);
                const h4 = Math.sin(phases[3]);
                stringSound += (octave2gain * (h2 * 0.5 + h3 * 0.3 + h4 * 0.2)) * env3;

                let oct3 = 0;
                for (let h = 4; h <= 8; h++) {
                  oct3 += Math.sin(phases[h-1]) / h;
                }
                stringSound += (octave3gain * oct3) * env2;

                let oct4 = 0;
                for (let h = 8; h <= 16; h++) {
                  oct4 += Math.sin(phases[h-1]) / (h * h);
                }
                stringSound += (octave4gain * oct4) * env2;
                stringSound += (octave5gain * oct4 * 0.5) * env1;
              }

              sample += stringSound * 0.125;
            }

            sample *= this.params.volume;
            sample = Math.tanh(sample * 2);

            channel0[i] = sample;
            channel1[i] = sample;
          }

          return true;
        }
      }

      registerProcessor('tanpura-processor', TanpuraProcessor);
    `;

      const blob = new Blob([processorCode], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);

      try {
        await ctx.audioWorklet.addModule(url);
      } catch {
        // Module might already be registered
      }

      URL.revokeObjectURL(url);

      const node = new AudioWorkletNode(ctx, 'tanpura-processor');
      return node;
    },
    [getAudioContext]
  );

  const start = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const node = await loadEngine(currentEngine);
      workletNodeRef.current = node;

      const ctx = await getAudioContext();
      node.connect(ctx.destination);

      for (const [name, value] of Object.entries(paramsRef.current)) {
        node.port.postMessage({ type: 'param', name, value });
      }

      node.port.postMessage({ type: 'reset' });

      setIsPlaying(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start audio');
    } finally {
      setIsLoading(false);
    }
  }, [currentEngine, loadEngine, getAudioContext]);

  const stop = useCallback(() => {
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const setEngine = useCallback(
    async (engine: EngineType) => {
      const wasPlaying = isPlaying;
      if (wasPlaying) {
        stop();
      }
      setCurrentEngine(engine);
      if (wasPlaying) {
        setTimeout(() => start(), 100);
      }
    },
    [isPlaying, start, stop]
  );

  const setParam = useCallback((name: keyof DSPParams, value: number | string) => {
    (paramsRef.current as unknown as Record<string, number | string>)[name] = value;
    if (workletNodeRef.current) {
      workletNodeRef.current.port.postMessage({ type: 'param', name, value });
    }
  }, []);

  useEffect(() => {
    return () => {
      stop();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [stop]);

  return {
    isPlaying,
    isLoading,
    currentEngine,
    error,
    start,
    stop,
    setEngine,
    setParam,
  };
}
