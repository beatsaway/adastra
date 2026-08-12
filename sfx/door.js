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

/** Locked hatch — plain access-denied beep (not cute) */
export function playDoorDenied() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  void resumeAudio();

  const t0 = ctx.currentTime;
  const gain = 0.05;
  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(ctx.destination);

  // Single short mid buzz, then a lower thud — card-reader reject
  const osc = ctx.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(180, t0);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 900;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.11);
  osc.connect(lp);
  lp.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + 0.13);

  const osc2 = ctx.createOscillator();
  osc2.type = "square";
  osc2.frequency.setValueAtTime(95, t0 + 0.12);
  const lp2 = ctx.createBiquadFilter();
  lp2.type = "lowpass";
  lp2.frequency.value = 500;
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.0001, t0 + 0.12);
  g2.gain.exponentialRampToValueAtTime(gain * 0.55, t0 + 0.13);
  g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
  osc2.connect(lp2);
  lp2.connect(g2);
  g2.connect(master);
  osc2.start(t0 + 0.12);
  osc2.stop(t0 + 0.24);
}

/** Door open — plain access-granted beep (not cute) */
export function playDoorAuth() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  void resumeAudio();

  const t0 = ctx.currentTime;
  const gain = 0.036;
  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(ctx.destination);

  // One flat confirmation tone — like a badge reader OK
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(740, t0);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + 0.1);
}
