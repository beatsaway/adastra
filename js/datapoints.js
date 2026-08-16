/**
 * Ship data-point wallet (Ad Astra demo).
 * Starts with 1000 available — no curriculum API, login, or cloud save.
 * Door unlock / wall-monitor debug cost is fixed at 30.
 */

export const DOOR_UNLOCK_COST = 30;
export const MONITOR_DEBUG_COST = 30;
export const NPC_ACTIVATE_COST = 30;
export const NPC_ACTIVATE_ROD_DISCOUNT = 10;
export const TOILET_PRINT_COST = 10;
export const TOILET_PRINT_STAFF_DISCOUNT = 5;
/** Extra toilets beyond the one default stall. */
export const PRINTED_TOILET_MAX = 5;
export const ENGINE_ROD_COST = 100;
export const ENGINE_ROD_CENTER_COST = 1000;
export const ENGINE_ROD_STAFF_DISCOUNT = 600;
export const ENGINE_ROD_OFFICER_DISCOUNT = 10;
export const ENGINE_ROD_OFFICER_DISCOUNT_MAX = 5;
export const TREE_GROW_COST = 20;
export const TREE_GROW_MAX = 12;
export const TREE_HARVEST_PER_TREE = 1;

/** Next tree: 20, 20, 20, then 40×3, 80×3, 160×3. */
export function treeGrowCost(grownCount = getGrownTreeCount()) {
  const i = Math.max(0, Math.floor(Number(grownCount) || 0));
  if (i < 3) return 20;
  if (i < 6) return 40;
  if (i < 9) return 80;
  return 160;
}
export const GARDEN_MAX_GARDENERS = 3;
/** Unstaffed diner reassign. A chef on duty makes this 0. */
export const NPC_ROLE_CHANGE_COST = 5;
/** Shared reset: Monday 00:00 UTC. Same week for every captain. No server clock. */
const GARDEN_HARVEST_WEEK_KEY = "adastra-ship-garden-harvest-week";
export const NPC_QUOTA_BASE = 2;
export const NPC_QUOTA_PER_TOILET = 2;
/** Demo starting balance (available before any spend). */
export const DEMO_STARTING_DATAPOINTS = 1000;
/** Signed-in captains start with at least this many collected points. */
export const SIGNED_IN_STARTING_POINTS = 100;

const SPENT_KEY = "adastra-ship-dp-spent";
const UNLOCKED_KEY = "adastra-ship-unlocked-doors";
const DEBUGGED_MONITORS_KEY = "adastra-ship-debugged-monitors";
const ACTIVATED_NPC_KEY = "adastra-ship-activated-npcs";
const PRINTED_TOILETS_KEY = "adastra-ship-printed-toilets";
const REPAIRED_RODS_KEY = "adastra-ship-repaired-rods";
const GROWN_TREES_KEY = "adastra-ship-grown-trees";
const GARDEN_HARVEST_BONUS_KEY = "adastra-ship-garden-harvest-bonus";
const NPC_JOBS_KEY = "adastra-ship-npc-jobs";

export function datapointsForPct(pct) {
  const p = Number(pct);
  if (!Number.isFinite(p)) return 0;
  if (p >= 100) return 15;
  if (p >= 60) return 10;
  if (p >= 30) return 5;
  return 0;
}

export function getSpentDatapoints() {
  try {
    const n = Number(localStorage.getItem(SPENT_KEY) || 0);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch (_) {
    return 0;
  }
}

export function addSpentDatapoints(n) {
  const add = Math.max(0, Math.floor(Number(n) || 0));
  if (!add) return getSpentDatapoints();
  const next = getSpentDatapoints() + add;
  try {
    localStorage.setItem(SPENT_KEY, String(next));
  } catch (_) {}
  bumpShipState();
  return next;
}

export function getUnlockedDoorKeys() {
  try {
    const raw = localStorage.getItem(UNLOCKED_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch (_) {
    return [];
  }
}

export function markDoorUnlocked(key) {
  if (!key) return;
  const set = new Set(getUnlockedDoorKeys());
  set.add(String(key));
  try {
    localStorage.setItem(UNLOCKED_KEY, JSON.stringify([...set]));
  } catch (_) {}
  bumpShipState();
}

export function isDoorUnlocked(key) {
  return getUnlockedDoorKeys().includes(String(key));
}

export function getDebuggedMonitorIds() {
  try {
    const raw = localStorage.getItem(DEBUGGED_MONITORS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch (_) {
    return [];
  }
}

export function isMonitorDebugged(id) {
  return !!id && getDebuggedMonitorIds().includes(String(id));
}

export function markMonitorDebugged(id) {
  if (!id) return;
  const set = new Set(getDebuggedMonitorIds());
  set.add(String(id));
  try {
    localStorage.setItem(DEBUGGED_MONITORS_KEY, JSON.stringify([...set]));
  } catch (_) {}
  bumpShipState();
}

export function getActivatedNpcIds() {
  try {
    const raw = localStorage.getItem(ACTIVATED_NPC_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch (_) {
    return [];
  }
}

export function isNpcActivated(id) {
  return !!id && getActivatedNpcIds().includes(String(id));
}

export function getPrintedToiletCount() {
  try {
    const n = Number(localStorage.getItem(PRINTED_TOILETS_KEY) || 0);
    return Number.isFinite(n) && n > 0 ? Math.min(PRINTED_TOILET_MAX, Math.floor(n)) : 0;
  } catch (_) {
    return 0;
  }
}

export function addPrintedToilet() {
  const next = Math.min(PRINTED_TOILET_MAX, getPrintedToiletCount() + 1);
  try {
    localStorage.setItem(PRINTED_TOILETS_KEY, String(next));
  } catch (_) {}
  bumpShipState();
  return next;
}

/** One default toilet = 2 active crew. Each extra printed toilet adds 2 more. */
export function npcActivateQuota() {
  return NPC_QUOTA_BASE + getPrintedToiletCount() * NPC_QUOTA_PER_TOILET;
}

export function getRepairedEngineRodIds() {
  try {
    const raw = localStorage.getItem(REPAIRED_RODS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch (_) {
    return [];
  }
}

export function isEngineRodRepaired(id) {
  return !!id && getRepairedEngineRodIds().includes(String(id));
}

export function getGrownTreeCount() {
  try {
    const n = Number(localStorage.getItem(GROWN_TREES_KEY) || 0);
    return Number.isFinite(n) && n > 0 ? Math.min(TREE_GROW_MAX, Math.floor(n)) : 0;
  } catch (_) {
    return 0;
  }
}

export function addGrownTree() {
  const next = Math.min(TREE_GROW_MAX, getGrownTreeCount() + 1);
  try {
    localStorage.setItem(GROWN_TREES_KEY, String(next));
  } catch (_) {}
  bumpShipState();
  return next;
}

export function getGardenHarvestBonus() {
  try {
    const n = Number(localStorage.getItem(GARDEN_HARVEST_BONUS_KEY) || 0);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch (_) {
    return 0;
  }
}

/** Monday 00:00 UTC of a harvest week, as YYYY-MM-DD. */
export function gardenHarvestWeekId(now = Date.now()) {
  const d = new Date(now);
  const utc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const day = new Date(utc).getUTCDay(); // 0 Sun … 1 Mon
  const mondayShift = day === 0 ? -6 : 1 - day;
  const monday = new Date(utc + mondayShift * 86400000);
  const y = monday.getUTCFullYear();
  const m = String(monday.getUTCMonth() + 1).padStart(2, "0");
  const dayNum = String(monday.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dayNum}`;
}

function getGardenHarvestWeek() {
  try {
    return String(localStorage.getItem(GARDEN_HARVEST_WEEK_KEY) || "");
  } catch (_) {
    return "";
  }
}

/** Local Monday week id. No server clock in the standalone demo. */
export async function fetchGardenHarvestWeek() {
  return gardenHarvestWeekId();
}

export function getNpcJobs() {
  try {
    const raw = localStorage.getItem(NPC_JOBS_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === "object" ? obj : {};
  } catch (_) {
    return {};
  }
}

export function getNpcJob(id) {
  const jobs = getNpcJobs();
  const w = jobs[String(id || "")];
  return typeof w === "string" && w ? w : "";
}

export function setNpcJob(id, work) {
  if (!id || !work) return;
  const jobs = getNpcJobs();
  jobs[String(id)] = String(work);
  try {
    localStorage.setItem(NPC_JOBS_KEY, JSON.stringify(jobs));
  } catch (_) {}
  bumpShipState();
}

export function toiletPrintCost() {
  const n = activeCrewWorkCount("washroom");
  return Math.max(0, TOILET_PRINT_COST - n * TOILET_PRINT_STAFF_DISCOUNT);
}

export function npcRoleChangeCost() {
  return activeCrewWorkCount("diner") > 0 ? 0 : NPC_ROLE_CHANGE_COST;
}

export function engineRodCost(rod) {
  const center = !!(rod?.center || rod?.id === "engine-rod-4");
  let base = center ? ENGINE_ROD_CENTER_COST : ENGINE_ROD_COST;
  if (center) {
    const techs = activeCrewWorkCount("engine");
    base = Math.max(0, base - techs * ENGINE_ROD_STAFF_DISCOUNT);
  }
  const officers = cockpitOfficerCount();
  return Math.max(0, base - officers * ENGINE_ROD_OFFICER_DISCOUNT);
}

export function npcActivateCost() {
  const rods = getRepairedEngineRodIds().length;
  return Math.max(5, NPC_ACTIVATE_COST - rods * NPC_ACTIVATE_ROD_DISCOUNT);
}

export function activeCrewWorkCount(work) {
  const aliases =
    work === "diner" ? ["diner", "kitchen"] : work === "washroom" ? ["washroom"] : [work];
  const jobs = getNpcJobs();
  let n = 0;
  for (const id of getActivatedNpcIds()) {
    const w = jobs[id] || "";
    if (aliases.includes(w)) n += 1;
  }
  return n;
}

export function cockpitOfficerCount() {
  return Math.min(ENGINE_ROD_OFFICER_DISCOUNT_MAX, activeCrewWorkCount("cockpit"));
}

export function markEngineRodRepaired(id) {
  if (!id) return;
  const set = new Set(getRepairedEngineRodIds());
  set.add(String(id));
  try {
    localStorage.setItem(REPAIRED_RODS_KEY, JSON.stringify([...set]));
  } catch (_) {}
  bumpShipState();
}

export function markNpcActivated(id) {
  if (!id) return;
  const set = new Set(getActivatedNpcIds());
  set.add(String(id));
  try {
    localStorage.setItem(ACTIVATED_NPC_KEY, JSON.stringify([...set]));
  } catch (_) {}
  bumpShipState();
}

/** Ad Astra demo wallet: always start from DEMO_STARTING_DATAPOINTS. */
export async function fetchCollectedDatapoints() {
  return DEMO_STARTING_DATAPOINTS;
}

export function availableDatapoints(collected, spent = getSpentDatapoints()) {
  return Math.max(
    0,
    (Number(collected) || 0) + getGardenHarvestBonus() - (Number(spent) || 0)
  );
}

function countLocalGardeners() {
  const jobs = getNpcJobs();
  let n = 0;
  for (const id of getActivatedNpcIds()) {
    const work = jobs[id] || "";
    if (work === "garden") n += 1;
  }
  return Math.min(GARDEN_MAX_GARDENERS, n);
}

/** Guest / offline Monday harvest. Signed-in captains use GET /api/ship-state. */
export function claimLocalGardenHarvest() {
  const week = gardenHarvestWeekId();
  const stamped = getGardenHarvestWeek();
  if (stamped === week) return { gained: 0, trees: getGrownTreeCount(), gardeners: countLocalGardeners(), week };
  const trees = getGrownTreeCount();
  const gardeners = countLocalGardeners();
  let gained = 0;
  if (stamped && trees > 0 && gardeners > 0) {
    gained = trees * gardeners * TREE_HARVEST_PER_TREE;
    try {
      localStorage.setItem(GARDEN_HARVEST_BONUS_KEY, String(getGardenHarvestBonus() + gained));
    } catch (_) {}
  }
  try {
    localStorage.setItem(GARDEN_HARVEST_WEEK_KEY, week);
  } catch (_) {}
  return { gained, trees, gardeners, week };
}

/**
 * Clear ship-side wallet / unlocks / monitor debug only.
 * Does NOT touch lesson exercise scores (collected datapoints stay on the server).
 */
export function clearShipDatapointUsage() {
  try {
    localStorage.removeItem(SPENT_KEY);
    localStorage.removeItem(UNLOCKED_KEY);
    localStorage.removeItem(DEBUGGED_MONITORS_KEY);
    localStorage.removeItem(ACTIVATED_NPC_KEY);
    localStorage.removeItem(PRINTED_TOILETS_KEY);
    localStorage.removeItem(REPAIRED_RODS_KEY);
    localStorage.removeItem(GROWN_TREES_KEY);
    localStorage.removeItem(NPC_JOBS_KEY);
    localStorage.setItem(GARDEN_HARVEST_WEEK_KEY, gardenHarvestWeekId());
  } catch (_) {}
  bumpShipState();
}

export function getShipStateSnapshot() {
  return {
    spent: getSpentDatapoints(),
    unlockedDoors: getUnlockedDoorKeys(),
    debuggedMonitors: getDebuggedMonitorIds(),
    activatedNpcs: getActivatedNpcIds(),
    printedToilets: getPrintedToiletCount(),
    repairedRods: getRepairedEngineRodIds(),
    grownTrees: getGrownTreeCount(),
    npcJobs: getNpcJobs(),
  };
}

export function applyShipStateSnapshot(state) {
  if (!state || typeof state !== "object") return;
  const spent = Math.max(0, Math.floor(Number(state.spent) || 0));
  const toilets = Math.max(0, Math.min(PRINTED_TOILET_MAX, Math.floor(Number(state.printedToilets) || 0)));
  const trees = Math.max(0, Math.min(TREE_GROW_MAX, Math.floor(Number(state.grownTrees) || 0)));
  const doors = Array.isArray(state.unlockedDoors) ? state.unlockedDoors.map(String) : [];
  const mons = Array.isArray(state.debuggedMonitors) ? state.debuggedMonitors.map(String) : [];
  const npcs = Array.isArray(state.activatedNpcs) ? state.activatedNpcs.map(String) : [];
  const rods = Array.isArray(state.repairedRods) ? state.repairedRods.map(String) : [];
  const jobs = state.npcJobs && typeof state.npcJobs === "object" ? state.npcJobs : {};
  const harvestBonus = Math.max(0, Math.floor(Number(state.harvestBonus) || 0));
  const harvestWeek = String(state.harvestWeek || "");
  try {
    localStorage.setItem(SPENT_KEY, String(spent));
    localStorage.setItem(UNLOCKED_KEY, JSON.stringify(doors));
    localStorage.setItem(DEBUGGED_MONITORS_KEY, JSON.stringify(mons));
    localStorage.setItem(ACTIVATED_NPC_KEY, JSON.stringify(npcs));
    localStorage.setItem(PRINTED_TOILETS_KEY, String(toilets));
    localStorage.setItem(REPAIRED_RODS_KEY, JSON.stringify(rods));
    localStorage.setItem(GROWN_TREES_KEY, String(trees));
    localStorage.setItem(NPC_JOBS_KEY, JSON.stringify(jobs));
    localStorage.setItem(GARDEN_HARVEST_BONUS_KEY, String(harvestBonus));
    if (harvestWeek) localStorage.setItem(GARDEN_HARVEST_WEEK_KEY, harvestWeek);
  } catch (_) {}
}

let shipCloudOn = false;
let shipSaveTimer = 0;
let shipSaveBusy = false;
let shipSaveAgain = false;

export function enableShipStateCloud(_on) {
  shipCloudOn = false;
}

function bumpShipState() {
  if (!shipCloudOn) return;
  scheduleShipStateSave();
}

export function scheduleShipStateSave() {
  if (!shipCloudOn) return;
  if (shipSaveTimer) clearTimeout(shipSaveTimer);
  shipSaveTimer = setTimeout(() => {
    shipSaveTimer = 0;
    void flushShipStateSave();
  }, 400);
}

export async function pullShipState() {
  return { exists: false, state: null, harvest: null };
}

export async function flushShipStateSave(_opts = {}) {
  return false;
}
