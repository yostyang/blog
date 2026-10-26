'use strict';

/* ---------------------------------------------------------------
   纸上决斗 — 主程序
   --------------------------------------------------------------- */

const WORLD = { w: 1280, h: 720, floor: 558, left: 150, right: 1130 };
const PAGE_DUR = 0.62;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let DPR = 1;
const view = { w: 0, h: 0, scale: 1, ox: 0, oy: 0, reserve: 0 };
const touchMode = ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0;
const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

let deskCanvas = document.createElement('canvas');
let paperCanvas = document.createElement('canvas');
let vignetteGrad = null;

const game = {
  state: 'title',
  paused: false,
  time: 0,
  round: 1,
  roundTime: 60,
  fightTime: 0,
  hitstop: 0,
  shake: 0,
  zoom: 1,
  flash: 0,
  introT: 0,
  introCue: 0,
  koT: 0,
  koReason: 'ko',
  pageT: 0,
  pageCb: null,
  pageLabel: '',
  roundWinner: null,
  koLosers: [],
  p1: null,
  p2: null,
  ai: null,
  difficulty: 'normal',
  mode: '1p',

  addHitstop(t) {
    this.hitstop = Math.max(this.hitstop, t);
  },
  addShake(a) {
    if (reduceMotion) return;
    this.shake = Math.min(30, this.shake + a);
  },
  zoomPunch(a) {
    if (reduceMotion) return;
    this.zoom = Math.min(1.07, this.zoom + a);
  },
  onKO(loser, by) {
    if (this.koLosers.indexOf(loser) < 0) this.koLosers.push(loser);
    const other = loser === this.p1 ? this.p2 : this.p1;
    if (other.state === 'attack') {
      other.attack = null;
      other.state = other.onGround ? 'idle' : 'fall';
      other.stateTime = 0;
    }
    this.roundWinner = this.p1.hp > 0 ? this.p1 : (this.p2.hp > 0 ? this.p2 : null);
    if (this.state === 'fight') {
      this.state = 'ko';
      this.koT = 0;
      this.koReason = 'ko';
      this.hitstop = 0.18;
      this.shake = 22;
      this.zoomPunch(0.07);
      this.flash = 0.5;
      Sfx.ko();
    }
  }
};

window.__paperDuel = game;

/* ---------------------------------------------------------------
   输入
   --------------------------------------------------------------- */

const Input = (() => {
  const held = Object.create(null);
  const edge = Object.create(null);
  const touchHeld = { left: false, right: false, down: false };
  const touchEdge = { jump: false, punch: false, kick: false, super: false };

  const KEYS = new Set([
    'KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyJ', 'KeyK', 'KeyF', 'KeyE', 'KeyL', 'Space',
    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
    'Comma', 'Period', 'Slash', 'Numpad1', 'Numpad2', 'Numpad3'
  ]);
  const EDGE_KEYS = new Set([
    'KeyW', 'Space', 'ArrowUp', 'KeyJ', 'KeyK', 'KeyF', 'KeyE', 'KeyL',
    'Comma', 'Period', 'Slash', 'Numpad1', 'Numpad2', 'Numpad3'
  ]);

  function down(code) { return !!held[code]; }
  function pressed(code) { return !!edge[code]; }

  window.addEventListener('keydown', (e) => {
    if (!KEYS.has(e.code)) return;
    if (e.code === 'Space' || e.code.indexOf('Arrow') === 0 ||
        e.code === 'Comma' || e.code === 'Period' || e.code === 'Slash' ||
        e.code.indexOf('Numpad') === 0) e.preventDefault();
    if (e.repeat) return;
    held[e.code] = true;
    if (EDGE_KEYS.has(e.code)) edge[e.code] = true;
  });

  window.addEventListener('keyup', (e) => {
    if (!KEYS.has(e.code)) return;
    held[e.code] = false;
  });

  function clearEdges() {
    for (const k in edge) delete edge[k];
    touchEdge.jump = touchEdge.punch = touchEdge.kick = touchEdge.super = false;
  }

  function clearAll() {
    for (const k in held) held[k] = false;
    touchHeld.left = touchHeld.right = touchHeld.down = false;
    clearEdges();
  }

  window.addEventListener('blur', clearAll);

  return {
    // P1：WASD + J/K/F。单人模式也接受方向键；双人模式把方向键让给 P2。
    poll(mode) {
      const arrows = mode !== '2p';
      return {
        left: down('KeyA') || (arrows && down('ArrowLeft')) || touchHeld.left,
        right: down('KeyD') || (arrows && down('ArrowRight')) || touchHeld.right,
        up: false,
        down: down('KeyS') || (arrows && down('ArrowDown')) || touchHeld.down,
        jumpPressed: pressed('KeyW') || pressed('Space') || (arrows && pressed('ArrowUp')) || touchEdge.jump,
        punchPressed: pressed('KeyJ') || touchEdge.punch,
        kickPressed: pressed('KeyK') || touchEdge.kick,
        superPressed: pressed('KeyF') || pressed('KeyE') || pressed('KeyL') || touchEdge.super
      };
    },
    // P2：方向键 + , . /（也兼容小键盘 1/2/3）
    poll2() {
      return {
        left: down('ArrowLeft'),
        right: down('ArrowRight'),
        up: false,
        down: down('ArrowDown'),
        jumpPressed: pressed('ArrowUp'),
        punchPressed: pressed('Comma') || pressed('Numpad1'),
        kickPressed: pressed('Period') || pressed('Numpad2'),
        superPressed: pressed('Slash') || pressed('Numpad3')
      };
    },
    clearEdges,
    clearAll,
    hold(act, isDown) {
      if (act === 'left' || act === 'right' || act === 'down') {
        touchHeld[act] = isDown;
      } else if (isDown) {
        touchEdge[act] = true;
      }
    }
  };
})();

function emptyInput() {
  return {
    left: false, right: false, up: false, down: false,
    jumpPressed: false, punchPressed: false, kickPressed: false, superPressed: false
  };
}

/* ---------------------------------------------------------------
   DOM
   --------------------------------------------------------------- */

const ui = {
  menu: document.getElementById('menu'),
  pause: document.getElementById('pause'),
  result: document.getElementById('result'),
  startBtn: document.getElementById('startBtn'),
  resumeBtn: document.getElementById('resumeBtn'),
  restartPauseBtn: document.getElementById('restartPauseBtn'),
  quitBtn: document.getElementById('quitBtn'),
  againBtn: document.getElementById('againBtn'),
  homeBtn: document.getElementById('homeBtn'),
  pauseBtn: document.getElementById('pauseBtn'),
  muteBtn: document.getElementById('muteBtn'),
  muteBtn2: document.getElementById('muteBtn2'),
  soundLabel: null,
  resTitle: document.getElementById('resTitle'),
  resScore: document.getElementById('resScore'),
  resRound: document.getElementById('resRound'),
  resLine: document.getElementById('resLine'),
  modeRow: document.getElementById('modeRow'),
  diffRow: document.getElementById('diffRow'),
  duoHint: document.getElementById('duoHint'),
  p2ChipTag: document.getElementById('p2ChipTag'),
  modeBtns: Array.prototype.slice.call(document.querySelectorAll('#modeRow .seg button')),
  diffBtns: Array.prototype.slice.call(document.querySelectorAll('#diffRow .seg button'))
};

const show = (el) => el.classList.remove('hidden');
const hide = (el) => el.classList.add('hidden');

/* ---------------------------------------------------------------
   画笔纹理
   --------------------------------------------------------------- */

function buildDesk(w, h) {
  const c = deskCanvas;
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const g = c.getContext('2d');
  g.fillStyle = '#8d2f27';
  g.fillRect(0, 0, c.width, c.height);

  const base = g.createRadialGradient(
    c.width * 0.44, c.height * 0.34, 0,
    c.width * 0.5, c.height * 0.52, Math.max(c.width, c.height) * 0.82
  );
  base.addColorStop(0, 'rgba(196, 78, 60, 0.62)');
  base.addColorStop(0.5, 'rgba(126, 38, 30, 0.1)');
  base.addColorStop(1, 'rgba(48, 13, 10, 0.55)');
  g.fillStyle = base;
  g.fillRect(0, 0, c.width, c.height);

  const rng = mulberry32(90210);
  const count = Math.min(9000, Math.floor((c.width * c.height) / 1400));
  for (let i = 0; i < count; i++) {
    const x = rng() * c.width;
    const y = rng() * c.height;
    g.globalAlpha = 0.02 + rng() * 0.06;
    g.fillStyle = rng() > 0.45 ? '#d06a52' : '#4d1913';
    const s = 1 + rng() * 2.4;
    g.fillRect(x, y, s, s);
  }

  g.globalAlpha = 0.05;
  g.strokeStyle = '#3f120d';
  g.lineWidth = 1;
  for (let i = 0; i < 90; i++) {
    const x = rng() * c.width;
    const y = rng() * c.height;
    const len = 20 + rng() * 130;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + len * 0.5, y + (rng() - 0.5) * 18, x + len, y + (rng() - 0.5) * 8);
    g.stroke();
  }

  g.globalAlpha = 1;
  const vig = g.createRadialGradient(
    c.width / 2, c.height / 2, Math.min(c.width, c.height) * 0.28,
    c.width / 2, c.height / 2, Math.max(c.width, c.height) * 0.78
  );
  vig.addColorStop(0, 'rgba(30, 8, 5, 0)');
  vig.addColorStop(1, 'rgba(30, 8, 5, 0.5)');
  g.fillStyle = vig;
  g.fillRect(0, 0, c.width, c.height);
}

function buildPaper() {
  const c = document.createElement('canvas');
  c.width = WORLD.w;
  c.height = WORLD.h;
  const g = c.getContext('2d');
  const px = 30, py = 12, pw = 1220, ph = 696;

  g.save();
  g.shadowColor = 'rgba(35, 10, 7, 0.55)';
  g.shadowBlur = 24;
  g.shadowOffsetY = 9;
  g.fillStyle = '#b9d79b';
  g.fillRect(px, py, pw, ph);
  g.restore();

  g.save();
  g.beginPath();
  g.rect(px, py, pw, ph);
  g.clip();

  const base = g.createRadialGradient(
    px + pw * 0.4, py + ph * 0.28, 0,
    px + pw * 0.5, py + ph * 0.45, pw * 0.78
  );
  base.addColorStop(0, '#cfe8b4');
  base.addColorStop(0.48, '#bfdca2');
  base.addColorStop(1, '#acca8c');
  g.fillStyle = base;
  g.fillRect(px, py, pw, ph);

  const rng = mulberry32(31337);
  for (let i = 0; i < 5600; i++) {
    const x = px + rng() * pw;
    const y = py + rng() * ph;
    const len = 2 + rng() * 10;
    const a = rng() * TAU;
    g.globalAlpha = 0.015 + rng() * 0.045;
    g.strokeStyle = rng() > 0.5 ? '#7d9869' : '#ecf6d8';
    g.lineWidth = 0.6 + rng() * 0.9;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }

  g.globalAlpha = 0.1;
  for (let i = 0; i < 26; i++) {
    const x = px + rng() * pw;
    const y = py + rng() * ph;
    g.strokeStyle = '#6f8a5b';
    g.lineWidth = 2 + rng() * 8;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + rng() * 80 - 40, y + rng() * 16 - 8);
    g.stroke();
  }

  g.globalAlpha = 1;
  const creaseY = 151;
  const crease = g.createLinearGradient(0, creaseY - 15, 0, creaseY + 15);
  crease.addColorStop(0, 'rgba(80, 100, 62, 0)');
  crease.addColorStop(0.42, 'rgba(80, 100, 62, 0.09)');
  crease.addColorStop(0.5, 'rgba(54, 74, 40, 0.17)');
  crease.addColorStop(0.57, 'rgba(255, 255, 232, 0.16)');
  crease.addColorStop(1, 'rgba(255, 255, 232, 0)');
  g.fillStyle = crease;
  g.fillRect(px, creaseY - 15, pw, 30);
  g.strokeStyle = 'rgba(66, 84, 50, 0.25)';
  g.lineWidth = 1.1;
  g.beginPath();
  g.moveTo(px, creaseY);
  g.lineTo(px + pw, creaseY + 0.6);
  g.stroke();

  const edge = g.createLinearGradient(px, py, px + 18, py);
  edge.addColorStop(0, 'rgba(70, 92, 54, 0.18)');
  edge.addColorStop(1, 'rgba(70, 92, 54, 0)');
  g.fillStyle = edge;
  g.fillRect(px, py, 18, ph);
  const edge2 = g.createLinearGradient(px + pw - 14, py, px + pw, py);
  edge2.addColorStop(0, 'rgba(70, 92, 54, 0)');
  edge2.addColorStop(1, 'rgba(70, 92, 54, 0.14)');
  g.fillStyle = edge2;
  g.fillRect(px + pw - 14, py, 14, ph);

  /* 底稿涂鸦：一个淡淡的太阳、两只鸟、几笔草 */
  g.strokeStyle = '#415734';
  g.lineWidth = 1.4;
  g.globalAlpha = 0.065;
  const sunX = px + 158, sunY = py + 300;
  g.beginPath();
  g.arc(sunX, sunY, 24, 0, TAU);
  g.stroke();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + 0.2;
    g.beginPath();
    g.moveTo(sunX + Math.cos(a) * 32, sunY + Math.sin(a) * 32);
    g.lineTo(sunX + Math.cos(a) * (42 + (i % 3) * 6), sunY + Math.sin(a) * (42 + (i % 3) * 6));
    g.stroke();
  }

  g.globalAlpha = 0.075;
  for (const b of [{ x: px + 1024, y: py + 258, s: 1 }, { x: px + 1064, y: py + 240, s: 0.72 }]) {
    g.beginPath();
    g.moveTo(b.x - 10 * b.s, b.y);
    g.quadraticCurveTo(b.x - 4 * b.s, b.y - 8 * b.s, b.x, b.y);
    g.quadraticCurveTo(b.x + 4 * b.s, b.y - 8 * b.s, b.x + 10 * b.s, b.y);
    g.stroke();
  }

  g.globalAlpha = 0.1;
  for (const gx of [px + 46, px + 62, px + pw - 62, px + pw - 46]) {
    const gy = py + 546;
    g.beginPath();
    g.moveTo(gx, gy);
    g.lineTo(gx - 4, gy - 8);
    g.moveTo(gx, gy);
    g.lineTo(gx + 1, gy - 10);
    g.moveTo(gx, gy);
    g.lineTo(gx + 5, gy - 7);
    g.stroke();
  }

  /* 淡淡的草稿字，向视频里的演算纸致敬 */
  g.globalAlpha = 0.075;
  g.fillStyle = '#34452f';
  g.font = '700 15px ' + HAND;
  g.fillText('5 × 90', px + pw - 128, py + ph - 92);
  g.fillText('50 + 9', px + pw - 128, py + ph - 70);
  g.font = '700 12px ' + HAND;
  g.fillText('3 / 12', px + pw - 184, py + ph - 50);
  g.strokeStyle = '#34452f';
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(px + 86, py + ph - 48);
  g.lineTo(px + 122, py + ph - 48);
  g.lineTo(px + 115, py + ph - 54);
  g.moveTo(px + 122, py + ph - 48);
  g.lineTo(px + 115, py + ph - 42);
  g.stroke();

  g.restore();
  paperCanvas = c;
}

function buildVignette(w, h) {
  const g = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.34,
    w / 2, h / 2, Math.max(w, h) * 0.78
  );
  g.addColorStop(0, 'rgba(30, 11, 7, 0)');
  g.addColorStop(1, 'rgba(30, 11, 7, 0.36)');
  vignetteGrad = g;
}

/* ---------------------------------------------------------------
   尺寸
   --------------------------------------------------------------- */

function resize() {
  const w = Math.max(320, window.innerWidth);
  const h = Math.max(320, window.innerHeight);
  DPR = clamp(window.devicePixelRatio || 1, 1, 2);
  canvas.width = Math.round(w * DPR);
  canvas.height = Math.round(h * DPR);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  view.w = w;
  view.h = h;

  const playing = document.body.classList.contains('playing');
  view.reserve = touchMode && playing ? Math.min(148, h * 0.24) : 0;
  const availH = h - view.reserve;
  const s = Math.min(w / WORLD.w, availH / WORLD.h);
  view.scale = s;
  view.ox = (w - WORLD.w * s) / 2;
  view.oy = (availH - WORLD.h * s) / 2;

  buildDesk(w * DPR, h * DPR);
  buildVignette(w, h);
}

/* ---------------------------------------------------------------
   流程
   --------------------------------------------------------------- */

function setupRound() {
  game.p1.reset(430, 1);
  game.p2.reset(850, -1);
  game.p1.ghostHp = 100;
  game.p2.ghostHp = 100;
  game.roundWinner = null;
  game.koLosers = [];
  game.roundTime = 60;
  game.fightTime = 0;
  game.koT = 0;
  game.introT = 0;
  game.introCue = 0;
  game.hitstop = 0;
  game.shake = 0;
  game.zoom = 1;
  game.flash = 0;
  game.state = 'intro';
  game.ai.reset();
  Effects.reset();
  Input.clearAll();
  Sfx.count();
}

function startPage(cb) {
  game.pageCb = cb;
  game.pageT = 0;
  game.state = 'page';
  game.pageLabel = '第 ' + game.round + ' 页';
  Sfx.page();
}

function setMode(mode, silent) {
  game.mode = mode === '2p' ? '2p' : '1p';
  ui.modeBtns.forEach(function (b) {
    b.setAttribute('aria-pressed', b.dataset.mode === game.mode ? 'true' : 'false');
  });
  ui.diffRow.style.display = game.mode === '2p' ? 'none' : '';
  ui.duoHint.classList.toggle('hidden', game.mode !== '2p');
  ui.p2ChipTag.textContent = game.mode === '2p' ? 'P2' : 'CPU';
  if (game.p2) {
    game.p2.tag = game.mode === '2p' ? 'P2' : 'CPU';
    game.p2.isCPU = game.mode !== '2p';
  }
  try { localStorage.setItem('paperduel.mode', game.mode); } catch (e) {}
  if (!silent) Sfx.ui();
}

function beginMatch() {
  Sfx.resume();
  Sfx.ui();
  hide(ui.menu);
  hide(ui.pause);
  hide(ui.result);
  game.paused = false;
  game.p1.wins = 0;
  game.p2.wins = 0;
  game.round = 1;
  setMode(game.mode, true);
  game.ai.setLevel(game.difficulty);
  game.p1.reset(430, 1);
  game.p2.reset(850, -1);
  document.body.classList.add('playing');
  resize();
  startPage(function () { setupRound(); });
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}

function goTitle() {
  game.state = 'title';
  game.paused = false;
  game.hitstop = 0;
  game.shake = 0;
  game.zoom = 1;
  game.flash = 0;
  hide(ui.pause);
  hide(ui.result);
  show(ui.menu);
  game.p1.reset(268, 1);
  game.p2.reset(1012, -1);
  game.p1.ghostHp = 100;
  game.p2.ghostHp = 100;
  document.body.classList.remove('playing');
  resize();
}

function resolveRound() {
  if (game.state === 'matchEnd') return;
  const w = game.roundWinner;
  if (w) w.wins++;
  const over = game.p1.wins >= 2 || game.p2.wins >= 2 || game.round >= 5;
  if (over) {
    finishMatch();
    return;
  }
  game.round++;
  startPage(function () { setupRound(); });
}

function finishMatch() {
  game.state = 'matchEnd';
  document.body.classList.remove('playing');
  Sfx.win();
  showResult();
  resize();
}

function showResult() {
  const w1 = game.p1.wins;
  const w2 = game.p2.wins;
  ui.resRound.textContent = String(game.round);
  ui.resScore.textContent = w1 + ' : ' + w2;
  let title, line;
  const duo = game.mode === '2p';
  ui.resTitle.style.whiteSpace = duo ? 'pre-line' : 'normal';
  if (w1 > w2) {
    title = '铅笔' + (duo ? '（P1）\n' : ' ') + '赢下了这一本';
    line = '橡皮被夹在最后一页，只好下次再擦。';
  } else if (w2 > w1) {
    title = '橡皮' + (duo ? '（P2）\n' : ' ') + '赢下了这一本';
    line = '铅笔断了芯，在纸上留下最后一道歪线。';
  } else {
    title = '打 成 平 手';
    line = '纸都被翻皱了，还是没分出胜负。';
  }
  ui.resTitle.textContent = title;
  ui.resLine.textContent = line;
  show(ui.result);
}

function endRoundByTime() {
  if (game.state !== 'fight') return;
  game.state = 'ko';
  game.koT = 0;
  game.koReason = 'time';
  game.roundWinner = game.p1.hp === game.p2.hp ? null : (game.p1.hp > game.p2.hp ? game.p1 : game.p2);
  if (game.roundWinner) {
    game.roundWinner.state = 'win';
    game.roundWinner.stateTime = 0;
    game.roundWinner.attack = null;
  }
  game.shake = 10;
  Sfx.ko();
}

function pauseGame() {
  if (game.state === 'title' || game.state === 'matchEnd' || game.paused) return;
  game.paused = true;
  game.shake = 0;
  show(ui.pause);
  Input.clearAll();
  Sfx.ui();
}

function resumeGame() {
  if (!game.paused) return;
  game.paused = false;
  hide(ui.pause);
  Input.clearAll();
  Sfx.ui();
}

function togglePause() {
  if (game.paused) resumeGame(); else pauseGame();
}

/* ---------------------------------------------------------------
   更新
   --------------------------------------------------------------- */

function update(dt) {
  game.time += dt;

  if (game.state === 'title') {
    game.p1.stateTime = game.time;
    game.p2.stateTime = game.time;
    game.p1.blink = (game.time % 4.2) > 4.08 ? 1 : 0;
    game.p2.blink = (game.time % 3.6) > 3.47 ? 1 : 0;
    return;
  }

  if (game.state === 'matchEnd') {
    Effects.update(dt);
    updateCamera(dt);
    updateGhosts(dt);
    return;
  }

  if (game.state === 'page') {
    game.pageT += dt;
    Effects.update(dt * 0.35);
    updateCamera(dt);
    if (game.pageT >= PAGE_DUR) {
      const cb = game.pageCb;
      game.pageCb = null;
      if (cb) cb();
    }
    return;
  }

  if (game.hitstop > 0) {
    game.hitstop -= dt;
    Effects.update(dt * 0.18);
    updateCamera(dt);
    updateGhosts(dt);
    return;
  }

  if (game.state === 'intro') {
    game.introT += dt;
    if (game.introCue === 0 && game.introT > 0.08) {
      game.introCue = 1;
      Sfx.count();
    }
    if (game.introCue === 1 && game.introT > 1.02) {
      game.introCue = 2;
      Sfx.fight();
      game.addShake(3);
    }
    if (game.introT > 1.58) {
      game.state = 'fight';
      game.fightTime = 0;
      game.introT = 0;
    }
  }

  if (game.state === 'fight') {
    game.fightTime += dt;
    game.roundTime -= dt;
    if (game.roundTime <= 0) {
      game.roundTime = 0;
      endRoundByTime();
    }
  }

  if (game.state === 'ko') {
    game.koT += dt;
    if (game.koT > 0.9 && game.roundWinner &&
        game.roundWinner.state !== 'win' && game.roundWinner.state !== 'ko') {
      game.roundWinner.state = 'win';
      game.roundWinner.stateTime = 0;
      game.roundWinner.attack = null;
    }
    if (game.koT > 2.45) {
      resolveRound();
      return;
    }
  }

  const slow = game.state === 'ko' ? 0.42 : 1;
  const sdt = dt * slow;

  let in1 = emptyInput();
  let in2 = emptyInput();
  if (game.state === 'fight') {
    in1 = Input.poll(game.mode);
    in2 = game.mode === '2p'
      ? Input.poll2()
      : game.ai.update(sdt, game.p2, game.p1, game);
  }

  game.p1.update(sdt, in1, game.p2, game);
  game.p2.update(sdt, in2, game.p1, game);
  Input.clearEdges();

  resolvePush();
  Effects.update(sdt);
  updateCamera(dt);
  updateGhosts(dt);

  if (game.state === 'fight') {
    if (game.p1.hp <= 0 && game.p1.state !== 'ko') game.p1.knockOut(game, game.p2);
    if (game.p2.hp <= 0 && game.p2.state !== 'ko') game.p2.knockOut(game, game.p1);
  }
}

function resolvePush() {
  const a = game.p1, b = game.p2;
  if (a.state === 'ko' || b.state === 'ko') return;
  // 高度差足够大时才允许互相穿过，避免“站在对方头上”
  if (Math.abs(a.y - b.y) > 92) return;
  const dx = b.x - a.x;
  const adx = Math.abs(dx);
  if (adx < MIN_SEPARATION) {
    const push = (MIN_SEPARATION - adx) / 2;
    const s = dx >= 0 ? 1 : -1;
    a.x -= s * push;
    b.x += s * push;
    a.x = clamp(a.x, WORLD.left, WORLD.right);
    b.x = clamp(b.x, WORLD.left, WORLD.right);
  }
}

function updateCamera(dt) {
  game.shake *= Math.pow(0.002, dt);
  if (game.shake < 0.08) game.shake = 0;
  game.zoom = lerp(game.zoom, 1, 1 - Math.pow(0.02, dt));
  game.flash *= Math.pow(0.008, dt);
  if (game.flash < 0.002) game.flash = 0;
}

function updateGhosts(dt) {
  const list = [game.p1, game.p2];
  for (const f of list) {
    if (f.hp > f.ghostHp) f.ghostHp = f.hp;
    f.ghostHp = approach(f.ghostHp, f.hp, dt * 38);
  }
}

/* ---------------------------------------------------------------
   绘制
   --------------------------------------------------------------- */

function applyWorld() {
  const z = game.zoom;
  const s = view.scale * z;
  const shake = game.shake;
  const sx = shake ? (Math.random() * 2 - 1) * shake : 0;
  const sy = shake ? (Math.random() * 2 - 1) * shake : 0;
  const ox = view.ox + view.scale * (WORLD.w / 2) * (1 - z) + sx;
  const oy = view.oy + view.scale * (WORLD.h / 2) * (1 - z) + sy;
  ctx.setTransform(DPR * s, 0, 0, DPR * s, DPR * ox, DPR * oy);
}

function render() {
  beginSketch();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(deskCanvas, 0, 0);

  applyWorld();
  drawPaper();

  if (game.state === 'title') {
    drawTitleScene();
  } else {
    drawArena();
  }

  if (game.state === 'page') drawPage();

  drawScreenEffects();
}

function drawPaper() {
  ctx.drawImage(paperCanvas, 0, 0);

  roughRect(ctx, 30, 12, 1220, 696, { width: 2.2, alpha: 0.45, color: '#2b382c', jitter: 1.4 });

  // 胶带
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#e7dcb2';
  ctx.translate(96, 14);
  ctx.rotate(-0.44);
  ctx.fillRect(-40, -10, 80, 20);
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = '#7a6c48';
  ctx.lineWidth = 1;
  ctx.strokeRect(-40, -10, 80, 20);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#e7dcb2';
  ctx.translate(1184, 14);
  ctx.rotate(0.42);
  ctx.fillRect(-40, -10, 80, 20);
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = '#7a6c48';
  ctx.lineWidth = 1;
  ctx.strokeRect(-40, -10, 80, 20);
  ctx.restore();

  handText(ctx, game.state === 'title' ? '封面' : '第 ' + game.round + ' 页', 1188, 680, {
    size: 17, align: 'right', alpha: 0.35, rot: -1.5
  });

  handText(ctx, '纸上决斗', 88, 680, {
    size: 13, align: 'left', alpha: 0.24, family: HAND
  });
}

function drawTitleScene() {
  drawFloor();
  const order = [game.p1, game.p2];
  for (const f of order) {
    drawFighterShadow(ctx, f.x, f.y, WORLD.floor, f.color);
    drawStickman(ctx, f.x, f.y, f.facing, idlePose(game.time + (f === game.p2 ? 1.7 : 0)), {
      color: f.color,
      blink: f.blink > 0,
      style: f.style
    });
    handText(ctx, f.name, f.x, f.y - 168, {
      size: 17, alpha: 0.4, color: f.color, rot: f === game.p2 ? 2 : -2
    });
  }
}

function drawArena() {
  Effects.drawDecals(ctx);
  drawFloor();

  const order = [game.p1, game.p2].slice().sort((a, b) => a.y - b.y);
  for (const f of order) drawFighter(f);

  Effects.drawFront(ctx);
  if (game.state !== 'matchEnd') {
    drawCombo(game.p1);
    drawCombo(game.p2);
    drawHUD();
  }

  if (game.state === 'fight' && game.round === 1 && game.fightTime < 4.5) {
    const hint = game.mode === '2p'
      ? 'P1：WASD + J/K/F　·　P2：方向键 + , . /'
      : 'J 出拳 · K 踢腿 · S 格挡 · S + J 上勾拳';
    handText(ctx, hint, 640, 190, {
      size: 15, alpha: 0.32 * clamp((4.5 - game.fightTime) / 1.2, 0, 1), rot: -0.5
    });
  }

  if (game.state === 'intro') drawIntro();
  if (game.state === 'ko') drawKO();

  if (game.state === 'matchEnd') {
    handText(ctx, '终', 1024, 330, {
      size: 190, alpha: 0.055, rot: -9, color: '#2b382c'
    });
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#a33428';
    roundRectPath(ctx, 1128, 108, 58, 58, 6);
    ctx.fill();
    ctx.restore();
    handText(ctx, '终', 1157, 138, {
      size: 30, alpha: 0.88, color: '#f2e9d2', rot: 1
    });
  }
}

function drawFighter(f) {
  const pose = f.getPose();

  for (const im of f.afterimages) {
    const k = clamp(im.life / im.max, 0, 1);
    drawStickman(ctx, im.x, im.y, im.facing, im.pose, {
      color: f.color,
      alpha: k * 0.4,
      width: 1.02,
      ghost: true
    });
  }

  drawFighterShadow(ctx, f.x, f.y, WORLD.floor, f.color);

  if (f.hurtFlash > 0) {
    drawStickman(ctx, f.x, f.y, f.facing, pose, {
      color: '#f4f0d9',
      alpha: clamp(f.hurtFlash / 0.13, 0, 1) * 0.65,
      width: 1.45,
      ghost: true
    });
  }

  drawStickman(ctx, f.x, f.y, f.facing, pose, {
    color: f.color,
    blink: f.blink > 0,
    style: f.style
  });

  if (f.state === 'ko' && f.onGround) {
    const t = game.time * 3.2;
    for (let i = 0; i < 3; i++) {
      const a = t + i * (TAU / 3);
      const sx = f.x + Math.cos(a) * 42;
      const sy = f.y - 66 + Math.sin(a) * 12;
      sketchStar(ctx, sx, sy, 5.5, 4, { width: 1.4, alpha: 0.5, color: f.color });
    }
  }

  const showReady = f === game.p1 || (game.mode === '2p' && f === game.p2);
  if (showReady && f.meter >= 100 && game.state === 'fight' && f.state !== 'ko') {
    const pulse = 0.65 + Math.sin(game.time * 7) * 0.25;
    pencilEllipse(ctx, f.x, f.y - 190, 14, 13, { width: 1.8, alpha: pulse });
    handText(ctx, '必', f.x, f.y - 190, { size: 16, alpha: pulse, color: '#7e2d24' });
  }
}

function drawFloor() {
  pencilPath(ctx, [
    [70, WORLD.floor], [280, WORLD.floor + 1.5], [520, WORLD.floor - 1],
    [760, WORLD.floor + 1], [1000, WORLD.floor - 1], [1200, WORLD.floor]
  ], { width: 2.7, alpha: 0.52, jitter: 1.3 });

  ctx.save();
  let tick = 0;
  for (let x = 84; x < 1200; x += 58) {
    const h = 6 + ((tick++ * 7) % 9);
    pencilPath(ctx, [
      [x, WORLD.floor + 3],
      [x + 8, WORLD.floor + 3 + h]
    ], { width: 1.3, alpha: 0.13, jitter: 1 });
  }
  ctx.restore();

  // 舞台边界的两个小叉
  for (const x of [WORLD.left, WORLD.right]) {
    pencilPath(ctx, [[x - 6, WORLD.floor - 6], [x + 6, WORLD.floor + 4]], { width: 1.3, alpha: 0.2 });
    pencilPath(ctx, [[x + 6, WORLD.floor - 6], [x - 6, WORLD.floor + 4]], { width: 1.3, alpha: 0.2 });
  }
}

/* ---------- HUD ---------- */

function drawHealthBar(x, y, w, h, f, mirror) {
  const hp = clamp(f.hp, 0, 100);
  const ghost = clamp(f.ghostHp, 0, 100);

  ctx.save();
  ctx.fillStyle = 'rgba(250, 252, 233, 0.3)';
  ctx.fillRect(x, y, w, h);

  const gw = (w - 4) * ghost / 100;
  ctx.fillStyle = 'rgba(150, 62, 46, 0.22)';
  if (mirror) ctx.fillRect(x + 2 + (w - 4) - gw, y + 2, gw, h - 4);
  else ctx.fillRect(x + 2, y + 2, gw, h - 4);

  const hw = (w - 4) * hp / 100;
  if (hw > 0.5) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(mirror ? x + 2 + (w - 4) - hw : x + 2, y + 2, hw, h - 4);
    ctx.clip();
    ctx.fillStyle = 'rgba(126, 45, 36, 0.8)';
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    ctx.globalAlpha = 0.42;
    ctx.strokeStyle = '#2b382c';
    ctx.lineWidth = 1.1;
    for (let i = -h; i < w + h; i += 9) {
      ctx.beginPath();
      ctx.moveTo(x + i, y + h);
      ctx.lineTo(x + i + h, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  roughRect(ctx, x, y, w, h, { width: 2, alpha: 0.72, color: '#2b382c', jitter: 0.7 });

  // 满血时的小尖角
  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = '#2b382c';
  ctx.beginPath();
  if (mirror) {
    ctx.moveTo(x + 2, y);
    ctx.lineTo(x + 10, y - 4);
  } else {
    ctx.moveTo(x + w - 2, y);
    ctx.lineTo(x + w - 10, y - 4);
  }
  ctx.stroke();
  ctx.restore();
}

function drawMeter(x, y, w, h, f, mirror) {
  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = '#2b382c';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(x, y, w, h);
  const k = clamp(f.meter / 100, 0, 1);
  const fw = (w - 4) * k;
  if (fw > 0.5) {
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = k >= 1 ? '#7e2d24' : '#3c4d38';
    if (mirror) ctx.fillRect(x + 2 + (w - 4) - fw, y + 2, fw, h - 4);
    else ctx.fillRect(x + 2, y + 2, fw, h - 4);
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = '#eef6d7';
    ctx.lineWidth = 0.9;
    for (let i = 0; i < w; i += 7) {
      ctx.beginPath();
      ctx.moveTo(x + i, y + h);
      ctx.lineTo(x + i + h, y);
      ctx.stroke();
    }
  }
  if (k >= 1) {
    const pulse = 0.55 + Math.sin(game.time * 8) * 0.3;
    handText(ctx, 'MAX', x + (mirror ? w - 3 : 3), y - 4, {
      size: 10, alpha: pulse, align: mirror ? 'right' : 'left', family: SCRATCH, color: '#7e2d24'
    });
  }
  ctx.restore();
}

function drawHUD() {
  const p1 = game.p1, p2 = game.p2;
  const y = 52, h = 17, w = 414;

  drawHealthBar(92, y, w, h, p1, false);
  drawHealthBar(1188 - w, y, w, h, p2, true);

  handText(ctx, '铅笔 · P1', 92, 31, { size: 20, align: 'left', alpha: 0.86, color: '#2b382c' });
  handText(ctx, '橡皮 · ' + (game.mode === '2p' ? 'P2' : 'CPU'), 1188, 31, {
    size: 20, align: 'right', alpha: 0.86, color: '#5b3029'
  });

  drawMeter(92, 78, 268, 6, p1, false);
  drawMeter(1188 - 268, 78, 268, 6, p2, true);

  handText(ctx, '气', 92 + 274, 81, { size: 11, align: 'left', alpha: 0.45 });
  handText(ctx, '气', 1188 - 274, 81, { size: 11, align: 'right', alpha: 0.45 });

  for (let i = 0; i < 2; i++) {
    const cx1 = 92 + i * 17;
    const cx2 = 1188 - i * 17;
    pencilEllipse(ctx, cx1, 96, 5, 5, { width: 1.4, alpha: 0.55 });
    pencilEllipse(ctx, cx2, 96, 5, 5, { width: 1.4, alpha: 0.55 });
    if (p1.wins > i) inkDot(ctx, cx1, 96, 3.6, '#7e2d24', 0.85);
    if (p2.wins > i) inkDot(ctx, cx2, 96, 3.6, '#7e2d24', 0.85);
  }

  const secs = Math.max(0, Math.ceil(game.roundTime));
  pencilEllipse(ctx, 640, 68, 38, 34, { width: 1.6, alpha: 0.25 });
  handText(ctx, (secs < 10 ? '0' : '') + secs, 640, 69, {
    size: 44,
    rot: -1,
    alpha: 0.92,
    color: secs <= 10 ? '#7e2d24' : '#2b382c'
  });
  handText(ctx, '第 ' + game.round + ' 回合', 640, 22, { size: 15, alpha: 0.5 });
}

function drawCombo(f) {
  if (f.combo < 2 || f.comboTimer <= 0) return;
  if (f.state === 'ko' || f.state === 'win') return;
  const side = f === game.p1 ? -1 : 1;
  const x = clamp(f.x + side * 96, 120, 1160);
  const y = f.y - 216;
  const t = f.comboTimer;
  const life = clamp((1.6 - t) / 0.18, 0, 1);
  const alpha = clamp(t / 0.35, 0, 1) * 0.95;
  handText(ctx, f.combo + ' 连击', x, y, {
    size: 24,
    color: '#7e2d24',
    rot: side * 7,
    alpha,
    scale: 0.8 + life * 0.35,
    outline: 'rgba(210, 228, 184, 0.6)',
    outlineWidth: 6
  });
}

/* ---------- 回合文字 ---------- */

function drawIntro() {
  const t = game.introT;

  if (t < 1.08) {
    const a = clamp(t / 0.2, 0, 1) * (1 - clamp((t - 0.9) / 0.18, 0, 1));
    const sc = 0.88 + easeOutBack(clamp(t / 0.34, 0, 1)) * 0.12;
    handText(ctx, '第 ' + game.round + ' 回合', 640, 292, {
      size: 56,
      alpha: a,
      rot: -2,
      scale: sc,
      outline: 'rgba(207, 227, 178, 0.85)',
      outlineWidth: 12,
      underline: true,
      underlineWidth: 4
    });
  } else if (t < 1.58) {
    const k = clamp((t - 1.08) / 0.26, 0, 1);
    handText(ctx, '开 打 !', 640, 300, {
      size: 92,
      alpha: clamp(k * 2.2, 0, 1),
      rot: 2.5,
      scale: 1 + easeOutBack(k) * 0.14,
      color: '#7e2d24',
      outline: 'rgba(207, 227, 178, 0.9)',
      outlineWidth: 16
    });
    if (k < 0.55) {
      const r = 60 + k * 210;
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU + 0.2;
        pencilPath(ctx, [
          [640 + Math.cos(a) * (r * 0.7), 300 + Math.sin(a) * (r * 0.5)],
          [640 + Math.cos(a) * r, 300 + Math.sin(a) * (r * 0.72)]
        ], { width: 2, alpha: (0.55 - k) * 0.9, jitter: 2 });
      }
    }
  }
}

function drawKO() {
  const t = game.koT;
  const isTime = game.koReason === 'time';
  const k = clamp(t / 0.32, 0, 1);
  const sc = 0.55 + easeOutBack(k) * 0.55;

  if (isTime) {
    handText(ctx, '时间到', 640, 255, {
      size: 76,
      alpha: clamp(t / 0.14, 0, 1),
      rot: -4,
      scale: sc,
      color: '#2b382c',
      outline: 'rgba(207, 227, 178, 0.9)',
      outlineWidth: 16
    });
  } else {
    handText(ctx, 'K.O.', 640, 250, {
      size: 128,
      alpha: clamp(t / 0.12, 0, 1),
      rot: -5,
      scale: sc,
      color: '#7e2d24',
      family: SCRATCH,
      outline: 'rgba(207, 227, 178, 0.92)',
      outlineWidth: 18
    });
    // 手绘放射线
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + 0.15;
      const r0 = 120 + k * 20;
      const r1 = r0 + 24 + (i % 3) * 16;
      pencilPath(ctx, [
        [640 + Math.cos(a) * r0, 255 + Math.sin(a) * (r0 * 0.62)],
        [640 + Math.cos(a) * r1, 255 + Math.sin(a) * (r1 * 0.62)]
      ], { width: 2.4, alpha: 0.4 * (1 - k * 0.4), jitter: 2.5 });
    }
  }

  if (t > 0.32) {
    const a = clamp((t - 0.32) / 0.22, 0, 1);
    const sub = game.roundWinner
      ? game.roundWinner.name + ' 拿下第 ' + game.round + ' 回合'
      : '双双倒下 · 平局';
    handText(ctx, sub, 640, 330, {
      size: 24,
      alpha: a * 0.95,
      rot: -1,
      outline: 'rgba(207, 227, 178, 0.75)',
      outlineWidth: 7
    });
  }
}

/* ---------- 翻页 ---------- */

function drawPage() {
  const t = clamp(game.pageT / PAGE_DUR, 0, 1);
  const e = easeInOutQuad(t);
  const edge = WORLD.w + 70 - e * (WORLD.w + 220);

  ctx.save();

  // 翻起的纸页投在旧页面上的影子
  const cast = ctx.createLinearGradient(edge - 90, 0, edge, 0);
  cast.addColorStop(0, 'rgba(45, 65, 35, 0)');
  cast.addColorStop(0.65, 'rgba(45, 65, 35, 0.12)');
  cast.addColorStop(1, 'rgba(45, 65, 35, 0.3)');
  ctx.fillStyle = cast;
  ctx.fillRect(edge - 90, -40, 90, WORLD.h + 80);

  // 新的一页
  ctx.beginPath();
  ctx.moveTo(edge, -40);
  ctx.quadraticCurveTo(edge + 88, WORLD.h * 0.48, edge, WORLD.h + 40);
  ctx.lineTo(WORLD.w + 90, WORLD.h + 40);
  ctx.lineTo(WORLD.w + 90, -40);
  ctx.closePath();
  ctx.fillStyle = '#c9e4ac';
  ctx.fill();

  const shade = ctx.createLinearGradient(edge, 0, edge + 240, 0);
  shade.addColorStop(0, 'rgba(70, 96, 55, 0.32)');
  shade.addColorStop(0.08, 'rgba(255, 253, 226, 0.3)');
  shade.addColorStop(0.45, 'rgba(255, 255, 255, 0.06)');
  shade.addColorStop(1, 'rgba(90, 118, 74, 0.18)');
  ctx.fillStyle = shade;
  ctx.fill();

  ctx.save();
  ctx.clip();
  // 纸页上的一道折痕
  ctx.strokeStyle = 'rgba(84, 106, 66, 0.18)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(edge, 151);
  ctx.lineTo(WORLD.w + 90, 152);
  ctx.stroke();

  handText(ctx, game.pageLabel, 790, 348, { size: 58, alpha: 0.46, rot: -8, color: '#2b382c' });
  handText(ctx, '翻 页', 790, 408, { size: 18, alpha: 0.3, rot: -8, color: '#2b382c' });
  for (let i = 0; i < 3; i++) {
    pencilPath(ctx, [
      [710, 470 + i * 12],
      [740, 466 + i * 12],
      [770, 472 + i * 12],
      [800, 466 + i * 12]
    ], { width: 1.6, alpha: 0.18, jitter: 1.8 });
  }
  ctx.restore();

  pencilPath(ctx, [
    [edge + 3, -30], [edge - 9, 170], [edge + 11, 380], [edge + 2, WORLD.h + 30]
  ], { width: 2.4, alpha: 0.4, jitter: 2.2 });

  ctx.restore();
}

/* ---------- 屏幕效果 ---------- */

function drawScreenEffects() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (game.flash > 0.002) {
    ctx.save();
    ctx.globalAlpha = clamp(game.flash, 0, 0.85);
    ctx.fillStyle = '#f7f4df';
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.restore();
  }
  if (vignetteGrad) {
    ctx.fillStyle = vignetteGrad;
    ctx.fillRect(0, 0, view.w, view.h);
  }
}

/* ---------------------------------------------------------------
   主循环
   --------------------------------------------------------------- */

let lastTime = performance.now();

function loop(now) {
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  if (!isFinite(dt) || dt <= 0) dt = 1 / 60;
  dt = Math.min(dt, 0.05);

  BOIL.timer += dt;
  if (BOIL.timer > 0.09) {
    BOIL.timer = 0;
    kickBoil();
  }

  if (!game.paused) update(dt);
  render();
  requestAnimationFrame(loop);
}

/* ---------------------------------------------------------------
   绑定
   --------------------------------------------------------------- */

function updateMuteLabels() {
  const label = '音效：' + (Sfx.muted ? '关' : '开');
  if (ui.muteBtn) ui.muteBtn.textContent = label;
  if (ui.muteBtn2) ui.muteBtn2.textContent = label;
}

function toggleMute() {
  Sfx.resume();
  Sfx.toggle();
  updateMuteLabels();
  Sfx.ui();
}

function bindUI() {
  ui.startBtn.addEventListener('click', beginMatch);
  ui.resumeBtn.addEventListener('click', resumeGame);
  ui.restartPauseBtn.addEventListener('click', function () {
    hide(ui.pause);
    beginMatch();
  });
  ui.quitBtn.addEventListener('click', goTitle);
  ui.againBtn.addEventListener('click', beginMatch);
  ui.homeBtn.addEventListener('click', goTitle);
  ui.pauseBtn.addEventListener('click', togglePause);
  ui.muteBtn.addEventListener('click', toggleMute);
  ui.muteBtn2.addEventListener('click', toggleMute);

  ui.modeBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      Sfx.resume();
      setMode(btn.dataset.mode);
    });
  });

  ui.diffBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      game.difficulty = btn.dataset.level;
      ui.diffBtns.forEach(function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
      try { localStorage.setItem('paperduel.level', game.difficulty); } catch (e) {}
      Sfx.resume();
      Sfx.ui();
    });
  });

  window.addEventListener('keydown', function (e) {
    if (e.code === 'KeyM') { toggleMute(); return; }
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (game.state !== 'title' && game.state !== 'matchEnd') togglePause();
      return;
    }
    if (e.code === 'Enter') {
      if (!ui.menu.classList.contains('hidden')) { e.preventDefault(); beginMatch(); return; }
      if (!ui.result.classList.contains('hidden')) { e.preventDefault(); beginMatch(); return; }
      if (game.paused) { e.preventDefault(); resumeGame(); }
    }
  });

  document.querySelectorAll('#touch button').forEach(function (btn) {
    const act = btn.dataset.act;
    const press = function (e) {
      e.preventDefault();
      Sfx.resume();
      btn.classList.add('pressed');
      Input.hold(act, true);
      if (btn.setPointerCapture && e.pointerId != null) {
        try { btn.setPointerCapture(e.pointerId); } catch (err) {}
      }
    };
    const release = function (e) {
      if (e) e.preventDefault();
      btn.classList.remove('pressed');
      Input.hold(act, false);
    };
    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('pointerleave', release);
  });

  window.addEventListener('pointerdown', function () { Sfx.resume(); }, { passive: true });
  window.addEventListener('keydown', function () { Sfx.resume(); }, { passive: true });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && document.body.classList.contains('playing') && !game.paused) pauseGame();
  });

  let resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 80);
  });
  window.addEventListener('orientationchange', function () {
    setTimeout(resize, 160);
  });
}

/* ---------------------------------------------------------------
   启动
   --------------------------------------------------------------- */

function boot() {
  Sfx.load();
  updateMuteLabels();

  game.p1 = new Fighter({
    name: '铅笔', tag: 'P1', x: 268, facing: 1,
    color: '#2b382c', style: { hair: true }
  });
  game.p2 = new Fighter({
    name: '橡皮', tag: 'CPU', x: 1012, facing: -1,
    color: '#5b3029', style: { eraser: true }, isCPU: true
  });
  game.ai = new AI(game.difficulty);

  try {
    const savedLevel = localStorage.getItem('paperduel.level');
    if (savedLevel && AI_LEVELS[savedLevel]) {
      game.difficulty = savedLevel;
      game.ai.setLevel(savedLevel);
      ui.diffBtns.forEach(function (b) {
        b.setAttribute('aria-pressed', b.dataset.level === savedLevel ? 'true' : 'false');
      });
    }
  } catch (e) {}

  document.body.classList.toggle('touch', touchMode);

  let initialMode = '1p';
  if (!touchMode) {
    try {
      if (localStorage.getItem('paperduel.mode') === '2p') initialMode = '2p';
    } catch (e) {}
  }
  setMode(initialMode, true);

  buildPaper();
  bindUI();
  resize();
  requestAnimationFrame(loop);

  if (touchMode) {
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = '触屏：左下移动，右下出拳 / 踢腿 / 格挡 / 必杀 · 建议横屏';
    const card = document.querySelector('.menu-card');
    if (card) card.appendChild(hint);
  }
}

/* 调试入口，方便快速验证回合流程 */
window.__duel = {
  start: beginMatch,
  title: goTitle,
  ko: function (who) {
    const f = game[who || 'p2'];
    const by = f === game.p1 ? game.p2 : game.p1;
    if (f.state !== 'ko') f.knockOut(game, by);
  },
  setHp: function (who, hp) {
    game[who || 'p2'].hp = clamp(hp, 0, 100);
  },
  winRound: function (who) {
    const f = game[who || 'p2'];
    f.hp = 0;
    f.knockOut(game, f === game.p1 ? game.p2 : game.p1);
  }
};

boot();
