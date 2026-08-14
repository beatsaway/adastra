/**
 * Hologram UI SFX — hover ticks + Info Hub doorway electric hiss.
 */

import { getAudioCtx, resumeAudio } from "./ctx.js";

let lastHoverAt = 0;

/** Soft UI tick when aiming at clickable holo text (unlock / debug / desk). */
export function playHoloHover() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const now = performance.now();
  if (now - lastHoverAt < 90) return;
  lastHoverAt = now;
  void resumeAudio();

  const t0 = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(ctx.destination);

  // Short high soft blip
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(1480, t0);
  osc.frequency.exponentialRampToValueAtTime(920, t0 + 0.07);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.0001, t0);
  og.gain.exponentialRampToValueAtTime(0.028, t0 + 0.008);
  og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
  osc.connect(og);
  og.connect(master);
  osc.start(t0);
  osc.stop(t0 + 0.1);

  // Tiny glass crackle
  const n = Math.max(1, Math.floor(ctx.sampleRate * 0.06));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 2400;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.0001, t0);
  ng.gain.exponentialRampToValueAtTime(0.018, t0 + 0.004);
  ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.055);
  src.connect(hp);
  hp.connect(ng);
  ng.connect(master);
  src.start(t0);
  src.stop(t0 + 0.06);
}

/**
 * Subtle static / electric hiss while walking through Info Hub doorway holos.
 * Call ensure() once after audio unlock; update(dt, dist) each frame.
 */
export class InfoHubHoloHiss {
  constructor() {
    this._ready = false;
    this._level = 0;
    /** @type {GainNode | null} */
    this._gain = null;
    /** @type {BiquadFilterNode | null} */
    this._bp = null;
  }

  async ensure() {
    if (this._ready) return;
    const ctx = await resumeAudio();
    if (!ctx || this._ready) return;

    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    this._gain = master;

    // Looping pink-ish noise as electric static
    const seconds = 0.5;
    const n = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    for (let i = 0; i < n; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.045;
      b1 = 0.98 * b1 + white * 0.09;
      data[i] = (white * 0.2 + b0 + b1) * 0.55;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2800;
    bp.Q.value = 0.55;
    this._bp = bp;

    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 900;

    const ng = ctx.createGain();
    ng.gain.value = 1.15;

    // Soft mid buzz under the hiss
    const buzz = ctx.createOscillator();
    buzz.type = "sawtooth";
    buzz.frequency.value = 68;
    const buzzLp = ctx.createBiquadFilter();
    buzzLp.type = "lowpass";
    buzzLp.frequency.value = 180;
    const bg = ctx.createGain();
    bg.gain.value = 0.22;

    src.connect(hp);
    hp.connect(bp);
    bp.connect(ng);
    ng.connect(master);

    buzz.connect(buzzLp);
    buzzLp.connect(bg);
    bg.connect(master);

    src.start();
    buzz.start();
    this._ready = true;
  }

  /**
   * @param {number} dt
   * @param {number} dist distance to nearest Info Hub holo (world units)
   */
  update(dt, dist) {
    if (!this._ready || !this._gain) return;
    // Tight — only when walking through the doorway hologram
    const near = 0.55;
    const far = 1.35;
    let target = 0;
    if (Number.isFinite(dist)) {
      if (dist < near) target = 1;
      else if (dist < far) target = 1 - (dist - near) / (far - near);
    }
    this._level += (target - this._level) * Math.min(1, dt * 7);
    // Subtle peak
    this._gain.gain.value = this._level * 0.12;
    if (this._bp && this._level > 0.02) {
      const t = this._level;
      this._bp.frequency.value = 2200 + t * 900 + Math.sin(performance.now() * 0.012) * 180;
    }
  }
}
