/**
 * Enter Ship — hatch thump + airlock whoosh. Scheduled once, no per-frame work.
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

export function playEnterShip() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  void resumeAudio();

  const t0 = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(busOut("sfx") || ctx.destination);

  const thump = ctx.createOscillator();
  thump.type = "sine";
  thump.frequency.setValueAtTime(62, t0);
  thump.frequency.exponentialRampToValueAtTime(28, t0 + 0.28);
  const tg = ctx.createGain();
  tg.gain.setValueAtTime(0.0001, t0);
  tg.gain.exponentialRampToValueAtTime(0.2, t0 + 0.02);
  tg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.38);
  thump.connect(tg);
  tg.connect(master);
  thump.start(t0);
  thump.stop(t0 + 0.4);

  const whoosh = ctx.createBufferSource();
  whoosh.buffer = brownNoise(ctx, 1.15);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 0.45;
  bp.frequency.setValueAtTime(180, t0);
  bp.frequency.exponentialRampToValueAtTime(720, t0 + 0.45);
  bp.frequency.exponentialRampToValueAtTime(140, t0 + 1.15);
  const wg = ctx.createGain();
  wg.gain.setValueAtTime(0.0001, t0);
  wg.gain.linearRampToValueAtTime(0.22, t0 + 0.18);
  wg.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.15);
  whoosh.connect(bp);
  bp.connect(wg);
  wg.connect(master);
  whoosh.start(t0);

  const ping = ctx.createOscillator();
  ping.type = "triangle";
  ping.frequency.setValueAtTime(520, t0 + 0.42);
  ping.frequency.exponentialRampToValueAtTime(210, t0 + 0.85);
  const pg = ctx.createGain();
  pg.gain.setValueAtTime(0.0001, t0 + 0.42);
  pg.gain.exponentialRampToValueAtTime(0.045, t0 + 0.45);
  pg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
  ping.connect(pg);
  pg.connect(master);
  ping.start(t0 + 0.42);
  ping.stop(t0 + 0.95);
}
