/**
 * Scene 1 solar-wind clip on the cockpit main screen, before the AI script.
 */
import * as THREE from "three";
import { playScene1EnergyField, stopScene1EnergyField } from "../sfx/scene1-field.js?v=20260815ed";

const SRC = "scene/scene1.mp4?v=20260815bl";

/** Same rumble as Scene 1. `amount` 1 = full, 0 = none. */
export function applyCockpitShake(camera, t, amount = 1) {
  if (!camera || !(amount > 0)) return;
  const s = 0.034 * amount;
  camera.position.x += Math.sin(t * 23.1) * s + Math.sin(t * 47.3) * s * 0.4;
  camera.position.y += Math.sin(t * 19.4) * s * 0.9;
  camera.position.z += Math.sin(t * 15.8) * s * 0.35;
  camera.rotateZ(Math.sin(t * 13.6) * 0.014 * amount);
}

export function createScene1Intro() {
  const video = document.createElement("video");
  video.src = SRC;
  video.preload = "auto";
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.muted = false;
  video.loop = false;
  video.playbackRate = 0.5;
  video.crossOrigin = "anonymous";
  try {
    video.load();
  } catch (_) {}

  const tex = new THREE.VideoTexture(video);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;

  const material = new THREE.MeshBasicMaterial({
    map: tex,
    toneMapped: false,
  });

  let onDone = null;
  let timeoutId = null;
  let playing = false;

  function cleanupTimer() {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  }

  function finish() {
    if (!playing) return;
    playing = false;
    cleanupTimer();
    stopScene1EnergyField();
    try {
      video.pause();
    } catch (_) {}
    const cb = onDone;
    onDone = null;
    cb?.();
  }

  video.addEventListener("ended", finish);
  video.addEventListener("error", finish);

  return {
    material,
    get playing() {
      return playing;
    },
    /** Cheap cockpit rumble: a few sines on the camera. No extra objects. */
    applyShake(camera, t) {
      if (!playing || !camera) return;
      applyCockpitShake(camera, t, 1);
    },
    play(done) {
      cleanupTimer();
      onDone = typeof done === "function" ? done : null;
      playing = true;
      video.muted = false;
      video.playbackRate = 0.5;
      try {
        video.currentTime = 0;
      } catch (_) {}
      // Clip is ~3.6s at 0.5x (~7.2s); fail open if ended never fires.
      timeoutId = setTimeout(finish, 16000);
      playScene1EnergyField();
      const start = video.play();
      if (start && typeof start.then === "function") {
        start.catch(() => {
          video.muted = true;
          video.play().catch(() => finish());
        });
      }
    },
    stop() {
    playing = false;
    cleanupTimer();
    onDone = null;
    stopScene1EnergyField();
    try {
      video.pause();
    } catch (_) {}
    },
  };
}
