/**
 * Waiting-NPC toys — CRT think ticks + metallic poke bonk.
 */

import { getAudioCtx, resumeAudio, busOut } from "./ctx.js?v=20260817al";

function rand(a, b) {
  return a + Math.random() * (b - a);
}

/** Soft CRT blip when a think-dot appears. Pitch is a fresh random each tick. */
export function playThinkDot(count = 1) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  void resumeAudio();
  const t0 = ctx.currentTime;
  const hz = rand(420, 1480);

  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(busOut("sfx") || ctx.destination);

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
  master.connect(busOut("sfx") || ctx.destination);

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

/** Silly metallic gears when an NPC is poked enough times in a row. */
export function playNpcGearFrenzy(seconds = 2.6) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  void resumeAudio();
  const t0 = ctx.currentTime;
  const dur = Math.max(1.4, seconds);

  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(busOut("sfx") || ctx.destination);

  const whir = ctx.createOscillator();
  whir.type = "sawtooth";
  whir.frequency.setValueAtTime(92, t0);
  whir.frequency.linearRampToValueAtTime(148, t0 + dur * 0.45);
  whir.frequency.linearRampToValueAtTime(70, t0 + dur);
  const wlp = ctx.createBiquadFilter();
  wlp.type = "lowpass";
  wlp.frequency.value = 900;
  const wg = ctx.createGain();
  wg.gain.setValueAtTime(0.0001, t0);
  wg.gain.exponentialRampToValueAtTime(0.045, t0 + 0.06);
  wg.gain.setValueAtTime(0.04, t0 + dur * 0.7);
  wg.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  whir.connect(wlp);
  wlp.connect(wg);
  wg.connect(master);
  whir.start(t0);
  whir.stop(t0 + dur + 0.02);

  const ticks = Math.floor(dur * 14);
  for (let i = 0; i < ticks; i++) {
    const at = t0 + (i / ticks) * dur + rand(0, 0.03);
    const click = ctx.createOscillator();
    click.type = i % 3 === 0 ? "square" : "triangle";
    const hz = rand(380, 980) * (i % 2 ? 1.15 : 0.85);
    click.frequency.setValueAtTime(hz, at);
    click.frequency.exponentialRampToValueAtTime(hz * 0.7, at + 0.05);
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.0001, at);
    cg.gain.exponentialRampToValueAtTime(0.055, at + 0.004);
    cg.gain.exponentialRampToValueAtTime(0.0001, at + 0.055);
    click.connect(cg);
    cg.connect(master);
    click.start(at);
    click.stop(at + 0.07);
  }

  const n = Math.max(1, Math.floor(ctx.sampleRate * 0.18));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  for (let k = 0; k < 5; k++) {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rand(0.7, 1.6);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = rand(900, 2400);
    bp.Q.value = 6;
    const ng = ctx.createGain();
    const at = t0 + rand(0.05, dur * 0.85);
    ng.gain.setValueAtTime(0.0001, at);
    ng.gain.exponentialRampToValueAtTime(0.12, at + 0.006);
    ng.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
    src.connect(bp);
    bp.connect(ng);
    ng.connect(master);
    src.start(at);
    src.stop(at + 0.14);
  }
}
