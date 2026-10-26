'use strict';

/* ---------------------------------------------------------------
   火柴人骨架与铅笔绘制
   角度约定：0° 朝前（+x），90° 朝下（+y），-90° 朝上
   --------------------------------------------------------------- */

const TORSO = 42;
const HEAD_OFF = 21;
const HEAD_R = 12.5;
const ARM = 26;
const LEG = 36;

function P(o) {
  return Object.assign({
    hipH: 64,
    lean: 7,
    headTilt: 0,
    hipShift: 0,
    rot: 0,
    armB: [104, -62],
    armF: [64, -64],
    legB: [108, 96],
    legF: [76, 92],
    eye: 'normal'
  }, o);
}

function mixPose(a, b, k) {
  const arr = (x, y) => [lerp(x[0], y[0], k), lerp(x[1], y[1], k)];
  return {
    hipH: lerp(a.hipH, b.hipH, k),
    lean: lerp(a.lean, b.lean, k),
    headTilt: lerp(a.headTilt, b.headTilt, k),
    hipShift: lerp(a.hipShift, b.hipShift, k),
    rot: lerp(a.rot || 0, b.rot || 0, k),
    armB: arr(a.armB, b.armB),
    armF: arr(a.armF, b.armF),
    legB: arr(a.legB, b.legB),
    legF: arr(a.legF, b.legF),
    eye: k < 0.5 ? a.eye : b.eye
  };
}

function clonePose(a) {
  return {
    hipH: a.hipH,
    lean: a.lean,
    headTilt: a.headTilt,
    hipShift: a.hipShift,
    rot: a.rot || 0,
    armB: [a.armB[0], a.armB[1]],
    armF: [a.armF[0], a.armF[1]],
    legB: [a.legB[0], a.legB[1]],
    legF: [a.legF[0], a.legF[1]],
    eye: a.eye
  };
}

function samplePose(keys, t) {
  if (!keys || !keys.length) return P();
  if (t <= keys[0][0]) return clonePose(keys[0][1]);
  for (let i = 1; i < keys.length; i++) {
    const [t0, p0] = keys[i - 1];
    const [t1, p1] = keys[i];
    if (t <= t1) {
      const span = t1 - t0 || 1;
      return mixPose(p0, p1, easeInOutQuad((t - t0) / span));
    }
  }
  return clonePose(keys[keys.length - 1][1]);
}

function computeSkeleton(p) {
  const hip = { x: p.hipShift, y: -p.hipH };
  const lean = p.lean * D2R;
  const chest = {
    x: hip.x + Math.sin(lean) * TORSO,
    y: hip.y - Math.cos(lean) * TORSO
  };
  const headAng = lean + p.headTilt * D2R;
  const head = {
    x: chest.x + Math.sin(headAng) * HEAD_OFF,
    y: chest.y - Math.cos(headAng) * HEAD_OFF
  };
  const shoulder = { x: chest.x, y: chest.y + 2 };

  const limb = (origin, a1, len1, a2, len2) => {
    const a = a1 * D2R, b = a2 * D2R;
    const mid = { x: origin.x + Math.cos(a) * len1, y: origin.y + Math.sin(a) * len1 };
    const end = { x: mid.x + Math.cos(b) * len2, y: mid.y + Math.sin(b) * len2 };
    return { mid, end, a2 };
  };

  return {
    hip,
    chest,
    shoulder,
    head,
    headR: HEAD_R,
    armB: limb(shoulder, p.armB[0], ARM, p.armB[1], ARM),
    armF: limb(shoulder, p.armF[0], ARM, p.armF[1], ARM),
    legB: limb(hip, p.legB[0], LEG, p.legB[1], LEG),
    legF: limb(hip, p.legF[0], LEG, p.legF[1], LEG)
  };
}

function drawLimb(ctx, origin, mid, end, color, width, alpha, foot, isArm) {
  pencilPath(ctx, [origin, mid, end], { color, width, alpha, jitter: 1.0 });
  if (isArm) {
    inkDot(ctx, end.x, end.y, 1.7, color, alpha * 0.9);
  } else if (foot) {
    const fa = (foot.a2 - 90) * 0.5 * D2R;
    const tox = end.x + Math.cos(fa) * 9;
    const toy = end.y + Math.sin(fa) * 9;
    pencilPath(ctx, [end, { x: tox, y: toy }], { color, width: width * 0.9, alpha, jitter: 0.7 });
  }
}

function drawFace(ctx, sk, pose, blink, color, alpha) {
  const h = sk.head;
  const ex1 = h.x + 1;
  const ex2 = h.x + 7.5;
  const ey = h.y - 1.5;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.7;
  ctx.lineCap = 'round';

  if (pose.eye === 'ko') {
    for (const ex of [ex1, ex2]) {
      ctx.beginPath();
      ctx.moveTo(ex - 2.2, ey - 2.2);
      ctx.lineTo(ex + 2.2, ey + 2.2);
      ctx.moveTo(ex + 2.2, ey - 2.2);
      ctx.lineTo(ex - 2.2, ey + 2.2);
      ctx.stroke();
    }
  } else if (pose.eye === 'happy') {
    for (const ex of [ex1, ex2]) {
      ctx.beginPath();
      ctx.arc(ex, ey + 1, 2.4, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }
  } else if (blink) {
    ctx.beginPath();
    ctx.moveTo(ex1 - 2, ey);
    ctx.lineTo(ex1 + 2, ey);
    ctx.moveTo(ex2 - 2, ey);
    ctx.lineTo(ex2 + 2, ey);
    ctx.stroke();
  } else if (pose.eye === 'angry') {
    for (const ex of [ex1, ex2]) inkDot(ctx, ex, ey, 1.5, color, alpha);
    ctx.beginPath();
    ctx.moveTo(ex1 - 2.6, ey - 5);
    ctx.lineTo(ex1 + 2.6, ey - 3.2);
    ctx.moveTo(ex2 - 2.6, ey - 3.2);
    ctx.lineTo(ex2 + 2.6, ey - 5);
    ctx.stroke();
  } else {
    inkDot(ctx, ex1, ey, 1.35, color, alpha);
    inkDot(ctx, ex2, ey, 1.35, color, alpha);
  }

  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (pose.eye === 'ko') {
    ctx.moveTo(h.x + 1, h.y + 5.5);
    ctx.quadraticCurveTo(h.x + 4, h.y + 3.5, h.x + 7, h.y + 6);
    ctx.quadraticCurveTo(h.x + 4, h.y + 7.5, h.x + 1, h.y + 5.5);
    ctx.stroke();
  } else if (pose.eye === 'happy') {
    ctx.moveTo(h.x + 1.5, h.y + 4.5);
    ctx.quadraticCurveTo(h.x + 4.5, h.y + 8.5, h.x + 7.5, h.y + 4.5);
    ctx.stroke();
  } else if (pose.eye === 'angry') {
    ctx.moveTo(h.x + 1.5, h.y + 6.5);
    ctx.lineTo(h.x + 7.5, h.y + 6);
    ctx.stroke();
  } else {
    ctx.moveTo(h.x + 2.5, h.y + 5.5);
    ctx.quadraticCurveTo(h.x + 4.5, h.y + 7, h.x + 6.5, h.y + 5.5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawEraserHat(ctx, sk, color, alpha) {
  const h = sk.head;
  ctx.save();
  ctx.translate(h.x + 1, h.y - HEAD_R + 1);
  ctx.rotate(-0.16);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(242,235,215,.95)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  roundRectPath(ctx, -8.5, -9, 18, 9, 2.5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(190,98,83,.9)';
  ctx.fillRect(-2, -9, 4, 9);
  ctx.globalAlpha = alpha * 0.5;
  ctx.strokeStyle = '#7b4a40';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-7, -6.5);
  ctx.lineTo(-3, -6.5);
  ctx.stroke();
  ctx.restore();
}

function drawHair(ctx, sk, color, alpha) {
  const h = sk.head;
  pencilPath(ctx, [
    [h.x - 3, h.y - HEAD_R + 2],
    [h.x - 5, h.y - HEAD_R - 6],
    [h.x - 0.5, h.y - HEAD_R - 2],
    [h.x + 1.5, h.y - HEAD_R - 7]
  ], { color, width: 2.2, alpha, jitter: 1.1 });
}

function drawStickman(ctx, x, y, facing, pose, opt) {
  opt = opt || {};
  const color = opt.color || '#2b382c';
  const baseAlpha = opt.alpha == null ? 1 : opt.alpha;
  if (baseAlpha <= 0.005) return;
  const width = opt.width == null ? 1 : opt.width;
  const ghost = !!opt.ghost;
  const blink = !!opt.blink;

  const sk = computeSkeleton(pose);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing * 1.12, 1.12);
  if (pose.rot) ctx.rotate(pose.rot);
  ctx.globalAlpha = 1;

  const backA = baseAlpha * (ghost ? 0.28 : 0.55);
  const frontA = baseAlpha * (ghost ? 0.36 : 0.97);

  // 后腿 / 后臂
  drawLimb(ctx, sk.hip, sk.legB.mid, sk.legB.end, color, 2.7 * width, backA, sk.legB, false);
  drawLimb(ctx, sk.shoulder, sk.armB.mid, sk.armB.end, color, 2.5 * width, backA * 0.95, null, true);

  // 躯干
  pencilPath(ctx, [sk.hip, sk.chest], { color, width: 3.4 * width, alpha: frontA, jitter: 1.1 });
  pencilPath(ctx, [sk.chest, { x: sk.head.x, y: sk.head.y + HEAD_R * 0.72 }], {
    color, width: 2.3 * width, alpha: frontA * 0.85, jitter: 0.7
  });

  // 前腿 / 前臂
  drawLimb(ctx, sk.hip, sk.legF.mid, sk.legF.end, color, 2.8 * width, frontA, sk.legF, false);
  drawLimb(ctx, sk.shoulder, sk.armF.mid, sk.armF.end, color, 2.6 * width, frontA, null, true);

  // 头
  pencilEllipse(ctx, sk.head.x, sk.head.y, HEAD_R, HEAD_R * 1.04, {
    color,
    width: 2.8 * width,
    alpha: frontA,
    wobble: 0.06,
    n: 15
  });

  if (!ghost) {
    drawFace(ctx, sk, pose, blink, color, frontA);
    if (opt.style && opt.style.eraser) drawEraserHat(ctx, sk, color, frontA);
    if (opt.style && opt.style.hair) drawHair(ctx, sk, color, frontA * 0.9);
  }

  ctx.restore();
}

function drawFighterShadow(ctx, x, y, floor, color) {
  const air = clamp((floor - y) / 360, 0, 1);
  const k = 1 - air * 0.72;
  const rx = 43 * k;
  const ry = 8 * k;
  ctx.save();
  ctx.globalAlpha = 0.55;
  pencilEllipse(ctx, x, floor + 2, rx, ry, {
    color: color || '#2b382c',
    width: 1.6,
    alpha: 0.18,
    n: 10,
    wobble: 0.16,
    jitter: 1.2
  });
  // 几笔排线
  for (let i = 0; i < 5; i++) {
    const ox = (i / 4 - 0.5) * rx * 1.5;
    pencilPath(ctx, [
      [x + ox - 3, floor + 3],
      [x + ox + 7, floor - 1]
    ], { color: color || '#2b382c', width: 1.3, alpha: 0.13 + (i % 3) * 0.018, jitter: 0.8 });
  }
  ctx.restore();
}
