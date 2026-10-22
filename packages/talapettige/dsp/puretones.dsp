// PureTones DSP - Based on Sadharani Music Works implementation
// Additive synthesis with fullstring formula and variance beating
// Simplified for web use with configurable ratios

declare name "PureTones";
declare description "Additive synthesis Tanpura based on PureTones";
declare author "Based on Aravind Iyer & S Balachander's implementation";

import("stdfaust.lib");

// Parameters
coarsefreq = hslider("[0]sa", 130.81, 50, 500, 0.01) : si.smoo;
period = 60 / hslider("[1]cpm", 10, 5, 30, 1); // convert CPM to period in seconds
ratio1 = hslider("[2]ratio1", 1, 0.5, 4, 0.001);
ratio2 = hslider("[3]ratio2", 1.5, 0.5, 4, 0.001);
ratio3 = hslider("[4]ratio3", 1, 0.5, 4, 0.001);
ratio4 = hslider("[5]ratio4", 2, 0.5, 4, 0.001);
volume = hslider("[6]volume", 0.7, 0, 1, 0.01) : si.smoo;

// Variance creates beating between two slightly detuned copies
variance = 5; // default variance

// Octave gains - controls the timbre
octave1gain = 0.224;  // 5.6 * 0.04
octave2gain = 0.312;  // 7.8 * 0.04
octave3gain = 0.168;  // 5.6 * 0.03
octave4gain = 0.04;   // 1.0 * 0.04
octave5gain = 0.004;  // 0.4 * 0.01
octave6gain = 0.0006; // 0.2 * 0.003

// The fullstring formula: efficient harmonic series generation
// Generates harmonics from n1 to n2 with decay factor g
fullstring(f, n1, n2, g) = ((pow(g, n2+2-n1)) * os.osc(f*n2) + os.osc(f*n1)
                           - (pow(g, n2+1-n1)) * os.osc(f*(n2+1))
                           - g * os.osc(f*(n1-1)))
                          / (1 + g*g - 2*g*os.osccos(f));

// Single PureTones string with variance beating
PureTonesString(freq, period, delay) = string(freq*(1+delta)/2, gamma) + string(freq*(1-delta)/2, gamma)
with {
  delta = variance / 10000;
  gamma = 0.5;

  // Auto-trigger gate with delay offset
  gate = os.lf_pulsetrainpos(1/period, 0.3) : @(int(ma.SR * delay * period));

  // Different envelopes for different harmonic groups - creates evolving timbre
  envelope1 = en.adsr(0.1*period, 0.3*period, 0.2, 0.3*period, gate);
  envelope2 = en.adsr(0.2*period, 0.4*period, 0.4, 0.4*period, gate);
  envelope3 = en.adsr(0.1*period, 0.5*period, 0.6, 0.5*period, gate);

  // High octaves with fast envelope
  string1(f, g) = octave6gain * fullstring(f, 32, 64, g)
                + octave5gain * fullstring(f, 16, 32, g)
                : *(envelope1);

  // Mid octaves with medium envelope
  string2(f, g) = octave4gain * fullstring(f, 8, 16, g)
                + octave3gain * fullstring(f, 4, 8, g)
                : *(envelope2);

  // Low octaves with slow envelope - fundamental + second harmonic
  string3(f, g) = octave1gain * (os.osc(f) + 1.42 * os.osc(2*f))
                + octave2gain * fullstring(f, 2, 4, g)
                : *(envelope3);

  string(f, g) = string1(f, g) + string2(f, g) + string3(f, g);
};

// Four strings with different ratios and timing offsets
string1 = PureTonesString(coarsefreq * ratio1, period, 0);
string2 = PureTonesString(coarsefreq * ratio2, period, 0.25);
string3 = PureTonesString(coarsefreq * ratio3, period, 0.5);
string4 = PureTonesString(coarsefreq * ratio4, period, 0.75);

// Mix and add reverb
mix = (string1 + string2 + string3 + string4) * volume * 0.25;

// Simplified reverb (zita_light is heavy, use basic reverb)
reverb = re.mono_freeverb(0.7, 0.5, 0.5, 3000);

process = mix : reverb <: _, _;
