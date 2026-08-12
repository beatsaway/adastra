/**
 * Ship narrative scenes.
 * Scene 1 — Cockpit briefing: player is confined to the cockpit until the
 * AI script finishes. Replay hooks can call start(1) again later.
 */

export const SCENE = {
  COCKPIT_BRIEFING: 1,
};

/** Soft walk bounds for Scene 1 (world XZ) — Cockpit room, south door blocked. */
const SCENE1_BOUNDS = {
  minX: -7.1,
  maxX: 7.1,
  minZ: 17.55,
  maxZ: 25.0,
};

export class ShipScenes {
  /**
   * @param {{ player: { position: { x: number, z: number } }, onChange?: (id: number|null, prev: number|null) => void }} opts
   */
  constructor(opts) {
    this.player = opts.player;
    this.onChange = opts.onChange || null;
    /** @type {number | null} */
    this.current = null;
    /** @type {Set<number>} */
    this.ended = new Set();
  }

  isActive(id) {
    return this.current === id;
  }

  hasEnded(id) {
    return this.ended.has(id);
  }

  /** True while any scene still confines the player. */
  get lockedInScene() {
    return this.current != null;
  }

  start(id) {
    if (this.current === id) return;
    const prev = this.current;
    this.ended.delete(id);
    this.current = id;
    this.onChange?.(id, prev);
  }

  end(id) {
    if (this.current !== id) return;
    const prev = this.current;
    this.current = null;
    this.ended.add(id);
    this.onChange?.(null, prev);
  }

  /** Call after player movement each frame. */
  update() {
    if (this.current === SCENE.COCKPIT_BRIEFING) {
      this._clamp(SCENE1_BOUNDS);
    }
  }

  _clamp(b) {
    const p = this.player.position;
    if (p.x < b.minX) p.x = b.minX;
    if (p.x > b.maxX) p.x = b.maxX;
    if (p.z < b.minZ) p.z = b.minZ;
    if (p.z > b.maxZ) p.z = b.maxZ;
  }
}
