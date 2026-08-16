/**
 * Garden tree teleport — ~5s beam + shimmer, then a soft arrival chime.
 */

import { getAudioCtx, resumeAudio, busOut } from "./ctx.js?v=20260817al";

function brownNoise(ctx, seconds) {
  const n = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let b = 0;
  for (let i = 0; i < n; i++) {
    b = (b + (Math.random() * 2 - 1) * 0.02) * 0.996;
    data[i] = b * 3.4;
  }
  return buf;
}

function swellSine(ctx, dest, t0, freq, peak, attack, dur) {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, t0);
  osc.frequency.exponentialRampToValueAtTime(freq * 1.08, t0 + dur * 0.85);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(dest);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export function playTreeTeleport() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  void resumeAudio();

  const t0 = ctx.currentTime;
  const dur = 5;
  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(busOut("sfx") || ctx.destination);

  swellSine(ctx, master, t0, 196, 0.055, 0.45, dur);
  swellSine(ctx, master, t0, 392, 0.032, 0.55, dur);
  swellSine(ctx, master, t0, 587, 0.018, 0.7, dur);

  const whoosh = ctx.createBufferSource();
  whoosh.buffer = brownNoise(ctx, 1.6);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 0.55;
  bp.frequency.setValueAtTime(160, t0);
  bp.frequency.exponentialRampToValueAtTime(980, t0 + 0.7);
  bp.frequency.exponentialRampToValueAtTime(220, t0 + 1.55);
  const wg = ctx.createGain();
  wg.gain.setValueAtTime(0.0001, t0);
  wg.gain.linearRampToValueAtTime(0.16, t0 + 0.22);
  wg.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.55);
  whoosh.connect(bp);
  bp.connect(wg);
  wg.connect(master);
  whoosh.start(t0);

  for (let i = 0; i < 7; i++) {
    const at = t0 + 0.35 + i * 0.48;
    const ping = ctx.createOscillator();
    ping.type = "sine";
    const f = 880 + (i % 3) * 220;
    ping.frequency.setValueAtTime(f, at);
    ping.frequency.exponentialRampToValueAtTime(f * 1.35, at + 0.16);
    const pg = ctx.createGain();
    pg.gain.setValueAtTime(0.0001, at);
    pg.gain.exponentialRampToValueAtTime(0.028, at + 0.02);
    pg.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
    ping.connect(pg);
    pg.connect(master);
    ping.start(at);
    ping.stop(at + 0.24);
  }

  const land = t0 + 4.15;
  const landWhoosh = ctx.createBufferSource();
  landWhoosh.buffer = brownNoise(ctx, 0.85);
  const lbp = ctx.createBiquadFilter();
  lbp.type = "lowpass";
  lbp.frequency.setValueAtTime(1400, land);
  lbp.frequency.exponentialRampToValueAtTime(280, land + 0.7);
  const lg = ctx.createGain();
  lg.gain.setValueAtTime(0.0001, land);
  lg.gain.linearRampToValueAtTime(0.12, land + 0.08);
  lg.gain.exponentialRampToValueAtTime(0.0001, land + 0.8);
  landWhoosh.connect(lbp);
  lbp.connect(lg);
  lg.connect(master);
  landWhoosh.start(land);

  const chord = [523.25, 659.25, 783.99];
  for (const f of chord) {
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(f, land);
    osc.frequency.exponentialRampToValueAtTime(f * 0.97, land + 0.7);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, land);
    g.gain.exponentialRampToValueAtTime(0.04, land + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, land + 0.75);
    osc.connect(g);
    g.connect(master);
    osc.start(land);
    osc.stop(land + 0.8);
  }
}
