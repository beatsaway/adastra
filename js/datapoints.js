/**
 * Ship data-point wallet (Ad Astra demo).
 * Starts with 1000 available — no curriculum API required.
 * Door unlock / wall-monitor debug cost is fixed at 30.
 */

export const DOOR_UNLOCK_COST = 30;
export const MONITOR_DEBUG_COST = 30;

/** Demo starting balance (available before any spend). */
export const DEMO_STARTING_DATAPOINTS = 1000;

const SPENT_KEY = "adastra-ship-dp-spent";
const UNLOCKED_KEY = "adastra-ship-unlocked-doors";
const DEBUGGED_MONITORS_KEY = "adastra-ship-debugged-monitors";

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
}

/**
 * Ad Astra demo wallet: always start from DEMO_STARTING_DATAPOINTS.
 * Optional /api/scores can only raise the total further.
 */
export async function fetchCollectedDatapoints() {
  let fromApi = 0;
  try {
    const res = await fetch("/api/scores", { credentials: "same-origin" });
    if (res.ok) {
      const data = await res.json();
      if (typeof data.totalDatapoints === "number") {
        fromApi = Math.max(0, Math.floor(data.totalDatapoints));
      } else {
        const scores = Array.isArray(data.scores) ? data.scores : [];
        fromApi = scores.reduce((sum, s) => sum + datapointsForPct(s.pct), 0);
      }
    }
  } catch (_) {
    /* standalone demo — no API is fine */
  }
  return Math.max(DEMO_STARTING_DATAPOINTS, fromApi);
}

export function availableDatapoints(collected, spent = getSpentDatapoints()) {
  return Math.max(0, (Number(collected) || 0) - (Number(spent) || 0));
}

/**
 * Clear ship-side wallet / unlocks / monitor debug only.
 * Resets spend so the demo 1000 is available again.
 */
export function clearShipDatapointUsage() {
  try {
    localStorage.removeItem(SPENT_KEY);
    localStorage.removeItem(UNLOCKED_KEY);
    localStorage.removeItem(DEBUGGED_MONITORS_KEY);
  } catch (_) {}
}
