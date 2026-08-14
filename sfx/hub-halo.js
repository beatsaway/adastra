/**
 * Looping halo source at the Info Hub centre — living antigrav field, like sleeper hover.
 */

import { getAudioCtx, resumeAudio } from "./ctx.js";

export class HubHaloHum {
  constructor() {
    this._ready = false;
    this._level = 0;
    this._wander = 0;
    this._wander2 = 0;
    /** @type {GainNode | null} */
    this._gain = null;
    /** @type {OscillatorNode | null} */
    this._drone = null;
    /** @type {OscillatorNode | null} */
    this._fifth = null;
    /** @type {OscillatorNode | null} */
    this._shimmer = null;
    /** @type {GainNode | null} */
    this._shimmerG = null;
    /** @type {GainNode | null} */
    this._pingG = null;
    /** @type {BiquadFilterNode | null} */
    this._airBp = null;
  }

  async ensure() {
    if (this._ready) return;
    const ctx = await resumeAudio();
    if (!ctx || this._ready) return;

    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    this._gain = master;

    const drone = ctx.createOscillator();
    drone.type = "sine";
    drone.frequency.value = 132;
    this._drone = drone;
    const dg = ctx.createGain();
    dg.gain.value = 0.48;
    drone.connect(dg);
    dg.connect(master);

    const fifth = ctx.createOscillator();
    fifth.type = "sine";
    fifth.frequency.value = 198;
    this._fifth = fifth;
    const fg = ctx.createGain();
    fg.gain.value = 0.16;
    fifth.connect(fg);
    fg.connect(master);

    const shimmer = ctx.createOscillator();
    shimmer.type = "triangle";
    shimmer.frequency.value = 680;
    this._shimmer = shimmer;
    const sg = ctx.createGain();
    sg.gain.value = 0.06;
    this._shimmerG = sg;
    const slp = ctx.createBiquadFilter();
    slp.type = "lowpass";
    slp.frequency.value = 2100;
    shimmer.connect(slp);
    slp.connect(sg);
    sg.connect(master);

    const ping = ctx.createOscillator();
    ping.type = "sine";
    ping.frequency.value = 410;
    const pingG = ctx.createGain();
    pingG.gain.value = 0.0001;
    this._pingG = pingG;
    ping.connect(pingG);
    pingG.connect(master);

    const seconds = 0.62;
    const n = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let b0 = 0;
    for (let i = 0; i < n; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.985 * b0 + white * 0.08;
      data[i] = (white * 0.16 + b0) * 0.7;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 400;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 900;
    bp.Q.value = 0.65;
    this._airBp = bp;
    const ng = ctx.createGain();
    ng.gain.value = 0.26;
    src.connect(hp);
    hp.connect(bp);
    bp.connect(ng);
    ng.connect(master);

    drone.start();
    fifth.start();
    shimmer.start();
    ping.start();
    src.start();
    this._ready = true;
  }

  /**
   * @param {number} dt
   * @param {number} dist XZ distance to hub centre
   * @param {number} t elapsed time
   */
  update(dt, dist, t) {
    if (!this._ready || !this._gain) return;
    const near = 2.4;
    const far = 8.5;
    let target = 0;
    if (Number.isFinite(dist)) {
      if (dist < near) target = 1;
      else if (dist < far) target = 1 - (dist - near) / (far - near);
    }
    this._level += (target - this._level) * Math.min(1, dt * 3.2);

    this._wander += (Math.random() - 0.5) * dt * 5.5;
    this._wander *= Math.max(0.84, 1 - dt * 1.8);
    this._wander2 += (Math.random() - 0.5) * dt * 3.2;
    this._wander2 *= Math.max(0.88, 1 - dt * 1.2);

    const now = t || 0;
    const wobble =
      Math.sin(now * 0.62) * 0.45 +
      Math.sin(now * 1.41) * 0.28 +
      Math.sin(now * 0.19) * 0.35 +
      this._wander;
    const twinkle =
      Math.sin(now * 2.05) * 0.5 +
      Math.sin(now * 5.15) * 0.22 +
      this._wander2 * 0.6;
    const breath = 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(now * 0.48 + wobble * 0.4));
    this._gain.gain.value = this._level * 0.072 * breath;

    const u = ((now / 13.2) % 1 + 1) % 1;
    const pingA = Math.max(0, 1 - u * 4.2);
    const pingB = Math.max(0, 1 - ((u + 0.42) % 1) * 4.2);
    const ping = Math.max(pingA, pingB);

    if (this._drone) {
      this._drone.frequency.value = 126 + wobble * 26 + ping * 12;
    }
    if (this._fifth) {
      this._fifth.frequency.value = 188 + wobble * 16 + Math.sin(now * 0.91) * 8;
    }
    if (this._shimmer) {
      this._shimmer.frequency.value = 640 + this._level * 90 + twinkle * 110 + ping * 50;
    }
    if (this._shimmerG) {
      this._shimmerG.gain.value = 0.035 + (0.5 + 0.5 * Math.sin(now * 1.7 + twinkle)) * 0.055;
    }
    if (this._pingG) {
      this._pingG.gain.value = 0.0001 + ping * ping * 0.09;
    }
    if (this._airBp) {
      this._airBp.frequency.value = 780 + wobble * 220 + ping * 180 + Math.sin(now * 0.88) * 140;
    }
  }
}
