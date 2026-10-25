import {
  GROUND_Y,
  LEVEL_W,
  clamp,
  lerp,
  rand,
  choose,
  chance,
  easeOutCubic,
  easeInCubic,
  easeInOutQuad,
  nextId,
} from './core.js';
import { drawSlash, glow, hexToRgba } from './gfx.js';

const GRAVITY = 2250;

const MELEE_AIR = {
  name: '空中回旋',
  mult: 1.15,
  duration: 0.4,
  active: [0.08, 0.2],
  range: 138,
  height: 128,
  knock: 220,
  launch: -120,
  shake: 3,
  stop: 0.032,
  cancelAt: 0.16,
  style: 'air',
  shape: 'circle',
};

export const HERO_KITS = {
  wukong: {
    maxCombo: 4,
    weapon: 'staff',
    attackLabel: '棍击',
    attacks: [
      { name: '前劈·左', mult: 0.9, duration: 0.3, active: [0.07, 0.15], range: 126, height: 112, knock: 120, launch: 0, shake: 2.8, stop: 0.03, style: 'w1', shape: 'rect' },
      { name: '前劈·右', mult: 1.08, duration: 0.31, active: [0.08, 0.17], range: 134, height: 116, knock: 180, launch: -35, shake: 3.2, stop: 0.034, style: 'w2', shape: 'rect' },
      { name: '横扫千军', mult: 1.38, duration: 0.42, active: [0.14, 0.24], range: 158, height: 120, knock: 235, launch: -30, shake: 4.4, stop: 0.045, style: 'w3', shape: 'circle' },
      { name: '定海翻江', mult: 2.25, duration: 0.58, active: [0.19, 0.31], range: 178, height: 126, knock: 390, launch: -320, shake: 7, stop: 0.07, style: 'w4', shape: 'circle' },
    ],
    air: MELEE_AIR,
  },
  shaseng: {
    maxCombo: 4,
    weapon: 'shovel',
    attackLabel: '铲击',
    attacks: [
      { name: '卷沙·左', mult: 0.95, duration: 0.31, active: [0.075, 0.16], range: 128, height: 110, knock: 130, launch: 0, shake: 2.8, stop: 0.03, style: 's1', shape: 'rect' },
      { name: '卷沙·右', mult: 1.14, duration: 0.32, active: [0.08, 0.18], range: 138, height: 118, knock: 175, launch: -55, shake: 3.2, stop: 0.035, style: 's2', shape: 'rect' },
      { name: '流沙横断', mult: 1.36, duration: 0.43, active: [0.14, 0.25], range: 162, height: 120, knock: 245, launch: -40, shake: 4.6, stop: 0.046, style: 's3', shape: 'circle' },
      { name: '月牙穿心', mult: 2.2, duration: 0.52, active: [0.16, 0.27], range: 206, height: 86, knock: 460, launch: -90, shake: 6.2, stop: 0.06, style: 's4', shape: 'thrust' },
    ],
    air: MELEE_AIR,
  },
  bajie: {
    maxCombo: 3,
    weapon: 'rake',
    attackLabel: '耙击',
    attacks: [
      { name: '倒打一耙', mult: 1.48, duration: 0.36, active: [0.1, 0.19], range: 148, height: 114, knock: 180, launch: -20, shake: 3.4, stop: 0.035, style: 'b1', shape: 'rect' },
      { name: '回身再耙', mult: 1.72, duration: 0.38, active: [0.11, 0.2], range: 156, height: 118, knock: 220, launch: -55, shake: 4, stop: 0.04, style: 'b2', shape: 'rect' },
      { name: '九齿山河', mult: 2.9, duration: 0.64, active: [0.22, 0.35], range: 186, height: 132, knock: 430, launch: -340, shake: 8, stop: 0.075, style: 'b3', shape: 'circle' },
    ],
    air: MELEE_AIR,
  },
  tangseng: {
    maxCombo: 1,
    weapon: 'scepter',
    attackLabel: '法球',
    ranged: true,
    attacks: [
      { name: '法球', mult: 1, duration: 0.42, active: [0.16, 0.19], range: 0, height: 0, knock: 0, launch: 0, shake: 1.4, stop: 0.02, style: 't1', shape: 'ranged', ranged: true },
    ],
    air: { ...MELEE_AIR, ranged: true, style: 't1', shape: 'ranged' },
  },
};

export function getHeroKit(heroId) {
  return HERO_KITS[heroId] || HERO_KITS.wukong;
}

export class Player {
  constructor(game) {
    this.game = game;
    this.id = nextId();
    this.x = 460;
    this.y = GROUND_Y;
    this.vx = 0;
    this.vy = 0;
    this.w = 46;
    this.h = 100;
    this.visualScale = 1.45;
    this.facing = 1;
    this.state = 'idle';
    this.stateTime = 0;
    this.animTime = rand(0, 10);
    this.runPhase = 0;
    this.onGround = true;
    this.jumpsLeft = 2;
    this.jumpBuffer = 0;
    this.coyote = 0.1;
    this.jumpCut = true;
    this.airDashUsed = false;
    this.invuln = 0;
    this.hitFlash = 0;
    this.hurtTimer = 0;
    this.hitSpeedTimer = 0;
    this.dashGuardTimer = 0;
    this.firstShield = false;
    this.forceCrit = false;
    this.dead = false;
    this.deathTimer = 0;
    this.maxHp = game.stats.maxHp;
    this.hp = this.maxHp;
    this.maxEnergy = 100;
    this.energy = 65;
    this.sinceDamage = 99;
    this.dashTimer = 0;
    this.dashCd = 0;
    this.dashDir = 1;
    this.dashPressed = false;
    this.heavyTimer = 0;
    this.heavyPhase = 'none';
    this.heavyCd = 0;
    this.castTimer = 0;
    this.castCd = 0;
    this.castFired = false;
    this.ultTimer = 0;
    this.ultPulse = 0;
    this.ultActive = false;
    this.attackStep = 0;
    this.attackTimer = 0;
    this.attackDuration = 0;
    this.attackHit = false;
    this.attackQueued = false;
    this.attackBuffer = 0;
    this.comboWindow = 0;
    this.comboStep = 0;
    this.currentAttack = null;
    this.attackAir = false;
    this.attackRanged = false;
    this.rangedType = null;
    this.walkDust = 0;
    this.trailTimer = 0;
    this.impactFlash = 0;
  }

  get alive() {
    return !this.dead;
  }

  addEnergy(amount) {
    this.energy = clamp(this.energy + amount, 0, this.maxEnergy);
  }

  syncMaxHp(newMax, healDifference = true) {
    const diff = newMax - this.maxHp;
    this.maxHp = newMax;
    if (diff > 0 && healDifference) this.hp = Math.min(this.maxHp, this.hp + diff);
    else this.hp = Math.min(this.hp, this.maxHp);
  }

  update(game, dt) {
    this.animTime += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.impactFlash = Math.max(0, this.impactFlash - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.heavyCd = Math.max(0, this.heavyCd - dt);
    this.castCd = Math.max(0, this.castCd - dt);
    this.attackBuffer = Math.max(0, this.attackBuffer - dt);
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.sinceDamage += dt;
    this.hitSpeedTimer = Math.max(0, this.hitSpeedTimer - dt);
    this.dashGuardTimer = Math.max(0, this.dashGuardTimer - dt);

    if (this.comboWindow > 0) {
      this.comboWindow = Math.max(0, this.comboWindow - dt);
      if (this.comboWindow <= 0) this.comboStep = 0;
    }

    if (!this.dead) {
      const regen = 6.2 + (game.stats.energyRegen || 0);
      this.energy = clamp(this.energy + regen * dt, 0, this.maxEnergy);
      if (!game.rogueMode && this.sinceDamage > 4.5 && this.hp < this.maxHp) {
        this.hp = Math.min(this.maxHp, this.hp + 9 * dt);
      }
    }

    if (this.dead) {
      this.deathTimer += dt;
      this.vx *= Math.pow(0.9, dt * 60);
      this.vy += GRAVITY * 0.6 * dt;
      this.y += this.vy * dt;
      if (this.y > GROUND_Y) {
        this.y = GROUND_Y;
        this.vy = 0;
      }
      return;
    }

    const input = game.input;
    this.dashPressed = input.wasActionPressed('dash');

    if (this.state === 'ult') {
      this.updateUlt(game, dt);
      this.physics(game, dt, 0.25);
      return;
    }

    if (this.state === 'hurt') {
      this.hurtTimer -= dt;
      this.vx *= Math.pow(0.86, dt * 60);
      this.physics(game, dt, 1);
      if (this.hurtTimer <= 0) this.state = this.onGround ? 'idle' : 'fall';
      return;
    }

    if (this.state === 'dash') {
      this.dashTimer -= dt;
      this.trailTimer -= dt;
      if (this.trailTimer <= 0) {
        this.trailTimer = 0.025;
        game.addParticle({
          x: this.x - this.facing * rand(10, 30),
          y: this.y - rand(20, 78),
          vx: -this.facing * rand(20, 90),
          vy: rand(-15, 15),
          life: rand(0.12, 0.24),
          size: rand(2, 6),
          color: choose(['#ffd27c', '#ff9b57', '#fff2c6']),
          kind: 'spark',
          drag: 0.9,
        });
      }
      this.vx = this.dashDir * 1030;
      this.physics(game, dt, 0);
      if (this.dashTimer <= 0) {
        this.state = this.onGround ? (Math.abs(this.vx) > 80 ? 'run' : 'idle') : 'fall';
        this.vx *= 0.56;
      }
      return;
    }

    if (this.state === 'heavy') {
      this.updateHeavy(game, dt);
      return;
    }

    if (this.state === 'cast') {
      this.updateCast(game, dt);
      this.physics(game, dt, 1);
      return;
    }

    if (input.wasActionPressed('jump')) this.jumpBuffer = 0.13;
    if (!input.isActionDown('jump') && !this.jumpCut && this.vy < -250) {
      this.vy *= 0.56;
      this.jumpCut = true;
    }
    if (this.jumpBuffer > 0) {
      if (this.onGround || this.coyote > 0) {
        this.jumpBuffer = 0;
        this.coyote = 0;
        this.onGround = false;
        this.vy = -790;
        this.jumpsLeft = 1;
        this.jumpCut = false;
        game.sound.play('jump');
        game.spawnJumpDust(this);
      } else if (this.jumpsLeft > 0) {
        this.jumpBuffer = 0;
        this.jumpsLeft -= 1;
        this.vy = -735;
        this.jumpCut = false;
        game.sound.play('jump', 0.8);
        game.spawnDoubleJump(this);
      }
    }

    if (this.dashPressed) this.tryDash(game);
    if (this.state === 'dash') {
      this.physics(game, dt, 0);
      return;
    }

    if (input.wasActionPressed('ult') && this.energy >= this.maxEnergy && !this.isBusy()) {
      this.startUlt(game);
      return;
    }

    if (input.wasActionPressed('heavy') && this.heavyCd <= 0 && this.energy >= 15 && !this.isBusy()) {
      this.startHeavy(game);
      return;
    }

    if (input.wasActionPressed('flame') && this.castCd <= 0 && this.energy >= 20 && !this.isBusy()) {
      this.startCast(game);
      return;
    }

    if (input.wasActionPressed('attack')) this.attackBuffer = 0.17;

    if (this.state === 'attack' || this.state === 'airAttack') {
      this.updateAttackSteering(game);
      this.updateAttack(game, dt);
      this.physics(game, dt, this.attackAir ? 0.38 : 0.72);
      return;
    }

    if (this.attackBuffer > 0 && !this.isBusy()) {
      if (!this.onGround) {
        this.startAttack(game, 1);
      } else {
        const next = this.comboWindow > 0 && this.comboStep > 0 ? Math.min(this.kit.maxCombo, this.comboStep + 1) : 1;
        this.startAttack(game, next);
      }
      // 起手这一下只打一段；同一帧的按键不能再被当成“下一段输入”。
      game.input.consumeAction?.('attack');
      this.updateAttack(game, dt);
      this.physics(game, dt, this.attackAir ? 0.38 : 0.72);
      return;
    }

    let move = 0;
    if (input.isActionDown('left')) move -= 1;
    if (input.isActionDown('right')) move += 1;
    if (move !== 0) this.facing = move;
    const speed = game.stats.speed;
    const hitSpeedBoost = this.hitSpeedTimer > 0 ? game.passives.hitSpeed || 0 : 0;
    const target = move * speed * (1 + hitSpeedBoost);
    const accel = this.onGround ? 3000 : 1950;
    this.vx += clamp(target - this.vx, -accel * dt, accel * dt);
    if (move === 0) {
      const friction = this.onGround ? 2500 : 950;
      this.vx += clamp(0 - this.vx, -friction * dt, friction * dt);
    }

    if (this.onGround && Math.abs(this.vx) > 60) {
      this.runPhase += Math.abs(this.vx) * dt * 0.045;
      this.walkDust -= dt;
      if (this.walkDust <= 0) {
        this.walkDust = 0.13;
        game.addParticle({
          x: this.x - this.facing * 16,
          y: GROUND_Y - 2,
          vx: -this.facing * rand(15, 55),
          vy: rand(-35, -8),
          life: rand(0.28, 0.45),
          size: rand(3, 6),
          color: '#a7886a',
          kind: 'dust',
          drag: 0.9,
        });
      }
    }

    this.physics(game, dt, 1);
    if (this.onGround) {
      this.state = Math.abs(this.vx) > 45 ? 'run' : 'idle';
      this.jumpsLeft = 2;
      this.airDashUsed = false;
    } else {
      this.state = this.vy < 40 ? 'jump' : 'fall';
    }
    this.stateTime += dt;
  }

  isBusy() {
    return ['attack', 'airAttack', 'heavy', 'cast', 'hurt', 'dash', 'ult'].includes(this.state);
  }

  physics(game, dt, gravityScale = 1) {
    this.vy += GRAVITY * gravityScale * dt;
    if (this.vy > 1500) this.vy = 1500;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const wasGround = this.onGround;
    if (this.x < 34) {
      this.x = 34;
      this.vx = Math.max(0, this.vx);
    }
    if (this.x > LEVEL_W - 34) {
      this.x = LEVEL_W - 34;
      this.vx = Math.min(0, this.vx);
    }
    if (this.y >= GROUND_Y) {
      const impactSpeed = this.vy;
      this.y = GROUND_Y;
      this.vy = 0;
      this.onGround = true;
      this.coyote = 0.1;
      this.jumpsLeft = 2;
      this.airDashUsed = false;
      if (!wasGround && impactSpeed > 360) game.spawnLandDust(this, impactSpeed);
      if (this.state === 'fall' || this.state === 'jump') {
        this.state = Math.abs(this.vx) > 45 ? 'run' : 'idle';
      }
    } else {
      this.onGround = false;
      this.coyote = Math.max(0, this.coyote - dt);
    }
  }

  get kit() {
    return getHeroKit(this.game.heroId);
  }

  startAttack(game, step) {
    const kit = this.kit;
    step = clamp(step, 1, kit.maxCombo);
    this.comboStep = step;
    this.attackStep = step;
    this.attackAir = !this.onGround;
    const mods = game.weaponMods || { range: 1, speed: 1, mult: 1, heavy: 1 };
    const base = this.attackAir ? kit.air : kit.attacks[step - 1];
    const speed = mods.speed || 1;
    this.currentAttack = {
      ...base,
      duration: base.duration / speed,
      active: [base.active[0] / speed, base.active[1] / speed],
      range: base.range * (mods.range || 1),
      mult: base.mult * (mods.mult || 1),
    };
    this.attackRanged = !!base.ranged;
    this.rangedType = this.attackRanged ? this.rollRangedType() : null;
    this.attackTimer = 0;
    this.attackDuration = this.currentAttack.duration;
    this.attackHit = false;
    this.attackQueued = false;
    this.state = this.attackAir ? 'airAttack' : 'attack';
    this.stateTime = 0;
    this.comboWindow = 0;
    this.attackBuffer = 0;
    // 每一段起手可以重新选择朝向；攻击过程中由 updateAttackSteering 控制。
    let steer = 0;
    if (game.input.isActionDown('left')) steer -= 1;
    if (game.input.isActionDown('right')) steer += 1;
    if (steer) this.facing = steer;
    if (this.attackAir) {
      this.vy = Math.min(this.vy, 40);
      this.comboStep = 0;
      game.sound.play(this.attackRanged ? 'fire' : 'swing', 0.8);
    } else {
      // 地面攻击只保留走路速度的四分之一，不再保留奔跑惯性或额外前冲。
      const walkSpeed = game.stats?.speed || 330;
      this.vx = this.facing * walkSpeed * 0.25;
      game.sound.play(this.attackRanged ? 'fire' : step === kit.maxCombo ? 'swingHeavy' : 'swing');
    }
  }

  rollRangedType() {
    const roll = Math.random();
    if (roll < 0.45) return 'fire';
    if (roll < 0.9) return 'ice';
    return 'chaos';
  }

  attackColor() {
    if (this.attackRanged) return this.rangedType === 'fire' ? '#ffb15f' : this.rangedType === 'ice' ? '#9fe0ff' : '#b58bff';
    return { wukong: '#ffd27a', shaseng: '#9fe8d9', bajie: '#ffb082', tangseng: '#d8c58a' }[this.game.heroId] || '#ffd27a';
  }

  updateAttackSteering(game) {
    if (!this.onGround) return;
    const quarter = (game.stats?.speed || 330) * 0.25;
    let move = 0;
    if (game.input.isActionDown('left')) move -= 1;
    if (game.input.isActionDown('right')) move += 1;
    this.vx = (move || this.facing) * quarter;
    // 猪八戒挥耙期间不改朝向；到下一次单段起手/收招后才允许转身。
    if (move && this.game.heroId !== 'bajie') this.facing = move;
  }

  updateAttack(game, dt) {
    if (!this.currentAttack) {
      this.state = this.onGround ? 'idle' : 'fall';
      return;
    }
    this.attackTimer += dt;
    const def = this.currentAttack;
    if (!this.attackHit && this.attackTimer >= def.active[0]) {
      this.attackHit = true;
      if (def.ranged) {
        const y = this.y - 68;
        game.spawnHeroOrb(this.rangedType || 'fire', this.x + this.facing * 34, y, this.facing);
        this.impactFlash = 0.1;
      } else {
        const isAir = this.attackAir;
        const opts = {
          mult: def.mult,
          sourceX: this.x,
          knock: def.knock,
          launch: def.launch,
          hitstop: def.stop,
          shake: def.shake,
          color: this.attackColor(),
          style: def.style || (isAir ? 'air' : String(this.attackStep)),
          critBonus: 0,
        };
        if (def.shape === 'circle') {
          const radius = def.range * (this.game.heroId === 'wukong' && this.attackStep === 3 ? 0.86 : 1.02);
          game.playerStrikeCircle({ x: this.x, y: this.y - 62, r: radius }, opts);
        } else {
          const height = def.shape === 'thrust' ? Math.max(74, def.height) : def.height;
          const rect = isAir
            ? { x: this.x - def.range / 2, y: this.y - height, w: def.range, h: height }
            : {
                x: this.facing > 0 ? this.x + 4 : this.x - def.range - 4,
                y: this.y - height,
                w: def.range,
                h: height,
              };
          game.playerStrike(rect, opts);
        }
        this.impactFlash = 0.12;
      }
    }

    if (game.input.wasActionPressed('attack')) {
      this.attackQueued = true;
    }

    const maxCombo = this.kit.maxCombo;
    const queuedNext = this.attackQueued && !this.attackAir && (this.attackStep < maxCombo || this.kit.ranged);
    if (queuedNext && this.attackTimer >= def.active[1] + 0.025) {
      this.startAttack(game, this.attackStep < maxCombo ? this.attackStep + 1 : 1);
      return;
    }

    if (this.attackTimer >= this.attackDuration) {
      if (queuedNext) {
        this.startAttack(game, this.attackStep < maxCombo ? this.attackStep + 1 : 1);
      } else {
        const wasAir = this.attackAir;
        this.state = this.onGround ? 'idle' : 'fall';
        this.comboWindow = wasAir ? 0 : 0.62;
        this.attackHit = false;
        if (this.attackStep >= maxCombo || wasAir) this.comboStep = 0;
        this.attackStep = 0;
        this.attackAir = false;
        this.attackQueued = false;
        this.attackRanged = false;
      }
    }
  }

  tryDash(game) {
    if (this.dashCd > 0 || this.state === 'hurt' || this.state === 'ult') return;
    if (!this.onGround && this.airDashUsed) return;
    if (!this.onGround) this.airDashUsed = true;
    let dir = this.facing;
    if (game.input.isActionDown('left')) dir = -1;
    if (game.input.isActionDown('right')) dir = 1;
    this.facing = dir;
    this.dashDir = dir;
    this.state = 'dash';
    this.dashTimer = 0.16;
    this.dashCd = 0.7 * (1 - (game.passives.dashCd || 0));
    this.invuln = Math.max(this.invuln, 0.26);
    this.vx = dir * 1030 * (1 + (game.passives.dashRange || 0));
    this.vy = 0;
    this.trailTimer = 0;
    this.comboWindow = 0;
    this.comboStep = 0;
    this.attackQueued = false;
    this.dashGuardTimer = game.passives.dashGuard ? 2.2 : 0;
    if (game.passives.perfectCrit) this.forceCrit = true;
    this.addEnergy(game.passives.dashEnergy || 0);
    game.sound.play('dash');
    game.shake(1.5);
    for (let i = 0; i < 9; i += 1) {
      game.addParticle({
        x: this.x + rand(-16, 16),
        y: this.y - rand(10, 82),
        vx: -dir * rand(80, 240),
        vy: rand(-40, 40),
        life: rand(0.12, 0.3),
        size: rand(2, 5),
        color: choose(['#ffd27c', '#ffba62', '#fff2c6']),
        kind: 'spark',
        drag: 0.88,
      });
    }
  }

  startHeavy(game) {
    this.state = 'heavy';
    this.heavyTimer = 0;
    this.heavyPhase = 'rise';
    this.heavyCd = 3.4 * (1 - (game.passives.cooldown || 0));
    this.energy = Math.max(0, this.energy - 15);
    this.invuln = Math.max(this.invuln, 0.18);
    this.attackHit = false;
    this.vx = this.facing * 330;
    this.vy = -690;
    this.onGround = false;
    this.comboStep = 0;
    this.comboWindow = 0;
    game.sound.play('swingHeavy');
    game.shake(3);
    for (let i = 0; i < 8; i += 1) {
      game.addParticle({
        x: this.x + rand(-20, 20),
        y: this.y - rand(0, 20),
        vx: rand(-110, 110),
        vy: rand(-160, -20),
        life: rand(0.25, 0.55),
        size: rand(4, 9),
        color: '#c8a073',
        kind: 'dust',
      });
    }
  }

  updateHeavy(game, dt) {
    this.heavyTimer += dt;
    if (this.heavyPhase === 'rise') {
      this.physics(game, dt, 0.9);
      if (this.heavyTimer > 0.18 && this.vy > -80) {
        this.heavyPhase = 'fall';
        this.vy = 1360;
      }
      if (this.onGround) this.impactHeavy(game);
    } else if (this.heavyPhase === 'fall') {
      this.physics(game, dt, 1.4);
      this.vx *= Math.pow(0.97, dt * 60);
      if (this.onGround) this.impactHeavy(game);
    } else if (this.heavyPhase === 'recover') {
      this.vx *= Math.pow(0.8, dt * 60);
      this.physics(game, dt, 1);
      if (this.heavyTimer > 0.44) {
        this.heavyPhase = 'none';
        this.state = this.onGround ? 'idle' : 'fall';
      }
    }
    if (game.input.wasActionPressed('dash') && this.heavyPhase === 'recover') {
      this.tryDash(game);
    }
    if (this.heavyPhase === 'fall' && this.vy > 0 && !this.attackHit) {
      game.addParticle({
        x: this.x + rand(-14, 14),
        y: this.y - rand(10, 80),
        vx: rand(-30, 30),
        vy: rand(-130, -50),
        life: 0.25,
        size: rand(2, 5),
        color: '#ffbb62',
        kind: 'ember',
      });
    }
  }

  impactHeavy(game) {
    if (this.attackHit) return;
    this.attackHit = true;
    this.heavyPhase = 'recover';
    this.heavyTimer = 0;
    this.vx = 0;
    this.vy = 0;
    this.impactFlash = 0.2;
    game.playerStrikeCircle(
      { x: this.x, y: this.y - 20, r: 196 * (1 + (game.passives.heavyRange || 0) + ((game.weaponMods?.heavyRange || 0))) },
      {
        mult: 3.3 * (game.weaponMods?.heavy || 1) * (1 + (game.passives.heavy || 0)),
        sourceX: this.x,
        knock: 420,
        launch: -300,
        hitstop: 0.075,
        shake: 15,
        color: '#ffc15e',
        style: 'heavy',
      }
    );
    game.sound.play('explode', 1.1);
    game.sound.play('swingHeavy');
    game.shake(15);
    game.hitstop(0.06);
    game.addParticle({
      x: this.x,
      y: GROUND_Y - 8,
      vx: 0,
      vy: 0,
      life: 0.55,
      size: 10,
      color: '#ffbb62',
      kind: 'shockwave',
    });
    for (let i = 0; i < 26; i += 1) {
      const dir = i % 2 === 0 ? -1 : 1;
      game.addParticle({
        x: this.x + rand(-30, 30),
        y: GROUND_Y - rand(0, 12),
        vx: dir * rand(80, 430),
        vy: rand(-400, -100),
        life: rand(0.3, 0.8),
        size: rand(4, 11),
        color: choose(['#b0987e', '#d4b58c', '#7f7265']),
        kind: 'dust',
        gravity: 850,
        drag: 0.93,
      });
    }
    game.addParticle({
      x: this.x,
      y: GROUND_Y - 54,
      vx: 0,
      vy: -20,
      life: 0.35,
      size: 74,
      color: '#ffd47b',
      kind: 'glyph',
      text: '破',
      textSize: 64,
      spin: 0,
    });
  }

  startCast(game) {
    this.state = 'cast';
    this.castTimer = 0;
    this.castFired = false;
    this.castCd = 2.3 * (1 - (game.passives.cooldown || 0));
    this.energy = Math.max(0, this.energy - 20);
    this.vx *= 0.35;
    game.sound.play('fire', 0.8);
  }

  updateCast(game, dt) {
    this.castTimer += dt;
    if (!this.castFired && this.castTimer >= 0.13) {
      this.castFired = true;
      game.spawnPlayerFlame(this.x + this.facing * 50, this.y - 62, this.facing);
      game.shake(2.5);
      for (let i = 0; i < 14; i += 1) {
        game.addParticle({
          x: this.x + this.facing * 48,
          y: this.y - 62,
          vx: this.facing * rand(60, 250) + rand(-90, 90),
          vy: rand(-130, 130),
          life: rand(0.2, 0.4),
          size: rand(2, 7),
          color: choose(['#ffd46b', '#ff8a3d', '#ffe8aa']),
          kind: 'spark',
          drag: 0.9,
        });
      }
    }
    this.vx *= Math.pow(0.86, dt * 60);
    if (this.castTimer >= 0.34) this.state = this.onGround ? 'idle' : 'fall';
  }

  startUlt(game) {
    this.state = 'ult';
    this.ultActive = true;
    this.ultTimer = 0;
    this.ultPulse = 0;
    this.energy = 0;
    this.invuln = 2.2;
    this.vx = 0;
    this.vy = 0;
    this.comboWindow = 0;
    this.comboStep = 0;
    game.startUltimate(this);
  }

  updateUlt(game, dt) {
    this.ultTimer += dt;
    const pulseTimes = [0.22, 0.44, 0.66, 0.88, 1.1, 1.32];
    while (this.ultPulse < pulseTimes.length && this.ultTimer >= pulseTimes[this.ultPulse]) {
      const index = this.ultPulse;
      this.ultPulse += 1;
      game.ultimatePulse(this, index);
    }
    if (this.ultTimer >= 1.65) {
      this.ultActive = false;
      this.state = this.onGround ? 'idle' : 'fall';
      this.vx = this.facing * 100;
    }
  }

  takeDamage(game, rawDamage, sourceX, opts = {}) {
    if (this.dead || this.invuln > 0 || this.state === 'ult') return 0;
    if (chance(game.passives.block || 0)) {
      this.invuln = 0.3;
      game.addText(this.x, this.y - 112, '格挡', { color: '#8be4dd', size: 18, vy: -60 });
      game.sound.play('ui', 0.8);
      return 0;
    }
    const def = game.stats.def || 0;
    const reduction = 100 / (100 + def * 2.4);
    const dashGuard = this.dashGuardTimer > 0 ? game.passives.dashGuard || 0 : 0;
    const guard = Math.min(0.75, (game.passives.guard || 0) + (game.battleGuard || 0) + dashGuard);
    let damage = Math.max(1, Math.round(rawDamage * reduction * (1 - guard) * rand(0.92, 1.06)));
    if (this.firstShield) {
      this.firstShield = false;
      damage = Math.max(1, Math.round(damage * 0.3));
      game.addText(this.x, this.y - 112, '水幕', { color: '#8be4dd', size: 18, vy: -60 });
    }
    if (this.hp - damage < 0) damage = this.hp;
    this.hp = Math.max(0, this.hp - damage);
    if ((game.passives.thorns || 0) > 0) {
      const target = game.enemies
        .filter((enemy) => !enemy.dead)
        .sort((a, b) => Math.abs(a.x - this.x) - Math.abs(b.x - this.x))[0];
      if (target) {
        game.hitEnemy(target, 0, {
          fixed: Math.max(1, Math.round(damage * game.passives.thorns)),
          canCrit: false,
          sourceX: this.x,
          knock: 60,
          hitstop: 0,
          shake: 1,
          color: '#8be4dd',
          energy: false,
        });
      }
    }
    if (game.passives.hitSpeed) this.hitSpeedTimer = 1.2;
    this.sinceDamage = 0;
    this.invuln = 0.82;
    this.hitFlash = 0.16;
    this.hurtTimer = 0.3;
    this.state = 'hurt';
    this.attackTimer = 0;
    this.attackHit = false;
    this.comboStep = 0;
    this.comboWindow = 0;
    const dir = this.x < sourceX ? -1 : 1;
    this.vx = dir * (opts.knock ?? 280);
    this.vy = -220;
    this.onGround = false;
    game.sound.play('hurt');
    game.shake(9);
    game.hitstop(0.018);
    game.damageFlash = 1;
    game.addText(this.x, this.y - 110, `-${damage}`, {
      color: '#ff8c78',
      size: 24,
      crit: false,
      vy: -100,
    });
    for (let i = 0; i < 12; i += 1) {
      game.addParticle({
        x: this.x + rand(-16, 16),
        y: this.y - rand(30, 90),
        vx: rand(-160, 160),
        vy: rand(-170, 70),
        life: rand(0.2, 0.45),
        size: rand(2, 6),
        color: choose(['#ff7b66', '#ffb38a', '#8d2b2b']),
        kind: 'spark',
        gravity: 320,
        drag: 0.92,
      });
    }
    if (this.hp <= 0) this.die(game);
    return damage;
  }

  die(game) {
    if (this.dead) return;
    this.dead = true;
    this.state = 'dead';
    this.deathTimer = 0;
    this.vy = -420;
    this.vx = -this.facing * 160;
    this.onGround = false;
    game.onPlayerDeath();
  }

  heal(amount, game, silent = false) {
    if (this.dead) return;
    const before = this.hp;
    const boosted = amount * (1 + (game.passives.heal || 0));
    this.hp = Math.min(this.maxHp, this.hp + boosted);
    const gained = Math.round(this.hp - before);
    if (gained > 0 && !silent) {
      game.addText(this.x, this.y - 112, `+${gained}`, { color: '#78e39b', size: 20, vy: -70 });
      game.sound.play('heal', 0.8);
      for (let i = 0; i < 10; i += 1) {
        game.addParticle({
          x: this.x + rand(-24, 24),
          y: this.y - rand(10, 90),
          vx: rand(-20, 20),
          vy: rand(-100, -35),
          life: rand(0.4, 0.8),
          size: rand(2, 5),
          color: '#7be6a1',
          kind: 'ember',
          drag: 0.95,
        });
      }
    }
  }

  draw(ctx, game, time, ghost = false, ghostAlpha = 1) {
    const t = this.animTime;
    const heroId = game.heroId || 'wukong';
    const PAL = ({
      wukong: { fur: '#6d4936', furDark: '#3b2922', chest: '#946440', armor: '#c34a37', trim: '#e1b258', scarf: '#cf4738', scarf2: '#e46844', head1: '#7a5239', head2: '#4b3026', face: '#e3b98c', cheek: '#c99266', ear: '#e0a67c', arm: '#5a392c', armDark: '#4a2f27', leg: '#3b2822', legFront: '#54352a' },
      tangseng: { fur: '#6f5b45', furDark: '#3f342a', chest: '#c8b58f', armor: '#d8cfb0', trim: '#c6a85d', scarf: '#d8c690', scarf2: '#efe4bd', head1: '#8a6a4d', head2: '#5a4331', face: '#e7c39b', cheek: '#c99a73', ear: '#d8b08a', arm: '#7a5b43', armDark: '#5b4334', leg: '#4b3a2e', legFront: '#6b5342' },
      shaseng: { fur: '#4f3a2d', furDark: '#2e241f', chest: '#8aa59a', armor: '#3f7f7a', trim: '#a9d5c8', scarf: '#3f8e88', scarf2: '#67b8ae', head1: '#6c4a36', head2: '#3e2c22', face: '#c99a73', cheek: '#a97a5c', ear: '#b88765', arm: '#5f4433', armDark: '#403027', leg: '#332822', legFront: '#4a382d' },
      bajie: { fur: '#6d3f31', furDark: '#3b211d', chest: '#c98f74', armor: '#8e3c32', trim: '#d9a073', scarf: '#a74537', scarf2: '#d46d54', head1: '#7f4a38', head2: '#4b2a23', face: '#e0aa8a', cheek: '#c98f74', ear: '#d99c83', arm: '#6a4436', armDark: '#4c3028', leg: '#382621', legFront: '#553a30' },
    })[heroId] || {
      fur: '#6d4936', furDark: '#3b2922', chest: '#946440', armor: '#c34a37', trim: '#e1b258', scarf: '#cf4738', scarf2: '#e46844', head1: '#7a5239', head2: '#4b3026', face: '#e3b98c', cheek: '#c99266', ear: '#e0a67c', arm: '#5a392c', armDark: '#4a2f27', leg: '#3b2822', legFront: '#54352a',
    };
    if (!ghost) {
      ctx.save();
      const airH = clamp((GROUND_Y - this.y) / 220, 0, 1);
      ctx.globalAlpha = 0.3 * (1 - airH * 0.65);
      ctx.fillStyle = '#05060a';
      ctx.beginPath();
      ctx.ellipse(this.x, GROUND_Y + 4, 43 * (1 - airH * 0.3), 10 * (1 - airH * 0.35), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.facing * this.visualScale, this.visualScale);
    if (!ghost) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, 0, -56, 62, '#ffb45e', 0.1);
      ctx.restore();
    }
    if (ghost) {
      ctx.globalAlpha = ghostAlpha;
      ctx.globalCompositeOperation = 'lighter';
    } else if (this.invuln > 0 && !['dash', 'ult'].includes(this.state)) {
      if (Math.floor(this.invuln * 22) % 2 === 0) ctx.globalAlpha = 0.55;
    }

    const air = !this.onGround;
    const moving = this.state === 'run';
    const run = this.runPhase;
    const kit = this.kit;
    const gear = game.equipped || {};
    const chestItem = gear.chest;
    const legsItem = gear.legs;
    const bootsItem = gear.boots;
    const headItem = gear.head;
    const chestColor = chestItem?.glow || chestItem?.rarity?.color || PAL.armor;
    const chestTrim = chestItem ? (chestItem.rank >= 2 ? '#f0d18a' : '#c3b08b') : PAL.trim;
    const legColor = legsItem?.glow || legsItem?.rarity?.color || PAL.leg;
    const bootColor = bootsItem?.glow || bootsItem?.rarity?.color || PAL.legFront;
    const isBajie = heroId === 'bajie';
    const isTangseng = heroId === 'tangseng';
    const bob = this.onGround ? (moving ? Math.sin(run * 2) * (isBajie ? 3.2 : 2.4) : Math.sin(t * 2.2) * 1.1) : 0;
    const lean = moving
      ? heroId === 'wukong' ? 0.55 : heroId === 'shaseng' ? 0.48 : isBajie ? 0.4 : 0.32
      : heroId === 'bajie' ? 0.1 : 0.06;
    const bodyDrop = moving ? (heroId === 'wukong' ? 9 : heroId === 'shaseng' ? 8 : isBajie ? 7 : 3) : 0;
    let attackLean = 0;
    if (this.state === 'attack' || this.state === 'airAttack') {
      if (this.attackRanged) attackLean = 0.1;
      else if (this.attackStep === 1) attackLean = 0.2;
      else if (this.attackStep === 2) attackLean = 0.16;
      else if (this.attackStep === 3) attackLean = 0.1;
      else attackLean = 0.3;
      if (heroId === 'shaseng' && this.attackStep === 4) attackLean = 0.38;
      if (isBajie && this.attackStep === 3) attackLean = 0.3;
    } else if (this.state === 'heavy') attackLean = 0.3;
    else if (this.state === 'dash') attackLean = 0.42;
    else if (this.state === 'cast') attackLean = 0.08;
    const upperLean = lean + attackLean;
    const upperTransform = () => {
      ctx.translate(0, -42);
      ctx.rotate(upperLean);
      ctx.translate(0, 42);
    };
    const attackProgress = this.attackDuration ? clamp(this.attackTimer / this.attackDuration, 0, 1) : 0;
    const attackDef = this.currentAttack;
    const effectActive = (this.state === 'attack' || this.state === 'airAttack') && !!attackDef
      && this.attackTimer >= attackDef.active[0] * 0.72
      && this.attackTimer <= attackDef.active[1] + 0.12;
    const effectFade = effectActive
      ? clamp((attackDef.active[1] + 0.12 - this.attackTimer) / 0.15, 0, 1)
      : 0;
    const effectStyle = attackDef?.style || '';
    const effectRanged = !!attackDef?.ranged;
    const swingConfig = effectActive && !effectRanged ? getSwingConfig(effectStyle) : null;
    let weaponAngle = -0.82;
    let weaponPivotX = 14;
    let weaponPivotY = -60;
    let showWeaponInHand = true;
    let weaponHand = 'front';
    let handFront = { x: 14, y: -55 };
    let handBack = { x: -12, y: -57 };

    if (this.state === 'attack' || this.state === 'airAttack') {
      showWeaponInHand = true;
      if (this.attackAir) {
        weaponAngle = -Math.PI / 2 + attackProgress * Math.PI * 4;
        weaponPivotX = 8;
        weaponPivotY = -64;
      } else if (this.attackRanged) {
        weaponHand = 'back';
        weaponAngle = -0.32;
        weaponPivotX = -12;
        weaponPivotY = -58;
      } else if (heroId === 'wukong') {
        if (this.attackStep === 1) {
          weaponAngle = lerp(-2.72, 0.5, easeOutCubic(attackProgress));
          weaponPivotX = 14;
          weaponPivotY = -62;
        } else if (this.attackStep === 2) {
          weaponAngle = lerp(-0.45, 2.45, easeInOutQuad(attackProgress));
          weaponPivotX = 12;
          weaponPivotY = -56;
        } else if (this.attackStep === 3) {
          weaponAngle = -0.35 + attackProgress * Math.PI * 2;
          weaponPivotX = 8;
          weaponPivotY = -60;
        } else {
          weaponAngle = attackProgress < 0.4
            ? lerp(-2.9, -2.38, attackProgress / 0.4)
            : lerp(-2.38, 1.35, easeInCubic((attackProgress - 0.4) / 0.6));
          weaponPivotX = 17;
          weaponPivotY = -68;
        }
      } else if (heroId === 'shaseng') {
        if (this.attackStep === 1) {
          weaponAngle = lerp(-2.52, 0.35, easeOutCubic(attackProgress));
          weaponPivotX = 14;
          weaponPivotY = -60;
        } else if (this.attackStep === 2) {
          weaponAngle = lerp(-0.35, 2.2, easeInOutQuad(attackProgress));
          weaponPivotX = 12;
          weaponPivotY = -55;
        } else if (this.attackStep === 3) {
          weaponAngle = lerp(-0.6, 1.1, easeInOutQuad(attackProgress));
          weaponPivotX = 9;
          weaponPivotY = -58;
        } else {
          weaponAngle = 0.02;
          weaponPivotX = 30;
          weaponPivotY = -50;
        }
      } else if (isBajie) {
        if (this.attackStep === 1) {
          weaponAngle = lerp(-2.45, 0.2, easeOutCubic(attackProgress));
          weaponPivotX = 16;
          weaponPivotY = -62;
        } else if (this.attackStep === 2) {
          weaponAngle = lerp(-0.2, 2.35, easeInOutQuad(attackProgress));
          weaponPivotX = 14;
          weaponPivotY = -58;
        } else {
          weaponAngle = -2.8 + attackProgress * Math.PI * 2;
          weaponPivotX = 10;
          weaponPivotY = -64;
        }
      }
    } else if (this.state === 'heavy') {
      showWeaponInHand = true;
      if (this.heavyPhase === 'rise') {
        weaponAngle = -2.7;
        weaponPivotX = 10;
        weaponPivotY = -78;
      } else if (this.heavyPhase === 'fall') {
        weaponAngle = 1.32;
        weaponPivotX = 22;
        weaponPivotY = -72;
      } else {
        weaponAngle = 1.4;
        weaponPivotX = 25;
        weaponPivotY = -58;
      }
    } else if (this.state === 'cast') {
      showWeaponInHand = true;
      weaponHand = isTangseng ? 'back' : 'front';
      weaponAngle = -0.12;
      weaponPivotX = 20;
      weaponPivotY = -60;
    } else if (this.state === 'ult') {
      showWeaponInHand = true;
      weaponAngle = -1.1 + this.ultTimer * 9;
      weaponPivotX = 10;
      weaponPivotY = -92;
    } else if (isTangseng) {
      weaponHand = 'back';
      weaponAngle = -1.0 + (moving ? Math.sin(run) * 0.08 : Math.sin(t * 1.6) * 0.025);
      weaponPivotX = -14;
      weaponPivotY = -56;
    } else if (isBajie) {
      weaponHand = 'front';
      weaponAngle = -1.02;
      weaponPivotX = 18;
      weaponPivotY = -70;
    } else if (heroId === 'shaseng') {
      weaponAngle = -0.75;
      weaponPivotX = 14;
      weaponPivotY = -60;
    } else {
      weaponAngle = -0.82;
      weaponPivotX = 14;
      weaponPivotY = -60;
    }

    const handX = weaponPivotX;
    const handY = weaponPivotY;
    if (weaponHand === 'back') handBack = { x: handX, y: handY };
    else handFront = { x: handX, y: handY };

    if (this.state === 'ult' && !ghost) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const pulseR = 100 + Math.sin(this.ultTimer * 14) * 18;
      glow(ctx, 0, -58, pulseR + 60, '#ffcb62', 0.45);
      ctx.strokeStyle = `rgba(255,219,127,${0.4 + Math.sin(this.ultTimer * 10) * 0.15})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, -55, 74, 96, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -60, 92 + Math.sin(this.ultTimer * 7) * 8, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,240,190,0.24)';
      ctx.stroke();
      ctx.restore();
    }

    if (this.state === 'dash' && !ghost) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 1; i <= 3; i += 1) {
        glow(ctx, -i * 19, -56, 38 - i * 4, '#ffbe62', 0.12 / i);
      }
      ctx.strokeStyle = 'rgba(255,214,128,0.34)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-20, -105);
      ctx.quadraticCurveTo(-62, -73, -42, -21);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    upperTransform();
    const scarfWave = Math.sin(t * 7) * 4 + (moving ? 8 : 0);
    ctx.save();
    ctx.fillStyle = PAL.scarf;
    ctx.beginPath();
    ctx.moveTo(-4, -79);
    ctx.quadraticCurveTo(-26, -79 + Math.sin(t * 5) * 2, -45 - Math.abs(this.vx) * 0.025, -69 + scarfWave);
    ctx.quadraticCurveTo(-37, -62, -22, -70);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PAL.scarf2;
    ctx.beginPath();
    ctx.moveTo(-9, -76);
    ctx.quadraticCurveTo(-32, -70 + Math.sin(t * 5 + 1) * 3, -53 - Math.abs(this.vx) * 0.02, -55 + scarfWave * 0.7);
    ctx.quadraticCurveTo(-32, -58, -16, -69);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    if (heroId === 'wukong') {
      ctx.save();
      ctx.strokeStyle = '#4b2e25';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-12, -44);
      ctx.bezierCurveTo(-38, -47, -49, -72, -32, -79);
      ctx.bezierCurveTo(-22, -83, -18, -71, -26, -67);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    // 侧视跑动：腿顺着前倾的身体向后扒，后腿抬起，不是一条腿伸到身体前面。
    const strideAmp = heroId === 'wukong' ? 16 : heroId === 'shaseng' ? 14 : isBajie ? 12 : 10;
    const stride = moving ? Math.sin(run) * strideAmp : 0;
    const legBase = moving ? -18 : 0;
    const backLift = moving ? Math.max(0, -Math.sin(run)) * (heroId === 'wukong' ? 8 : 6) : 0;
    const frontLift = moving ? Math.max(0, Math.sin(run)) * (heroId === 'wukong' ? 8 : 6) : 0;
    this.drawLeg(ctx, -3, -40, legBase - 8 + stride, -3 - backLift - (air ? 8 : 0), air ? -0.8 : 0, legColor, bootColor, chestTrim);

    if (swingConfig) {
      drawSwingEffect(ctx, swingConfig, effectFade, this.attackColor(), true);
    } else if (effectActive && effectStyle === 's4') {
      drawThrustEffect(ctx, effectFade, this.attackColor(), true);
    }

    ctx.save();
    upperTransform();
    ctx.save();
    ctx.strokeStyle = PAL.armDark;
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-7, -68 + bodyDrop * 0.5);
    if (showWeaponInHand && weaponHand === 'back') ctx.lineTo(handBack.x, handBack.y - bodyDrop);
    else ctx.lineTo(-17 + (moving ? Math.sin(run + Math.PI) * 9 : 0), -48 + bob - bodyDrop);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(0, -60 + bodyDrop + bob);
    if (isBajie) ctx.scale(1.07, 0.98);
    // 远侧躯干/肩背层：比正面的躯干更暗、更靠后，制造 2.5D 厚度
    ctx.fillStyle = PAL.furDark;
    ctx.beginPath();
    ctx.moveTo(-19, -19);
    ctx.quadraticCurveTo(-17, -33, 0, -33);
    ctx.quadraticCurveTo(17, -33, 21, -18);
    ctx.lineTo(16, 11);
    ctx.quadraticCurveTo(7, 23, 0, 23);
    ctx.quadraticCurveTo(-7, 23, -15, 11);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(-10, 2, 11, 24, -0.16, 0, Math.PI * 2);
    ctx.fill();
    const bodyG = ctx.createLinearGradient(-20, -30, 22, 26);
    bodyG.addColorStop(0, PAL.fur);
    bodyG.addColorStop(1, PAL.furDark);
    ctx.fillStyle = bodyG;
    ctx.beginPath();
    ctx.moveTo(-15, -19);
    ctx.quadraticCurveTo(-14, -31, 0, -31);
    ctx.quadraticCurveTo(14, -31, 18, -18);
    ctx.lineTo(14, 10);
    ctx.quadraticCurveTo(6, 21, 0, 21);
    ctx.quadraticCurveTo(-6, 21, -13, 10);
    ctx.closePath();
    ctx.fill();
    if (isBajie) {
      ctx.fillStyle = '#c9856c';
      ctx.beginPath();
      ctx.ellipse(7, 9, 16, 13, 0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(228,166,137,0.45)';
      ctx.beginPath();
      ctx.ellipse(9, 7, 11, 8, 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = PAL.chest;
    ctx.beginPath();
    ctx.ellipse(5, 6, 11, 15, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    if (!chestItem) ctx.globalAlpha = 0;
    ctx.fillStyle = chestColor;
    ctx.beginPath();
    ctx.moveTo(-17, -18);
    ctx.quadraticCurveTo(0, -25, 18, -16);
    ctx.lineTo(17, 2);
    ctx.quadraticCurveTo(8, 11, 0, 12);
    ctx.quadraticCurveTo(-10, 11, -17, 2);
    ctx.closePath();
    ctx.fill();
    if (chestItem) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = chestTrim;
      ctx.beginPath();
      ctx.ellipse(-15, -8, 7, 5, -0.4, 0, Math.PI * 2);
      ctx.ellipse(15, -7, 7, 5, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = chestTrim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-16, -15);
    ctx.quadraticCurveTo(0, -21, 17, -14);
    ctx.moveTo(-2, -18);
    ctx.lineTo(-2, 11);
    ctx.stroke();
    ctx.fillStyle = chestTrim;
    ctx.beginPath();
    ctx.arc(1, -3, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5e1f1d';
    ctx.beginPath();
    ctx.arc(1, -3, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#36211d';
    ctx.fillRect(-18, 10, 35, 6);
    ctx.fillStyle = chestTrim;
    ctx.fillRect(-2, 10, 7, 6);
    if (legsItem) {
      ctx.fillStyle = legColor;
      ctx.beginPath();
      ctx.moveTo(-17, 11);
      ctx.lineTo(17, 11);
      ctx.lineTo(14, 24);
      ctx.quadraticCurveTo(0, 28, -14, 24);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = chestTrim;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(-14, 23);
      ctx.quadraticCurveTo(0, 26, 14, 23);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    if (showWeaponInHand && weaponHand === 'back') {
      ctx.save();
      ctx.strokeStyle = PAL.armDark;
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-7, -68 + bob - bodyDrop);
      ctx.lineTo(handBack.x, handBack.y + bob - bodyDrop);
      ctx.stroke();
      ctx.fillStyle = PAL.face;
      ctx.beginPath();
      ctx.arc(handBack.x, handBack.y + bob - bodyDrop, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.strokeStyle = PAL.arm;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(8, -67 + bob - bodyDrop);
    if (showWeaponInHand && weaponHand === 'front') ctx.lineTo(handFront.x, handFront.y + bob - bodyDrop);
    else {
      const swing = moving ? Math.sin(run + Math.PI) * 10 : 0;
      ctx.lineTo(17 + swing, -45 + bob - bodyDrop);
    }
    ctx.stroke();
    ctx.fillStyle = PAL.face;
    ctx.beginPath();
    ctx.arc(showWeaponInHand && weaponHand === 'front' ? handFront.x : 17, (showWeaponInHand && weaponHand === 'front' ? handFront.y : -44) + bob - bodyDrop, 4.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const headY = (isBajie ? -98 : isTangseng ? -102 : -100) + bob - bodyDrop;
    const headColor = headItem?.glow || headItem?.rarity?.color || '#c9a24e';
    // 脖子是头和躯干的连接层，跟着同一个上身骨骼一起前倾
    ctx.fillStyle = PAL.furDark;
    ctx.beginPath();
    ctx.moveTo(-3, -90 + bob - bodyDrop);
    ctx.quadraticCurveTo(1, -100 + bob - bodyDrop, 11, -92 + bob - bodyDrop);
    ctx.lineTo(8, -86 + bob - bodyDrop);
    ctx.quadraticCurveTo(1, -88 + bob - bodyDrop, -2, -86 + bob - bodyDrop);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = chestTrim;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-4, -87 + bob - bodyDrop);
    ctx.quadraticCurveTo(3, -91 + bob - bodyDrop, 11, -87 + bob - bodyDrop);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.save();
    // 头不跟着躯干一起栽下去：绕脖子反向回正，脸保持朝前，头也不会甩得太远。
    const headPivotY = -82 + bob - bodyDrop;
    ctx.translate(0, headPivotY);
    ctx.rotate(-upperLean * 0.8);
    ctx.translate(0, -headPivotY);
    ctx.translate(6, headY);

    if (heroId === 'wukong') {
      // 猴子耳朵在头后，左右对称，脸不再偏移
      ctx.fillStyle = PAL.head1;
      ctx.beginPath();
      ctx.arc(-17, 1, 7.2, 0, Math.PI * 2);
      ctx.arc(17, 1, 7.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PAL.ear;
      ctx.beginPath();
      ctx.arc(-17, 1, 3.3, 0, Math.PI * 2);
      ctx.arc(17, 1, 3.3, 0, Math.PI * 2);
      ctx.fill();
      const headG = ctx.createRadialGradient(-4, -7, 2, 0, 0, 23);
      headG.addColorStop(0, PAL.head1);
      headG.addColorStop(1, PAL.head2);
      ctx.fillStyle = headG;
      ctx.beginPath();
      ctx.arc(0, 0, 19, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d8aa7d';
      ctx.beginPath();
      ctx.ellipse(4, 2, 13, 14.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e5bf95';
      ctx.beginPath();
      ctx.ellipse(8, 7, 7.4, 5.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1e1512';
      ctx.beginPath();
      ctx.ellipse(1, -3, 2.3, 3.2, 0, 0, Math.PI * 2);
      ctx.ellipse(10, -3, 2.3, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd66d';
      ctx.beginPath();
      ctx.arc(1.6, -3.3, 0.9, 0, Math.PI * 2);
      ctx.arc(10.6, -3.3, 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2b1b17';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-2, -9);
      ctx.quadraticCurveTo(1, -11, 4, -9);
      ctx.moveTo(7, -9);
      ctx.quadraticCurveTo(10, -11, 13, -9);
      ctx.stroke();
      ctx.fillStyle = '#5b3627';
      ctx.beginPath();
      ctx.ellipse(8, 5, 2.2, 1.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#81503a';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(4, 10);
      ctx.quadraticCurveTo(8, 12, 12, 9.5);
      ctx.stroke();
      ctx.strokeStyle = '#e8c36d';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.arc(0, 0, 18, -2.72, -0.42);
      ctx.stroke();
      ctx.fillStyle = '#ffe29a';
      ctx.beginPath();
      ctx.arc(1, -18, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#b64a38';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-4, -17);
      ctx.bezierCurveTo(-13, -27, -24, -30, -34, -26 + Math.sin(t * 3) * 4);
      ctx.stroke();
      ctx.strokeStyle = '#e08356';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(-5, -15);
      ctx.bezierCurveTo(-15, -23, -24, -25, -31, -20 + Math.sin(t * 3) * 4);
      ctx.stroke();
    } else if (isTangseng) {
      const headG = ctx.createRadialGradient(-4, -7, 2, 0, 0, 23);
      headG.addColorStop(0, '#f0d3a8');
      headG.addColorStop(1, '#c99a73');
      ctx.fillStyle = headG;
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e7c39b';
      ctx.beginPath();
      ctx.ellipse(3, 1, 13, 14.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#6a4432';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-4, -3);
      ctx.quadraticCurveTo(-1, -5, 2, -3);
      ctx.moveTo(6, -3);
      ctx.quadraticCurveTo(9, -5, 12, -3);
      ctx.stroke();
      ctx.fillStyle = '#8b5d45';
      ctx.beginPath();
      ctx.arc(4, 7, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#8c5b49';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(1, 10);
      ctx.quadraticCurveTo(5, 12, 9, 10);
      ctx.stroke();
      ctx.fillStyle = '#b64a38';
      ctx.beginPath();
      ctx.arc(2, 1, 1.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (heroId === 'shaseng') {
      const headG = ctx.createRadialGradient(-4, -7, 2, 0, 0, 23);
      headG.addColorStop(0, '#d8ad86');
      headG.addColorStop(1, '#8e5f45');
      ctx.fillStyle = headG;
      ctx.beginPath();
      ctx.arc(0, 0, 19, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2f2925';
      ctx.beginPath();
      ctx.ellipse(3, 14, 12, 6, 0, 0, Math.PI);
      ctx.fill();
      ctx.fillStyle = '#c99a73';
      ctx.beginPath();
      ctx.ellipse(4, 0, 12.5, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2b1c17';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-3, -5);
      ctx.lineTo(2, -3);
      ctx.moveTo(7, -3);
      ctx.lineTo(12, -5);
      ctx.stroke();
      ctx.fillStyle = '#1d1412';
      ctx.beginPath();
      ctx.arc(1, -1.4, 1.6, 0, Math.PI * 2);
      ctx.arc(10, -1.4, 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7d4b39';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(2, 10);
      ctx.quadraticCurveTo(6, 11, 10, 9);
      ctx.stroke();
      ctx.strokeStyle = '#b46a52';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(12, -7);
      ctx.lineTo(15, -2);
      ctx.stroke();
    } else if (isBajie) {
      ctx.fillStyle = PAL.skin || '#d99c83';
      ctx.beginPath();
      ctx.arc(-19, 0, 8, 0, Math.PI * 2);
      ctx.arc(19, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      const headG = ctx.createRadialGradient(-5, -7, 2, 0, 0, 25);
      headG.addColorStop(0, '#b9755f');
      headG.addColorStop(1, '#7c4237');
      ctx.fillStyle = headG;
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d99c83';
      ctx.beginPath();
      ctx.ellipse(3, 3, 14, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e2ad94';
      ctx.beginPath();
      ctx.ellipse(12, 7, 8.5, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7a4336';
      ctx.beginPath();
      ctx.arc(9, 7, 1.6, 0, Math.PI * 2);
      ctx.arc(15, 7, 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1e1512';
      ctx.beginPath();
      ctx.ellipse(0, -3, 2.2, 3, 0, 0, Math.PI * 2);
      ctx.ellipse(8, -3, 2.2, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe29a';
      ctx.beginPath();
      ctx.arc(0.6, -3, 0.8, 0, Math.PI * 2);
      ctx.arc(8.6, -3, 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ead7b3';
      ctx.beginPath();
      ctx.moveTo(7, 12);
      ctx.lineTo(9, 16);
      ctx.lineTo(11, 12);
      ctx.fill();
      ctx.strokeStyle = '#5d3028';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(2, 11);
      ctx.quadraticCurveTo(5, 12.5, 8, 11);
      ctx.stroke();
    }
    drawHeadgear(ctx, headItem, heroId, headColor);
    ctx.restore();

    ctx.fillStyle = PAL.trim;
    ctx.beginPath();
    ctx.arc(-1, -77 + bob, 4.2, 0, Math.PI * 2);
    ctx.fill();

    const weaponItem = this.game.equipped.weapon;
    const weaponColor = weaponItem?.glow || weaponItem?.rarity?.color || '#e8c06b';
    if (!weaponItem) {
      // 空手时不再凭空变出武器
    } else if (!showWeaponInHand) {
      ctx.save();
      ctx.translate(-1, -61);
      ctx.rotate(-0.64);
      drawHeroWeapon(ctx, heroId, weaponColor, false, ghost);
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(weaponPivotX, weaponPivotY + bob - bodyDrop);
      ctx.rotate(weaponAngle);
      drawHeroWeapon(ctx, heroId, weaponColor, true, ghost);
      ctx.restore();
      if (isTangseng) {
        const orbColor = this.attackRanged
          ? this.rangedType === 'ice' ? '#9fe0ff' : this.rangedType === 'chaos' ? '#b487ff' : '#ffb15f'
          : '#f5df9e';
        const tipX = weaponPivotX + Math.cos(weaponAngle) * 62;
        const tipY = weaponPivotY + bob - bodyDrop + Math.sin(weaponAngle) * 62;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, tipX, tipY, this.attackRanged ? 30 : 18, orbColor, this.attackRanged ? 0.45 : 0.22);
        ctx.fillStyle = orbColor;
        ctx.beginPath();
        ctx.arc(tipX, tipY, this.attackRanged ? 5.2 : 3.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    ctx.restore();
    this.drawLeg(ctx, 3, -40, legBase + 8 - stride, -3 - frontLift - (air ? 4 : 0), air ? 0.5 : 0, legColor, bootColor, chestTrim);

    if (effectActive && !ghost) {
      const slashColor = this.attackColor();
      if (effectRanged) {
        const orbColor = this.rangedType === 'ice' ? '#b9efff' : this.rangedType === 'chaos' ? '#c9a4ff' : '#ffd08a';
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, 24, -66, 34, orbColor, 0.52 * effectFade);
        for (let i = 0; i < 3; i += 1) {
          drawSlash(ctx, 20, -62, 42 + i * 8, -0.8 + i * 0.3, 0.8 + i * 0.3, orbColor, 0.2 * effectFade, 4);
        }
        ctx.restore();
      } else if (swingConfig) {
        drawSwingEffect(ctx, swingConfig, effectFade, slashColor, false);
      } else if (effectStyle === 's4') {
        drawThrustEffect(ctx, effectFade, slashColor, false);
      }
    }

    if (this.state === 'heavy' && this.heavyPhase === 'fall' && !ghost) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, 4, -38, 50, '#ffb24f', 0.4);
      ctx.restore();
    }

    if (this.hitFlash > 0 && !ghost) {
      const a = clamp(this.hitFlash / 0.16, 0, 1);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.28 * a;
      ctx.fillStyle = '#ffe8b8';
      ctx.beginPath();
      ctx.ellipse(0, -57, 26, 52, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  drawLeg(ctx, hipX, hipY, footX, footY, angle, color, bootColor = '#2a1b18', trimColor = '#d6ab58') {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 11;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.quadraticCurveTo(hipX + (footX - hipX) * 0.4, hipY + 20, footX, footY);
    ctx.stroke();
    ctx.fillStyle = bootColor;
    ctx.beginPath();
    ctx.ellipse(footX + 4, footY, 10, 4.5, angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = trimColor;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(footX - 5, footY - 7);
    ctx.lineTo(footX + 5, footY - 6);
    ctx.stroke();
    ctx.restore();
  }
}

function drawStaff(ctx, ox, oy, rarityColor, inHand, ghost) {
  const len = inHand ? 74 : 48;
  ctx.save();
  ctx.translate(ox, oy);
  if (!ghost) {
    ctx.shadowColor = hexToRgba(rarityColor, 0.55);
    ctx.shadowBlur = inHand ? 12 : 5;
  }
  ctx.strokeStyle = '#5b3220';
  ctx.lineWidth = 5.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-len, 0);
  ctx.lineTo(len, 0);
  ctx.stroke();
  ctx.strokeStyle = '#c99a4d';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-len + 9, -1.8);
  ctx.lineTo(len - 9, -1.8);
  ctx.stroke();
  for (const sx of [-len, len]) {
    ctx.fillStyle = '#e9c36c';
    ctx.beginPath();
    ctx.arc(sx, 0, 5.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8f5b22';
    ctx.beginPath();
    ctx.arc(sx, 0, 2.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,232,167,0.36)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-len + 3, -4.5);
  ctx.lineTo(len - 3, -4.5);
  ctx.stroke();
  ctx.restore();
}

function drawHeadgear(ctx, item, heroId, color) {
  if (!item) return;
  const set = item.set || '';
  const trim = item.rank >= 2 ? '#f2d58f' : '#c9b58a';
  ctx.save();
  ctx.lineCap = 'round';
  if (set === 'qitian') {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.arc(0, -1, 19, -2.82, -0.32);
    ctx.stroke();
    ctx.fillStyle = trim;
    ctx.beginPath();
    ctx.arc(0, -20, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-15, -10);
    ctx.quadraticCurveTo(-23, -17, -27, -9);
    ctx.quadraticCurveTo(-21, -7, -14, -5);
    ctx.moveTo(15, -10);
    ctx.quadraticCurveTo(23, -17, 27, -9);
    ctx.quadraticCurveTo(21, -7, 14, -5);
    ctx.stroke();
  } else if (set === 'jinchan') {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, -6, 20, Math.PI * 1.08, Math.PI * 1.92);
    ctx.quadraticCurveTo(0, -26, -20, -8);
    ctx.fill();
    ctx.strokeStyle = trim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-18, -7);
    ctx.quadraticCurveTo(0, -12, 18, -7);
    ctx.stroke();
    ctx.fillStyle = trim;
    ctx.beginPath();
    ctx.arc(0, -25, 2.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (set === 'juanlian') {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, -5, 20, Math.PI, Math.PI * 2);
    ctx.quadraticCurveTo(11, 3, 0, 4);
    ctx.quadraticCurveTo(-11, 3, -20, -5);
    ctx.fill();
    ctx.strokeStyle = trim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-20, -5);
    ctx.quadraticCurveTo(0, -9, 20, -5);
    ctx.stroke();
    ctx.fillStyle = trim;
    ctx.beginPath();
    ctx.moveTo(-2, -23);
    ctx.lineTo(2, -23);
    ctx.lineTo(4, -31);
    ctx.lineTo(0, -27);
    ctx.lineTo(-4, -31);
    ctx.closePath();
    ctx.fill();
  } else if (set === 'jingtan') {
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, -1, 19, -2.72, -0.42);
    ctx.stroke();
    ctx.fillStyle = trim;
    ctx.beginPath();
    ctx.moveTo(-17, -6);
    ctx.lineTo(-25, 0);
    ctx.lineTo(-19, 5);
    ctx.lineTo(-13, -2);
    ctx.closePath();
    ctx.fill();
  } else if (set === 'hunyuan') {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, -2, 19, -2.8, -0.34);
    ctx.stroke();
    ctx.fillStyle = trim;
    for (let i = 0; i < 5; i += 1) {
      const a = -2.7 + i * 0.55;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 15, Math.sin(a) * 15 - 4);
      ctx.lineTo(Math.cos(a) * 23, Math.sin(a) * 23 - 4);
      ctx.lineTo(Math.cos(a + 0.12) * 15, Math.sin(a + 0.12) * 15 - 4);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-18, -8);
    ctx.quadraticCurveTo(0, -13, 18, -8);
    ctx.stroke();
    ctx.fillStyle = trim;
    ctx.beginPath();
    ctx.arc(0, -11, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawHeroWeapon(ctx, heroId, color, inHand, ghost) {
  const kind = getHeroKit(heroId).weapon;
  if (kind === 'rake') drawRake(ctx, 0, 0, color, inHand, ghost);
  else if (kind === 'shovel') drawShovel(ctx, 0, 0, color, inHand, ghost);
  else if (kind === 'scepter') drawScepter(ctx, 0, 0, color, inHand, ghost);
  else drawStaff(ctx, 0, 0, color, inHand, ghost);
}

function drawRake(ctx, ox, oy, color, inHand, ghost) {
  const len = inHand ? 72 : 50;
  ctx.save();
  ctx.translate(ox, oy);
  if (!ghost) {
    ctx.shadowColor = hexToRgba(color, 0.5);
    ctx.shadowBlur = inHand ? 12 : 6;
  }
  ctx.strokeStyle = '#4f2d1d';
  ctx.lineWidth = 5.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-len * 0.45, 0);
  ctx.lineTo(len, 0);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(218,164,91,0.7)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-len * 0.4, -2);
  ctx.lineTo(len - 5, -2);
  ctx.stroke();
  ctx.fillStyle = '#8f632d';
  ctx.fillRect(len - 5, -14, 5, 28);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.6;
  for (let i = 0; i < 9; i += 1) {
    const ty = -13 + i * 3.25;
    ctx.beginPath();
    ctx.moveTo(len, ty);
    ctx.quadraticCurveTo(len + 11, ty + 5, len + 7, ty + 12);
    ctx.stroke();
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(-len * 0.45, 0, 4.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawShovel(ctx, ox, oy, color, inHand, ghost) {
  const len = inHand ? 76 : 52;
  ctx.save();
  ctx.translate(ox, oy);
  if (!ghost) {
    ctx.shadowColor = hexToRgba(color, 0.5);
    ctx.shadowBlur = inHand ? 12 : 6;
  }
  ctx.strokeStyle = '#4f2d1d';
  ctx.lineWidth = 5.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-len, 0);
  ctx.lineTo(len, 0);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(190,226,214,0.65)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-len + 9, -2);
  ctx.lineTo(len - 9, -2);
  ctx.stroke();
  for (const dir of [-1, 1]) {
    const bx = dir * len;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(bx - dir * 3, -14);
    ctx.quadraticCurveTo(bx + dir * 20, -5, bx - dir * 3, 0);
    ctx.quadraticCurveTo(bx + dir * 14, 5, bx - dir * 3, 14);
    ctx.quadraticCurveTo(bx - dir * 7, 4, bx - dir * 3, 0);
    ctx.quadraticCurveTo(bx - dir * 7, -4, bx - dir * 3, -14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(228,255,247,0.7)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(bx - dir * 2, -12);
    ctx.quadraticCurveTo(bx + dir * 12, -3, bx - dir * 2, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function drawScepter(ctx, ox, oy, color, inHand, ghost) {
  const len = inHand ? 72 : 50;
  ctx.save();
  ctx.translate(ox, oy);
  if (!ghost) {
    ctx.shadowColor = hexToRgba(color, 0.6);
    ctx.shadowBlur = inHand ? 15 : 7;
  }
  ctx.strokeStyle = '#5b3721';
  ctx.lineWidth = 4.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-len, 0);
  ctx.lineTo(len, 0);
  ctx.stroke();
  ctx.strokeStyle = '#d6b56e';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-len + 4, -1.8);
  ctx.lineTo(len - 3, -1.8);
  ctx.stroke();
  ctx.fillStyle = '#9d7a45';
  ctx.beginPath();
  ctx.arc(-len, 0, 3.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.arc(len - 5 - i * 7, 0, 5.2 - i * 0.7, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(len + 3, 0, 4.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,247,210,0.85)';
  ctx.beginPath();
  ctx.arc(len + 2, -1, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function getSwingConfig(style) {
  const configs = {
    w1: { cx: -4, cy: -56, rx: 96, ry: 58, start: -2.55, end: 0.62, tilt: -0.16, width: 40, depth: 9 },
    w2: { cx: 10, cy: -57, rx: 98, ry: 58, start: -2.35, end: 0.95, tilt: 0.27, width: 42, depth: 9 },
    w3: { cx: 0, cy: -58, rx: 116, ry: 54, start: -0.32, end: 6.05, tilt: 0.02, width: 32, depth: 12, ring: true },
    w4: { cx: 2, cy: -58, rx: 134, ry: 82, start: -2.72, end: 1.55, tilt: 0.28, width: 46, depth: 13, slam: true },
    air: { cx: 4, cy: -62, rx: 84, ry: 70, start: -2.2, end: 3.9, tilt: 0.1, width: 32, depth: 9, ring: true },
    s1: { cx: -4, cy: -58, rx: 98, ry: 54, start: -2.4, end: 0.75, tilt: -0.12, width: 36, depth: 9 },
    s2: { cx: 10, cy: -55, rx: 102, ry: 56, start: -2.32, end: 1.0, tilt: 0.28, width: 40, depth: 9 },
    s3: { cx: 0, cy: -56, rx: 110, ry: 49, start: -0.28, end: 5.85, tilt: 0.03, width: 34, depth: 12, ring: true },
    b1: { cx: -6, cy: -58, rx: 108, ry: 48, start: -2.5, end: 0.5, tilt: -0.2, width: 44, depth: 10 },
    b2: { cx: 12, cy: -55, rx: 112, ry: 52, start: -2.3, end: 1.0, tilt: 0.32, width: 46, depth: 10 },
    b3: { cx: 0, cy: -58, rx: 134, ry: 84, start: -2.8, end: 1.55, tilt: 0.29, width: 50, depth: 14, slam: true },
  };
  return configs[style] || null;
}

function drawSwingEffect(ctx, config, fade, color, back) {
  if (!fade || !config) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (back) {
    drawSwingRibbon(ctx, config, fade * 0.32, color, 1.3, config.depth * 0.7, true);
    ctx.restore();
    return;
  }
  for (let layer = 2; layer >= 0; layer -= 1) {
    const alpha = layer === 0 ? 0.98 * fade : (0.24 - layer * 0.06) * fade;
    drawSwingRibbon(ctx, config, alpha, color, 1 + layer * 0.2, -layer * config.depth * 0.26, false);
  }
  // 2.5D：近侧再压一条更亮的锋线，而不是描一个完美椭圆
  drawSwingRibbon(ctx, config, 0.62 * fade, '#fff1c8', 0.48, 3, false, true);
  if (!config.ring) {
    const a = config.end;
    const tipX = config.cx + Math.cos(a) * config.rx;
    const tipY = config.cy + Math.sin(a) * config.ry;
    ctx.save();
    glow(ctx, tipX, tipY, 28, color, 0.5 * fade);
    ctx.translate(tipX, tipY);
    ctx.rotate(a + Math.PI / 2);
    ctx.scale(1, 0.55);
    ctx.fillStyle = '#fff3ce';
    ctx.globalAlpha = fade;
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.quadraticCurveTo(15, 0, 0, 16);
    ctx.quadraticCurveTo(-6, 0, 0, -15);
    ctx.fill();
    ctx.restore();
  }
  if (config.slam) {
    ctx.save();
    ctx.globalAlpha = 0.36 * fade;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, -8, 94, 19, 0, 0.1, Math.PI * 1.9);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function drawSwingRibbon(ctx, config, alpha, color, widthScale, depthOffset, back, edgeOnly = false) {
  if (alpha <= 0.003) return;
  const steps = 34;
  const outer = [];
  const inner = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const a = config.start + (config.end - config.start) * t;
    const taper = config.ring ? Math.sin(Math.PI * t) : Math.pow(t, 0.7) * (1.08 - t * 0.18);
    const wobble = 1 + 0.055 * Math.sin(a * 2.35 + 1.1);
    const x = Math.cos(a) * config.rx * wobble;
    const y = Math.sin(a) * config.ry * wobble;
    const depth = 0.62 + 0.38 * Math.cos(a - 0.9);
    const width = config.width * widthScale * (0.06 + 0.94 * Math.pow(Math.max(0, taper), 0.62)) * depth;
    outer.push([x, y - width * 0.5]);
    inner.push([x, y + width * 0.5]);
  }
  ctx.save();
  ctx.translate(config.cx, config.cy + depthOffset);
  ctx.rotate(config.tilt);
  const grad = ctx.createLinearGradient(0, -config.ry, 0, config.ry);
  grad.addColorStop(0, hexToRgba(color, 0.08));
  grad.addColorStop(0.26, hexToRgba(color, 0.94));
  grad.addColorStop(0.52, '#fff1c8');
  grad.addColorStop(0.76, hexToRgba(color, 0.88));
  grad.addColorStop(1, hexToRgba(color, 0.08));
  ctx.globalAlpha = alpha;
  if (!edgeOnly) {
    ctx.fillStyle = grad;
    ctx.beginPath();
    for (let i = 0; i < outer.length; i += 1) {
      const [x, y] = outer[i];
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    for (let i = inner.length - 1; i >= 0; i -= 1) {
      const [x, y] = inner[i];
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = edgeOnly ? hexToRgba(color, 0.75) : 'rgba(255,247,220,0.65)';
  ctx.lineWidth = edgeOnly ? 1.2 : 1.8;
  ctx.beginPath();
  for (let i = 0; i < outer.length; i += 1) {
    const [x, y] = outer[i];
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawThrustEffect(ctx, fade, color, back) {
  if (!fade) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const alpha = back ? fade * 0.2 : fade * 0.86;
  ctx.globalAlpha = alpha;
  ctx.translate(8, -53);
  const len = back ? 118 : 148;
  const width = back ? 26 : 30;
  const g = ctx.createLinearGradient(0, 0, len, 0);
  g.addColorStop(0, hexToRgba(color, 0.05));
  g.addColorStop(0.25, hexToRgba(color, 0.65));
  g.addColorStop(0.78, '#fff4cf');
  g.addColorStop(1, hexToRgba(color, 0.02));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, -width * 0.2);
  ctx.quadraticCurveTo(len * 0.5, -width, len, -4);
  ctx.lineTo(len + 16, 0);
  ctx.lineTo(len, 4);
  ctx.quadraticCurveTo(len * 0.5, width, 0, width * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,248,220,0.7)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(4, 0);
  ctx.lineTo(len + 12, 0);
  ctx.stroke();
  for (let i = 0; i < 4; i += 1) {
    ctx.globalAlpha = alpha * (0.24 - i * 0.04);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(12 + i * 22, -10 - i * 2);
    ctx.lineTo(44 + i * 26, -16 - i * 3);
    ctx.stroke();
  }
  ctx.restore();
}
