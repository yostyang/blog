'use strict';

/* ---------------------------------------------------------------
   铅笔屑、爆点、拟声词、纸上的墨点
   --------------------------------------------------------------- */

const Effects = (() => {
  const INK = '#2b382c';
  const RED = '#7e2d24';
  const particles = [];
  const bursts = [];
  const words = [];
  const decals = [];

  function reset() {
    particles.length = 0;
    bursts.length = 0;
    words.length = 0;
    decals.length = 0;
  }

  function dust(x, y, n, dir, power) {
    n = n || 4;
    dir = dir || 0;
    power = power || 1;
    for (let i = 0; i < n; i++) {
      particles.push({
        type: 'dust',
        x: x + rand(-16, 16),
        y: y - rand(0, 8),
        vx: rand(-110, 110) + dir * 50,
        vy: -rand(40, 210) * power,
        g: 880,
        life: rand(0.25, 0.65),
        max: 0.65,
        size: rand(3, 8),
        rot: rand(0, TAU),
        spin: rand(-6, 6),
        color: INK
      });
    }
  }

  function specks(x, y, n, spread, power) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const sp = rand(60, 360) * (power || 1);
      particles.push({
        type: 'speck',
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 80,
        g: 1100,
        life: rand(0.2, 0.5),
        max: 0.5,
        size: rand(1.2, 2.8),
        rot: a,
        spin: 0,
        color: INK
      });
    }
  }

  function impact(x, y, power, facing) {
    const heavy = power >= 11;
    bursts.push({
      type: 'star',
      x, y,
      t: 0,
      dur: heavy ? 0.3 : 0.22,
      size: 19 + power * 1.45,
      seed: rand(0, 1e6) | 0,
      rot: rand(-0.5, 0.5),
      color: heavy && chance(0.45) ? RED : INK
    });
    bursts.push({
      type: 'ring',
      x, y,
      t: 0,
      dur: heavy ? 0.34 : 0.24,
      size: 13 + power * 1.1,
      seed: rand(0, 1e6) | 0,
      color: INK
    });
    specks(x, y, heavy ? 9 : 5, 1, heavy ? 1.3 : 1);
    dust(x, y + 42, heavy ? 7 : 4, facing || 0, heavy ? 1.2 : 0.9);

    if (heavy) {
      splat(x, y, 12 + power * 1.1);
      bursts.push({
        type: 'zig',
        x, y,
        t: 0,
        dur: 0.28,
        size: 22 + power * 1.1,
        seed: rand(0, 1e6) | 0,
        rot: rand(-0.35, 0.35),
        color: INK
      });
    }
  }

  function guard(x, y) {
    bursts.push({
      type: 'guard',
      x, y,
      t: 0,
      dur: 0.22,
      size: 22,
      seed: rand(0, 1e6) | 0,
      color: INK
    });
    for (let i = 0; i < 5; i++) {
      particles.push({
        type: 'spark',
        x, y,
        vx: rand(-140, 140),
        vy: rand(-160, 60),
        g: 700,
        life: rand(0.14, 0.3),
        max: 0.3,
        size: rand(4, 9),
        rot: rand(0, TAU),
        spin: 0,
        color: INK
      });
    }
  }

  function word(x, y, text, size, color, rot) {
    words.push({
      text,
      x: x + rand(-6, 6),
      y,
      t: 0,
      dur: 0.7,
      size: size || 30,
      color: color || INK,
      rot: rot == null ? rand(-14, 14) : rot
    });
  }

  function splat(x, y, size) {
    if (decals.length > 26) decals.shift();
    const blobs = [];
    const n = 4;
    for (let i = 0; i < n; i++) {
      blobs.push({
        x: x + rand(-size, size) * 1.25,
        y: y + rand(-size, size) * 0.9,
        r: size * rand(0.22, 0.68)
      });
    }
    decals.push({ x, y, blobs, seed: rand(0, 1e6) | 0, alpha: rand(0.035, 0.07) });
  }

  function update(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      if (p.y > 566 && p.vy > 0) {
        p.y = 566;
        p.vy *= -0.25;
        p.vx *= 0.6;
      }
    }
    for (let i = bursts.length - 1; i >= 0; i--) {
      bursts[i].t += dt;
      if (bursts[i].t >= bursts[i].dur) bursts.splice(i, 1);
    }
    for (let i = words.length - 1; i >= 0; i--) {
      words[i].t += dt;
      if (words[i].t >= words[i].dur) words.splice(i, 1);
    }
  }

  function drawDecals(ctx) {
    for (const d of decals) {
      ctx.save();
      ctx.globalAlpha = d.alpha;
      ctx.fillStyle = INK;
      for (const b of d.blobs) {
        ctx.beginPath();
        const rng = mulberry32(d.seed + b.x * 13);
        const n = 9;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU;
          const rr = b.r * (0.7 + rng() * 0.55);
          const px = b.x + Math.cos(a) * rr;
          const py = b.y + Math.sin(a) * rr * 0.92;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawBurst(ctx, b) {
    const k = clamp(b.t / b.dur, 0, 1);
    const fade = Math.pow(1 - k, 1.5);
    const grow = easeOutCubic(k);
    const rng = mulberry32(b.seed);

    if (b.type === 'star') {
      const r = b.size * (0.35 + grow * 1.05);
      const spikes = 6;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot + k * 0.25);
      for (let i = 0; i < spikes; i++) {
        const a = (i / spikes) * TAU + rng() * 0.16;
        const inner = r * 0.22;
        const outer = r * (0.8 + rng() * 0.4);
        const mx = Math.cos(a) * r * 0.55 + Math.cos(a + 0.25) * r * 0.18;
        const my = Math.sin(a) * r * 0.55 + Math.sin(a + 0.25) * r * 0.18;
        pencilPath(ctx, [
          [Math.cos(a) * inner, Math.sin(a) * inner],
          [mx, my],
          [Math.cos(a) * outer, Math.sin(a) * outer]
        ], { color: b.color, width: 3 * fade + 1.4, alpha: fade, jitter: 1.4, closed: false });
      }
      ctx.restore();
    } else if (b.type === 'ring') {
      const r = b.size * (0.4 + grow * 1.25);
      pencilEllipse(ctx, b.x, b.y, r, r * 0.82, {
        color: b.color,
        width: 2.2,
        alpha: fade * 0.7,
        wobble: 0.12,
        jitter: 1.4,
        n: 11
      });
    } else if (b.type === 'zig') {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      const s = b.size * (0.5 + grow * 0.9);
      for (let j = 0; j < 2; j++) {
        const pts = [];
        const yOff = (j - 0.5) * s * 0.34;
        const dir = j % 2 === 0 ? 1 : -1;
        const width = s * (0.9 + rng() * 0.4);
        for (let i = 0; i <= 4; i++) {
          const x = (i / 4 - 0.5) * width;
          const y = yOff + (i % 2 === 0 ? -1 : 1) * s * 0.3 * dir;
          pts.push([x, y]);
        }
        pencilPath(ctx, pts, {
          color: b.color,
          width: 2.2,
          alpha: fade * 0.85,
          jitter: 1,
          closed: false
        });
      }
      ctx.restore();
    } else if (b.type === 'guard') {
      ctx.save();
      const r = b.size * (0.5 + grow * 0.7);
      pencilEllipse(ctx, b.x, b.y, r, r * 0.9, {
        color: b.color, width: 2, alpha: fade * 0.75, wobble: 0.18, n: 9
      });
      ctx.restore();
    }
  }

  function drawParticles(ctx) {
    for (const p of particles) {
      const k = clamp(p.life / p.max, 0, 1);
      ctx.save();
      ctx.globalAlpha = k * (p.type === 'dust' ? 0.5 : 0.8);
      ctx.strokeStyle = p.color;
      ctx.lineCap = 'round';
      ctx.lineWidth = p.size * 0.45;
      if (p.type === 'dust') {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.018, p.y - p.vy * 0.018);
        ctx.stroke();
      } else if (p.type === 'speck') {
        inkDot(ctx, p.x, p.y, p.size * 0.6, p.color, k * 0.8);
      } else {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - Math.cos(p.rot) * p.size, p.y - Math.sin(p.rot) * p.size);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawFront(ctx) {
    for (const b of bursts) drawBurst(ctx, b);
    drawParticles(ctx);
    for (const w of words) {
      const k = clamp(w.t / w.dur, 0, 1);
      const alpha = k < 0.15 ? k / 0.15 : 1 - Math.pow((k - 0.15) / 0.85, 1.6);
      handText(ctx, w.text, w.x, w.y - k * 42, {
        size: w.size,
        color: w.color,
        alpha,
        rot: w.rot,
        outline: 'rgba(205,224,178,.65)',
        outlineWidth: w.size * 0.22
      });
    }
  }

  return { reset, dust, impact, guard, word, splat, update, drawDecals, drawFront };
})();
