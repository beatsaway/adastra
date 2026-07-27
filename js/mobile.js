/** Roblox-style mobile: left stick move, right drag look, action buttons. */

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
  const joyZone = root.querySelector("#joy-zone");
  const joyBase = root.querySelector("#joy-base");
  const joyKnob = root.querySelector("#joy-knob");
  const lookZone = root.querySelector("#look-zone");
  const btnSprint = root.querySelector("#btn-sprint");
  const btnInteract = root.querySelector("#btn-interact");

  const maxR = 48;
  let joyId = null;
  let lookId = null;
  let lastLookX = 0;
  let lastLookY = 0;
  let baseX = 0;
  let baseY = 0;

  function setStick(nx, ny) {
    player.stickX = nx;
    player.stickY = ny;
    joyKnob.style.transform = `translate(${nx * maxR}px, ${ny * maxR}px)`;
  }

  function resetStick() {
    joyId = null;
    setStick(0, 0);
    joyBase.classList.remove("active");
  }

  joyZone.addEventListener(
    "touchstart",
    (e) => {
      if (joyId != null) return;
      const t = e.changedTouches[0];
      joyId = t.identifier;
      const rect = joyZone.getBoundingClientRect();
      const cx = Math.min(Math.max(t.clientX - rect.left, 56), rect.width - 56);
      const cy = Math.min(Math.max(t.clientY - rect.top, 56), rect.height - 56);
      joyBase.style.left = `${cx}px`;
      joyBase.style.top = `${cy}px`;
      baseX = rect.left + cx;
      baseY = rect.top + cy;
      joyBase.classList.add("active");
      setStick(0, 0);
      e.preventDefault();
    },
    { passive: false },
  );

  joyZone.addEventListener(
    "touchmove",
    (e) => {
      if (joyId == null) return;
      for (const t of e.changedTouches) {
        if (t.identifier !== joyId) continue;
        let dx = t.clientX - baseX;
        let dy = t.clientY - baseY;
        const len = Math.hypot(dx, dy) || 1;
        if (len > maxR) {
          dx = (dx / len) * maxR;
          dy = (dy / len) * maxR;
        }
        setStick(dx / maxR, -dy / maxR);
        e.preventDefault();
      }
    },
    { passive: false },
  );

  const endJoy = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) resetStick();
    }
  };
  joyZone.addEventListener("touchend", endJoy);
  joyZone.addEventListener("touchcancel", endJoy);

  lookZone.addEventListener(
    "touchstart",
    (e) => {
      if (lookId != null) return;
      const t = e.changedTouches[0];
      lookId = t.identifier;
      lastLookX = t.clientX;
      lastLookY = t.clientY;
      e.preventDefault();
    },
    { passive: false },
  );

  lookZone.addEventListener(
    "touchmove",
    (e) => {
      if (lookId == null) return;
      for (const t of e.changedTouches) {
        if (t.identifier !== lookId) continue;
        const dx = t.clientX - lastLookX;
        const dy = t.clientY - lastLookY;
        lastLookX = t.clientX;
        lastLookY = t.clientY;
        player.look(dx * 1.55, dy * 1.55);
        e.preventDefault();
      }
    },
    { passive: false },
  );

  const endLook = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === lookId) lookId = null;
    }
  };
  lookZone.addEventListener("touchend", endLook);
  lookZone.addEventListener("touchcancel", endLook);

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
      resetStick();
      player.mobileSprint = false;
    },
  };
}
