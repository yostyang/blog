'use strict';

/* ---------------------------------------------------------------
   对手 AI：会走位、格挡、抓硬直、偶尔跳入，气满会放必杀
   --------------------------------------------------------------- */

const AI_LEVELS = {
  easy: {
    interval: 0.82, block: 0.16, jump: 0.06, retreat: 0.12,
    punish: 0.2, super: 0.32, antiAir: 0.2, atkCd: [0.55, 0.95]
  },
  normal: {
    interval: 0.56, block: 0.4, jump: 0.1, retreat: 0.16,
    punish: 0.5, super: 0.65, antiAir: 0.45, atkCd: [0.34, 0.68]
  },
  hard: {
    interval: 0.4, block: 0.65, jump: 0.14, retreat: 0.2,
    punish: 0.78, super: 0.88, antiAir: 0.7, atkCd: [0.2, 0.45]
  }
};

class AI {
  constructor(level) {
    this.setLevel(level || 'normal');
  }

  setLevel(level) {
    this.level = AI_LEVELS[level] ? level : 'normal';
    this.p = AI_LEVELS[this.level];
    this.reset();
  }

  reset() {
    this.thinkT = 0.3;
    this.blockT = 0;
    this.atkCd = 0.4;
    this.jumpCd = 1;
    this.moveDir = 0;
    this.pending = null;
    this.wantJump = false;
    this.reactedAttack = null;
    this.airAttackUsed = false;
    this.airDir = 0;
  }

  emptyInput() {
    return {
      left: false, right: false, up: false, down: false,
      jumpPressed: false, punchPressed: false, kickPressed: false, superPressed: false
    };
  }

  update(dt, me, foe, game) {
    const input = this.emptyInput();
    if (!game || game.state !== 'fight') return input;
    if (me.state === 'ko' || me.state === 'win') return input;

    const p = this.p;
    this.thinkT -= dt;
    this.blockT -= dt;
    if (me.state !== 'attack') this.atkCd -= dt;
    this.jumpCd -= dt;

    const dx = foe.x - me.x;
    const adx = Math.abs(dx);
    const dir = dx >= 0 ? 1 : -1;

    if (me.onGround) this.airAttackUsed = false;

    /* 空中：接近并落踢 */
    if (!me.onGround) {
      if (me.state !== 'attack' && me.vy > -130 && !this.airAttackUsed && adx < 160) {
        input.kickPressed = true;
        this.airAttackUsed = true;
      }
      if (me.state !== 'attack' && adx > 100) {
        this.airDir = dir;
      }
      if (this.airDir > 0) input.right = true;
      if (this.airDir < 0) input.left = true;
      return input;
    }

    if (me.state === 'hit' || me.state === 'attack') return input;

    /* 对手出招时概率格挡 */
    if (foe.state === 'attack' && foe.attack && foe.attack !== this.reactedAttack) {
      this.reactedAttack = foe.attack;
      if (adx < 170) {
        const conf = p.block * (foe.attack.super ? 0.55 : 1);
        if (chance(conf)) {
          this.blockT = rand(0.22, 0.4);
          this.moveDir = 0;
          this.pending = null;
        }
      }
    }
    if (foe.state !== 'attack') this.reactedAttack = null;

    if (this.blockT > 0) {
      input.down = true;
      return input;
    }

    /* 对手在空中，考虑升龙 */
    if (!foe.onGround && foe.vy > -40 && adx < 150 && this.atkCd <= 0 && chance(p.antiAir * dt * 8)) {
      input.down = true;
      input.punchPressed = true;
      this.atkCd = rand(0.35, 0.6);
      this.pending = null;
      return input;
    }

    /* 抓对手硬直 */
    if (foe.state === 'hit' && adx < 125 && this.atkCd <= 0 && chance(p.punish * dt * 6)) {
      if (adx < 96) input.punchPressed = true;
      else input.kickPressed = true;
      this.atkCd = rand(p.atkCd[0], p.atkCd[1]);
      this.pending = null;
      return input;
    }

    if (this.thinkT <= 0) {
      this.thinkT = p.interval * rand(0.8, 1.25);
      this.decide(me, foe, adx, dir, p);
    }

    /* 执行移动 */
    if (this.pending) {
      const range = this.pending === 'kick' ? 126
        : this.pending === 'super' ? 112
          : this.pending === 'uppercut' ? 98 : 96;
      if (adx > range) {
        this.moveDir = dir;
      } else if (this.atkCd <= 0) {
        if (this.pending === 'super') {
          if (me.meter >= 100) {
            input.superPressed = true;
            this.atkCd = rand(0.5, 0.8);
          } else {
            this.pending = null;
          }
        } else if (this.pending === 'uppercut') {
          input.down = true;
          input.punchPressed = true;
          this.atkCd = rand(p.atkCd[0], p.atkCd[1]);
        } else if (this.pending === 'kick') {
          input.kickPressed = true;
          this.atkCd = rand(p.atkCd[0], p.atkCd[1]);
        } else {
          input.punchPressed = true;
          this.atkCd = rand(p.atkCd[0], p.atkCd[1]);
        }
        this.pending = null;
      }
    }

    if (this.moveDir && adx > 74) {
      if (this.moveDir > 0) input.right = true;
      else input.left = true;
    }

    if (this.wantJump && this.jumpCd <= 0) {
      input.jumpPressed = true;
      this.airDir = dir;
      this.wantJump = false;
      this.jumpCd = rand(1.1, 2.2);
    }

    return input;
  }

  decide(me, foe, adx, dir, p) {
    this.pending = null;
    this.wantJump = false;
    this.moveDir = 0;

    if (adx > 320) {
      this.moveDir = dir;
      return;
    }

    if (adx > 170) {
      this.moveDir = dir;
      if (chance(p.jump * 0.8)) this.wantJump = true;
      return;
    }

    if (adx > 135) {
      if (chance(p.retreat * 0.6)) this.moveDir = -dir;
      else this.moveDir = dir;
      return;
    }

    const roll = Math.random();
    if (me.meter >= 100 && chance(p.super)) {
      this.pending = 'super';
    } else if (roll < 0.42) {
      this.pending = 'punch';
    } else if (roll < 0.66) {
      this.pending = 'kick';
    } else if (roll < 0.78) {
      this.pending = 'uppercut';
    } else if (roll < 0.9) {
      this.moveDir = -dir;
    } else {
      this.wantJump = true;
    }
  }
}
