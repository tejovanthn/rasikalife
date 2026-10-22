// Tambura DSP - Based on olilarkin's Tambura implementation
// Waveguide physical model with jawari effect
// Simplified for web use with configurable ratios

declare name "Tambura";
declare description "Physical model of an Indian Tambura/Tanpura";
declare author "Based on Oli Larkin's implementation";

import("stdfaust.lib");

// Utility: line function for smooth transitions
line(value, time) = state~(_,_):!,_
with {
  state(t, c) = nt, ba.if(nt <= 0, value, c+(value - c) / nt)
  with {
    nt = ba.if(value != value', samples, t-1);
    samples = time*ma.SR/1000.0;
  };
};

dtmax = 8192;
NStrings = 4;

sm = si.smoo; // smoothing

// Parameters
f0 = hslider("[0]sa", 130.81, 50, 500, 0.01) : sm; // base frequency in Hz
cpm = hslider("[1]cpm", 10, 5, 30, 1); // cycles per minute
ratio1 = hslider("[2]ratio1", 1, 0.5, 4, 0.001);
ratio2 = hslider("[3]ratio2", 1.5, 0.5, 4, 0.001);
ratio3 = hslider("[4]ratio3", 1, 0.5, 4, 0.001);
ratio4 = hslider("[5]ratio4", 2, 0.5, 4, 0.001);
volume = hslider("[6]volume", 0.7, 0, 1, 0.01) : sm;

// Derived parameters
t60 = 8; // decay time in seconds
damp = 0.7; // high freq damping
fdetune = 0.001; // harmonic motion detuning
jw = 0.05; // jawari amount

// Pluck rate from CPM
pluckrate = cpm / 60 / 4; // Hz per string

// Ratios array
ratios(0) = ratio1;
ratios(1) = ratio2;
ratios(2) = ratio3;
ratios(3) = ratio4;

// Pick parameters
ptype = 0.3; // mix of DC and noise
pattack = 0.05;
ptime = 2.0;
ppos = 0.25;
pbend = 2; // semitones
pbendtime = 15; // ms

// Autoplucker: generates triggers for each string in sequence
autoplucker = phasor(pluckrate * 4) <: <(0.25), >(0.25) & <(0.5), >(0.5) & <(0.75), >(0.75) & <(1)
with {
  phasor(freq) = (freq/float(ma.SR) : (+ : ma.decimal) ~ _);
};

// Main tambura process
tambura(NStrings) = par(s, NStrings, string(s, trig(s))) :> stereoize
with {
  // Get trigger for each string from autoplucker
  trig(s) = autoplucker : ba.selectn(NStrings, s);

  // Excitation signal
  excitation(s, trigger) = input * ampenv : pickposfilter
  with {
    wl = ma.SR / (f0 * ratios(s)); // wavelength
    dur = ptime * wl / (ma.SR/1000.);
    ampenv = trigger * line(1. - trigger, dur) : si.lag_ud(wl * pattack / ma.SR, 0.005);
    input = 1., no.pink_noise : si.interpolate(ptype);
    pickposfilter = fi.ffcombfilter(dtmax, ppos * wl, -1);
  };

  // Single string with risset detuning
  string(s, trigger) = excitation(s, trigger) : rissetstring(s)
  with {
    rissetstring(s) = _ <: par(c, 5, stringloop(s, c)) :> _ : fi.dcblocker * 0.02;

    stringloop(s, c) = (+ : delay) ~ ((dampingfilter : nlfm) * fbk)
    with {
      delay(x) = de.fdelaylti(2, dtmax, dtsamples, x);
      pitchenv = trigger * line(1. - trigger, pbendtime) <: * : *(pbend);
      thisf0 = f0 * ratios(s) * (1 + (c-2) * fdetune) * ba.semi2ratio(pitchenv);
      dtsamples = ma.SR / thisf0 - 2;
      fbk = pow(0.001, 1.0 / (thisf0 * t60));

      dampingfilter(x) = (h0 * x' + h1 * (x + x''))
      with {
        h0 = (1. + damp) / 2;
        h1 = (1. - damp) / 4;
      };

      // Jawari: nonlinear allpass for buzz
      nlfm(x) = x <: fi.allpassnn(1, (par(i, 1, jw * ma.PI * x)));
    };
  };

  // Simple stereo spread
  stereoize = _ <: *(0.7), *(0.7);
};

process = tambura(NStrings) : *(volume), *(volume);
