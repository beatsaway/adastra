/**
 * Force-field / electric shock one-shot.
 */

import { getAudioCtx, resumeAudio } from "./ctx.js";

function noiseBuffer(ctx, seconds = 0.28) {
  const n = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let b0 = 0;
  for (let i = 0; i < n; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.82 * b0 + white * 0.35;
    const crackle = Math.random() > 0.82 ? white * 1.4 : white * 0.35;
    data[i] = (b0 + crackle) * (1 - i / n);
  }
  return buf;
}

/** Short zap + crackle when the south gate bounces the captain. */
export function playElectricShock() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  void resumeAudio();

  const t0 = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(ctx.destination);

  // Body zap — saw falling through mid
  const zap = ctx.createOscillator();
  zap.type = "sawtooth";
  zap.frequency.setValueAtTime(1640, t0);
  zap.frequency.exponentialRampToValueAtTime(180, t0 + 0.22);
  const zlp = ctx.createBiquadFilter();
  zlp.type = "lowpass";
  zlp.frequency.setValueAtTime(4200, t0);
  zlp.frequency.exponentialRampToValueAtTime(700, t0 + 0.24);
  const zg = ctx.createGain();
  zg.gain.setValueAtTime(0.0001, t0);
  zg.gain.exponentialRampToValueAtTime(0.09, t0 + 0.012);
  zg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
  zap.connect(zlp);
  zlp.connect(zg);
  zg.connect(master);
  zap.start(t0);
  zap.stop(t0 + 0.3);

  // High spark overlay
  const spark = ctx.createOscillator();
  spark.type = "square";
  spark.frequency.setValueAtTime(2400, t0);
  spark.frequency.exponentialRampToValueAtTime(420, t0 + 0.09);
  const sg = ctx.createGain();
  sg.gain.setValueAtTime(0.0001, t0);
  sg.gain.exponentialRampToValueAtTime(0.035, t0 + 0.006);
  sg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.11);
  spark.connect(sg);
  sg.connect(master);
  spark.start(t0);
  spark.stop(t0 + 0.12);

  // Noise crackle
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, 0.32);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1400;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 2800;
  bp.Q.value = 0.7;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.0001, t0);
  ng.gain.exponentialRampToValueAtTime(0.11, t0 + 0.008);
  ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
  src.connect(hp);
  hp.connect(bp);
  bp.connect(ng);
  ng.connect(master);
  src.start(t0);
}

/** Low hull rumble for cockpit SOS quakes. */
export function playHullRumble() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  void resumeAudio();

  const t0 = ctx.currentTime;
  const dur = 0.82;
  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(ctx.destination);

  const thump = ctx.createOscillator();
  thump.type = "sine";
  thump.frequency.setValueAtTime(52, t0);
  thump.frequency.exponentialRampToValueAtTime(28, t0 + dur);
  const tg = ctx.createGain();
  tg.gain.setValueAtTime(0.0001, t0);
  tg.gain.exponentialRampToValueAtTime(0.16, t0 + 0.04);
  tg.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  thump.connect(tg);
  tg.connect(master);
  thump.start(t0);
  thump.stop(t0 + dur + 0.02);

  const sub = ctx.createOscillator();
  sub.type = "triangle";
  sub.frequency.setValueAtTime(38, t0);
  sub.frequency.exponentialRampToValueAtTime(22, t0 + dur * 0.9);
  const sg = ctx.createGain();
  sg.gain.setValueAtTime(0.0001, t0);
  sg.gain.linearRampToValueAtTime(0.055, t0 + 0.06);
  sg.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  sub.connect(sg);
  sg.connect(master);
  sub.start(t0);
  sub.stop(t0 + dur + 0.02);

  const n = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let b0 = 0;
  for (let i = 0; i < n; i++) {
    const white = Math.random() * 2 - 1;
    b0 = (b0 + white * 0.02) * 0.997;
    data[i] = b0 * 3.2 * (1 - i / n);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(180, t0);
  lp.frequency.exponentialRampToValueAtTime(70, t0 + dur);
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.0001, t0);
  ng.gain.linearRampToValueAtTime(0.22, t0 + 0.05);
  ng.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(lp);
  lp.connect(ng);
  ng.connect(master);
  src.start(t0);
}

/** Glass hatch thud when the cockpit door will not open. */
export function playGlassDenied() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  void resumeAudio();

  const t0 = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(ctx.destination);

  const knock = ctx.createOscillator();
  knock.type = "sine";
  knock.frequency.setValueAtTime(210, t0);
  knock.frequency.exponentialRampToValueAtTime(78, t0 + 0.16);
  const kg = ctx.createGain();
  kg.gain.setValueAtTime(0.0001, t0);
  kg.gain.exponentialRampToValueAtTime(0.16, t0 + 0.01);
  kg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
  knock.connect(kg);
  kg.connect(master);
  knock.start(t0);
  knock.stop(t0 + 0.22);

  const n = Math.max(1, Math.floor(ctx.sampleRate * 0.18));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1600;
  bp.Q.value = 0.8;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.0001, t0);
  ng.gain.exponentialRampToValueAtTime(0.09, t0 + 0.008);
  ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
  src.connect(bp);
  bp.connect(ng);
  ng.connect(master);
  src.start(t0);

  const buzz = ctx.createOscillator();
  buzz.type = "square";
  buzz.frequency.setValueAtTime(390, t0 + 0.05);
  const bg = ctx.createGain();
  bg.gain.setValueAtTime(0.0001, t0 + 0.05);
  bg.gain.setValueAtTime(0.04, t0 + 0.055);
  bg.gain.setValueAtTime(0.0001, t0 + 0.12);
  buzz.connect(bg);
  bg.connect(master);
  buzz.start(t0 + 0.05);
  buzz.stop(t0 + 0.14);
}

/** Quiet fixture crackle for SOS ceiling sparks. */
export function playCeilingSpark(gain = 1) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  void resumeAudio();

  const t0 = ctx.currentTime;
  const amp = 0.012 * Math.max(0.25, Math.min(1, gain));
  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(ctx.destination);

  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, 0.09);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 2200;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 3600;
  bp.Q.value = 1.1;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.0001, t0);
  ng.gain.exponentialRampToValueAtTime(amp, t0 + 0.004);
  ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
  src.connect(hp);
  hp.connect(bp);
  bp.connect(ng);
  ng.connect(master);
  src.start(t0);

  const tick = ctx.createOscillator();
  tick.type = "square";
  tick.frequency.setValueAtTime(2100 + Math.random() * 900, t0);
  tick.frequency.exponentialRampToValueAtTime(420, t0 + 0.05);
  const tg = ctx.createGain();
  tg.gain.setValueAtTime(0.0001, t0);
  tg.gain.exponentialRampToValueAtTime(amp * 0.7, t0 + 0.003);
  tg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.055);
  tick.connect(tg);
  tg.connect(master);
  tick.start(t0);
  tick.stop(t0 + 0.07);
}
