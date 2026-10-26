'use strict';

/* ---------------------------------------------------------------
   纸上决斗 — 基础工具 / 手绘笔触
   --------------------------------------------------------------- */

const TAU = Math.PI * 2;
const D2R = Math.PI / 180;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p) => Math.random() < p;
const sgn = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

function approach(v, target, step) {
  return v < target ? Math.min(v + step, target) : Math.max(v - step, target);
}

function easeOutCubic(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }
function easeOutQuint(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 5); }
function easeInOutQuad(t) {
  t = clamp(t, 0, 1);
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
function easeOutBack(t) {
  t = clamp(t, 0, 1);
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
function easeOutElastic(t) {
  t = clamp(t, 0, 1);
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1;
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HAND = '"Xingkai SC","Kaiti SC","STKaiti","KaiTi","Songti SC","Apple LiGothic",cursive';
const SCRATCH = '"Bradley Hand","Marker Felt","Chalkboard SE","Comic Sans MS",cursive';

/* 手绘线条的“沸腾”种子：每 90ms 换一次，线条会像翻页动画一样轻轻抖 */
const BOIL = { seed: 1234567, counter: 0, timer: 0 };
function kickBoil() {
  BOIL.seed = (Math.random() * 0xfffffff) | 0;
  BOIL.counter = 0;
}
function beginSketch() { BOIL.counter = 0; }
function jrng() {
  BOIL.counter++;
  return mulberry32((BOIL.seed ^ Math.imul(BOIL.counter, 0x9E3779B1)) >>> 0);
}

/* ---------------------------------------------------------------
   铅笔线条
   --------------------------------------------------------------- */

function pencilPath(ctx, pts, opt) {
  opt = opt || {};
  if (!pts || pts.length < 2) return;
  const color = opt.color || '#2d3a2f';
  const width = opt.width == null ? 2.4 : opt.width;
  const alpha = opt.alpha == null ? 0.92 : opt.alpha;
  const jitter = opt.jitter == null ? 1.1 : opt.jitter;
  const closed = !!opt.closed;
  if (width <= 0 || alpha <= 0) return;

  const rng = jrng();
  const p = new Array(pts.length);
  for (let i = 0; i < pts.length; i++) {
    const pt = pts[i];
    const x = Array.isArray(pt) ? pt[0] : pt.x;
    const y = Array.isArray(pt) ? pt[1] : pt.y;
    p[i] = { x: x + (rng() * 2 - 1) * jitter, y: y + (rng() * 2 - 1) * jitter };
  }

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;

  const stroke = (offX, offY, w, a) => {
    ctx.globalAlpha = alpha * a;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(p[0].x + offX, p[0].y + offY);
    for (let i = 1; i < p.length; i++) {
      const a0 = p[i - 1], b0 = p[i];
      const dx = b0.x - a0.x, dy = b0.y - a0.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const segs = Math.max(1, Math.round(len / 26));
      for (let s = 1; s <= segs; s++) {
        const t = s / segs;
        const j = s === segs && !closed ? 0 : (rng() * 2 - 1) * jitter * 0.45;
        ctx.lineTo(a0.x + dx * t + nx * j + offX, a0.y + dy * t + ny * j + offY);
      }
    }
    if (closed) ctx.closePath();
    ctx.stroke();
  };

  stroke(0, 0, width, 1);
  if (width >= 1.8) stroke(0.9, -0.7, width * 0.42, 0.35);
  ctx.restore();
}

function pencilEllipse(ctx, cx, cy, rx, ry, opt) {
  opt = opt || {};
  const n = opt.n || 15;
  const rng = jrng();
  const wob = opt.wobble == null ? 0.045 : opt.wobble;
  const start = rng() * TAU;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = start + (i / n) * TAU;
    const k = 1 + (rng() * 2 - 1) * wob;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  pencilPath(ctx, pts, Object.assign({}, opt, { closed: true, jitter: opt.jitter == null ? 0.5 : opt.jitter }));
}

function roughRect(ctx, x, y, w, h, opt) {
  const j = 0.6;
  const pts = [
    [x + rand(-j, j), y + rand(-j, j)],
    [x + w * 0.5 + rand(-j, j), y],
    [x + w + rand(-j, j), y + rand(-j, j)],
    [x + w, y + h * 0.5 + rand(-j, j)],
    [x + w + rand(-j, j), y + h + rand(-j, j)],
    [x + w * 0.5 + rand(-j, j), y + h],
    [x + rand(-j, j), y + h + rand(-j, j)],
    [x, y + h * 0.5 + rand(-j, j)]
  ];
  pencilPath(ctx, pts, Object.assign({ closed: true, jitter: 0.5 }, opt));
}

function hatchFill(ctx, x, y, w, h, opt) {
  opt = opt || {};
  const color = opt.color || '#2d3a2f';
  const alpha = opt.alpha == null ? 0.3 : opt.alpha;
  const gap = opt.gap || 8;
  const width = opt.width || 1.2;
  if (w <= 0 || h <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  const diag = w + h;
  for (let i = -h; i < diag; i += gap) {
    ctx.beginPath();
    ctx.moveTo(x + i, y + h + 2);
    ctx.lineTo(x + i + h + 4, y - 2);
    ctx.stroke();
  }
  ctx.restore();
}

function inkDot(ctx, x, y, r, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha == null ? 0.9 : alpha;
  ctx.fillStyle = color || '#2d3a2f';
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.92, rand(-0.3, 0.3), 0, TAU);
  ctx.fill();
  ctx.restore();
}

function sketchStar(ctx, x, y, r, spikes, opt) {
  opt = opt || {};
  const pts = [];
  const rng = jrng();
  const rot = opt.rot == null ? rng() * TAU : opt.rot;
  for (let i = 0; i < spikes * 2; i++) {
    const a = rot + (i / (spikes * 2)) * TAU;
    const rr = i % 2 === 0 ? r * (0.82 + rng() * 0.35) : r * (0.28 + rng() * 0.12);
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  pencilPath(ctx, pts, Object.assign({ closed: true, width: 2.4, jitter: 0.8 }, opt));
}

/* ---------------------------------------------------------------
   手写文字
   --------------------------------------------------------------- */

function handText(ctx, text, x, y, opt) {
  opt = opt || {};
  const size = opt.size || 24;
  const weight = opt.weight || 700;
  const family = opt.family || HAND;
  const alpha = opt.alpha == null ? 1 : opt.alpha;
  if (alpha <= 0.002) return;

  ctx.save();
  ctx.translate(x, y);
  if (opt.rot) ctx.rotate(opt.rot * D2R);
  if (opt.scale && opt.scale !== 1) ctx.scale(opt.scale, opt.scale);
  ctx.font = weight + ' ' + size + 'px ' + family;
  ctx.textAlign = opt.align || 'center';
  ctx.textBaseline = opt.baseline || 'middle';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const rng = jrng();
  const jx = opt.jitter == null ? 0.45 : opt.jitter;
  const dx = (rng() * 2 - 1) * jx;
  const dy = (rng() * 2 - 1) * jx;

  if (opt.outline) {
    ctx.globalAlpha = alpha * (opt.outlineAlpha == null ? 0.75 : opt.outlineAlpha);
    ctx.strokeStyle = opt.outline;
    ctx.lineWidth = opt.outlineWidth || Math.max(4, size * 0.1);
    ctx.strokeText(text, dx, dy);
  }

  ctx.globalAlpha = alpha;
  ctx.fillStyle = opt.color || '#2d3a2f';
  ctx.fillText(text, dx, dy);

  if (opt.ghost !== false) {
    ctx.globalAlpha = alpha * 0.32;
    ctx.fillText(text, dx + 1.1, dy + 1.0);
  }

  if (opt.underline) {
    const w = ctx.measureText(text).width;
    const half = ctx.textAlign === 'center' ? w / 2 : ctx.textAlign === 'right' ? w : 0;
    const y0 = size * 0.55;
    pencilPath(ctx, [
      [dx - half - 4, y0 + dy],
      [dx - half + w * 0.4, y0 + dy + 3],
      [dx - half + w + 5, y0 + dy - 1]
    ], { width: opt.underlineWidth || 3, alpha: alpha * 0.85, color: opt.underlineColor || '#8a3328', jitter: 1 });
  }

  ctx.restore();
}

function textWidth(ctx, text, size, weight, family) {
  ctx.save();
  ctx.font = (weight || 700) + ' ' + size + 'px ' + (family || HAND);
  const w = ctx.measureText(text).width;
  ctx.restore();
  return w;
}

/* ---------------------------------------------------------------
   杂项
   --------------------------------------------------------------- */

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function makeNoiseCanvas(w, h, base, fleck, amount) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  const rng = mulberry32(97531);
  g.globalAlpha = 0.5;
  for (let i = 0; i < amount; i++) {
    const x = rng() * w, y = rng() * h;
    const v = rng();
    g.fillStyle = v > 0.5 ? fleck : base;
    g.globalAlpha = 0.03 + rng() * 0.07;
    g.fillRect(x, y, 1 + rng() * 2, 1 + rng() * 2);
  }
  return c;
}
