/** Dual circle sticks for mobile: left = move, right = look. */

/** True only for phones/tablets — not touchscreen laptops with a mouse. */
export function isTouchDevice() {
  // Windows / Chromebook touch laptops often report ontouchstart + maxTouchPoints > 0.
  // Those still have a fine pointer; treating them as mobile skips pointer-lock and
  // mouse look dies at the screen edge (~180° turn). Prefer mouse/FPS when available.
  const fine = window.matchMedia("(pointer: fine)").matches;
  if (fine) return false;
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    window.matchMedia("(hover: none)").matches ||
    ((navigator.maxTouchPoints || 0) > 0 && "ontouchstart" in window)
  );
}

/**
 * @param {{
 *   player: import("./player.js").Player,
 *   root: HTMLElement,
 * }} opts
 */
export function setupMobileControls({ player, root }) {
  const moveZone = root.querySelector("#move-zone");
  const moveBase = root.querySelector("#move-base");
  const moveKnob = root.querySelector("#move-knob");
  const lookZone = root.querySelector("#look-zone");
  const lookBase = root.querySelector("#look-base");
  const lookKnob = root.querySelector("#look-knob");

  let moveId = null;
  let lookId = null;
  let moveOriginX = 0;
  let moveOriginY = 0;
  let lookOriginX = 0;
  let lookOriginY = 0;

  /** Travel radius scales with current stick base size (viewport %). */
  function travelR(base) {
    const w = base.getBoundingClientRect().width;
    return Math.max(10, w * 0.39);
  }

  function setMove(nx, ny) {
    player.stickX = nx;
    player.stickY = ny;
    const r = travelR(moveBase);
    moveKnob.style.transform = `translate(${nx * r}px, ${-ny * r}px)`;
  }

  function setLook(nx, ny) {
    player.lookStickX = nx;
    player.lookStickY = ny;
    const r = travelR(lookBase);
    lookKnob.style.transform = `translate(${nx * r}px, ${ny * r}px)`;
  }

  function bindStick(zone, base, onSet, getId, setId, getOx, setOx, getOy, setOy, invertY) {
    zone.addEventListener(
      "touchstart",
      (e) => {
        if (getId() != null) return;
        const t = e.changedTouches[0];
        setId(t.identifier);
        const rect = base.getBoundingClientRect();
        setOx(rect.left + rect.width * 0.5);
        setOy(rect.top + rect.height * 0.5);
        base.classList.add("active");
        onSet(0, 0);
        e.preventDefault();
      },
      { passive: false },
    );

    zone.addEventListener(
      "touchmove",
      (e) => {
        const id = getId();
        if (id == null) return;
        const maxR = travelR(base);
        for (const t of e.changedTouches) {
          if (t.identifier !== id) continue;
          let dx = t.clientX - getOx();
          let dy = t.clientY - getOy();
          const len = Math.hypot(dx, dy) || 1;
          if (len > maxR) {
            dx = (dx / len) * maxR;
            dy = (dy / len) * maxR;
          }
          const nx = dx / maxR;
          const ny = invertY ? -(dy / maxR) : dy / maxR;
          onSet(nx, ny);
          e.preventDefault();
        }
      },
      { passive: false },
    );

    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === getId()) {
          setId(null);
          onSet(0, 0);
          base.classList.remove("active");
        }
      }
    };
    zone.addEventListener("touchend", end);
    zone.addEventListener("touchcancel", end);
  }

  bindStick(
    moveZone,
    moveBase,
    setMove,
    () => moveId,
    (v) => {
      moveId = v;
    },
    () => moveOriginX,
    (v) => {
      moveOriginX = v;
    },
    () => moveOriginY,
    (v) => {
      moveOriginY = v;
    },
    true,
  );

  bindStick(
    lookZone,
    lookBase,
    setLook,
    () => lookId,
    (v) => {
      lookId = v;
    },
    () => lookOriginX,
    (v) => {
      lookOriginX = v;
    },
    () => lookOriginY,
    (v) => {
      lookOriginY = v;
    },
    false,
  );

  return {
    show() {
      root.classList.remove("hidden");
    },
    hide() {
      root.classList.add("hidden");
      setMove(0, 0);
      setLook(0, 0);
      player.mobileSprint = false;
      moveBase.classList.remove("active");
      lookBase.classList.remove("active");
    },
  };
}
