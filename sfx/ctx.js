/**
 * Shared AudioContext for ship SFX — one context, resume on gesture.
 */

let _ctx = null;

export function getAudioCtx() {
  if (typeof AudioContext === "undefined" && typeof webkitAudioContext === "undefined") {
    return null;
  }
  if (!_ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    _ctx = new AC();
  }
  return _ctx;
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
