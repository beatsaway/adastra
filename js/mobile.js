/** Dual circle sticks for mobile: left = move, right = look. */

export function isTouchDevice() {
  return (
    "ontouchstart" in window ||
    (navigator.maxTouchPoints || 0) > 0 ||
    window.matchMedia("(pointer: coarse)").matches
  );
}

/**
 * @param {{
 *   player: import("./player.js").Player,
 *   onInteract: () => void,
 *   root: HTMLElement,
 * }} opts
 */
export function setupMobileControls({ player, onInteract, root }) {
  const moveZone = root.querySelector("#move-zone");
  const moveBase = root.querySelector("#move-base");
  const moveKnob = root.querySelector("#move-knob");
  const lookZone = root.querySelector("#look-zone");
  const lookBase = root.querySelector("#look-base");
  const lookKnob = root.querySelector("#look-knob");
  const btnSprint = root.querySelector("#btn-sprint");
  const btnInteract = root.querySelector("#btn-interact");

  const maxR = 46;
  let moveId = null;
  let lookId = null;
  let moveOriginX = 0;
  let moveOriginY = 0;
  let lookOriginX = 0;
  let lookOriginY = 0;

  function setMove(nx, ny) {
    player.stickX = nx;
    player.stickY = ny;
    moveKnob.style.transform = `translate(${nx * maxR}px, ${-ny * maxR}px)`;
  }

  function setLook(nx, ny) {
    player.lookStickX = nx;
    player.lookStickY = ny;
    lookKnob.style.transform = `translate(${nx * maxR}px, ${ny * maxR}px)`;
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

  const hold = (btn, on, off) => {
    const start = (e) => {
      e.preventDefault();
      on();
      btn.classList.add("active");
    };
    const end = (e) => {
      e.preventDefault();
      off();
      btn.classList.remove("active");
    };
    btn.addEventListener("touchstart", start, { passive: false });
    btn.addEventListener("touchend", end);
    btn.addEventListener("touchcancel", end);
  };

  hold(
    btnSprint,
    () => {
      player.mobileSprint = true;
    },
    () => {
      player.mobileSprint = false;
    },
  );

  btnInteract.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      btnInteract.classList.add("active");
      onInteract();
    },
    { passive: false },
  );
  btnInteract.addEventListener("touchend", () => btnInteract.classList.remove("active"));
  btnInteract.addEventListener("touchcancel", () => btnInteract.classList.remove("active"));

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
