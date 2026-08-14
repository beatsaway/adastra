/**
 * Cheap SOS ceiling sparks — welding-style pops, not drip trails.
 * Points spray from a fixture; a brief star-crack flashes at the origin.
 */
import * as THREE from "three";

const MAX_DOTS = 22;
const MAX_CRACKS = 10;
const CRACK_VERTS = MAX_CRACKS * 2;

function sparkDotTex() {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, "rgba(255,255,250,1)");
  grd.addColorStop(0.22, "rgba(255,220,140,0.85)");
  grd.addColorStop(0.55, "rgba(255,140,50,0.28)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSosCeilingSparks(parent) {
  const cPos = new Float32Array(CRACK_VERTS * 3);
  const cCol = new Float32Array(CRACK_VERTS * 3);
  const crackGeo = new THREE.BufferGeometry();
  crackGeo.setAttribute("position", new THREE.BufferAttribute(cPos, 3));
  crackGeo.setAttribute("color", new THREE.BufferAttribute(cCol, 3));
  const cracks = new THREE.LineSegments(
    crackGeo,
    new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
  );
  cracks.frustumCulled = false;
  cracks.renderOrder = 6;

  const dPos = new Float32Array(MAX_DOTS * 3);
  const dCol = new Float32Array(MAX_DOTS * 3);
  const dotGeo = new THREE.BufferGeometry();
  dotGeo.setAttribute("position", new THREE.BufferAttribute(dPos, 3));
  dotGeo.setAttribute("color", new THREE.BufferAttribute(dCol, 3));
  const dots = new THREE.Points(
    dotGeo,
    new THREE.PointsMaterial({
      size: 0.16,
      map: sparkDotTex(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      sizeAttenuation: true,
    })
  );
  dots.frustumCulled = false;
  dots.renderOrder = 7;

  const group = new THREE.Group();
  group.add(cracks, dots);
  parent.add(group);

  const embers = new Array(MAX_DOTS);
  for (let i = 0; i < MAX_DOTS; i++) {
    embers[i] = {
      alive: false,
      x: 0, y: 0, z: 0,
      vx: 0, vy: 0, vz: 0,
      age: 0, life: 0.3,
      cool: 0,
    };
  }
  const rays = new Array(MAX_CRACKS);
  for (let i = 0; i < MAX_CRACKS; i++) {
    rays[i] = {
      alive: false,
      x: 0, y: 0, z: 0,
      dx: 0, dy: 0, dz: 0,
      age: 0, life: 0.12,
      cool: 0,
    };
  }

  return {
    group,
    cracks,
    dots,
    cPos,
    cCol,
    dPos,
    dCol,
    embers,
    rays,
    wait: 0.4,
    onBurst: null,
  };
}

function hideRay(sys, i) {
  const o = i * 6;
  sys.cPos.fill(0, o, o + 6);
  sys.cCol.fill(0, o, o + 6);
}

function hideDot(sys, i) {
  const d = i * 3;
  sys.dPos[d] = 0;
  sys.dPos[d + 1] = -40;
  sys.dPos[d + 2] = 0;
  sys.dCol[d] = sys.dCol[d + 1] = sys.dCol[d + 2] = 0;
}

function spawnRay(sys, x, y, z, cool) {
  for (let i = 0; i < sys.rays.length; i++) {
    const r = sys.rays[i];
    if (r.alive) continue;
    const az = Math.random() * Math.PI * 2;
    const dip = 0.15 + Math.random() * 0.7;
    const len = 0.16 + Math.random() * 0.22;
    r.alive = true;
    r.x = x;
    r.y = y;
    r.z = z;
    r.dx = Math.cos(az) * Math.cos(dip) * len;
    r.dy = -Math.sin(dip) * len;
    r.dz = Math.sin(az) * Math.cos(dip) * len;
    r.age = 0;
    r.life = 0.08 + Math.random() * 0.07;
    r.cool = cool;
    return true;
  }
  return false;
}

function spawnEmber(sys, x, y, z, cool) {
  for (let i = 0; i < sys.embers.length; i++) {
    const s = sys.embers[i];
    if (s.alive) continue;
    const az = Math.random() * Math.PI * 2;
    const spd = 0.7 + Math.random() * 1.6;
    s.alive = true;
    s.x = x;
    s.y = y;
    s.z = z;
    s.vx = Math.cos(az) * spd * (0.35 + Math.random() * 0.8);
    s.vy = -0.2 - Math.random() * 1.4;
    s.vz = Math.sin(az) * spd * (0.35 + Math.random() * 0.8);
    s.age = 0;
    s.life = 0.22 + Math.random() * 0.2;
    s.cool = cool;
    return true;
  }
  return false;
}

function pickOrigin(room, px, pz) {
  const b = room.bounds;
  const dims = room.dims;
  if (!b || !dims) return null;
  const insetX = Math.min(0.9, Math.max(0.28, (b.maxX - b.minX) * 0.18));
  const insetZ = Math.min(0.9, Math.max(0.28, (b.maxZ - b.minZ) * 0.18));
  let x = b.minX + insetX + Math.random() * Math.max(0.2, b.maxX - b.minX - insetX * 2);
  let z = b.minZ + insetZ + Math.random() * Math.max(0.2, b.maxZ - b.minZ - insetZ * 2);
  const dx = x - px;
  const dz = z - pz;
  if (dx * dx + dz * dz < 1.6) {
    const s = Math.hypot(dx, dz) || 1;
    x = px + (dx / s) * 2.2;
    z = pz + (dz / s) * 2.2;
    x = Math.max(b.minX + insetX, Math.min(b.maxX - insetX, x));
    z = Math.max(b.minZ + insetZ, Math.min(b.maxZ - insetZ, z));
  }
  return { x, y: dims.h - 0.08, z };
}

function spawnBurst(sys, room, px, pz) {
  const o = pickOrigin(room, px, pz);
  if (!o) return -1;
  const cool = Math.random() > 0.5 ? 1 : 0;
  const rays = 3 + ((Math.random() * 3) | 0);
  const n = 4 + ((Math.random() * 4) | 0);
  for (let i = 0; i < rays; i++) spawnRay(sys, o.x, o.y, o.z, cool);
  for (let i = 0; i < n; i++) {
    spawnEmber(
      sys,
      o.x + (Math.random() - 0.5) * 0.08,
      o.y,
      o.z + (Math.random() - 0.5) * 0.08,
      cool
    );
  }
  return Math.hypot(px - o.x, pz - o.z);
}

export function updateSosCeilingSparks(sys, dt, room, playerPos, opts = {}) {
  if (!sys) return;
  const active = !!opts.active && room?.lightMode === "sos";
  const mobile = !!opts.mobile;

  if (active) {
    sys.wait -= dt;
    if (sys.wait <= 0) {
      sys.wait = mobile ? 0.75 + Math.random() * 1.2 : 0.4 + Math.random() * 0.9;
      const dist = spawnBurst(sys, room, playerPos.x, playerPos.z);
      let dist2 = -1;
      if (Math.random() < 0.5) dist2 = spawnBurst(sys, room, playerPos.x, playerPos.z);
      const near = dist >= 0 && dist < 11 ? dist : dist2;
      if (near >= 0 && near < 11 && sys.onBurst && Math.random() < 0.5) {
        sys.onBurst(near);
      }
    }
  } else if (sys.wait < 0.45) {
    sys.wait = 0.45;
  }

  let any = false;
  let dirtyC = false;
  let dirtyD = false;
  const maxDots = mobile ? 14 : MAX_DOTS;
  const maxRays = mobile ? 6 : MAX_CRACKS;

  for (let i = 0; i < sys.rays.length; i++) {
    const r = sys.rays[i];
    if (!r.alive) continue;
    if (i >= maxRays) {
      r.alive = false;
      hideRay(sys, i);
      dirtyC = true;
      continue;
    }
    r.age += dt;
    if (r.age >= r.life) {
      r.alive = false;
      hideRay(sys, i);
      dirtyC = true;
      continue;
    }
    any = true;
    dirtyC = true;
    const u = r.age / r.life;
    const fade = 1 - u * u;
    const grow = 0.65 + u * 0.55;
    const o = i * 6;
    sys.cPos[o] = r.x;
    sys.cPos[o + 1] = r.y;
    sys.cPos[o + 2] = r.z;
    sys.cPos[o + 3] = r.x + r.dx * grow;
    sys.cPos[o + 4] = r.y + r.dy * grow;
    sys.cPos[o + 5] = r.z + r.dz * grow;
    const tr = r.cool ? 0.7 : 1;
    const tg = r.cool ? 0.9 : 0.85;
    const tb = r.cool ? 1 : 0.55;
    sys.cCol[o] = tr * fade;
    sys.cCol[o + 1] = tg * fade;
    sys.cCol[o + 2] = tb * fade;
    sys.cCol[o + 3] = tr * fade * 0.15;
    sys.cCol[o + 4] = tg * fade * 0.15;
    sys.cCol[o + 5] = tb * fade * 0.15;
  }

  for (let i = 0; i < sys.embers.length; i++) {
    const s = sys.embers[i];
    if (!s.alive) continue;
    if (i >= maxDots) {
      s.alive = false;
      hideDot(sys, i);
      dirtyD = true;
      continue;
    }
    s.age += dt;
    if (s.age >= s.life) {
      s.alive = false;
      hideDot(sys, i);
      dirtyD = true;
      continue;
    }
    any = true;
    dirtyD = true;
    s.vy -= 6.5 * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.z += s.vz * dt;
    const fade = 1 - (s.age / s.life) ** 1.4;
    const d = i * 3;
    sys.dPos[d] = s.x;
    sys.dPos[d + 1] = s.y;
    sys.dPos[d + 2] = s.z;
    sys.dCol[d] = (s.cool ? 0.65 : 1) * fade;
    sys.dCol[d + 1] = (s.cool ? 0.88 : 0.72) * fade;
    sys.dCol[d + 2] = (s.cool ? 1 : 0.38) * fade;
  }

  if (dirtyC) {
    sys.cracks.geometry.attributes.position.needsUpdate = true;
    sys.cracks.geometry.attributes.color.needsUpdate = true;
  }
  if (dirtyD) {
    sys.dots.geometry.attributes.position.needsUpdate = true;
    sys.dots.geometry.attributes.color.needsUpdate = true;
  }
  sys.group.visible = any || active;
}
