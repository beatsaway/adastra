/**
 * Force-field / electric shock one-shot.
 */

import { getAudioCtx, resumeAudio, busOut } from "./ctx.js?v=20260817al";

/** Cached raw white noise — generate once, reuse. */
let _whiteBuf = null;
function whiteNoise(ctx, seconds = 0.5) {
  if (_whiteBuf && _whiteBuf.sampleRate === ctx.sampleRate) return _whiteBuf;
  const n = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  _whiteBuf = buf;
  return buf;
}

function noiseBuffer(ctx, seconds = 0.28) {
  return whiteNoise(ctx, Math.max(seconds, 0.5));
}

/** Gated / filtered white-noise spark. Cheap: 1 source, 2 filters, 1 LFO. */
function playGatedNoiseSpark({
  dur = 0.28,
  amp = 0.1,
  hpHz = 900,
  bp0 = 2600,
  bp1 = 1100,
  gateHz = 24,
} = {}) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  void resumeAudio();
  const t0 = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = whiteNoise(ctx);
  src.loop = true;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = hpHz;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 0.85;
  bp.frequency.setValueAtTime(bp0, t0);
  bp.frequency.exponentialRampToValueAtTime(Math.max(200, bp1), t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(amp, t0 + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  const lfo = ctx.createOscillator();
  lfo.type = "square";
  lfo.frequency.value = gateHz;
  const lfoG = ctx.createGain();
  lfoG.gain.value = amp * 0.55;
  lfo.connect(lfoG);
  lfoG.connect(g.gain);
  src.connect(hp);
  hp.connect(bp);
  bp.connect(g);
  g.connect(busOut("sfx") || ctx.destination);
  src.start(t0);
  src.stop(t0 + dur);
  lfo.start(t0);
  lfo.stop(t0 + dur);
}

/** Force-field hit — white noise, band-sweep, square gate. */
export function playElectricShock() {
  playGatedNoiseSpark({
    dur: 0.36,
    amp: 0.12,
    hpHz: 700,
    bp0: 2800,
    bp1: 850,
    gateHz: 21,
  });
}

/** Machine digital glitch layered on the south-field bounce. */
export function playDigitalGlitch() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  void resumeAudio();

  const t0 = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(busOut("sfx") || ctx.destination);

  const blips = [
    { f: 1880, at: 0.02, dur: 0.045, g: 0.028 },
    { f: 940, at: 0.06, dur: 0.03, g: 0.022 },
    { f: 2460, at: 0.1, dur: 0.055, g: 0.03 },
    { f: 620, at: 0.15, dur: 0.028, g: 0.02 },
    { f: 3120, at: 0.19, dur: 0.04, g: 0.024 },
    { f: 1480, at: 0.25, dur: 0.07, g: 0.026 },
  ];
  for (const s of blips) {
    const t = t0 + s.at;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(s.f, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(180, s.f * 0.42), t + s.dur);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = s.f;
    bp.Q.value = 2.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(s.g, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + s.dur);
    osc.connect(bp);
    bp.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + s.dur + 0.02);
  }

  const n = Math.max(1, Math.floor(ctx.sampleRate * 0.34));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let hold = 0;
  let left = 0;
  for (let i = 0; i < n; i++) {
    if (left <= 0) {
      hold = Math.random() * 2 - 1;
      left = 18 + ((Math.random() * 70) | 0);
    }
    left -= 1;
    const gate = Math.random() > 0.18 ? 1 : 0;
    data[i] = hold * gate * (1 - i / n);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 900;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.0001, t0);
  ng.gain.exponentialRampToValueAtTime(0.055, t0 + 0.012);
  ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.34);
  src.connect(hp);
  hp.connect(ng);
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
  master.connect(busOut("sfx") || ctx.destination);

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
  master.connect(busOut("sfx") || ctx.destination);

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

/** Quiet bezel tick for SOS wall-monitor sparks. */
export function playMonitorSpark(gain = 1) {
  const g = Math.max(0.25, Math.min(1, gain));
  playGatedNoiseSpark({
    dur: 0.09,
    amp: 0.028 * g,
    hpHz: 1600,
    bp0: 3200 + Math.random() * 600,
    bp1: 1400,
    gateHz: 36,
  });
}

/** Quiet fixture crackle for SOS ceiling sparks. */
export function playCeilingSpark(gain = 1) {
  const g = Math.max(0.25, Math.min(1, gain));
  playGatedNoiseSpark({
    dur: 0.1,
    amp: 0.022 * g,
    hpHz: 2000,
    bp0: 3800,
    bp1: 1600,
    gateHz: 32,
  });
}
