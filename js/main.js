import * as THREE from "three";
import { buildShip, createSpaceView, updateAutoDoors, updateStallDoors, nearestInteractable, updateSittingCrew, updatePatrolCrew, updatePlants } from "./ship.js";
import { Player } from "./player.js";
import { isTouchDevice, setupMobileControls } from "./mobile.js";

const loaderEl = document.getElementById("loader");
const loadBar = document.getElementById("load-bar");
const loadPct = document.getElementById("load-pct");
const loadStatus = document.getElementById("load-status");
const overlay = document.getElementById("overlay");
const hud = document.getElementById("hud");
const promptEl = document.getElementById("prompt");
const startBtn = document.getElementById("start-btn");
const helpBtn = document.getElementById("help-btn");
const hintEl = document.getElementById("hint");
const mobileRoot = document.getElementById("mobile-controls");
const touchMode = isTouchDevice();

function setProgress(pct, status) {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  loadBar.style.width = `${p}%`;
  loadPct.textContent = `${p}%`;
  if (status) loadStatus.textContent = status;
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function toggleMainScreen(ship) {
  const ud = ship.mainScreen.userData;
  const next = ud.mode === "default" ? "outside" : "default";
  ud.mode = next;
  const mesh = ud.screenMesh;
  if (next === "outside") {
    mesh.material = ud.outsideMat;
    ud.deco.visible = false;
  } else {
    mesh.material = ud.defaultMat;
    ud.deco.visible = true;
  }
}

async function boot() {
  setProgress(8, "Loading…");
  await wait(40);

  setProgress(18, "Loading…");
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd8dde4);
  scene.fog = new THREE.Fog(0xd8dde4, 40, 90);

  const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.08, 120);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  document.body.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.72));
  const hemi = new THREE.HemisphereLight(0xffffff, 0xb0b8c4, 0.85);
  scene.add(hemi);

  setProgress(35, "Loading…");
  await wait(30);

  setProgress(42, "Loading…");
  try {
    await document.fonts.load('400 200px "DinerScript"');
    await document.fonts.ready;
  } catch (_) {
    /* canvas falls back to cursive if local face fails */
  }

  setProgress(48, "Loading…");
  const ship = buildShip(scene);

  const screenW = ship.mainScreen.userData.width || 6.5;
  const screenH = ship.mainScreen.userData.height || 2.6;
  const spaceView = createSpaceView(renderer, screenW / screenH);
  ship.mainScreen.userData.outsideMat = spaceView.material;
  ship.spaceView = spaceView;

  // default main screen to starfield view
  {
    const ud = ship.mainScreen.userData;
    ud.mode = "outside";
    ud.screenMesh.material = ud.outsideMat;
    ud.deco.visible = false;
  }

  setProgress(72, "Loading…");
  await wait(40);

  const player = new Player(camera, ship.colliders, ship.spawn);
  setProgress(86, "Loading…");

  spaceView.update(0, renderer);
  player.update(0);
  // warm GPU shaders from a few rooms so the first walk-in isn't hitchy
  {
    const warmAt = [
      ship.spawn.clone(),
      new THREE.Vector3(0, 1.65, 4.5),
      new THREE.Vector3(-18, 1.65, -10.25),
      new THREE.Vector3(11.5, 1.65, 4.5),
      new THREE.Vector3(16.5, 1.65, -10.25),
      new THREE.Vector3(0, 1.65, -25.5),
    ];
    const savePos = camera.position.clone();
    const saveQuat = camera.quaternion.clone();
    for (let i = 0; i < warmAt.length; i++) {
      const p = warmAt[i];
      camera.position.copy(p);
      camera.lookAt(p.x + 0.2, p.y, p.z + 1.2);
      renderer.compile(scene, camera);
      renderer.render(scene, camera);
    }
    camera.position.copy(savePos);
    camera.quaternion.copy(saveQuat);
    player.update(0);
    renderer.compile(scene, camera);
    for (let i = 0; i < 6; i++) renderer.render(scene, camera);
  }
  setProgress(96, "Loading…");
  await wait(60);

  setProgress(100, "Ready");
  await wait(120);

  loaderEl.classList.add("hidden");
  overlay.classList.remove("hidden");

  const clock = new THREE.Clock();
  let skipDeltas = 2;

  function doInteract() {
    if (!player.locked) return;
    const stall = nearestInteractable(ship.interactables, player.position);
    if (stall) {
      stall.toggle();
      return;
    }
    const dx = player.position.x - ship.interactPos.x;
    const dz = player.position.z - ship.interactPos.z;
    if (Math.hypot(dx, dz) < 7.5) toggleMainScreen(ship);
  }

  const mobile = touchMode
    ? setupMobileControls({
      player,
      onInteract: doInteract,
      root: mobileRoot,
    })
    : null;

  if (touchMode) {
    hintEl.textContent = "Stick move · Drag look · Sprint · E";
    const keysEl = overlay.querySelector(".keys");
    if (keysEl) keysEl.textContent = "Stick · Drag look · Sprint · E";
  }

  function enter() {
    overlay.classList.add("hidden");
    hud.classList.remove("hidden");
    skipDeltas = 3;
    clock.getDelta();
    if (touchMode) {
      player.setLocked(true);
      mobile?.show();
    } else {
      renderer.domElement.requestPointerLock();
    }
  }

  startBtn.addEventListener("click", enter);
  helpBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    hintEl.classList.toggle("hidden");
  });
  renderer.domElement.addEventListener("click", () => {
    if (overlay.classList.contains("hidden") && loaderEl.classList.contains("hidden")) {
      hintEl.classList.add("hidden");
      if (!touchMode) renderer.domElement.requestPointerLock();
    }
  });

  document.addEventListener("pointerlockchange", () => {
    if (touchMode) return;
    player.setLocked(document.pointerLockElement === renderer.domElement);
  });

  let labelTimer = 0;
  const mainMesh = ship.mainScreen.userData.screenMesh;
  const mainDeco = ship.mainScreen.userData.deco;

  let eHeld = false;
  window.addEventListener("keydown", (e) => {
    if (e.code !== "KeyE") return;
    if (eHeld) return;
    eHeld = true;
    doInteract();
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "KeyE") eHeld = false;
  });

  window.addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  function animateDeco(t) {
    const { anim } = ship;
    for (const s of anim.screens) {
      if (s === mainMesh && ship.mainScreen.userData.mode === "outside") continue;
      if (s.material?.emissiveIntensity == null) continue;
      s.material.emissiveIntensity = 0.95 + Math.sin(t * 1.5) * 0.2;
    }
    for (let i = 0; i < anim.bars.length; i++) {
      const b = anim.bars[i];
      if (!b.visible || (mainDeco && !mainDeco.visible && mainDeco.children.includes(b))) continue;
      b.scale.x = 0.55 + 0.45 * Math.abs(Math.sin(t * 2.2 + i * 0.7));
    }
    for (let i = 0; i < (anim.screenRings || []).length; i++) {
      const r = anim.screenRings[i];
      if (mainDeco && !mainDeco.visible && mainDeco.children.includes(r)) continue;
      const speed = r.userData.spinSpeed ?? (0.35 + i * 0.4) * (i % 2 ? -1 : 1);
      r.rotation.z = t * speed;
    }
    for (const r of anim.rings) {
      if (mainDeco && !mainDeco.visible && mainDeco.children.includes(r)) continue;
      r.rotation.y = t * 0.8;
      r.rotation.x = Math.sin(t * 0.5) * 0.2;
    }
    if (anim.hubNeon) {
      const hn = anim.hubNeon;
      hn.color.setHSL((t * 0.12) % 1, 0.95, 0.48);
      if (hn.holo) hn.holo.emissive.copy(hn.color);
      hn.light.color.copy(hn.color);
      if (hn.floor) {
        // darker floor than ceiling / accents
        hn.floor.color.setHSL((t * 0.12) % 1, 0.88, 0.16);
        hn.floor.emissive.setHSL((t * 0.12) % 1, 0.88, 0.14);
        hn.floor.emissiveIntensity = 0.55 + Math.sin(t * 2.0) * 0.1;
      }
      if (hn.ceiling) {
        hn.ceiling.color.copy(hn.color);
        hn.ceiling.emissive.copy(hn.color);
        hn.ceiling.emissiveIntensity = 0.9 + Math.sin(t * 2.0 + 0.6) * 0.18;
      }
      if (hn.ceilingLight) {
        hn.ceilingLight.color.copy(hn.color);
        hn.ceilingLight.intensity = 0.55 + Math.sin(t * 2.0) * 0.12;
      }
      if (hn.light) {
        hn.light.intensity = 1.6 + Math.sin(t * 2.0) * 0.3;
      }
    }
    for (const c of anim.cores) {
      c.scale.setScalar(1 + Math.sin(t * 3) * 0.06);
      c.material.emissiveIntensity = 1.2 + Math.sin(t * 4) * 0.35;
    }
    for (const l of anim.engineLights) {
      l.intensity = 1.8 + Math.sin(t * 4) * 0.5;
    }
    for (let i = 0; i < anim.blinkers.length; i++) {
      anim.blinkers[i].material.emissiveIntensity = Math.sin(t * 6 + i) > 0 ? 1.2 : 0.15;
    }
    // engine orange: pulse between saturated orange and lighter orange
    if (anim.enginePipes?.length) {
      const pulse = (Math.sin(t * 2.4) + 1) * 0.5;
      // normal (pulse=0): richer #ff7a18 · light (pulse=1): softer #ffc878
      const r = 1;
      const g = 0.48 + pulse * 0.3;
      const b = 0.09 + pulse * 0.38;
      const er = 1;
      const eg = 0.38 + pulse * 0.28;
      const eb = 0.05 + pulse * 0.28;
      const eInt = 0.38 + pulse * 0.32;
      for (const m of anim.enginePipes) {
        m.color.setRGB(r, g, b);
        if (m.emissive) m.emissive.setRGB(er, eg, eb);
        if (m.emissiveIntensity != null) m.emissiveIntensity = eInt;
      }
      if (anim.engineOrangeLights) {
        for (const l of anim.engineOrangeLights) {
          l.color.setRGB(r, g, b);
        }
      }
    }
  }

  function tick() {
    let dt = Math.min(clock.getDelta(), 0.05);
    if (skipDeltas > 0) {
      skipDeltas -= 1;
      dt = 0;
    }
    const t = clock.elapsedTime;
    player.update(dt);
    updateAutoDoors(ship.autoDoors, player.position, dt);
    updateStallDoors(ship.interactables, dt);
    updateSittingCrew(ship.anim.sittingCrew, dt, t);
    updatePatrolCrew(ship.anim.patrolCrew, dt, t);
    updatePlants(ship.anim, t);
    animateDeco(t);

    if (ship.mainScreen.userData.mode === "outside") {
      spaceView.update(t, renderer);
    }

    labelTimer += dt;
    if (labelTimer > 0.2) {
      labelTimer = 0;

      const stall = nearestInteractable(ship.interactables, player.position);
      if (stall && player.locked) {
        const p = stall.prompt();
        promptEl.textContent = touchMode ? p.replace(/^Press E/, "Tap E") : p;
        promptEl.classList.remove("hidden");
      } else {
        const dx = player.position.x - ship.interactPos.x;
        const dz = player.position.z - ship.interactPos.z;
        const near = Math.hypot(dx, dz) < 7.5;
        if (near && player.locked) {
          const mode = ship.mainScreen.userData.mode;
          promptEl.textContent = mode === "default"
            ? (touchMode ? "Tap E · See outside" : "Press E · See outside")
            : (touchMode ? "Tap E · See stats" : "Press E · See stats");
          promptEl.classList.remove("hidden");
        } else {
          promptEl.classList.add("hidden");
        }
      }
    }

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  tick();
}

boot().catch((err) => {
  console.error(err);
  setProgress(0, `Error: ${err.message}`);
  loadPct.textContent = "FAILED";
});
