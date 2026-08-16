/**
 * Scene 1 solar-wind / energy-field bed.
 * Scheduled once on play — no per-frame work.
 */

import { getAudioCtx, resumeAudio, busOut } from "./ctx.js?v=20260817al";

let _noise = null;
let _master = null;
let _stopAt = 0;

function fieldNoise(ctx) {
  if (_noise && _noise.sampleRate === ctx.sampleRate) return _noise;
  const n = Math.max(1, Math.floor(ctx.sampleRate * 1.6));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  for (let i = 0; i < n; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.997 * b0 + white * 0.018;
    b1 = 0.94 * b1 + white * 0.08;
    data[i] = b0 * 3.6 + b1 * 0.22;
  }
  _noise = buf;
  return buf;
}

function killField() {
  const node = _master;
  _master = null;
  if (!node) return;
  try {
    node.disconnect();
  } catch (_) {}
}

export function stopScene1EnergyField() {
  const ctx = getAudioCtx();
  const node = _master;
  if (!ctx || !node) {
    killField();
    return;
  }
  const t = ctx.currentTime;
  try {
    node.gain.cancelScheduledValues(t);
    node.gain.setValueAtTime(Math.max(0.0001, node.gain.value), t);
    node.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  } catch (_) {}
  _stopAt = t + 0.4;
  setTimeout(killField, 420);
}

/** Big scary energy field under the Scene 1 clip (~8s). */
export function playScene1EnergyField() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  void resumeAudio();
  if (_master) stopScene1EnergyField();

  const t0 = ctx.currentTime;
  const dur = 8.1;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, t0);
  master.gain.exponentialRampToValueAtTime(1, t0 + 0.28);
  master.gain.setValueAtTime(1, t0 + dur - 1.15);
  master.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  master.connect(busOut("sfx") || ctx.destination);
  _master = master;
  _stopAt = t0 + dur + 0.05;

  // Sub pressure — the "something huge is happening" layer
  const sub = ctx.createOscillator();
  sub.type = "sine";
  sub.frequency.setValueAtTime(31, t0);
  sub.frequency.linearRampToValueAtTime(24, t0 + 3.2);
  sub.frequency.linearRampToValueAtTime(38, t0 + 5.4);
  sub.frequency.exponentialRampToValueAtTime(18, t0 + dur);
  const sg = ctx.createGain();
  sg.gain.setValueAtTime(0.0001, t0);
  sg.gain.exponentialRampToValueAtTime(0.2, t0 + 0.4);
  sg.gain.setValueAtTime(0.17, t0 + 4.2);
  sg.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  sub.connect(sg);
  sg.connect(master);
  sub.start(t0);
  sub.stop(t0 + dur + 0.02);

  const body = ctx.createOscillator();
  body.type = "triangle";
  body.frequency.setValueAtTime(47, t0);
  body.frequency.linearRampToValueAtTime(41, t0 + 2.8);
  body.frequency.linearRampToValueAtTime(62, t0 + 5.8);
  body.frequency.exponentialRampToValueAtTime(28, t0 + dur);
  const bg = ctx.createGain();
  bg.gain.setValueAtTime(0.0001, t0);
  bg.gain.linearRampToValueAtTime(0.07, t0 + 0.5);
  bg.gain.linearRampToValueAtTime(0.05, t0 + 4);
  bg.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  body.connect(bg);
  bg.connect(master);
  body.start(t0);
  body.stop(t0 + dur + 0.02);

  // Slow pulse so the field feels alive (one LFO, no JS)
  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 0.55;
  const lfoG = ctx.createGain();
  lfoG.gain.value = 0.045;
  lfo.connect(lfoG);
  lfoG.connect(sg.gain);
  lfo.start(t0);
  lfo.stop(t0 + dur);

  // Dark energy whoosh — looping brown noise, filter sweep
  const whoosh = ctx.createBufferSource();
  whoosh.buffer = fieldNoise(ctx);
  whoosh.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.Q.value = 0.7;
  lp.frequency.setValueAtTime(220, t0);
  lp.frequency.linearRampToValueAtTime(140, t0 + 2.1);
  lp.frequency.linearRampToValueAtTime(520, t0 + 4.6);
  lp.frequency.exponentialRampToValueAtTime(90, t0 + dur);
  const wg = ctx.createGain();
  wg.gain.setValueAtTime(0.0001, t0);
  wg.gain.exponentialRampToValueAtTime(0.34, t0 + 0.45);
  wg.gain.setValueAtTime(0.28, t0 + 5.2);
  wg.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  whoosh.connect(lp);
  lp.connect(wg);
  wg.connect(master);
  whoosh.start(t0);
  whoosh.stop(t0 + dur + 0.02);

  // Thin scary hiss / corona
  const hiss = ctx.createBufferSource();
  hiss.buffer = fieldNoise(ctx);
  hiss.loop = true;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 2400;
  const hg = ctx.createGain();
  hg.gain.setValueAtTime(0.0001, t0);
  hg.gain.linearRampToValueAtTime(0.045, t0 + 0.8);
  hg.gain.linearRampToValueAtTime(0.03, t0 + 5);
  hg.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  hiss.connect(hp);
  hp.connect(hg);
  hg.connect(master);
  hiss.start(t0);
  hiss.stop(t0 + dur + 0.02);

  // Three hull slams timed to the clip (solar-wind hits)
  const hits = [
    { at: 0.18, f: 58, g: 0.2 },
    { at: 2.55, f: 46, g: 0.24 },
    { at: 5.15, f: 36, g: 0.28 },
  ];
  for (const hit of hits) {
    const t = t0 + hit.at;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(hit.f, t);
    osc.frequency.exponentialRampToValueAtTime(16, t + 0.7);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(hit.g, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + 0.9);
  }

  setTimeout(() => {
    if (_master === master && ctx.currentTime >= _stopAt - 0.05) killField();
  }, (dur + 0.2) * 1000);
}
