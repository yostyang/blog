/* ==========================================================================
   demo.js — keyframe figure animator for the exercise library
   A tiny 2D rig: absolute joint angles → SVG, interpolated between poses.
   ========================================================================== */
(function () {
  'use strict';

  var TH = 52, SH = 52, TOR = 56, UA = 34, FA = 32, FOOT = 18, HEAD = 11;
  var GROUND = 228;
  var INK = '#0e1512';
  var FAR = '#8d9b93';
  var ACC = '#ff5a1a';
  var PAPER = '#f0efe8';

  var D = Math.PI / 180;
  function dir(a, len) { return [Math.sin(a * D) * len, Math.cos(a * D) * len]; }
  function add(p, d) { return [p[0] + d[0], p[1] + d[1]]; }

  var DEF = { t: 0, s: 0, tor: 0, ua: 0, fa: 0, foot: 90, fx: 132, lift: 0 };

  function full(k) {
    var o = {}, key;
    for (key in DEF) o[key] = (k[key] === undefined ? DEF[key] : k[key]);
    o.t2 = (k.t2 === undefined ? o.t : k.t2);
    o.s2 = (k.s2 === undefined ? o.s : k.s2);
    o.ua2 = (k.ua2 === undefined ? o.ua : k.ua2);
    o.fa2 = (k.fa2 === undefined ? o.fa : k.fa2);
    o.px = k.px; o.py = k.py;
    return o;
  }

  function joints(p) {
    var pelvis, py, px;
    var offY = TH * Math.cos(p.t * D) + SH * Math.cos(p.s * D);
    var offX = TH * Math.sin(p.t * D) + SH * Math.sin(p.s * D);
    if (p.px !== undefined && p.py !== undefined) { px = p.px; py = p.py; }
    else { py = GROUND - p.lift - offY; px = p.fx - offX; }
    pelvis = [px, py];
    var tdir = [Math.sin(p.tor * D), -Math.cos(p.tor * D)];
    var neck = add(pelvis, [tdir[0] * TOR, tdir[1] * TOR]);
    var head = add(neck, [tdir[0] * (HEAD + 2), tdir[1] * (HEAD + 2)]);
    var sh = add(pelvis, [tdir[0] * (TOR - 7), tdir[1] * (TOR - 7)]);

    var knee = add(pelvis, dir(p.t, TH));
    var ankle = add(knee, dir(p.s, SH));
    var toe = add(ankle, dir(p.foot, FOOT));

    var knee2 = add(pelvis, dir(p.t2, TH));
    var ankle2 = add(knee2, dir(p.s2, SH));
    var toe2 = add(ankle2, dir(p.foot, FOOT));

    var elbow = add(sh, dir(p.ua, UA));
    var hand = add(elbow, dir(p.fa, FA));
    var elbow2 = add(sh, dir(p.ua2, UA));
    var hand2 = add(elbow2, dir(p.fa2, FA));

    return { pelvis: pelvis, neck: neck, head: head, sh: sh,
      knee: knee, ankle: ankle, toe: toe,
      knee2: knee2, ankle2: ankle2, toe2: toe2,
      elbow: elbow, hand: hand, elbow2: elbow2, hand2: hand2 };
  }

  function lerp(a, b, k) { return a + (b - a) * k; }
  function lerpPose(a, b, k) {
    var o = {}, key;
    for (key in a) if (typeof a[key] === 'number') o[key] = lerp(a[key], b[key], k);
    if (a.px !== undefined || b.px !== undefined) {
      o.px = lerp(a.px === undefined ? b.px : a.px, b.px === undefined ? a.px : b.px, k);
      o.py = lerp(a.py === undefined ? b.py : a.py, b.py === undefined ? a.py : b.py, k);
    }
    return o;
  }

  /* ------------------------------------------------------------ registry */
  /* angles: t/s = thigh & shin absolute (0 = straight down, + = forward)
     tor = torso from vertical (+ = lean forward), ua/fa = arm segments,
     foot = foot absolute, fx = planted foot x, lift = raise off ground      */
  var EX = {
    squat: { kf: [
      { t: 6, s: 0, tor: 8, ua: 18, fa: -158 },
      { t: 52, s: -4, tor: 27, ua: 24, fa: -152 }], dur: 1500, hold: 420 },

    rdl: { kf: [
      { t: 6, s: 0, tor: 8, ua: 4, fa: 4 },
      { t: 42, s: -24, tor: 70, ua: 2, fa: 2 }], dur: 1600, hold: 420 },

    bulgarian: { kf: [
      { t: 8, s: 0, tor: 6, ua: 26, fa: -118, t2: -30, s2: -60 },
      { t: 58, s: -8, tor: 12, ua: 26, fa: -118, t2: -44, s2: -74 }], dur: 1500, hold: 380 },

    bridge: { kf: [
      { t: 115, s: 25, tor: -108, fx: 205, ua: 88, fa: 88, t2: -172, s2: -176 },
      { t: 80, s: 30, tor: -132, fx: 205, ua: 88, fa: 88, t2: -174, s2: -178 }], dur: 1500, hold: 420 },

    'calf-raise': { kf: [
      { t: 5, s: 0, tor: 4, ua: 26, fa: -118, foot: 90, lift: 0 },
      { t: 5, s: 0, tor: 4, ua: 26, fa: -118, foot: 118, lift: 13 }], dur: 1200, hold: 360 },

    plank: { kf: [
      { px: 140, py: 170, tor: -100, t: 62, s: 55, ua: 2, fa: 90 },
      { px: 140, py: 172, tor: -98, t: 62, s: 55, ua: 2, fa: 90 }], dur: 2200, hold: 200 },

    'dead-bug': { kf: [
      { px: 120, py: 208, tor: -92, ua: 180, fa: 180, t: 180, s: 90, ua2: 180, fa2: 180, t2: 180, s2: 90 },
      { px: 120, py: 208, tor: -92, ua: 180, fa: 180, t: 180, s: 90, ua2: -95, fa2: -96, t2: 88, s2: 88 }],
      dur: 1600, hold: 460 },

    'bird-dog': { kf: [
      { px: 128, py: 176, tor: -90, t: 0, s: 90, ua: 38, fa: -38, t2: 0, s2: 90, ua2: 38, fa2: -38 },
      { px: 128, py: 176, tor: -90, t: 0, s: 90, ua: -86, fa: -86, t2: 86, s2: 86, ua2: 38, fa2: -38 }],
      dur: 1600, hold: 460 },

    'single-leg-stand': { kf: [
      { t: 5, s: 0, tor: 2, ua: 18, fa: 18, t2: 74, s2: 2 },
      { t: 5, s: 0, tor: -3, ua: 34, fa: 44, t2: 78, s2: -6 }], dur: 1800, hold: 260 },

    'single-leg-rdl': { kf: [
      { t: 6, s: 0, tor: 8, ua: 4, fa: 4, t2: -6, s2: -6 },
      { t: 36, s: -18, tor: 72, ua: 2, fa: 2, t2: -88, s2: -92 }], dur: 1700, hold: 420 },

    'single-calf-balance': { kf: [
      { t: 5, s: 0, tor: 2, ua: 25, fa: -110, t2: -60, s2: -150, foot: 90, lift: 0 },
      { t: 5, s: 0, tor: 2, ua: 25, fa: -110, t2: -60, s2: -150, foot: 116, lift: 12 }],
      dur: 1300, hold: 320 },

    'hip-circle': { kf: [
      { t: 5, s: 0, tor: 1, ua: 22, fa: 24, t2: 92, s2: -38 },
      { t: 5, s: 0, tor: 3, ua: 26, fa: 30, t2: 18, s2: -96 },
      { t: 5, s: 0, tor: 1, ua: 22, fa: 24, t2: -62, s2: -140 }],
      dur: 900, hold: 160 },

    clamshell: { kf: [
      { px: 140, py: 210, tor: -92, t: 45, s: -45, ua: 20, fa: 40, t2: 45, s2: -45 },
      { px: 140, py: 210, tor: -92, t: 45, s: -45, ua: 20, fa: 40, t2: 45, s2: -78 }],
      dur: 1300, hold: 380 },

    'hip-flexor-stretch': { kf: [
      { t: 90, s: 0, tor: 6, fx: 162, ua: 20, fa: 20, t2: -10, s2: -90 },
      { t: 90, s: 0, tor: -5, fx: 162, ua: -160, fa: -170, t2: -10, s2: -90 }],
      dur: 1700, hold: 500 },

    'couch-stretch': { kf: [
      { t: 92, s: 2, tor: 8, fx: 165, ua: 25, fa: -100, t2: -22, s2: -152 },
      { t: 92, s: 2, tor: -4, fx: 165, ua: -155, fa: -168, t2: -22, s2: -152 }],
      dur: 1700, hold: 500 },

    pigeon: { kf: [
      { t: 100, s: -30, tor: 14, fx: 150, ua: 8, fa: 12, t2: -85, s2: -88 },
      { t: 100, s: -30, tor: 0, fx: 150, ua: 8, fa: 12, t2: -85, s2: -88 }], dur: 1700, hold: 500 },

    'world-greatest-stretch': { kf: [
      { t: 78, s: -6, tor: 26, fx: 168, ua: 10, fa: 20, t2: -52, s2: -56, ua2: -120, fa2: -130 },
      { t: 78, s: -6, tor: 50, fx: 168, ua: 2, fa: 6, t2: -52, s2: -56, ua2: -155, fa2: -168 }],
      dur: 1700, hold: 460 },

    'foam-roll': { prop: 'roller', kf: [
      { px: 105, py: 205, tor: -95, t: 86, s: 86, ua: 85, fa: -100, t2: 100, s2: 45 },
      { px: 118, py: 205, tor: -95, t: 86, s: 86, ua: 85, fa: -100, t2: 100, s2: 45 }],
      dur: 2000, hold: 180 },

    'run-form': { kf: [
      { t: 55, s: 8, tor: 8, ua: 45, fa: 110, t2: -45, s2: -95, ua2: -50, fa2: -120, lift: 0 },
      { t: 24, s: -6, tor: 9, ua: 10, fa: 80, t2: -68, s2: -60, ua2: -20, fa2: -100, lift: 5 },
      { t: -12, s: -42, tor: 10, ua: -30, fa: 40, t2: 55, s2: -30, ua2: 45, fa2: 110, lift: 16 },
      { t: 20, s: -20, tor: 9, ua: 5, fa: 70, t2: 30, s2: -70, ua2: 10, fa2: 90, lift: 6 }],
      dur: 620, hold: 0 },

    strides: { kf: [
      { t: 58, s: 6, tor: 14, ua: 55, fa: 120, t2: -50, s2: -100, ua2: -60, fa2: -130, lift: 0 },
      { t: 20, s: -10, tor: 15, ua: 5, fa: 75, t2: -72, s2: -55, ua2: -15, fa2: -95, lift: 8 },
      { t: -16, s: -48, tor: 16, ua: -40, fa: 30, t2: 60, s2: -25, ua2: 55, fa2: 120, lift: 22 },
      { t: 18, s: -24, tor: 15, ua: 0, fa: 65, t2: 34, s2: -72, ua2: 5, fa2: 85, lift: 9 }],
      dur: 480, hold: 0 },

    'lunge-twist': { kf: [
      { t: 72, s: -6, tor: 12, fx: 168, ua: 30, fa: 60, t2: -34, s2: -70, ua2: 30, fa2: 60 },
      { t: 72, s: -6, tor: 34, fx: 168, ua: 70, fa: 90, t2: -34, s2: -70, ua2: -20, fa2: 10 }],
      dur: 1600, hold: 420 }
  };

  /* -------------------------------------------------------------- render */
  var NS = 'http://www.w3.org/2000/svg';

  function el(name, attrs) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  function buildSvg() {
    var svg = el('svg', { viewBox: '0 0 260 260', class: 'demo-svg', 'aria-hidden': 'true' });
    // ground
    svg.appendChild(el('line', { x1: 18, y1: GROUND, x2: 244, y2: GROUND,
      stroke: '#c9cec6', 'stroke-width': 2, 'stroke-linecap': 'round' }));
    // optional prop (foam roller)
    var prop = el('ellipse', { cx: 150, cy: 221, rx: 27, ry: 9, fill: '#c9cec6' });
    svg.appendChild(prop);
    // hip path (drawn behind everything)
    var path = el('path', { fill: 'none', stroke: ACC, 'stroke-width': 2,
      'stroke-dasharray': '5 5', 'stroke-linecap': 'round', opacity: '.45' });
    svg.appendChild(path);

    var g = {};
    function limb(id, w, color, op) {
      var grp = el('g', { opacity: op || 1 });
      var a = el('line', { stroke: color, 'stroke-width': w, 'stroke-linecap': 'round' });
      var b = el('line', { stroke: color, 'stroke-width': w * 0.86, 'stroke-linecap': 'round' });
      var c = el('line', { stroke: color, 'stroke-width': w * 0.55, 'stroke-linecap': 'round' });
      grp.appendChild(a); grp.appendChild(b); grp.appendChild(c);
      svg.appendChild(grp);
      g[id] = [a, b, c];
    }
    limb('farLeg', 17, FAR, 0.55);
    limb('farArm', 12, FAR, 0.55);
    g.farArm[2].setAttribute('display', 'none');
    limb('nearLeg', 18, INK, 1);
    // torso
    var torso = el('line', { stroke: INK, 'stroke-width': 25, 'stroke-linecap': 'round' });
    svg.appendChild(torso);
    var head = el('circle', { fill: INK, r: HEAD });
    svg.appendChild(head);
    limb('nearArm', 13, INK, 1);
    g.nearArm[2].setAttribute('display', 'none');

    return { svg: svg, g: g, torso: torso, head: head, path: path, prop: prop };
  }

  function setLine(n, p, q) {
    n.setAttribute('x1', p[0].toFixed(1)); n.setAttribute('y1', p[1].toFixed(1));
    n.setAttribute('x2', q[0].toFixed(1)); n.setAttribute('y2', q[1].toFixed(1));
  }

  function draw(refs, p) {
    var j = joints(p);
    setLine(refs.g.farLeg[0], j.pelvis, j.knee2);
    setLine(refs.g.farLeg[1], j.knee2, j.ankle2);
    setLine(refs.g.farLeg[2], j.ankle2, j.toe2);

    setLine(refs.g.farArm[0], j.sh, j.elbow2);
    setLine(refs.g.farArm[1], j.elbow2, j.hand2);
    setLine(refs.g.nearLeg[0], j.pelvis, j.knee);
    setLine(refs.g.nearLeg[1], j.knee, j.ankle);
    setLine(refs.g.nearLeg[2], j.ankle, j.toe);

    setLine(refs.torso, j.pelvis, j.neck);
    refs.head.setAttribute('cx', j.head[0].toFixed(1));
    refs.head.setAttribute('cy', j.head[1].toFixed(1));

    setLine(refs.g.nearArm[0], j.sh, j.elbow);
    setLine(refs.g.nearArm[1], j.elbow, j.hand);
  }

  function hipPath(kfs) {
    var pts = [], i, k;
    for (i = 0; i < kfs.length - 1; i++) {
      for (k = 0; k <= 8; k++) {
        pts.push(joints(lerpPose(kfs[i], kfs[i + 1], k / 8)).pelvis);
      }
    }
    pts.push(joints(kfs[kfs.length - 1]).pelvis);
    var span = 0;
    for (i = 1; i < pts.length; i++) {
      span += Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]);
    }
    if (span < 12) return '';
    return 'M' + pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' L');
  }

  function easeInOut(k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; }

  function timeline(def) {
    var kfs = def.kf, steps = [], i;
    for (i = 0; i < kfs.length - 1; i++) steps.push({ a: i, b: i + 1, d: def.dur });
    for (i = kfs.length - 1; i > 0; i--) steps.push({ a: i, b: i - 1, d: def.dur });
    return steps;
  }

  function mount(host, slug, opts) {
    var def = EX[slug];
    if (!def) return null;
    opts = opts || {};
    var kfs = def.kf.map(full);
    var refs = buildSvg();
    refs.path.setAttribute('d', hipPath(kfs));
    if (def.prop !== 'roller') refs.svg.removeChild(refs.prop);
    host.appendChild(refs.svg);

    var steps = timeline(def);
    var hold = def.hold || 0;
    var t0 = null, acc = 0, paused = false, speed = 1, raf = null, cur = 0;

    function frame(ts) {
      if (t0 === null) t0 = ts;
      var dt = (ts - t0) * speed;
      t0 = ts;
      if (!paused) acc += dt;

      var total = steps.reduce(function (s, st) { return s + st.d + hold; }, 0);
      var local = acc % total;
      var p = kfs[0], i, curStep = steps[0], k = 0;
      for (i = 0; i < steps.length; i++) {
        var seg = steps[i].d + hold;
        if (local < seg) { curStep = steps[i]; k = Math.min(1, local / steps[i].d); break; }
        local -= seg;
      }
      p = lerpPose(kfs[curStep.a], kfs[curStep.b], easeInOut(k));
      draw(refs, p);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return {
      svg: refs.svg,
      pause: function () { paused = true; return this; },
      play: function () { paused = false; return this; },
      toggle: function () { paused = !paused; return paused; },
      speed: function (s) { speed = s; return this; },
      stop: function () { if (raf) cancelAnimationFrame(raf); }
    };
  }

  /* only animate when visible */
  function lazyMount(host, slug, opts) {
    if (!('IntersectionObserver' in window)) { mount(host, slug, opts); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { mount(host, slug, opts); io.disconnect(); }
      });
    }, { rootMargin: '120px' });
    io.observe(host);
  }

  /* static frame — used by the design harness and as a no-motion fallback */
  function mountStatic(host, slug, idx) {
    var def = EX[slug];
    if (!def) return;
    var kfs = def.kf.map(full);
    var refs = buildSvg();
    refs.path.setAttribute('d', hipPath(kfs));
    if (def.prop !== 'roller') refs.svg.removeChild(refs.prop);
    host.appendChild(refs.svg);
    draw(refs, kfs[Math.min(idx || 0, kfs.length - 1)]);
  }

  window.DemoRig = { mount: mount, lazyMount: lazyMount, mountStatic: mountStatic, EX: EX, PAPER: PAPER };
})();
