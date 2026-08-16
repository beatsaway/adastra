/**
 * Lightweight generative ship ambience.
 * - Looping noise bed + 2 detuned hums
 * - Slow LFO / parameter drift (pseudo-varying, low CPU)
 * - Normal vs SOS targets; crossfade params over ~0.4s (no hard jumps)
 */

import { getAudioCtx, resumeAudio, busOut } from "./ctx.js?v=20260817al";

const TRANSITION_SEC = 0.4;

const NORMAL = {
  master: 0.11,
  humGain: 0.65,
  humFreq: 62,
  hum2Freq: 93,
  noiseGain: 0.38,
  noiseCutoff: 520,
  pulseDepth: 0.04,
  pulseRate: 0.07,
  drift: 0.35,
};

const SOS = {
  master: 0.13,
  humGain: 0.58,
  humFreq: 48,
  hum2Freq: 72,
  noiseGain: 0.62,
  noiseCutoff: 380,
  pulseDepth: 0.22,
  pulseRate: 1.05,
  drift: 0.55,
};

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function makeNoiseLoop(ctx, seconds = 2.5) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < n; i++) {
    const white = Math.random() * 2 - 1;
    // cheap pink-ish
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    data[i] = (b0 + b1 + b2 + white * 0.1) * 0.12;
  }
  return buf;
}

export class ShipAmbience {
  constructor() {
    this._started = false;
    this._sosWanted = false;
    this._blend = 0; // 0 = normal, 1 = sos
    this._t = 0;
    this._phase = Math.random() * Math.PI * 2;
    this._params = { ...NORMAL };

    /** @type {AudioContext | null} */
    this._ctx = null;
    this._master = null;
    this._humGain = null;
    this._hum = null;
    this._hum2 = null;
    this._noiseGain = null;
    this._noiseFilter = null;
    this._noise = null;
  }

  async start() {
    const ctx = await resumeAudio();
    if (!ctx || this._started) return;
    this._ctx = ctx;
    this._started = true;

    this._master = ctx.createGain();
    this._master.gain.value = NORMAL.master;
    this._master.connect(ctx.destination);

    // dual hum
    this._humGain = ctx.createGain();
    this._humGain.gain.value = NORMAL.humGain;
    this._humGain.connect(this._master);

    this._hum = ctx.createOscillator();
    this._hum.type = "sine";
    this._hum.frequency.value = NORMAL.humFreq;
    this._hum.connect(this._humGain);
    this._hum.start();

    this._hum2 = ctx.createOscillator();
    this._hum2.type = "sine";
    this._hum2.frequency.value = NORMAL.hum2Freq;
    const h2g = ctx.createGain();
    h2g.gain.value = 0.35;
    this._hum2.connect(h2g);
    h2g.connect(this._humGain);
    this._hum2.start();

    // noise bed
    this._noiseFilter = ctx.createBiquadFilter();
    this._noiseFilter.type = "lowpass";
    this._noiseFilter.frequency.value = NORMAL.noiseCutoff;
    this._noiseFilter.Q.value = 0.5;

    this._noiseGain = ctx.createGain();
    this._noiseGain.gain.value = NORMAL.noiseGain;
    this._noiseFilter.connect(this._noiseGain);
    this._noiseGain.connect(this._master);

    this._noise = ctx.createBufferSource();
    this._noise.buffer = makeNoiseLoop(ctx);
    this._noise.loop = true;
    this._noise.connect(this._noiseFilter);
    this._noise.start();
  }

  /**
   * @param {boolean} sos — current room (or ship) emergency state
   */
  setSos(sos) {
    this._sosWanted = !!sos;
  }

  /**
   * Call once per frame. Smoothly blends NORMAL ↔ SOS (~0.4s).
   * @param {number} dt
   */
  update(dt) {
    if (!this._started || !this._ctx) return;
    const d = Math.min(0.05, Math.max(0, dt || 0));
    this._t += d;
    this._phase += d;

    const target = this._sosWanted ? 1 : 0;
    const speed = 1 / TRANSITION_SEC;
    if (this._blend < target) {
      this._blend = Math.min(target, this._blend + speed * d);
    } else if (this._blend > target) {
      this._blend = Math.max(target, this._blend - speed * d);
    }

    const u = this._blend;
    const p = this._params;
    p.master = lerp(NORMAL.master, SOS.master, u);
    p.humGain = lerp(NORMAL.humGain, SOS.humGain, u);
    p.humFreq = lerp(NORMAL.humFreq, SOS.humFreq, u);
    p.hum2Freq = lerp(NORMAL.hum2Freq, SOS.hum2Freq, u);
    p.noiseGain = lerp(NORMAL.noiseGain, SOS.noiseGain, u);
    p.noiseCutoff = lerp(NORMAL.noiseCutoff, SOS.noiseCutoff, u);
    p.pulseDepth = lerp(NORMAL.pulseDepth, SOS.pulseDepth, u);
    p.pulseRate = lerp(NORMAL.pulseRate, SOS.pulseRate, u);
    p.drift = lerp(NORMAL.drift, SOS.drift, u);

    // slow generative drift + pulse (CPU: a few Math.sin)
    const drift =
      Math.sin(this._phase * 0.11) * 2.2 * p.drift +
      Math.sin(this._phase * 0.037 + 1.7) * 1.1 * p.drift;
    const pulse =
      1 - p.pulseDepth * (0.5 + 0.5 * Math.sin(this._t * Math.PI * 2 * p.pulseRate));

    const now = this._ctx.currentTime;
    const tau = 0.05;
    this._master.gain.setTargetAtTime(p.master * pulse, now, tau);
    this._humGain.gain.setTargetAtTime(p.humGain, now, tau);
    this._hum.frequency.setTargetAtTime(p.humFreq + drift, now, tau);
    this._hum2.frequency.setTargetAtTime(p.hum2Freq + drift * 0.6, now, tau);
    this._noiseGain.gain.setTargetAtTime(p.noiseGain * (0.85 + 0.15 * pulse), now, tau);
    this._noiseFilter.frequency.setTargetAtTime(p.noiseCutoff + drift * 8, now, tau);
  }

  stop() {
    if (!this._started) return;
    try {
      this._noise?.stop();
      this._hum?.stop();
      this._hum2?.stop();
    } catch (_) {}
    try {
      this._master?.disconnect();
    } catch (_) {}
    this._started = false;
    this._ctx = null;
  }
}
