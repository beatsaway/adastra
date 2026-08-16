/**
 * Looping antigrav hum while a dorm sleeper levitates on hover/aim.
 * Gain follows hoverT (0..1) so it rises and falls with the lift.
 */

import { getAudioCtx, resumeAudio, busOut } from "./ctx.js?v=20260817al";

export class SleeperLevitateHum {
  constructor() {
    this._ready = false;
    this._level = 0;
    /** @type {GainNode | null} */
    this._gain = null;
    /** @type {OscillatorNode | null} */
    this._hum = null;
    /** @type {OscillatorNode | null} */
    this._shimmer = null;
    /** @type {BiquadFilterNode | null} */
    this._airBp = null;
  }

  async ensure() {
    if (this._ready) return;
    const ctx = await resumeAudio();
    if (!ctx || this._ready) return;

    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(busOut("sfx") || ctx.destination);
    this._gain = master;

    const hum = ctx.createOscillator();
    hum.type = "sine";
    hum.frequency.value = 196;
    this._hum = hum;
    const hg = ctx.createGain();
    hg.gain.value = 0.55;
    hum.connect(hg);
    hg.connect(master);

    const harm = ctx.createOscillator();
    harm.type = "sine";
    harm.frequency.value = 392;
    const h2g = ctx.createGain();
    h2g.gain.value = 0.16;
    harm.connect(h2g);
    h2g.connect(master);

    const shimmer = ctx.createOscillator();
    shimmer.type = "triangle";
    shimmer.frequency.value = 740;
    this._shimmer = shimmer;
    const sg = ctx.createGain();
    sg.gain.value = 0.07;
    const slp = ctx.createBiquadFilter();
    slp.type = "lowpass";
    slp.frequency.value = 1800;
    shimmer.connect(slp);
    slp.connect(sg);
    sg.connect(master);

    const seconds = 0.55;
    const n = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let b0 = 0;
    for (let i = 0; i < n; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.985 * b0 + white * 0.08;
      data[i] = (white * 0.18 + b0) * 0.7;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 420;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1100;
    bp.Q.value = 0.7;
    this._airBp = bp;
    const ng = ctx.createGain();
    ng.gain.value = 0.28;
    src.connect(hp);
    hp.connect(bp);
    bp.connect(ng);
    ng.connect(master);

    hum.start();
    harm.start();
    shimmer.start();
    src.start();
    this._ready = true;
  }

  /**
   * @param {number} dt
   * @param {number} hoverT 0..1 sleeper lift amount
   */
  update(dt, hoverT) {
    if (!this._ready || !this._gain) return;
    const target = Math.max(0, Math.min(1, hoverT || 0));
    this._level += (target - this._level) * Math.min(1, dt * 8);
    this._gain.gain.value = this._level * 0.085;
    if (this._hum) {
      this._hum.frequency.value = 188 + this._level * 28;
    }
    if (this._shimmer) {
      this._shimmer.frequency.value = 700 + this._level * 90 + Math.sin(performance.now() * 0.008) * 18;
    }
    if (this._airBp) {
      this._airBp.frequency.value = 980 + this._level * 420;
    }
  }
}
