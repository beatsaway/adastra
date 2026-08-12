import * as THREE from "three";
import { buildShip, createSpaceView, createStatusView, updateAutoDoors, updateStallDoors, nearestInteractable, nearestLockedDoor, LOCKED_DOOR_LINES, updateSosLights, updatePlants, downgradeMaterialsForMobile } from "./ship.js?v=20260815m";
import { Player } from "./player.js";
import { isTouchDevice, setupMobileControls } from "./mobile.js";
import { HudPrompt } from "./hud-prompt.js";
import { ShipScenes, SCENE } from "./scenes.js";
import { shipVoice } from "./ai-voice.js";
import { createAiDrone } from "./ai-drone.js";
import { ShipAmbience, ProximityTransformerHum, playDoorOpen, playDoorClose, playDoorDenied, playDoorAuth, resumeAudio, playYearReveal, playYearCollapse, playYearHover, playYearPick } from "../sfx/index.js";

const loaderEl = document.getElementById("loader");
const loadBar = document.getElementById("load-bar");
const loadPct = document.getElementById("load-pct");
const loadStatus = document.getElementById("load-status");
const overlay = document.getElementById("overlay");
const hud = document.getElementById("hud");
const promptEl = document.getElementById("prompt");
const yearFlashEl = document.getElementById("year-flash");
const startBtn = document.getElementById("start-btn");
const helpBtn = document.getElementById("help-btn");
const displayOpt = document.getElementById("display-opt");
const mobileRoot = document.getElementById("mobile-controls");
const touchMode = isTouchDevice();

function isAppFullscreen() {
  return !!(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.msFullscreenElement
  );
}

function requestAppFullscreen() {
  const el = document.documentElement;
  const req =
    el.requestFullscreen ||
    el.webkitRequestFullscreen ||
    el.webkitRequestFullScreen ||
    el.msRequestFullscreen;
  if (!req) return;
  try {
    const p = req.call(el);
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch (_) {}
}

function exitAppFullscreen() {
  const exit =
    document.exitFullscreen ||
    document.webkitExitFullscreen ||
    document.msExitFullscreen;
  if (!exit) return;
  try {
    const p = exit.call(document);
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch (_) {}
}

function syncDisplayOptLabel() {
  if (!displayOpt) return;
  displayOpt.textContent = isAppFullscreen() ? "Window" : "Fullscreen";
}

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
    mesh.material = ud.statusMat || ud.defaultMat;
    ud.deco.visible = false;
  }
}

async function boot() {
  setProgress(8, "Loading…");
  await wait(40);

  setProgress(18, "Loading…");
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1c0c0c);
  scene.fog = new THREE.Fog(0x1c0c0c, 35, 85);

  const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.08, 120);
  scene.add(camera);
  // Mobile GPUs choke on pixel count + PBR far more than desktop; Roblox is native C++ with batching/LOD.
  const mobileQuality = touchMode;
  const renderer = new THREE.WebGLRenderer({
    antialias: !mobileQuality,
    powerPreference: mobileQuality ? "high-performance" : "default",
    stencil: false,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobileQuality ? 1 : 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  if (mobileQuality) {
    renderer.toneMapping = THREE.LinearToneMapping;
    renderer.toneMappingExposure = 1.05;
  } else {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
  }
  document.body.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xff6060, 0.35));
  const hemi = new THREE.HemisphereLight(0xff9090, 0x401010, 0.45);
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
  if (mobileQuality) {
    downgradeMaterialsForMobile(ship.root);
    if (ship.mainScreen?.userData?.screenMesh) {
      ship.mainScreen.userData.defaultMat = ship.mainScreen.userData.screenMesh.material;
    }
    // Live material after downgrade (SOS / neon must not write orphan Standard mats)
    if (ship.anim?.hubNeon && ship.hubBeacon?.core?.material) {
      ship.anim.hubNeon.holo = ship.hubBeacon.core.material;
    }
  }

  const screenW = ship.mainScreen.userData.width || 6.5;
  const screenH = ship.mainScreen.userData.height || 2.6;
  const spaceView = createSpaceView(renderer, screenW / screenH);
  const statusView = createStatusView(screenW / screenH);
  ship.mainScreen.userData.outsideMat = spaceView.material;
  ship.mainScreen.userData.statusMat = statusView.material;
  ship.mainScreen.userData.statusView = statusView;
  ship.spaceView = spaceView;

  // default main screen: AI status briefing (not outside)
  {
    const ud = ship.mainScreen.userData;
    ud.mode = "default";
    ud.screenMesh.material = ud.statusMat;
    ud.deco.visible = false;
  }

  setProgress(72, "Loading…");
  await wait(40);

  const player = new Player(camera, ship.colliders, ship.spawn);
  if (ship.spawnYaw != null) player.yaw = ship.spawnYaw;
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

  const hudPrompt = new HudPrompt(promptEl, { touchMode });
  const scenes = new ShipScenes({ player });
  const ambience = new ShipAmbience();
  const boxHum = new ProximityTransformerHum();
  const aiDrone = createAiDrone(camera, { touchMode });

  function roomAtPlayer() {
    const zones = ship.zones;
    if (!zones) return null;
    const x = player.position.x;
    const z = player.position.z;
    for (let i = 0; i < zones.length; i++) {
      const b = zones[i]?.bounds;
      if (!b) continue;
      if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) return zones[i];
    }
    return null;
  }

  function beginScene1() {
    // Snap to cockpit corner facing the main screen (not door-center)
    player.position.copy(ship.spawn);
    player.position.y = player.eye;
    const yaw = ship.spawnYaw ?? Math.PI;
    player.yaw = yaw;
    player.pitch = -0.12;
    // While script plays: keep view on the big screen (can't turn to the door)
    player.setLookLimits({
      yawCenter: yaw,
      yawRange: 0.55,
      pitchMin: -0.5,
      pitchMax: 0.12,
    });
    player.update(0);
    scenes.start(SCENE.COCKPIT_BRIEFING);
    const ud = ship.mainScreen.userData;
    ud.mode = "default";
    ud.screenMesh.material = ud.statusMat || ud.defaultMat;
    ud.deco.visible = false;
  }

  function syncScene1FromBriefing() {
    const status = ship.mainScreen.userData.statusView;
    if (!scenes.isActive(SCENE.COCKPIT_BRIEFING)) return;
    if (status?.complete) {
      scenes.end(SCENE.COCKPIT_BRIEFING);
      player.setLookLimits(null);
    }
  }

  function nearMainScreen() {
    const dx = player.position.x - ship.interactPos.x;
    const dz = player.position.z - ship.interactPos.z;
    return Math.hypot(dx, dz) < 5.6;
  }

  function nearHubBeacon() {
    const b = ship.hubBeacon;
    if (!b) return false;
    const dx = player.position.x - b.position.x;
    const dz = player.position.z - b.position.z;
    return Math.hypot(dx, dz) < (b.radius || 2.85);
  }

  const yearRaycaster = new THREE.Raycaster();
  const yearNdc = new THREE.Vector2(0, 0);
  /** Sticky AI line while standing at a sealed door (reroll when leaving / switching doors). */
  let lockedDoorKey = null;
  let lockedDoorLine = null;
  let wasHubNear = false;
  /** @type {object | null} */
  let lastAimedYear = null;

  /** Crosshair centre (desktop) or tap point (mobile) → year pick + flash transit. */
  let yearTransit = null;
  function tryOpenYearByAim(clientX, clientY) {
    const hub = ship.hubBeacon;
    if (!hub?.pickYearByRay || !player.locked) return false;
    if (yearTransit || hub.getPickedYear?.()) return true;
    if ((hub.expand || 0) < 0.45) return false;
    if (clientX == null || clientY == null) {
      yearNdc.set(0, 0);
    } else {
      const rect = renderer.domElement.getBoundingClientRect();
      yearNdc.set(
        ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
        -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1
      );
    }
    const hit = hub.pickYearByRay(camera, yearRaycaster, yearNdc);
    if (!hit?.href) return false;
    if (!hub.beginYearPick?.(hit)) return true;
    playYearPick();
    yearTransit = { href: hit.href, elapsed: 0, phase: "spin" };
    return true;
  }

  function updateYearTransit(dt) {
    if (!yearTransit) return;
    yearTransit.elapsed += dt;
    if (yearTransit.phase === "spin" && yearTransit.elapsed >= 1) {
      yearTransit.phase = "flash";
      yearTransit.elapsed = 0;
      yearFlashEl?.classList.add("on");
    } else if (yearTransit.phase === "flash" && yearTransit.elapsed >= 0.48) {
      const href = yearTransit.href;
      yearTransit = null;
      window.location.href = href;
    }
  }

  function tryStartBriefingByProximity() {
    const ud = ship.mainScreen.userData;
    if (ud.mode !== "default" || !ud.statusView?.needsAlertStart?.()) return false;
    if (!nearMainScreen()) return false;
    ud.statusView.beginBriefing();
    hudPrompt.clearDialogue("ai-brief");
    hudPrompt.refresh();
    return true;
  }

  function doInteract() {
    if (hudPrompt.activateDialogue()) return;

    const ud = ship.mainScreen.userData;
    if (
      nearMainScreen() &&
      ud.mode === "default" &&
      ud.statusView?.hasUnfinishedDialogue?.()
    ) {
      return;
    }

    if (!player.locked) return;
    const stall = nearestInteractable(ship.interactables, player.position);
    if (stall) {
      stall.toggle();
      return;
    }
    if (nearMainScreen()) toggleMainScreen(ship);
  }

  const mobile = touchMode
    ? setupMobileControls({
      player,
      root: mobileRoot,
    })
    : null;

  function enter() {
    overlay.classList.add("hidden");
    hud.classList.remove("hidden");
    skipDeltas = 3;
    clock.getDelta();
    void shipVoice.ensureCtx();
    void resumeAudio().then(() => {
      ambience.start();
      void boxHum.ensure();
    });
    // Enter Ship → Scene 1 (cockpit lockdown until briefing completes)
    beginScene1();
    ship.mainScreen.userData.statusView?.start?.();
    // If the script was already finished earlier, Scene 1 ends immediately
    syncScene1FromBriefing();
    displayOpt?.classList.add("hidden");
    requestAppFullscreen();
    syncDisplayOptLabel();
    if (touchMode) {
      player.setLocked(true);
      mobile?.show();
    } else {
      renderer.domElement.requestPointerLock();
    }
  }

  startBtn.addEventListener("click", enter);
  let lastHelpToggle = 0;
  const toggleDisplayMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const now = performance.now();
    if (now - lastHelpToggle < 450) return;
    lastHelpToggle = now;
    if (!displayOpt) return;
    syncDisplayOptLabel();
    displayOpt.classList.toggle("hidden");
  };
  helpBtn?.addEventListener("pointerup", toggleDisplayMenu);
  displayOpt?.addEventListener("pointerup", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isAppFullscreen()) exitAppFullscreen();
    else requestAppFullscreen();
    setTimeout(syncDisplayOptLabel, 80);
  });
  document.addEventListener("fullscreenchange", syncDisplayOptLabel);
  document.addEventListener("webkitfullscreenchange", syncDisplayOptLabel);

  renderer.domElement.addEventListener("click", (e) => {
    if (!overlay.classList.contains("hidden") || !loaderEl.classList.contains("hidden")) {
      return;
    }
    if (player.locked) {
      const opened = touchMode
        ? tryOpenYearByAim(e.clientX, e.clientY)
        : tryOpenYearByAim(null, null);
      if (opened) return;
    }
    if (!touchMode) {
      displayOpt?.classList.add("hidden");
      renderer.domElement.requestPointerLock();
    }
  });

  // Mobile: tap year mesh (avoid steal from on-screen sticks / E button)
  if (touchMode) {
    renderer.domElement.addEventListener(
      "pointerup",
      (e) => {
        if (!player.locked) return;
        if (e.target !== renderer.domElement) return;
        if (mobileRoot && !mobileRoot.classList.contains("hidden")) {
          const t = e.target;
          if (t && mobileRoot.contains(t)) return;
        }
        tryOpenYearByAim(e.clientX, e.clientY);
      },
      { passive: true }
    );
  }

  document.addEventListener("pointerlockchange", () => {
    if (touchMode) return;
    player.setLocked(document.pointerLockElement === renderer.domElement);
  });

  let labelTimer = 0;
  const mainMesh = ship.mainScreen.userData.screenMesh;
  const mainDeco = ship.mainScreen.userData.deco;

  let eHeld = false;
  window.addEventListener("keydown", (e) => {
    if (e.code === "KeyR" && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      const ud = ship.mainScreen.userData;
      ud.statusView?.reset?.();
      ud.mode = "default";
      ud.screenMesh.material = ud.statusMat || ud.defaultMat;
      ud.deco.visible = false;
      // Replay hook (dev): restart Scene 1
      beginScene1();
      return;
    }
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
    if (anim.hubNeon && !anim.sosActive) {
      const hn = anim.hubNeon;
      hn.color.setHSL((t * 0.12) % 1, 0.95, 0.48);
      if (hn.holo?.emissive) hn.holo.emissive.copy(hn.color);
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
    if (!anim.sosActive && anim.enginePipes?.length) {
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

  let frame = 0;
  function tick() {
    let dt = Math.min(clock.getDelta(), 0.05);
    if (skipDeltas > 0) {
      skipDeltas -= 1;
      dt = 0;
    }
    const t = clock.elapsedTime;
    frame += 1;
    player.update(dt);
    scenes.update();
    syncScene1FromBriefing();
    updateYearTransit(dt);
    {
      const hudUp = !!promptEl && !promptEl.classList.contains("hidden");
      const speaking = shipVoice.speaking;
      // Show above HUD whenever the text box is up, or while any script audio plays
      aiDrone.update(dt, camera, {
        active: player.locked && (hudUp || speaking),
        vol: shipVoice.tickViz(dt),
        t,
      });
    }
    {
      const hubNear = nearHubBeacon();
      const hub = ship.hubBeacon;
      hub?.update?.(dt, hubNear, t, camera);
      if (player.locked && !yearTransit) {
        if (hubNear && !wasHubNear) playYearReveal();
        if (!hubNear && wasHubNear) playYearCollapse();
      }
      wasHubNear = hubNear;
      // PC: look-aim highlight (skip while year exit is playing)
      if (
        !yearTransit &&
        !mobileQuality &&
        hubNear &&
        player.locked &&
        hub?.setAimedYear &&
        hub.expand > 0.45
      ) {
        yearNdc.set(0, 0);
        const hit = hub.pickYearByRay(camera, yearRaycaster, yearNdc);
        if (hit !== lastAimedYear) {
          if (hit) playYearHover();
          lastAimedYear = hit;
        }
        hub.setAimedYear(hit);
      } else if (!yearTransit && (mobileQuality || !hubNear)) {
        if (lastAimedYear) lastAimedYear = null;
        hub?.setAimedYear?.(null);
      }
    }
    // Scene 1 / pre-enter: keep doors sealed (silent). Open-hole frames never get panels/SFX.
    const doorsSealed =
      scenes.isActive(SCENE.COCKPIT_BRIEFING) || !player.locked;
    updateAutoDoors(
      ship.autoDoors,
      player.position,
      dt,
      doorsSealed,
      (kind, door) => {
        if (!door?.hasPanel) return;
        if (kind === "open") {
          playDoorAuth();
          setTimeout(() => playDoorOpen(), 90);
        } else playDoorClose();
      }
    );
    // Room ambience: SOS vs normal, smooth 0.4s blend inside ShipAmbience
    {
      const room = roomAtPlayer();
      const sosHere = room ? room.lightMode === "sos" : !!ship.anim?.sosActive;
      ambience.setSos(sosHere);
      ambience.update(dt);
      // Transformer hum when very close to cockpit wall power boxes
      let boxDist = 99;
      const boxes = ship.powerBoxes;
      if (boxes) {
        for (let i = 0; i < boxes.length; i++) {
          const b = boxes[i];
          const d = Math.hypot(player.position.x - b.x, player.position.z - b.z);
          if (d < boxDist) boxDist = d;
        }
      }
      boxHum.update(dt, boxDist);
    }
    updateStallDoors(ship.interactables, dt);
    if (ship.anim.sosActive && (!mobileQuality || (frame & 1) === 0)) {
      updateSosLights(ship.anim.sosRooms, t, ship.anim.hubNeon);
    }
    updatePlants(ship.anim, t);
    // deco only when near animated areas; throttle harder on mobile
    const px = player.position.x;
    const pz = player.position.z;
    const nearDeco =
      Math.hypot(px, pz - 4.5) < 20 ||
      Math.hypot(px, pz - 22) < 18 ||
      Math.hypot(px, pz + 25.5) < 20;
    if (nearDeco && (!mobileQuality || (frame & 1) === 0)) {
      animateDeco(t);
    }

    if (ship.mainScreen.userData.mode === "default") {
      ship.mainScreen.userData.statusView?.update?.(dt);
    } else if (ship.mainScreen.userData.mode === "outside") {
      const sdx = player.position.x - ship.interactPos.x;
      const sdz = player.position.z - ship.interactPos.z;
      const nearScreen = Math.hypot(sdx, sdz) < 22;
      if (nearScreen && (!mobileQuality || frame % 3 === 0)) {
        spaceView.update(t, renderer);
      }
    }

    labelTimer += dt;
    if (labelTimer > 0.2) {
      labelTimer = 0;

      const ud = ship.mainScreen.userData;
      const near = nearMainScreen();
      const status = ud.statusView;

      // Walk up to the big screen → auto-start Scene 1 briefing (no click)
      if (player.locked && near) tryStartBriefingByProximity();

      const unfinished =
        ud.mode === "default" && status?.hasUnfinishedDialogue?.();

      // 1) Dialogue claims — briefing only (Info Hub has no HUD welcome)
      if (unfinished && near) {
        hudPrompt.setDialogue({ id: "ai-brief", text: null });
        hudPrompt.clearDialogue("info-hub");
      } else {
        hudPrompt.clearDialogue("ai-brief");
        hudPrompt.clearDialogue("info-hub");
      }

      // 2) Nearby interaction — only when dialogue does not own the box
      let nearby = null;
      let nearbyTap = null;
      if (player.locked && !hudPrompt.hasDialogue) {
        const sealed = nearestLockedDoor(ship.autoDoors, player.position);
        if (sealed) {
          if (sealed.key !== lockedDoorKey) {
            lockedDoorKey = sealed.key;
            lockedDoorLine =
              LOCKED_DOOR_LINES[(Math.random() * LOCKED_DOOR_LINES.length) | 0];
            playDoorDenied();
            // Small gap after digital deny before VO (don't overlap)
            const line = lockedDoorLine;
            setTimeout(() => shipVoice.trySpeak(line), 320);
          }
          nearby = lockedDoorLine;
        } else {
          lockedDoorKey = null;
          lockedDoorLine = null;
          const stall = nearestInteractable(ship.interactables, player.position);
          if (stall) {
            const p = stall.prompt();
            nearby = touchMode ? p.replace(/^Press E/, "Tap") : p;
            nearbyTap = () => doInteract();
          } else if (near) {
            nearby =
              ud.mode === "default"
                ? touchMode
                  ? "See outside"
                  : "Press E · See outside"
                : touchMode
                  ? "Open console"
                  : "Press E · See console";
            nearbyTap = () => doInteract();
          }
        }
      }
      hudPrompt.setNearby(nearby, touchMode ? nearbyTap : null);
      hudPrompt.refresh();
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
