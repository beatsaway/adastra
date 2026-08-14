import * as THREE from "three";
import { buildShip, createSpaceView, createStatusView, updateAutoDoors, updateStallDoors, nearestInteractable, nearestLockedDoor, LOCKED_DOOR_LINES, INSUFFICIENT_DATAPOINT_LINES, pickStationLockedLine, pickRoomRestoredLine, pickSouthGateLine, pickCockpitExitLine, updateSosLights, updatePlants, updateSleepingCrew, updateAwakeCrew, updateSittingCrew, updateNpcChitchat, updateNpcWiggle, pokeWaitingNpc, waitingNpcFromHit, downgradeMaterialsForMobile, unlockShipDoor, relockAllShipDoors, clearShipBriefingProgress, debugWallMonitor, resetAllRoomSos, applyWallMonitorVisual, setWallMonitorSosBlend, updateWallMonitorSosPulse, toggleBedPod, setBedPodHover, isNpcWorkRoomLocked, bedFromHit, beginNpcWake, sleeperFromHit, resetSleepingCrew, pumpPendingSosRestore, updateHubFloorHalos, updateSouthCorridorGate } from "./ship.js?v=20260815dl";
import { createSosCeilingSparks, updateSosCeilingSparks } from "./sos-sparks.js?v=20260815dk";
import { Player } from "./player.js?v=20260815ai";
import { isTouchDevice, setupMobileControls } from "./mobile.js";
import { HudPrompt } from "./hud-prompt.js?v=20260815cb";
import {
  DOOR_UNLOCK_COST,
  MONITOR_DEBUG_COST,
  NPC_ACTIVATE_COST,
  fetchCollectedDatapoints,
  getSpentDatapoints,
  addSpentDatapoints,
  availableDatapoints,
  clearShipDatapointUsage,
  markMonitorDebugged,
} from "./datapoints.js?v=adastra1000";
import { ShipScenes, SCENE } from "./scenes.js";
import { createScene1Intro, applyCockpitShake } from "./scene1-intro.js?v=20260815cx";
import { shipVoice } from "./ai-voice.js?v=20260815cj";
import { createAiDrone } from "./ai-drone.js";
import { ShipAmbience, ProximityTransformerHum, InfoHubHoloHiss, SleeperLevitateHum, HubHaloHum, playDoorOpen, playDoorClose, playDoorAuth, playCyberSuccess, playPodToggle, playHoloHover, playElectricShock, playHullRumble, playGlassDenied, playCeilingSpark, resumeAudio, playYearReveal, playYearCollapse, playYearHover, playYearPick } from "../sfx/index.js?v=20260815di";

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
  if (!exit) return Promise.resolve();
  try {
    const p = exit.call(document);
    if (p && typeof p.then === "function") return p.catch(() => {});
  } catch (_) {}
  return Promise.resolve();
}

/** Leave fullscreen (if any), then navigate — year orbs must not stay in FS. */
function navigateAfterLeavingFullscreen(href) {
  const go = () => {
    window.location.href = href;
  };
  if (!isAppFullscreen()) {
    go();
    return;
  }
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    document.removeEventListener("fullscreenchange", finish);
    document.removeEventListener("webkitfullscreenchange", finish);
    go();
  };
  document.addEventListener("fullscreenchange", finish);
  document.addEventListener("webkitfullscreenchange", finish);
  Promise.resolve(exitAppFullscreen()).finally(() => {
    if (!isAppFullscreen()) finish();
    else setTimeout(finish, 180);
  });
  setTimeout(finish, 500);
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

function setMainScreenMode(ship, mode) {
  const ud = ship.mainScreen.userData;
  if (ud.introPlaying) return;
  const next = mode === "outside" ? "outside" : "default";
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

function toggleMainScreen(ship) {
  const ud = ship.mainScreen.userData;
  setMainScreenMode(ship, ud.mode === "default" ? "outside" : "default");
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

  const ambLight = new THREE.AmbientLight(0xff6060, 0.35);
  scene.add(ambLight);
  const hemi = new THREE.HemisphereLight(0xff9090, 0x401010, 0.45);
  scene.add(hemi);
  const sosAmb = { color: new THREE.Color(0xff7070), intensity: 0.22 };
  const sosHemi = {
    sky: new THREE.Color(0xffa0a0),
    ground: new THREE.Color(0x401818),
    intensity: 0.32,
  };
  const calmAmb = { color: new THREE.Color(0xc8d4e8), intensity: 0.34 };
  const calmHemi = {
    sky: new THREE.Color(0xe8eef8),
    ground: new THREE.Color(0x2a3040),
    intensity: 0.44,
  };
  let globalLightBlend = 1; // 1 = full SOS pink, 0 = calm

  setProgress(35, "Loading…");
  await wait(30);

  setProgress(42, "Loading…");
  try {
    await document.fonts.load('400 200px "DinerScript"');
    await document.fonts.load('600 64px "Sora"');
    await document.fonts.load('400 48px "IBM Plex Sans"');
    await document.fonts.ready;
  } catch (_) {
    /* canvas falls back if local face fails */
  }

  setProgress(48, "Loading…");
  const ship = buildShip(scene);
  const sosSparks = createSosCeilingSparks(ship.root);
  sosSparks.onBurst = (dist) => {
    playCeilingSpark(1 - Math.min(0.7, dist / 14));
  };
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
  const scene1Intro = createScene1Intro();
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
  if (touchMode) player.touchLookOnly = true;
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
  shipVoice.onLine = (text) => {
    hudPrompt.setSubtitle(text);
    hudPrompt.refresh();
  };
  const scenes = new ShipScenes({ player });
  const ambience = new ShipAmbience();
  const boxHum = new ProximityTransformerHum();
  const hubHoloHiss = new InfoHubHoloHiss();
  const sleeperHoverHum = new SleeperLevitateHum();
  const hubHaloHum = new HubHaloHum();
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

  function startScene1Briefing() {
    const ud = ship.mainScreen.userData;
    ud.introPlaying = false;
    ud.mode = "default";
    ud.screenMesh.material = ud.statusMat || ud.defaultMat;
    ud.deco.visible = false;
    if (ud.statusView?.needsAlertStart?.()) {
      ud.statusView.beginBriefing();
      hudPrompt.clearDialogue("ai-brief");
      hudPrompt.refresh();
    }
  }

  function beginScene1() {
    // Snap to cockpit corner facing the main screen (not door-center)
    player.position.copy(ship.spawn);
    player.position.y = player.eye;
    const yaw = ship.spawnYaw ?? Math.PI;
    player.yaw = yaw;
    player.pitch = -0.12;
    // Full look freedom during Scene 1 (doors stay sealed via scene bounds)
    player.setLookLimits(null);
    player.update(0);
    scenes.start(SCENE.COCKPIT_BRIEFING);
    const ud = ship.mainScreen.userData;
    ud.deco.visible = false;
    scene1Intro.stop();
    if (ud.statusView?.needsAlertStart?.()) {
      ud.introPlaying = true;
      ud.mode = "intro";
      ud.screenMesh.material = scene1Intro.material;
      scene1Intro.play(() => startScene1Briefing());
    } else {
      ud.introPlaying = false;
      ud.mode = "default";
      ud.screenMesh.material = ud.statusMat || ud.defaultMat;
    }
  }

  function briefingScriptDone() {
    return !!ship.mainScreen.userData.statusView?.complete;
  }

  function isCockpitWallMonitor(wm) {
    return wm?.room?.userData?.label === "Cockpit";
  }

  function cockpitSideMonitorsDebugged() {
    const mons = (ship.anim?.wallMonitors || []).filter(isCockpitWallMonitor);
    return mons.length > 0 && mons.every((m) => m.debugged);
  }

  function maybeReleaseCockpitScene() {
    if (!scenes.isActive(SCENE.COCKPIT_BRIEFING)) return;
    if (!briefingScriptDone()) return;
    if (!cockpitSideMonitorsDebugged()) return;
    scenes.end(SCENE.COCKPIT_BRIEFING);
    player.setLookLimits(null);
  }

  function syncScene1FromBriefing() {
    maybeReleaseCockpitScene();
  }

  function nearMainScreen() {
    const dx = player.position.x - ship.interactPos.x;
    const dz = player.position.z - ship.interactPos.z;
    return Math.hypot(dx, dz) < 5.6;
  }

  function nearDeskOptions() {
    const p = ship.deskPos;
    if (!p) return false;
    const dx = player.position.x - p.x;
    const dz = player.position.z - p.z;
    return Math.hypot(dx, dz) < 5.5;
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
  let cockpitExitKey = null;
  let cockpitExitLine = null;
  let collectedDatapoints = 0;
  let hoveredUnlockDoor = null;
  let hoveredDeskOption = null;
  /** @type {{ door: object, holo: object, t: number, startY: number } | null} */
  let unlockVaporFx = null;
  /** @type {{ door: object, holo: object, t: number, dur: number } | null} */
  let unlockDenyFx = null;
  /** @type {{ holo: object, t: number, dur: number } | null} */
  let denyFlashFx = null;
  /** @type {object | null} */
  let hoveredDebugMonitor = null;
  /** @type {object | null} */
  let hoveredBed = null;
  /** @type {{ wm: object, t: number, dur: number, bar: object, barMat: object, fullW: number } | null} */
  let debugTweenFx = null;
  const unlockRaycaster = new THREE.Raycaster();
  const unlockNdc = new THREE.Vector2(0, 0);
  const holoWorldPos = new THREE.Vector3();
  let wasHubNear = false;
  /** @type {object | null} */
  let lastAimedYear = null;
  let shockShakeT = 0;
  const SHOCK_SHAKE_DUR = 1.15;
  let sosRumbleT = 0;
  let sosRumbleWait = 1.1;
  const SOS_RUMBLE_DUR = 1.15;

  /** Crosshair centre (desktop) or tap point (mobile) → year pick + flash transit. */
  let yearTransit = null;
  function tryOpenYearByAim(clientX, clientY) {
    const hub = ship.hubBeacon;
    if (!hub?.pickYearByRay || !player.locked) return false;
    if (yearTransit || hub.getPickedYear?.()) return true;
    if (ship.anim?.southGate?.toss) return false;
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
    // Freeze look/move for the transit. Exit fullscreen only at navigate —
    // early exit on mobile portrait resizes the viewport and yanks the camera.
    player.inputFrozen = true;
    player.stickX = 0;
    player.stickY = 0;
    player.lookStickX = 0;
    player.lookStickY = 0;
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
      navigateAfterLeavingFullscreen(href);
    }
  }

  // Back/forward (bfcache) restores black flash + locked year pick — clear both.
  window.addEventListener("pageshow", () => {
    yearFlashEl?.classList.remove("on");
    yearTransit = null;
    player.inputFrozen = false;
    ship.hubBeacon?.clearYearPick?.();
  });

  function tryStartBriefingByProximity() {
    // Kept as a safety net; Scene 1 now auto-starts on enter.
    const ud = ship.mainScreen.userData;
    if (ud.introPlaying) return false;
    if (ud.mode !== "default" || !ud.statusView?.needsAlertStart?.()) return false;
    ud.statusView.beginBriefing();
    hudPrompt.clearDialogue("ai-brief");
    hudPrompt.refresh();
    return true;
  }

  function syncConsoleDatapoints() {
    const used = getSpentDatapoints();
    const avail = availableDatapoints(collectedDatapoints, used);
    ship.mainScreen?.userData?.statusView?.setDatapointStats?.(used, avail);
  }

  async function refreshCollectedDatapoints() {
    collectedDatapoints = await fetchCollectedDatapoints();
    syncConsoleDatapoints();
  }

  function closeShipDialog(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
    syncConfirmCursor();
  }

  function anyShipDialogOpen() {
    return !!(
      document.getElementById("unlock-confirm") ||
      document.getElementById("reset-confirm") ||
      document.getElementById("debug-confirm") ||
      document.getElementById("npc-confirm")
    );
  }

  /** OS cannot warp the mouse; fake the pointer at the crosshair for Yes/No dialogs. */
  let confirmCursorEl = null;
  function syncConfirmCursor() {
    if (touchMode || !anyShipDialogOpen()) {
      document.body.classList.remove("confirm-cursor");
      if (confirmCursorEl) confirmCursorEl.hidden = true;
      return;
    }
    document.body.classList.add("confirm-cursor");
    if (!confirmCursorEl) {
      confirmCursorEl = document.createElement("div");
      confirmCursorEl.id = "confirm-cursor";
      confirmCursorEl.setAttribute("aria-hidden", "true");
      document.body.appendChild(confirmCursorEl);
      window.addEventListener("pointermove", (e) => {
        if (!confirmCursorEl || confirmCursorEl.hidden) return;
        confirmCursorEl.style.left = e.clientX + "px";
        confirmCursorEl.style.top = e.clientY + "px";
      });
    }
    confirmCursorEl.style.left = innerWidth * 0.5 + "px";
    confirmCursorEl.style.top = innerHeight * 0.5 + "px";
    confirmCursorEl.hidden = false;
  }

  function closeUnlockConfirm() {
    closeShipDialog("unlock-confirm");
  }

  function closeResetConfirm() {
    closeShipDialog("reset-confirm");
  }

  function closeDebugConfirm() {
    closeShipDialog("debug-confirm");
  }

  function closeNpcConfirm() {
    closeShipDialog("npc-confirm");
  }

  function showUnlockConfirm(door) {
    if (!door?.locked || unlockVaporFx) return;
    closeUnlockConfirm();
    closeResetConfirm();
    setUnlockHover(null);
    // Free the cursor so Yes/No can be clicked
    try {
      if (document.pointerLockElement) document.exitPointerLock();
    } catch (_) {}

    const wrap = document.createElement("div");
    wrap.id = "unlock-confirm";
    wrap.className = "ship-confirm";
    wrap.innerHTML =
      '<div class="ship-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="unlock-confirm-title">' +
      '<p id="unlock-confirm-title">Do you want to spend <strong>' +
      DOOR_UNLOCK_COST +
      " data</strong> to repair this?</p>" +
      '<div class="ship-confirm-actions">' +
      '<button type="button" class="ship-confirm-yes" id="unlock-confirm-yes">Yes</button>' +
      '<button type="button" class="ship-confirm-no" id="unlock-confirm-no">No</button>' +
      "</div></div>";
    wrap.addEventListener("click", (e) => {
      if (e.target === wrap) closeUnlockConfirm();
    });
    document.body.appendChild(wrap);
    syncConfirmCursor();
    document.getElementById("unlock-confirm-no")?.addEventListener("click", () => {
      closeUnlockConfirm();
      if (!touchMode) {
        try {
          renderer.domElement.requestPointerLock();
        } catch (_) {}
      }
    });
    document.getElementById("unlock-confirm-yes")?.addEventListener("click", () => {
      closeUnlockConfirm();
      beginUnlockWithVapor(door);
      if (!touchMode) {
        try {
          renderer.domElement.requestPointerLock();
        } catch (_) {}
      }
    });
    try {
      document.getElementById("unlock-confirm-yes")?.focus();
    } catch (_) {}
  }

  function showResetConfirm() {
    if (anyShipDialogOpen() && document.getElementById("reset-confirm")) return;
    closeUnlockConfirm();
    closeResetConfirm();
    setUnlockHover(null);
    try {
      if (document.pointerLockElement) document.exitPointerLock();
    } catch (_) {}

    const wrap = document.createElement("div");
    wrap.id = "reset-confirm";
    wrap.className = "ship-confirm";
    wrap.innerHTML =
      '<div class="ship-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="reset-confirm-title">' +
      '<p id="reset-confirm-title"><strong>Reset ship progress?</strong></p>' +
      "<p>This resets everything in your ship except the available data points you've collected.</p>" +
      '<div class="ship-confirm-actions">' +
      '<button type="button" class="ship-confirm-yes" id="reset-confirm-yes">Reset</button>' +
      '<button type="button" class="ship-confirm-no" id="reset-confirm-no">Cancel</button>' +
      "</div></div>";
    wrap.addEventListener("click", (e) => {
      if (e.target === wrap) closeResetConfirm();
    });
    document.body.appendChild(wrap);
    syncConfirmCursor();
    document.getElementById("reset-confirm-no")?.addEventListener("click", () => {
      closeResetConfirm();
      if (!touchMode) {
        try {
          renderer.domElement.requestPointerLock();
        } catch (_) {}
      }
    });
    document.getElementById("reset-confirm-yes")?.addEventListener("click", () => {
      closeResetConfirm();
      performShipReset();
    });
    try {
      document.getElementById("reset-confirm-no")?.focus();
    } catch (_) {}
  }

  function performShipReset() {
    unlockVaporFx = null;
    clearUnlockDenyFx(true);
    clearDebugTween();
    closeDebugConfirm();
    closeNpcConfirm();
    hoveredUnlockDoor = null;
    hoveredDebugMonitor = null;
    hoveredDeskOption = null;
    lockedDoorKey = null;
    lockedDoorLine = null;
    scene1Intro.stop();
    ship.mainScreen.userData.introPlaying = false;
    // Ship usage only — collected exercise datapoints stay on the server / scores API
    clearShipDatapointUsage();
    clearShipBriefingProgress();
    relockAllShipDoors(ship.autoDoors);
    resetAllRoomSos(ship.anim);
    resetSleepingCrew(ship.anim, ship.root);
    const ud = ship.mainScreen.userData;
    ud.statusView?.reset?.();
    setMainScreenMode(ship, "default");
    syncConsoleDatapoints();
    beginScene1();
    ud.statusView?.start?.();
    syncScene1FromBriefing();
    if (!touchMode) {
      try {
        renderer.domElement.requestPointerLock();
      } catch (_) {}
    }
  }

  function pickInsufficientLine() {
    const list = INSUFFICIENT_DATAPOINT_LINES;
    if (!list?.length) {
      return "Insufficient data points. Restore more of my archive, Captain.";
    }
    return list[(Math.random() * list.length) | 0];
  }

  function playPodClick(result) {
    if (result === "open" || result === "close") playPodToggle(result);
  }

  function clearUnlockDenyFx(restore = true) {
    const fx = unlockDenyFx;
    unlockDenyFx = null;
    if (!restore || !fx?.holo) return;
    const h = fx.holo;
    if (h.material) {
      h.material.color.setRGB(1, 1, 1);
      if (h.userData.baseMap) h.material.map = h.userData.baseMap;
      h.material.opacity = h.userData.baseOpacity ?? 0.22;
      h.material.needsUpdate = true;
    }
    h.visible = true;
  }

  /** Insufficient balance: VO line + rapid red glitch on unlock text. */
  function denyInsufficientUnlock(door) {
    playGlassDenied();
    shipVoice.trySpeak(pickInsufficientLine());
    const holo = door?.unlockHolo;
    if (!holo?.material || unlockVaporFx) return;
    if (hoveredUnlockDoor === door) hoveredUnlockDoor = null;
    clearUnlockDenyFx(true);
    if (holo.userData.baseMap) {
      holo.material.map = holo.userData.baseMap;
      holo.material.needsUpdate = true;
    }
    unlockDenyFx = {
      door,
      holo,
      t: 0,
      dur: 0.9,
    };
  }

  function updateUnlockDeny(dt) {
    if (!unlockDenyFx) return;
    const fx = unlockDenyFx;
    fx.t += dt;
    const h = fx.holo;
    if (!h?.material) {
      unlockDenyFx = null;
      return;
    }
    // Fast chaotic on/off + deepen red hue
    const flickerOn =
      Math.sin(fx.t * 62) > 0.12 ||
      Math.sin(fx.t * 103 + 1.7) > 0.45 ||
      Math.sin(fx.t * 151) > 0.7;
    const u = Math.min(1, fx.t / fx.dur);
    const redPush = 1 - u * 0.35;
    h.material.color.setRGB(1, 0.22 * (1 - redPush * 0.85), 0.18 * (1 - redPush * 0.9));
    if (flickerOn) {
      h.visible = true;
      h.material.opacity = 0.45 + Math.random() * 0.55;
    } else {
      h.visible = Math.random() > 0.55;
      h.material.opacity = 0.04 + Math.random() * 0.12;
    }
    if (fx.t >= fx.dur) {
      clearUnlockDenyFx(true);
    }
  }

  function flashCockpitAccessDenied() {
    const door = (ship.autoDoors || []).find((d) => d.denyHolo);
    const h = door?.denyHolo;
    if (!h?.material) return;
    denyFlashFx = { holo: h, t: 0, dur: 1.85 };
    h.visible = true;
    h.material.opacity = 1;
  }

  function updateDenyFlash(dt) {
    if (!denyFlashFx) return;
    const fx = denyFlashFx;
    fx.t += dt;
    const h = fx.holo;
    if (!h?.material) {
      denyFlashFx = null;
      return;
    }
    const u = Math.min(1, fx.t / fx.dur);
    let op = 0;
    if (u < 0.08) op = 1;
    else if (u < 0.14) op = 0;
    else if (u < 0.72) op = 1;
    else op = Math.max(0, 1 - (u - 0.72) / 0.28);
    h.visible = op > 0.05;
    h.material.opacity = op;
    if (fx.t >= fx.dur) {
      h.visible = false;
      h.material.opacity = h.userData.baseOpacity ?? 0.95;
      denyFlashFx = null;
    }
  }

  function beginUnlockWithVapor(door) {
    if (!door?.locked || unlockVaporFx) return;
    const used = getSpentDatapoints();
    const avail = availableDatapoints(collectedDatapoints, used);
    if (avail < DOOR_UNLOCK_COST) {
      denyInsufficientUnlock(door);
      return;
    }

    clearUnlockDenyFx(true);
    const holo = door.unlockHolo;
    if (holo?.material) {
      if (holo.userData.hoverMap) {
        holo.material.map = holo.userData.hoverMap;
        holo.material.needsUpdate = true;
      }
      holo.material.color.setRGB(1, 1, 1);
      holo.material.opacity = holo.userData.flashOpacity ?? 1;
      unlockVaporFx = {
        door,
        holo,
        t: 0,
        startY: holo.position.y,
      };
      if (hoveredUnlockDoor === door) hoveredUnlockDoor = null;
    } else {
      finishDoorUnlock(door);
    }
  }

  function finishDoorUnlock(door) {
    if (!door?.locked) return;
    addSpentDatapoints(DOOR_UNLOCK_COST);
    unlockShipDoor(door);
    playCyberSuccess();
    syncConsoleDatapoints();
    lockedDoorKey = null;
    lockedDoorLine = null;
    if (hoveredUnlockDoor === door) hoveredUnlockDoor = null;
    shipVoice.trySpeak("Door repair authorized. Data points spent.");
  }

  function updateUnlockVapor(dt) {
    if (!unlockVaporFx) return;
    const fx = unlockVaporFx;
    fx.t += dt;
    const dur = 0.7;
    const u = Math.min(1, fx.t / dur);
    // Ease-out upward drift + fade (cheap: one mesh, no particles)
    const ease = 1 - Math.pow(1 - u, 2);
    const holo = fx.holo;
    if (holo) {
      holo.position.y = fx.startY + ease * 0.9;
      if (holo.material) {
        holo.material.opacity = (holo.userData.flashOpacity ?? 1) * (1 - ease);
      }
      const s = 1 + ease * 0.2;
      holo.scale.set(s, 1 + ease * 0.35, 1);
    }
    if (u >= 1) {
      if (holo) holo.visible = false;
      unlockVaporFx = null;
      finishDoorUnlock(fx.door);
    }
  }

  function tryUnlockSealedDoor(door) {
    if (!door?.locked || unlockVaporFx) return false;
    if (anyShipDialogOpen()) return false;
    const used = getSpentDatapoints();
    const avail = availableDatapoints(collectedDatapoints, used);
    if (avail < DOOR_UNLOCK_COST) {
      denyInsufficientUnlock(door);
      return false;
    }
    showUnlockConfirm(door);
    return true;
  }

  function unlockHoloMeshes() {
    const out = [];
    for (const d of ship.autoDoors || []) {
      if (d?.locked && d.unlockHolo?.visible) out.push(d.unlockHolo);
    }
    return out;
  }

  function doorFromUnlockHit(obj) {
    let o = obj;
    while (o) {
      if (o.userData?.unlockHolo || o.userData?.doorKey) {
        const key = o.userData.doorKey;
        if (key) {
          return (ship.autoDoors || []).find((d) => d.key === key) || null;
        }
      }
      o = o.parent;
    }
    // Fallback: match mesh reference
    for (const d of ship.autoDoors || []) {
      if (d.unlockHolo === obj || d.unlockHolo?.uuid === obj?.uuid) return d;
    }
    return null;
  }

  function pickUnlockDoor(clientX, clientY) {
    if (clientX == null || clientY == null) {
      unlockNdc.set(0, 0);
    } else {
      const rect = renderer.domElement.getBoundingClientRect();
      unlockNdc.set(
        ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
        -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1
      );
    }
    unlockRaycaster.setFromCamera(unlockNdc, camera);
    unlockRaycaster.far = 4.2;
    const meshes = unlockHoloMeshes();
    if (!meshes.length) return null;
    const hits = unlockRaycaster.intersectObjects(meshes, false);
    unlockRaycaster.far = Infinity;
    if (!hits.length) return null;
    // Must actually hit the unlock plane (crosshair / finger on the text)
    if (hits[0].distance > 4.2) return null;
    return doorFromUnlockHit(hits[0].object);
  }

  function setUnlockHover(door) {
    if (unlockVaporFx || unlockDenyFx || anyShipDialogOpen()) return;
    if (hoveredUnlockDoor && hoveredUnlockDoor !== door && hoveredUnlockDoor.unlockHolo) {
      const h = hoveredUnlockDoor.unlockHolo;
      const m = h.material;
      if (m) {
        if (h.userData.baseMap) m.map = h.userData.baseMap;
        m.color.setRGB(1, 1, 1);
        m.opacity = h.userData.baseOpacity ?? 0.22;
        m.needsUpdate = true;
      }
    }
    if (door && door !== hoveredUnlockDoor) playHoloHover();
    hoveredUnlockDoor = door || null;
    if (door?.unlockHolo?.material) {
      const h = door.unlockHolo;
      if (h.userData.hoverMap) h.material.map = h.userData.hoverMap;
      h.material.color.setRGB(1, 1, 1);
      h.material.opacity = h.userData.hoverOpacity ?? 0.95;
      h.material.needsUpdate = true;
    }
  }

  function deskOptionMeshes() {
    const items = ship.deskOptions?.items;
    if (!items?.length || !ship.deskOptions?.group?.visible) return [];
    const out = [];
    for (const it of items) {
      if (it.hit) out.push(it.hit);
      else if (it.mesh) out.push(it.mesh);
    }
    return out;
  }

  function pickDeskOption(clientX, clientY) {
    if (!ship.deskOptions?.group?.visible) return null;
    if (clientX == null || clientY == null) {
      unlockNdc.set(0, 0);
    } else {
      const rect = renderer.domElement.getBoundingClientRect();
      unlockNdc.set(
        ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
        -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1
      );
    }
    unlockRaycaster.setFromCamera(unlockNdc, camera);
    const meshes = deskOptionMeshes();
    if (!meshes.length) return null;
    const hits = unlockRaycaster.intersectObjects(meshes, false);
    if (!hits.length) return null;
    return hits[0].object?.userData?.optionId || null;
  }

  function setDeskHover(optionId) {
    if (anyShipDialogOpen()) return;
    if (optionId && optionId !== hoveredDeskOption) playHoloHover();
    const items = ship.deskOptions?.items || [];
    for (const it of items) {
      const visual = it.mesh;
      const m = visual?.material;
      if (!m) continue;
      const base = visual.userData.baseOpacity ?? 0.4;
      const hover = visual.userData.hoverOpacity ?? 0.95;
      m.opacity = it.id === optionId ? hover : base;
    }
    hoveredDeskOption = optionId || null;
  }

  function activateDeskOption(optionId) {
    if (!optionId || anyShipDialogOpen()) return false;
    if (optionId === "outside") {
      setMainScreenMode(ship, "outside");
      return true;
    }
    if (optionId === "console") {
      setMainScreenMode(ship, "default");
      return true;
    }
    if (optionId === "reset") {
      showResetConfirm();
      return true;
    }
    return false;
  }

  function updateDeskOptionsVisibility() {
    const group = ship.deskOptions?.group;
    if (!group) return;
    const status = ship.mainScreen.userData.statusView;
    const show =
      player.locked &&
      nearDeskOptions() &&
      !!status?.complete &&
      !scenes.isActive(SCENE.COCKPIT_BRIEFING);
    group.visible = show;
    if (!show && hoveredDeskOption) setDeskHover(null);
  }

  function tryDebugWallMonitor(wm) {
    if (!wm || wm.debugged || wm.repairing) return false;
    if (wm.room?.userData?.lightMode !== "sos") return false;
    if (isCockpitWallMonitor(wm) && !briefingScriptDone()) return false;
    if (debugTweenFx) return false;
    const used = getSpentDatapoints();
    const avail = availableDatapoints(collectedDatapoints, used);
    if (avail < MONITOR_DEBUG_COST) {
      playGlassDenied();
      shipVoice.trySpeak(pickInsufficientLine());
      return true;
    }
    showDebugConfirm(wm);
    return true;
  }

  function showDebugConfirm(wm) {
    if (!wm || wm.debugged || wm.repairing) return;
    closeUnlockConfirm();
    closeResetConfirm();
    closeDebugConfirm();
    setDebugMonitorHover(null);
    setUnlockHover(null);
    try {
      if (document.pointerLockElement) document.exitPointerLock();
    } catch (_) {}

    const wrap = document.createElement("div");
    wrap.id = "debug-confirm";
    wrap.className = "ship-confirm";
    wrap.innerHTML =
      '<div class="ship-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="debug-confirm-title">' +
      '<p id="debug-confirm-title">Do you want to spend <strong>' +
      MONITOR_DEBUG_COST +
      " data points</strong> to debug this room?</p>" +
      '<div class="ship-confirm-actions">' +
      '<button type="button" class="ship-confirm-yes" id="debug-confirm-yes">Yes</button>' +
      '<button type="button" class="ship-confirm-no" id="debug-confirm-no">No</button>' +
      "</div></div>";
    wrap.addEventListener("click", (e) => {
      if (e.target === wrap) closeDebugConfirm();
    });
    document.body.appendChild(wrap);
    syncConfirmCursor();
    document.getElementById("debug-confirm-no")?.addEventListener("click", () => {
      closeDebugConfirm();
      if (!touchMode) {
        try {
          renderer.domElement.requestPointerLock();
        } catch (_) {}
      }
    });
    document.getElementById("debug-confirm-yes")?.addEventListener("click", () => {
      closeDebugConfirm();
      beginDebugRepair(wm);
      if (!touchMode) {
        try {
          renderer.domElement.requestPointerLock();
        } catch (_) {}
      }
    });
    try {
      document.getElementById("debug-confirm-yes")?.focus();
    } catch (_) {}
  }

  function beginDebugRepair(wm) {
    if (!wm || wm.debugged || wm.repairing || debugTweenFx) return;
    const used = getSpentDatapoints();
    const avail = availableDatapoints(collectedDatapoints, used);
    if (avail < MONITOR_DEBUG_COST) {
      playGlassDenied();
      shipVoice.trySpeak(pickInsufficientLine());
      return;
    }
    addSpentDatapoints(MONITOR_DEBUG_COST);
    markMonitorDebugged(wm.id);
    playDoorAuth();
    syncConsoleDatapoints();
    setDebugMonitorHover(null);

    wm.repairing = true;
    if (wm.debugHolo) wm.debugHolo.visible = false;

    const fullW = Math.max(0.55, Math.min(2.4, (wm.maxW || 1.6) * 0.78));
    const barY = -Math.max(0.18, (wm.maxH || 0.9) * 0.28);
    const barMat = new THREE.MeshBasicMaterial({
      color: 0x5ffbf1,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -6,
      polygonOffsetUnits: -6,
    });
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(fullW, 0.065), barMat);
    bar.scale.x = 0.001;
    bar.position.set(fullW * (0.001 - 1) * 0.5, barY, 0.082);
    bar.renderOrder = 8;
    wm.group.add(bar);

    debugTweenFx = {
      wm,
      t: 0,
      dur: 1.45,
      bar,
      barMat,
      fullW,
      barY,
    };
  }

  function updateDebugRepair(dt) {
    if (!debugTweenFx) return;
    const fx = debugTweenFx;
    fx.t += dt;
    const u = Math.min(1, fx.t / fx.dur);
    const ease = u * u * (3 - 2 * u);
    setWallMonitorSosBlend(fx.wm, ease);
    if (fx.bar) {
      fx.bar.scale.x = Math.max(0.001, ease);
      fx.bar.position.x = fx.fullW * (ease - 1) * 0.5;
      fx.bar.position.y = fx.barY;
      // Bar shifts orange → cyan with the panel
      const r = 1 - ease * 0.55;
      const g = 0.48 + ease * 0.5;
      const b = 0.2 + ease * 0.75;
      fx.barMat.color.setRGB(r, g, b);
    }
    if (u >= 1) {
      finishDebugRepair(fx);
    }
  }

  function finishDebugRepair(fx) {
    const wm = fx.wm;
    if (fx.bar) {
      try {
        wm.group?.remove(fx.bar);
        fx.bar.geometry?.dispose?.();
        fx.barMat?.dispose?.();
      } catch (_) {}
    }
    debugTweenFx = null;
    wm.repairing = false;
    const result = debugWallMonitor(wm, ship.anim);
    if (result.roomCleared) {
      playCyberSuccess();
      shipVoice.trySpeak(pickRoomRestoredLine(result.roomName));
    } else {
      shipVoice.trySpeak("Monitor debug accepted. Panel restored to nominal.");
    }
    maybeReleaseCockpitScene();
  }

  function clearDebugTween() {
    if (!debugTweenFx) return;
    const fx = debugTweenFx;
    if (fx.bar) {
      try {
        fx.wm.group?.remove(fx.bar);
        fx.bar.geometry?.dispose?.();
        fx.barMat?.dispose?.();
      } catch (_) {}
    }
    if (fx.wm) fx.wm.repairing = false;
    debugTweenFx = null;
  }

  function debugHoloMeshes() {
    const out = [];
    for (const wm of ship.anim?.wallMonitors || []) {
      const h = wm.debugHolo;
      if (h?.visible && !wm.debugged && !wm.repairing && wm.room?.userData?.lightMode === "sos") {
        if (isCockpitWallMonitor(wm) && !briefingScriptDone()) continue;
        out.push(h);
      }
    }
    return out;
  }

  function monitorFromDebugHit(obj) {
    let o = obj;
    while (o) {
      const id = o.userData?.monitorId;
      if (id) {
        return (ship.anim?.wallMonitors || []).find((m) => m.id === id) || null;
      }
      if (o.userData?.debugHolo) break;
      o = o.parent;
    }
    for (const wm of ship.anim?.wallMonitors || []) {
      if (wm.debugHolo === obj || wm.debugHolo?.uuid === obj?.uuid) return wm;
    }
    return null;
  }

  function pickDebugMonitor(clientX, clientY) {
    if (clientX == null || clientY == null) {
      unlockNdc.set(0, 0);
    } else {
      const rect = renderer.domElement.getBoundingClientRect();
      unlockNdc.set(
        ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
        -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1
      );
    }
    unlockRaycaster.setFromCamera(unlockNdc, camera);
    unlockRaycaster.far = 4.6;
    const meshes = debugHoloMeshes();
    if (!meshes.length) {
      unlockRaycaster.far = Infinity;
      return null;
    }
    const hits = unlockRaycaster.intersectObjects(meshes, false);
    unlockRaycaster.far = Infinity;
    if (!hits.length || hits[0].distance > 4.6) return null;
    return monitorFromDebugHit(hits[0].object);
  }

  function setDebugMonitorHover(wm) {
    if (anyShipDialogOpen()) return;
    if (hoveredDebugMonitor && hoveredDebugMonitor !== wm && hoveredDebugMonitor.debugHolo) {
      const h = hoveredDebugMonitor.debugHolo;
      if (h.material) {
        if (h.userData.baseMap) h.material.map = h.userData.baseMap;
        h.material.color.setRGB(1, 1, 1);
        h.material.opacity = h.userData.baseOpacity ?? 0.55;
        h.material.needsUpdate = true;
      }
    }
    if (wm && wm !== hoveredDebugMonitor) playHoloHover();
    hoveredDebugMonitor = wm || null;
    if (wm?.debugHolo?.material) {
      const h = wm.debugHolo;
      if (h.userData.hoverMap) h.material.map = h.userData.hoverMap;
      h.material.color.setRGB(1, 1, 1);
      h.material.opacity = h.userData.hoverOpacity ?? 0.98;
      h.material.needsUpdate = true;
    }
  }

  function pickBedOrSleeper(clientX, clientY) {
    if (clientX == null || clientY == null) {
      unlockNdc.set(0, 0);
    } else {
      const rect = renderer.domElement.getBoundingClientRect();
      unlockNdc.set(
        ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
        -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1
      );
    }
    unlockRaycaster.setFromCamera(unlockNdc, camera);
    unlockRaycaster.far = 4.8;
    const sleepers = (ship.anim?.sleepingCrew || []).filter(
      (av) => av.userData.state === "sleeping"
    );
    if (sleepers.length) {
      const hits = unlockRaycaster.intersectObjects(sleepers, true);
      if (hits.length && hits[0].distance <= 4.8) {
        const av = sleeperFromHit(hits[0].object, ship.anim.sleepingCrew);
        if (av && av.userData.state === "sleeping") {
          const bed = av.userData.bed;
          if (bed && !bed.userData.podClosed) {
            unlockRaycaster.far = Infinity;
            return { sleeper: av, bed };
          }
        }
      }
    }
    const beds = ship.anim?.beds || [];
    if (beds.length) {
      const hits = unlockRaycaster.intersectObjects(beds, true);
      if (hits.length && hits[0].distance <= 4.8) {
        const bed = bedFromHit(hits[0].object);
        if (bed) {
          unlockRaycaster.far = Infinity;
          return { sleeper: null, bed };
        }
      }
    }
    unlockRaycaster.far = Infinity;
    return null;
  }

  function pickWaitingNpc(clientX, clientY) {
    const crew = ship.anim?.sleepingCrew || [];
    if (!crew.length) return null;
    if (clientX == null || clientY == null) {
      unlockNdc.set(0, 0);
    } else {
      const rect = renderer.domElement.getBoundingClientRect();
      unlockNdc.set(
        ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
        -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1
      );
    }
    unlockRaycaster.setFromCamera(unlockNdc, camera);
    unlockRaycaster.far = 3.2;
    const waiters = crew.filter((av) => av.userData.state !== "sleeping");
    if (!waiters.length) {
      unlockRaycaster.far = Infinity;
      return null;
    }
    const hits = unlockRaycaster.intersectObjects(waiters, true);
    unlockRaycaster.far = Infinity;
    if (!hits.length || hits[0].distance > 3.2) return null;
    return waitingNpcFromHit(hits[0].object, crew);
  }

  function tryActivateNpc(av) {
    if (!av || av.userData.state !== "sleeping") return false;
    if (anyShipDialogOpen()) return false;
    if (isNpcWorkRoomLocked(av.userData.npcWork, ship.autoDoors)) {
      playGlassDenied();
      shipVoice.trySpeak(pickStationLockedLine(av.userData.npcWork));
      return true;
    }
    const used = getSpentDatapoints();
    const avail = availableDatapoints(collectedDatapoints, used);
    if (avail < NPC_ACTIVATE_COST) {
      playGlassDenied();
      shipVoice.trySpeak(pickInsufficientLine());
      return true;
    }
    showNpcConfirm(av);
    return true;
  }

  function showNpcConfirm(av) {
    if (!av || av.userData.state !== "sleeping") return;
    closeUnlockConfirm();
    closeResetConfirm();
    closeDebugConfirm();
    closeNpcConfirm();
    try {
      if (document.pointerLockElement) document.exitPointerLock();
    } catch (_) {}

    const name = av.userData.npcName || "this crewmate";
    const wrap = document.createElement("div");
    wrap.id = "npc-confirm";
    wrap.className = "ship-confirm";
    wrap.innerHTML =
      '<div class="ship-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="npc-confirm-title">' +
      '<p id="npc-confirm-title">Activate <strong>' +
      name +
      "</strong> with <strong>" +
      NPC_ACTIVATE_COST +
      " data points</strong>?</p>" +
      '<div class="ship-confirm-actions">' +
      '<button type="button" class="ship-confirm-yes" id="npc-confirm-yes">Yes</button>' +
      '<button type="button" class="ship-confirm-no" id="npc-confirm-no">No</button>' +
      "</div></div>";
    wrap.addEventListener("click", (e) => {
      if (e.target === wrap) closeNpcConfirm();
    });
    document.body.appendChild(wrap);
    syncConfirmCursor();
    document.getElementById("npc-confirm-no")?.addEventListener("click", () => {
      closeNpcConfirm();
      if (!touchMode) {
        try {
          renderer.domElement.requestPointerLock();
        } catch (_) {}
      }
    });
    document.getElementById("npc-confirm-yes")?.addEventListener("click", () => {
      closeNpcConfirm();
      const used = getSpentDatapoints();
      const avail = availableDatapoints(collectedDatapoints, used);
      if (avail < NPC_ACTIVATE_COST) {
        playGlassDenied();
        shipVoice.trySpeak(pickInsufficientLine());
      } else if (isNpcWorkRoomLocked(av.userData.npcWork, ship.autoDoors)) {
        playGlassDenied();
        shipVoice.trySpeak(pickStationLockedLine(av.userData.npcWork));
      } else {
        addSpentDatapoints(NPC_ACTIVATE_COST);
        syncConsoleDatapoints();
        beginNpcWake(av, ship.root);
        playCyberSuccess();
      }
      if (!touchMode) {
        try {
          renderer.domElement.requestPointerLock();
        } catch (_) {}
      }
    });
    try {
      document.getElementById("npc-confirm-yes")?.focus();
    } catch (_) {}
  }

  function setBedHover(bed) {
    if (anyShipDialogOpen()) return;
    if (hoveredBed && hoveredBed !== bed) setBedPodHover(hoveredBed, false);
    hoveredBed = bed || null;
    if (bed) setBedPodHover(bed, true);
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
    if (!stall || stall.kind === "wallMonitor") return;
    stall.toggle();
    // Main screen modes = desk 3D option planes (crosshair click)
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
      void hubHoloHiss.ensure();
      void sleeperHoverHum.ensure();
      void hubHaloHum.ensure();
    });
    // Enter Ship → Scene 1 (cockpit lockdown until briefing completes)
    beginScene1();
    ship.mainScreen.userData.statusView?.start?.();
    void refreshCollectedDatapoints();
    // If the script was already finished earlier, Scene 1 ends immediately
    syncScene1FromBriefing();
    displayOpt?.classList.add("hidden");
    requestAppFullscreen();
    syncDisplayOptLabel();
    if (touchMode) {
      player.setLocked(true);
      mobile?.show();
    } else {
      // WASD stays on after enter even if the cursor is free for desk UI
      player.setLocked(true);
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
    if (anyShipDialogOpen() || unlockVaporFx || debugTweenFx) return;
    if (player.locked) {
      // PC: unlock / desk options only via crosshair aim (pointer lock).
      // Free-cursor clicks just re-lock look — never spend datapoints by accident.
      const aimOk = touchMode || document.pointerLockElement === renderer.domElement;
      if (aimOk) {
        const deskOpt = touchMode
          ? pickDeskOption(e.clientX, e.clientY)
          : pickDeskOption(null, null);
        if (deskOpt) {
          activateDeskOption(deskOpt);
          return;
        }
        const debugMon = touchMode
          ? pickDebugMonitor(e.clientX, e.clientY)
          : pickDebugMonitor(null, null);
        if (debugMon) {
          tryDebugWallMonitor(debugMon);
          return;
        }
        const unlockDoor = touchMode
          ? pickUnlockDoor(e.clientX, e.clientY)
          : pickUnlockDoor(null, null);
        if (unlockDoor) {
          tryUnlockSealedDoor(unlockDoor);
          return;
        }
        const bunk = touchMode
          ? pickBedOrSleeper(e.clientX, e.clientY)
          : pickBedOrSleeper(null, null);
        if (bunk?.sleeper) {
          tryActivateNpc(bunk.sleeper);
          return;
        }
        const waiter = touchMode
          ? pickWaitingNpc(e.clientX, e.clientY)
          : pickWaitingNpc(null, null);
        if (waiter && pokeWaitingNpc(waiter)) return;
        if (bunk?.bed) {
          playPodClick(toggleBedPod(bunk.bed));
          return;
        }
        const opened = touchMode
          ? tryOpenYearByAim(e.clientX, e.clientY)
          : tryOpenYearByAim(null, null);
        if (opened) return;
      }
    }
    if (!touchMode) {
      displayOpt?.classList.add("hidden");
      renderer.domElement.requestPointerLock();
    }
  });

  // Desktop: aim glow on unlock / desk option planes (crosshair)
  if (!touchMode) {
    window.addEventListener("mousemove", (e) => {
      if (!player.locked || yearTransit || anyShipDialogOpen()) return;
      const lockedPtr = document.pointerLockElement === renderer.domElement;
      const deskOpt = lockedPtr
        ? pickDeskOption(null, null)
        : pickDeskOption(e.clientX, e.clientY);
      if (deskOpt) {
        setUnlockHover(null);
        setDebugMonitorHover(null);
        setBedHover(null);
        setDeskHover(deskOpt);
        return;
      }
      setDeskHover(null);
      const debugMon = lockedPtr
        ? pickDebugMonitor(null, null)
        : pickDebugMonitor(e.clientX, e.clientY);
      if (debugMon) {
        setUnlockHover(null);
        setBedHover(null);
        setDebugMonitorHover(debugMon);
        return;
      }
      setDebugMonitorHover(null);
      const door = lockedPtr
        ? pickUnlockDoor(null, null)
        : pickUnlockDoor(e.clientX, e.clientY);
      if (door) {
        setBedHover(null);
        setUnlockHover(door);
        return;
      }
      setUnlockHover(null);
      const bunk = lockedPtr
        ? pickBedOrSleeper(null, null)
        : pickBedOrSleeper(e.clientX, e.clientY);
      setBedHover(bunk?.bed || null);
    });
  }

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
        const deskOpt = pickDeskOption(e.clientX, e.clientY);
        if (deskOpt) {
          activateDeskOption(deskOpt);
          return;
        }
        const debugMon = pickDebugMonitor(e.clientX, e.clientY);
        if (debugMon) {
          tryDebugWallMonitor(debugMon);
          return;
        }
        const unlockDoor = pickUnlockDoor(e.clientX, e.clientY);
        if (unlockDoor) {
          tryUnlockSealedDoor(unlockDoor);
          return;
        }
        const bunk = pickBedOrSleeper(e.clientX, e.clientY);
        if (bunk?.sleeper) {
          tryActivateNpc(bunk.sleeper);
          return;
        }
        const waiter = pickWaitingNpc(e.clientX, e.clientY);
        if (waiter && pokeWaitingNpc(waiter)) return;
        if (bunk?.bed) {
          playPodClick(toggleBedPod(bunk.bed));
          return;
        }
        tryOpenYearByAim(e.clientX, e.clientY);
      },
      { passive: true }
    );
  }

  document.addEventListener("pointerlockchange", () => {
    if (touchMode) return;
    // Re-enable look when lock returns. Do NOT clear locked on unlock —
    // freeing the cursor for desk bubbles must not kill WASD.
    if (document.pointerLockElement === renderer.domElement) {
      player.setLocked(true);
    }
  });

  let labelTimer = 0;
  const mainMesh = ship.mainScreen.userData.screenMesh;
  const mainDeco = ship.mainScreen.userData.deco;

  let eHeld = false;
  window.addEventListener("keydown", (e) => {
    if (e.code === "Escape") {
      if (document.getElementById("unlock-confirm")) {
        closeUnlockConfirm();
        return;
      }
      if (document.getElementById("debug-confirm")) {
        closeDebugConfirm();
        return;
      }
      if (document.getElementById("npc-confirm")) {
        closeNpcConfirm();
        return;
      }
      if (document.getElementById("reset-confirm")) {
        closeResetConfirm();
        return;
      }
    }
    if (e.code === "KeyR" && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      showResetConfirm();
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
    // Avoid aspect snap mid year-exit (esp. when leaving fullscreen on phone).
    if (yearTransit) return;
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  function animateDeco(t) {
    const { anim } = ship;
    for (const s of anim.screens) {
      if (s === mainMesh && ship.mainScreen.userData.mode === "outside") continue;
      if (s.userData?.wallMonitor) continue;
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
    for (const holo of anim.infoHubHolos || []) {
      if (!holo.visible) continue;
      holo.rotation.y = t * 0.9;
      if (holo.material) {
        holo.material.opacity = 0.48 + Math.sin(t * 2.2) * 0.14;
      }
    }
    for (const d of ship.autoDoors || []) {
      const h = d.unlockHolo;
      if (!h?.visible || !h.material || d === hoveredUnlockDoor) continue;
      if (unlockVaporFx?.door === d) continue;
      if (unlockDenyFx?.door === d) continue;
      const base = h.userData.baseOpacity ?? 0.22;
      h.material.opacity = base + Math.sin(t * 2.6) * 0.03;
    }
    for (const wm of anim.wallMonitors || []) {
      const h = wm.debugHolo;
      if (!h?.visible || !h.material || wm === hoveredDebugMonitor) continue;
      const base = h.userData.baseOpacity ?? 0.55;
      h.material.opacity = base + Math.sin(t * 1.6) * 0.04;
    }
    // Wall monitor colors are set on state change only (not every frame)
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
    if (updateSouthCorridorGate(ship.anim, player, dt)) {
      playElectricShock();
      shockShakeT = SHOCK_SHAKE_DUR;
      const line = pickSouthGateLine();
      setTimeout(() => shipVoice.trySpeak(line), 280);
    }
    scene1Intro.applyShake(camera, t);
    if (shockShakeT > 0) {
      shockShakeT = Math.max(0, shockShakeT - dt);
      applyCockpitShake(camera, t, shockShakeT / SHOCK_SHAKE_DUR);
    }
    {
      const wantRumble =
        player.locked &&
        !yearTransit &&
        !cockpitSideMonitorsDebugged();
      if (wantRumble && shockShakeT <= 0) {
        sosRumbleWait -= dt;
        if (sosRumbleWait <= 0 && sosRumbleT <= 0) {
          sosRumbleT = SOS_RUMBLE_DUR;
          sosRumbleWait = 2.2 + Math.random() * 2.4;
          playHullRumble();
        }
      } else if (!wantRumble) {
        sosRumbleWait = 1.1;
      }
      if (sosRumbleT > 0) {
        sosRumbleT = Math.max(0, sosRumbleT - dt);
        applyCockpitShake(camera, t, sosRumbleT / SOS_RUMBLE_DUR);
      }
    }
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
      const tossing = !!ship.anim?.southGate?.toss;
      const hubNear = nearHubBeacon();
      const hub = ship.hubBeacon;
      hub?.update?.(dt, hubNear && !tossing, t, camera);
      if (player.locked && !yearTransit && !tossing) {
        if (hubNear && !wasHubNear) playYearReveal();
        if (!hubNear && wasHubNear) playYearCollapse();
      }
      wasHubNear = tossing ? false : hubNear;
      // PC: look-aim highlight (skip while year exit is playing)
      if (
        !yearTransit &&
        !tossing &&
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
      } else if (!yearTransit && !tossing && (mobileQuality || !hubNear)) {
        if (lastAimedYear) lastAimedYear = null;
        hub?.setAimedYear?.(null);
      }
    }
    updateHubFloorHalos(ship.anim, dt);
    {
      const hubPos = ship.hubBeacon?.position;
      const hd = hubPos
        ? Math.hypot(player.position.x - hubPos.x, player.position.z - hubPos.z)
        : 99;
      hubHaloHum.update(dt, player.locked ? hd : 99, t);
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
      },
      ship.anim?.sleepingCrew
    );
    // Room ambience: SOS vs normal, smooth 0.4s blend inside ShipAmbience
    {
      const room = roomAtPlayer();
      const sosHere = room ? room.lightMode === "sos" : !!ship.anim?.sosActive;
      ambience.setSos(sosHere);
      ambience.update(dt);
      // Global fill follows the room you're in — not cockpit SOS bleeding ship-wide
      const wantSos = sosHere ? 1 : 0;
      globalLightBlend += (wantSos - globalLightBlend) * Math.min(1, dt * 2.8);
      const g = globalLightBlend;
      ambLight.color.copy(calmAmb.color).lerp(sosAmb.color, g);
      ambLight.intensity = calmAmb.intensity + (sosAmb.intensity - calmAmb.intensity) * g;
      hemi.color.copy(calmHemi.sky).lerp(sosHemi.sky, g);
      hemi.groundColor.copy(calmHemi.ground).lerp(sosHemi.ground, g);
      hemi.intensity = calmHemi.intensity + (sosHemi.intensity - calmHemi.intensity) * g;
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
    updateUnlockVapor(dt);
    updateUnlockDeny(dt);
    updateDenyFlash(dt);
    updateDebugRepair(dt);
    updateDeskOptionsVisibility();
    {
      const inHub = roomAtPlayer()?.label === "Hub";
      const px = player.position.x;
      const py = player.position.y + 1.2;
      const pz = player.position.z;
      const nearR2 = 5.5 * 5.5;
      let hubHoloDist = 99;
      for (const holo of ship.anim?.infoHubHolos || []) {
        // Inside the hub, hide the north doorway label — keep the south-path INFO HUB readable
        if (inHub && !holo.userData?.infoHubFromSouth) {
          holo.visible = false;
          continue;
        }
        holo.getWorldPosition(holoWorldPos);
        const wx = holoWorldPos.x - px;
        const wy = holoWorldPos.y - py;
        const wz = holoWorldPos.z - pz;
        const d2 = wx * wx + wz * wz;
        holo.visible = d2 <= nearR2 * 2.2;
        if (holo.visible) {
          const d3 = Math.sqrt(d2 + wy * wy);
          if (d3 < hubHoloDist) hubHoloDist = d3;
        }
      }
      hubHoloHiss.update(dt, hubHoloDist);
      for (const d of ship.autoDoors || []) {
        const h = d.unlockHolo;
        if (!h || !d.locked) continue;
        if (unlockVaporFx?.door === d) continue;
        const dx = px - d.trigger.x;
        const dz = pz - d.trigger.z;
        h.visible = dx * dx + dz * dz <= nearR2;
      }
      for (const wm of ship.anim?.wallMonitors || []) {
        const h = wm.debugHolo;
        if (!h) continue;
        const canShow =
          !wm.debugged &&
          !wm.repairing &&
          wm.room?.userData?.lightMode === "sos" &&
          !(isCockpitWallMonitor(wm) && !briefingScriptDone());
        if (!canShow) {
          h.visible = false;
          continue;
        }
        h.getWorldPosition(holoWorldPos);
        const dx = holoWorldPos.x - px;
        const dz = holoWorldPos.z - pz;
        h.visible = dx * dx + dz * dz <= nearR2;
      }
      // Door lintel glow labels (GARDEN / DINER / …) — hide when far
      if (ship.root && (frame & 3) === 0) {
        ship.root.traverse((o) => {
          if (!o?.userData?.doorOverLabel) return;
          o.getWorldPosition(holoWorldPos);
          const dx = holoWorldPos.x - px;
          const dz = holoWorldPos.z - pz;
          o.visible = dx * dx + dz * dz <= nearR2 * 1.6;
        });
      }
    }
    if (ship.anim.sosActive && (!mobileQuality || (frame & 1) === 0)) {
      const hubStillSos = (ship.anim.sosRooms || []).some(
        (r) =>
          r?.userData?.label === "Hub" && r.userData.lightMode === "sos"
      );
      updateSosLights(ship.anim.sosRooms, t, ship.anim.hubNeon, hubStillSos);
    }
    updateWallMonitorSosPulse(ship.anim, t);
    updateSosCeilingSparks(sosSparks, dt, roomAtPlayer(), player.position, {
      active: player.locked && !yearTransit,
      mobile: mobileQuality,
    });
    pumpPendingSosRestore(ship.anim);
    updatePlants(ship.anim, t);
    updateSleepingCrew(ship.anim?.sleepingCrew, t, player.position, 22, dt);
    {
      const crew = ship.anim?.sleepingCrew;
      let hoverT = 0;
      if (crew) {
        for (let i = 0; i < crew.length; i++) {
          const ht = crew[i]?.userData?.sleep?.hoverT || 0;
          if (ht > hoverT) hoverT = ht;
        }
      }
      sleeperHoverHum.update(dt, hoverT);
    }
    updateAwakeCrew(ship.anim?.sleepingCrew, dt, t, ship.autoDoors, player.position);
    updateSittingCrew(ship.anim?.sleepingCrew, dt, t, player.position);
    updateNpcChitchat(ship.anim?.sleepingCrew, dt, player.position);
    updateNpcWiggle(ship.anim?.sleepingCrew, dt);
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

      // Safety net if Scene 1 briefing somehow never started
      if (player.locked && !ud.introPlaying && status?.needsAlertStart?.()) {
        tryStartBriefingByProximity();
      }

      const unfinished =
        ud.introPlaying ||
        (ud.mode === "default" && status?.hasUnfinishedDialogue?.());

      // 1) Dialogue claims — briefing only (Info Hub has no HUD welcome)
      if (unfinished && near) {
        hudPrompt.setDialogue({ id: "ai-brief", text: null });
        hudPrompt.clearDialogue("info-hub");
      } else {
        hudPrompt.clearDialogue("ai-brief");
        hudPrompt.clearDialogue("info-hub");
      }

      // 2) Nearby interaction — stalls only (console/outside/reset = desk holos)
      let nearby = null;
      let nearbyTap = null;
      if (player.locked && !hudPrompt.hasDialogue) {
        const blockCockpitExit =
          briefingScriptDone() &&
          !cockpitSideMonitorsDebugged() &&
          player.position.z < 18.4 &&
          Math.abs(player.position.x) < 3.2;
        if (blockCockpitExit) {
          if (cockpitExitKey !== "exit") {
            cockpitExitKey = "exit";
            cockpitExitLine = pickCockpitExitLine();
            playGlassDenied();
            flashCockpitAccessDenied();
            const line = cockpitExitLine;
            setTimeout(() => shipVoice.trySpeak(line), 280);
          }
          nearby = cockpitExitLine;
        } else {
          cockpitExitKey = null;
          cockpitExitLine = null;
          const sealed = nearestLockedDoor(ship.autoDoors, player.position);
          if (sealed) {
            if (sealed.key !== lockedDoorKey) {
              lockedDoorKey = sealed.key;
              lockedDoorLine =
                LOCKED_DOOR_LINES[(Math.random() * LOCKED_DOOR_LINES.length) | 0];
              playGlassDenied();
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
            }
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
