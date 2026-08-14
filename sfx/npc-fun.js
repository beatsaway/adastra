/**
 * Waiting-NPC toys — CRT think ticks + metallic poke bonk.
 */

import { getAudioCtx, resumeAudio } from "./ctx.js";

function rand(a, b) {
  return a + Math.random() * (b - a);
}

/** Soft CRT blip when a think-dot appears. Pitch steps with 1 / 2 / 3 dots. */
export function playThinkDot(count = 1) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  void resumeAudio();
  const t0 = ctx.currentTime;
  const n = Math.max(1, Math.min(3, count | 0));
  const hz = 720 + n * 220;

  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(ctx.destination);

  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(hz, t0);
  osc.frequency.exponentialRampToValueAtTime(hz * 0.72, t0 + 0.06);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 2400;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.05, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.07);
  osc.connect(lp);
  lp.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + 0.08);
}

/** Fun tin-robot clank when the captain pokes a waiting NPC. */
export function playNpcBonk() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  void resumeAudio();
  const t0 = ctx.currentTime;

  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(ctx.destination);

  const n = Math.max(1, Math.floor(ctx.sampleRate * 0.12));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = rand(1400, 2200);
  bp.Q.value = 4.5;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.0001, t0);
  ng.gain.exponentialRampToValueAtTime(0.16, t0 + 0.004);
  ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
  src.connect(bp);
  bp.connect(ng);
  ng.connect(master);
  src.start(t0);
  src.stop(t0 + 0.1);

  const partials = [rand(520, 680), rand(980, 1280), rand(1680, 2100)];
  for (let i = 0; i < partials.length; i++) {
    const osc = ctx.createOscillator();
    osc.type = i === 0 ? "triangle" : "sine";
    osc.frequency.setValueAtTime(partials[i], t0);
    osc.frequency.exponentialRampToValueAtTime(partials[i] * 0.86, t0 + 0.14);
    const g = ctx.createGain();
    const peak = 0.07 - i * 0.018;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + 0.18);
  }
}
