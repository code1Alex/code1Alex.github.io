import {
  GROUND_Y,
  LEVEL_W,
  clamp,
  lerp,
  rand,
  choose,
  easeOutCubic,
  easeInCubic,
  easeInOutQuad,
  nextId,
} from './core.js';
import { drawSlash, glow, hexToRgba } from './gfx.js';

const GRAVITY = 2250;

export const GROUND_ATTACKS = [
  {
    name: '横扫',
    mult: 0.95,
    duration: 0.27,
    active: [0.075, 0.15],
    range: 124,
    height: 108,
    knock: 120,
    launch: 0,
    shake: 2.2,
    stop: 0.028,
    cancelAt: 0.12,
  },
  {
    name: '回风',
    mult: 1.22,
    duration: 0.3,
    active: [0.08, 0.17],
    range: 134,
    height: 112,
    knock: 170,
    launch: -40,
    shake: 2.8,
    stop: 0.032,
    cancelAt: 0.14,
  },
  {
    name: '定海',
    mult: 2.15,
    duration: 0.46,
    active: [0.17, 0.27],
    range: 166,
    height: 124,
    knock: 380,
    launch: -330,
    shake: 6,
    stop: 0.06,
    cancelAt: 0.3,
  },
];

const AIR_ATTACK = {
  name: '旋风',
  mult: 1.15,
  duration: 0.38,
  active: [0.08, 0.2],
  range: 136,
  height: 126,
  knock: 220,
  launch: -120,
  shake: 3,
  stop: 0.032,
  cancelAt: 0.16,
};

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
    this.visualScale = 1.2;
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

  syncMaxHp(newMax) {
    const diff = newMax - this.maxHp;
    this.maxHp = newMax;
    if (diff > 0) this.hp = Math.min(this.maxHp, this.hp + diff);
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

    if (this.comboWindow > 0) {
      this.comboWindow = Math.max(0, this.comboWindow - dt);
      if (this.comboWindow <= 0) this.comboStep = 0;
    }

    if (!this.dead) {
      const regen = 6.2 + (game.stats.energyRegen || 0);
      this.energy = clamp(this.energy + regen * dt, 0, this.maxEnergy);
      if (this.sinceDamage > 4.5 && this.hp < this.maxHp) {
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
    this.dashPressed = input.wasPressed('ShiftLeft', 'ShiftRight', 'KeyC');

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

    if (input.wasPressed('Space')) this.jumpBuffer = 0.13;
    if (!input.isDown('Space') && !this.jumpCut && this.vy < -250) {
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

    if (input.wasPressed('KeyU') && this.energy >= this.maxEnergy && !this.isBusy()) {
      this.startUlt(game);
      return;
    }

    if (input.wasPressed('KeyK') && this.heavyCd <= 0 && this.energy >= 15 && !this.isBusy()) {
      this.startHeavy(game);
      return;
    }

    if (input.wasPressed('KeyL') && this.castCd <= 0 && this.energy >= 20 && !this.isBusy()) {
      this.startCast(game);
      return;
    }

    if (input.wasPressed('KeyJ')) this.attackBuffer = 0.17;

    if (this.state === 'attack' || this.state === 'airAttack') {
      this.updateAttack(game, dt);
      this.physics(game, dt, this.attackAir ? 0.38 : 0.72);
      return;
    }

    if (this.attackBuffer > 0 && !this.isBusy()) {
      if (!this.onGround) {
        this.startAttack(game, 1);
      } else {
        const next = this.comboWindow > 0 && this.comboStep > 0 ? Math.min(3, this.comboStep + 1) : 1;
        this.startAttack(game, next);
      }
      this.updateAttack(game, dt);
      this.physics(game, dt, this.attackAir ? 0.38 : 0.72);
      return;
    }

    let move = 0;
    if (input.isDown('KeyA', 'ArrowLeft')) move -= 1;
    if (input.isDown('KeyD', 'ArrowRight')) move += 1;
    if (move !== 0) this.facing = move;
    const speed = game.stats.speed;
    const target = move * speed;
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

  startAttack(game, step) {
    this.comboStep = step;
    this.attackStep = step;
    this.attackAir = !this.onGround;
    this.currentAttack = this.attackAir ? AIR_ATTACK : GROUND_ATTACKS[step - 1];
    this.attackTimer = 0;
    this.attackDuration = this.currentAttack.duration;
    this.attackHit = false;
    this.attackQueued = false;
    this.state = this.attackAir ? 'airAttack' : 'attack';
    this.stateTime = 0;
    this.comboWindow = 0;
    this.attackBuffer = 0;
    if (this.attackAir) {
      this.vy = Math.min(this.vy, 40);
      this.comboStep = 0;
      game.sound.play('swing', 0.8);
    } else {
      this.vx += this.facing * (step === 3 ? 260 : 125);
      game.sound.play(step === 3 ? 'swingHeavy' : 'swing');
    }
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
      const isAir = this.attackAir;
      const rect = isAir
        ? { x: this.x - def.range / 2, y: this.y - def.height, w: def.range, h: def.height }
        : {
            x: this.facing > 0 ? this.x + 8 : this.x - def.range - 8,
            y: this.y - def.height,
            w: def.range,
            h: def.height,
          };
      game.playerStrike(rect, {
        mult: def.mult,
        sourceX: this.x,
        knock: def.knock,
        launch: def.launch,
        hitstop: def.stop,
        shake: def.shake,
        color: '#ffd27a',
        style: isAir ? 'spin' : this.attackStep,
        critBonus: 0,
      });
      this.impactFlash = 0.12;
    }

    if (game.input.wasPressed('KeyJ')) {
      this.attackQueued = true;
    }

    if (this.attackQueued && this.attackTimer >= def.active[1] + 0.025 && this.attackStep < 3 && !this.attackAir) {
      this.startAttack(game, this.attackStep + 1);
      return;
    }

    if (this.attackTimer >= this.attackDuration) {
      if (this.attackQueued && this.attackStep < 3 && !this.attackAir) {
        this.startAttack(game, this.attackStep + 1);
      } else {
        const wasAir = this.attackAir;
        this.state = this.onGround ? 'idle' : 'fall';
        this.comboWindow = wasAir ? 0 : 0.62;
        this.attackHit = false;
        if (this.attackStep >= 3 || wasAir) this.comboStep = 0;
        this.attackStep = 0;
        this.attackAir = false;
        this.attackQueued = false;
      }
    }
  }

  tryDash(game) {
    if (this.dashCd > 0 || this.state === 'hurt' || this.state === 'ult') return;
    if (!this.onGround && this.airDashUsed) return;
    if (!this.onGround) this.airDashUsed = true;
    let dir = this.facing;
    if (game.input.isDown('KeyA', 'ArrowLeft')) dir = -1;
    if (game.input.isDown('KeyD', 'ArrowRight')) dir = 1;
    this.facing = dir;
    this.dashDir = dir;
    this.state = 'dash';
    this.dashTimer = 0.16;
    this.dashCd = 0.7;
    this.invuln = Math.max(this.invuln, 0.26);
    this.vx = dir * 1030;
    this.vy = 0;
    this.trailTimer = 0;
    this.comboWindow = 0;
    this.comboStep = 0;
    this.attackQueued = false;
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
    this.heavyCd = 3.4;
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
    if (game.input.wasPressed('ShiftLeft', 'ShiftRight') && this.heavyPhase === 'recover') {
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
      { x: this.x, y: this.y - 20, r: 196 },
      {
        mult: 3.3,
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
    this.castCd = 2.3;
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
    const def = game.stats.def || 0;
    const reduction = 100 / (100 + def * 2.4);
    let damage = Math.max(1, Math.round(rawDamage * reduction * rand(0.92, 1.06)));
    if (this.hp - damage < 0) damage = this.hp;
    this.hp = Math.max(0, this.hp - damage);
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
    game.hitstop(0.055);
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
    this.hp = Math.min(this.maxHp, this.hp + amount);
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
    if (!ghost) {
      ctx.save();
      const airH = clamp((GROUND_Y - this.y) / 220, 0, 1);
      ctx.globalAlpha = 0.3 * (1 - airH * 0.65);
      ctx.fillStyle = '#05060a';
      ctx.beginPath();
      ctx.ellipse(this.x, GROUND_Y + 4, 36 * (1 - airH * 0.3), 9 * (1 - airH * 0.35), 0, 0, Math.PI * 2);
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
    if (this.hitFlash > 0 && !ghost) ctx.filter = 'brightness(1.6) saturate(0.72)';

    const air = !this.onGround;
    const moving = this.state === 'run';
    const run = this.runPhase;
    const bob = this.onGround ? (moving ? Math.sin(run * 2) * 2.4 : Math.sin(t * 2.2) * 1.1) : 0;
    const lean = moving ? 0.09 : 0;
    const attackProgress = this.attackDuration ? clamp(this.attackTimer / this.attackDuration, 0, 1) : 0;
    let staffAngle = -0.72;
    let staffPivotX = 18;
    let staffPivotY = -58;
    let showStaffInHand = false;
    let handFront = { x: 14, y: -55 };
    let handBack = { x: -12, y: -57 };

    if (this.state === 'attack' || this.state === 'airAttack') {
      showStaffInHand = true;
      if (this.attackAir) {
        staffAngle = -Math.PI / 2 + attackProgress * Math.PI * 4;
        staffPivotX = 8;
        staffPivotY = -64;
      } else if (this.attackStep === 1) {
        staffAngle = lerp(-2.65, 0.6, easeOutCubic(attackProgress));
        staffPivotX = 14;
        staffPivotY = -62;
      } else if (this.attackStep === 2) {
        staffAngle = lerp(0.55, -2.6, easeInOutQuad(attackProgress));
        staffPivotX = 12;
        staffPivotY = -55;
      } else {
        staffAngle = attackProgress < 0.42
          ? lerp(-2.9, -2.35, attackProgress / 0.42)
          : lerp(-2.35, 1.25, easeInCubic((attackProgress - 0.42) / 0.58));
        staffPivotX = 17;
        staffPivotY = -68;
      }
      handFront = {
        x: staffPivotX + Math.cos(staffAngle) * 20,
        y: staffPivotY + Math.sin(staffAngle) * 20,
      };
    } else if (this.state === 'heavy') {
      showStaffInHand = true;
      if (this.heavyPhase === 'rise') {
        staffAngle = -2.7;
        staffPivotX = 10;
        staffPivotY = -78;
      } else if (this.heavyPhase === 'fall') {
        staffAngle = 1.32;
        staffPivotX = 22;
        staffPivotY = -72;
      } else {
        staffAngle = 1.4;
        staffPivotX = 25;
        staffPivotY = -58;
      }
      handFront = {
        x: staffPivotX + Math.cos(staffAngle) * 22,
        y: staffPivotY + Math.sin(staffAngle) * 22,
      };
    } else if (this.state === 'cast') {
      showStaffInHand = true;
      staffAngle = -0.12;
      staffPivotX = 20;
      staffPivotY = -60;
      handFront = { x: 34, y: -58 };
    } else if (this.state === 'ult') {
      showStaffInHand = true;
      staffAngle = -1.1 + this.ultTimer * 9;
      staffPivotX = 10;
      staffPivotY = -92;
      handFront = { x: 28, y: -88 };
    }

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

    const scarfWave = Math.sin(t * 7) * 4 + (moving ? 8 : 0);
    ctx.save();
    ctx.fillStyle = '#cf4738';
    ctx.beginPath();
    ctx.moveTo(-4, -79);
    ctx.quadraticCurveTo(-26, -79 + Math.sin(t * 5) * 2, -45 - Math.abs(this.vx) * 0.025, -69 + scarfWave);
    ctx.quadraticCurveTo(-37, -62, -22, -70);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e46844';
    ctx.beginPath();
    ctx.moveTo(-9, -76);
    ctx.quadraticCurveTo(-32, -70 + Math.sin(t * 5 + 1) * 3, -53 - Math.abs(this.vx) * 0.02, -55 + scarfWave * 0.7);
    ctx.quadraticCurveTo(-32, -58, -16, -69);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

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

    const legSwing = moving ? Math.sin(run) * 12 : 0;
    const legLift = moving ? Math.max(0, Math.sin(run)) * 7 : 0;
    this.drawLeg(ctx, -7, -40, -18 + legSwing * 0.55, -3 - (air ? 8 : 0), air ? -0.8 : 0, '#3b2822');

    ctx.save();
    ctx.strokeStyle = '#4a2f27';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-7, -68);
    if (showStaffInHand && this.attackStep !== 2) ctx.lineTo(handBack.x, handBack.y);
    else ctx.lineTo(-17 + (moving ? Math.sin(run + Math.PI) * 9 : 0), -48 + bob);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(0, -60 + bob);
    ctx.rotate(lean);
    const bodyG = ctx.createLinearGradient(-20, -25, 22, 26);
    bodyG.addColorStop(0, '#6d4936');
    bodyG.addColorStop(1, '#3b2922');
    ctx.fillStyle = bodyG;
    ctx.beginPath();
    ctx.ellipse(0, 0, 20, 25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#946440';
    ctx.beginPath();
    ctx.ellipse(5, 6, 11, 15, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c34a37';
    ctx.beginPath();
    ctx.moveTo(-17, -18);
    ctx.quadraticCurveTo(0, -25, 18, -16);
    ctx.lineTo(17, 2);
    ctx.quadraticCurveTo(8, 11, 0, 12);
    ctx.quadraticCurveTo(-10, 11, -17, 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#e1b258';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-16, -15);
    ctx.quadraticCurveTo(0, -21, 17, -14);
    ctx.moveTo(-2, -18);
    ctx.lineTo(-2, 11);
    ctx.stroke();
    ctx.fillStyle = '#e4bd66';
    ctx.beginPath();
    ctx.arc(1, -3, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5e1f1d';
    ctx.beginPath();
    ctx.arc(1, -3, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#36211d';
    ctx.fillRect(-18, 10, 35, 6);
    ctx.fillStyle = '#d9b15b';
    ctx.fillRect(-2, 10, 7, 6);
    ctx.restore();

    this.drawLeg(ctx, 5, -40, 17 - legSwing * 0.45, -3 - legLift * 0.35 - (air ? 4 : 0), air ? 0.5 : 0, '#54352a');

    ctx.save();
    ctx.strokeStyle = '#5a392c';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(8, -67 + bob);
    if (showStaffInHand) ctx.lineTo(handFront.x, handFront.y + bob);
    else {
      const swing = moving ? Math.sin(run + Math.PI) * 10 : 0;
      ctx.lineTo(17 + swing, -45 + bob);
    }
    ctx.stroke();
    ctx.fillStyle = '#d9ad7c';
    ctx.beginPath();
    ctx.arc(showStaffInHand ? handFront.x : 17, (showStaffInHand ? handFront.y : -44) + bob, 4.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const headY = -92 + bob;
    ctx.save();
    ctx.translate(4, headY);
    ctx.fillStyle = '#6b4632';
    ctx.beginPath();
    ctx.arc(-16, 1, 6.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d39a72';
    ctx.beginPath();
    ctx.arc(-16, 1, 3, 0, Math.PI * 2);
    ctx.fill();
    const headG = ctx.createRadialGradient(7, -6, 2, 0, 0, 23);
    headG.addColorStop(0, '#7a5239');
    headG.addColorStop(1, '#4b3026');
    ctx.fillStyle = headG;
    ctx.beginPath();
    ctx.arc(0, 0, 19, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e3b98c';
    ctx.beginPath();
    ctx.ellipse(8, 2, 13.5, 14.5, -0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c99266';
    ctx.beginPath();
    ctx.ellipse(17, 5, 5, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7d523a';
    ctx.beginPath();
    ctx.arc(17, -1, 5.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e0a67c';
    ctx.beginPath();
    ctx.arc(17, -1, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1d1412';
    ctx.beginPath();
    ctx.ellipse(12, -4, 3.6, 4.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd469';
    ctx.beginPath();
    ctx.ellipse(13, -4.4, 1.7, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1f1712';
    ctx.beginPath();
    ctx.arc(13.3, -4.4, 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2a1a17';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(8, -9.5);
    ctx.quadraticCurveTo(12, -11.5, 16, -9);
    ctx.stroke();
    ctx.fillStyle = '#4b2e25';
    ctx.beginPath();
    ctx.arc(20.5, 4, 1.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,45,33,0.75)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(12, 9);
    ctx.quadraticCurveTo(16, 11, 19, 9);
    ctx.stroke();
    ctx.strokeStyle = '#f0d1a5';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-2, 4);
    ctx.lineTo(-8, 6);
    ctx.moveTo(-1, 0);
    ctx.lineTo(-7, 0);
    ctx.stroke();
    ctx.strokeStyle = '#e9c36c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 19, -2.7, -0.5);
    ctx.stroke();
    ctx.fillStyle = '#ffe29a';
    ctx.beginPath();
    ctx.arc(2, -19, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b64a38';
    ctx.lineWidth = 2.1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-4, -18);
    ctx.bezierCurveTo(-13, -28, -24, -31, -35, -27 + Math.sin(t * 3) * 5);
    ctx.stroke();
    ctx.strokeStyle = '#e08356';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-5, -16);
    ctx.bezierCurveTo(-15, -24, -25, -26, -32, -21 + Math.sin(t * 3) * 5);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#e8bb64';
    ctx.beginPath();
    ctx.arc(-1, -77 + bob, 4.2, 0, Math.PI * 2);
    ctx.fill();

    if (!showStaffInHand) {
      ctx.save();
      ctx.translate(-1, -61);
      ctx.rotate(-0.64);
      drawStaff(ctx, 0, 0, this.game.equipped.weapon?.rarity?.color || '#e8c06b', false, ghost);
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(staffPivotX, staffPivotY + bob);
      ctx.rotate(staffAngle);
      drawStaff(ctx, 0, 0, this.game.equipped.weapon?.rarity?.color || '#e8c06b', true, ghost);
      ctx.restore();
    }

    if ((this.state === 'attack' || this.state === 'airAttack') && !ghost) {
      const def = this.currentAttack;
      if (def && this.attackTimer >= def.active[0] * 0.75 && this.attackTimer <= def.active[1] + 0.11) {
        const fade = clamp((def.active[1] + 0.11 - this.attackTimer) / 0.12, 0, 1);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        if (this.attackAir) {
          drawSlash(ctx, 5, -62, 78, -1.7, 1.6, '#ffd16e', 0.7 * fade, 12);
          drawSlash(ctx, 5, -62, 58, 1.6, 4.2, '#fff0bb', 0.55 * fade, 7);
        } else if (this.attackStep === 1) {
          drawSlash(ctx, 16, -64, 88, -2.4, 0.9, '#ffd06a', 0.65 * fade, 11);
        } else if (this.attackStep === 2) {
          drawSlash(ctx, 12, -62, 92, 2.25, 5.8, '#ffbe5d', 0.62 * fade, 11);
        } else {
          drawSlash(ctx, 18, -58, 106, 0.6, 3.9, '#ffca62', 0.82 * fade, 15);
        }
        ctx.restore();
      }
    }

    if (this.state === 'heavy' && this.heavyPhase === 'fall' && !ghost) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, 4, -38, 50, '#ffb24f', 0.4);
      ctx.restore();
    }

    ctx.restore();
  }

  drawLeg(ctx, hipX, hipY, footX, footY, angle, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 11;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.quadraticCurveTo(hipX + (footX - hipX) * 0.4, hipY + 20, footX, footY);
    ctx.stroke();
    ctx.fillStyle = '#2a1b18';
    ctx.beginPath();
    ctx.ellipse(footX + 4, footY, 10, 4.5, angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d6ab58';
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
