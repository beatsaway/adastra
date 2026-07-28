import * as THREE from "three";

const KEYS = new Set();

window.addEventListener("keydown", (e) => {
  KEYS.add(e.code);
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
    e.preventDefault();
  }
});
window.addEventListener("keyup", (e) => KEYS.delete(e.code));
window.addEventListener("blur", () => KEYS.clear());

function resolveCircleAABB(px, pz, r, box) {
  const nearestX = Math.max(box.min.x, Math.min(px, box.max.x));
  const nearestZ = Math.max(box.min.z, Math.min(pz, box.max.z));
  let dx = px - nearestX;
  let dz = pz - nearestZ;
  const dist2 = dx * dx + dz * dz;
  if (dist2 >= r * r || dist2 === 0) {
    // inside box: push out via smallest axis
    if (px > box.min.x && px < box.max.x && pz > box.min.z && pz < box.max.z) {
      const left = px - box.min.x;
      const right = box.max.x - px;
      const near = pz - box.min.z;
      const far = box.max.z - pz;
      const m = Math.min(left, right, near, far);
      if (m === left) return { x: box.min.x - r, z: pz };
      if (m === right) return { x: box.max.x + r, z: pz };
      if (m === near) return { x: px, z: box.min.z - r };
      return { x: px, z: box.max.z + r };
    }
    return null;
  }
  const dist = Math.sqrt(dist2);
  const push = (r - dist) / dist;
  return { x: px + dx * push, z: pz + dz * push };
}

export class Player {
  constructor(camera, colliders, spawn) {
    this.camera = camera;
    this.colliders = colliders;
    this.radius = 0.35;
    this.eye = 1.65;
    this.speed = 5.2;
    this.sprintMul = 1.75;
    this.yaw = Math.PI;
    this.pitch = -0.22;
    this.position = spawn.clone();
    this.position.y = this.eye;
    this.locked = false;
    this.stickX = 0;
    this.stickY = 0;
    this.lookStickX = 0;
    this.lookStickY = 0;
    this.mobileSprint = false;
    this._onMove = this._onMove.bind(this);

    document.addEventListener("mousemove", this._onMove);
  }

  _onMove(e) {
    if (!this.locked) return;
    this.look(e.movementX, e.movementY);
  }

  look(dx, dy) {
    this.yaw -= dx * 0.0022;
    this.pitch -= dy * 0.0022;
    this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch));
  }

  setLocked(v) {
    this.locked = v;
  }

  update(dt) {
    if (!this.locked) {
      this._applyCamera();
      return;
    }

    // right virtual stick — continuous look
    if (this.lookStickX || this.lookStickY) {
      const lookRate = 4.4;
      this.look(this.lookStickX * lookRate * 60 * dt, this.lookStickY * lookRate * 60 * dt);
    }

    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    let mx = 0;
    let mz = 0;
    if (KEYS.has("KeyW") || KEYS.has("ArrowUp")) {
      mx += forward.x;
      mz += forward.z;
    }
    if (KEYS.has("KeyS") || KEYS.has("ArrowDown")) {
      mx -= forward.x;
      mz -= forward.z;
    }
    if (KEYS.has("KeyA") || KEYS.has("ArrowLeft")) {
      mx -= right.x;
      mz -= right.z;
    }
    if (KEYS.has("KeyD") || KEYS.has("ArrowRight")) {
      mx += right.x;
      mz += right.z;
    }

    // mobile thumbstick (x = strafe, y = forward)
    if (this.stickX || this.stickY) {
      mx += right.x * this.stickX + forward.x * this.stickY;
      mz += right.z * this.stickX + forward.z * this.stickY;
    }

    const len = Math.hypot(mx, mz);
    if (len > 0) {
      mx /= len;
      mz /= len;
      const sprint = KEYS.has("ShiftLeft") || KEYS.has("ShiftRight") || this.mobileSprint;
      const sp = this.speed * (sprint ? this.sprintMul : 1) * dt;
      this._move(mx * sp, mz * sp);
    }

    this.position.y = this.eye;
    this._applyCamera();
  }

  _move(dx, dz) {
    const bodyMinY = 0.15;
    const bodyMaxY = 1.75;
    const solid = (c) => c.min.y < bodyMaxY && c.max.y > bodyMinY;

    let x = this.position.x + dx;
    let z = this.position.z;
    for (const c of this.colliders) {
      if (!solid(c)) continue;
      const hit = resolveCircleAABB(x, z, this.radius, c);
      if (hit) {
        x = hit.x;
        z = hit.z;
      }
    }
    z = z + dz;
    for (const c of this.colliders) {
      if (!solid(c)) continue;
      const hit = resolveCircleAABB(x, z, this.radius, c);
      if (hit) {
        x = hit.x;
        z = hit.z;
      }
    }
    this.position.x = x;
    this.position.z = z;
  }

  _applyCamera() {
    this.camera.position.copy(this.position);
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  roomLabel(zones) {
    const x = this.position.x;
    const z = this.position.z;
    for (const zone of zones) {
      const b = zone.bounds;
      if (!b) continue;
      if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) {
        return zone.label || "";
      }
    }
    return "Aboard";
  }
}
