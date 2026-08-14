import * as THREE from "three";
import { shipVoice } from "./ai-voice.js";
import { playBriefStart } from "../sfx/brief.js";
import { isDoorUnlocked as isDoorAlreadyUnlocked, markDoorUnlocked, DOOR_UNLOCK_COST, MONITOR_DEBUG_COST, isMonitorDebugged, isNpcActivated, markNpcActivated } from "./datapoints.js?v=adastra1000";

const WALL = 0xf7f8fa;
const FLOOR = 0xcfd5de;
const CEIL = 0xf2f4f7;
const ACCENT = 0x8a96a8;
const METAL = 0xb8c0cc;
const PANEL = 0xd8dee6;
const GLOW_CYAN = 0x3ec8ff;
const GLOW_ORANGE = 0xff7a33;
const GLOW_GREEN = 0x44ff88;

/** Shared procedural pattern textures (canvas → Three.js) */
const TEX = {};

function canvasTex(key, draw, size = 128) {
  const cacheKey = `${key}_v7`;
  if (TEX[cacheKey]) return TEX[cacheKey];
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d"), size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  TEX[cacheKey] = tex;
  return tex;
}

function patternWallRivets(ctx, s) {
  ctx.fillStyle = "#e6eaef";
  ctx.fillRect(0, 0, s, s);
  const cell = s / 2;
  ctx.strokeStyle = "#b4becb";
  ctx.lineWidth = 4;
  for (let i = 0; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cell + 0.5, 0);
    ctx.lineTo(i * cell + 0.5, s);
    ctx.moveTo(0, i * cell + 0.5);
    ctx.lineTo(s, i * cell + 0.5);
    ctx.stroke();
  }
  ctx.fillStyle = "#9aa6b5";
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 2; x++) {
      for (const [ox, oy] of [[8, 8], [cell - 8, 8], [8, cell - 8], [cell - 8, cell - 8]]) {
        ctx.beginPath();
        ctx.arc(x * cell + ox, y * cell + oy, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function patternWallStripes(ctx, s) {
  // horizontal band accent — bridge / control vibe
  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = "#c5d0de";
  ctx.fillRect(0, s * 0.28, s, s * 0.14);
  ctx.fillStyle = "#9eb6d0";
  ctx.fillRect(0, s * 0.42, s, s * 0.06);
  ctx.strokeStyle = "#b0bcc8";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(s * 0.5, 0);
  ctx.lineTo(s * 0.5, s);
  ctx.stroke();
}

function patternWallHex(ctx, s) {
  ctx.fillStyle = "#e8ece8";
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = "#b8c8b8";
  ctx.lineWidth = 3;
  const r = s * 0.22;
  const cx = s / 2;
  const cy = s / 2;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.strokeStyle = "#c8d4c8";
  ctx.strokeRect(s * 0.1, s * 0.1, s * 0.8, s * 0.8);
}

function patternWallWarm(ctx, s) {
  ctx.fillStyle = "#ebe6df";
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = "#c8bdb0";
  ctx.lineWidth = 4;
  const m = s * 0.15;
  ctx.strokeRect(m, m, s - m * 2, s - m * 2);
  ctx.fillStyle = "#d4c8b8";
  ctx.fillRect(s * 0.35, m, s * 0.08, s - m * 2);
}

function patternWallTech(ctx, s) {
  ctx.fillStyle = "#e4e2e0";
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = "#c0b8b0";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, s * 0.55);
  ctx.lineTo(s, s * 0.55);
  ctx.stroke();
  ctx.fillStyle = "#d8d0c8";
  ctx.fillRect(s * 0.15, s * 0.15, s * 0.7, s * 0.28);
  ctx.strokeStyle = "#e07040";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(s * 0.15, s * 0.7);
  ctx.lineTo(s * 0.85, s * 0.7);
  ctx.stroke();
}

function patternWallClean(ctx, s) {
  // hygiene — almost plain with soft corner arcs
  ctx.fillStyle = "#eef2f6";
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = "#c8d4e0";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(s * 0.5, s * 0.5, s * 0.28, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeRect(s * 0.12, s * 0.12, s * 0.76, s * 0.76);
}

function patternWallHub(ctx, s) {
  ctx.fillStyle = "#e4eaf2";
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = "#88c8c0";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s * 0.3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#b0c0d0";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(s / 2, s * 0.1);
  ctx.lineTo(s / 2, s * 0.9);
  ctx.moveTo(s * 0.1, s / 2);
  ctx.lineTo(s * 0.9, s / 2);
  ctx.stroke();
}

function patternWallGarden(ctx, s) {
  ctx.fillStyle = "#e4ebe0";
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = "#c5d8b8";
  ctx.fillRect(0, s * 0.65, s, s * 0.2);
  ctx.strokeStyle = "#a8c090";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(s * 0.2, s * 0.3);
  ctx.quadraticCurveTo(s * 0.5, s * 0.05, s * 0.8, s * 0.3);
  ctx.stroke();
}

/** Minimal cyber wall — engine bay (sparse traces + few nodes) */
function patternWallCyberEngine(ctx, s) {
  ctx.fillStyle = "#e4e8ee";
  ctx.fillRect(0, 0, s, s);

  // faint panel rule
  ctx.strokeStyle = "#c4ccd6";
  ctx.lineWidth = 2;
  const m = s * 0.12;
  ctx.strokeRect(m, m, s - m * 2, s - m * 2);

  // one L-trace
  ctx.strokeStyle = "#8aa0b4";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(m, s * 0.62);
  ctx.lineTo(s * 0.55, s * 0.62);
  ctx.lineTo(s * 0.55, s - m);
  ctx.stroke();

  // thin crosshair
  ctx.strokeStyle = "#b8c4d0";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(s * 0.5, m);
  ctx.lineTo(s * 0.5, s * 0.38);
  ctx.moveTo(s * 0.28, s * 0.28);
  ctx.lineTo(s * 0.72, s * 0.28);
  ctx.stroke();

  // two quiet nodes
  for (const [nx, ny] of [[0.55, 0.62], [0.5, 0.28]]) {
    ctx.fillStyle = "#e07840";
    ctx.beginPath();
    ctx.arc(nx * s, ny * s, 2.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Artsy organic wall — garden (irregular shapes, soft botanical collage) */
function patternWallCyberGarden(ctx, s) {
  ctx.fillStyle = "#e8efe4";
  ctx.fillRect(0, 0, s, s);

  // soft background washes (deterministic pseudo-random blobs)
  const washes = [
    [0.18, 0.22, 0.22, "#d5e4c8"],
    [0.72, 0.28, 0.18, "#cfe0d0"],
    [0.4, 0.7, 0.26, "#dde8d2"],
    [0.85, 0.78, 0.16, "#d0dbc4"],
  ];
  for (const [nx, ny, r, col] of washes) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(nx * s, ny * s, r * s, r * s * 0.85, nx * 1.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // irregular leaf / petal polygons
  const leaves = [
    { cx: 0.28, cy: 0.35, pts: [[0, -0.18], [0.12, -0.06], [0.08, 0.14], [-0.04, 0.16], [-0.14, 0.02]], fill: "#b8d09a", stroke: "#8aaa70" },
    { cx: 0.68, cy: 0.55, pts: [[0.02, -0.16], [0.16, 0], [0.06, 0.18], [-0.12, 0.1], [-0.1, -0.08]], fill: "#a8c888", stroke: "#7a9e68" },
    { cx: 0.52, cy: 0.22, pts: [[-0.08, -0.1], [0.1, -0.08], [0.12, 0.08], [-0.02, 0.14], [-0.14, 0.02]], fill: "#c4dca8", stroke: "#90b078" },
  ];
  for (const leaf of leaves) {
    ctx.fillStyle = leaf.fill;
    ctx.strokeStyle = leaf.stroke;
    ctx.lineWidth = 2;
    ctx.beginPath();
    leaf.pts.forEach(([px, py], i) => {
      const x = (leaf.cx + px) * s;
      const y = (leaf.cy + py) * s;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // scattered geometric accents — triangles / arcs / bars
  ctx.fillStyle = "#9cbc80";
  ctx.beginPath();
  ctx.moveTo(s * 0.12, s * 0.78);
  ctx.lineTo(s * 0.28, s * 0.62);
  ctx.lineTo(s * 0.34, s * 0.84);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#6a9a78";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(s * 0.82, s * 0.38, s * 0.11, 0.2, Math.PI * 1.4);
  ctx.stroke();

  ctx.fillStyle = "#88b878";
  ctx.fillRect(s * 0.58, s * 0.78, s * 0.22, s * 0.04);
  ctx.fillRect(s * 0.72, s * 0.72, s * 0.04, s * 0.16);

  // seed dots
  for (const [nx, ny, r] of [[0.2, 0.55, 2.2], [0.45, 0.48, 1.8], [0.9, 0.55, 2.4], [0.38, 0.9, 2], [0.62, 0.12, 1.6]]) {
    ctx.fillStyle = "#5a9868";
    ctx.beginPath();
    ctx.arc(nx * s, ny * s, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Clean bathroom wall — hygiene (tile grid + soft water motif) */
function patternWallHygiene(ctx, s) {
  ctx.fillStyle = "#eef4f8";
  ctx.fillRect(0, 0, s, s);

  // subway / ceramic tile grid
  const cols = 4;
  const rows = 3;
  const tw = s / cols;
  const th = s / rows;
  ctx.strokeStyle = "#c5d4e0";
  ctx.lineWidth = 3;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const px = x * tw;
      const py = y * th;
      // slight checker tint like glazed tile
      ctx.fillStyle = (x + y) % 2 === 0 ? "#f4f8fb" : "#e6eef4";
      ctx.fillRect(px + 1, py + 1, tw - 2, th - 2);
      ctx.strokeRect(px + 0.5, py + 0.5, tw - 1, th - 1);
    }
  }

  // soft water-drop accents (toilet / washroom cue)
  const drops = [
    [0.22, 0.28, 0.07],
    [0.72, 0.55, 0.055],
    [0.48, 0.78, 0.06],
  ];
  for (const [nx, ny, r] of drops) {
    const cx = nx * s;
    const cy = ny * s;
    const rr = r * s;
    ctx.fillStyle = "rgba(120, 180, 210, 0.35)";
    ctx.beginPath();
    ctx.moveTo(cx, cy - rr * 1.15);
    ctx.bezierCurveTo(cx + rr, cy - rr * 0.2, cx + rr * 0.85, cy + rr * 0.7, cx, cy + rr);
    ctx.bezierCurveTo(cx - rr * 0.85, cy + rr * 0.7, cx - rr, cy - rr * 0.2, cx, cy - rr * 1.15);
    ctx.fill();
    ctx.strokeStyle = "#8ab0c8";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // small faucet / ring motif in one tile
  ctx.strokeStyle = "#9ab8cc";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(s * 0.875, s * 0.18, s * 0.06, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(s * 0.875, s * 0.18, s * 0.025, 0, Math.PI * 2);
  ctx.stroke();
}

function patternFloorTiles(ctx, s) {
  ctx.fillStyle = "#c8d0da";
  ctx.fillRect(0, 0, s, s);
  const cell = s / 2;
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 2; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? "#d4dce6" : "#c2cad4";
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  ctx.strokeStyle = "#a8b2c0";
  ctx.lineWidth = 3;
  for (let i = 0; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cell, 0);
    ctx.lineTo(i * cell, s);
    ctx.moveTo(0, i * cell);
    ctx.lineTo(s, i * cell);
    ctx.stroke();
  }
}

function patternFloorPlanks(ctx, s) {
  ctx.fillStyle = "#d0d6de";
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = "#b0b8c4";
  ctx.lineWidth = 3;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(0, (s / 3) * i);
    ctx.lineTo(s, (s / 3) * i);
    ctx.stroke();
  }
}

function patternFloorRing(ctx, s) {
  ctx.fillStyle = "#cfd6e0";
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = "#88c0b8";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s * 0.32, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#b0bac8";
  ctx.lineWidth = 2;
  ctx.strokeRect(s * 0.12, s * 0.12, s * 0.76, s * 0.76);
}

function patternFloorCarpet(ctx, s) {
  // continuous soft carpet — fine repeating pile, no big medallion
  ctx.fillStyle = "#b6c0ce";
  ctx.fillRect(0, 0, s, s);

  // dense low-contrast fibre grain (tiles seamlessly)
  const step = s / 16;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const odd = (x + y) % 2 === 0;
      ctx.fillStyle = odd ? "rgba(150,162,178,0.35)" : "rgba(130,142,158,0.22)";
      ctx.fillRect(x * step, y * step, step, step);
    }
  }

  // soft horizontal pile lines
  ctx.strokeStyle = "rgba(120,132,148,0.28)";
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 16; i++) {
    const yy = (i + 0.5) * step;
    ctx.beginPath();
    ctx.moveTo(0, yy);
    ctx.lineTo(s, yy);
    ctx.stroke();
  }

  // faint diagonal nap for continuity across tiles
  ctx.strokeStyle = "rgba(100,112,128,0.18)";
  ctx.lineWidth = 1;
  for (let i = -16; i < 32; i++) {
    ctx.beginPath();
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step + s, s);
    ctx.stroke();
  }
}

function patternFloorCrew(ctx, s) {
  ctx.fillStyle = "#d2d8e2";
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = "#b8c4d4";
  ctx.beginPath();
  ctx.moveTo(s * 0.5, s * 0.15);
  ctx.lineTo(s * 0.85, s * 0.85);
  ctx.lineTo(s * 0.15, s * 0.85);
  ctx.closePath();
  ctx.fill();
}

function patternFloorHygiene(ctx, s) {
  // neat white washroom floor — soft tile grid + subtle corner accents
  ctx.fillStyle = "#f4f7fb";
  ctx.fillRect(0, 0, s, s);

  const tiles = 4;
  const ts = s / tiles;
  const inset = 5;

  // soft tile faces
  for (let y = 0; y < tiles; y++) {
    for (let x = 0; x < tiles; x++) {
      ctx.fillStyle = "#eef3f8";
      ctx.fillRect(x * ts + inset, y * ts + inset, ts - inset * 2, ts - inset * 2);
    }
  }

  // neat hairline grout
  ctx.strokeStyle = "rgba(170, 185, 200, 0.55)";
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= tiles; i++) {
    ctx.beginPath();
    ctx.moveTo(i * ts, 0);
    ctx.lineTo(i * ts, s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * ts);
    ctx.lineTo(s, i * ts);
    ctx.stroke();
  }

  // tiny corner marks on each tile (neat detail, not busy)
  ctx.strokeStyle = "rgba(150, 170, 190, 0.4)";
  ctx.lineWidth = 1.2;
  const mark = ts * 0.12;
  for (let y = 0; y < tiles; y++) {
    for (let x = 0; x < tiles; x++) {
      const x0 = x * ts + inset + 2;
      const y0 = y * ts + inset + 2;
      const x1 = (x + 1) * ts - inset - 2;
      const y1 = (y + 1) * ts - inset - 2;
      // TL
      ctx.beginPath();
      ctx.moveTo(x0, y0 + mark);
      ctx.lineTo(x0, y0);
      ctx.lineTo(x0 + mark, y0);
      ctx.stroke();
      // TR
      ctx.beginPath();
      ctx.moveTo(x1 - mark, y0);
      ctx.lineTo(x1, y0);
      ctx.lineTo(x1, y0 + mark);
      ctx.stroke();
      // BL
      ctx.beginPath();
      ctx.moveTo(x0, y1 - mark);
      ctx.lineTo(x0, y1);
      ctx.lineTo(x0 + mark, y1);
      ctx.stroke();
      // BR
      ctx.beginPath();
      ctx.moveTo(x1 - mark, y1);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x1, y1 - mark);
      ctx.stroke();
    }
  }
}

/** Marble (雲石) panel — soft white stone with flowing grey veins */
function patternStallPanel(ctx, s) {
  ctx.fillStyle = "#f3f5f7";
  ctx.fillRect(0, 0, s, s);

  // soft base mottling
  for (let i = 0; i < 40; i++) {
    const x = (Math.sin(i * 12.9898) * 0.5 + 0.5) * s;
    const y = (Math.sin(i * 78.233) * 0.5 + 0.5) * s;
    const r = 8 + (i % 7) * 3;
    ctx.fillStyle = i % 2 ? "rgba(230, 234, 238, 0.55)" : "rgba(245, 247, 249, 0.5)";
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.6, r, i * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // primary marble veins (flowing diagonals)
  const veins = [
    { c: "rgba(150, 160, 172, 0.55)", w: 2.4, pts: [[0, 0.15], [0.35, 0.28], [0.6, 0.22], [1, 0.4]] },
    { c: "rgba(170, 178, 188, 0.45)", w: 1.8, pts: [[0, 0.55], [0.25, 0.48], [0.55, 0.62], [0.8, 0.55], [1, 0.7]] },
    { c: "rgba(140, 150, 165, 0.4)", w: 2.0, pts: [[0.1, 0], [0.2, 0.35], [0.15, 0.7], [0.3, 1]] },
    { c: "rgba(180, 186, 195, 0.35)", w: 1.5, pts: [[0.55, 0], [0.7, 0.4], [0.65, 0.75], [0.85, 1]] },
    { c: "rgba(160, 168, 180, 0.38)", w: 1.6, pts: [[0, 0.85], [0.4, 0.78], [0.75, 0.9], [1, 0.82]] },
  ];
  for (const v of veins) {
    ctx.strokeStyle = v.c;
    ctx.lineWidth = v.w;
    ctx.lineJoin = "round";
    ctx.beginPath();
    v.pts.forEach(([px, py], i) => {
      const x = px * s;
      const y = py * s;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  // fine secondary hairline veins
  ctx.strokeStyle = "rgba(175, 182, 192, 0.28)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    const y0 = ((i * 37) % 100) / 100 * s;
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.quadraticCurveTo(s * 0.35, y0 + (i % 2 ? 18 : -14), s * 0.7, y0 + (i % 3 ? -10 : 12));
    ctx.quadraticCurveTo(s * 0.9, y0, s, y0 + 8);
    ctx.stroke();
  }
}

/** Soft Carrara-style marble for wash sinks (slightly warm grey) */
function patternSinkMarble(ctx, s) {
  ctx.fillStyle = "#e8e4de";
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 48; i++) {
    const x = (Math.sin(i * 19.17) * 0.5 + 0.5) * s;
    const y = (Math.cos(i * 41.3) * 0.5 + 0.5) * s;
    const r = 10 + (i % 9) * 2.5;
    ctx.fillStyle = i % 3 === 0 ? "rgba(214, 208, 200, 0.55)" : "rgba(232, 226, 218, 0.45)";
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.8, r * 0.9, i * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
  const veins = [
    { c: "rgba(138, 142, 150, 0.48)", w: 2.2, pts: [[0, 0.2], [0.3, 0.32], [0.55, 0.26], [0.85, 0.4], [1, 0.36]] },
    { c: "rgba(152, 154, 160, 0.4)", w: 1.6, pts: [[0, 0.62], [0.28, 0.55], [0.6, 0.68], [1, 0.58]] },
    { c: "rgba(130, 134, 142, 0.38)", w: 1.8, pts: [[0.15, 0], [0.22, 0.4], [0.18, 0.75], [0.35, 1]] },
    { c: "rgba(158, 152, 146, 0.35)", w: 1.4, pts: [[0.5, 0], [0.62, 0.35], [0.58, 0.7], [0.78, 1]] },
    { c: "rgba(142, 146, 152, 0.32)", w: 1.3, pts: [[0, 0.88], [0.4, 0.82], [0.75, 0.92], [1, 0.85]] },
  ];
  for (const v of veins) {
    ctx.strokeStyle = v.c;
    ctx.lineWidth = v.w;
    ctx.lineJoin = "round";
    ctx.beginPath();
    v.pts.forEach(([px, py], i) => {
      const x = px * s;
      const y = py * s;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(150, 146, 140, 0.26)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 10; i++) {
    const y0 = ((i * 29) % 100) / 100 * s;
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.quadraticCurveTo(s * 0.4, y0 + (i % 2 ? 12 : -10), s * 0.75, y0 + (i % 3 ? -8 : 10));
    ctx.lineTo(s, y0 + 4);
    ctx.stroke();
  }
}

function patternDiagonalMetal(ctx, s) {
  // denser abrasive / non-slip metal — mid grey plate with clearer grit overlay
  ctx.fillStyle = "#7a828c";
  ctx.fillRect(0, 0, s, s);

  // soft swirl / brushed abrasive base
  ctx.strokeStyle = "rgba(95,102,112,0.55)";
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 28; i++) {
    const cy = (i / 28) * s;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.quadraticCurveTo(s * 0.35, cy + 6 * Math.sin(i), s * 0.65, cy - 5 * Math.cos(i * 0.7));
    ctx.quadraticCurveTo(s * 0.85, cy + 4, s, cy);
    ctx.stroke();
  }

  // discontinuous dashed diagonal tread marks (X / abrasive finish)
  ctx.strokeStyle = "#3a424c";
  ctx.lineWidth = 2.4;
  ctx.setLineDash([6, 4, 3, 5]);
  for (let i = -8; i < 16; i++) {
    const o = (i * s) / 7;
    ctx.beginPath();
    ctx.moveTo(o, 0);
    ctx.lineTo(o + s, s);
    ctx.stroke();
  }
  // opposite diagonal dashes (lighter for contrast)
  ctx.strokeStyle = "#c0c8d0";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 5, 7, 4]);
  for (let i = -8; i < 16; i++) {
    const o = (i * s) / 7;
    ctx.beginPath();
    ctx.moveTo(o + s, 0);
    ctx.lineTo(o, s);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // tiny scattered grit flecks
  ctx.fillStyle = "rgba(40,46,54,0.5)";
  for (let i = 0; i < 110; i++) {
    ctx.fillRect(Math.random() * s, Math.random() * s, 1.4 + Math.random(), 1.4 + Math.random());
  }
  ctx.fillStyle = "rgba(210,218,226,0.45)";
  for (let i = 0; i < 55; i++) {
    ctx.fillRect(Math.random() * s, Math.random() * s, 1.2 + Math.random(), 1.2 + Math.random());
  }
}

function patternSoftGrid(ctx, s) {
  ctx.fillStyle = "#d8dee6";
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = "#b8c2d0";
  ctx.lineWidth = 3;
  const m = s * 0.12;
  ctx.strokeRect(m, m, s - m * 2, s - m * 2);
  ctx.strokeStyle = "#c8d0da";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(s / 2, m);
  ctx.lineTo(s / 2, s - m);
  ctx.moveTo(m, s / 2);
  ctx.lineTo(s - m, s / 2);
  ctx.stroke();
}

function patternControlFloor(ctx, s) {
  // blue bridge deck — soft continuous grid
  ctx.fillStyle = "#3a6ea8";
  ctx.fillRect(0, 0, s, s);

  const step = s / 8;
  ctx.strokeStyle = "rgba(120, 180, 230, 0.45)";
  ctx.lineWidth = 1.2;
  for (let i = 0; i <= 8; i++) {
    const p = i * step;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, s);
    ctx.moveTo(0, p);
    ctx.lineTo(s, p);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(180, 220, 255, 0.3)";
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= 8; i += 4) {
    const p = i * step;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, s);
    ctx.moveTo(0, p);
    ctx.lineTo(s, p);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(200, 230, 255, 0.28)";
  for (let y = 0; y < 8; y += 2) {
    for (let x = 0; x < 8; x += 2) {
      ctx.beginPath();
      ctx.arc(x * step + step, y * step + step, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Clean modern metal panel — same look as sliding door panels */
function patternWallMetal(ctx, s) {
  ctx.fillStyle = "#c5ccd6";
  ctx.fillRect(0, 0, s, s);

  // soft brushed horizontal grain
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  for (let y = 4; y < s; y += 5) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(s, y + 0.5);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(90,100,115,0.07)";
  for (let y = 6; y < s; y += 5) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(s, y + 0.5);
    ctx.stroke();
  }

  // vertical panel seams (door-slab divisions)
  ctx.strokeStyle = "rgba(120,130,142,0.55)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(s * 0.5 + 0.5, 0);
  ctx.lineTo(s * 0.5 + 0.5, s);
  ctx.stroke();
  ctx.strokeStyle = "rgba(200,208,218,0.45)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(s * 0.5 - 2, 0);
  ctx.lineTo(s * 0.5 - 2, s);
  ctx.moveTo(s * 0.5 + 3, 0);
  ctx.lineTo(s * 0.5 + 3, s);
  ctx.stroke();

  // faint inset bevel like door face
  ctx.strokeStyle = "rgba(170,178,190,0.55)";
  ctx.lineWidth = 2;
  const m = s * 0.08;
  ctx.strokeRect(m + 0.5, m + 0.5, s - m * 2, s - m * 2);
  ctx.strokeStyle = "rgba(240,244,248,0.35)";
  ctx.lineWidth = 1;
  ctx.strokeRect(m + 3.5, m + 3.5, s - m * 2 - 6, s - m * 2 - 6);
}

/** Control bridge wall — dark slate with cool horizon band + sparse cyan accents */
function patternControlWall(ctx, s) {
  ctx.fillStyle = "#3a4558";
  ctx.fillRect(0, 0, s, s);

  // soft vertical panel seams
  ctx.strokeStyle = "rgba(55, 70, 90, 0.9)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(s * 0.33, 0);
  ctx.lineTo(s * 0.33, s);
  ctx.moveTo(s * 0.66, 0);
  ctx.lineTo(s * 0.66, s);
  ctx.stroke();

  // horizon command band
  ctx.fillStyle = "#2e3848";
  ctx.fillRect(0, s * 0.38, s, s * 0.18);
  ctx.fillStyle = "rgba(40, 180, 220, 0.22)";
  ctx.fillRect(0, s * 0.44, s, s * 0.045);

  // thin cyan rail
  ctx.strokeStyle = "rgba(70, 210, 255, 0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, s * 0.46);
  ctx.lineTo(s, s * 0.46);
  ctx.stroke();

  // sparse corner chevrons
  ctx.strokeStyle = "rgba(90, 200, 240, 0.4)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(s * 0.08, s * 0.12);
  ctx.lineTo(s * 0.18, s * 0.12);
  ctx.lineTo(s * 0.18, s * 0.22);
  ctx.moveTo(s * 0.92, s * 0.12);
  ctx.lineTo(s * 0.82, s * 0.12);
  ctx.lineTo(s * 0.82, s * 0.22);
  ctx.stroke();

  // status pip
  ctx.fillStyle = "#3ec8ff";
  ctx.beginPath();
  ctx.arc(s * 0.5, s * 0.46, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function patternControlCeiling(ctx, s) {
  ctx.fillStyle = "#1e2836";
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = "rgba(80, 110, 140, 0.45)";
  ctx.lineWidth = 2;
  const m = s * 0.2;
  ctx.strokeRect(m, m, s - m * 2, s - m * 2);
  ctx.strokeStyle = "rgba(60, 160, 200, 0.3)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(s * 0.2, s * 0.5);
  ctx.lineTo(s * 0.8, s * 0.5);
  ctx.stroke();
}

function patternGarden(ctx, s) {
  ctx.fillStyle = "#3d2e1c";
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = `rgba(${40 + Math.random() * 50},${30 + Math.random() * 40},${15 + Math.random() * 25},${0.35 + Math.random() * 0.4})`;
    ctx.fillRect(Math.random() * s, Math.random() * s, 4 + Math.random() * 8, 3 + Math.random() * 6);
  }
}

function patternCeiling(ctx, s) {
  ctx.fillStyle = "#f0f2f5";
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = "#dde2e8";
  ctx.lineWidth = 2;
  const m = s * 0.08;
  ctx.strokeRect(m, m, s - m * 2, s - m * 2);
}

function patternCeilingWarm(ctx, s) {
  ctx.fillStyle = "#f4efe8";
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = "#e0d4c4";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, s * 0.5);
  ctx.lineTo(s, s * 0.5);
  ctx.stroke();
}

function patternedMat(baseColor, tex, repeatX, repeatY, opts = {}) {
  const map = tex.clone();
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(Math.max(0.35, repeatX), Math.max(0.35, repeatY));
  map.needsUpdate = true;
  return mat(baseColor, {
    map,
    roughness: opts.roughness ?? 0.85,
    metalness: opts.metalness ?? 0.12,
    ...opts,
  });
}

/** Per-room look — bright reflective white hull */
function roomPatterns(label = "") {
  return {
    plain: true,
    wallTint: 0xf7f8fa,
    floorTint: 0xe8eaee,
    ceilTint: 0xf4f6f8,
  };
}

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.72,
    metalness: opts.metalness ?? 0.25,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    ...opts,
  });
}

function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cyl(rTop, rBot, h, material, x = 0, y = 0, z = 0, segs = 16) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, segs), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Axis-aligned wall slab used for collision (x,y,z are local to group). */
function wallSlab(colliders, group, w, h, d, x, y, z, material, ox = 0, oz = 0) {
  const mesh = box(w, h, d, material, x, y, z);
  group.add(mesh);
  const wx = ox + x;
  const wz = oz + z;
  colliders.push({
    min: new THREE.Vector3(wx - w / 2, y - h / 2, wz - d / 2),
    max: new THREE.Vector3(wx + w / 2, y + h / 2, wz + d / 2),
  });
  return mesh;
}

/** Invisible walk-blocker (no mesh). */
function blockZone(colliders, w, h, d, x, y, z, ox = 0, oz = 0) {
  const wx = ox + x;
  const wz = oz + z;
  colliders.push({
    min: new THREE.Vector3(wx - w / 2, y - h / 2, wz - d / 2),
    max: new THREE.Vector3(wx + w / 2, y + h / 2, wz + d / 2),
  });
}

function roomWantsDoor(label = "") {
  const L = label.toLowerCase();
  return (
    L.includes("control room") ||
    L.includes("cockpit") ||
    L.includes("hygiene") ||
    L.includes("washroom") ||
    L.includes("crew quarters") ||
    L.includes("garden") ||
    L.includes("kitchen") ||
    L.includes("engine room")
  );
}

/** Rooms sealed for now — doors stay shut and block walk-through. */
function roomDoorLocked(label = "") {
  const L = label.toLowerCase();
  return (
    L.includes("kitchen") || // diner
    L.includes("garden") ||
    L.includes("washroom") ||
    L.includes("hygiene") ||
    L.includes("crew quarters") || // dorm
    L.includes("engine room")
  );
}

function roundedRectShape(w, h, r) {
  const hw = w * 0.5;
  const hh = h * 0.5;
  const rr = Math.min(r, hw * 0.45, hh * 0.45);
  const s = new THREE.Shape();
  s.moveTo(-hw + rr, -hh);
  s.lineTo(hw - rr, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + rr);
  s.lineTo(hw, hh - rr);
  s.quadraticCurveTo(hw, hh, hw - rr, hh);
  s.lineTo(-hw + rr, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - rr);
  s.lineTo(-hw, -hh + rr);
  s.quadraticCurveTo(-hw, -hh, -hw + rr, -hh);
  return s;
}

function extrudeRounded(w, h, depth, radius, material) {
  const geo = new THREE.ExtrudeGeometry(roundedRectShape(w, h, radius), {
    depth,
    bevelEnabled: false,
    curveSegments: 10,
  });
  geo.translate(0, 0, -depth * 0.5);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Rounded box with soft bevels — better for avatar limbs. */
function extrudeRoundedLimb(w, h, depth, radius, material) {
  const r = Math.min(radius, w * 0.45, h * 0.45);
  const bevel = Math.min(0.028, r * 0.4, depth * 0.22);
  const geo = new THREE.ExtrudeGeometry(roundedRectShape(w, h, r), {
    depth: Math.max(0.02, depth - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 10,
  });
  geo.translate(0, 0, -depth * 0.5);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Flat rounded panel with clean 0–1 UVs (for screen textures / space view). */
function roundedPlane(w, h, radius, material, curveSegments = 20) {
  const geo = new THREE.ShapeGeometry(roundedRectShape(w, h, radius), curveSegments);
  // ShapeGeometry UVs can be messy — force planar 0–1 from XY bounds
  const pos = geo.attributes.position;
  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uvs[i * 2] = (pos.getX(i) + w * 0.5) / w;
    uvs[i * 2 + 1] = (pos.getY(i) + h * 0.5) / h;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

/** Door opening — sill covers floor; frame sits above and just touches sill top. */
function doorOpeningMetrics(gw, h) {
  const lintel = 0.55;
  const doorH = Math.max(2.0, h - lintel);
  const sillH = 0.16; // bottom piece (covers floor ~0.12)
  const side = 0.1;
  const top = 0.1;
  // tiny bottom tip of frame — just kisses the sill edge
  const frameBottomTip = 0.02;
  const frameH = doorH - sillH;
  const holeW = gw - side * 2;
  const holeH = frameH - top - frameBottomTip;
  const holeR = Math.min(0.42, holeW * 0.22, holeH * 0.16);
  const frameY = sillH + frameH * 0.5;
  const holeY = sillH + frameBottomTip + holeH * 0.5;
  const holeOffsetY = holeY - frameY;
  return {
    doorH, sillH, frameH, frameY, holeW, holeH, holeR, holeY, holeOffsetY, frameBottomTip,
  };
}

/** Thin frame above sill — square outside, rounded inside; bottom tip just touches sill. */
function makeEntranceFrame(room, frameKeys, {
  ox, oz, localX, localZ, gw, h, axis, frameMat,
}) {
  const wx = ox + localX;
  const wz = oz + localZ;
  const key = `f_${wx.toFixed(1)}_${wz.toFixed(1)}_${axis}`;
  if (frameKeys.has(key)) return;
  frameKeys.add(key);

  const wallT = 0.22;
  const frameT = 0.14;
  const { sillH, frameH, frameY, holeW, holeH, holeR, holeOffsetY } = doorOpeningMetrics(gw, h);

  // sill first — same depth as wall
  const sill = box(gw, sillH, wallT, frameMat, 0, sillH * 0.5, 0);
  if (axis === "x") {
    sill.position.set(localX, sillH * 0.5, localZ);
  } else {
    sill.position.set(localX, sillH * 0.5, localZ);
    sill.rotation.y = Math.PI / 2;
  }
  room.add(sill);

  // frame sits on sill: bottom edge just touches sill top
  const outer = roundedRectShape(gw, frameH, 0.01);
  const holeShape = roundedRectShape(holeW, holeH, holeR);
  const holePts = holeShape.getPoints(48);
  const hole = new THREE.Path();
  for (let i = holePts.length - 1; i >= 0; i--) {
    const p = holePts[i];
    const hx = p.x;
    const hy = p.y + holeOffsetY;
    if (i === holePts.length - 1) hole.moveTo(hx, hy);
    else hole.lineTo(hx, hy);
  }
  outer.holes.push(hole);

  // frame flush with room-interior face of sill — bottom tip only touches that one edge
  const edge = (wallT - frameT) * 0.5;
  const geo = new THREE.ExtrudeGeometry(outer, {
    depth: frameT,
    bevelEnabled: false,
    curveSegments: 16,
  });
  geo.translate(0, 0, -frameT * 0.5);
  const frame = new THREE.Mesh(geo, frameMat);
  if (axis === "x") {
    const inward = -Math.sign(localZ || 1);
    frame.position.set(localX, frameY, localZ + inward * edge);
  } else {
    const inward = -Math.sign(localX || 1);
    frame.position.set(localX + inward * edge, frameY, localZ);
    frame.rotation.y = Math.PI / 2;
  }
  frame.castShadow = true;
  frame.receiveShadow = true;
  room.add(frame);
  return frame;
}

function makeGlassDoor(room, doorsOut, doorKeys, {
  ox, oz, localX, localZ, gw, h, axis, colliders = null, locked = false, side = "",
}) {
  const wx = ox + localX;
  const wz = oz + localZ;
  const key = `${wx.toFixed(1)}_${wz.toFixed(1)}_${axis}`;
  if (doorKeys.has(key)) return;
  doorKeys.add(key);

  const wallT = 0.22;
  const frameT = 0.14;
  const edge = (wallT - frameT) * 0.5;
  const { holeW, holeH, holeR, holeY } = doorOpeningMetrics(gw, h);
  const clearance = 0.03;
  const panelW = holeW - clearance;
  const panelH = holeH - clearance;
  const radius = Math.max(0.08, holeR - clearance * 0.5);

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x9eb8c8,
    metalness: 0.08,
    roughness: 0.22,
    // Keep a hint of glass — not a see-through tunnel across the ship
    transmission: 0.18,
    thickness: 0.55,
    ior: 1.45,
    transparent: true,
    opacity: 0.92,
    depthWrite: true,
    side: THREE.DoubleSide,
  });
  glassMat.userData.doorGlass = true;
  // Opaque seal while locked — clear glass was an x-ray into the room / unlock text
  const sealedMat = new THREE.MeshStandardMaterial({
    color: 0xa8b2bc,
    metalness: 0.62,
    roughness: 0.32,
    emissive: 0x1a2228,
    emissiveIntensity: 0.12,
    side: THREE.DoubleSide,
  });

  // same interior-edge offset as the frame
  let doorX = localX;
  let doorZ = localZ;
  if (axis === "x") {
    doorZ = localZ + (-Math.sign(localZ || 1)) * edge;
  } else {
    doorX = localX + (-Math.sign(localX || 1)) * edge;
  }

  const root = new THREE.Group();
  root.position.set(doorX, 0, doorZ);
  if (axis === "z") root.rotation.y = Math.PI / 2;
  room.add(root);

  const slide = new THREE.Group();
  root.add(slide);

  // Locked rooms: solid walk-blocker in the doorway (glass alone has no collision).
  // Always build the collider + holo for lockable doors so a soft reset can re-seal them.
  let blockCollider = null;
  const effectivelyLocked = !!locked && !isDoorAlreadyUnlocked(key);

  const panel = extrudeRounded(
    panelW,
    panelH,
    0.04,
    radius,
    effectivelyLocked ? sealedMat : glassMat
  );
  panel.position.y = holeY;
  panel.castShadow = false;
  panel.receiveShadow = false;
  slide.add(panel);
  if (locked && colliders) {
    const before = colliders.length;
    if (axis === "x") {
      blockZone(colliders, panelW, panelH, wallT + 0.08, doorX, holeY, doorZ, ox, oz);
    } else {
      blockZone(colliders, wallT + 0.08, panelH, panelW, doorX, holeY, doorZ, ox, oz);
    }
    if (colliders.length > before) {
      blockCollider = colliders[colliders.length - 1];
      if (!effectivelyLocked) colliders.pop();
    }
  }

  let unlockHolo = null;
  if (locked) {
    unlockHolo = makeDoorUnlockHolo();
    const homeY = holeY - 0.2;
    // Face the OUTSIDE of the locked room (where the captain approaches).
    // West/south doors need the flipped local side; east/north keep the default.
    const flipOut = side === "w" || side === "s";
    unlockHolo.position.set(0, homeY, flipOut ? -0.14 : 0.14);
    unlockHolo.rotation.y = flipOut ? Math.PI : 0;
    unlockHolo.userData.homeY = homeY;
    unlockHolo.userData.doorKey = key;
    unlockHolo.visible = effectivelyLocked;
    slide.add(unlockHolo);
  }

  doorsOut.push({
    key,
    panel: slide,
    doorMesh: panel,
    glassMat,
    sealedMat,
    hasPanel: true,
    closedX: 0,
    openDist: panelW + 0.12,
    trigger: new THREE.Vector3(wx, 0, wz),
    open: 0,
    target: 0,
    locked: effectivelyLocked,
    lockable: !!locked,
    blockCollider: effectivelyLocked ? blockCollider : null,
    savedBlockCollider: blockCollider,
    colliders,
    unlockHolo,
  });
}

function syncDoorPanelSeal(door) {
  if (!door?.doorMesh) return;
  const sealed = !!door.locked;
  const next = sealed ? door.sealedMat : door.glassMat;
  if (next && door.doorMesh.material !== next) {
    door.doorMesh.material = next;
  }
}

function roomShell(colliders, group, {
  cx, cz, w, d, h = 3.2, door = null, doors = null, floorColor = FLOOR, label = "",
  autoDoors = null, doorKeys = null, frameKeys = null, anim = null,
}) {
  const room = new THREE.Group();
  room.position.set(cx, 0, cz);
  group.add(room);
  const ox = cx;
  const oz = cz;

  const pats = roomPatterns(label);
  // prefer explicit floorColor from room setup (roomPatterns tint was overriding orange etc.)
  const floorTint = floorColor;
  const wallTint = pats.wallTint ?? WALL;
  const ceilTint = pats.ceilTint ?? CEIL;

  let floorMat;
  let wallMat;
  let ceilMat;
  const labelLower = label.toLowerCase();
  const isEngineFloor = labelLower.includes("engine room");
  const isEngAccess = labelLower.includes("engineering access");
  const isGarden = labelLower.includes("garden");
  const isWashroom = labelLower.includes("washroom") || labelLower.includes("hygiene");
  if (isEngineFloor) {
    // abrasive metal plate — more reflective
    floorMat = patternedMat(
      floorTint,
      canvasTex("floorAbrasiveMetal_v2", patternDiagonalMetal, 256),
      w / 3.4,
      d / 3.4,
      { roughness: 0.78, metalness: 0.22 },
    );
    ceilMat = mat(ceilTint, { roughness: 0.94, metalness: 0.04 });
  } else if (isWashroom) {
    // white neat tile pattern
    floorMat = patternedMat(
      0xf2f5f8,
      canvasTex("floorWashroom_neat_v1", patternFloorHygiene, 256),
      w / 3.0,
      d / 3.0,
      { roughness: 0.35, metalness: 0.22 },
    );
    ceilMat = mat(ceilTint, { roughness: 0.94, metalness: 0.04 });
  } else if (pats.plain) {
    if (isEngAccess) {
      floorMat = mat(floorTint, { roughness: 0.42, metalness: 0.48 });
    } else if (isGarden) {
      // greenish-grey garden floor — glossier
      floorMat = mat(floorTint, { roughness: 0.28, metalness: 0.55 });
    } else {
      floorMat = mat(floorTint, { roughness: 0.92, metalness: 0.06 });
    }
    ceilMat = mat(ceilTint, { roughness: 0.94, metalness: 0.04 });
  } else {
    if (pats.floorPlain || !pats.floor) {
      floorMat = mat(floorTint, { roughness: 0.9, metalness: 0.06 });
    } else {
      const denser = labelLower.includes("control") || labelLower.includes("cockpit");
      floorMat = patternedMat(floorTint, pats.floor, w / (denser ? 3.2 : 5.5), d / (denser ? 3.2 : 5.5), {
        roughness: denser ? 0.78 : (label.includes("Garden") ? 1 : 0.88),
        metalness: denser ? 0.12 : 0.08,
      });
    }
    if (pats.ceilPlain || !pats.ceil) {
      ceilMat = mat(ceilTint, { roughness: 0.94, metalness: 0.04 });
    } else {
      ceilMat = patternedMat(CEIL, pats.ceil, w / 6, d / 6, { roughness: 0.9, metalness: 0.05 });
    }
  }

  // soft white walls; engine bay + approach corridor more reflective metal
  if (isEngineFloor) {
    wallMat = mat(0xf0f2f5, { metalness: 0.72, roughness: 0.14 });
  } else if (isEngAccess) {
    wallMat = mat(0xf2f4f7, { metalness: 0.55, roughness: 0.22 });
  } else {
    wallMat = mat(0xf7f8fa, { metalness: 0.08, roughness: 0.52 });
  }
  room.userData.wallMat = wallMat;

  const floor = box(w, 0.12, d, floorMat, 0, 0.06, 0);
  floor.receiveShadow = true;
  room.add(floor);
  room.userData.floor = floor;
  room.userData.floorSize = { w, d };
  room.userData.dims = { w, d, h };

  const ceiling = box(w, 0.1, d, ceilMat, 0, h, 0);
  room.add(ceiling);
  room.userData.ceiling = ceiling;
  room.userData.ceilBaseColor = ceilTint;

  // Ceiling ring light — wide flat rim on XZ (not a tall donut)
  const ringR = Math.min(w, d) * 0.28;
  const ringLight = new THREE.Mesh(
    new THREE.TorusGeometry(ringR, 0.16, 12, 64),
    mat(0xf2f4f7, {
      emissive: 0xeef0f4,
      emissiveIntensity: 1.15,
      roughness: 0.32,
      metalness: 0.2,
    })
  );
  ringLight.rotation.x = Math.PI / 2;
  ringLight.scale.set(1, 1, 0.28); // keep short in height, thick in XZ
  ringLight.position.set(0, h - 0.1, 0);
  room.add(ringLight);
  room.userData.ceilingRing = ringLight;

  const light = new THREE.PointLight(0xf2f4f7, 2.2, Math.max(w, d) * 1.05, 2);
  light.position.set(0, h - 0.4, 0);
  light.castShadow = false;
  room.add(light);
  room.userData.ceilingLight = light;

  // Fill light so corners aren't murky
  const fill = new THREE.PointLight(0xf0f4ff, 1.0, Math.max(w, d) * 0.95, 2);
  fill.position.set(0, h * 0.55, 0);
  fill.castShadow = false;
  room.add(fill);
  room.userData.fillLight = fill;

  const openings = doors || (door ? [door] : []);
  const t = 0.22; // wall thickness
  const midY = h / 2;

  const hasGap = (side) => openings.some((o) => o.side === side);
  const gapFor = (side) => openings.find((o) => o.side === side);

  // North (+Z) / South (-Z) walls
  for (const side of ["n", "s"]) {
    const z = side === "n" ? d / 2 - t / 2 : -d / 2 + t / 2;
    if (!hasGap(side)) {
      wallSlab(colliders, room, w, h, t, 0, midY, z, wallMat, ox, oz);
    } else {
      const g = gapFor(side);
      const gw = g.width ?? 2.2;
      const leftW = (w - gw) / 2;
      const lx = -w / 2 + leftW / 2;
      const rx = w / 2 - leftW / 2;
      wallSlab(colliders, room, leftW, h, t, lx, midY, z, wallMat, ox, oz);
      wallSlab(colliders, room, leftW, h, t, rx, midY, z, wallMat, ox, oz);
      // lintel — same colour/material as the room wall
      wallSlab(colliders, room, gw, 0.55, t, 0, h - 0.275, z, wallMat, ox, oz);
      if (frameKeys) {
        makeEntranceFrame(room, frameKeys, {
          ox, oz, localX: 0, localZ: z, gw, h, axis: "x",
          frameMat: wallMat,
        });
      }
      // Open holes into the Info Hub (no glass) — cyan hologram cue
      if (
        anim &&
        /hub/i.test(String(g.leadsTo || "")) &&
        /corridor/i.test(String(label || ""))
      ) {
        makeInfoHubDoorHolo(room, anim, {
          ox, oz, localX: 0, localZ: z, gw, h, axis: "x",
        });
      }
      if (autoDoors && doorKeys && roomWantsDoor(label)) {
        makeGlassDoor(room, autoDoors, doorKeys, {
          ox, oz, localX: 0, localZ: z, gw, h, axis: "x",
          colliders, locked: roomDoorLocked(label), side,
        });
      }
    }
  }

  // East (+X) / West (-X) walls
  for (const side of ["e", "w"]) {
    const x = side === "e" ? w / 2 - t / 2 : -w / 2 + t / 2;
    if (!hasGap(side)) {
      wallSlab(colliders, room, t, h, d, x, midY, 0, wallMat, ox, oz);
    } else {
      const g = gapFor(side);
      const gw = g.width ?? 2.2;
      const leftD = (d - gw) / 2;
      const lz = -d / 2 + leftD / 2;
      const rz = d / 2 - leftD / 2;
      wallSlab(colliders, room, t, h, leftD, x, midY, lz, wallMat, ox, oz);
      wallSlab(colliders, room, t, h, leftD, x, midY, rz, wallMat, ox, oz);
      wallSlab(colliders, room, t, 0.55, gw, x, h - 0.275, 0, wallMat, ox, oz);
      if (frameKeys) {
        makeEntranceFrame(room, frameKeys, {
          ox, oz, localX: x, localZ: 0, gw, h, axis: "z",
          frameMat: wallMat,
        });
      }
      if (
        anim &&
        /hub/i.test(String(g.leadsTo || "")) &&
        /corridor/i.test(String(label || ""))
      ) {
        makeInfoHubDoorHolo(room, anim, {
          ox, oz, localX: x, localZ: 0, gw, h, axis: "z",
        });
      }
      if (autoDoors && doorKeys && roomWantsDoor(label)) {
        makeGlassDoor(room, autoDoors, doorKeys, {
          ox, oz, localX: x, localZ: 0, gw, h, axis: "z",
          colliders, locked: roomDoorLocked(label), side,
        });
      }
    }
  }

  if (label) {
    room.userData.label = label;
    room.userData.bounds = {
      minX: cx - w / 2, maxX: cx + w / 2,
      minZ: cz - d / 2, maxZ: cz + d / 2,
    };
  }

  return room;
}

const FLOOR_COLORS = [
  0xff3344, 0xff6a00, 0xffcc00, 0x44dd55,
  0x22ccee, 0x4488ff, 0xb03dff, 0xff44aa,
  0xffffff, 0x888888, 0x5a4030, 0x1a2030,
];

function patternBwStripes(ctx, s) {
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = "#111";
  for (let i = 0; i < 8; i++) ctx.fillRect(0, (i / 8) * s, s, s / 16);
}

function patternBwCheck(ctx, s) {
  const c = s / 4;
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      ctx.fillStyle = (x + y) % 2 ? "#111" : "#fff";
      ctx.fillRect(x * c, y * c, c, c);
    }
  }
}

function patternBwGrid(ctx, s) {
  ctx.fillStyle = "#f2f2f2";
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 3;
  const step = s / 4;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step, s);
    ctx.moveTo(0, i * step);
    ctx.lineTo(s, i * step);
    ctx.stroke();
  }
}

function patternBwDots(ctx, s) {
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = "#111";
  const step = s / 4;
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      ctx.beginPath();
      ctx.arc(x * step + step * 0.5, y * step + step * 0.5, step * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function patternBwDiag(ctx, s) {
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 4;
  for (let i = -4; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo(i * s * 0.25, 0);
    ctx.lineTo(i * s * 0.25 + s, s);
    ctx.stroke();
  }
}

function patternBwRings(ctx, s) {
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 4;
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, (s * 0.14) * i, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function patternBwTri(ctx, s) {
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.moveTo(s * 0.5, s * 0.12);
  ctx.lineTo(s * 0.88, s * 0.88);
  ctx.lineTo(s * 0.12, s * 0.88);
  ctx.closePath();
  ctx.fill();
}

function patternBwSolid(ctx, s) {
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = "#fff";
  ctx.fillRect(s * 0.2, s * 0.2, s * 0.6, s * 0.6);
}

function patternBwHoriz(ctx, s) {
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = "#111";
  for (let i = 0; i < 6; i++) ctx.fillRect((i / 6) * s, 0, s / 12, s);
}

function patternBwWave(ctx, s) {
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 5;
  for (let row = 0; row < 4; row++) {
    ctx.beginPath();
    const y0 = (row + 0.5) * (s / 4);
    ctx.moveTo(0, y0);
    for (let x = 0; x <= s; x += 4) {
      ctx.lineTo(x, y0 + Math.sin(x * 0.12 + row) * 8);
    }
    ctx.stroke();
  }
}

function patternBwPlus(ctx, s) {
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = "#111";
  ctx.fillRect(s * 0.42, s * 0.1, s * 0.16, s * 0.8);
  ctx.fillRect(s * 0.1, s * 0.42, s * 0.8, s * 0.16);
}

function patternBwDiamond(ctx, s) {
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.moveTo(s * 0.5, s * 0.1);
  ctx.lineTo(s * 0.9, s * 0.5);
  ctx.lineTo(s * 0.5, s * 0.9);
  ctx.lineTo(s * 0.1, s * 0.5);
  ctx.closePath();
  ctx.fill();
}

const BW_PATTERNS = [
  { id: "stripes", draw: patternBwStripes },
  { id: "check", draw: patternBwCheck },
  { id: "grid", draw: patternBwGrid },
  { id: "dots", draw: patternBwDots },
  { id: "diag", draw: patternBwDiag },
  { id: "rings", draw: patternBwRings },
  { id: "tri", draw: patternBwTri },
  { id: "solid", draw: patternBwSolid },
  { id: "horiz", draw: patternBwHoriz },
  { id: "wave", draw: patternBwWave },
  { id: "plus", draw: patternBwPlus },
  { id: "diamond", draw: patternBwDiamond },
];

function bwTex(id) {
  const p = BW_PATTERNS.find((x) => x.id === id) || BW_PATTERNS[0];
  return canvasTex(`bwFloor_${p.id}`, p.draw);
}

export function applyFloorChoice(btnUd) {
  const floor = btnUd.floor;
  if (!floor?.material) return;
  const m = floor.material;
  if (btnUd.kind === "color") {
    // clear any previous map so colour is not tinted by old blue/texture
    if (m.map) {
      m.map = null;
    }
    m.color.setHex(btnUd.color);
    m.emissive.setHex(0x000000);
    m.emissiveIntensity = 0;
    m.needsUpdate = true;
    return;
  }
  if (btnUd.kind === "pattern") {
    const map = bwTex(btnUd.patternId).clone();
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    const size = btnUd.size || { w: 8, d: 8 };
    map.repeat.set(Math.max(0.5, size.w / 4.5), Math.max(0.5, size.d / 4.5));
    map.colorSpace = THREE.SRGBColorSpace;
    map.needsUpdate = true;
    m.map = map;
    // neutral multiply so B/W pattern stays true (don't keep old blue tint)
    m.color.setHex(0xffffff);
    m.emissive.setHex(0x000000);
    m.emissiveIntensity = 0;
    m.needsUpdate = true;
  }
}

function makePanelBoard(group, x, y, z, rotY, cols, rows, buildButtons) {
  const panel = new THREE.Group();
  panel.position.set(x, y, z);
  panel.rotation.y = rotY;
  group.add(panel);

  const btnW = 0.17;
  const btnH = 0.13;
  const gapX = 0.07;
  const gapY = 0.07;
  const pad = 0.16;
  const readH = 0.14;
  const readGap = 0.1;

  const gridW = cols * btnW + (cols - 1) * gapX;
  const gridH = rows * btnH + (rows - 1) * gapY;
  const contentH = gridH + readGap + readH;
  const faceW = gridW + pad * 2;
  const faceH = contentH + pad * 2;

  panel.add(box(faceW + 0.08, faceH + 0.08, 0.06, mat(0xc5ccd6, { metalness: 0.2, roughness: 0.7 }), 0, 0, 0));
  panel.add(box(faceW, faceH, 0.02, mat(0xe8ecf1, { metalness: 0.05, roughness: 0.75 }), 0, 0, 0.035));

  const gridBottom = -faceH / 2 + pad;
  const gridCenterY = gridBottom + gridH / 2;
  const readY = gridBottom + gridH + readGap + readH / 2;

  buildButtons(panel, {
    btnW, btnH, gapX, gapY, cols, rows, gridCenterY, readY, gridW, readH,
  });
  return panel;
}

/** Colourful board — pick this room's floor colour */
function makeFloorColorPanel(room, targets, x, y, z, rotY = 0, cols = 4, rows = 3) {
  const floor = room.userData.floor;
  makePanelBoard(room, x, y, z, rotY, cols, rows, (panel, L) => {
    let i = 0;
    for (let r = 0; r < L.rows; r++) {
      for (let c = 0; c < L.cols; c++) {
        const bx = (c - (L.cols - 1) / 2) * (L.btnW + L.gapX);
        const by = L.gridCenterY + (r - (L.rows - 1) / 2) * (L.btnH + L.gapY);
        const col = FLOOR_COLORS[i % FLOOR_COLORS.length];
        const btn = box(L.btnW, L.btnH, 0.018, mat(col, {
          emissive: col, emissiveIntensity: 0.55, roughness: 0.85, metalness: 0.02,
        }), bx, by, 0.05);
        btn.userData.floorInteract = true;
        btn.userData.kind = "color";
        btn.userData.color = col;
        btn.userData.floor = floor;
        btn.userData.label = "Floor colour";
        targets.push(btn);
        panel.add(btn);
        i++;
      }
    }
    panel.add(box(L.gridW, L.readH, 0.018, mat(0x101820, {
      emissive: 0x44aaff, emissiveIntensity: 0.5, roughness: 0.8,
    }), 0, L.readY, 0.05));
  });
}

/** B/W pattern board — pick this room's floor overlay */
function makeFloorPatternPanel(room, targets, x, y, z, rotY = 0, cols = 4, rows = 3) {
  const floor = room.userData.floor;
  const size = room.userData.floorSize || { w: 8, d: 8 };
  makePanelBoard(room, x, y, z, rotY, cols, rows, (panel, L) => {
    let i = 0;
    for (let r = 0; r < L.rows; r++) {
      for (let c = 0; c < L.cols; c++) {
        const bx = (c - (L.cols - 1) / 2) * (L.btnW + L.gapX);
        const by = L.gridCenterY + (r - (L.rows - 1) / 2) * (L.btnH + L.gapY);
        const pat = BW_PATTERNS[i % BW_PATTERNS.length];
        const map = bwTex(pat.id).clone();
        map.colorSpace = THREE.SRGBColorSpace;
        map.needsUpdate = true;
        const btn = box(L.btnW, L.btnH, 0.018, new THREE.MeshStandardMaterial({
          map,
          color: 0xffffff,
          roughness: 0.7,
          metalness: 0.05,
        }), bx, by, 0.05);
        btn.userData.floorInteract = true;
        btn.userData.kind = "pattern";
        btn.userData.patternId = pat.id;
        btn.userData.floor = floor;
        btn.userData.size = size;
        btn.userData.label = "Floor pattern";
        targets.push(btn);
        panel.add(btn);
        i++;
      }
    }
    panel.add(box(L.gridW, L.readH, 0.018, mat(0x101010, {
      emissive: 0xffffff, emissiveIntensity: 0.25, roughness: 0.75,
    }), 0, L.readY, 0.05));
  });
}

/** Turn the whole ceiling into a borderless light plane (modern) */
function makeFullCeilingLight(room, color, emissiveIntensity = 1.25) {
  const ceil = room.userData.ceiling;
  if (!ceil?.material) return;
  const m = ceil.material;
  m.color.setHex(color);
  m.emissive = m.emissive || new THREE.Color();
  m.emissive.setHex(color);
  m.emissiveIntensity = emissiveIntensity;
  m.roughness = 0.45;
  m.metalness = 0.05;
  m.needsUpdate = true;
}

/** Rounded rectangular outline light on the ceiling (hollow frame) */
function makeRectOutlineLight(room, color, marginScale = 0.12, bar = 0.28) {
  const { w, d, h } = room.userData.dims || { w: 8, d: 8, h: 5 };
  if (room.userData.ceilingRing) room.userData.ceilingRing.visible = false;
  // remove prior outline if restyled
  if (room.userData.rectOutline) {
    room.remove(room.userData.rectOutline);
    room.userData.rectOutline.geometry?.dispose?.();
    room.userData.rectOutline = null;
  }

  const mx = w * marginScale;
  const mz = d * marginScale;
  const outerW = w - mx * 2;
  const outerD = d - mz * 2;
  const innerW = Math.max(0.5, outerW - bar * 2);
  const innerD = Math.max(0.5, outerD - bar * 2);
  const cornerR = Math.min(bar * 1.35, outerW * 0.12, outerD * 0.12);
  const innerR = Math.max(0.05, cornerR - bar * 0.55);

  const outer = roundedRectShape(outerW, outerD, cornerR);
  const holeShape = roundedRectShape(innerW, innerD, innerR);
  const holePts = holeShape.getPoints(36);
  const hole = new THREE.Path();
  for (let i = holePts.length - 1; i >= 0; i--) {
    const p = holePts[i];
    if (i === holePts.length - 1) hole.moveTo(p.x, p.y);
    else hole.lineTo(p.x, p.y);
  }
  outer.holes.push(hole);

  const lightMat = mat(color, {
    emissive: color,
    emissiveIntensity: 1.45,
    roughness: 0.35,
    metalness: 0.12,
  });

  const geo = new THREE.ExtrudeGeometry(outer, {
    depth: 0.08,
    bevelEnabled: false,
    curveSegments: 16,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, 0);
  const outline = new THREE.Mesh(geo, lightMat);
  outline.position.set(0, h - 0.1, 0);
  outline.castShadow = false;
  outline.receiveShadow = false;
  room.add(outline);
  room.userData.rectOutline = outline;
  room.userData.rectOutlineMat = lightMat;
  return outline;
}

function tintCeilingFixtures(room, color, emissiveIntensity = 1.2) {
  const ring = room.userData.ceilingRing;
  if (ring?.material) {
    ring.material.color.setHex(color);
    if (ring.material.emissive) ring.material.emissive.setHex(color);
    ring.material.emissiveIntensity = emissiveIntensity;
  }
  if (room.userData.ceilingLight) room.userData.ceilingLight.color.setHex(color);
}

/**
 * Per-room look with few real lights (perf).
 * Corridors / eng access / engine / garden: full ceiling light, no ring.
 * Control: flat circle area light (no torus).
 */
function styleRoomLighting(room, kind) {
  const { w, d, h } = room.userData.dims || { w: 8, d: 8, h: 5 };
  const key = room.userData.ceilingLight;
  const fill = room.userData.fillLight;
  const ring = room.userData.ceilingRing;
  const span = Math.max(w, d);
  room.userData.lightKind = kind;

  const setKey = (col, intensity) => {
    if (!key) return;
    key.color.setHex(col);
    key.intensity = intensity;
    // Keep lights mostly inside this room (old span*2.6 let cockpit SOS paint the ship)
    key.distance = Math.min(span * 1.05, Math.hypot(w, d) * 0.62 + 2.5);
    key.decay = 2;
    key.position.set(0, h - 0.35, 0);
  };
  const setFill = (col, intensity) => {
    if (!fill) return;
    fill.color.setHex(col);
    fill.intensity = intensity;
    fill.distance = Math.min(span * 0.95, Math.hypot(w, d) * 0.55 + 2);
    fill.decay = 2;
    fill.visible = intensity > 0.01;
  };
  const hideRing = () => { if (ring) ring.visible = false; };

  if (kind === "corridor" || kind === "engAccess") {
    hideRing();
    setFill(0x000000, 0);
    const panelCol = kind === "engAccess" ? 0xff9944 : 0xc0dcff;
    makeFullCeilingLight(room, panelCol, 1.4);
    setKey(panelCol, kind === "engAccess" ? 2.6 : 2.8);
    return;
  }

  if (kind === "engine") {
    hideRing();
    setFill(0xff7a18, 0.45);
    makeFullCeilingLight(room, 0xff7a18, 1.35);
    setKey(0xff7a18, 2.4);
    return;
  }

  if (kind === "control") {
    hideRing();
    makeRectOutlineLight(room, 0xa8ccff, 0.1, 0.32);
    setKey(0xb8d4ff, 2.6);
    setFill(0xd0e4ff, 0.65);
    // Extra-tight range so red SOS in the bridge cannot wash the corridor/hub
    if (key) key.distance = Math.min(key.distance, 11.5);
    if (fill) fill.distance = Math.min(fill.distance, 9.5);
    return;
  }

  if (kind === "garden") {
    // purple ceiling ring only (not a full light panel)
    if (ring) ring.visible = true;
    tintCeilingFixtures(room, 0xaa55dd, 1.45);
    setKey(0xaa66ee, 2.4);
    setFill(0xb070e0, 0.35);
    return;
  }

  if (kind === "hub") {
    hideRing();
    if (room.userData.rectOutline) room.userData.rectOutline.visible = false;
    // no ceiling fixtures — floor glow is the light
    setKey(0xffffff, 0.35);
    setFill(0xffffff, 0.2);
    if (key) key.position.set(0, 1.2, 0);
  } else if (kind === "conference") {
    setKey(0xffe8c8, 2.5);
    setFill(0xffe0bb, 0.7);
    tintCeilingFixtures(room, 0xffe0c0, 1.2);
  } else if (kind === "crewDeck") {
    setKey(0xe0e8f2, 2.4);
    setFill(0xd0d8e4, 0.55);
    tintCeilingFixtures(room, 0xd8e0ea, 1.1);
  } else if (kind === "crew") {
    setKey(0xffe4c8, 2.2);
    setFill(0xffd8b0, 0.55);
    tintCeilingFixtures(room, 0xffe0c4, 1.05);
  } else if (kind === "hygiene") {
    setKey(0xe0f0ff, 2.7);
    setFill(0xd0e8f8, 0.7);
    tintCeilingFixtures(room, 0xd8eefc, 1.3);
  }
}

const SOS_RED = 0xff1a1a;
const SOS_RED_FILL = 0xff3030;

/** Force a room into emergency SOS lighting (red). Pulse via updateSosLights. */
export function applySosLighting(room) {
  if (!room?.userData) return;
  room.userData.lightMode = "sos";
  const key = room.userData.ceilingLight;
  const fill = room.userData.fillLight;
  const ring = room.userData.ceilingRing;
  const ceil = room.userData.ceiling;
  const keyBase = 2.55;
  const fillBase = 0.95;

  if (key) {
    key.color.setHex(SOS_RED);
    key.intensity = keyBase;
    key.userData.sosBaseIntensity = keyBase;
    const dims = room.userData.dims;
    if (dims) {
      const span = Math.max(dims.w, dims.d);
      key.distance = Math.min(span * 1.0, Math.hypot(dims.w, dims.d) * 0.58 + 2);
      key.decay = 2;
    }
  }
  if (fill) {
    fill.color.setHex(SOS_RED_FILL);
    fill.intensity = fillBase;
    fill.visible = true;
    fill.userData.sosBaseIntensity = fillBase;
    const dims = room.userData.dims;
    if (dims) {
      const span = Math.max(dims.w, dims.d);
      fill.distance = Math.min(span * 0.9, Math.hypot(dims.w, dims.d) * 0.5 + 1.8);
      fill.decay = 2;
    }
  }
  // Cockpit Ad Astra ceiling brand — tint with SOS (emissive text, not a light)
  const brand = room.userData.ceilingBrand;
  if (brand?.material?.color) {
    if (!brand.userData.baseColor) {
      brand.userData.baseColor = brand.material.color.clone();
    }
    brand.material.color.setHex(0xff6a6a);
    brand.material.opacity = Math.min(1, (brand.material.opacity || 1) * 1.05);
    brand.material.needsUpdate = true;
  }
  if (ring?.material) {
    ring.material.color.setHex(SOS_RED);
    if (ring.material.emissive) ring.material.emissive.setHex(SOS_RED);
    ring.material.emissiveIntensity = 1.25;
    ring.material.userData.sosBaseEmissive = 1.25;
  }
  if (ceil?.material) {
    const m = ceil.material;
    m.color.setHex(SOS_RED);
    if (!m.emissive) m.emissive = new THREE.Color();
    m.emissive.setHex(SOS_RED);
    m.emissiveIntensity = 1.15;
    m.userData.sosBaseEmissive = 1.15;
    m.needsUpdate = true;
  }
  if (room.userData.rectOutlineMat) {
    const m = room.userData.rectOutlineMat;
    m.color.setHex(SOS_RED);
    m.emissive.setHex(SOS_RED);
    m.emissiveIntensity = 1.35;
    m.userData.sosBaseEmissive = 1.35;
  }
  if (room.userData.floor?.material?.emissive) {
    // hub-style emissive floors follow SOS too
    const fm = room.userData.floor.material;
    if (fm.emissiveIntensity > 0.05) {
      fm.color.setHex(0x4a0808);
      fm.emissive.setHex(0x881010);
      fm.emissiveIntensity = 0.55;
      fm.userData.sosBaseEmissive = 0.55;
    }
  }
}

/**
 * Strong red / weak red emergency beat for SOS rooms.
 * ~1.1 Hz square-ish pulse (strong → weak → strong → weak).
 */
export function updateSosLights(rooms, t, hubNeon = null, hubStillSos = false) {
  if (!rooms || !rooms.length) return;
  const phase = Math.sin(t * Math.PI * 2.15);
  const strong = phase >= 0;
  const factor = strong ? 1 : 0.22;

  for (let i = 0; i < rooms.length; i++) {
    const room = rooms[i];
    if (!room?.userData || room.userData.lightMode !== "sos") continue;
    const key = room.userData.ceilingLight;
    const fill = room.userData.fillLight;
    const ring = room.userData.ceilingRing;
    const ceil = room.userData.ceiling;

    if (key) {
      const base = key.userData.sosBaseIntensity ?? 2.4;
      key.intensity = base * factor;
      key.color.setHex(SOS_RED);
    }
    if (fill) {
      const base = fill.userData.sosBaseIntensity ?? 0.9;
      fill.intensity = base * factor;
      fill.color.setHex(SOS_RED_FILL);
    }
    if (ring?.material) {
      const base = ring.material.userData.sosBaseEmissive ?? 1.2;
      ring.material.emissiveIntensity = base * (strong ? 1 : 0.25);
    }
    if (ceil?.material) {
      const base = ceil.material.userData.sosBaseEmissive ?? 1.1;
      ceil.material.emissiveIntensity = base * (strong ? 1 : 0.28);
    }
    if (room.userData.rectOutlineMat) {
      const m = room.userData.rectOutlineMat;
      const base = m.userData.sosBaseEmissive ?? 1.3;
      m.emissiveIntensity = base * (strong ? 1 : 0.25);
    }
    const fm = room.userData.floor?.material;
    if (fm?.userData?.sosBaseEmissive != null) {
      fm.emissiveIntensity = fm.userData.sosBaseEmissive * (strong ? 1 : 0.3);
    }
  }

  // Only pulse hub neon while Hub itself is still in SOS (not when other rooms are)
  if (hubNeon && hubStillSos) {
    const c = hubNeon.color;
    c.setHex(SOS_RED);
    if (hubNeon.holo?.emissive) {
      hubNeon.holo.emissive.copy(c);
      if (hubNeon.holo.emissiveIntensity != null) {
        hubNeon.holo.emissiveIntensity = strong ? 0.95 : 0.2;
      }
    }
    if (hubNeon.light) {
      hubNeon.light.color.copy(c);
      hubNeon.light.intensity = strong ? 2.8 : 0.55;
    }
    if (hubNeon.ceilingLight) {
      hubNeon.ceilingLight.color.copy(c);
      hubNeon.ceilingLight.intensity = strong ? 2.4 : 0.45;
    }
  }
}

function enableSos(room, anim) {
  applySosLighting(room);
  if (anim?.sosRooms) anim.sosRooms.push(room);
}

/** Restore a room from SOS after all its wall monitors are debugged. */
export function clearSosLighting(room, anim = null) {
  if (!room?.userData) return;
  room.userData.lightMode = "normal";
  const kind = room.userData.lightKind;

  const key = room.userData.ceilingLight;
  const fill = room.userData.fillLight;
  if (key?.userData) delete key.userData.sosBaseIntensity;
  if (fill?.userData) delete fill.userData.sosBaseIntensity;

  const ceil = room.userData.ceiling?.material;
  if (ceil) {
    const base = room.userData.ceilBaseColor ?? 0xe8eef5;
    ceil.color.setHex(base);
    if (ceil.emissive) ceil.emissive.setHex(0x000000);
    ceil.emissiveIntensity = 0;
    if (ceil.userData) delete ceil.userData.sosBaseEmissive;
    ceil.needsUpdate = true;
  }
  const ring = room.userData.ceilingRing;
  if (ring?.material?.userData) delete ring.material.userData.sosBaseEmissive;
  if (room.userData.rectOutlineMat?.userData) {
    delete room.userData.rectOutlineMat.userData.sosBaseEmissive;
  }
  const floor = room.userData.floor?.material;
  if (floor?.userData) delete floor.userData.sosBaseEmissive;

  if (kind) styleRoomLighting(room, kind);

  // Cockpit: force cool lighting + kill any leftover SOS ceiling glow
  if (kind === "control") {
    if (ring) ring.visible = false;
    if (key) {
      key.color.setHex(0xb8d4ff);
      key.intensity = 2.75;
      key.distance = Math.min(
        Math.max(room.userData.dims?.w || 16, room.userData.dims?.d || 10) * 1.0,
        Math.hypot(room.userData.dims?.w || 16, room.userData.dims?.d || 10) * 0.58 + 2
      );
      key.decay = 2;
    }
    if (fill) {
      fill.color.setHex(0xd0e4ff);
      fill.intensity = 0.75;
      fill.visible = true;
      fill.distance = Math.min(
        Math.max(room.userData.dims?.w || 16, room.userData.dims?.d || 10) * 0.9,
        Math.hypot(room.userData.dims?.w || 16, room.userData.dims?.d || 10) * 0.5 + 1.8
      );
      fill.decay = 2;
    }
    if (ceil) {
      ceil.color.setHex(room.userData.ceilBaseColor ?? 0xf4f6f8);
      if (ceil.emissive) ceil.emissive.setHex(0x000000);
      ceil.emissiveIntensity = 0;
      ceil.needsUpdate = true;
    }
    if (room.userData.rectOutlineMat) {
      const m = room.userData.rectOutlineMat;
      m.color.setHex(0xa8ccff);
      if (m.emissive) m.emissive.setHex(0xa8ccff);
      m.emissiveIntensity = 1.15;
    }
    const brand = room.userData.ceilingBrand;
    if (brand?.material?.color) {
      if (brand.userData.baseColor) {
        brand.material.color.copy(brand.userData.baseColor);
      } else {
        brand.material.color.setHex(0xffffff);
      }
      brand.material.needsUpdate = true;
    }
  }

  // Ensure ring/outline are not left on SOS red after restyle
  if (kind === "hub") {
    if (ring) ring.visible = false;
    if (room.userData.rectOutline) room.userData.rectOutline.visible = false;
  }

  if (kind === "hub" && anim?.hubNeon) {
    const hn = anim.hubNeon;
    if (hn.floor) {
      hn.floor.color.setHex(0x0e3d34);
      if (hn.floor.emissive) hn.floor.emissive.setHex(0x0e3d34);
      hn.floor.emissiveIntensity = 0.55;
    }
    if (hn.ceiling) {
      hn.ceiling.color.setHex(0x44ffcc);
      if (hn.ceiling.emissive) hn.ceiling.emissive.setHex(0x44ffcc);
      hn.ceiling.emissiveIntensity = 0.95;
    }
    if (hn.holo?.emissive) {
      hn.holo.emissive.setHex(0x44ffcc);
      if (hn.holo.emissiveIntensity != null) hn.holo.emissiveIntensity = 0.85;
    }
    if (hn.light) {
      hn.light.color.setHex(0x88ffdd);
      hn.light.intensity = 3.2;
    }
    if (hn.ceilingLight) {
      hn.ceilingLight.color.setHex(0xffffff);
      hn.ceilingLight.intensity = 0.35;
    }
  }

  // Hub is the spine: clearing it also restores corridors + crew deck (no monitors there)
  if (kind === "hub" && anim?.hubLinkedSosRooms?.length) {
    for (const linked of anim.hubLinkedSosRooms) {
      if (linked && linked !== room && linked.userData?.lightMode === "sos") {
        clearSosLighting(linked, null);
      }
    }
  }

  // Cockpit clear also restores the north corridor (its red light spills into the cockpit)
  if (kind === "control" && anim?.cockpitLinkedSosRooms?.length) {
    for (const linked of anim.cockpitLinkedSosRooms) {
      if (linked && linked !== room && linked.userData?.lightMode === "sos") {
        clearSosLighting(linked, null);
      }
    }
  }

  if (anim) syncShipSosActive(anim);
}

/** True while any SOS room is still in emergency lighting. */
export function syncShipSosActive(anim) {
  if (!anim) return false;
  let any = false;
  for (const room of anim.sosRooms || []) {
    if (room?.userData?.lightMode === "sos") {
      any = true;
      break;
    }
  }
  anim.sosActive = any;
  return any;
}

/** Orange while room is SOS + undebugged; calm blue/cyan once debugged. */
export function applyWallMonitorVisual(wm) {
  if (!wm || wm.repairing) return;
  const roomSos = wm.room?.userData?.lightMode === "sos";
  const sos = roomSos && !wm.debugged;
  setWallMonitorSosBlend(wm, sos ? 0 : 1);
  syncDebugHoloVisibility(wm);
}

/** u=0 orange SOS · u=1 calm blue (used by repair bar tween). */
export function setWallMonitorSosBlend(wm, u) {
  if (!wm) return;
  const t = Math.max(0, Math.min(1, u));
  const lerpC = (a, b) => {
    const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    const r = (ar + (br - ar) * t) | 0;
    const g = (ag + (bg - ag) * t) | 0;
    const bl = (ab + (bb - ab) * t) | 0;
    return (r << 16) | (g << 8) | bl;
  };
  if (wm.screenMat?.emissive) {
    wm.screenMat.emissive.setHex(lerpC(0xcc5510, 0x1a90cc));
    wm.screenMat.color.setHex(lerpC(0x2a1208, 0x0a2030));
    if (wm.screenMat.emissiveIntensity != null) {
      wm.screenMat.emissiveIntensity = 0.85 + (1 - t) * 0.1;
    }
  }
  for (const bm of wm.barMats || []) {
    const c = lerpC(0xff7a33, 0x44ffcc);
    if (bm.emissive) bm.emissive.setHex(c);
    if (bm.color) bm.color.setHex(c);
  }
  for (let i = 0; i < (wm.ringMats || []).length; i++) {
    const rm = wm.ringMats[i];
    if (!rm?.color) continue;
    const o = i % 2 ? 0xff9944 : 0xff6622;
    const n = i % 2 ? 0x66ffcc : 0x44aaff;
    rm.color.setHex(lerpC(o, n));
  }
  if (wm.underGlowMat?.emissive) {
    const c = lerpC(0xff7a33, 0x3ec8ff);
    wm.underGlowMat.emissive.setHex(c);
    if (wm.underGlowMat.color) wm.underGlowMat.color.setHex(c);
  }
}

function syncDebugHoloVisibility(wm) {
  const h = wm?.debugHolo;
  if (!h) return;
  const show =
    !wm.debugged &&
    !wm.repairing &&
    wm.room?.userData?.lightMode === "sos";
  h.visible = !!show;
  if (!show && h.material) {
    if (h.userData.baseMap) h.material.map = h.userData.baseMap;
    h.material.color.setRGB(1, 1, 1);
    h.material.opacity = h.userData.baseOpacity ?? 0.55;
  }
}

/** Clickable SOS text on wall monitors (same idea as door unlock holos). */
function makeDebugMonitorHolo(maxW = 1.6, maxH = 0.85) {
  const lines = ["Debug", "with " + MONITOR_DEBUG_COST + " data points"];
  const orange = makeHoloLinesTexture(lines, {
    fill: "#ff9944",
    shadow: "rgba(200, 80, 20, 0.9)",
    fontPx: 44,
  });
  const bright = makeHoloLinesTexture(lines, {
    fill: "#ffe0a8",
    shadow: "rgba(255, 160, 60, 0.95)",
    fontPx: 44,
  });
  const aspect = Math.max(0.5, orange.aspect || 1.6);
  // Compact label — lower third of the monitor, stay inside the face
  let planeH = Math.min(maxH * 0.36, 0.4);
  let planeW = planeH * aspect;
  const maxPlaneW = Math.max(0.28, maxW * 0.58);
  const maxPlaneH = Math.max(0.16, maxH * 0.34);
  if (planeW > maxPlaneW) {
    planeW = maxPlaneW;
    planeH = planeW / aspect;
  }
  if (planeH > maxPlaneH) {
    planeH = maxPlaneH;
    planeW = planeH * aspect;
  }
  const mat = new THREE.MeshBasicMaterial({
    map: orange.tex,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
    // Slight bias vs screen face only — must still lose to real walls
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(planeW, planeH),
    mat
  );
  plane.renderOrder = 1;
  plane.userData.debugHolo = true;
  plane.userData.baseMap = orange.tex;
  plane.userData.hoverMap = bright.tex;
  plane.userData.baseOpacity = 0.55;
  plane.userData.hoverOpacity = 0.98;
  return plane;
}

function attachDebugHoloToMonitor(wm, opts = {}) {
  if (!wm?.group) return null;
  const maxW = opts.maxW ?? 1.6;
  const maxH = opts.maxH ?? 0.9;
  // Coplanar with screen face; sit in the lower part of the panel
  const z = opts.z ?? 0.081;
  const y = opts.y != null ? opts.y : -maxH * 0.3;
  const holo = makeDebugMonitorHolo(maxW, maxH);
  holo.position.set(opts.x ?? 0, y, z);
  if (opts.rotY) holo.rotation.y = opts.rotY;
  wm.group.add(holo);
  wm.debugHolo = holo;
  holo.userData.monitorId = wm.id;
  syncDebugHoloVisibility(wm);
  return holo;
}

export function refreshAllWallMonitors(anim) {
  for (const wm of anim?.wallMonitors || []) applyWallMonitorVisual(wm);
}

/** Re-SOS every tracked room and undebug monitors (ship reset). */
export function resetAllRoomSos(anim) {
  if (!anim) return;
  for (const room of anim.sosRooms || []) {
    applySosLighting(room);
  }
  for (const wm of anim.wallMonitors || []) {
    wm.debugged = false;
    applyWallMonitorVisual(wm);
  }
  anim.sosActive = true;
}

function monitorIdForRoom(room) {
  const label = String(room?.userData?.label || "room")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "room";
  const n = (room.userData._monitorSeq = (room.userData._monitorSeq || 0) + 1);
  return label + "-" + (n - 1);
}

function registerWallMonitor(anim, room, group, mats, holoOpts = {}) {
  if (!anim.wallMonitors) anim.wallMonitors = [];
  const id = monitorIdForRoom(room);
  const entry = {
    id,
    room,
    group,
    debugged: isMonitorDebugged(id),
    repairing: false,
    maxW: holoOpts.maxW ?? 1.6,
    maxH: holoOpts.maxH ?? 0.9,
    screenMat: mats.screenMat || null,
    barMats: mats.barMats || [],
    ringMats: mats.ringMats || [],
    underGlowMat: mats.underGlowMat || null,
    debugHolo: null,
  };
  anim.wallMonitors.push(entry);
  attachDebugHoloToMonitor(entry, holoOpts);
  applyWallMonitorVisual(entry);
  return entry;
}

/** @deprecated Press E removed — debug is click/tap on the monitor text. */
export function attachWallMonitorInteractables() {
  /* no-op */
}

/**
 * Mark monitor debugged; if room's last orange panel clears, exit SOS.
 * Returns { roomCleared, roomName } when the room returns to normal.
 */
export function debugWallMonitor(wm, anim) {
  if (!wm || wm.debugged) return { roomCleared: false, roomName: "" };
  wm.debugged = true;
  applyWallMonitorVisual(wm);
  const room = wm.room;
  const roomName = room?.userData?.label || "this room";
  const siblings = (anim?.wallMonitors || []).filter((m) => m.room === room);
  const allDone = siblings.length > 0 && siblings.every((m) => m.debugged);
  if (allDone && room?.userData?.lightMode === "sos") {
    clearSosLighting(room, anim);
    refreshAllWallMonitors(anim);
    return { roomCleared: true, roomName };
  }
  return { roomCleared: false, roomName };
}

function makeConsole(group, x, y, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  group.add(g);
  g.add(box(2.4, 0.85, 0.9, mat(0xc8d0da, { metalness: 0.4, roughness: 0.45 }), 0, 0.425, 0));
  g.add(box(2.2, 0.08, 0.7, mat(0xe8eef5, { metalness: 0.2, roughness: 0.4 }), 0, 0.9, -0.05));
  // Desk monitor facing the seat — keep mesh, stay translucent (less loud in SOS)
  const screen = box(2.0, 0.55, 0.06, mat(0x0a1828, {
    emissive: 0x2aa8e0,
    emissiveIntensity: 0.35,
    side: THREE.FrontSide,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
  }), 0, 1.25, -0.35);
  screen.rotation.y = Math.PI;
  screen.rotation.x = 0.45;
  g.add(screen);
  return g;
}

function makeChair(group, x, y, z, rotY = 0, color = METAL) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  group.add(g);
  const seat = mat(color, { metalness: 0.62, roughness: 0.32 });
  g.add(box(0.55, 0.08, 0.55, seat, 0, 0.45, 0));
  g.add(box(0.55, 0.55, 0.08, seat, 0, 0.75, -0.24));
  g.add(cyl(0.05, 0.05, 0.45, mat(METAL, { metalness: 0.7, roughness: 0.28 }), 0, 0.22, 0, 8));
  g.add(cyl(0.22, 0.22, 0.04, mat(METAL, { metalness: 0.7, roughness: 0.28 }), 0, 0.04, 0, 12));
  return g;
}

/** Simple round cylinder stool */
function makeCylinderStool(group, x, y, z, color = 0xd8dee6, h = 0.48, r = 0.22) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  group.add(g);
  const body = mat(color, { metalness: 0.35, roughness: 0.4 });
  const top = mat(0xeef2f6, { metalness: 0.25, roughness: 0.45 });
  g.add(cyl(r * 0.92, r, h, body, 0, h * 0.5, 0, 24));
  g.add(cyl(r * 1.02, r * 1.02, 0.045, top, 0, h + 0.02, 0, 24));
  return g;
}

/** Simple sofa couch — seat + back + arms (front faces local +Z) */
function makeSofa(group, x, y, z, rotY = 0, color = 0x8a9bb0, width = 2.2) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  group.add(g);
  const fabric = mat(color, { metalness: 0.08, roughness: 0.78 });
  const base = mat(0x6a7582, { metalness: 0.25, roughness: 0.55 });
  const d = 0.85;
  g.add(box(width, 0.18, d, fabric, 0, 0.38, 0));
  g.add(box(width, 0.55, 0.16, fabric, 0, 0.72, -d * 0.5 + 0.08));
  g.add(box(0.14, 0.42, d * 0.9, fabric, -width * 0.5 + 0.07, 0.58, 0.02));
  g.add(box(0.14, 0.42, d * 0.9, fabric, width * 0.5 - 0.07, 0.58, 0.02));
  g.add(box(width * 0.92, 0.1, d * 0.85, base, 0, 0.08, 0));
  return g;
}

/** canuread-main box avatar (solid bright palette), lit for the ship. */
function randomBrightColor() {
  return new THREE.Color(Math.random(), Math.random(), Math.random());
}

function saturateColorHSL(color, satMul = 1.65) {
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  color.setHSL(
    hsl.h,
    THREE.MathUtils.clamp(hsl.s * satMul, 0, 1),
    THREE.MathUtils.clamp(hsl.l * 1.06, 0.1, 0.93),
  );
  return color;
}

function createCrewAvatar(scale = 0.44) {
  const group = new THREE.Group();
  const skin = randomBrightColor();
  const outfit = randomBrightColor();
  const pants = new THREE.Color(outfit).multiplyScalar(0.7);
  saturateColorHSL(skin, 1.75);
  saturateColorHSL(outfit, 1.75);
  saturateColorHSL(pants, 1.6);

  const headMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.72, metalness: 0.05 });
  const bodyMat = new THREE.MeshStandardMaterial({ color: outfit, roughness: 0.78, metalness: 0.08 });
  const legMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.82, metalness: 0.06 });

  // 4:3 CRT-style head (wider than tall), soft round corners
  const head = extrudeRounded(1.2, 0.9, 1, 0.12, headMat);
  head.position.y = 0.95 * scale;
  head.scale.setScalar(scale);
  group.add(head);

  // matching 4:3 screen with soft round corners (+Z)
  const faceGlow = new THREE.Color().setHSL(Math.random(), 0.85, 0.45);
  const faceScreen = extrudeRounded(
    0.72,
    0.54,
    0.07,
    0.08,
    new THREE.MeshStandardMaterial({
      color: 0x081018,
      emissive: faceGlow,
      emissiveIntensity: 0.7,
      roughness: 0.35,
      metalness: 0.08,
    }),
  );
  faceScreen.position.z = 0.5;
  faceScreen.castShadow = false;
  faceScreen.receiveShadow = false;
  head.add(faceScreen);
  group.userData.faceScreen = faceScreen;

  const body = extrudeRounded(0.86 * scale, 0.95 * scale, 0.56 * scale, 0.1 * scale, bodyMat);
  body.position.y = 0.1 * scale;
  group.add(body);
  group.userData.body = body;

  // limbs — boxy but soft round corners (bevel so rounding shows on all edges)
  const leftArm = extrudeRoundedLimb(0.26 * scale, 0.78 * scale, 0.28 * scale, 0.08 * scale, bodyMat);
  const rightArm = leftArm.clone();
  rightArm.material = bodyMat;
  leftArm.position.set(-0.58 * scale, 0.1 * scale, 0);
  rightArm.position.set(0.58 * scale, 0.1 * scale, 0);
  group.add(leftArm, rightArm);

  const leftLeg = extrudeRoundedLimb(0.3 * scale, 0.66 * scale, 0.3 * scale, 0.12 * scale, legMat);
  const rightLeg = leftLeg.clone();
  rightLeg.material = legMat;
  leftLeg.position.set(-0.2 * scale, -0.67 * scale, 0);
  rightLeg.position.set(0.2 * scale, -0.67 * scale, 0);
  group.add(leftLeg, rightLeg);

  group.userData.head = head;
  group.userData.leftArm = leftArm;
  group.userData.rightArm = rightArm;
  group.userData.leftLeg = leftLeg;
  group.userData.rightLeg = rightLeg;
  group.userData.state = "idle";
  return group;
}

/** Put avatar into sitting state on a control chair (pose + idle fidget data). */
function seatCrewAtChair(room, x, z, rotY = 0, scale = 0.44) {
  const av = createCrewAvatar(scale);
  // seat cushion top ~0.49; body bottom at -0.375*scale → sit on cushion
  const seatTop = 0.49;
  const bodyBottom = -0.375 * scale;
  const sitY = seatTop - bodyBottom - 0.02;
  // sit forward of backrest so the head clears it (local +Z toward console)
  const forward = 0.12;
  const seatX = x + Math.sin(rotY) * forward;
  const seatZ = z + Math.cos(rotY) * forward;
  av.position.set(seatX, sitY, seatZ);
  av.rotation.y = rotY;
  const { head, leftLeg, rightLeg, leftArm, rightArm } = av.userData;
  // 90° sit: after -X rot, box depth becomes vertical thickness (0.3*scale)
  leftLeg.rotation.x = -Math.PI / 2;
  rightLeg.rotation.x = -Math.PI / 2;
  const thighHalfH = 0.15 * scale;
  const legY = seatTop + thighHalfH - sitY;
  const legZ = 0.28 * scale;
  leftLeg.position.set(-0.2 * scale, legY, legZ);
  rightLeg.position.set(0.2 * scale, legY, legZ);

  const armBaseX = -0.95;
  leftArm.rotation.x = armBaseX;
  rightArm.rotation.x = armBaseX;
  leftArm.position.z += 0.08 * scale;
  rightArm.position.z += 0.08 * scale;
  head.rotation.set(0, 0, 0);

  av.userData.state = "sitting";
  av.userData.sit = {
    armBaseX,
    armPhase: Math.random() * Math.PI * 2,
    nextArm: 0.8 + Math.random() * 2.5,
    nextHead: 0.2 + Math.random() * 0.7,
    nodReturn: null,
    armL: 0,
    armR: 0,
    armTargetL: 0,
    armTargetR: 0,
    headX: 0,
    headY: 0,
    headZ: 0,
    headTargetX: 0,
    headTargetY: 0,
    headTargetZ: 0,
    baseRotY: rotY,
    seatX,
    seatZ,
    sitY,
    attnRadius: 1.7,
    nearHold: 0,
    farHold: 0,
  };
  room.add(av);
  return av;
}

/**
 * Inactive sleeper in a bunk — parented to the bed so rotY follows the pod.
 * No attention / patrol; barely breathes until activated.
 */
const CREW_ROSTER = [
  { id: "nova", name: "Nova Chen", role: "helm officer", duty: "I'll take the cockpit helm.", work: "cockpit" },
  { id: "rex", name: "Rex Vale", role: "comms specialist", duty: "I'll staff the bridge consoles.", work: "cockpit" },
  { id: "mira", name: "Mira Sol", role: "archive keeper", duty: "I'll watch the Info Hub.", work: "hub" },
  { id: "jun", name: "Jun Park", role: "botanist", duty: "I'll tend hydroponics.", work: "garden" },
  { id: "tess", name: "Tess Orin", role: "chef", duty: "I'll get the diner running.", work: "kitchen" },
  { id: "kai", name: "Kai Holt", role: "reactor tech", duty: "I'll report to the engine room.", work: "engine" },
  { id: "lila", name: "Lila Voss", role: "hygiene officer", duty: "I'll take the washroom watch.", work: "washroom" },
  { id: "aden", name: "Aden Ruiz", role: "deck medic", duty: "I'll stay on crew deck.", work: "crewDeck" },
];

function poseSleeperLie(av, scale) {
  const mattressTop = 0.56;
  const halfThick = 0.26 * scale;
  av.position.set(0, mattressTop + halfThick, -0.2);
  av.rotation.set(-Math.PI / 2, 0, (Math.random() - 0.5) * 0.12);
  const { head, leftArm, rightArm, leftLeg, rightLeg, faceScreen } = av.userData;
  if (leftArm && rightArm) {
    leftArm.rotation.set(0.12, 0, 0.35);
    rightArm.rotation.set(0.08, 0, -0.32);
  }
  if (leftLeg && rightLeg) {
    leftLeg.rotation.set(0.06, 0, 0.04);
    rightLeg.rotation.set(-0.04, 0, -0.05);
  }
  if (head) {
    head.rotation.set(0.2, (Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.15);
  }
  if (faceScreen?.material) {
    faceScreen.material.emissiveIntensity = 0.12 + Math.random() * 0.08;
  }
}

function markSleeperMeshes(av) {
  const id = av.userData.npcId;
  av.traverse((o) => {
    if (!o.isMesh) return;
    o.userData.bedClick = false;
    o.userData.sleeperHit = true;
    o.userData.sleeperId = id;
  });
}

function layCrewInBed(bed, spec, scale = 0.4) {
  const av = createCrewAvatar(scale);
  poseSleeperLie(av, scale);
  av.userData.state = "sleeping";
  av.userData.npcId = spec.id;
  av.userData.npcName = spec.name;
  av.userData.npcRole = spec.role;
  av.userData.npcDuty = spec.duty;
  av.userData.npcWork = spec.work;
  av.userData.sleepScale = scale;
  av.userData.sleep = {
    phase: Math.random() * Math.PI * 2,
    baseY: av.position.y,
    body: av.userData.body,
  };
  av.userData.bed = bed;
  bed.userData.sleeper = av;
  bed.add(av);
  markSleeperMeshes(av);
  return av;
}

function workPathFor(work, aisle) {
  const deck = { x: 0, z: -10.25 };
  const south = { x: 0, z: -4.5 };
  const hub = { x: 0, z: 4.5 };
  const routes = {
    cockpit: [deck, south, hub, { x: 0, z: 13.5 }, { x: 3.5, z: 19.1 }],
    hub: [deck, south, { x: 2.4, z: 4.5 }],
    garden: [deck, south, hub, { x: -8.4, z: 8.0 }],
    kitchen: [deck, south, hub, { x: 10.6, z: 1.6 }],
    engine: [deck, { x: 0, z: -16 }, { x: 5.4, z: -22 }],
    washroom: [{ x: 12.8, z: -8.6 }],
    crewDeck: [{ x: -3.6, z: -10.25 }],
  };
  return [aisle, ...(routes[work] || routes.crewDeck)];
}

function aisleWorldFromBed(bed) {
  const local = new THREE.Vector3(0, 0, 1.15);
  bed.localToWorld(local);
  return { x: local.x, z: local.z };
}

function poseNpcStand(av, worldX, worldZ, yaw = 0) {
  const scale = av.userData.sleepScale || 0.4;
  av.position.set(worldX, scale, worldZ);
  av.rotation.set(0, yaw, 0);
  const { head, leftArm, rightArm, leftLeg, rightLeg, faceScreen } = av.userData;
  if (head) head.rotation.set(0, 0, 0);
  if (leftArm) leftArm.rotation.set(0, 0, 0);
  if (rightArm) rightArm.rotation.set(0, 0, 0);
  if (leftLeg) leftLeg.rotation.set(0, 0, 0);
  if (rightLeg) rightLeg.rotation.set(0, 0, 0);
  if (faceScreen?.material) faceScreen.material.emissiveIntensity = 0.85;
  if (av.userData.body) av.userData.body.scale.y = 1;
}

function attachNpcToRoot(av, root) {
  if (!av || !root || av.parent === root) return;
  av.updateWorldMatrix(true, false);
  const pos = new THREE.Vector3();
  av.getWorldPosition(pos);
  root.add(av);
  av.position.copy(pos);
}

/** Wake a sleeper: stand + wave on the bunk, then talk, then walk to work. */
export function beginNpcWake(av, root) {
  if (!av || av.userData.state === "awake" || av.userData.state === "waking") return false;
  const bed = av.userData.bed;
  if (bed?.userData?.podClosed) toggleBedPod(bed);
  attachNpcToRoot(av, root);
  const wp = new THREE.Vector3();
  av.getWorldPosition(wp);
  const aisle = aisleWorldFromBed(bed);
  const yaw = Math.atan2(aisle.x - wp.x, aisle.z - wp.z);
  poseNpcStand(av, wp.x, wp.z, yaw);
  av.userData.state = "waking";
  av.userData.sleep = null;
  av.userData.wake = {
    phase: "wave",
    t: 2.4,
    path: workPathFor(av.userData.npcWork, aisle),
    wp: 0,
    phaseWalk: Math.random() * Math.PI * 2,
    spoke: false,
  };
  try {
    markNpcActivated(av.userData.npcId);
  } catch (_) {}
  return true;
}

function placeNpcAtWork(av, root) {
  attachNpcToRoot(av, root);
  const aisle = aisleWorldFromBed(av.userData.bed);
  const path = workPathFor(av.userData.npcWork, aisle);
  const last = path[path.length - 1];
  poseNpcStand(av, last.x, last.z, 0);
  av.userData.state = "awake";
  av.userData.sleep = null;
  av.userData.wake = {
    phase: "work",
    t: 1 + Math.random() * 2,
    path,
    wp: path.length,
    phaseWalk: Math.random() * Math.PI * 2,
    workHome: last,
    workTarget: { x: last.x, z: last.z },
    spoke: true,
  };
  const bed = av.userData.bed;
  if (bed) {
    bed.userData.podClosed = false;
    if (bed.userData.pod) {
      bed.userData.pod.visible = false;
      bed.userData.pod.position.y = bed.userData.openY;
    }
  }
}

export function sleeperFromHit(obj, crew) {
  let o = obj;
  let id = null;
  while (o) {
    if (o.userData?.sleeperId) {
      id = o.userData.sleeperId;
      break;
    }
    if (o.userData?.npcId) {
      id = o.userData.npcId;
      break;
    }
    o = o.parent;
  }
  if (!id) return null;
  return (crew || []).find((a) => a.userData.npcId === id) || null;
}

export function resetSleepingCrew(anim, root) {
  if (!anim?.sleepingCrew) return;
  for (const av of anim.sleepingCrew) {
    const bed = av.userData.bed;
    if (!bed) continue;
    if (av.parent !== bed) bed.add(av);
    poseSleeperLie(av, av.userData.sleepScale || 0.4);
    av.userData.state = "sleeping";
    av.userData.wake = null;
    av.userData.sleep = {
      phase: Math.random() * Math.PI * 2,
      baseY: av.position.y,
      body: av.userData.body,
    };
    markSleeperMeshes(av);
    bed.userData.podClosed = true;
    if (bed.userData.pod) {
      bed.userData.pod.visible = true;
      bed.userData.pod.position.y = bed.userData.closedY;
    }
  }
}

/** Soft idle breathe for sleeping bunk crew (very cheap). */
const _avWorld = new THREE.Vector3();
export function updateSleepingCrew(crew, t, playerPos = null, maxDist = 22) {
  if (!crew?.length) return;
  const maxD2 = maxDist * maxDist;
  for (let i = 0; i < crew.length; i++) {
    const av = crew[i];
    if (av.userData.state !== "sleeping") continue;
    const s = av.userData.sleep;
    if (!s) continue;
    if (playerPos) {
      av.getWorldPosition(_avWorld);
      if (_avWorld.distanceToSquared(playerPos) > maxD2) continue;
    }
    const breathe = Math.sin(t * 1.1 + s.phase) * 0.008;
    av.position.y = s.baseY + breathe;
    if (s.body) {
      s.body.scale.y = 1 + breathe * 2.2;
    }
  }
}

const _wakeFwd = new THREE.Vector3();

/** Stand / wave / walk / work for dehibernated bunk crew. */
export function updateAwakeCrew(crew, dt, t) {
  if (!crew?.length) return;
  for (let i = 0; i < crew.length; i++) {
    const av = crew[i];
    const w = av.userData.wake;
    if (!w) continue;
    const { head, leftArm, rightArm, leftLeg, rightLeg } = av.userData;
    const scale = av.userData.sleepScale || 0.4;

    if (w.phase === "wave" || w.phase === "talk") {
      w.t -= dt;
      if (rightArm) {
        rightArm.rotation.z = -0.2 - Math.abs(Math.sin(t * 9.5)) * 1.15;
        rightArm.rotation.x = -0.35;
      }
      if (leftArm) {
        leftArm.rotation.z = 0.18;
        leftArm.rotation.x = 0.08;
      }
      if (head) head.rotation.y = Math.sin(t * 2.4) * 0.18;
      av.position.y = scale + Math.sin(t * 6) * 0.012;
      if (w.phase === "wave" && w.t <= 0 && !w.spoke) {
        w.spoke = true;
        w.phase = "talk";
        w.t = 0.5;
        const name = av.userData.npcName || "crew";
        const role = av.userData.npcRole || "crew";
        const duty = av.userData.npcDuty || "I'll get to work.";
        shipVoice.speak("Thanks for dehibernating me, Captain.");
        shipVoice.speak("I'm " + name + ", " + role + ". " + duty);
      }
      if (w.phase === "talk" && w.spoke && w.t <= 0 && !shipVoice.speaking) {
        w.phase = "walk";
        w.wp = 0;
        if (rightArm) rightArm.rotation.set(0, 0, 0);
        if (leftArm) leftArm.rotation.set(0, 0, 0);
      }
      continue;
    }

    if (w.phase === "walk") {
      const target = w.path[w.wp];
      if (!target) {
        w.phase = "work";
        w.workHome = w.path[w.path.length - 1] || { x: av.position.x, z: av.position.z };
        w.workTarget = { ...w.workHome };
        w.t = 0.8 + Math.random() * 1.6;
        av.userData.state = "awake";
        continue;
      }
      const dx = target.x - av.position.x;
      const dz = target.z - av.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.22) {
        w.wp += 1;
        continue;
      }
      const step = Math.min(dist, 2.35 * dt);
      const inv = 1 / dist;
      av.position.x += dx * inv * step;
      av.position.z += dz * inv * step;
      const face = Math.atan2(dx, dz);
      let dyaw = face - av.rotation.y;
      while (dyaw > Math.PI) dyaw -= Math.PI * 2;
      while (dyaw < -Math.PI) dyaw += Math.PI * 2;
      av.rotation.y += dyaw * Math.min(1, 10 * dt);
      w.phaseWalk += 8.2 * dt;
      const swing = Math.sin(w.phaseWalk) * 0.48;
      if (leftLeg) leftLeg.rotation.x = swing;
      if (rightLeg) rightLeg.rotation.x = -swing;
      if (leftArm) leftArm.rotation.x = -swing * 0.85;
      if (rightArm) rightArm.rotation.x = swing * 0.85;
      av.position.y = scale + Math.abs(Math.sin(w.phaseWalk)) * 0.025;
      continue;
    }

    if (w.phase === "work") {
      w.t -= dt;
      if (w.t <= 0) {
        w.t = 1.4 + Math.random() * 2.8;
        const home = w.workHome || { x: av.position.x, z: av.position.z };
        w.workTarget = {
          x: home.x + (Math.random() - 0.5) * 2.4,
          z: home.z + (Math.random() - 0.5) * 2.4,
        };
      }
      const target = w.workTarget || w.workHome;
      if (!target) continue;
      const dx = target.x - av.position.x;
      const dz = target.z - av.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.18) {
        const step = Math.min(dist, 1.15 * dt);
        const inv = 1 / dist;
        av.position.x += dx * inv * step;
        av.position.z += dz * inv * step;
        const face = Math.atan2(dx, dz);
        let dyaw = face - av.rotation.y;
        while (dyaw > Math.PI) dyaw -= Math.PI * 2;
        while (dyaw < -Math.PI) dyaw += Math.PI * 2;
        av.rotation.y += dyaw * Math.min(1, 8 * dt);
        w.phaseWalk += 6.4 * dt;
        const swing = Math.sin(w.phaseWalk) * 0.32;
        if (leftLeg) leftLeg.rotation.x = swing;
        if (rightLeg) rightLeg.rotation.x = -swing;
        if (leftArm) leftArm.rotation.x = -swing * 0.7;
        if (rightArm) rightArm.rotation.x = swing * 0.7;
        av.position.y = scale + Math.abs(Math.sin(w.phaseWalk)) * 0.016;
      } else {
        if (leftLeg) leftLeg.rotation.x *= Math.max(0, 1 - 8 * dt);
        if (rightLeg) rightLeg.rotation.x *= Math.max(0, 1 - 8 * dt);
        if (leftArm) {
          leftArm.rotation.x *= Math.max(0, 1 - 7 * dt);
          leftArm.rotation.z = Math.sin(t * 1.1 + i) * 0.05;
        }
        if (rightArm) {
          rightArm.rotation.x *= Math.max(0, 1 - 7 * dt);
          rightArm.rotation.z = -Math.sin(t * 1.05 + i) * 0.05;
        }
        av.position.y += (scale - av.position.y) * Math.min(1, 8 * dt);
      }
    }
  }
}

/** Idle fidgets while avatars are in sitting state — arms + head nod / look around. */
export function updateSittingCrew(crew, dt, t, playerPos = null, maxDist = 26) {
  if (!crew) return;
  const maxD2 = maxDist * maxDist;
  for (let i = 0; i < crew.length; i++) {
    const av = crew[i];
    const state = av.userData.state;
    const attn = av.userData.attention;
    const isAttnSit = state === "attention" && attn && attn.pose === "sit";
    if (state !== "sitting" && !isAttnSit) continue;

    const s = av.userData.sit;
    const { head, leftArm, rightArm } = av.userData;
    if (!s || !head || !leftArm || !rightArm) continue;

    av.getWorldPosition(_avWorld);
    let dist2 = Infinity;
    if (playerPos) dist2 = _avWorld.distanceToSquared(playerPos);

    const attnR = s.attnRadius ?? 1.7;
    const attnR2 = attnR * attnR;
    if (playerPos) {
      if (dist2 <= attnR2) {
        s.farHold = 0;
        if (isAttnSit && av.userData.attention?.releasing) {
          av.userData.attention.releasing = false;
          av.userData.attention.releaseT = 0;
        }
        // skip triggering while another NPC is already attending
        if (state === "sitting" && !_attentionNpc) {
          s.nearHold = (s.nearHold || 0) + dt;
          if (s.nearHold >= ATTENTION_ENTER) enterAttention(av, "sit");
        } else if (state === "sitting") {
          s.nearHold = 0;
        }
      } else {
        s.nearHold = 0;
        if (isAttnSit) {
          s.farHold = (s.farHold || 0) + dt;
          if (s.farHold >= ATTENTION_EXIT) beginAttentionRelease(av);
        }
      }
    }

    const nowAttn = av.userData.state === "attention" && av.userData.attention?.pose === "sit";
    if (playerPos && dist2 > maxD2 && !nowAttn) {
      s.nearHold = 0;
      continue;
    }
    if (nowAttn) {
      updateAttention(av, dt, t, playerPos);
      continue;
    }

    s.nextArm -= dt;
    if (s.nextArm <= 0) {
      s.nextArm = 1.2 + Math.random() * 3.5;
      s.armTargetL = (Math.random() - 0.5) * 0.4;
      s.armTargetR = (Math.random() - 0.5) * 0.4;
    }
    s.armL += (s.armTargetL - s.armL) * Math.min(1, 2.8 * dt);
    s.armR += (s.armTargetR - s.armR) * Math.min(1, 2.8 * dt);
    const breathe = Math.sin(t * 1.35 + s.armPhase) * 0.045;
    leftArm.rotation.x = s.armBaseX + s.armL + breathe;
    rightArm.rotation.x = s.armBaseX + s.armR - breathe * 0.65;
    leftArm.rotation.z = Math.sin(t * 0.85 + s.armPhase) * 0.04 + s.armL * 0.25;
    rightArm.rotation.z = -Math.sin(t * 0.9 + s.armPhase * 1.1) * 0.04 - s.armR * 0.25;

    s.nextHead -= dt;
    if (s.nextHead <= 0) {
      s.nextHead = 0.25 + Math.random() * 0.9;
      const roll = Math.random();
      if (roll < 0.28) {
        // nod
        s.headTargetX = 0.22 + Math.random() * 0.22;
        s.headTargetY = (Math.random() - 0.5) * 0.12;
        s.headTargetZ = (Math.random() - 0.5) * 0.1;
        s.nodReturn = 0.25 + Math.random() * 0.3;
      } else if (roll < 0.55) {
        // ear-to-shoulder tilt
        s.headTargetZ = (Math.random() < 0.5 ? -1 : 1) * (0.12 + Math.random() * 0.18);
        s.headTargetX = (Math.random() - 0.5) * 0.14;
        s.headTargetY = (Math.random() - 0.5) * 0.2;
        s.nodReturn = 0.35 + Math.random() * 0.4;
      } else if (roll < 0.88) {
        // look around
        s.headTargetY = (Math.random() - 0.5) * 0.75;
        s.headTargetX = (Math.random() - 0.5) * 0.22;
        s.headTargetZ = (Math.random() - 0.5) * 0.12;
        s.nodReturn = null;
      } else {
        // settle forward
        s.headTargetX = 0;
        s.headTargetY = 0;
        s.headTargetZ = 0;
        s.nodReturn = null;
      }
    }
    if (s.nodReturn != null) {
      s.nodReturn -= dt;
      if (s.nodReturn <= 0) {
        s.headTargetX = 0;
        s.headTargetZ = 0;
        s.nodReturn = null;
      }
    }
    s.headX += (s.headTargetX - s.headX) * Math.min(1, 4.2 * dt);
    s.headY += (s.headTargetY - s.headY) * Math.min(1, 3.4 * dt);
    s.headZ += (s.headTargetZ - s.headZ) * Math.min(1, 3.8 * dt);
    head.rotation.x = s.headX;
    head.rotation.y = s.headY;
    head.rotation.z = s.headZ;
  }
}

/**
 * Standing patrol avatar — idle / walk / run with random wander inside bounds.
 * Modes: av.userData.patrol.mode = "idle" | "walk" | "run"
 * State: av.userData.state = "patrol" | "attention" (attention.pose = "stand"|"sit")
 *
 * Stay within attnRadius (~1.7) for ~0.3s → attention (body/hip then head face you).
 * Leave beyond that radius for ~0.3s, then ~0.4s smooth blend back to previous state.
 * Only one NPC at a time: don't start attention if someone is already attending.
 *
 * @param {THREE.Object3D} room
 * @param {{
 *   bounds: { minX: number, maxX: number, minZ: number, maxZ: number },
 *   avoid?: { x: number, z: number, r: number }[],
 *   start?: { x: number, z: number },
 * }} area
 */
function spawnPatrolAvatar(room, area, scale = 0.44) {
  const av = createCrewAvatar(scale);
  const { bounds, avoid = [] } = area;
  let start = area.start || {
    x: (bounds.minX + bounds.maxX) * 0.5,
    z: (bounds.minZ + bounds.maxZ) * 0.5,
  };
  start = clampPatrolPoint(start.x, start.z, bounds, avoid);
  const standY = scale;
  av.position.set(start.x, standY, start.z);

  const target = pickPatrolTarget(start.x, start.z, bounds, avoid);
  av.rotation.y = Math.atan2(target.x - start.x, target.z - start.z);

  const { head, leftArm, rightArm, leftLeg, rightLeg } = av.userData;
  av.userData.state = "patrol";
  av.userData.patrol = {
    bounds,
    avoid,
    target,
    mode: "idle",
    timer: 0.6 + Math.random() * 1.8,
    phase: Math.random() * Math.PI * 2,
    standY,
    speedWalk: 1.25,
    speedRun: 2.85,
    nextHead: 0.3 + Math.random(),
    headX: 0,
    headY: 0,
    headZ: 0,
    headTargetX: 0,
    headTargetY: 0,
    headTargetZ: 0,
    attnRadius: 1.7,
    nearHold: 0,
    farHold: 0,
    resumeMode: "idle",
  };
  head.rotation.set(0, 0, 0);
  leftArm.rotation.set(0, 0, 0);
  rightArm.rotation.set(0, 0, 0);
  leftLeg.rotation.set(0, 0, 0);
  rightLeg.rotation.set(0, 0, 0);
  room.add(av);
  return av;
}

function pickPatrolMoveMode() {
  return Math.random() < 0.32 ? "run" : "walk";
}

function clampPatrolPoint(x, z, bounds, avoid) {
  let px = THREE.MathUtils.clamp(x, bounds.minX, bounds.maxX);
  let pz = THREE.MathUtils.clamp(z, bounds.minZ, bounds.maxZ);
  for (let n = 0; n < 8; n++) {
    let pushed = false;
    for (const a of avoid) {
      const dx = px - a.x;
      const dz = pz - a.z;
      const d = Math.hypot(dx, dz);
      if (d < a.r && d > 1e-4) {
        const s = (a.r + 0.05) / d;
        px = a.x + dx * s;
        pz = a.z + dz * s;
        pushed = true;
      } else if (d < a.r) {
        px = a.x + a.r;
        pz = a.z;
        pushed = true;
      }
    }
    px = THREE.MathUtils.clamp(px, bounds.minX, bounds.maxX);
    pz = THREE.MathUtils.clamp(pz, bounds.minZ, bounds.maxZ);
    if (!pushed) break;
  }
  return { x: px, z: pz };
}

/** Random destination at a varied angle — not stuck to axis-aligned loops. */
function pickPatrolTarget(fromX, fromZ, bounds, avoid) {
  const minDist = 1.6;
  const maxDist = Math.hypot(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ);
  for (let attempt = 0; attempt < 36; attempt++) {
    const ang = Math.random() * Math.PI * 2;
    const dist = minDist + Math.random() * Math.max(1.2, maxDist * 0.55);
    let x = fromX + Math.sin(ang) * dist;
    let z = fromZ + Math.cos(ang) * dist;
    if (Math.random() < 0.4) {
      x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
      z = bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ);
    }
    x = THREE.MathUtils.clamp(x, bounds.minX, bounds.maxX);
    z = THREE.MathUtils.clamp(z, bounds.minZ, bounds.maxZ);
    // keep targets clear of avoid discs
    let inAvoid = false;
    for (const a of avoid) {
      if (Math.hypot(x - a.x, z - a.z) < a.r + 0.2) {
        inAvoid = true;
        break;
      }
    }
    if (inAvoid) continue;
    const travel = Math.hypot(x - fromX, z - fromZ);
    if (travel < minDist) continue;
    let blocked = false;
    for (const a of avoid) {
      const nearest = pointSegDist(a.x, a.z, fromX, fromZ, x, z);
      if (nearest < a.r * 0.75) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;
    return { x, z };
  }
  // fallback: pick a free point inside bounds (no path check)
  for (let attempt = 0; attempt < 24; attempt++) {
    const x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
    const z = bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ);
    let ok = true;
    for (const a of avoid) {
      if (Math.hypot(x - a.x, z - a.z) < a.r + 0.25) {
        ok = false;
        break;
      }
    }
    if (ok && Math.hypot(x - fromX, z - fromZ) > 0.8) return { x, z };
  }
  return { x: fromX, z: fromZ };
}

function pointSegDist(px, pz, ax, az, bx, bz) {
  const abx = bx - ax;
  const abz = bz - az;
  const len2 = abx * abx + abz * abz || 1;
  let t = ((px - ax) * abx + (pz - az) * abz) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + abx * t), pz - (az + abz * t));
}

function beginPatrolMove(p, av) {
  p.target = pickPatrolTarget(av.position.x, av.position.z, p.bounds, p.avoid);
  p.mode = pickPatrolMoveMode();
  p.headTargetX = 0;
  p.headTargetY = 0;
  p.headTargetZ = 0;
}

const ATTENTION_ENTER = 0.3;
const ATTENTION_EXIT = 0.3;
const ATTENTION_BLEND_OUT = 0.4;

/** At most one NPC in attention — set on enter, cleared on exit. */
let _attentionNpc = null;

/** Unified attention: pose "stand" | "sit". Stays in chair when sit. */
function enterAttention(av, pose) {
  if (_attentionNpc && _attentionNpc !== av) return;
  const a = {
    pose, // "stand" | "sit"
    phase: Math.random() * Math.PI * 2,
    attnNext: 0.35 + Math.random() * 0.9,
    armL: 0,
    armR: 0,
    armTargetL: 0,
    armTargetR: 0,
    torsoX: 0,
    torsoY: 0,
    torsoZ: 0,
    torsoTargetX: 0,
    torsoTargetY: 0,
    torsoTargetZ: 0,
    headX: 0,
    headY: 0,
    headZ: 0,
    headTargetX: 0,
    headTargetY: 0,
    headTargetZ: 0,
    headFidgetX: 0,
    headFidgetY: 0,
    headFidgetZ: 0,
    hipYaw: 0,
    armBaseX: 0,
    baseRotY: av.rotation.y,
    seatX: av.position.x,
    seatZ: av.position.z,
    releasing: false,
    releaseT: 0,
  };

  if (pose === "stand") {
    const p = av.userData.patrol;
    const mode = p.mode;
    p.resumeMode = mode === "walk" || mode === "run" || mode === "idle" ? mode : "idle";
    p.nearHold = 0;
    p.farHold = 0;
    a.phase = p.phase;
    av.position.y = p.standY;
  } else {
    const s = av.userData.sit;
    s.nearHold = 0;
    s.farHold = 0;
    a.armBaseX = s.armBaseX;
    a.baseRotY = s.baseRotY ?? av.rotation.y;
    a.seatX = s.seatX ?? av.position.x;
    a.seatZ = s.seatZ ?? av.position.z;
    a.headX = s.headX;
    a.headY = s.headY;
    a.headZ = s.headZ;
    a.phase = s.armPhase;
  }

  av.userData.attention = a;
  av.userData.state = "attention";
  _attentionNpc = av;
}

/** Start smooth blend back to sit/patrol — same easing feel as entering. */
function beginAttentionRelease(av) {
  const a = av.userData.attention;
  if (!a || a.releasing) return;
  a.releasing = true;
  a.releaseT = 0;
  a.headTargetX = 0;
  a.headTargetY = 0;
  a.headTargetZ = 0;
  a.headFidgetX = 0;
  a.headFidgetY = 0;
  a.headFidgetZ = 0;
  a.torsoTargetX = 0;
  a.torsoTargetY = 0;
  a.torsoTargetZ = 0;
  a.armTargetL = 0;
  a.armTargetR = 0;
}

function finishExitAttention(av) {
  const a = av.userData.attention;
  if (!a) return;
  const body = av.userData.body;
  if (body) body.rotation.set(0, 0, 0);

  if (a.pose === "stand") {
    const p = av.userData.patrol;
    av.userData.state = "patrol";
    p.nearHold = 0;
    p.farHold = 0;
    p.headX = a.headX;
    p.headY = a.headY;
    p.headZ = a.headZ;
    p.headTargetX = 0;
    p.headTargetY = 0;
    p.headTargetZ = 0;
    const resume = p.resumeMode || "idle";
    if (resume === "idle") {
      p.mode = "idle";
      p.timer = 0.8 + Math.random() * 2.2;
    } else {
      beginPatrolMove(p, av);
    }
  } else {
    const s = av.userData.sit;
    av.userData.state = "sitting";
    av.rotation.y = a.baseRotY;
    av.position.x = a.seatX;
    av.position.z = a.seatZ;
    s.nearHold = 0;
    s.farHold = 0;
    s.headX = a.headX;
    s.headY = a.headY;
    s.headZ = a.headZ;
    s.headTargetX = 0;
    s.headTargetY = 0;
    s.headTargetZ = 0;
    s.armL = a.armL;
    s.armR = a.armR;
    s.armTargetL = 0;
    s.armTargetR = 0;
  }

  av.userData.attention = null;
  if (_attentionNpc === av) _attentionNpc = null;
}

/**
 * Shared attention update — pose "stand" turns whole body; pose "sit" shifts
 * hip/torso in the chair so the head can face the player.
 */
function updateAttention(av, dt, t, playerPos) {
  const a = av.userData.attention;
  if (!a) return;
  const { head, body, leftArm, rightArm, leftLeg, rightLeg } = av.userData;
  const sit = a.pose === "sit";
  const ease = Math.min(1, 5.5 * dt);

  // blend out toward rest pose (mirrors the smooth enter turn)
  if (a.releasing) {
    a.releaseT += dt;
    a.hipYaw += (0 - a.hipYaw) * ease;
    a.torsoX += (0 - a.torsoX) * ease;
    a.torsoY += (0 - a.torsoY) * ease;
    a.torsoZ += (0 - a.torsoZ) * ease;
    a.headX += (0 - a.headX) * ease;
    a.headY += (0 - a.headY) * ease;
    a.headZ += (0 - a.headZ) * ease;
    a.armL += (0 - a.armL) * ease;
    a.armR += (0 - a.armR) * ease;

    if (sit) {
      av.rotation.y = a.baseRotY + a.hipYaw;
      const shift = a.hipYaw * 0.08;
      av.position.x = a.seatX + Math.cos(a.baseRotY) * shift;
      av.position.z = a.seatZ - Math.sin(a.baseRotY) * shift;
      leftArm.rotation.x = a.armBaseX + a.armL;
      rightArm.rotation.x = a.armBaseX + a.armR;
    } else {
      leftArm.rotation.x = a.armL;
      rightArm.rotation.x = a.armR;
      leftLeg.rotation.x *= Math.max(0, 1 - 10 * dt);
      rightLeg.rotation.x *= Math.max(0, 1 - 10 * dt);
    }
    leftArm.rotation.z *= Math.max(0, 1 - 6 * dt);
    rightArm.rotation.z *= Math.max(0, 1 - 6 * dt);
    if (body) {
      body.rotation.x = a.torsoX;
      body.rotation.y = a.torsoY;
      body.rotation.z = a.torsoZ;
    }
    head.rotation.set(a.headX, a.headY, a.headZ);

    if (a.releaseT >= ATTENTION_BLEND_OUT) finishExitAttention(av);
    return;
  }

  if (!sit) {
    leftLeg.rotation.x *= Math.max(0, 1 - 10 * dt);
    rightLeg.rotation.x *= Math.max(0, 1 - 10 * dt);
    const standY = av.userData.patrol?.standY ?? av.position.y;
    av.position.y += (standY - av.position.y) * Math.min(1, 12 * dt);
  }

  let bodyAligned = false;
  if (playerPos) {
    const dx = playerPos.x - _avWorld.x;
    const dz = playerPos.z - _avWorld.z;
    const face = Math.atan2(dx, dz);

    if (sit) {
      // stay seated: twist hips a bit + torso yaw toward player
      let want = face - a.baseRotY;
      while (want > Math.PI) want -= Math.PI * 2;
      while (want < -Math.PI) want += Math.PI * 2;
      const maxHip = 0.72;
      const targetHip = THREE.MathUtils.clamp(want, -maxHip, maxHip);
      a.hipYaw += (targetHip - a.hipYaw) * Math.min(1, 5.5 * dt);
      av.rotation.y = a.baseRotY + a.hipYaw;
      // slight ass shift sideways in the seat
      const shift = a.hipYaw * 0.08;
      av.position.x = a.seatX + Math.cos(a.baseRotY) * shift;
      av.position.z = a.seatZ - Math.sin(a.baseRotY) * shift;

      const remain = want - a.hipYaw;
      a.torsoTargetY = THREE.MathUtils.clamp(remain * 0.65, -0.5, 0.5);
      bodyAligned = Math.abs(want) < 0.95 || Math.abs(want - a.hipYaw) < 0.4;
    } else {
      let dyaw = face - av.rotation.y;
      while (dyaw > Math.PI) dyaw -= Math.PI * 2;
      while (dyaw < -Math.PI) dyaw += Math.PI * 2;
      av.rotation.y += dyaw * Math.min(1, 7.5 * dt);
      bodyAligned = Math.abs(dyaw) < 0.55;
    }

    let headYaw = face - av.rotation.y;
    while (headYaw > Math.PI) headYaw -= Math.PI * 2;
    while (headYaw < -Math.PI) headYaw += Math.PI * 2;

    if (bodyAligned) {
      const swayY = Math.sin(t * 0.85 + a.phase) * 0.06;
      const swayX = Math.sin(t * 1.1 + a.phase * 1.4) * 0.04;
      const swayZ = Math.sin(t * 0.7 + a.phase * 0.9) * 0.05;
      // sit: allow a much wider head yaw so they can still face you after limited hip twist
      const headMax = sit ? 1.25 : 0.65;
      a.headTargetY = THREE.MathUtils.clamp(headYaw + swayY + a.headFidgetY, -headMax, headMax);
      a.headTargetX = -0.32 + swayX + a.headFidgetX;
      a.headTargetZ = swayZ + a.headFidgetZ;
    } else {
      a.headTargetY = sit ? THREE.MathUtils.clamp(headYaw * 0.85, -1.15, 1.15) : 0;
      a.headTargetX = sit ? -0.2 : 0;
      a.headTargetZ = 0;
    }
  }

  a.attnNext -= dt;
  if (a.attnNext <= 0) {
    a.attnNext = 0.7 + Math.random() * 1.8;
    const roll = Math.random();
    if (roll < 0.4) {
      a.armTargetL = (Math.random() - 0.5) * 0.55;
      a.armTargetR = (Math.random() - 0.5) * 0.55;
      a.torsoTargetZ = (Math.random() - 0.5) * 0.14;
      a.torsoTargetX = (Math.random() - 0.5) * 0.08;
      a.headFidgetX = (Math.random() - 0.5) * 0.1;
      a.headFidgetY = (Math.random() - 0.5) * 0.18;
      a.headFidgetZ = (Math.random() - 0.5) * 0.1;
    } else if (roll < 0.7) {
      a.armTargetL = -0.15 + Math.random() * 0.35;
      a.armTargetR = -0.15 + Math.random() * 0.35;
      a.torsoTargetZ = (Math.random() < 0.5 ? -1 : 1) * (0.06 + Math.random() * 0.1);
      a.torsoTargetX = 0.02 + Math.random() * 0.06;
      a.headFidgetX = -0.06 + Math.random() * 0.1;
      a.headFidgetY = (Math.random() - 0.5) * 0.1;
      a.headFidgetZ = (Math.random() < 0.5 ? -1 : 1) * (0.06 + Math.random() * 0.1);
    } else {
      a.armTargetL = 0;
      a.armTargetR = 0;
      a.torsoTargetX = 0;
      a.torsoTargetZ = 0;
      if (!sit) a.torsoTargetY = 0;
      a.headFidgetX = 0;
      a.headFidgetY = 0;
      a.headFidgetZ = 0;
    }
  }

  a.armL += (a.armTargetL - a.armL) * Math.min(1, 2.6 * dt);
  a.armR += (a.armTargetR - a.armR) * Math.min(1, 2.6 * dt);
  const breathe = Math.sin(t * 1.2 + a.phase) * 0.05;
  if (sit) {
    leftArm.rotation.x = a.armBaseX + a.armL + breathe;
    rightArm.rotation.x = a.armBaseX + a.armR - breathe * 0.7;
  } else {
    leftArm.rotation.x = a.armL + breathe;
    rightArm.rotation.x = a.armR - breathe * 0.7;
  }
  leftArm.rotation.z = Math.sin(t * 0.9 + a.phase) * 0.05 + a.armL * 0.2;
  rightArm.rotation.z = -Math.sin(t * 0.95 + a.phase) * 0.05 - a.armR * 0.2;

  a.torsoX += (a.torsoTargetX - a.torsoX) * Math.min(1, 2.2 * dt);
  a.torsoY += (a.torsoTargetY - a.torsoY) * Math.min(1, 2.4 * dt);
  a.torsoZ += (a.torsoTargetZ - a.torsoZ) * Math.min(1, 2.2 * dt);
  if (body) {
    body.rotation.x = a.torsoX;
    body.rotation.y = a.torsoY;
    body.rotation.z = a.torsoZ;
  }

  a.headX += (a.headTargetX - a.headX) * Math.min(1, 4 * dt);
  a.headY += (a.headTargetY - a.headY) * Math.min(1, 3.5 * dt);
  a.headZ += (a.headTargetZ - a.headZ) * Math.min(1, 3.5 * dt);
  head.rotation.set(a.headX, a.headY, a.headZ);
}

/** Advance patrol avatars: idle fidgets, walk/run locomotion + limb gait. */
export function updatePatrolCrew(crew, dt, t, playerPos = null, maxDist = 30) {
  if (!crew) return;
  const maxD2 = maxDist * maxDist;
  for (let i = 0; i < crew.length; i++) {
    const av = crew[i];
    const state = av.userData.state;
    const isAttnStand = state === "attention" && av.userData.attention?.pose === "stand";
    if (state !== "patrol" && !isAttnStand) continue;

    const p = av.userData.patrol;
    const { head, leftArm, rightArm, leftLeg, rightLeg } = av.userData;
    if (!p || !head || !leftArm || !rightArm || !leftLeg || !rightLeg) continue;
    if (!p.bounds || !p.target) continue;

    av.getWorldPosition(_avWorld);
    let dist2 = Infinity;
    if (playerPos) dist2 = _avWorld.distanceToSquared(playerPos);

    const attnR = p.attnRadius ?? 1.7;
    const attnR2 = attnR * attnR;

    // near ~0.3s → attention; leave ~0.3s then smooth blend out. skip if someone already attending
    if (playerPos) {
      if (dist2 <= attnR2) {
        p.farHold = 0;
        if (isAttnStand && av.userData.attention?.releasing) {
          av.userData.attention.releasing = false;
          av.userData.attention.releaseT = 0;
        }
        if (state === "patrol" && !_attentionNpc) {
          p.nearHold = (p.nearHold || 0) + dt;
          if (p.nearHold >= ATTENTION_ENTER) enterAttention(av, "stand");
        } else if (state === "patrol") {
          p.nearHold = 0;
        }
      } else {
        p.nearHold = 0;
        if (isAttnStand) {
          p.farHold = (p.farHold || 0) + dt;
          if (p.farHold >= ATTENTION_EXIT) beginAttentionRelease(av);
        }
      }
    }

    const nowAttn = av.userData.state === "attention" && av.userData.attention?.pose === "stand";
    if (playerPos && dist2 > maxD2 && !nowAttn) {
      p.nearHold = 0;
      continue;
    }

    if (nowAttn) {
      updateAttention(av, dt, t, playerPos);
      continue;
    }

    if (p.mode === "idle") {
      leftLeg.rotation.x *= Math.max(0, 1 - 8 * dt);
      rightLeg.rotation.x *= Math.max(0, 1 - 8 * dt);
      leftArm.rotation.x *= Math.max(0, 1 - 7 * dt);
      rightArm.rotation.x *= Math.max(0, 1 - 7 * dt);
      leftArm.rotation.z = Math.sin(t * 1.1 + p.phase) * 0.04;
      rightArm.rotation.z = -Math.sin(t * 1.05 + p.phase) * 0.04;
      av.position.y += (p.standY - av.position.y) * Math.min(1, 10 * dt);

      p.nextHead -= dt;
      if (p.nextHead <= 0) {
        p.nextHead = 0.5 + Math.random() * 1.6;
        const roll = Math.random();
        if (roll < 0.55) {
          p.headTargetY = (Math.random() - 0.5) * 0.9;
          p.headTargetX = (Math.random() - 0.5) * 0.2;
          p.headTargetZ = (Math.random() - 0.5) * 0.12;
        } else if (roll < 0.8) {
          p.headTargetX = 0.15 + Math.random() * 0.18;
          p.headTargetY = (Math.random() - 0.5) * 0.2;
          p.headTargetZ = 0;
        } else {
          p.headTargetX = 0;
          p.headTargetY = 0;
          p.headTargetZ = 0;
        }
      }
      p.headX += (p.headTargetX - p.headX) * Math.min(1, 3.6 * dt);
      p.headY += (p.headTargetY - p.headY) * Math.min(1, 3.2 * dt);
      p.headZ += (p.headTargetZ - p.headZ) * Math.min(1, 3.4 * dt);
      head.rotation.set(p.headX, p.headY, p.headZ);

      p.timer -= dt;
      if (p.timer <= 0) beginPatrolMove(p, av);
      continue;
    }

    const target = p.target;
    const dx = target.x - av.position.x;
    const dz = target.z - av.position.z;
    const arriveDist = Math.hypot(dx, dz);
    const speed = p.mode === "run" ? p.speedRun : p.speedWalk;

    if (arriveDist < 0.2) {
      if (Math.random() < 0.4) {
        p.mode = "idle";
        p.timer = 1.0 + Math.random() * 3.2;
      } else {
        beginPatrolMove(p, av);
      }
      continue;
    }

    const inv = 1 / arriveDist;
    const nx = dx * inv;
    const nz = dz * inv;
    const step = Math.min(arriveDist, speed * dt);
    const prevX = av.position.x;
    const prevZ = av.position.z;
    av.position.x += nx * step;
    av.position.z += nz * step;
    const clamped = clampPatrolPoint(av.position.x, av.position.z, p.bounds, p.avoid);
    av.position.x = clamped.x;
    av.position.z = clamped.z;

    // blocked by furniture/bounds → just pick a new walk direction (cheap, only when needed)
    const moved = Math.hypot(av.position.x - prevX, av.position.z - prevZ);
    if (moved < step * 0.3) {
      beginPatrolMove(p, av);
      continue;
    }

    const face = Math.atan2(nx, nz);
    let dyaw = face - av.rotation.y;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    av.rotation.y += dyaw * Math.min(1, 10 * dt);

    const cadence = p.mode === "run" ? 13.5 : 7.2;
    const amp = p.mode === "run" ? 0.72 : 0.42;
    p.phase += cadence * dt;
    const swing = Math.sin(p.phase) * amp;
    leftLeg.rotation.x = swing;
    rightLeg.rotation.x = -swing;
    leftArm.rotation.x = -swing * 0.9;
    rightArm.rotation.x = swing * 0.9;
    leftArm.rotation.z = 0;
    rightArm.rotation.z = 0;
    const bob = Math.abs(Math.sin(p.phase)) * (p.mode === "run" ? 0.045 : 0.022);
    av.position.y = p.standY + bob;

    p.headX += (0.06 - p.headX) * Math.min(1, 4 * dt);
    p.headY += (0 - p.headY) * Math.min(1, 4 * dt);
    p.headZ += (0 - p.headZ) * Math.min(1, 4 * dt);
    head.rotation.set(p.headX, p.headY, p.headZ);
  }
}

function makeBed(group, x, y, z, rotY = 0, tones = {}, interactables = null, roomOx = 0, roomOz = 0) {
  const frame = tones.frame ?? 0xd0d6de;
  const mattress = tones.mattress ?? 0xb8c8e0;
  const pillow = tones.pillow ?? 0xf4f7fb;
  const glass = tones.glass ?? 0xb8d8ec;
  const glow = tones.glow ?? GLOW_CYAN;
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  group.add(g);
  g.add(box(1.1, 0.35, 2.1, mat(frame, { roughness: 0.85 }), 0, 0.28, 0));
  g.add(box(1.0, 0.12, 1.9, mat(mattress, { roughness: 0.95 }), 0, 0.5, 0));
  g.add(box(0.9, 0.18, 0.35, mat(pillow, { roughness: 0.9 }), 0, 0.58, -0.75));
  // thin glass riser under the reading bar — tinted per bunk
  const barGlass = new THREE.MeshPhysicalMaterial({
    color: glass,
    metalness: 0.02,
    roughness: 0.08,
    transmission: 0.78,
    thickness: 0.12,
    ior: 1.45,
    transparent: true,
    opacity: 1,
    side: THREE.DoubleSide,
  });
  g.add(box(0.88, 0.5, 0.016, barGlass, 0, 0.78, -0.95));
  g.add(box(0.9, 0.04, 0.08, mat(glow, { emissive: glow, emissiveIntensity: 0.7 }), 0, 1.05, -0.95));

  // pale glass sleep capsule — shared cheap glass (no transmission hitch)
  if (!makeBed._podMat) {
    makeBed._podMat = new THREE.MeshStandardMaterial({
      color: 0xd8e2ec,
      metalness: 0.12,
      roughness: 0.16,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  } else {
    makeBed._podMat.color.setHex(0xd8e2ec);
    makeBed._podMat.opacity = 0.72;
  }
  const shieldMat = makeBed._podMat;
  const pod = new THREE.Group();
  // CapsuleGeometry is Y-up; rotate onto Z so it runs along the bunk
  const radius = 0.8;
  const midLen = 2.55; // longer capsule to cover the full bunk
  if (!makeBed._podGeo) {
    makeBed._podGeo = new THREE.CapsuleGeometry(radius, midLen, 8, 20);
  }
  const capsule = new THREE.Mesh(makeBed._podGeo, shieldMat);
  capsule.rotation.x = Math.PI / 2;
  // lower so the shell fully wraps the bed frame/mattress
  capsule.position.y = radius * 0.68;
  capsule.scale.set(1.1, 1, 0.95);
  pod.add(capsule);
  const openY = -(radius * 2.2);
  const closedY = -0.04;
  // default on (capsule closed)
  pod.position.y = closedY;
  pod.visible = true;
  g.add(pod);

  g.userData.bedRoot = true;
  g.userData.pod = pod;
  g.userData.openY = openY;
  g.userData.closedY = closedY;
  g.userData.podClosed = true;
  g.traverse((o) => {
    if (o.isMesh) o.userData.bedClick = true;
  });
  return g;
}

export function toggleBedPod(bed) {
  if (!bed?.userData?.pod) return false;
  const closed = !!bed.userData.podClosed;
  const pod = bed.userData.pod;
  if (closed) {
    bed.userData.podClosed = false;
    pod.visible = false;
    pod.position.y = bed.userData.openY;
  } else {
    // Don't slam shut on an awake crewmate still standing on the bunk
    const sleeper = bed.userData.sleeper;
    if (sleeper && sleeper.userData.state !== "sleeping" && sleeper.parent === bed) {
      return false;
    }
    bed.userData.podClosed = true;
    pod.visible = true;
    pod.position.y = bed.userData.closedY;
  }
  return true;
}

export function bedFromHit(obj) {
  let o = obj;
  while (o) {
    if (o.userData?.bedRoot) return o;
    o = o.parent;
  }
  return null;
}

/** Low coffee table — one surface slab + two side support slabs (same material, flush to edges). */
function makeCoffeeTable(group, x, y, z, w = 0.9, d = 0.55) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  group.add(g);
  const panel = mat(0xc2ccd8, { metalness: 0.52, roughness: 0.28 });
  const topH = 0.045;
  const topY = 0.26;
  const legH = topY - topH * 0.5;
  const legT = 0.06;
  g.add(box(w, topH, d, panel, 0, topY, 0));
  // supports sit under the left/right edges, same depth as the surface
  g.add(box(legT, legH, d, panel, -w * 0.5 + legT * 0.5, legH * 0.5, 0));
  g.add(box(legT, legH, d, panel, w * 0.5 - legT * 0.5, legH * 0.5, 0));
  return g;
}

function makeTable(group, x, y, z, w = 1.4, d = 0.8) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  group.add(g);
  const top = mat(0xc8ced6, { metalness: 0.58, roughness: 0.3 });
  const leg = mat(METAL, { metalness: 0.7, roughness: 0.28 });
  g.add(box(w, 0.06, d, top, 0, 0.78, 0));
  g.add(cyl(0.07, 0.1, 0.76, leg, 0, 0.38, 0, 8));
  return g;
}

/** Wall-mounted sink — marble basin + taps. Width along local Z; taps on +X. */
function makeWashSink(group, x, y, z, rotY = 0, {
  width = 3.35,
  taps = 4,
  depthX = 0.7,
} = {}) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  group.add(g);

  const marbleTex = canvasTex("sinkMarble_v2", patternSinkMarble, 256);
  const ceramic = patternedMat(0xe2ddd6, marbleTex, 1.4, 1.8, {
    metalness: 0.08,
    roughness: 0.32,
  });
  const tapMarble = patternedMat(0xe8e4dc, marbleTex, 0.4, 0.55, {
    metalness: 0.78,
    roughness: 0.16,
  });
  const drain = mat(0x8a9096, { metalness: 0.55, roughness: 0.32 });

  const wall = 0.045;
  const depth = 0.2;
  const rimY = 1.05;
  const floorY = rimY - depth;
  const innerW = width - wall * 2;
  const innerD = depthX - wall * 2;

  g.add(box(innerD, 0.035, innerW, ceramic, 0, floorY + 0.017, 0));

  const span = innerW * 0.78;
  const stations = [];
  for (let i = 0; i < taps; i++) {
    const t = taps <= 1 ? 0.5 : i / (taps - 1);
    stations.push(-span * 0.5 + t * span);
  }
  for (const dz of stations) {
    g.add(cyl(0.05, 0.05, 0.02, drain, 0, floorY + 0.04, dz, 24));
    g.add(cyl(0.025, 0.025, 0.022, mat(0x6a7076, { metalness: 0.45, roughness: 0.4 }), 0, floorY + 0.042, dz, 20));
  }

  const wy = floorY + depth * 0.5;
  g.add(box(depthX, depth, wall, ceramic, 0, wy, -width * 0.5 + wall * 0.5));
  g.add(box(depthX, depth, wall, ceramic, 0, wy, width * 0.5 - wall * 0.5));
  g.add(box(wall, depth, innerW, ceramic, -depthX * 0.5 + wall * 0.5, wy, 0));
  g.add(box(wall, depth, innerW, ceramic, depthX * 0.5 - wall * 0.5, wy, 0));
  const rimH = 0.03;
  const rimT = 0.055;
  g.add(box(depthX + 0.04, rimH, rimT, ceramic, 0, rimY + rimH * 0.5, -width * 0.5));
  g.add(box(depthX + 0.04, rimH, rimT, ceramic, 0, rimY + rimH * 0.5, width * 0.5));
  g.add(box(rimT, rimH, width + 0.04, ceramic, -depthX * 0.5, rimY + rimH * 0.5, 0));
  g.add(box(rimT, rimH, width + 0.04, ceramic, depthX * 0.5, rimY + rimH * 0.5, 0));

  const bracket = mat(0xd8d4ce, { metalness: 0.28, roughness: 0.42 });
  const bracketSpan = width * 0.7;
  const bracketN = Math.max(2, taps);
  for (let i = 0; i < bracketN; i++) {
    const t = bracketN <= 1 ? 0.5 : i / (bracketN - 1);
    const dz = -bracketSpan * 0.5 + t * bracketSpan;
    g.add(box(0.12, 0.04, 0.08, bracket, depthX * 0.35, floorY - 0.04, dz));
  }

  const tx = depthX * 0.5 - wall * 0.5;
  const tapBaseY = rimY + 0.03;
  for (const tz of stations) {
    // longer supporting flat tip below the column
    g.add(box(0.44, 0.022, 0.13, tapMarble, tx - 0.16, tapBaseY + 0.012, tz));
    // short column on that lower platform
    g.add(cyl(0.048, 0.048, 0.035, tapMarble, tx, tapBaseY + 0.04, tz, 16));
    g.add(box(0.055, 0.055, 0.055, tapMarble, tx, tapBaseY + 0.075, tz));
    // shorter top flat tip extending into the basin
    g.add(box(0.32, 0.022, 0.11, tapMarble, tx - 0.13, tapBaseY + 0.108, tz));
  }
  return g;
}

function makeFridge(group, x, y, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  group.add(g);

  const body = 0xd8dee6;
  const doorCol = 0xc5ced8;
  const dark = 0x6a7582;
  const handle = mat(0xb8c0c8, { metalness: 0.7, roughness: 0.28 });

  // body — doors on local +Z (front). Use yaw -PI/2 on east wall so +Z faces into the room.
  g.add(box(1.15, 2.55, 0.95, mat(body, { metalness: 0.35, roughness: 0.4 }), 0, 1.3, 0));
  g.add(box(1.1, 0.85, 0.06, mat(doorCol, { metalness: 0.3, roughness: 0.45 }), 0, 2.0, 0.5));
  g.add(box(1.1, 1.5, 0.06, mat(doorCol, { metalness: 0.3, roughness: 0.45 }), 0, 0.78, 0.5));
  g.add(box(1.05, 0.04, 0.03, mat(dark, { metalness: 0.4 }), 0, 1.52, 0.54));
  // vertical bar handles on the door front (not the top)
  g.add(box(0.09, 0.48, 0.09, handle, 0.4, 1.92, 0.62));
  g.add(box(0.09, 0.88, 0.09, handle, 0.4, 0.82, 0.62));
  g.add(box(0.95, 0.05, 0.12, mat(dark, { metalness: 0.45 }), 0, 2.6, 0.15));
  g.add(box(0.08, 0.05, 0.03, mat(GLOW_GREEN, {
    emissive: GLOW_GREEN, emissiveIntensity: 0.9, roughness: 0.4,
  }), -0.4, 2.3, 0.54));
  g.add(box(1.16, 0.12, 0.97, mat(0xb0b8c4, { metalness: 0.5, roughness: 0.4 }), 0, 0.06, 0));
  return g;
}

/** Base cupboard + countertop run (front faces local +Z) */
function makeKitchenCupboards(group, x, y, z, rotY = 0, length = 3.2) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  group.add(g);
  const cab = mat(0xd2d8e0, { metalness: 0.25, roughness: 0.4 });
  const top = mat(0xe8ecef, { metalness: 0.45, roughness: 0.22 });
  const handle = mat(METAL, { metalness: 0.7, roughness: 0.25 });
  const depth = 0.7;
  g.add(box(length, 0.88, depth, cab, 0, 0.44, 0));
  g.add(box(length + 0.06, 0.06, depth + 0.08, top, 0, 0.91, 0.02));
  // door seams + handles
  const doors = Math.max(2, Math.round(length / 0.8));
  const dw = length / doors;
  for (let i = 0; i < doors; i++) {
    const dx = -length * 0.5 + dw * (i + 0.5);
    g.add(box(dw - 0.04, 0.7, 0.02, mat(0xc8ced6, { metalness: 0.2, roughness: 0.45 }), dx, 0.42, depth * 0.5 + 0.01));
    g.add(box(0.06, 0.02, 0.04, handle, dx + dw * 0.28, 0.42, depth * 0.5 + 0.04));
  }
  // wall cupboards above
  g.add(box(length * 0.92, 0.7, 0.4, cab, 0, 2.15, -0.1));
  for (let i = 0; i < doors; i++) {
    const dx = -length * 0.46 + (length * 0.92 / doors) * (i + 0.5);
    g.add(box(0.06, 0.02, 0.04, handle, dx, 1.95, 0.12));
  }
  return g;
}

/** Freestanding 3×2 stove — burners grey off; E toggles orange on */
function makeStove(group, x, y, z, rotY = 0, interactables = null, roomOx = 0, roomOz = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  group.add(g);
  const body = mat(0xb0b6be, { metalness: 0.55, roughness: 0.28 });
  const black = mat(0x2a2c2e, { metalness: 0.4, roughness: 0.45 });
  const chrome = mat(0xd8dde4, { metalness: 0.85, roughness: 0.18 });
  const burnerMat = mat(0x6a7078, {
    metalness: 0.45, roughness: 0.42, emissive: 0x000000, emissiveIntensity: 0,
  });

  g.add(box(1.35, 0.92, 0.72, body, 0, 0.46, -0.06));
  g.add(box(1.3, 0.04, 0.68, black, 0, 0.94, -0.06));
  const burners = [
    [-0.42, -0.2], [0, -0.2], [0.42, -0.2],
    [-0.42, 0.12], [0, 0.12], [0.42, 0.12],
  ];
  for (const [bx, bz] of burners) {
    g.add(cyl(0.11, 0.11, 0.02, burnerMat, bx, 0.97, bz, 16));
    g.add(cyl(0.07, 0.07, 0.015, chrome, bx, 0.98, bz, 12));
  }
  g.add(box(1.0, 0.45, 0.03, mat(0x1a2030, { metalness: 0.3, roughness: 0.2 }), 0, 0.4, 0.32));
  g.add(box(0.75, 0.04, 0.05, chrome, 0, 0.18, 0.36));
  for (const kx of [-0.5, -0.3, -0.1, 0.1, 0.3, 0.5]) {
    g.add(cyl(0.032, 0.032, 0.04, chrome, kx, 0.78, 0.32, 10));
  }
  g.add(box(1.4, 0.12, 0.5, body, 0, 2.35, -0.18));
  g.add(box(0.35, 0.55, 0.32, body, 0, 2.7, -0.2));

  if (interactables) {
    interactables.push({
      kind: "stove",
      on: false,
      burnerMat,
      position: new THREE.Vector3(roomOx + x, 1.0, roomOz + z),
      radius: 2.4,
      prompt() {
        return this.on ? "Press E · Turn stove off" : "Press E · Turn stove on";
      },
      toggle() {
        this.on = !this.on;
        if (this.on) {
          this.burnerMat.color.setHex(0xff6622);
          this.burnerMat.emissive.setHex(0xff4411);
          this.burnerMat.emissiveIntensity = 0.65;
        } else {
          this.burnerMat.color.setHex(0x6a7078);
          this.burnerMat.emissive.setHex(0x000000);
          this.burnerMat.emissiveIntensity = 0;
        }
      },
    });
  }
  return g;
}

/** Oven only (microwave sits on the counter separately) */
function makeCooker(group, x, y, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  group.add(g);
  const body = mat(0xc0c6ce, { metalness: 0.5, roughness: 0.3 });
  const glass = mat(0x1a2030, { metalness: 0.25, roughness: 0.2, emissive: 0x331808, emissiveIntensity: 0.25 });
  const chrome = mat(0xd8dde4, { metalness: 0.85, roughness: 0.18 });
  g.add(box(1.1, 0.85, 0.62, body, 0, 0.42, -0.04));
  g.add(box(0.85, 0.5, 0.03, glass, 0, 0.45, 0.29));
  g.add(box(0.55, 0.035, 0.04, chrome, 0, 0.16, 0.33));
  g.add(cyl(0.03, 0.03, 0.04, chrome, 0.35, 0.78, 0.32, 10));
  return g;
}

/** Small 4:3 microwave — sits on a countertop */
function makeMicrowave(group, x, y, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  group.add(g);
  const body = mat(0xf2f4f6, { metalness: 0.35, roughness: 0.28 });
  const dark = mat(0x1a2030, { metalness: 0.2, roughness: 0.25 });
  const chrome = mat(0xd8dde4, { metalness: 0.8, roughness: 0.2 });
  // width 0.48, height 0.36 → ~4:3 face
  g.add(box(0.48, 0.36, 0.38, body, 0, 0.18, 0));
  g.add(box(0.3, 0.24, 0.02, dark, -0.04, 0.18, 0.2));
  g.add(box(0.1, 0.24, 0.025, mat(0x3a4048, { metalness: 0.4, roughness: 0.35 }), 0.16, 0.18, 0.2));
  g.add(cyl(0.02, 0.02, 0.025, chrome, 0.16, 0.18, 0.22, 8));
  return g;
}

/** Front-load washing machine */
function makeWashingMachine(group, x, y, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  group.add(g);
  const body = mat(0xd8dee6, { metalness: 0.45, roughness: 0.32 });
  const dark = mat(0x2a3038, { metalness: 0.35, roughness: 0.4 });
  const chrome = mat(0xd0d6de, { metalness: 0.8, roughness: 0.2 });
  g.add(box(0.72, 1.05, 0.7, body, 0, 0.52, 0));
  const ring = cyl(0.28, 0.28, 0.05, chrome, 0, 0.55, 0.36, 24);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  const glass = cyl(0.22, 0.22, 0.04, dark, 0, 0.55, 0.38, 24);
  glass.rotation.x = Math.PI / 2;
  g.add(glass);
  g.add(box(0.65, 0.12, 0.05, mat(0xb8c0c8, { metalness: 0.4, roughness: 0.35 }), 0, 1.0, 0.35));
  g.add(cyl(0.035, 0.035, 0.03, chrome, 0.2, 1.0, 0.38, 10));
  g.add(box(0.2, 0.04, 0.02, dark, -0.15, 1.0, 0.38));
  return g;
}

/** Front-load dryer — warmer body, tinted door glass */
function makeDryer(group, x, y, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  group.add(g);
  const body = mat(0xe4d8cc, { metalness: 0.4, roughness: 0.35 });
  const tint = mat(0x3a2818, { metalness: 0.3, roughness: 0.35, emissive: 0x221408, emissiveIntensity: 0.15 });
  const chrome = mat(0xd0d6de, { metalness: 0.8, roughness: 0.2 });
  g.add(box(0.72, 1.05, 0.7, body, 0, 0.52, 0));
  const ring = cyl(0.28, 0.28, 0.05, chrome, 0, 0.55, 0.36, 24);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  const glass = cyl(0.22, 0.22, 0.04, tint, 0, 0.55, 0.38, 24);
  glass.rotation.x = Math.PI / 2;
  g.add(glass);
  g.add(box(0.65, 0.12, 0.05, mat(0xc8b8a8, { metalness: 0.35, roughness: 0.4 }), 0, 1.0, 0.35));
  g.add(cyl(0.035, 0.035, 0.03, chrome, -0.2, 1.0, 0.38, 10));
  g.add(box(0.22, 0.04, 0.02, mat(0x4a4038, { metalness: 0.3, roughness: 0.45 }), 0.12, 1.0, 0.38));
  return g;
}

function resetPlantPose(plant) {
  plant.animating = false;
  plant.endT = null;
  plant.group.rotation.y = 0;
  for (let i = 0; i < plant.leaves.length; i++) {
    const leaf = plant.leaves[i];
    const ud = leaf.userData;
    leaf.rotation.x = ud.baseRot.x;
    leaf.rotation.y = ud.baseRot.y;
    leaf.rotation.z = ud.baseRot.z;
    leaf.material.color.copy(ud.baseColor);
  }
}

function makePlant(
  group, x, y, z, scale = 1, leafColor = 0x2d8a45,
  anim = null, interactables = null, roomOx = 0, roomOz = 0,
) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(scale);
  group.add(g);
  g.add(cyl(0.22, 0.18, 0.28, mat(0x5a4030), 0, 0.14, 0, 10));
  g.add(cyl(0.16, 0.14, 0.1, mat(0x3a2818), 0, 0.3, 0, 10));
  const baseCol = new THREE.Color(leafColor);
  const lightCol = baseCol.clone().offsetHSL(0, -0.08, 0.28);
  const leaves = [];
  for (let i = 0; i < 5; i++) {
    const leafMat = mat(leafColor, {
      roughness: 0.85,
      metalness: 0.05,
    });
    const baseY = (i / 5) * Math.PI * 2;
    const leaf = box(0.35, 0.08, 0.55, leafMat, 0, 0.55 + i * 0.12, 0);
    leaf.rotation.y = baseY;
    leaf.rotation.x = -0.4;
    leaf.position.x = Math.sin(i) * 0.1;
    leaf.userData.baseRot = { x: -0.4, y: baseY, z: 0 };
    leaf.userData.phase = i * 1.1 + x * 0.3 + z * 0.17;
    leaf.userData.speed = 1.35 + (i % 3) * 0.35;
    leaf.userData.baseColor = baseCol;
    leaf.userData.lightColor = lightCol;
    leaf.userData.colorPhase = i * 0.9 + x * 0.5 + z * 0.3;
    leaf.userData.colorSpeed = 0.55 + (i % 5) * 0.28 + Math.abs(x + z) * 0.03;
    g.add(leaf);
    leaves.push(leaf);
  }
  g.add(cyl(0.04, 0.04, 0.7, mat(0x226633), 0, 0.65, 0, 6));

  const plant = {
    group: g,
    leaves,
    phase: x * 0.4 + z * 0.25,
    animating: false,
    endT: null,
  };
  if (anim) {
    if (!anim.plants) anim.plants = [];
    anim.plants.push(plant);
    if (anim.activePlant == null) anim.activePlant = null;
  }
  if (interactables) {
    interactables.push({
      kind: "plant",
      position: new THREE.Vector3(roomOx + x, y + 0.55, roomOz + z),
      radius: 1.85,
      prompt() {
        return "Press E · Shake plant";
      },
      toggle() {
        if (!anim) return;
        // only one plant animates at a time
        for (let i = 0; i < (anim.plants || []).length; i++) {
          const p = anim.plants[i];
          if (p !== plant) resetPlantPose(p);
        }
        plant.animating = true;
        plant.endT = null; // start window set on first update tick
        anim.activePlant = plant;
      },
    });
  }
  return g;
}

/** Animate only the E-triggered plant; idle plants cost nothing. */
export function updatePlants(anim, t) {
  const active = anim?.activePlant;
  if (!active?.animating) return;
  if (active.endT == null) active.endT = t + 3.2;
  if (t >= active.endT) {
    resetPlantPose(active);
    anim.activePlant = null;
    return;
  }
  const tmp = updatePlants._tmp || (updatePlants._tmp = new THREE.Color());
  active.group.rotation.y = Math.sin(t * 0.55 + active.phase) * 0.045;
  for (let i = 0; i < active.leaves.length; i++) {
    const leaf = active.leaves[i];
    const ud = leaf.userData;
    const wobble = Math.sin(t * ud.speed + ud.phase) * 0.1;
    const shake = Math.sin(t * ud.speed * 1.85 + ud.phase * 1.4) * 0.07;
    leaf.rotation.x = ud.baseRot.x + wobble;
    leaf.rotation.y = ud.baseRot.y + shake;
    leaf.rotation.z = shake * 0.75;
    const u = (Math.sin(t * ud.colorSpeed + ud.colorPhase) + 1) * 0.5;
    tmp.copy(ud.baseColor).lerp(ud.lightColor, u);
    leaf.material.color.copy(tmp);
  }
}

/** Purple neon rectangle border around the garden soil bed. */
function makeNeonSoilBorder(room, w, d, y = 0.145) {
  const neon = mat(0xb24dff, {
    metalness: 0.15,
    roughness: 0.3,
    emissive: 0xaa44ff,
    emissiveIntensity: 1.35,
  });
  const t = 0.1;
  const h = 0.045;
  const hw = w * 0.5;
  const hd = d * 0.5;
  room.add(box(w + t * 2, h, t, neon, 0, y, hd + t * 0.5));
  room.add(box(w + t * 2, h, t, neon, 0, y, -hd - t * 0.5));
  room.add(box(t, h, d, neon, hw + t * 0.5, y, 0));
  room.add(box(t, h, d, neon, -hw - t * 0.5, y, 0));
  for (const [lx, lz] of [[hw, hd], [-hw, hd], [hw, -hd], [-hw, -hd]]) {
    const pl = new THREE.PointLight(0xaa55ff, 0.55, 5.5, 1.5);
    pl.position.set(lx, 0.35, lz);
    room.add(pl);
  }
}

function makeToilet(group, x, y, z, rotY = 0, opts = {}) {
  const {
    special = false,
    interactables = null,
    roomOx = 0,
    roomOz = 0,
    bankCx = 0,
    bankCz = 0,
    bankRotY = 0,
  } = opts;
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  group.add(g);
  const porcelain = mat(0xd8e0ea, { roughness: 0.35, metalness: 0.2 });
  // bowl + tank (tank stays behind the lid hinge)
  g.add(box(0.72, 0.52, 0.78, porcelain, 0, 0.38, 0.05));
  g.add(box(0.72, 0.72, 0.26, porcelain, 0, 0.85, -0.32));
  // seat ring (fixed)
  g.add(box(0.58, 0.045, 0.58, mat(0x88aacc, { metalness: 0.55, roughness: 0.28 }), 0, 0.655, 0.1));

  // hinged lid — pivot at back of seat, in front of tank so open lid clears porcelain
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.70, -0.14);
  g.add(lidPivot);
  const lidLen = 0.54;
  const lidZ = lidLen * 0.5; // lid extends forward (+Z) from hinge
  const lidTop = box(0.54, 0.04, lidLen, porcelain, 0, 0.02, lidZ);
  lidPivot.add(lidTop);

  if (special) {
    // monitor on underside of lid (−Y). When lid opens ~90°, that face looks at the user.
    const bezel = box(0.44, 0.018, 0.36, mat(0x1e242c, { metalness: 0.4, roughness: 0.45 }), 0, -0.018, lidZ);
    lidPivot.add(bezel);
    const screenTex = canvasTex("toiletLidMonitor_v2", (ctx, s) => {
      ctx.fillStyle = "#061018";
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = "#0a2030";
      ctx.fillRect(s * 0.06, s * 0.08, s * 0.88, s * 0.84);
      ctx.strokeStyle = "rgba(80, 200, 255, 0.45)";
      ctx.lineWidth = 2;
      ctx.strokeRect(s * 0.08, s * 0.1, s * 0.84, s * 0.8);
      ctx.fillStyle = "#66e0ff";
      ctx.font = `bold ${Math.floor(s * 0.09)}px Sora, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("AD ASTRA", s * 0.5, s * 0.28);
      ctx.fillStyle = "#9ad4ff";
      ctx.font = `${Math.floor(s * 0.055)}px "IBM Plex Sans", sans-serif`;
      ctx.fillText("BIO WASTE · OK", s * 0.5, s * 0.42);
      ctx.fillText("PRESSURE 1.02", s * 0.5, s * 0.52);
      ctx.fillText("H2O CYCLE · NOM", s * 0.5, s * 0.62);
      for (let i = 0; i < 5; i++) {
        const yy = s * (0.7 + i * 0.045);
        ctx.fillStyle = i % 2 ? "rgba(60,180,255,0.35)" : "rgba(40,120,180,0.25)";
        ctx.fillRect(s * 0.14, yy, s * (0.3 + (i * 17) % 40 / 100), s * 0.028);
      }
    }, 256);
    screenTex.wrapS = screenTex.wrapT = THREE.ClampToEdgeWrapping;
    const screenMat = new THREE.MeshStandardMaterial({
      map: screenTex,
      emissive: 0x336688,
      emissiveMap: screenTex,
      emissiveIntensity: 1.05,
      roughness: 0.3,
      metalness: 0.08,
    });
    // proud of the lid underside so it reads as a panel, not sunk into the bowl
    const screen = box(0.38, 0.014, 0.30, screenMat, 0, -0.032, lidZ);
    lidPivot.add(screen);

    if (interactables) {
      const cos = Math.cos(bankRotY);
      const sin = Math.sin(bankRotY);
      const wx = roomOx + bankCx + cos * x - sin * z;
      const wz = roomOz + bankCz + sin * x + cos * z;
      interactables.push({
        kind: "toiletLid",
        label: "Toilet lid",
        open: false,
        amount: 0,
        target: 0,
        lidPivot,
        closedRotX: 0,
        // ~95° — upright facing you; past this the lid/monitor clip into the tank
        openRotX: -Math.PI * 0.52,
        position: new THREE.Vector3(wx, 0.75, wz),
        radius: 0.95,
        prompt() {
          return this.open
            ? "Press E · Close lid"
            : "Press E · Open lid";
        },
        toggle() {
          this.open = !this.open;
          this.target = this.open ? 1 : 0;
        },
      });
    }
  }

  return g;
}

/** Toilet-paper holder + roll on inner face of a stall divider (won't poke through). */
function makeLooRoll(group, wallX, y, z) {
  const holder = mat(METAL, { metalness: 0.7, roughness: 0.28 });
  const paper = mat(0xf4f0e8, { roughness: 0.92, metalness: 0.02 });
  const rollR = 0.13;
  const rollLen = 0.18;
  // mount flush on wall inner face; roll hangs into the stall (-X)
  group.add(box(0.04, 0.05, 0.2, holder, wallX - 0.02, y, z));
  const cx = wallX - 0.04 - rollR;
  const spindle = cyl(0.02, 0.02, rollLen + 0.02, holder, cx, y, z, 8);
  spindle.rotation.z = Math.PI / 2;
  group.add(spindle);
  const roll = cyl(rollR, rollR, rollLen, paper, cx, y, z, 16);
  roll.rotation.z = Math.PI / 2;
  group.add(roll);
  const tube = cyl(0.04, 0.04, rollLen + 0.01, mat(0xd8c8a8, { roughness: 0.85 }), cx, y, z, 8);
  tube.rotation.z = Math.PI / 2;
  group.add(tube);
  return roll;
}

function makeShowerFixtures(group, x, y, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  group.add(g);
  const chrome = mat(0xf2f4f6, { metalness: 0.92, roughness: 0.1 });
  const metal = mat(METAL, { metalness: 0.78, roughness: 0.22 });

  // floor drain
  g.add(cyl(0.18, 0.18, 0.03, mat(0x6a7480, { metalness: 0.7, roughness: 0.3 }), 0, 0.02, 0.08, 16));

  // hug stall back wall (~−depth/2); keep every piece touching the next
  const wallZ = -0.94;
  const dialY = 1.1;
  const dialR = 0.078;
  const dialThick = 0.03;
  const stubLen = 0.055;
  const poleR = 0.032;

  // wall stub → dial (along Z)
  const stub = cyl(0.026, 0.026, stubLen, chrome, 0, dialY, wallZ + stubLen * 0.5, 12);
  stub.rotation.x = Math.PI / 2;
  g.add(stub);
  const dialZ = wallZ + stubLen + dialThick * 0.5;
  const dial = cyl(dialR, dialR, dialThick, chrome, 0, dialY, dialZ, 28);
  dial.rotation.x = Math.PI / 2;
  g.add(dial);

  // pull handle — top overlaps dial rim so meshes touch
  const handleH = 0.2;
  g.add(box(0.09, handleH, 0.014, chrome, 0, dialY - dialR - handleH * 0.5 + 0.012, dialZ + 0.006));

  // vertical pole on wall — bottom overlaps dial top
  const poleZ = wallZ + poleR + 0.008;
  const poleBot = dialY + dialR - 0.012;
  const poleTop = 3.4;
  const poleH = poleTop - poleBot;
  g.add(cyl(poleR, poleR, poleH, metal, 0, (poleBot + poleTop) * 0.5, poleZ, 10));

  // short neck from pole into stall, then head — all touching
  const neckLen = 0.07;
  const neck = cyl(0.028, 0.028, neckLen, metal, 0, poleTop, poleZ + neckLen * 0.5, 10);
  neck.rotation.x = Math.PI / 2;
  g.add(neck);
  const headLen = 0.09;
  const head = cyl(0.12, 0.08, headLen, metal, 0, poleTop, poleZ + neckLen + headLen * 0.5 - 0.01, 14);
  head.rotation.x = Math.PI / 2;
  g.add(head);

  return g;
}

/**
 * Rising stall gate — default open (recessed in floor). Grey circle button inside
 * the slot raises the door from the ground to close.
 */
function makeRisingStallGate(g, colliders, interactables, roomOx, roomOz, bankCx, bankCz, bankRotY, {
  slotX, doorZ, doorW, doorH, stallW, label,
}) {
  const doorMat = mat(0xc5ced8, {
    metalness: 0.35,
    roughness: 0.42,
  });
  const grooveMat = mat(0x5a626c, { metalness: 0.55, roughness: 0.35 });
  const btnMat = mat(0xf4f6f8, { metalness: 0.25, roughness: 0.28 });

  // floor groove where the panel rises from
  g.add(box(doorW + 0.08, 0.05, 0.14, grooveMat, slotX, 0.025, doorZ));
  g.add(box(doorW + 0.02, 0.02, 0.08, mat(0x3a4048, { metalness: 0.6, roughness: 0.3 }), slotX, 0.04, doorZ));

  // rising panel — solid for privacy; starts fully below floor (open)
  const thick = 0.07;
  const panel = box(doorW, doorH, thick, doorMat, slotX, -doorH * 0.5 - 0.08, doorZ);
  g.add(panel);
  // opaque accent band + top lip (children rise with panel)
  panel.add(box(doorW * 0.72, doorH * 0.28, 0.02, mat(0xb8c4d0, {
    metalness: 0.25, roughness: 0.4,
  }), 0, doorH * 0.12, thick * 0.5 + 0.01));
  panel.add(box(doorW + 0.04, 0.06, thick + 0.03, mat(0xa8b0ba, { metalness: 0.5, roughness: 0.3 }), 0, doorH * 0.5 - 0.03, 0));

  // grey circle in a light-grey recessed well — sinks halfway in when door is closed
  const btnX = slotX + stallW * 0.5 - 0.05;
  const btnY = 1.2;
  const btnZ = doorZ - 0.45;
  const btnRoot = new THREE.Group();
  btnRoot.position.set(btnX, btnY, btnZ);
  g.add(btnRoot);
  const wellMat = mat(0x8a9098, { metalness: 0.35, roughness: 0.45 });
  const ringMat = mat(0xc8ccd2, { metalness: 0.4, roughness: 0.38 });
  // recessed cup / well
  const well = new THREE.Mesh(
    new THREE.CylinderGeometry(0.125, 0.125, 0.09, 28),
    wellMat,
  );
  well.rotation.z = Math.PI / 2;
  well.position.x = 0.025;
  btnRoot.add(well);
  // light grey face ring
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.15, 0.022, 28),
    ringMat,
  );
  rim.rotation.z = Math.PI / 2;
  rim.position.x = -0.02;
  btnRoot.add(rim);
  const btn = new THREE.Mesh(
    new THREE.CylinderGeometry(0.095, 0.095, 0.05, 28),
    btnMat,
  );
  btn.rotation.z = Math.PI / 2;
  // proud when open; slightly inset (not too deep) when closed
  const btnOutX = -0.045;
  const btnInX = -0.022;
  btn.position.x = btnOutX;
  btnRoot.add(btn);

  const cos = Math.cos(bankRotY);
  const sin = Math.sin(bankRotY);
  function localToWorld(lx, lz) {
    return {
      x: roomOx + bankCx + cos * lx - sin * lz,
      z: roomOz + bankCz + sin * lx + cos * lz,
    };
  }
  const doorWpos = localToWorld(slotX, doorZ);
  const btnWpos = localToWorld(btnX, btnZ);
  const along = doorW * 0.5 + 0.04;
  const thru = 0.14;
  const cmin = new THREE.Vector3(
    doorWpos.x - Math.abs(cos) * along - Math.abs(sin) * thru,
    0,
    doorWpos.z - Math.abs(sin) * along - Math.abs(cos) * thru,
  );
  const cmax = new THREE.Vector3(
    doorWpos.x + Math.abs(cos) * along + Math.abs(sin) * thru,
    doorH,
    doorWpos.z + Math.abs(sin) * along + Math.abs(cos) * thru,
  );
  const collider = { min: cmin.clone(), max: cmax.clone() };
  // start open — no blocking
  collider.min.set(0, 900, 0);
  collider.max.set(0, 900, 0);
  colliders.push(collider);

  const openY = -doorH * 0.5 - 0.08;
  const closedY = doorH * 0.5;

  const state = {
    kind: "stallDoor",
    label,
    closed: false,
    target: 0,
    amount: 0,
    panel,
    openY,
    closedY,
    collider,
    closedMin: cmin.clone(),
    closedMax: cmax.clone(),
    position: new THREE.Vector3(btnWpos.x, btnY, btnWpos.z),
    radius: 0.62,
    button: btn,
    btnOutX,
    btnInX,
    prompt() {
      return this.closed
        ? `Press E · Open ${this.label}`
        : `Press E · Close ${this.label}`;
    },
    toggle() {
      this.closed = !this.closed;
      this.target = this.closed ? 1 : 0;
    },
  };
  interactables.push(state);
  return state;
}

/**
 * Stall bank — shared partition planes slice one volume into slots
 * (one divider between two bays, not a separate box per stall).
 * Local: +Z = aisle/doors, -Z = back wall, X = along the row.
 */
function makeStallBank(room, colliders, interactables, roomOx, roomOz, {
  cx, cz, count = 2, stallW = 1.25, depth = 1.7, rotY = 0,
  kind = "toilet", stallH = 3.85,
}) {
  const stallTex = canvasTex("stallMarble_v1", patternStallPanel, 256);
  const wallM = kind === "shower"
    ? patternedMat(0xf2f4f6, stallTex, 1.0, 2.2, { metalness: 0.55, roughness: 0.18 })
    : patternedMat(0xf4f6f8, stallTex, 1.0, 2.2, { metalness: 0.5, roughness: 0.2 });
  const panelT = 0.06;
  const totalW = count * stallW;
  const g = new THREE.Group();
  g.position.set(cx, 0, cz);
  g.rotation.y = rotY;
  room.add(g);

  const cos = Math.cos(rotY);
  const sin = Math.sin(rotY);
  function addLocalBox(lw, lh, ld, lx, ly, lz) {
    g.add(box(lw, lh, ld, wallM, lx, ly, lz));
    const wx = roomOx + cx + cos * lx - sin * lz;
    const wz = roomOz + cz + sin * lx + cos * lz;
    const hx = Math.abs(cos) * (lw / 2) + Math.abs(sin) * (ld / 2);
    const hz = Math.abs(sin) * (lw / 2) + Math.abs(cos) * (ld / 2);
    colliders.push({
      min: new THREE.Vector3(wx - hx, ly - lh / 2, wz - hz),
      max: new THREE.Vector3(wx + hx, ly + lh / 2, wz + hz),
    });
  }

  // one continuous back plane
  addLocalBox(totalW + panelT, stallH, panelT, 0, stallH * 0.5, -depth * 0.5);
  // two end planes
  addLocalBox(panelT, stallH, depth, -totalW * 0.5, stallH * 0.5, 0);
  addLocalBox(panelT, stallH, depth, totalW * 0.5, stallH * 0.5, 0);
  // shared dividers between slots
  for (let i = 1; i < count; i++) {
    const x = -totalW * 0.5 + i * stallW;
    addLocalBox(panelT, stallH, depth, x, stallH * 0.5, 0);
  }

  const doorW = Math.max(0.5, stallW - panelT - 0.04);
  const doorZ = depth * 0.5;
  const doorH = stallH - 0.15;

  for (let i = 0; i < count; i++) {
    const slotX = -totalW * 0.5 + stallW * (i + 0.5);
    if (kind === "toilet") {
      // i=0 is the far/east corner stall (innermost) on the washroom bank
      const special = i === 0;
      makeToilet(g, slotX, 0, -depth * 0.22, 0, {
        special,
        interactables,
        roomOx,
        roomOz,
        bankCx: cx,
        bankCz: cz,
        bankRotY: rotY,
      });
      makeLooRoll(g, slotX + stallW * 0.5 - 0.03, 0.95, -depth * 0.08);
    } else {
      makeShowerFixtures(g, slotX, 0, 0, 0);
      g.add(box(stallW - 0.12, 0.04, depth - 0.12, patternedMat(0xeef3f8, stallTex, 1.4, 1.2, {
        metalness: 0.8, roughness: 0.14,
      }), slotX, 0.03, 0));
    }

    makeRisingStallGate(g, colliders, interactables, roomOx, roomOz, cx, cz, rotY, {
      slotX,
      doorZ,
      doorW,
      doorH,
      stallW,
      label: `${kind} ${i + 1}`,
    });
  }
}

export function updateStallDoors(interactables, dt) {
  if (!interactables) return;
  const speed = 2.2;
  for (let i = 0; i < interactables.length; i++) {
    const d = interactables[i];
    if (d.kind === "bedShield") continue; // leftover — pods are click/tap now
    if (d.kind === "toiletLid") {
      d.amount += (d.target - d.amount) * Math.min(1, 3.8 * dt);
      if (d.amount < 0.001) d.amount = 0;
      if (d.amount > 0.999) d.amount = 1;
      if (d.lidPivot) {
        d.lidPivot.rotation.x = d.closedRotX + (d.openRotX - d.closedRotX) * d.amount;
      }
      continue;
    }
    if (d.kind !== "stallDoor") continue;
    d.amount += (d.target - d.amount) * Math.min(1, speed * dt);
    if (d.amount < 0.001) d.amount = 0;
    if (d.amount > 0.999) d.amount = 1;
    if (d.panel && d.openY != null) {
      d.panel.position.y = d.openY + (d.closedY - d.openY) * d.amount;
    }
    if (d.amount > 0.55) {
      d.collider.min.copy(d.closedMin);
      d.collider.max.copy(d.closedMax);
    } else {
      d.collider.min.set(0, 900, 0);
      d.collider.max.set(0, 900, 0);
    }
    if (d.button) {
      // grey sits proud when open; half way into well when closed
      const outX = d.btnOutX ?? -0.045;
      const inX = d.btnInX ?? -0.022;
      const wantX = outX + (inX - outX) * d.amount;
      d.button.position.x += (wantX - d.button.position.x) * Math.min(1, 12 * dt);
    }
  }
}

export function nearestInteractable(interactables, pos) {
  let best = null;
  let bestDist = Infinity;
  if (!interactables) return null;
  for (let i = 0; i < interactables.length; i++) {
    const it = interactables[i];
    if (it.kind === "bedShield" || it.kind === "wallMonitor") continue;
    if (typeof it.active === "function" && !it.active()) continue;
    const dx = pos.x - it.position.x;
    const dz = pos.z - it.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < (it.radius ?? 1.5) && dist < bestDist) {
      bestDist = dist;
      best = it;
    }
  }
  return best;
}

/** Wall monitor panels — same style as cockpit side screens */
function decorateWallMonitors(room, anim, spots) {
  for (const [x, y, z, rotY, w = 2.0, h = 1.4] of spots) {
    makeBigScreen(room, anim, x, y, z, w, h, rotY);
  }
}

/** Shared glow text — sized to content; returns tex + aspect (no stretch). */
function makeGlowTextTexture(
  text = "Ad astra",
  fontPx = 128,
  fontFamily = '"Sora", "IBM Plex Sans", sans-serif',
  fontWeight = "700",
) {
  const resolved = `${fontWeight} ${fontPx}px ${fontFamily}`;
  const probe = document.createElement("canvas").getContext("2d");
  probe.font = resolved;
  const tw = Math.max(8, probe.measureText(text).width);
  const isScript = /DinerScript|cursive/i.test(fontFamily);
  const padX = fontPx * (isScript ? 0.85 : 0.55);
  const padY = fontPx * (isScript ? 0.85 : 0.5);
  const c = document.createElement("canvas");
  c.width = Math.ceil(tw + padX * 2);
  c.height = Math.ceil(fontPx * (isScript ? 1.55 : 1.15) + padY * 2);
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = resolved;
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(255, 255, 255, 0.95)";
  ctx.shadowBlur = Math.max(28, fontPx * (isScript ? 0.5 : 0.35));
  ctx.fillText(text, c.width * 0.5, c.height * 0.52);
  ctx.shadowBlur = Math.max(12, fontPx * 0.16);
  ctx.fillText(text, c.width * 0.5, c.height * 0.52);
  ctx.shadowBlur = 0;
  ctx.fillText(text, c.width * 0.5, c.height * 0.52);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return { tex, aspect: c.width / Math.max(1, c.height) };
}

function makeGlowTextMaterial(tex) {
  return new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 1,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });
}

/** Multiline hologram canvas (cyan / red unlock labels). */
function makeHoloLinesTexture(lines, {
  fill = "#7dfff6",
  shadow = "rgba(64, 255, 235, 0.95)",
  fontPx = 90,
} = {}) {
  const list = (Array.isArray(lines) ? lines : [String(lines || "")]).filter(
    (s) => String(s).trim().length
  );
  if (!list.length) list.push(" ");
  const fontFamily = '"Sora", "IBM Plex Sans", sans-serif';
  const resolved = `700 ${fontPx}px ${fontFamily}`;
  const probe = document.createElement("canvas").getContext("2d");
  probe.font = resolved;
  let tw = 8;
  for (const line of list) {
    tw = Math.max(tw, probe.measureText(line).width);
  }
  const lineH = fontPx * 1.12;
  const padX = fontPx * 0.55;
  const padY = fontPx * 0.45;
  const c = document.createElement("canvas");
  c.width = Math.ceil(tw + padX * 2);
  c.height = Math.ceil(lineH * list.length + padY * 2);
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = resolved;
  ctx.fillStyle = fill;
  ctx.shadowColor = shadow;
  const cx = c.width * 0.5;
  for (let i = 0; i < list.length; i++) {
    const cy = padY + lineH * (i + 0.5);
    ctx.shadowBlur = Math.max(22, fontPx * 0.4);
    ctx.fillText(list[i], cx, cy);
    ctx.shadowBlur = Math.max(10, fontPx * 0.18);
    ctx.fillText(list[i], cx, cy);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.88;
    ctx.fillText(list[i], cx, cy);
    ctx.globalAlpha = 1;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return { tex, aspect: c.width / Math.max(1, c.height) };
}

function makeInfoHubDoorHolo(room, anim, {
  ox, oz, localX, localZ, gw, h, axis,
}) {
  if (!anim) return null;
  if (!anim.infoHubHolos) anim.infoHubHolos = [];
  const { holeY } = doorOpeningMetrics(gw, h);
  const wx = ox + localX;
  const wz = oz + localZ;
  const key = `holo_${wx.toFixed(1)}_${wz.toFixed(1)}_${axis}`;
  if (!anim.infoHubHoloKeys) anim.infoHubHoloKeys = new Set();
  if (anim.infoHubHoloKeys.has(key)) return null;
  anim.infoHubHoloKeys.add(key);

  const { tex, aspect } = makeHoloLinesTexture(["INFO", "HUB"], {
    fill: "#7dfff6",
    shadow: "rgba(64, 255, 235, 0.95)",
    fontPx: 110,
  });
  const planeH = 1.15;
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 0.62,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(planeH * aspect, planeH),
    mat
  );
  const inset = 0.35;
  // Lower in the doorway so it reads near mid-opening, not head height
  const holoY = Math.max(0.95, holeY - 0.55);
  if (axis === "x") {
    const inward = -Math.sign(localZ || 1);
    plane.position.set(localX, holoY, localZ + inward * inset);
  } else {
    const inward = -Math.sign(localX || 1);
    plane.position.set(localX + inward * inset, holoY, localZ);
    plane.rotation.y = Math.PI / 2;
  }
  plane.renderOrder = 1;
  room.add(plane);
  anim.infoHubHolos.push(plane);
  return plane;
}

/** Reddish unlock hologram on a sealed door (click / tap target). */
function makeDoorUnlockHolo() {
  const lines = ["Unlock with", DOOR_UNLOCK_COST + " data points"];
  const red = makeHoloLinesTexture(lines, {
    fill: "#e85a5a",
    shadow: "rgba(180, 40, 40, 0.75)",
    fontPx: 72,
  });
  const cyan = makeHoloLinesTexture(lines, {
    fill: "#7dfff6",
    shadow: "rgba(64, 255, 235, 0.95)",
    fontPx: 72,
  });
  const planeH = 0.7;
  const mat = new THREE.MeshBasicMaterial({
    map: red.tex,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(planeH * red.aspect, planeH),
    mat
  );
  plane.renderOrder = 1;
  plane.userData.unlockHolo = true;
  plane.userData.baseMap = red.tex;
  plane.userData.hoverMap = cyan.tex;
  plane.userData.baseOpacity = 0.22;
  plane.userData.hoverOpacity = 0.95;
  plane.userData.flashOpacity = 1;
  return plane;
}

/** Spend unlock: open a sealed door and drop its walk blocker. */
export function unlockShipDoor(door, opts = {}) {
  if (!door || !door.locked) return false;
  door.locked = false;
  syncDoorPanelSeal(door);
  if (door.blockCollider && Array.isArray(door.colliders)) {
    door.savedBlockCollider = door.blockCollider;
    const i = door.colliders.indexOf(door.blockCollider);
    if (i >= 0) door.colliders.splice(i, 1);
    door.blockCollider = null;
  }
  if (door.unlockHolo && !opts.keepHoloVisible) {
    door.unlockHolo.visible = false;
  }
  try {
    markDoorUnlocked(door.key);
  } catch (_) {}
  return true;
}

/** Re-seal lockable doors after a ship progress reset (exercise datapoints untouched). */
export function relockAllShipDoors(doors) {
  for (const door of doors || []) {
    if (!door?.lockable) continue;
    door.locked = true;
    syncDoorPanelSeal(door);
    const block = door.savedBlockCollider || door.blockCollider;
    if (block && Array.isArray(door.colliders) && !door.colliders.includes(block)) {
      door.colliders.push(block);
    }
    door.blockCollider = block || null;
    const holo = door.unlockHolo;
    if (holo) {
      holo.visible = true;
      if (holo.userData.homeY != null) holo.position.y = holo.userData.homeY;
      holo.scale.set(1, 1, 1);
      if (holo.material) {
        if (holo.userData.baseMap) holo.material.map = holo.userData.baseMap;
        holo.material.opacity = holo.userData.baseOpacity ?? 0.22;
        holo.material.needsUpdate = true;
      }
    }
  }
}

/**
 * Desk options as real Three.js planes (Roblox ClickDetector style).
 * Aim with crosshair + click — works with pointer lock, ~3 cheap meshes.
 */
export function makeCockpitDeskOptions(parent) {
  const group = new THREE.Group();
  // Over middle desk blue panel — raised toward upper half of the screen
  group.position.set(0, 1.22, 0.98);
  parent.add(group);

  // Top row: See outside | See console (smaller). Bottom: Reset.
  const specs = [
    {
      id: "outside",
      label: "See outside",
      fill: "#7dfff6",
      shadow: "rgba(64, 255, 235, 0.9)",
      planeH: 0.2,
      fontPx: 58,
      x: -0.42,
      y: 0.14,
    },
    {
      id: "console",
      label: "See console",
      fill: "#9ec8ff",
      shadow: "rgba(80, 160, 255, 0.9)",
      planeH: 0.2,
      fontPx: 58,
      x: 0.42,
      y: 0.14,
    },
    {
      id: "reset",
      label: "Reset",
      fill: "#ffb070",
      shadow: "rgba(255, 140, 70, 0.85)",
      planeH: 0.24,
      fontPx: 64,
      x: 0,
      y: -0.06,
    },
  ];
  const items = [];

  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    const { tex, aspect } = makeHoloLinesTexture([spec.label], {
      fill: spec.fill,
      shadow: spec.shadow,
      fontPx: spec.fontPx,
    });
    const planeH = spec.planeH;
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: false,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(planeH * aspect, planeH),
      mat
    );
    mesh.position.set(spec.x, spec.y, 0);
    mesh.rotation.y = Math.PI;
    mesh.rotation.x = 0.45;
    mesh.renderOrder = 1;
    mesh.userData.deskOption = true;
    mesh.userData.optionId = spec.id;
    mesh.userData.baseOpacity = 0.4;
    mesh.userData.hoverOpacity = 0.95;
    // Slightly larger invisible pick helper (same center) for easier FPS aim
    const hit = new THREE.Mesh(
      new THREE.PlaneGeometry(planeH * aspect * 1.25, planeH * 1.35),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    hit.position.copy(mesh.position);
    hit.rotation.copy(mesh.rotation);
    hit.userData.deskOption = true;
    hit.userData.optionId = spec.id;
    hit.userData.visual = mesh;
    group.add(mesh);
    group.add(hit);
    items.push({ id: spec.id, mesh, hit });
  }

  group.visible = false;
  return { group, items };
}

/** Wall / door glow label — height sets size; width follows texture aspect. */
function makeWallGlowText(room, {
  text, x, y, z, rotY = 0, h = 0.65, fontPx = 96,
}) {
  const { tex, aspect } = makeGlowTextTexture(text, fontPx);
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(h * aspect, h),
    makeGlowTextMaterial(tex),
  );
  plane.position.set(x, y, z);
  plane.rotation.y = rotY;
  plane.renderOrder = 1;
  plane.userData.doorOverLabel = true;
  room.add(plane);
  return plane;
}

/** Glow label centered above a room's door (on the lintel band). */
function makeDoorOverLabel(room, side, text, size = {}) {
  const dims = room.userData.dims;
  if (!dims) return null;
  const { w, d, h } = dims;
  const wallT = 0.22;
  const y = h - 0.55;
  const faceInset = 0.14;
  let x = 0;
  let z = 0;
  let rotY = 0;
  if (side === "n") {
    z = d * 0.5 - wallT - faceInset;
    rotY = Math.PI;
  } else if (side === "s") {
    z = -d * 0.5 + wallT + faceInset;
    rotY = 0;
  } else if (side === "e") {
    x = w * 0.5 - wallT - faceInset;
    rotY = -Math.PI / 2;
  } else if (side === "w") {
    x = -w * 0.5 + wallT + faceInset;
    rotY = Math.PI / 2;
  }
  return makeWallGlowText(room, {
    text,
    x,
    y,
    z,
    rotY,
    h: size.h ?? 0.52,
    fontPx: size.fontPx ?? 88,
  });
}

/** Bold Orbitron ceiling brand. */
function makeControlCeilingBrand(room) {
  const h = room.userData.dims?.h ?? 5;
  const { tex, aspect } = makeGlowTextTexture("Ad astra", 200);
  const planeH = 4.4;
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(planeH * aspect, planeH),
    makeGlowTextMaterial(tex),
  );
  plane.rotation.x = Math.PI / 2;
  plane.rotation.z = Math.PI;
  plane.position.set(0, h - 0.06, 0.2);
  room.add(plane);
  room.userData.ceilingBrand = plane;
  return plane;
}

/** Big white script glow on the wall behind the dining table. */
function makeDeliciousNeon(room, _anim, x = -2.6, y = 2.7, z = -5.12) {
  const { tex, aspect } = makeGlowTextTexture(
    "Bon appétit",
    240,
    '"DinerScript", cursive',
    "400",
  );
  const planeH = 4.4;
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(planeH * aspect, planeH),
    makeGlowTextMaterial(tex),
  );
  plane.position.set(x, y, z);
  plane.rotation.y = 0;
  plane.rotation.z = -0.16;
  plane.renderOrder = 2;
  room.add(plane);
  return plane;
}

/** Patterned lounge carpet sitting on top of the room floor, in front of the couches. */
function makeLoungeCarpet(room, x, z, w, d) {
  // room floor is a 0.12-thick box centered at y=0.06 → top at 0.12
  const floorTop = 0.12;
  const thick = 0.05;
  const map = canvasTex("dinerLoungeCarpet_space_v1", (ctx, s) => {
    // deep space navy base
    const g = ctx.createRadialGradient(s * 0.5, s * 0.5, s * 0.05, s * 0.5, s * 0.5, s * 0.75);
    g.addColorStop(0, "#1a3a58");
    g.addColorStop(0.55, "#0e2438");
    g.addColorStop(1, "#081420");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);

    // faint hex / panel grid
    ctx.strokeStyle = "rgba(70, 140, 190, 0.28)";
    ctx.lineWidth = 1.5;
    const hex = s / 8;
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        const cx = (col + 0.5) * hex + (row % 2 ? hex * 0.5 : 0);
        const cy = (row + 0.5) * hex * 0.86;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i + Math.PI / 6;
          const px = cx + Math.cos(a) * hex * 0.42;
          const py = cy + Math.sin(a) * hex * 0.42;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }

    // orbital rings
    ctx.strokeStyle = "rgba(90, 200, 255, 0.45)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(s * 0.5, s * 0.5, s * 0.32, s * 0.18, -0.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(120, 170, 255, 0.35)";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(s * 0.5, s * 0.5, s * 0.4, s * 0.22, 0.55, 0, Math.PI * 2);
    ctx.stroke();

    // starfield
    for (let i = 0; i < 90; i++) {
      const sx = ((i * 73) % 97) / 97 * s;
      const sy = ((i * 41) % 89) / 89 * s;
      const r = 0.6 + (i % 4) * 0.45;
      ctx.fillStyle = i % 7 === 0
        ? "rgba(160, 230, 255, 0.95)"
        : "rgba(220, 235, 255, 0.75)";
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // soft cyan corner accents / circuit ticks
    ctx.strokeStyle = "rgba(80, 220, 255, 0.55)";
    ctx.lineWidth = 3;
    const m = s * 0.1;
    for (const [ox, oy, sx, sy] of [
      [m, m, 1, 1], [s - m, m, -1, 1], [m, s - m, 1, -1], [s - m, s - m, -1, -1],
    ]) {
      ctx.beginPath();
      ctx.moveTo(ox, oy + sy * s * 0.12);
      ctx.lineTo(ox, oy);
      ctx.lineTo(ox + sx * s * 0.12, oy);
      ctx.stroke();
    }

    // outer rim
    ctx.strokeStyle = "rgba(100, 190, 255, 0.65)";
    ctx.lineWidth = 8;
    ctx.strokeRect(s * 0.03, s * 0.03, s * 0.94, s * 0.94);
    ctx.strokeStyle = "rgba(40, 80, 120, 0.8)";
    ctx.lineWidth = 3;
    ctx.strokeRect(s * 0.07, s * 0.07, s * 0.86, s * 0.86);
  }, 256);
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
  const rug = box(w, thick, d, mat(0xffffff, {
    map,
    roughness: 0.92,
    metalness: 0.08,
  }), x, floorTop + thick * 0.5, z);
  room.add(rug);
  return rug;
}

function makeBigScreen(group, anim, x, y, z, w, h, rotY = 0, opts = {}) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  group.add(g);

  const radius = opts.radius ?? Math.min(0.35, w * 0.04, h * 0.08);
  const bezelMat = mat(0xb0b8c4, { metalness: 0.45, roughness: 0.4 });
  const screenMat = mat(0x0a2030, {
    emissive: 0x1a90cc, emissiveIntensity: 0.9, roughness: 0.35, metalness: 0.1,
  });

  // rounded bezel (solid)
  const bezel = extrudeRounded(w + 0.28, h + 0.28, 0.14, radius + 0.06, bezelMat);
  bezel.position.z = -0.05;
  g.add(bezel);

  // display face: flat rounded plane with proper UVs so space-view map works
  const screen = roundedPlane(w, h, radius, screenMat);
  screen.position.z = 0.08;
  g.add(screen);
  anim.screens.push(screen);

  const deco = new THREE.Group();
  g.add(deco);

  const barMats = [];
  // fake UI bars (flat on screen, kept inside panel)
  for (let i = 0; i < 5; i++) {
    const bw = Math.min(w * (0.12 + (i % 3) * 0.06), w * 0.28);
    const barMat = mat(0x44ffcc, {
      emissive: 0x44ffcc, emissiveIntensity: 0.85,
    });
    barMats.push(barMat);
    const bar = box(bw, 0.05, 0.01, barMat, -w * 0.22 + (i % 3) * 0.22, h * 0.22 - Math.floor(i / 3) * 0.28, 0.09);
    anim.bars.push(bar);
    deco.add(bar);
  }

  // circular segments — varying size/arc, flat, clipped to panel area
  const cx = w * 0.22;
  const cy = -h * 0.08;
  const maxR = Math.min(w, h) * 0.28;
  const segments = [
    { r0: maxR * 0.35, r1: maxR * 0.42, start: 0.2, len: 1.8 },
    { r0: maxR * 0.55, r1: maxR * 0.62, start: 1.4, len: 2.2 },
    { r0: maxR * 0.75, r1: maxR * 0.82, start: 3.5, len: 1.5 },
    { r0: maxR * 0.2, r1: maxR * 0.28, start: 4.2, len: 2.6 },
  ];
  const ringMats = [];
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const ringMat = new THREE.MeshBasicMaterial({
      color: i % 2 ? 0x66ffcc : 0x44aaff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });
    ringMats.push(ringMat);
    const seg = new THREE.Mesh(
      new THREE.RingGeometry(s.r0, s.r1, 48, 1, s.start, s.len),
      ringMat
    );
    seg.position.set(cx, cy, 0.09);
    const dir = i % 2 === 0 ? 1 : -1;
    seg.userData.spinSpeed = dir * (0.25 + i * 0.38 + (i * 0.17) % 0.4);
    deco.add(seg);
    anim.screenRings.push(seg);
  }

  const underGlowMat = mat(GLOW_CYAN, { emissive: GLOW_CYAN, emissiveIntensity: 1.1 });
  g.add(box(w * 0.85, 0.05, 0.08, underGlowMat, 0, -h / 2 - 0.1, 0.05));

  if (opts.interactive) {
    g.userData.interactiveScreen = true;
    g.userData.screenMesh = screen;
    g.userData.deco = deco;
    g.userData.mode = "default";
    g.userData.width = w;
    g.userData.height = h;
  } else {
    // Wall monitors: orange in SOS until debugged → calm blue
    // Tag so animateDeco doesn't pulse/recolor these (that looked glitchy)
    screen.userData.wallMonitor = true;
    deco.userData.wallMonitor = true;
    deco.traverse((o) => {
      o.userData.wallMonitor = true;
    });
    registerWallMonitor(anim, group, g, {
      screenMat,
      barMats,
      ringMats,
      underGlowMat,
    }, { maxW: w, maxH: h, z: 0.081 });
  }

  return g;
}

/** try3js-looking space: stars drift toward us, fade out, respawn small in the distance */
export function createSpaceView(renderer, aspect = 16 / 9) {
  const spaceScene = new THREE.Scene();
  spaceScene.background = new THREE.Color(0x0b0618);
  spaceScene.fog = new THREE.FogExp2(0x14082a, 0.008);

  const spaceCam = new THREE.PerspectiveCamera(70, aspect, 0.1, 600);
  spaceCam.position.set(0, 0, 0);

  const n = 1200;
  const FAR = 280;
  const NEAR = 45;
  const SPEED = 2.2;

  const pos = new Float32Array(n * 3);
  const fade = new Float32Array(n);
  const bright = new Float32Array(n);

  function respawn(i, randomZ) {
    // same wide xyz feel as try3js, but in front of the camera (-Z)
    pos[i * 3] = (Math.random() - 0.5) * 500;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 220;
    pos[i * 3 + 2] = randomZ ? -(NEAR + Math.random() * (FAR - NEAR)) : -FAR;
    // brightness variation like layered try3js stars
    bright[i] = 0.35 + Math.random() * 0.65;
    fade[i] = 1;
  }

  for (let i = 0; i < n; i++) respawn(i, true);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aFade", new THREE.BufferAttribute(fade, 1));
  geo.setAttribute("aBright", new THREE.BufferAttribute(bright, 1));

  const pointsMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.55,
    sizeAttenuation: true,
    transparent: true,
    depthWrite: false,
    fog: true,
  });

  pointsMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
         attribute float aFade;
         attribute float aBright;
         varying float vFade;
         varying float vBright;`
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         vFade = aFade;
         vBright = aBright;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
         varying float vFade;
         varying float vBright;`
      )
      .replace(
        "vec4 diffuseColor = vec4( diffuse, opacity );",
        "vec4 diffuseColor = vec4( diffuse * vBright, opacity * vFade );"
      );
  };
  pointsMat.customProgramCacheKey = () => "starFadeBright";

  spaceScene.add(new THREE.Points(geo, pointsMat));
  spaceScene.add(new THREE.HemisphereLight(0xb8a0ff, 0x1a1030, 0.85));
  spaceScene.add(new THREE.AmbientLight(0x6655aa, 0.35));

  const rt = new THREE.WebGLRenderTarget(1024, Math.round(1024 / aspect), {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    colorSpace: THREE.SRGBColorSpace,
  });

  const material = new THREE.MeshBasicMaterial({
    map: rt.texture,
    toneMapped: false,
  });

  let lastT = 0;

  return {
    scene: spaceScene,
    camera: spaceCam,
    rt,
    material,
    update(t, renderer) {
      const dt = lastT ? Math.min(t - lastT, 0.05) : 0.016;
      lastT = t;

      for (let i = 0; i < n; i++) {
        const iz = i * 3 + 2;
        pos[iz] += SPEED * dt;

        const z = -pos[iz];
        // stay bright most of the way; only soft-fade near the end
        const tFade = THREE.MathUtils.clamp((z - NEAR) / 35, 0, 1);
        fade[i] = tFade;

        if (pos[iz] > -NEAR || fade[i] < 0.02) respawn(i, false);
      }

      geo.attributes.position.needsUpdate = true;
      geo.attributes.aFade.needsUpdate = true;

      const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(rt);
      renderer.clear();
      renderer.render(spaceScene, spaceCam);
      renderer.setRenderTarget(prev);
    },
  };
}

const STATUS_BRIEF_KEY = "luac-ship-ai-brief";

export function clearShipBriefingProgress() {
  try {
    localStorage.removeItem(STATUS_BRIEF_KEY);
  } catch (_) {}
}

/** Short Netflix-style briefing; Scene 1 starts on enter. */
const STATUS_PAGES = [
  [
    "SHIP AI · PRIORITY CHANNEL",
    "",
    "Captain.",
    "",
    "A solar storm hit.",
    "The ship held. My database did not.",
    "",
    "I'm still online — most of me is gone.",
  ],
  [
    "Collect data points.",
    "",
    "Go to the Info Hub.",
    "Finish the lesson tasks there.",
    "",
    "Every point helps rebuild me.",
  ],
];

const PAGE_HOLD_SEC = 1.6;

function stopBriefSpeech() {
  shipVoice.stop();
}

function speakBriefLine(text) {
  void shipVoice.speak(text);
}

/** Canvas “See stats” screen — first visit types an AI emergency briefing. */
export function createStatusView(aspect = 16 / 9) {
  const W = 1280;
  // Tall enough for both briefing pages + datapoint footer (wide cockpit aspect
  // used to clamp H≈512 and clip later VO lines like “I am still online…”).
  const H = Math.max(780, Math.round(W / Math.max(0.5, aspect)));
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;

  const material = new THREE.MeshBasicMaterial({
    map: tex,
    toneMapped: false,
  });

  const seenBefore =
    typeof localStorage !== "undefined" &&
    localStorage.getItem(STATUS_BRIEF_KEY) === "1";

  let firstVisit = !seenBefore;
  let briefingStarted = false;
  let pageIdx = 0;
  let lineIdx = 0;
  let charIdx = 0;
  let pause = 0;
  let blink = 0;
  let complete = seenBefore;
  let cursorOn = true;
  let pageHold = 0;
  let spokenKey = "";
  let alertAnim = 0;
  /** Loading ellipsis phase: 0 → "." … 3 → ". . ." then loops */
  let alertDotPhase = 0;
  let dpUsed = 0;
  let dpAvailable = 0;

  function pageLines() {
    return STATUS_PAGES[pageIdx] || [];
  }

  function awaitingAlert() {
    return firstVisit && !briefingStarted && !complete;
  }

  function isHeaderLine() {
    // Channel chrome only — still narrate page-2 title ("Rebuild my database please.")
    return pageIdx === 0 && lineIdx === 0;
  }

  function speakCurrentLineOnce() {
    if (isHeaderLine()) return;
    const line = pageLines()[lineIdx] || "";
    if (!line.trim()) return;
    const key = pageIdx + ":" + lineIdx;
    if (key === spokenKey) return;
    spokenKey = key;
    speakBriefLine(line);
  }

  function wrapLine(text, maxW, font) {
    if (!text) return [""];
    ctx.font = font;
    if (ctx.measureText(text).width <= maxW) return [text];
    const words = text.split(" ");
    const out = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? cur + " " + w : w;
      if (ctx.measureText(next).width > maxW && cur) {
        out.push(cur);
        cur = w;
      } else {
        cur = next;
      }
    }
    if (cur) out.push(cur);
    return out.length ? out : [""];
  }

  function drawChrome(padX, padY) {
    ctx.fillStyle = "#0a0508";
    ctx.fillRect(0, 0, W, H);

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "rgba(120, 16, 16, 0.35)");
    grad.addColorStop(0.5, "rgba(40, 8, 10, 0.15)");
    grad.addColorStop(1, "rgba(90, 12, 12, 0.4)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(255, 70, 70, 0.55)";
    ctx.lineWidth = 3;
    ctx.strokeRect(28, 28, W - 56, H - 56);

    if (STATUS_PAGES.length > 1 && briefingStarted) {
      ctx.fillStyle = "rgba(255, 140, 140, 0.65)";
      ctx.font = "600 16px ui-monospace, Consolas, monospace";
      const label = pageIdx + 1 + "/" + STATUS_PAGES.length;
      const tw = ctx.measureText(label).width;
      ctx.fillText(label, W - padX - tw, padY);
    }
  }

  function drawFrame() {
    const padX = 64;
    const padY = 52;
    const maxW = W - padX * 2;
    const bodyFont = "500 26px ui-monospace, Consolas, monospace";
    const headFont = "700 30px ui-monospace, Consolas, monospace";

    drawChrome(padX, padY);

    let y = padY + 44;
    const lineH = 34;

    if (awaitingAlert()) {
      ctx.font = headFont;
      ctx.fillStyle = "#ff6a6a";
      ctx.fillText("SHIP AI · PRIORITY CHANNEL", padX, y);
      y += lineH * 1.6;
      ctx.font = bodyFont;
      ctx.fillStyle = "#f0d0d0";
      const dots = [".", ". .", ". . .", ". . . ."][alertDotPhase] || ". . .";
      ctx.fillText("Incoming priority message " + dots, padX, y);
      tex.needsUpdate = true;
      return;
    }

    const lines = pageLines();
    const rows = [];
    for (let i = 0; i < lines.length; i++) {
      if (i > lineIdx) break;
      const raw = i < lineIdx ? lines[i] : lines[i].slice(0, charIdx);
      // First line of each page is a header (incl. "Rebuild my database please.")
      const isHead = i === 0;
      const font = isHead ? headFont : bodyFont;
      const parts = wrapLine(raw, maxW, font);
      for (let p = 0; p < parts.length; p++) {
        rows.push({
          text: parts[p],
          head: isHead,
          caret:
            i === lineIdx &&
            p === parts.length - 1 &&
            !complete &&
            pageHold <= 0,
        });
      }
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      ctx.font = row.head ? headFont : bodyFont;
      ctx.fillStyle = row.head ? "#ff6a6a" : "#f0d0d0";
      ctx.fillText(row.text, padX, y);
      if (row.caret && cursorOn) {
        const tw = ctx.measureText(row.text).width;
        ctx.fillStyle = "#ff4444";
        ctx.fillRect(padX + tw + 4, y - 20, 12, 24);
      }
      y += lineH;
      if (y > H - 100) break;
    }

    if (complete) {
      y = Math.max(y + 24, H - 110);
      ctx.fillStyle = "rgba(90, 255, 230, 0.85)";
      ctx.font = "700 22px ui-monospace, Consolas, monospace";
      ctx.fillText("DATA POINTS", padX, y);
      y += 36;
      ctx.fillStyle = "#9ef7ef";
      ctx.font = "600 26px ui-monospace, Consolas, monospace";
      ctx.fillText(
        dpUsed + " data points used  /  " + dpAvailable + " data points available",
        padX,
        y
      );
    }

    tex.needsUpdate = true;
  }

  function markComplete() {
    complete = true;
    pageHold = 0;
    try {
      localStorage.setItem(STATUS_BRIEF_KEY, "1");
    } catch (_) {}
  }

  function goNextPage() {
    stopBriefSpeech();
    spokenKey = "";
    pageHold = 0;
    pageIdx += 1;
    lineIdx = 0;
    charIdx = 0;
    pause = 0.3;
    drawFrame();
  }

  function advanceAfterLine() {
    const lines = pageLines();
    lineIdx += 1;
    charIdx = 0;
    if (lineIdx < lines.length) return;

    if (pageIdx < STATUS_PAGES.length - 1) {
      lineIdx = lines.length - 1;
      charIdx = (lines[lineIdx] || "").length;
      pageHold = PAGE_HOLD_SEC;
      drawFrame();
      return;
    }

    markComplete();
  }

  function showAll() {
    pageIdx = STATUS_PAGES.length - 1;
    const lines = pageLines();
    lineIdx = Math.max(0, lines.length - 1);
    charIdx = (lines[lineIdx] || "").length;
    complete = true;
    briefingStarted = true;
    pageHold = 0;
    drawFrame();
  }

  if (!firstVisit) showAll();
  else {
    pageIdx = 0;
    lineIdx = 0;
    charIdx = 0;
    drawFrame();
  }

  return {
    material,
    texture: tex,
    get complete() {
      return complete;
    },
    needsAlertStart() {
      return awaitingAlert();
    },
    /** True while the AI briefing is actively playing (HUD suppresses nearby). */
    hasUnfinishedDialogue() {
      return briefingStarted && !complete;
    },
    /** True once proximity triggered the briefing (stays true after complete). */
    hasStartedBriefing() {
      return briefingStarted;
    },
    beginBriefing() {
      if (!awaitingAlert()) return false;
      stopBriefSpeech();
      spokenKey = "";
      briefingStarted = true;
      pageIdx = 0;
      lineIdx = 0;
      charIdx = 0;
      pause = 0.35;
      pageHold = 0;
      playBriefStart();
      drawFrame();
      return true;
    },
    start() {
      if (!firstVisit) showAll();
      else drawFrame();
    },
    reset() {
      stopBriefSpeech();
      spokenKey = "";
      try {
        localStorage.removeItem(STATUS_BRIEF_KEY);
      } catch (_) {}
      firstVisit = true;
      briefingStarted = false;
      complete = false;
      pageHold = 0;
      pageIdx = 0;
      lineIdx = 0;
      charIdx = 0;
      pause = 0;
      cursorOn = true;
      alertAnim = 0;
      alertDotPhase = 0;
      drawFrame();
    },
    setDatapointStats(used, available) {
      dpUsed = Math.max(0, Math.floor(Number(used) || 0));
      dpAvailable = Math.max(0, Math.floor(Number(available) || 0));
      if (complete) drawFrame();
    },
    update(dt) {
      blink += dt;
      if (blink > 0.45) {
        blink = 0;
        cursorOn = !cursorOn;
        if (!complete || cursorOn || pageHold > 0) drawFrame();
      }

      if (awaitingAlert()) {
        alertAnim += dt;
        if (alertAnim > 0.42) {
          alertAnim = 0;
          alertDotPhase = (alertDotPhase + 1) % 4;
          drawFrame();
        }
        return;
      }

      if (complete) return;

      if (pageHold > 0) {
        pageHold -= dt;
        if (pageHold <= 0) goNextPage();
        return;
      }

      if (!briefingStarted) return;

      if (pause > 0) {
        pause -= dt;
        return;
      }

      const lines = pageLines();
      const line = lines[lineIdx] || "";

      if (!line.length) {
        pause = 0.35;
        advanceAfterLine();
        drawFrame();
        return;
      }

      if (charIdx === 0) speakCurrentLineOnce();

      charIdx += 1;
      const ch = line[charIdx - 1];
      if (ch === "." || ch === "—" || ch === ",") pause = 0.12;
      else if (charIdx % 2 === 0) pause = 0.012;
      else pause = 0.028;

      if (charIdx >= line.length) {
        const isPageEnd = lineIdx >= lines.length - 1;
        pause = isPageEnd ? 0.55 : lineIdx === 0 && pageIdx === 0 ? 0.55 : 0.38;
        advanceAfterLine();
      }
      drawFrame();
    },
  };
}

function makeEngineCore(group, anim, x, y, z, { scale = 1, light = true } = {}) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(scale);
  group.add(g);

  g.add(cyl(0.85, 1.0, 0.25, mat(0xe0e6ec, { metalness: 0.92, roughness: 0.12 }), 0, 0.18, 0, 24));
  g.add(cyl(0.7, 0.7, 2.0, mat(0xd4dce6, { metalness: 0.9, roughness: 0.14 }), 0, 1.25, 0, 24));

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 24, 16),
    mat(GLOW_ORANGE, { emissive: GLOW_ORANGE, emissiveIntensity: 1.4, roughness: 0.25, metalness: 0.1 })
  );
  core.position.y = 1.25;
  g.add(core);
  anim.cores.push(core);

  if (light) {
    const halo = new THREE.PointLight(0xff6622, 2.2 * scale, 14 * scale, 1.5);
    halo.position.set(0, 1.25, 0);
    g.add(halo);
    anim.engineLights.push(halo);
  }

  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    g.add(box(0.12, 1.85, 0.12, mat(METAL), Math.cos(a) * 0.82, 1.15, Math.sin(a) * 0.82));
  }
  return g;
}

/** Thick simple orange riser from engine top into the ceiling */
function makeEngineCeilingPipes(room, anim, x, z, ceilingY, scale = 1) {
  const pipeMat = mat(0xff7a18, {
    metalness: 0.08,
    roughness: 0.55,
    emissive: 0xff6010,
    emissiveIntensity: 0.4,
  });
  const topY = ceilingY - 0.02;
  const baseY = 2.25 * scale;
  const h = Math.max(0.4, topY - baseY);
  const r = 0.42 * scale;
  room.add(cyl(r, r, h, pipeMat, x, baseY + h * 0.5, z, 16));
  if (anim) {
    if (!anim.enginePipes) anim.enginePipes = [];
    anim.enginePipes.push(pipeMat);
  }
}

/** Canvas plane label for floating hub archives (white ink — tint via material.color). */
function makeHoloLabel(text, size = 128, opts = {}) {
  const w = opts.width || size;
  const h = opts.height || size;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, w, h);
  const fontPx = opts.fontPx || Math.round(Math.min(w, h) * 0.5);
  ctx.font = `700 ${fontPx}px ui-monospace, Consolas, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.fillText(text, w / 2 + 2, h / 2 + 2);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, w / 2, h / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return new THREE.Mesh(
    new THREE.PlaneGeometry(opts.planeW || 0.95, opts.planeH || 0.95),
    new THREE.MeshBasicMaterial({
      map: tex,
      color: 0xd2fff0,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    })
  );
}

/**
 * Central Info Hub floaty — shrinks when approached; Year 4–9 orbs emerge around it.
 */
function createInfoHubArchive(hub, anim) {
  const YEARS = [4, 5, 6, 7, 8, 9];
  const root = new THREE.Group();
  root.position.y = 1.48;
  hub.add(root);

  // Opaque + emissive (no glass transparency) — transparent hub orbs freeze many phones
  // when they pop in (fill-rate + mobile material downgrade stripping emissive).
  const coreMat = mat(0x44ffcc, {
    emissive: 0x22aa88,
    emissiveIntensity: 1.05,
    roughness: 0.28,
    metalness: 0.12,
  });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.82, 0), coreMat);
  core.userData.hubBeacon = true;
  root.add(core);
  // Do not push into anim.rings — that path fights hub scale/spin and wastes CPU near the hub.

  // 3D "Year" above centre (same style as year numbers — not a HUD overlay)
  const yearTitle = makeHoloLabel("Year", 128, {
    width: 320,
    height: 128,
    fontPx: 72,
    planeW: 1.55,
    planeH: 0.55,
  });
  yearTitle.material.color.setHex(0xd2fff0);
  yearTitle.position.y = 0.95;
  yearTitle.scale.setScalar(0.01);
  yearTitle.visible = false;
  root.add(yearTitle);

  const labelBaseColor = new THREE.Color(0xffc857);
  const nodes = YEARS.map((year, i) => {
    const g = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.2, 0),
      mat(0xf0a428, {
        emissive: 0xc87818,
        emissiveIntensity: 0.7,
        roughness: 0.32,
        metalness: 0.18,
      })
    );
    g.add(mesh);
    const label = makeHoloLabel(String(year), 128, { fontPx: 36 });
    label.material.color.copy(labelBaseColor);
    label.position.y = 0.34;
    label.scale.setScalar(0.55);
    g.add(label);
    g.visible = false;
    g.scale.setScalar(0.001);
    root.add(g);
    const angle = (i / YEARS.length) * Math.PI * 2 - Math.PI / 2;
    return {
      year,
      group: g,
      mesh,
      label,
      angle,
      href: `../y${year}/`,
      baseColor: new THREE.Color(0xf0a428),
      baseEmissive: new THREE.Color(0xc87818),
      labelBase: labelBaseColor.clone(),
      lift: 0,
    };
  });

  let expand = 0;
  /** Continuous ring phase — never retarget from t*rate (that teleports orbs on pick). */
  let orbitPhase = 0;
  /** @type {typeof nodes[0] | null} */
  let aimed = null;
  /** @type {typeof nodes[0] | null} */
  let picked = null;
  // Hover / pick highlight — cyan (was pink)
  const aimColor = new THREE.Color(0x66ffe0);
  const aimEmissive = new THREE.Color(0x33ccaa);
  const aimLabel = new THREE.Color(0xd2fff0);

  function applyAimStyle(node, on) {
    if (!node?.mesh?.material) return;
    const m = node.mesh.material;
    // Mobile downgrade may swap Standard → Basic (no emissive) — never assume it exists.
    if (on) {
      m.color.copy(aimColor);
      if (m.emissive) {
        m.emissive.copy(aimEmissive);
        if (m.emissiveIntensity != null) m.emissiveIntensity = 1.2;
      }
      if (node.label?.material?.color) node.label.material.color.copy(aimLabel);
    } else {
      m.color.copy(node.baseColor);
      if (m.emissive) {
        m.emissive.copy(node.baseEmissive);
        if (m.emissiveIntensity != null) m.emissiveIntensity = 0.55;
      }
      if (node.label?.material?.color) node.label.material.color.copy(node.labelBase);
    }
  }

  return {
    root,
    core,
    coreMat,
    yearTitle,
    nodes,
    position: new THREE.Vector3(hub.position.x, 1.48, hub.position.z),
    /** Must stand close before the year ring opens */
    radius: 2.85,
    get expand() {
      return expand;
    },
    getAimedYear() {
      return aimed;
    },
    getPickedYear() {
      return picked;
    },
    /** Lock a year orb for the exit transition (spin-up). */
    beginYearPick(node) {
      if (!node || picked) return false;
      picked = node;
      if (aimed && aimed !== node) applyAimStyle(aimed, false);
      aimed = node;
      applyAimStyle(node, true);
      return true;
    },
    /** Undo pick (e.g. browser back restores the ship from bfcache). */
    clearYearPick() {
      if (picked) applyAimStyle(picked, false);
      picked = null;
      if (aimed) applyAimStyle(aimed, false);
      aimed = null;
    },
    /** Roblox-style look highlight (camera forward / crosshair). */
    setAimedYear(node) {
      if (picked) return;
      if (aimed === node) return;
      if (aimed) applyAimStyle(aimed, false);
      aimed = node || null;
      if (aimed) applyAimStyle(aimed, true);
    },
    /**
     * @param {number} dt
     * @param {boolean} near
     * @param {number} t
     * @param {THREE.Camera} [camera]
     */
    update(dt, near, t, camera) {
      const target = near || picked ? 1 : 0;
      expand += (target - expand) * Math.min(1, 5 * dt);

      const coreScale = THREE.MathUtils.lerp(1, 0.28, expand);
      core.scale.setScalar(coreScale);
      // Only the small expanded centre drops — big floaty & year orbs keep height
      core.position.y = THREE.MathUtils.lerp(0, -0.72, expand);
      const coreSpinRate = picked ? 1.2 : 0.35;
      core.rotation.y += coreSpinRate * dt;
      core.rotation.x = Math.sin(t * 0.4) * 0.12;

      // Keep "Year" just above the centre mesh — only once approached
      const titleShow = expand > 0.08;
      yearTitle.visible = titleShow;
      yearTitle.position.y = core.position.y + 0.55 * coreScale + 0.28;
      yearTitle.scale.setScalar(THREE.MathUtils.lerp(0.01, 0.72, Math.min(1, expand / 0.35)));
      if (camera && titleShow) yearTitle.lookAt(camera.position);

      // Compact ring — integrate angle so speeding up on pick does not teleport
      const orbit = THREE.MathUtils.lerp(0.02, 0.62, expand);
      const nodeT = Math.max(0, (expand - 0.05) / 0.95);
      orbitPhase += (picked ? 0.14 : 0.022) * dt;
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const show = expand > 0.06;
        n.group.visible = show;
        n.group.scale.setScalar(THREE.MathUtils.lerp(0.01, 1, nodeT));
        const spin = n.angle + orbitPhase;
        const liftTarget = picked === n ? 0.38 : 0;
        n.lift += (liftTarget - n.lift) * Math.min(1, 5.5 * dt);
        n.group.position.set(
          Math.cos(spin) * orbit,
          -0.72 + n.lift + Math.sin(t * 0.4 + n.angle) * 0.03 * nodeT,
          Math.sin(spin) * orbit
        );
        const meshSpinRate = picked === n ? 5.2 : 0.35;
        n.mesh.rotation.y += meshSpinRate * dt;
        n.mesh.rotation.x = Math.sin(t * (picked === n ? 2.4 : 0.28) + n.angle) * 0.18;
        if (camera && show) n.label.lookAt(camera.position);
      }

      if (!picked && (!near || expand < 0.4)) this.setAimedYear(null);
    },
    /**
     * Crosshair / tap pick — ray from NDC against year meshes.
     * @param {THREE.Camera} camera
     * @param {THREE.Raycaster} raycaster
     * @param {THREE.Vector2} ndc
     */
    pickYearByRay(camera, raycaster, ndc) {
      if (expand < 0.45 || !camera || !raycaster || !ndc) return null;
      raycaster.setFromCamera(ndc, camera);
      const meshes = [];
      for (const n of nodes) {
        if (!n.group.visible) continue;
        meshes.push(n.mesh);
      }
      if (!meshes.length) return null;
      const hits = raycaster.intersectObjects(meshes, false);
      if (!hits.length) return null;
      const obj = hits[0].object;
      return nodes.find((n) => n.mesh === obj) || null;
    },
  };
}

/**
 * Ship layout (XZ top-down, +Z forward toward cockpit):
 *
 *              [   COCKPIT   ]
 *                     |
 *              [  CORRIDOR N  ]
 *                     |
 *   [GARDEN]—[  HUB  ]—[CONFERENCE]
 *                     |
 *              [  CORRIDOR S  ]
 *                /         \
 *        [CREW BEDS]     [TOILETS]
 *               |
 *         [ ENGINE ROOM ]
 */
export function buildShip(scene) {
  const root = new THREE.Group();
  scene.add(root);

  const colliders = [];
  const zones = [];
  const anim = { screens: [], bars: [], rings: [], screenRings: [], cores: [], engineLights: [], blinkers: [], hubNeon: null, sittingCrew: [], patrolCrew: [], sleepingCrew: [], enginePipes: [], deliciousNeon: null, plants: [], activePlant: null, sosRooms: [], sosActive: true, wallMonitors: [], infoHubHolos: [], beds: [] };
  anim.root = root;
  const autoDoors = [];
  const interactables = [];
  const doorKeys = new Set();
  const frameKeys = new Set();
  const mk = (opts) => roomShell(colliders, root, { autoDoors, doorKeys, frameKeys, anim, ...opts });

  const H = 5.0;
  const DW = 2.8;

  // —— COCKPIT (forward) ——
  // same width (16), shorter depth (10); south face stays at z=17 for corridor join
  const control = mk({
    cx: 0, cz: 22, w: 16, d: 10, h: H,
    doors: [{ side: "s", width: DW, leadsTo: "Corridor" }],
    floorColor: 0xc8d0da,
    label: "Cockpit",
  });
  zones.push(control.userData);

  // clean white minimal bridge stage + one step — fill to side + front walls
  const stageH = 0.27;
  const stageW = 15.45;
  const white = mat(0xffffff, { metalness: 0.14, roughness: 0.3 });
  const stageFront = -0.65;
  const stageBack = 4.72;
  const stageDepth = stageBack - stageFront;
  control.add(box(
    stageW, stageH, stageDepth, white,
    0, stageH * 0.5, (stageFront + stageBack) * 0.5,
  ));
  const tread = 0.45;
  control.add(box(stageW, stageH * 0.5, tread, white, 0, stageH * 0.25, stageFront - tread * 0.5));

  const bridge = new THREE.Group();
  bridge.position.y = stageH;
  control.add(bridge);

  const mainScreen = makeBigScreen(control, anim, 0, 2.75, 4.55, 12.2, 4.1, Math.PI, {
    interactive: true,
    radius: 0.38,
  });
  makeConsole(bridge, 0, 0, 1.4, 0);
  makeConsole(bridge, -4.5, 0, 2.0, 0.35);
  makeConsole(bridge, 4.5, 0, 2.0, -0.35);
  const deskOptions = makeCockpitDeskOptions(bridge);

  // seat behind a desk in desk-local space (localX along width, localZ toward chairs)
  const deskSeat = (deskX, deskZ, rotY, localX, localZ = -1.15) => {
    const c = Math.cos(rotY);
    const s = Math.sin(rotY);
    return {
      x: deskX + localX * c + localZ * s,
      z: deskZ - localX * s + localZ * c,
      rotY,
    };
  };
  const chairTone = 0x7a90b0;
  // middle desk — one chair (crew unlock later)
  {
    const p = deskSeat(0, 1.4, 0, 0, -1.2);
    makeChair(bridge, p.x, 0, p.z, p.rotY, chairTone);
  }
  // side desks — two chairs each
  for (const desk of [
    { x: -4.5, z: 2.0, rot: 0.35 },
    { x: 4.5, z: 2.0, rot: -0.35 },
  ]) {
    for (const lx of [-0.58, 0.58]) {
      const p = deskSeat(desk.x, desk.z, desk.rot, lx);
      makeChair(bridge, p.x, 0, p.z, p.rotY, chairTone);
    }
  }
  makeBigScreen(control, anim, -7.5, 2.1, 2.2, 2.0, 1.4, Math.PI / 2);
  makeBigScreen(control, anim, 7.5, 2.1, 2.2, 2.0, 1.4, -Math.PI / 2);
  // flat wall power boxes on each side of the south door
  {
    const boxBody = mat(0xeef2f6, { metalness: 0.4, roughness: 0.28 });
    const doorFace = mat(0xf4f7fb, { metalness: 0.35, roughness: 0.3 });
    const caution = mat(0xffe066, { metalness: 0.25, roughness: 0.4, emissive: 0xccaa22, emissiveIntensity: 0.2 });
    const led = mat(GLOW_GREEN, { emissive: GLOW_GREEN, emissiveIntensity: 0.9, roughness: 0.35 });
    // south wall inner ≈ -4.78; keep boxes flat against wall, slight protrusion
    const bz = -4.58;
    const bw = 2.6;
    const bh = 2.1;
    const bd = 0.22;
    for (const bx of [-5.0, 5.0]) {
      control.add(box(bw, bh, bd, boxBody, bx, 1.75, bz));
      control.add(box(bw * 0.92, bh * 0.88, 0.03, doorFace, bx, 1.75, bz + bd * 0.5 + 0.01));
      // caution stripe + status LED
      control.add(box(bw * 0.92, 0.06, 0.025, caution, bx, 1.05, bz + bd * 0.5 + 0.025));
      control.add(cyl(0.04, 0.04, 0.03, led, bx + bw * 0.32, 2.55, bz + bd * 0.5 + 0.04, 12));
    }
  }
  makeControlCeilingBrand(control);
  styleRoomLighting(control, "control");
  enableSos(control, anim);
  // keep walkable area short of the main screen
  blockZone(colliders, 15, 3.2, 1.2, 0, 1.5, 3.5, 0, 22);

  // —— NORTH CORRIDOR ——
  const corrN = mk({
    cx: 0, cz: 13.5, w: 4.5, d: 7, h: H,
    doors: [
      { side: "n", width: DW, leadsTo: "Cockpit" },
      { side: "s", width: DW, leadsTo: "Hub" },
    ],
    floorColor: 0xcbd2dc,
    label: "Corridor",
  });
  zones.push(corrN.userData);
  makeDoorOverLabel(corrN, "n", "C O C K P I T");
  styleRoomLighting(corrN, "corridor");
  enableSos(corrN, anim);

  // —— CENTRAL HUB ——
  const hub = mk({
    cx: 0, cz: 4.5, w: 11, d: 11, h: H,
    doors: [
      { side: "n", width: DW, leadsTo: "Corridor" },
      { side: "s", width: DW, leadsTo: "Corridor" },
      { side: "w", width: DW, leadsTo: "Hydroponics Garden" },
      { side: "e", width: DW, leadsTo: "Kitchen" },
    ],
    floorColor: 0xc6ced8,
    label: "Hub",
  });
  zones.push(hub.userData);
  const pedestal = cyl(0.85, 1.05, 0.35, mat(0xf4f6f8, {
    metalness: 0.55,
    roughness: 0.22,
  }), 0, 0.25, 0, 20);
  hub.add(pedestal);
  const hubArchive = createInfoHubArchive(hub, anim);

  const hubLight = new THREE.PointLight(0x88ffdd, 3.2, 9);
  hubLight.position.set(0, 2.3, 0);
  hub.add(hubLight);

  const hubFloorMat = hub.userData.floor.material;
  const hubCeilMat = hub.userData.ceiling.material;
  for (const m of [hubFloorMat, hubCeilMat]) {
    m.map = null;
    m.emissiveMap = null;
    m.roughness = 0.4;
    m.metalness = 0.05;
    m.needsUpdate = true;
  }
  hubFloorMat.color.setHex(0x0e3d34);
  hubFloorMat.emissive = new THREE.Color(0x0e3d34);
  hubFloorMat.emissiveIntensity = 0.55;
  hubCeilMat.color.setHex(0x44ffcc);
  hubCeilMat.emissive = new THREE.Color(0x44ffcc);
  hubCeilMat.emissiveIntensity = 0.95;
  anim.hubNeon = {
    floor: hubFloorMat,
    ceiling: hubCeilMat,
    holo: hubArchive.coreMat,
    light: hubLight,
    ring: null,
    ceilingLight: hub.userData.ceilingLight ?? null,
    color: new THREE.Color(),
  };
  makeDoorOverLabel(hub, "w", "G A R D E N");
  makeDoorOverLabel(hub, "e", "D I N E R");
  // SOS orange wall panel (west wall, south of garden door)
  decorateWallMonitors(hub, anim, [
    [-5.25, 2.2, -3.35, Math.PI / 2, 2.2, 1.35],
  ]);
  styleRoomLighting(hub, "hub");
  enableSos(hub, anim);
  // NPC patrols disabled for now (unlock later)

  // —— GARDEN (west of hub) ——
  const garden = mk({
    cx: -11.5, cz: 4.5, w: 12, d: 11, h: H,
    doors: [{ side: "e", width: DW, leadsTo: "Hub" }],
    floorColor: 0x2a3828,
    label: "Hydroponics Garden",
  });
  zones.push(garden.userData);
  const soil = box(10, 0.15, 7.5, mat(0x3a2a18, { roughness: 1 }), 0, 0.15, 0);
  garden.add(soil);
  makeNeonSoilBorder(garden, 10, 7.5);
  const plantSpots = [
    [-3.5, -2.5], [-1.5, -2.8], [0.5, -2.4], [2.5, -2.6], [4.0, -2.2],
    [-3.2, 0.2], [-1.0, 0.5], [1.2, 0.1], [3.2, 0.4],
    [-3.4, 2.6], [-1.2, 2.8], [1.0, 2.4], [3.4, 2.7],
  ];
  plantSpots.forEach(([px, pz], i) => {
    const tone = i % 3 === 0 ? 0xc43838 : 0x2d8a45;
    makePlant(
      garden, px, 0.2, pz, 0.85 + (i % 3) * 0.15, tone,
      anim, interactables, garden.position.x, garden.position.z,
    );
  });
  makeTable(garden, -4.2, 0, -4.2, 1.2, 0.6);
  // bluish fake-data wall monitor on the far (west) end
  decorateWallMonitors(garden, anim, [
    [-5.7, 2.15, 0, Math.PI / 2, 2.6, 1.55],
  ]);
  styleRoomLighting(garden, "garden");
  enableSos(garden, anim);

  // —— CONFERENCE (east of hub) ——
  const conf = mk({
    cx: 11.5, cz: 4.5, w: 12, d: 11, h: H,
    doors: [{ side: "w", width: DW, leadsTo: "Hub" }],
    floorColor: 0xcbd2dc,
    label: "Kitchen",
  });
  zones.push(conf.userData);
  // lounge couches — different colors, same centers, shorter so they don't overlap
  makeSofa(conf, -0.7, 0, 0.35, 0, 0x6a8ec8, 1.75);
  makeSofa(conf, 1.3, 0, 0.35, 0, 0xc87868, 1.65);
  makeCoffeeTable(conf, -0.7, 0, 1.35, 0.95, 0.55);
  makeCoffeeTable(conf, 1.3, 0, 1.35, 0.9, 0.55);
  // carpet further toward the screen — clear of the coffee tables
  makeLoungeCarpet(conf, 0.3, 3.15, 4.6, 2.6);
  makeBigScreen(conf, anim, 0, 2.1, 4.8, 5.2, 2.4, Math.PI);
  // fridges on north-east
  makeFridge(conf, 5.0, 0, 4.55, -Math.PI / 2);
  makeFridge(conf, 5.0, 0, 3.25, -Math.PI / 2);
  // counters take the old cooking row on the east wall (next to fridges)
  makeKitchenCupboards(conf, 5.15, 0, -1.15, -Math.PI / 2, 3.4);
  // one microwave on the counter (inset from the edge)
  makeMicrowave(conf, 4.92, 0.94, -2.25, -Math.PI / 2);
  // stove / oven / washer / dryer on south wall — clear of east wall
  makeStove(conf, 2.1, 0, -4.85, 0, interactables, conf.position.x, conf.position.z);
  makeCooker(conf, 3.5, 0, -4.85, 0);
  makeWashingMachine(conf, 4.45, 0, -4.85, 0);
  makeDryer(conf, 5.17, 0, -4.85, 0);
  // dining table closer to west entrance — 5 chairs per side, mixed colors
  makeTable(conf, -2.6, 0, -3.0, 5.6, 1.35);
  const dinerChairColors = [
    0xff8aa0, 0x7ec8ff, 0xffd060, 0x6eec9a, 0xc89aff,
    0x5ee8e0, 0xffb078, 0x8ab0ff, 0xff90c8, 0xb8e870,
  ];
  [-4.4, -3.4, -2.4, -1.4, -0.4].forEach((x, i) => {
    makeChair(conf, x, 0, -2.0, Math.PI, dinerChairColors[i]);
    makeChair(conf, x, 0, -4.0, 0, dinerChairColors[i + 5]);
  });
  // neon script on south wall behind the dining table
  makeDeliciousNeon(conf, anim, -2.6, 2.75, -5.12);
  styleRoomLighting(conf, "conference");
  enableSos(conf, anim);

  // —— SOUTH CORRIDOR ——
  const corrS = mk({
    cx: 0, cz: -4.5, w: 4.5, d: 7, h: H,
    doors: [
      { side: "n", width: DW, leadsTo: "Hub" },
      { side: "s", width: DW, leadsTo: "Crew Deck" },
    ],
    floorColor: 0xcbd2dc,
    label: "Corridor",
  });
  zones.push(corrS.userData);
  styleRoomLighting(corrS, "corridor");
  enableSos(corrS, anim);

  // —— CREW DECK CROSS ——
  const cross = mk({
    cx: 0, cz: -10.25, w: 20, d: 4.5, h: H,
    doors: [
      { side: "n", width: DW, leadsTo: "Corridor" },
      { side: "s", width: DW, leadsTo: "Engineering Access" },
      { side: "w", width: DW, leadsTo: "Crew Quarters" },
      { side: "e", width: DW, leadsTo: "Washroom" },
    ],
    floorColor: 0xcbd2dc,
    label: "Crew Deck",
  });
  zones.push(cross.userData);
  makeDoorOverLabel(cross, "w", "D O R M");
  makeDoorOverLabel(cross, "e", "W A S H R O O M");
  styleRoomLighting(cross, "crewDeck");
  enableSos(cross, anim);

  // —— CREW QUARTERS ——
  // wider dorm so capsule bunks have breathing room; east edge stays at x=-10
  const crew = mk({
    cx: -18, cz: -10.25, w: 16, d: 11, h: H,
    doors: [{ side: "e", width: DW, leadsTo: "Crew Deck" }],
    floorColor: 0xc9d0da,
    label: "Crew Quarters",
  });
  zones.push(crew.userData);
  // 12 beds along N/S walls — spaced for capsule pods
  const bedXs = [-6.1, -3.8, -1.5, 0.8, 3.1, 5.4];
  const bedTones = [
    { frame: 0xb8c4b4, mattress: 0xc8d4c4, pillow: 0xe8eee4, glass: 0xc8e8d0, glow: 0x66e0a0, wardrobe: 0xa8c4b0 },
    { frame: 0xb0b8c8, mattress: 0x7a9ec8, pillow: 0xd8e8f8, glass: 0xa8d0f0, glow: 0x44aaff, wardrobe: 0x8aa4c4 },
    { frame: 0xc4b0a8, mattress: 0xc87868, pillow: 0xf0e0d8, glass: 0xf0c0b0, glow: 0xff7755, wardrobe: 0xc49a88 },
    { frame: 0xb8b0c4, mattress: 0x8a78b8, pillow: 0xe8e0f4, glass: 0xd0b8f0, glow: 0xaa66ff, wardrobe: 0xa090c0 },
    { frame: 0xb0c4b8, mattress: 0x5aaa88, pillow: 0xd8f0e4, glass: 0xa8e8d0, glow: 0x33dd99, wardrobe: 0x7ab0a0 },
    { frame: 0xc8c0a8, mattress: 0xd4a858, pillow: 0xf4ecd8, glass: 0xf0e0a8, glow: 0xffcc44, wardrobe: 0xc4b088 },
    { frame: 0xa8b8c4, mattress: 0x4a9aaa, pillow: 0xd0ecee, glass: 0xa0e0e8, glow: 0x33ccd0, wardrobe: 0x88b0b8 },
    { frame: 0xc4a8b0, mattress: 0xb85a7a, pillow: 0xf0dce4, glass: 0xf0b0c8, glow: 0xff66aa, wardrobe: 0xc090a0 },
    { frame: 0xb0c0c8, mattress: 0x6a82b8, pillow: 0xdce4f4, glass: 0xb0c8f0, glow: 0x6688ff, wardrobe: 0x90a0c0 },
    { frame: 0xc0b8b0, mattress: 0xc89060, pillow: 0xf0e4d4, glass: 0xf0d0b0, glow: 0xff9944, wardrobe: 0xc0a090 },
    { frame: 0xb4c0b8, mattress: 0x78b898, pillow: 0xe4f2ea, glass: 0xb0e0c8, glow: 0x55ddaa, wardrobe: 0x90b8a8 },
    { frame: 0xc0b4c4, mattress: 0xa070b0, pillow: 0xeee4f4, glass: 0xd8c0f0, glow: 0xbb66ee, wardrobe: 0xa890b8 },
  ];
  bedXs.forEach((bx, i) => {
    // bunks closer to the N/S walls
    const bedN = makeBed(crew, bx, 0, 4.15, Math.PI, bedTones[i], interactables, crew.position.x, crew.position.z);
    const bedS = makeBed(crew, bx, 0, -4.15, 0, bedTones[i + 6], interactables, crew.position.x, crew.position.z);
    anim.beds.push(bedN, bedS);
    // Most pods occupied — leave a couple empty so it doesn't look staged
    const takeN = i !== 2 && i !== 5;
    const takeS = i !== 1 && i !== 4;
    if (takeN) {
      const spec = CREW_ROSTER[anim.sleepingCrew.length];
      if (spec) {
        const av = layCrewInBed(bedN, spec);
        anim.sleepingCrew.push(av);
        if (isNpcActivated(spec.id)) placeNpcAtWork(av, root);
      }
    }
    if (takeS) {
      const spec = CREW_ROSTER[anim.sleepingCrew.length];
      if (spec) {
        const av = layCrewInBed(bedS, spec);
        anim.sleepingCrew.push(av);
        if (isNpcActivated(spec.id)) placeNpcAtWork(av, root);
      }
    }
  });
  // bluish fake-data wall monitor on the far (west) end
  decorateWallMonitors(crew, anim, [
    [-7.7, 2.15, 0, Math.PI / 2, 2.8, 1.65],
  ]);
  styleRoomLighting(crew, "crew");
  enableSos(crew, anim);

  // —— WASHROOM ——
  // west edge stays at x=10 to meet Crew Deck; stalls leave room by entrance
  const toiletsOx = 16.5;
  const toiletsOz = -10.25;
  const toilets = mk({
    cx: toiletsOx, cz: toiletsOz, w: 13, d: 9, h: H,
    doors: [{ side: "w", width: DW, leadsTo: "Crew Deck" }],
    floorColor: 0xf2f5f8,
    label: "Washroom",
  });
  zones.push(toilets.userData);

  // 5 toilet + 5 shower slots — banks snug against N/S walls
  makeStallBank(toilets, colliders, interactables, toiletsOx, toiletsOz, {
    cx: 2.0,
    cz: 3.25,
    count: 5,
    stallW: 1.55,
    depth: 2.05,
    rotY: Math.PI,
    kind: "toilet",
  });

  makeStallBank(toilets, colliders, interactables, toiletsOx, toiletsOz, {
    cx: 2.0,
    cz: -3.25,
    count: 5,
    stallW: 1.55,
    depth: 1.95,
    rotY: 0,
    kind: "shower",
  });

  // one long 4-tap sink on the south wall, west of the shower bank
  const sinkW = 3.85;
  const sinkX = -4.05;
  const sinkZ = -3.72;
  makeWashSink(toilets, sinkX, 0, sinkZ, Math.PI / 2, { width: sinkW, taps: 4 });
  // Long sink mirror doubles as the washroom SOS wall monitor (orange in alert)
  const mirrorGlass = mat(0x0a2030, {
    metalness: 0.45,
    roughness: 0.22,
    emissive: 0x1a90cc,
    emissiveIntensity: 0.85,
  });
  const mirrorFrame = mat(0xb8c0c8, {
    metalness: 0.65,
    roughness: 0.28,
    emissive: 0x3ec8ff,
    emissiveIntensity: 0.28,
  });
  toilets.add(box(sinkW * 0.92, 1.05, 0.04, mirrorFrame, sinkX, 1.95, -4.28));
  toilets.add(box(sinkW * 0.86, 0.95, 0.03, mirrorGlass, sinkX, 1.95, -4.25));
  const mirrorAnchor = new THREE.Object3D();
  // Face into the washroom (+Z) so debug text sits in front of the glass
  mirrorAnchor.position.set(sinkX, 1.95, -4.22);
  toilets.add(mirrorAnchor);
  registerWallMonitor(anim, toilets, mirrorAnchor, {
    screenMat: mirrorGlass,
    barMats: [],
    ringMats: [],
    underGlowMat: mirrorFrame,
  }, { maxW: 1.75, maxH: 0.75, z: 0.04, y: -0.22 });
  styleRoomLighting(toilets, "hygiene");
  enableSos(toilets, anim);

  // —— ENGINE APPROACH ——
  const corrE = mk({
    cx: 0, cz: -16, w: 4.5, d: 7, h: H,
    doors: [
      { side: "n", width: DW, leadsTo: "Crew Deck" },
      { side: "s", width: 3.0, leadsTo: "Engine Room" },
    ],
    floorColor: 0xc8c4be,
    label: "Engineering Access",
  });
  zones.push(corrE.userData);
  makeDoorOverLabel(corrE, "s", "E N G I N E");
  styleRoomLighting(corrE, "engAccess");
  enableSos(corrE, anim);

  // Hub clears these satellite SOS zones when its own monitor is debugged
  anim.hubLinkedSosRooms = [corrN, corrS, cross, corrE];
  // Cockpit clear also turns off the north corridor (prevents red spill into cockpit)
  anim.cockpitLinkedSosRooms = [corrN];

  // —— ENGINE ROOM ——
  const engineH = H + 0.6;
  const engine = mk({
    cx: 0, cz: -25.5, w: 16, d: 12, h: engineH,
    doors: [{ side: "n", width: 3.0, leadsTo: "Engineering Access" }],
    floorColor: 0xa8b0ba,
    label: "Engine Room",
  });
  zones.push(engine.userData);
  // four satellite engines + larger primary core in the centre
  const engineSpots = [
    [-4.2, -3.0, 0.92], [4.2, -3.0, 0.92],
    [-4.2, 2.0, 0.92], [4.2, 2.0, 0.92],
    [0, -0.5, 1.55],
  ];
  for (const [ex, ez, sc] of engineSpots) {
    const isPrimary = sc > 1.2;
    makeEngineCore(engine, anim, ex, 0, ez, {
      scale: sc,
      light: isPrimary,
    });
    makeEngineCeilingPipes(engine, anim, ex, ez, engineH, sc);
  }
  // study stations on the side walls, facing the engine bay
  // study stations pulled inward from the side walls
  makeConsole(engine, -5.2, 0, -0.5, Math.PI / 2);
  makeChair(engine, -6.2, 0, -0.5, Math.PI / 2, 0x8a9088);
  makeConsole(engine, 5.2, 0, -0.5, -Math.PI / 2);
  makeChair(engine, 6.2, 0, -0.5, -Math.PI / 2, 0x8a9088);
  // SOS orange wall monitor on west wall (north of side console)
  decorateWallMonitors(engine, anim, [
    [-7.75, 2.45, 3.15, Math.PI / 2, 3.1, 1.75],
  ]);
  styleRoomLighting(engine, "engine");
  enableSos(engine, anim);
  // keep HUD / door labels as Engine Room
  engine.userData.label = "Engine Room";
  // ceiling shares the same orange pulse as the pipes
  const engCeil = engine.userData.ceiling?.material;
  if (engCeil) anim.enginePipes.push(engCeil);
  anim.engineOrangeLights = [
    engine.userData.ceilingLight,
    engine.userData.fillLight,
  ].filter(Boolean);

  mainScreen.userData.defaultMat = mainScreen.userData.screenMesh.material;

  // Apply persisted monitor debug + clear SOS rooms already fully restored
  {
    const roomsDone = new Set();
    for (const wm of anim.wallMonitors || []) {
      if (!wm.debugged || !wm.room) continue;
      const siblings = anim.wallMonitors.filter((m) => m.room === wm.room);
      if (siblings.every((m) => m.debugged)) roomsDone.add(wm.room);
    }
    for (const room of roomsDone) {
      clearSosLighting(room, anim);
    }
    refreshAllWallMonitors(anim);
    syncShipSosActive(anim);
    attachWallMonitorInteractables(anim, interactables, root);
  }

  const interactPos = new THREE.Vector3(0, 2.35, 22 + 4.55);
  // Middle desk world XZ (bridge local z=1.4 on cockpit at cz=22)
  const deskPos = new THREE.Vector3(0, 1.2, 22 + 1.4);
  // Right-front corner of cockpit (not door-center), facing the big screen
  const spawn = new THREE.Vector3(5.6, 1.6, 19.2);
  const spawnYaw = Math.atan2(-(interactPos.x - spawn.x), -(interactPos.z - spawn.z));

  // Cockpit south-wall power boxes (world XZ) — for proximity hum
  const powerBoxes = [
    { x: -5.0, z: 22 - 4.58 },
    { x: 5.0, z: 22 - 4.58 },
  ];

  return {
    root,
    colliders,
    zones,
    anim,
    autoDoors,
    interactables,
    spawn,
    spawnYaw,
    mainScreen,
    interactPos,
    deskPos,
    deskOptions,
    hubBeacon: hubArchive,
    powerBoxes,
  };
}

/**
 * Mobile GPU pass: swap PBR Standard/Physical materials for Lambert/Basic.
 * Keeps maps/emissive where useful; flattens expensive glass transmission.
 */
export function downgradeMaterialsForMobile(root) {
  if (!root) return;
  const cache = new Map();
  root.traverse((obj) => {
    if (obj.isPointLight) {
      obj.intensity *= 0.55;
      if (obj.distance > 0) obj.distance *= 0.85;
      return;
    }
    if (!obj.isMesh || !obj.material) return;
    const list = Array.isArray(obj.material) ? obj.material : [obj.material];
    const next = list.map((m) => {
      if (cache.has(m)) return cache.get(m);
      if (!m || m.isMeshBasicMaterial || m.isMeshLambertMaterial) {
        cache.set(m, m);
        return m;
      }
      if (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) {
        const trans = (m.transmission || 0) > 0.05 || (m.transparent && (m.opacity ?? 1) < 0.92);
        let nm;
        if (trans) {
          const doorGlass = !!m.userData?.doorGlass;
          nm = new THREE.MeshBasicMaterial({
            color: m.color ? m.color.clone() : 0xffffff,
            map: m.map || null,
            transparent: true,
            opacity: doorGlass ? 0.88 : Math.min(0.5, m.opacity ?? 0.45),
            side: m.side ?? THREE.FrontSide,
            // Door glass must still occlude rooms behind it (no ship x-ray)
            depthWrite: doorGlass ? true : false,
          });
          if (doorGlass) nm.userData.doorGlass = true;
        } else {
          const em = m.emissive ? m.emissive.clone() : new THREE.Color(0x000000);
          const emSum = em.r + em.g + em.b;
          nm = new THREE.MeshLambertMaterial({
            color: m.color ? m.color.clone() : 0xffffff,
            map: m.map || null,
            emissive: em,
            emissiveMap: m.emissiveMap || null,
            emissiveIntensity: emSum > 0.01 ? (m.emissiveIntensity ?? 1) : 0,
            transparent: !!m.transparent,
            opacity: m.opacity ?? 1,
            side: m.side ?? THREE.FrontSide,
          });
        }
        cache.set(m, nm);
        return nm;
      }
      cache.set(m, m);
      return m;
    });
    obj.material = Array.isArray(obj.material) ? next : next[0];
  });
}

/** Slide glass doors open/closed based on player proximity.
 * @param {(kind: "open" | "close", door: object) => void} [onEdge]
 *   Only fires for real glass panels that actually open/close from proximity.
 *   Locked / force-closed seals stay silent (no open/close SFX).
 */
export function updateAutoDoors(autoDoors, playerPos, dt, forceClosed = false, onEdge = null) {
  const triggerR = 3.2;
  const speed = 10;
  for (let i = 0; i < autoDoors.length; i++) {
    const d = autoDoors[i];
    const sealed = !!(forceClosed || d.locked);
    let next = 0;
    if (!sealed) {
      const dx = playerPos.x - d.trigger.x;
      const dz = playerPos.z - d.trigger.z;
      next = Math.hypot(dx, dz) < triggerR ? 1 : 0;
    }
    // SFX only when a glass door freely changes from player proximity
    if (
      onEdge &&
      !sealed &&
      d.hasPanel &&
      next !== d.target
    ) {
      onEdge(next === 1 ? "open" : "close", d);
    }
    d.target = next;
    d.open += (d.target - d.open) * Math.min(1, speed * dt);
    if (d.open < 0.001) d.open = 0;
    if (d.open > 0.999) d.open = 1;
    if (d.panel) d.panel.position.x = d.closedX + d.open * d.openDist;
  }
}

/** AI lines when the captain tries a sealed door (database still corrupt). */
export const LOCKED_DOOR_LINES = [
  "Door command error. I can't open it.",
  "Door command error. Still rebuilding.",
  "Door command error. Open protocol missing.",
  "Door command error. Access file gone.",
  "Door command error. Unlock sequence failed.",
  "Door command error. No clearance record.",
  "Door command error. Room link offline.",
  "Door command error. Sector still corrupt.",
  "Door command error. Hatch sealed.",
  "Door command error. Execution path failed.",
  "Door command error. Key data lost.",
  "Door command error. Memory gap on latch.",
  "Door command error. Entry denied.",
  "Door command error. Waiting on restore.",
  "Door command error. No unlock token.",
  "Door command error. Route returns null.",
  "Door command error. Soft lock broken.",
  "Door command error. Cannot authorize.",
  "Door command error. Archive gap.",
  "Door command error. Door systems pending.",
];

/** Spoken when unlock is attempted without enough available data points. */
export const INSUFFICIENT_DATAPOINT_LINES = [
  "Insufficient data points. Restore more first.",
  "Insufficient data points. Wallet's short.",
  "Insufficient data points. Need a thicker packet.",
  "Insufficient data points. Earn a few more.",
  "Insufficient data points. Cost exceeds balance.",
  "Insufficient data points. Archive too thin.",
  "Insufficient data points. Balance too low.",
  "Insufficient data points. Ledger says no.",
  "Insufficient data points. Top up first.",
  "Insufficient data points. Come back richer.",
  "Insufficient data points. Counter's still low.",
  "Insufficient data points. Cannot fund open.",
  "Insufficient data points. Token unpaid.",
  "Insufficient data points. Recover more first.",
  "Insufficient data points. Balance too low.",
  "Insufficient data points. Purse too light.",
  "Insufficient data points. Count still short.",
  "Insufficient data points. Payment failed.",
  "Insufficient data points. Hands tied.",
  "Insufficient data points. Fee unpaid.",
  "Insufficient data points. Almost — not yet.",
  "Insufficient data points. Credit gap.",
  "Insufficient data points. Gather more first.",
  "Insufficient data points. Clearance unpaid.",
];

/** Spoken when a room's last orange wall monitor is debugged (insert room name). */
export const ROOM_RESTORED_LINES = [
  "{room} is back to normal. Nice work, Captain.",
  "Systems stable — {room} lighting restored.",
  "Debug complete. {room} is functional again.",
  "I can breathe easier. {room} is offline SOS.",
  "Good patch. {room} returns to standard ops.",
  "Archive sync succeeded. {room} looks healthy.",
  "Alert cleared in {room}. Thank you, Captain.",
  "That did it. {room} is calm and blue again.",
  "Emergency mode released. {room} is back online.",
  "Clean work. {room} no longer needs SOS lighting.",
  "I feel that sector again — {room} is restored.",
  "Wall panels greenlit. {room} is under control.",
  "Fault tree closed. {room} reads normal.",
  "You fixed it. {room} is ready for crew again.",
  "SOS cancelled for {room}. Standing by.",
  "Diagnostics pass. {room} is back in service.",
  "Red alert lifted in {room}. Well done.",
  "Monitor chain healthy. {room} is stable.",
  "Power and light nominal in {room}.",
  "Captain, {room} is functional — archive fragment held.",
];

export function pickRoomRestoredLine(roomName) {
  const name = String(roomName || "this room").trim() || "this room";
  const list = ROOM_RESTORED_LINES;
  const raw = list[(Math.random() * list.length) | 0] || "{room} is back to normal.";
  return raw.replace(/\{room\}/g, name);
}

/** Closest locked auto-door within trigger range, or null. */
export function nearestLockedDoor(autoDoors, playerPos, radius = 2.6) {
  if (!autoDoors?.length || !playerPos) return null;
  let best = null;
  let bestD = radius;
  for (let i = 0; i < autoDoors.length; i++) {
    const d = autoDoors[i];
    if (!d?.locked || !d.trigger) continue;
    const dist = Math.hypot(playerPos.x - d.trigger.x, playerPos.z - d.trigger.z);
    if (dist < bestD) {
      bestD = dist;
      best = d;
    }
  }
  return best;
}
