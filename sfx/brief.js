/**
 * Scene 1 briefing — digital channel-open tone when the script starts.
 */

import { getAudioCtx, resumeAudio, busOut } from "./ctx.js?v=20260817al";

/** Short digital priority-channel chirp (square beeps + soft sweep). */
export function playBriefStart() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  void resumeAudio();

  const t0 = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(busOut("sfx") || ctx.destination);

  // Soft rising sweep under the beeps
  const sweep = ctx.createOscillator();
  sweep.type = "sawtooth";
  sweep.frequency.setValueAtTime(220, t0);
  sweep.frequency.exponentialRampToValueAtTime(880, t0 + 0.28);
  const slp = ctx.createBiquadFilter();
  slp.type = "lowpass";
  slp.frequency.setValueAtTime(900, t0);
  slp.frequency.exponentialRampToValueAtTime(1800, t0 + 0.28);
  const sg = ctx.createGain();
  sg.gain.setValueAtTime(0.0001, t0);
  sg.gain.linearRampToValueAtTime(0.035, t0 + 0.04);
  sg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
  sweep.connect(slp);
  slp.connect(sg);
  sg.connect(master);
  sweep.start(t0);
  sweep.stop(t0 + 0.34);

  const tones = [698.46, 880, 1174.66];
  for (let i = 0; i < tones.length; i++) {
    const t = t0 + 0.04 + i * 0.085;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(tones[i], t);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.055, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.075);
    osc.connect(lp);
    lp.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + 0.09);
  }
}
