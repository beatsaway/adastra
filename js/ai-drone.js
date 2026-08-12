/**
 * Tiny AI companion — camera-fixed, sits 10px above the live HUD text box.
 * Appear/disappear: scale + opacity tween.
 */

import * as THREE from "three";

const CAM_DIST = 0.82;
const GAP_PX = 10;

/**
 * @param {THREE.Camera} camera
 * @param {{ touchMode?: boolean }} [opts]
 */
export function createAiDrone(camera, opts = {}) {
  const root = new THREE.Group();
  root.visible = false;
  root.scale.setScalar(0);
  camera.add(root);

  const mat = new THREE.MeshBasicMaterial({
    color: 0xc8f4ff,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.TetrahedronGeometry(0.09, 0), mat);
  mesh.renderOrder = 999;
  root.add(mesh);

  const wireMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    wireframe: true,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
  });
  const wire = new THREE.Mesh(new THREE.TetrahedronGeometry(0.055, 0), wireMat);
  wire.renderOrder = 1000;
  root.add(wire);

  let _amp = 0;
  let _wireAmp = 0;
  let _meshSpin = 0;
  let _wireSpin = 0;
  let _presence = 0;

  /**
   * Pin tetra so its bottom sits GAP_PX above the HUD box top
   * (uses real getBoundingClientRect — works in any orientation).
   */
  function placeAboveHud(cam, viewScale) {
    const d = CAM_DIST;
    const fov = ((cam?.fov ?? 72) * Math.PI) / 180;
    const halfH = Math.tan(fov * 0.5) * d;
    const h = window.innerHeight || 1;
    const hud = document.getElementById("prompt");

    let yFromTop;
    if (hud && !hud.classList.contains("hidden")) {
      const rect = hud.getBoundingClientRect();
      const rWorld = 0.09 * Math.max(0.2, viewScale);
      const rPx = (rWorld / halfH) * (h * 0.5);
      yFromTop = rect.top - GAP_PX - rPx;
    } else {
      // HUD hidden — soft fallback near bottom band
      yFromTop = h * 0.88;
    }

    const ndcY = 1 - (yFromTop / h) * 2;
    root.position.set(0, ndcY * halfH, -d);
  }

  /**
   * @param {number} dt
   * @param {THREE.Camera} cam
   * @param {{ active?: boolean, vol?: number, t?: number }} state
   */
  function update(dt, cam, state = {}) {
    const want = !!state.active;
    const vol = Math.max(0, Math.min(1, state.vol ?? 0));
    const t = state.t ?? 0;

    const target = want ? 1 : 0;
    const speed = want ? 5.2 : 6.0;
    _presence += (target - _presence) * Math.min(1, dt * speed);
    if (_presence < 0.002 && !want) {
      _presence = 0;
      root.visible = false;
      root.scale.setScalar(0);
      _amp = 0;
      _wireAmp = 0;
      mesh.scale.setScalar(1);
      wire.scale.setScalar(1);
      mat.opacity = 0;
      wireMat.opacity = 0;
      return;
    }

    const aspect = cam?.aspect || 1;
    const viewScale = aspect >= 1 ? 1 : Math.max(0.5, Math.min(1, aspect * 1.05));

    placeAboveHud(cam, viewScale * Math.max(_presence, 0.25));

    root.visible = true;
    root.scale.setScalar(_presence * viewScale);

    _amp += (vol - _amp) * Math.min(1, dt * 10);
    mesh.scale.setScalar(1 + _amp * 0.3);
    mat.opacity = (0.1 + _amp * 0.4) * _presence;
    _meshSpin += dt * (0.8 + _amp * 5);
    mesh.rotation.y = _meshSpin;
    mesh.rotation.x = _meshSpin * 0.6;

    _wireAmp += (vol - _wireAmp) * Math.min(1, dt * 22);
    wire.scale.setScalar(1 + _wireAmp * 1.05);
    wireMat.opacity = (0.3 + _wireAmp * 0.55) * _presence;

    _wireSpin += dt * 1.1;
    const lagRate = 1.4 + 1.2 * (0.5 + 0.5 * Math.sin(t * 2.6));
    const lag = 1 - Math.exp(-dt * lagRate);
    wire.rotation.x += (_wireSpin * 0.6 - wire.rotation.x) * lag;
    wire.rotation.y += (_wireSpin - wire.rotation.y) * lag;
  }

  void opts;
  return { root, update };
}
