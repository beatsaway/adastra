/**
 * NPC alien-language chatter — random Web Audio fragments sequenced
 * for about as long as the subtitle would take to say.
 * Not TTS. Ship AI still uses SpeechSynthesis.
 */

import { getAudioCtx, resumeAudio } from "./ctx.js";

const VOICES = {
  nova: { base: 340, click: 0.38, wet: 0.22, growl: 0.12 },
  rex: { base: 230, click: 0.22, wet: 0.42, growl: 0.28 },
  mira: { base: 290, click: 0.14, wet: 0.58, growl: 0.08 },
  jun: { base: 370, click: 0.12, wet: 0.62, growl: 0.1 },
  tess: { base: 205, click: 0.26, wet: 0.38, growl: 0.22 },
  kai: { base: 135, click: 0.42, wet: 0.18, growl: 0.55 },
  lila: { base: 310, click: 0.58, wet: 0.16, growl: 0.1 },
  aden: { base: 185, click: 0.2, wet: 0.48, growl: 0.18 },
  sable: { base: 255, click: 0.16, wet: 0.44, growl: 0.14 },
  pax: { base: 160, click: 0.28, wet: 0.3, growl: 0.32 },
  crew: { base: 250, click: 0.3, wet: 0.35, growl: 0.22 },
};

let _gen = 0;
/** @type {GainNode | null} */
let _master = null;

function rand(a, b) {
  return a + Math.random() * (b - a);
}

function noiseBuf(ctx, seconds, flavor = "white") {
  const n = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let b0 = 0;
  for (let i = 0; i < n; i++) {
    const white = Math.random() * 2 - 1;
    if (flavor === "brown") {
      b0 = (b0 + white * 0.02) * 0.996;
      data[i] = b0 * 3.4;
    } else {
      data[i] = white;
    }
  }
  return buf;
}

export function durationForNpcLine(text) {
  const s = String(text || "").trim();
  if (!s) return 0.8;
  const words = s.split(/\s+/).length;
  const chars = s.length;
  return Math.min(5.8, Math.max(0.85, 0.32 + words * 0.3 + chars * 0.036));
}

function killMaster() {
  const m = _master;
  _master = null;
  if (!m) return;
  try {
    const ctx = getAudioCtx();
    const t = ctx ? ctx.currentTime : 0;
    m.gain.cancelScheduledValues(t);
    m.gain.setValueAtTime(Math.max(0.0001, m.gain.value), t);
    m.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    setTimeout(() => {
      try {
        m.disconnect();
      } catch (_) {}
    }, 70);
  } catch (_) {
    try {
      m.disconnect();
    } catch (_) {}
  }
}

export function stopAlienTalk() {
  _gen += 1;
  killMaster();
}

function playClick(ctx, dest, t, voice) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf(ctx, 0.05, "white");
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = rand(1400, 3200) * (voice.base / 250);
  bp.Q.value = rand(3, 8);
  const g = ctx.createGain();
  const dur = rand(0.018, 0.045);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(rand(0.1, 0.2), t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp);
  bp.connect(g);
  g.connect(dest);
  src.start(t);
  src.stop(t + dur + 0.01);
  return dur;
}

function playVowel(ctx, dest, t, voice) {
  const f0 = voice.base * rand(0.78, 1.35);
  const dur = rand(0.07, 0.2);
  const osc = ctx.createOscillator();
  osc.type = Math.random() < 0.45 ? "triangle" : "sine";
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(
    Math.max(70, f0 * rand(0.72, 1.38)),
    t + dur
  );
  const f2 = ctx.createOscillator();
  f2.type = "sine";
  f2.frequency.setValueAtTime(f0 * rand(1.7, 2.4), t);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = rand(900, 2200);
  const g = ctx.createGain();
  const peak = rand(0.09, 0.15);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(lp);
  f2.connect(lp);
  lp.connect(g);
  g.connect(dest);
  osc.start(t);
  f2.start(t);
  osc.stop(t + dur + 0.02);
  f2.stop(t + dur + 0.02);
  return dur;
}

function playChirp(ctx, dest, t, voice) {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  const up = Math.random() < 0.5;
  const a = voice.base * rand(1.1, 2.2);
  const b = voice.base * rand(2.2, 4.4);
  osc.frequency.setValueAtTime(up ? a : b, t);
  const dur = rand(0.05, 0.13);
  osc.frequency.exponentialRampToValueAtTime(Math.max(80, up ? b : a), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.11, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(dest);
  osc.start(t);
  osc.stop(t + dur + 0.02);
  return dur;
}

function playTrill(ctx, dest, t, voice) {
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  const f = voice.base * rand(0.9, 1.6);
  osc.frequency.setValueAtTime(f, t);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = rand(9, 16);
  const lfoG = ctx.createGain();
  lfoG.gain.value = f * rand(0.08, 0.18);
  lfo.connect(lfoG);
  lfoG.connect(osc.frequency);
  const dur = rand(0.09, 0.2);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.1, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(dest);
  osc.start(t);
  lfo.start(t);
  osc.stop(t + dur + 0.02);
  lfo.stop(t + dur + 0.02);
  return dur;
}

function playGrowl(ctx, dest, t, voice) {
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  const f = Math.max(70, voice.base * rand(0.35, 0.7));
  osc.frequency.setValueAtTime(f, t);
  osc.frequency.exponentialRampToValueAtTime(f * rand(0.7, 1.15), t + 0.12);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = rand(280, 640);
  lp.Q.value = 1.4;
  const dur = rand(0.08, 0.18);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.09, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(lp);
  lp.connect(g);
  g.connect(dest);
  osc.start(t);
  osc.stop(t + dur + 0.02);
  return dur;
}

function playWet(ctx, dest, t, voice) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf(ctx, 0.12, "brown");
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = voice.base * rand(1.4, 2.8);
  bp.Q.value = 1.2;
  const dur = rand(0.04, 0.1);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.08, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp);
  bp.connect(g);
  g.connect(dest);
  src.start(t);
  src.stop(t + dur + 0.02);
  return dur;
}

function pickFrag(voice) {
  const r = Math.random();
  const c = voice.click;
  const w = voice.wet;
  const g = voice.growl;
  if (r < c * 0.55) return playClick;
  if (r < c * 0.55 + w * 0.35) return playWet;
  if (r < c * 0.55 + w * 0.35 + g * 0.35) return playGrowl;
  if (r < 0.62) return playVowel;
  if (r < 0.82) return playChirp;
  return playTrill;
}

/**
 * Play a random alien-syllable loop. Resolves when the line duration ends.
 * @param {string} text
 * @param {{ voice?: string, onPulse?: () => void }} [opts]
 */
export function playAlienTalk(text, opts = {}) {
  _gen += 1;
  const gen = _gen;
  killMaster();
  const dur = durationForNpcLine(text);
  const voice = VOICES[opts.voice] || VOICES.crew;
  const onPulse = opts.onPulse;

  return new Promise((resolve) => {
    const ctx = getAudioCtx();
    if (!ctx) {
      setTimeout(resolve, dur * 1000);
      return;
    }
    void resumeAudio();

    const master = ctx.createGain();
    master.gain.value = 0.0001;
    const t0 = ctx.currentTime;
    master.gain.setValueAtTime(0.0001, t0);
    master.gain.exponentialRampToValueAtTime(1, t0 + 0.04);
    master.gain.setValueAtTime(1, t0 + Math.max(0.08, dur - 0.12));
    master.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    master.connect(ctx.destination);
    _master = master;

    const bus = ctx.createGain();
    bus.gain.value = 3.4;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 90;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 3400;
    bus.connect(hp);
    hp.connect(lp);
    lp.connect(master);

    let t = 0.03;
    let pulses = 0;
    while (t < dur - 0.08) {
      const frag = pickFrag(voice);
      const len = frag(ctx, bus, t0 + t, voice);
      if (onPulse) {
        const delay = t * 1000;
        setTimeout(() => {
          if (gen === _gen) onPulse();
        }, delay);
      }
      pulses += 1;
      t += len + rand(0.035, 0.12);
      if (Math.random() < 0.18) t += rand(0.04, 0.11);
    }
    if (!pulses && onPulse) onPulse();

    setTimeout(() => {
      if (gen === _gen) killMaster();
      resolve();
    }, dur * 1000 + 40);
  });
}
