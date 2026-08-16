/**
 * Subtle proximity transformer hum (cockpit wall power boxes).
 * Very light CPU: 2 oscillators + soft noise, gain follows distance.
 */

import { getAudioCtx, resumeAudio, busOut } from "./ctx.js?v=20260817al";

export class ProximityTransformerHum {
  constructor() {
    this._ready = false;
    this._level = 0;
    /** @type {GainNode | null} */
    this._gain = null;
  }

  async ensure() {
    if (this._ready) return;
    const ctx = await resumeAudio();
    if (!ctx || this._ready) return;

    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(busOut("sfx") || ctx.destination);
    this._gain = master;

    // 120Hz transformer hum + harmonic
    const hum = ctx.createOscillator();
    hum.type = "sine";
    hum.frequency.value = 120;
    const hum2 = ctx.createOscillator();
    hum2.type = "sine";
    hum2.frequency.value = 240;

    const hg = ctx.createGain();
    hg.gain.value = 0.55;
    const h2g = ctx.createGain();
    h2g.gain.value = 0.18;
    hum.connect(hg);
    hum2.connect(h2g);
    hg.connect(master);
    h2g.connect(master);

    // Soft buzz (electrical grit)
    const n = Math.floor(ctx.sampleRate * 0.35);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * 0.28;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 360;
    bp.Q.value = 2;
    const ng = ctx.createGain();
    ng.gain.value = 0.2;
    src.connect(bp);
    bp.connect(ng);
    ng.connect(master);

    hum.start();
    hum2.start();
    src.start();
    this._ready = true;
  }

  /**
   * @param {number} dt
   * @param {number} dist distance to nearest box (world XZ)
   */
  update(dt, dist) {
    if (!this._ready || !this._gain) return;
    // Very close only
    const near = 1.25;
    const far = 2.15;
    let target = 0;
    if (dist < near) target = 1;
    else if (dist < far) target = 1 - (dist - near) / (far - near);
    this._level += (target - this._level) * Math.min(1, dt * 5);
    this._gain.gain.value = this._level * 0.04;
  }
}
