/**
 * Shared AudioContext for ship SFX — one context, resume on gesture.
 * Mixer buses: master, sfx, vo, ambience.
 */

const VOL_KEY = "adastra-ship-mixer";

let _ctx = null;
let _mixer = null;
const _listeners = [];

function clampGain(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 1;
  return Math.max(0, Math.min(2, x));
}

export function getMixerLevels() {
  try {
    const raw = localStorage.getItem(VOL_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return {
      master: clampGain(obj.master ?? 1),
      sfx: clampGain(obj.sfx ?? 1),
      vo: clampGain(obj.vo ?? 1),
      ambience: clampGain(obj.ambience ?? 1),
    };
  } catch (_) {
    return { master: 1, sfx: 1, vo: 1, ambience: 1 };
  }
}

function ensureMixer(ctx) {
  if (_mixer && _mixer.ctx === ctx) return _mixer;
  const levels = getMixerLevels();
  const master = ctx.createGain();
  master.gain.value = levels.master;
  master.connect(ctx.destination);
  const sfx = ctx.createGain();
  const vo = ctx.createGain();
  const ambience = ctx.createGain();
  sfx.gain.value = levels.sfx;
  vo.gain.value = levels.vo;
  ambience.gain.value = levels.ambience;
  sfx.connect(master);
  vo.connect(master);
  ambience.connect(master);
  _mixer = { ctx, master, sfx, vo, ambience };
  return _mixer;
}

export function getAudioCtx() {
  if (typeof AudioContext === "undefined" && typeof webkitAudioContext === "undefined") {
    return null;
  }
  if (!_ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    _ctx = new AC();
    ensureMixer(_ctx);
  }
  return _ctx;
}

/** Route node: "sfx" | "vo" | "ambience". Falls back to sfx. */
export function busOut(kind = "sfx") {
  const ctx = getAudioCtx();
  if (!ctx) return null;
  const m = ensureMixer(ctx);
  return m[kind] || m.sfx;
}

export function setMixerLevels(partial = {}) {
  const next = { ...getMixerLevels() };
  if (partial.master != null) next.master = clampGain(partial.master);
  if (partial.sfx != null) next.sfx = clampGain(partial.sfx);
  if (partial.vo != null) next.vo = clampGain(partial.vo);
  if (partial.ambience != null) next.ambience = clampGain(partial.ambience);
  try {
    localStorage.setItem(VOL_KEY, JSON.stringify(next));
  } catch (_) {}
  if (_mixer) {
    _mixer.master.gain.value = next.master;
    _mixer.sfx.gain.value = next.sfx;
    _mixer.vo.gain.value = next.vo;
    _mixer.ambience.gain.value = next.ambience;
  }
  for (const fn of _listeners) {
    try {
      fn(next);
    } catch (_) {}
  }
  return next;
}

export function onMixerChange(fn) {
  if (typeof fn === "function") _listeners.push(fn);
}

export function speechVolume() {
  const l = getMixerLevels();
  return Math.max(0, Math.min(1, 0.48 * l.master * l.vo));
}

export async function resumeAudio() {
  const ctx = getAudioCtx();
  if (!ctx) return null;
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch (_) {}
  }
  return ctx;
}
