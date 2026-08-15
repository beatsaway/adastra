/**
 * Procedural door SFX
 * - Open: soft low hiss (minimal punch)
 * - Close: short wet hydraulic (playback sped up)
 */

import { getAudioCtx, resumeAudio } from "./ctx.js";

function noiseBuffer(ctx, seconds = 0.4, flavor = "pink") {
  const n = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < n; i++) {
    const white = Math.random() * 2 - 1;
    if (flavor === "white") {
      data[i] = white;
    } else if (flavor === "brown") {
      b0 = (b0 + white * 0.02) * 0.996;
      data[i] = b0 * 3.5;
    } else {
      b0 = 0.997 * b0 + white * 0.04;
      b1 = 0.985 * b1 + white * 0.08;
      b2 = 0.95 * b2 + white * 0.12;
      data[i] = (white * 0.25 + b0 + b1 + b2) * 0.5;
    }
  }
  return buf;
}

/** Open — soft mid hiss (not too high), louder */
export function playDoorOpen() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  void resumeAudio();

  const t0 = ctx.currentTime;
  const gain = 0.26;
  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(ctx.destination);

  const thump = ctx.createOscillator();
  thump.type = "sine";
  thump.frequency.setValueAtTime(48, t0);
  thump.frequency.exponentialRampToValueAtTime(30, t0 + 0.12);
  const tg = ctx.createGain();
  tg.gain.setValueAtTime(0.0001, t0);
  tg.gain.linearRampToValueAtTime(gain * 0.16, t0 + 0.05);
  tg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
  thump.connect(tg);
  tg.connect(master);
  thump.start(t0);
  thump.stop(t0 + 0.18);

  const tailDur = 0.55;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, tailDur, "brown");
  src.playbackRate.value = 1.08;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 0.35;
  bp.frequency.setValueAtTime(280, t0);
  bp.frequency.exponentialRampToValueAtTime(520, t0 + 0.1);
  bp.frequency.exponentialRampToValueAtTime(200, t0 + tailDur);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(1100, t0);
  lp.frequency.exponentialRampToValueAtTime(220, t0 + tailDur);
  lp.Q.value = 0.4;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(gain * 0.55, t0 + 0.08);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + tailDur);
  src.connect(bp);
  bp.connect(lp);
  lp.connect(g);
  g.connect(master);
  src.start(t0);
}

/** Close — short wet hydraulic, louder */
export function playDoorClose() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  void resumeAudio();

  const t0 = ctx.currentTime;
  const rate = 3.1;
  const dur = 0.34;
  const gain = 0.11;
  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(ctx.destination);

  const thump = ctx.createOscillator();
  thump.type = "sine";
  thump.frequency.setValueAtTime(160, t0);
  thump.frequency.exponentialRampToValueAtTime(95, t0 + 0.06);
  const tg = ctx.createGain();
  tg.gain.setValueAtTime(0.0001, t0);
  tg.gain.linearRampToValueAtTime(gain * 0.2, t0 + 0.015);
  tg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08);
  thump.connect(tg);
  tg.connect(master);
  thump.start(t0);
  thump.stop(t0 + 0.09);

  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, dur * rate, "brown");
  src.playbackRate.value = rate;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(1600, t0);
  lp.frequency.exponentialRampToValueAtTime(700, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(gain * 0.85, t0 + 0.025);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(lp);
  lp.connect(g);
  g.connect(master);
  src.start(t0);

  const air = ctx.createBufferSource();
  air.buffer = noiseBuffer(ctx, dur * 0.55 * rate, "pink");
  air.playbackRate.value = rate;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 2600;
  const ag = ctx.createGain();
  ag.gain.setValueAtTime(0.0001, t0);
  ag.gain.linearRampToValueAtTime(gain * 0.22, t0 + 0.02);
  ag.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * 0.55);
  air.connect(hp);
  hp.connect(ag);
  ag.connect(master);
  air.start(t0);
}

/** Locked hatch — flat digital alert (two short square buzzes) */
export function playDoorDenied() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  void resumeAudio();

  const t0 = ctx.currentTime;
  const gain = 0.028;
  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(ctx.destination);

  // Same pitch twice, hard on/off — simple system error, not a musical thud
  const beeps = [0, 0.11];
  for (const at of beeps) {
    const t = t0 + at;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(440, t);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.setValueAtTime(gain, t + 0.004);
    g.gain.setValueAtTime(gain, t + 0.055);
    g.gain.setValueAtTime(0.0001, t + 0.065);
    osc.connect(lp);
    lp.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + 0.08);
  }
}

/** Door open — short digital access-granted chirp (square, not sine/droplet) */
export function playDoorAuth() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  void resumeAudio();

  const t0 = ctx.currentTime;
  const gain = 0.018;
  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(ctx.destination);

  // Two stepped square beeps — badge / lockpad OK (hard edges, no sine drip)
  const steps = [
    { f: 980, at: 0, dur: 0.055 },
    { f: 1310, at: 0.06, dur: 0.07 },
  ];
  for (const s of steps) {
    const t = t0 + s.at;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(s.f, t);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 3200;
    lp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
    g.gain.setValueAtTime(gain * 0.85, t + s.dur * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, t + s.dur);
    osc.connect(lp);
    lp.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + s.dur + 0.02);
  }
}

/**
 * Satisfying cyber confirm — door unlock / room SOS restored.
 * Rising digital ladder + soft bloom + sparkle.
 */
export function playCyberSuccess() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  void resumeAudio();

  const t0 = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(ctx.destination);

  // Soft low bloom
  const bloom = ctx.createOscillator();
  bloom.type = "sine";
  bloom.frequency.setValueAtTime(110, t0);
  bloom.frequency.exponentialRampToValueAtTime(70, t0 + 0.28);
  const bg = ctx.createGain();
  bg.gain.setValueAtTime(0.0001, t0);
  bg.gain.linearRampToValueAtTime(0.055, t0 + 0.04);
  bg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
  bloom.connect(bg);
  bg.connect(master);
  bloom.start(t0);
  bloom.stop(t0 + 0.34);

  // Rising square ladder (access granted)
  const steps = [
    { f: 620, at: 0.02, dur: 0.07, g: 0.028 },
    { f: 880, at: 0.08, dur: 0.07, g: 0.03 },
    { f: 1170, at: 0.14, dur: 0.08, g: 0.032 },
    { f: 1560, at: 0.21, dur: 0.14, g: 0.036 },
  ];
  for (const s of steps) {
    const t = t0 + s.at;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(s.f, t);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(4200, t);
    lp.frequency.exponentialRampToValueAtTime(2400, t + s.dur);
    lp.Q.value = 0.85;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(s.g, t + 0.008);
    g.gain.setValueAtTime(s.g * 0.75, t + s.dur * 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + s.dur);
    osc.connect(lp);
    lp.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + s.dur + 0.03);
  }

  // High shimmer (cyber sparkle)
  const spark = ctx.createBufferSource();
  spark.buffer = noiseBuffer(ctx, 0.22, "pink");
  spark.playbackRate.value = 1.35;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 3800;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(5200, t0 + 0.12);
  bp.frequency.exponentialRampToValueAtTime(7800, t0 + 0.28);
  bp.Q.value = 1.2;
  const sg = ctx.createGain();
  sg.gain.setValueAtTime(0.0001, t0 + 0.1);
  sg.gain.linearRampToValueAtTime(0.022, t0 + 0.16);
  sg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.34);
  spark.connect(hp);
  hp.connect(bp);
  bp.connect(sg);
  sg.connect(master);
  spark.start(t0 + 0.1);
  spark.stop(t0 + 0.36);

  // Final resolve ping
  const ping = ctx.createOscillator();
  ping.type = "triangle";
  ping.frequency.setValueAtTime(2090, t0 + 0.3);
  ping.frequency.exponentialRampToValueAtTime(1680, t0 + 0.48);
  const pg = ctx.createGain();
  pg.gain.setValueAtTime(0.0001, t0 + 0.3);
  pg.gain.linearRampToValueAtTime(0.024, t0 + 0.32);
  pg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.52);
  ping.connect(pg);
  pg.connect(master);
  ping.start(t0 + 0.3);
  ping.stop(t0 + 0.55);
}

/** Sleep capsule open / close — servo + hiss + latch. */
export function playPodToggle(kind) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  void resumeAudio();

  const t0 = ctx.currentTime;
  const opening = kind !== "close";
  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(ctx.destination);

  const servo = ctx.createOscillator();
  servo.type = "sawtooth";
  if (opening) {
    servo.frequency.setValueAtTime(210, t0);
    servo.frequency.exponentialRampToValueAtTime(420, t0 + 0.22);
  } else {
    servo.frequency.setValueAtTime(380, t0);
    servo.frequency.exponentialRampToValueAtTime(160, t0 + 0.2);
  }
  const slp = ctx.createBiquadFilter();
  slp.type = "lowpass";
  slp.frequency.value = opening ? 1400 : 900;
  const sg = ctx.createGain();
  sg.gain.setValueAtTime(0.0001, t0);
  sg.gain.exponentialRampToValueAtTime(0.055, t0 + 0.012);
  sg.gain.exponentialRampToValueAtTime(0.0001, t0 + (opening ? 0.28 : 0.24));
  servo.connect(slp);
  slp.connect(sg);
  sg.connect(master);
  servo.start(t0);
  servo.stop(t0 + 0.3);

  const hiss = ctx.createBufferSource();
  hiss.buffer = noiseBuffer(ctx, opening ? 0.4 : 0.3, "pink");
  hiss.playbackRate.value = opening ? 1.28 : 0.88;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 0.6;
  if (opening) {
    bp.frequency.setValueAtTime(640, t0);
    bp.frequency.exponentialRampToValueAtTime(1760, t0 + 0.24);
  } else {
    bp.frequency.setValueAtTime(1500, t0);
    bp.frequency.exponentialRampToValueAtTime(380, t0 + 0.22);
  }
  const hg = ctx.createGain();
  hg.gain.setValueAtTime(0.0001, t0);
  hg.gain.linearRampToValueAtTime(opening ? 0.16 : 0.18, t0 + 0.03);
  hg.gain.exponentialRampToValueAtTime(0.0001, t0 + (opening ? 0.4 : 0.3));
  hiss.connect(bp);
  bp.connect(hg);
  hg.connect(master);
  hiss.start(t0);

  const click = ctx.createOscillator();
  click.type = "triangle";
  const cAt = opening ? 0.02 : 0.16;
  click.frequency.setValueAtTime(opening ? 320 : 140, t0 + cAt);
  click.frequency.exponentialRampToValueAtTime(opening ? 110 : 55, t0 + cAt + 0.09);
  const cg = ctx.createGain();
  cg.gain.setValueAtTime(0.0001, t0 + cAt);
  cg.gain.linearRampToValueAtTime(opening ? 0.07 : 0.09, t0 + cAt + 0.01);
  cg.gain.exponentialRampToValueAtTime(0.0001, t0 + cAt + 0.12);
  click.connect(cg);
  cg.connect(master);
  click.start(t0 + cAt);
  click.stop(t0 + cAt + 0.14);
}
