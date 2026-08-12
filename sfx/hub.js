/**
 * Hub / year-orb procedural tones — short one-shots, few oscillators.
 */

import { getAudioCtx, resumeAudio } from "./ctx.js";

function rnd(a, b) {
  return a + Math.random() * (b - a);
}

function playToneBurst({
  freqs,
  dur = 0.35,
  gain = 0.08,
  type = "sine",
  slide = 0,
} = {}) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  void resumeAudio();
  const t0 = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, t0);
  master.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  master.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  master.connect(ctx.destination);

  for (let i = 0; i < freqs.length; i++) {
    const f0 = freqs[i];
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t0);
    if (slide) {
      const f1 = Math.max(40, f0 * (1 + slide));
      osc.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    }
    const g = ctx.createGain();
    g.gain.value = 1 / Math.max(1, freqs.length);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }
}

/** Approach hub — two soft sines (random low + high), both swell. */
export function playYearReveal() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  void resumeAudio();
  const t0 = ctx.currentTime;
  const dur = 0.85;
  const lowHz = rnd(140, 220);
  const highHz = rnd(480, 720);

  function swellSine(freq, peakGain, attack = 0.18) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(freq * rnd(1.04, 1.12), t0 + dur * 0.9);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peakGain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  swellSine(lowHz, 0.07, 0.2);
  swellSine(highHz, 0.045, 0.24);
}

/** Leave hub — fold back down */
export function playYearCollapse() {
  playToneBurst({
    freqs: [784, 523.25, 392],
    dur: 0.36,
    gain: 0.06,
    type: "sine",
    slide: -0.18,
  });
}

/** PC look-aim hover — longer soft tail, still 2 osc max */
export function playYearHover() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  void resumeAudio();
  const t0 = ctx.currentTime;
  const dur = rnd(0.38, 0.52);
  const base = rnd(520, 780);
  const third = base * rnd(1.22, 1.28);
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, t0);
  master.gain.exponentialRampToValueAtTime(rnd(0.075, 0.1), t0 + 0.018);
  master.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  master.connect(ctx.destination);

  const a = ctx.createOscillator();
  a.type = "sine";
  a.frequency.setValueAtTime(base, t0);
  a.frequency.exponentialRampToValueAtTime(base * rnd(1.03, 1.08), t0 + dur);
  const ag = ctx.createGain();
  ag.gain.value = 0.65;
  a.connect(ag);
  ag.connect(master);
  a.start(t0);
  a.stop(t0 + dur + 0.02);

  const b = ctx.createOscillator();
  b.type = "sine";
  b.frequency.setValueAtTime(third, t0);
  b.frequency.exponentialRampToValueAtTime(third * rnd(1.02, 1.06), t0 + dur);
  const bg = ctx.createGain();
  bg.gain.setValueAtTime(0.0001, t0);
  bg.gain.exponentialRampToValueAtTime(0.4, t0 + 0.04);
  bg.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  b.connect(bg);
  bg.connect(master);
  b.start(t0);
  b.stop(t0 + dur + 0.02);
}

/** Click / tap pick year — 3-tone swell (soft attack) */
export function playYearPick() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  void resumeAudio();
  const t0 = ctx.currentTime;
  const dur = 0.95;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, t0);
  master.gain.linearRampToValueAtTime(0.22, t0 + 0.14);
  master.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  master.connect(ctx.destination);

  function swellTone(freq0, freq1, peak, attack, fade) {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(freq0, t0);
    o.frequency.exponentialRampToValueAtTime(freq1, t0 + dur * 0.85);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + fade);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + fade + 0.02);
  }

  swellTone(440, 523, 0.5, 0.16, 0.7);
  swellTone(880, 990, 0.55, 0.18, 0.85);
  swellTone(1320, 1175, 0.38, 0.22, dur);
}
