'use strict';

/* ---------------------------------------------------------------
   火柴人战士：移动、跳跃、格挡、拳脚、上勾拳、必杀、受击、KO
   --------------------------------------------------------------- */

const GRAVITY = 2450;
const MOVE_SPEED = 330;
const JUMP_VY = -835;
const MIN_SEPARATION = 72;

/* ---------------- 姿势 ---------------- */

const IDLE_BASE = P();

const POSE = {
  guard: P(),
  punchWind: P({ lean: 1, headTilt: -2, hipH: 63, armF: [78, -105], armB: [100, -55] }),
  punchHit: P({
    lean: 15, hipShift: 4, headTilt: 2, armF: [4, 2], armB: [112, -75],
    legF: [70, 94], legB: [112, 98], eye: 'angry'
  }),
  crossWind: P({ lean: -4, headTilt: -2, armB: [88, -105], armF: [70, -70] }),
  crossHit: P({
    lean: 19, hipShift: 5, headTilt: 3, armB: [6, 0], armF: [100, -80],
    legF: [68, 94], legB: [112, 100], eye: 'angry'
  }),
  kickChamber: P({
    lean: -7, hipH: 66, headTilt: -4, legF: [35, 125], legB: [104, 98],
    armF: [48, -85], armB: [118, -50]
  }),
  kickHit: P({
    lean: -16, hipH: 64, headTilt: -6, legF: [8, -2], legB: [100, 100],
    armF: [120, -35], armB: [150, -25], eye: 'angry'
  }),
  upperCrouch: P({
    hipH: 48, lean: 15, headTilt: 4, legF: [65, 112], legB: [106, 112],
    armF: [98, -120], armB: [112, -85]
  }),
  upperHit: P({
    hipH: 72, lean: -7, hipShift: 6, headTilt: -8, armF: [-52, -88], armB: [132, -40],
    legF: [58, 96], legB: [120, 102], eye: 'angry'
  }),
  superWind: P({
    hipH: 56, lean: 12, headTilt: 5, armF: [110, -110], armB: [125, -95],
    legF: [86, 98], legB: [112, 104]
  }),
  superA: P({
    lean: 18, hipShift: 6, headTilt: 1, armF: [8, 22], armB: [100, -60],
    legF: [66, 94], legB: [112, 100], eye: 'angry'
  }),
  superB: P({
    lean: 8, hipShift: 3, headTilt: -2, armB: [-8, 18], armF: [105, -40],
    legF: [78, 92], legB: [106, 98], eye: 'angry'
  }),
  superC: P({
    lean: 24, hipShift: 9, headTilt: 4, armF: [0, 10], armB: [10, 5],
    legF: [62, 95], legB: [116, 102], eye: 'angry'
  }),
  airPunch: P({
    hipH: 66, lean: 9, headTilt: 2, legF: [38, 132], legB: [135, 100],
    armF: [8, 4], armB: [150, -40]
  }),
  airKick: P({
    hipH: 66, lean: 6, headTilt: -2, legF: [14, 2], legB: [145, 105],
    armF: [120, -30], armB: [155, -15], eye: 'angry'
  }),
  hit: P({
    lean: -26, headTilt: -16, hipH: 62, armF: [122, -18], armB: [163, -8],
    legF: [94, 86], legB: [122, 98], eye: 'x'
  }),
  block: P({
    hipH: 59, lean: 1, headTilt: -6, armF: [36, -106], armB: [78, -122],
    legF: [82, 94], legB: [104, 98]
  }),
  jump: P({
    hipH: 66, lean: 0, headTilt: -4, legF: [35, 120], legB: [140, 100],
    armF: [26, -40], armB: [152, -55]
  }),
  fall: P({
    hipH: 64, lean: -4, headTilt: -5, legF: [64, 108], legB: [122, 84],
    armF: [4, 26], armB: [176, -14]
  }),
  ko: P({
    hipH: 66, lean: -20, headTilt: -12, armF: [148, 158], armB: [172, 150],
    legF: [98, 82], legB: [126, 74], eye: 'ko'
  }),
  win: P({
    hipH: 66, lean: -3, headTilt: 5, armF: [-35, -55], armB: [118, 55],
    legF: [70, 92], legB: [114, 96], eye: 'happy'
  }),
  land: P({
    hipH: 56, lean: 12, legF: [70, 104], legB: [110, 106],
    armF: [72, -72], armB: [110, -58]
  })
};

function idlePose(t) {
  const b = Math.sin(t * 2.3);
  const b2 = Math.sin(t * 1.7 + 1);
  return P({
    hipH: 64 + b * 1.1,
    lean: 7 + b * 0.7,
    headTilt: b2 * 2.2,
    armF: [64 + b * 2.5, -64 - b * 1.6],
    armB: [104 - b * 2, -62 - b2 * 1.5],
    legF: [76 + b * 0.8, 92],
    legB: [108 - b * 0.8, 96]
  });
}

function walkPose(phase) {
  const s = Math.sin(phase);
  return P({
    hipH: 63 + Math.abs(s) * 1.8,
    lean: 10,
    headTilt: -2 * s,
    legF: [76 + 24 * s, 92 + 22 * Math.max(0, -s)],
    legB: [108 - 24 * s, 96 + 22 * Math.max(0, s)],
    armF: [64 - 8 * s, -64 + 5 * s],
    armB: [104 + 8 * s, -62 - 5 * s]
  });
}

/* ---------------- 招式 ---------------- */

const ATTACKS = {
  punch: {
    label: '直拳',
    duration: 0.33,
    activeStart: 0.08,
    activeEnd: 0.17,
    damage: 6,
    range: 100,
    hitYMin: -140,
    hitYMax: -58,
    kb: 150,
    hitstun: 0.26,
    blockstun: 0.13,
    meterGain: 7,
    hitstop: 0.05,
    shake: 4.5,
    move: 55,
    sfx: 'light',
    poses: [
      [0, POSE.guard], [0.12, POSE.punchWind], [0.26, POSE.punchHit],
      [0.55, POSE.punchHit], [1, POSE.guard]
    ]
  },
  cross: {
    label: '摆拳',
    duration: 0.4,
    activeStart: 0.11,
    activeEnd: 0.2,
    damage: 8.5,
    range: 104,
    hitYMin: -140,
    hitYMax: -55,
    kb: 195,
    hitstun: 0.3,
    blockstun: 0.15,
    meterGain: 8,
    hitstop: 0.06,
    shake: 6,
    move: 70,
    sfx: 'light',
    poses: [
      [0, POSE.guard], [0.14, POSE.crossWind], [0.3, POSE.crossHit],
      [0.58, POSE.crossHit], [1, POSE.guard]
    ]
  },
  kick: {
    label: '踢腿',
    duration: 0.56,
    activeStart: 0.17,
    activeEnd: 0.3,
    damage: 11.5,
    range: 128,
    hitYMin: -125,
    hitYMax: -22,
    kb: 330,
    hitstun: 0.36,
    blockstun: 0.18,
    meterGain: 10,
    hitstop: 0.08,
    shake: 9,
    move: 100,
    sfx: 'heavy',
    poses: [
      [0, POSE.guard], [0.14, POSE.kickChamber], [0.32, POSE.kickHit],
      [0.58, POSE.kickHit], [1, POSE.guard]
    ]
  },
  uppercut: {
    label: '上勾拳',
    duration: 0.68,
    activeStart: 0.14,
    activeEnd: 0.25,
    damage: 14,
    range: 102,
    hitYMin: -200,
    hitYMax: -55,
    kb: 220,
    launch: 430,
    hitstun: 0.6,
    blockstun: 0.22,
    meterGain: 12,
    hitstop: 0.1,
    shake: 11,
    move: 45,
    sfx: 'heavy',
    poses: [
      [0, POSE.guard], [0.12, POSE.upperCrouch], [0.26, POSE.upperHit],
      [0.55, POSE.upperHit], [1, POSE.guard]
    ]
  },
  super: {
    label: '必杀',
    duration: 0.95,
    activeStart: 0.2,
    activeEnd: 0.76,
    maxHits: 3,
    hitInterval: 0.17,
    damage: 8,
    range: 122,
    hitYMin: -175,
    hitYMax: -32,
    kb: 90,
    hitstun: 0.3,
    blockstun: 0.16,
    meterGain: 0,
    hitstop: 0.055,
    shake: 8,
    move: 340,
    sfx: 'heavy',
    super: true,
    poses: [
      [0, POSE.guard], [0.1, POSE.superWind], [0.24, POSE.superA],
      [0.38, POSE.superB], [0.52, POSE.superA], [0.68, POSE.superC],
      [0.88, POSE.guard], [1, POSE.guard]
    ]
  },
  airPunch: {
    label: '空中拳',
    air: true,
    duration: 0.45,
    activeStart: 0.1,
    activeEnd: 0.24,
    damage: 7,
    range: 108,
    hitYMin: -30,
    hitYMax: 108,
    kb: 220,
    hitstun: 0.32,
    blockstun: 0.16,
    meterGain: 6,
    hitstop: 0.06,
    shake: 6,
    poses: [
      [0, POSE.jump], [0.2, POSE.airPunch], [0.7, POSE.airPunch], [1, POSE.airPunch]
    ]
  },
  airKick: {
    label: '空中踢',
    air: true,
    duration: 0.52,
    activeStart: 0.12,
    activeEnd: 0.28,
    damage: 9.5,
    range: 116,
    hitYMin: -35,
    hitYMax: 115,
    kb: 260,
    hitstun: 0.36,
    blockstun: 0.18,
    meterGain: 8,
    hitstop: 0.07,
    shake: 8,
    poses: [
      [0, POSE.jump], [0.24, POSE.airKick], [0.7, POSE.airKick], [1, POSE.airKick]
    ]
  }
};

/* ---------------- 战士 ---------------- */

class Fighter {
  constructor(opts) {
    this.name = opts.name;
    this.tag = opts.tag || '';
    this.color = opts.color || '#2b382c';
    this.style = opts.style || {};
    this.isCPU = !!opts.isCPU;
    this.wins = 0;
    this.punchAlt = false;
    this.reset(opts.x, opts.facing);
  }

  reset(x, facing) {
    this.x = x;
    this.y = WORLD.floor;
    this.vx = 0;
    this.vy = 0;
    this.facing = facing;
    this.hp = 100;
    this.maxHp = 100;
    this.ghostHp = 100;
    this.meter = 0;
    this.state = 'idle';
    this.stateTime = 0;
    this.onGround = true;
    this.attack = null;
    this.attackTime = 0;
    this.hitsDone = 0;
    this.hitCd = 0;
    this.hitstun = 0;
    this.hitstunMax = 0;
    this.blockstun = 0;
    this.blocking = false;
    this.buffer = null;
    this.combo = 0;
    this.comboTimer = 0;
    this.hurtFlash = 0;
    this.landT = 0;
    this.blink = 0;
    this.blinkT = rand(1.6, 3.6);
    this.koRot = 0;
    this.koBounce = 0;
    this.afterimages = [];
    this.walkPhase = rand(0, TAU);
    this.superGlow = 0;
    this.airImageT = 0;
  }

  setBuffer(type) {
    this.buffer = { type, ttl: 0.28 };
  }

  canStartAttack() {
    return this.state !== 'ko' && this.state !== 'win' && this.state !== 'hit' && this.state !== 'attack';
  }

  startAttack(type) {
    const def = ATTACKS[type];
    if (!def || !this.canStartAttack()) return false;
    if (type === 'super') {
      if (this.meter < 100 || !this.onGround) return false;
      this.meter = 0;
      this.superGlow = 1;
      if (typeof game !== 'undefined') {
        game.flash = Math.max(game.flash, 0.28);
        game.addShake(7);
        game.zoomPunch(0.02);
        Effects.impact(this.x, this.y - 95, 8, this.facing);
        Effects.word(this.x, this.y - 190, '必杀！', 32, '#7e2d24', -6);
      }
      Sfx.super();
    } else {
      Sfx.swing(def.sfx);
    }
    this.attack = def;
    this.attackTime = 0;
    this.hitsDone = 0;
    this.hitCd = 0;
    this.state = 'attack';
    this.stateTime = 0;
    this.blocking = false;
    this.buffer = null;
    if (this.onGround) this.vx = 0;
    return true;
  }

  update(dt, input, opp, game) {
    this.stateTime += dt;
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    if (this.comboTimer <= 0) this.combo = 0;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.landT = Math.max(0, this.landT - dt);
    this.superGlow = Math.max(0, this.superGlow - dt * 0.9);

    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blink = 0.13; this.blinkT = rand(2.2, 5); }
    this.blink = Math.max(0, this.blink - dt);

    for (let i = this.afterimages.length - 1; i >= 0; i--) {
      this.afterimages[i].life -= dt;
      if (this.afterimages[i].life <= 0) this.afterimages.splice(i, 1);
    }

    if (this.state === 'ko') { this.updateKO(dt); return; }
    if (this.state === 'win') { this.updateWin(dt); return; }

    input = input || {};

    if (this.buffer) {
      this.buffer.ttl -= dt;
      if (this.buffer.ttl <= 0) this.buffer = null;
    }
    if (input.punchPressed) this.setBuffer(input.down ? 'uppercut' : 'punch');
    if (input.kickPressed) this.setBuffer('kick');
    if (input.superPressed) this.setBuffer('super');

    if (this.state === 'hit') {
      this.hitstun -= dt;
      this.physics(dt);
      if (this.hitstun <= 0) {
        this.state = this.onGround ? 'idle' : 'fall';
        this.stateTime = 0;
      }
      return;
    }

    if (this.state === 'attack') {
      this.updateAttack(dt, input, opp, game);
      this.physics(dt);
      return;
    }

    /* ---- 自由状态 ---- */
    if (this.onGround) this.facing = opp.x >= this.x ? 1 : -1;
    this.blocking = !!input.down && this.onGround;

    if (input.jumpPressed && this.onGround) {
      this.vy = JUMP_VY;
      this.onGround = false;
      this.state = 'jump';
      this.stateTime = 0;
      Sfx.jump();
      Effects.dust(this.x, WORLD.floor, 5, 0, 0.7);
    }

    if (this.buffer) {
      const type = this.buffer.type;
      if (!this.onGround) {
        if (type === 'punch' || type === 'cross' || type === 'uppercut' || type === 'kick') {
          if (type === 'kick') this.startAttack('airKick');
          else this.startAttack('airPunch');
          this.buffer = null;
        } else if (type === 'super') {
          this.buffer = null;
        }
      } else if (type === 'super') {
        if (this.meter >= 100) {
          this.startAttack('super');
        } else {
          this.buffer = null;
        }
      } else if (type === 'punch') {
        const next = this.punchAlt ? 'cross' : 'punch';
        this.punchAlt = !this.punchAlt;
        this.startAttack(next);
        this.buffer = null;
      } else if (type === 'uppercut') {
        this.startAttack('uppercut');
        this.buffer = null;
      } else if (type === 'kick') {
        this.startAttack('kick');
        this.buffer = null;
      }
    }

    if (this.state === 'attack') {
      this.physics(dt);
      return;
    }

    /* 移动 */
    if (this.onGround) {
      const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      const target = this.blocking ? 0 : dir * MOVE_SPEED;
      this.vx = approach(this.vx, target, 2800 * dt);
      if (dir !== 0 && !this.blocking) {
        this.walkPhase += dt * 12 * (dir === this.facing ? 1 : -1);
      }
      if (this.blocking) {
        this.state = 'block';
      } else if (Math.abs(this.vx) > 26) {
        this.state = 'walk';
      } else {
        this.state = 'idle';
      }
    } else {
      const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      this.vx = approach(this.vx, dir * 285, 1000 * dt);
      this.state = this.vy < 0 ? 'jump' : 'fall';
    }

    this.physics(dt);
  }

  physics(dt) {
    if (!this.onGround) {
      this.vy += GRAVITY * dt;
      this.y += this.vy * dt;
      if (this.y >= WORLD.floor) {
        this.y = WORLD.floor;
        const impactVy = this.vy;
        this.vy = 0;
        this.onGround = true;
        this.landT = 0.13;
        if (Math.abs(impactVy) > 120) {
          Effects.dust(this.x, WORLD.floor, 5, 0, 0.85);
          Sfx.land();
        }
        if (this.state === 'jump' || this.state === 'fall') {
          this.state = 'idle';
          this.stateTime = 0;
        }
        if (this.state === 'attack' && this.attack && this.attack.air) {
          this.attack = null;
          this.state = 'idle';
          this.stateTime = 0;
        }
      }
    }
    this.x += this.vx * dt;
    if (this.onGround && this.state !== 'walk' && this.state !== 'attack' && this.state !== 'jump') {
      this.vx *= Math.pow(0.0006, dt);
    }
    if (this.x < WORLD.left) { this.x = WORLD.left; if (this.vx < 0) this.vx = 0; }
    if (this.x > WORLD.right) { this.x = WORLD.right; if (this.vx > 0) this.vx = 0; }
  }

  updateAttack(dt, input, opp, game) {
    const a = this.attack;
    if (!a) { this.state = this.onGround ? 'idle' : 'fall'; return; }
    this.attackTime += dt;
    const t = this.attackTime;

    if (a.super) {
      this.airImageT += dt;
      if (this.airImageT > 0.035 && this.onGround) {
        this.airImageT = 0;
        this.afterimages.push({
          x: this.x, y: this.y, facing: this.facing,
          pose: this.getPose(), life: 0.28, max: 0.28
        });
        if (this.afterimages.length > 9) this.afterimages.shift();
      }
    }

    if (a.move && this.onGround) {
      const dx = (opp.x - this.x) * this.facing;
      if (dx > 48) this.x += this.facing * a.move * dt;
    }

    const maxHits = a.maxHits || 1;
    if (t >= a.activeStart && t <= a.activeEnd && this.hitsDone < maxHits) {
      this.hitCd -= dt;
      if (this.hitCd <= 0) {
        const hit = this.tryHit(opp, game, a);
        if (hit) {
          this.hitsDone++;
          this.hitCd = a.hitInterval || 99;
          if (this.hitsDone >= maxHits) this.hitCd = 99;
        }
      }
    }

    if (t >= a.duration) {
      this.attack = null;
      this.state = this.onGround ? 'idle' : 'fall';
      this.stateTime = 0;
    }
  }

  tryHit(opp, game, a) {
    if (!opp || opp.state === 'ko' || opp.state === 'win') return false;
    if (game && game.state !== 'fight') return false;

    const dx = (opp.x - this.x) * this.facing;
    if (dx < -8 || dx > a.range + 6) return false;

    const selfTop = this.y + a.hitYMin;
    const selfBottom = this.y + a.hitYMax;
    const oppTop = opp.y - 142;
    const oppBottom = opp.y + 4;
    if (selfBottom < oppTop || selfTop > oppBottom) return false;

    const blocked = opp.blocking && opp.onGround && opp.state !== 'hit';
    const maxHits = a.maxHits || 1;
    const isFinal = maxHits > 1 && this.hitsDone === maxHits - 1;

    const contactX = this.x + this.facing * clamp(dx * 0.72 + 14, 24, a.range * 0.86);
    const contactY = opp.y - 108;

    if (blocked) {
      const chip = Math.max(1, a.damage * (isFinal ? 0.2 : 0.12));
      opp.hp = Math.max(0, opp.hp - chip);
      opp.blockstun = a.blockstun;
      opp.state = 'block';
      opp.stateTime = 0;
      opp.vx = this.facing * a.kb * (isFinal ? 0.6 : 0.45);
      this.vx = -this.facing * 55;
      this.meter = Math.min(100, this.meter + 3);
      opp.meter = Math.min(100, opp.meter + 2);
      if (game) {
        game.addHitstop(isFinal ? 0.06 : 0.04);
        game.addShake(isFinal ? 6 : 3.5);
      }
      Effects.guard(contactX, contactY);
      Sfx.block();
      if (opp.hp <= 0) opp.knockOut(game, this);
      return true;
    }

    const wasHit = opp.state === 'hit' && opp.hitstun > 0;
    let dmg = a.damage;
    if (isFinal) dmg += 2;
    if (wasHit) dmg *= 0.88;
    opp.hp = Math.max(0, opp.hp - dmg);
    opp.hitstun = a.hitstun;
    opp.hitstunMax = a.hitstun;
    opp.state = 'hit';
    opp.stateTime = 0;
    opp.attack = null;
    opp.blocking = false;
    opp.hurtFlash = 0.13;
    opp.vx = this.facing * (isFinal ? Math.max(a.kb, 430) : a.kb);
    if (a.launch) {
      opp.vy = -a.launch * (isFinal ? 0.62 : 1);
      opp.onGround = false;
    }
    if (isFinal) {
      opp.vy = -210;
      opp.onGround = false;
    }

    if (wasHit) this.combo = Math.max(2, this.combo + 1);
    else this.combo = 1;
    this.comboTimer = 1.4;
    this.meter = Math.min(100, this.meter + (a.meterGain || 0));
    opp.meter = Math.min(100, opp.meter + 4);
    if (game) {
      game.addHitstop(a.hitstop || 0.05);
      game.addShake(a.shake || 6);
      game.zoomPunch(dmg >= 11 ? 0.022 : 0.012);
      if (a.super) game.flash = Math.max(game.flash, 0.16);
    }

    Effects.impact(contactX, contactY, dmg, this.facing);
    Sfx.hit(dmg);
    if (dmg >= 12) Effects.word(contactX, contactY - 36, isFinal ? '砰！' : '咚！', 34, '#7e2d24', rand(-12, 12));
    if (a.super) Effects.word(contactX, contactY - 40, pick(['唰！', '啪！']), 28, '#2b382c', rand(-14, 14));

    if (opp.hp <= 0) opp.knockOut(game, this);
    return true;
  }

  knockOut(game, by) {
    if (this.state === 'ko') return;
    this.hp = 0;
    this.state = 'ko';
    this.stateTime = 0;
    this.attack = null;
    this.hitstun = 0;
    this.blocking = false;
    this.koRot = 0;
    this.koBounce = 0;
    this.onGround = false;
    this.vy = -270;
    this.vx = by ? by.facing * 300 : this.vx;
    this.y = Math.min(this.y, WORLD.floor - 1);
    if (game) game.onKO(this, by);
  }

  updateKO(dt) {
    this.vy += GRAVITY * dt;
    this.y += this.vy * dt;
    this.x += this.vx * dt;

    if (this.x < WORLD.left) { this.x = WORLD.left; this.vx *= -0.3; }
    if (this.x > WORLD.right) { this.x = WORLD.right; this.vx *= -0.3; }

    if (this.y >= WORLD.floor) {
      this.y = WORLD.floor;
      if (Math.abs(this.vy) > 160 && this.koBounce < 2) {
        this.vy *= -0.3;
        this.koBounce++;
        Effects.dust(this.x, WORLD.floor, 8, 0, 1.1);
        Sfx.land();
      } else {
        this.vy = 0;
        this.onGround = true;
      }
      this.vx *= Math.pow(0.001, dt);
    }
    const target = 1.42;
    this.koRot = Math.min(target, this.koRot + dt * (this.onGround ? 3.4 : 2.6));
  }

  updateWin(dt) {
    if (!this.onGround) {
      this.vy += GRAVITY * dt;
      this.y += this.vy * dt;
      if (this.y >= WORLD.floor) {
        this.y = WORLD.floor;
        this.vy = 0;
        this.onGround = true;
        this.landT = 0.12;
      }
    }
    this.vx *= Math.pow(0.002, dt);
    this.x += this.vx * dt;
    this.x = clamp(this.x, WORLD.left, WORLD.right);
  }

  getPose() {
    const t = this.stateTime;
    let pose;

    switch (this.state) {
      case 'attack':
        pose = this.attack
          ? samplePose(this.attack.poses, clamp(this.attackTime / this.attack.duration, 0, 1))
          : POSE.guard;
        break;
      case 'block': pose = POSE.block; break;
      case 'hit': pose = POSE.hit; break;
      case 'ko': pose = POSE.ko; break;
      case 'win': pose = POSE.win; break;
      case 'jump': pose = POSE.jump; break;
      case 'fall': pose = POSE.fall; break;
      case 'walk': pose = walkPose(this.walkPhase); break;
      default: pose = idlePose(t); break;
    }

    if (this.landT > 0 && this.onGround && this.state !== 'ko') {
      pose = mixPose(pose, POSE.land, clamp(this.landT / 0.13, 0, 1) * 0.55);
    }

    const out = clonePose(pose);
    out.rot = this.state === 'ko' ? this.koRot : 0;
    if (this.state === 'block') out.lean += Math.sin(this.stateTime * 26) * 0.8;
    if (this.state === 'hit') out.lean += Math.sin(this.stateTime * 40) * 2.2;
    if (this.state === 'win') out.hipH += Math.abs(Math.sin(t * 5.5)) * 4;
    if (this.state === 'walk') out.hipH += Math.sin(this.walkPhase * 2) * 1.2;
    return out;
  }
}
