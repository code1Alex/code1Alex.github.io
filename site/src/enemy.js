import {
  GROUND_Y,
  LEVEL_W,
  clamp,
  rand,
  choose,
  chance,
  damp,
  approach,
  nextId,
} from './core.js';
import { fillRound, glow, drawDiamond } from './gfx.js';
import { Projectile } from './projectile.js';

const GRAVITY = 2250;

const ENEMY_TYPES = {
  grunt: {
    name: '山魈小妖',
    hp: 100,
    speed: 118,
    w: 46,
    h: 80,
    damage: 14,
    xp: 16,
    coins: [2, 5],
    attackRange: 84,
    windup: 0.38,
    active: 0.16,
    recover: 0.5,
    cooldown: 1.05,
    height: 80,
  },
  archer: {
    name: '赤羽弓手',
    hp: 82,
    speed: 92,
    w: 42,
    h: 82,
    damage: 13,
    xp: 19,
    coins: [3, 6],
    attackRange: 560,
    windup: 0.58,
    active: 0.16,
    recover: 0.52,
    cooldown: 2.15,
    height: 82,
  },
  brute: {
    name: '石甲妖',
    hp: 290,
    speed: 66,
    w: 68,
    h: 112,
    damage: 26,
    xp: 44,
    coins: [6, 11],
    attackRange: 118,
    windup: 0.78,
    active: 0.22,
    recover: 0.72,
    cooldown: 1.8,
    height: 112,
  },
  boss: {
    name: '混世妖将',
    hp: 2350,
    speed: 102,
    w: 94,
    h: 154,
    damage: 34,
    xp: 260,
    coins: [60, 90],
    attackRange: 168,
    windup: 0.65,
    active: 0.22,
    recover: 0.8,
    cooldown: 1.5,
    height: 154,
  },
};

export class Enemy {
  constructor(game, kind, x, options = {}) {
    this.game = game;
    this.id = nextId();
    this.kind = kind;
    this.data = ENEMY_TYPES[kind];
    this.displayName = options.displayName || this.data.name;
    this.x = clamp(x, 60, LEVEL_W - 60);
    this.y = options.y ?? GROUND_Y;
    this.vx = 0;
    this.vy = 0;
    this.w = this.data.w;
    this.h = this.data.h;
    this.visualScale = kind === 'boss' ? 1.32 : kind === 'brute' ? 1.1 : 1.12;
    this.facing = x < game.player.x ? 1 : -1;
    this.hp = this.data.hp * (options.hpScale || 1);
    this.maxHp = this.hp;
    this.damageScale = options.damageScale || 1;
    this.state = 'idle';
    this.stateTimer = 0;
    this.attackTimer = 0;
    this.cooldown = rand(0.4, 1.1);
    this.didHit = false;
    this.hitFlash = 0;
    this.dead = false;
    this.deathTimer = 0;
    this.remove = false;
    this.rewarded = false;
    this.animTime = rand(0, 10);
    this.spawnTime = 0.42;
    this.onGround = true;
    this.isBoss = kind === 'boss';
    this.summoned = false;
    this.phase = 'intro';
    this.actionCd = 1.2;
    this.targetX = this.x;
    this.chargeHit = false;
    this.slowT = 0;
    this.moveDust = 0;
  }

  get alive() {
    return !this.dead;
  }

  update(game, dt) {
    this.animTime += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (this.dead) {
      this.deathTimer += dt;
      this.vy += GRAVITY * 0.5 * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.y > GROUND_Y) {
        this.y = GROUND_Y;
        this.vy = 0;
        this.vx *= 0.82;
      }
      if (this.deathTimer > 1.25) this.remove = true;
      return;
    }
    if (this.spawnTime > 0) {
      this.spawnTime -= dt;
      return;
    }
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.slowT = Math.max(0, this.slowT - dt);
    const scale = this.slowT > 0 ? 0.45 : 1;
    const sdt = dt * scale;
    if (this.isBoss) {
      this.updateBoss(game, sdt);
    } else {
      this.updateNormal(game, sdt);
    }
    this.updatePhysics(game, sdt);
    this.separate(game);
  }

  updateNormal(game, dt) {
    const p = game.player;
    const dx = p.x - this.x;
    const dist = Math.abs(dx);
    if (this.state === 'hurt') {
      this.stateTimer -= dt;
      this.vx = damp(this.vx, 0, 6, dt);
      if (this.stateTimer <= 0) this.state = 'idle';
      return;
    }

    if (this.state === 'windup') {
      this.stateTimer += dt;
      this.vx = damp(this.vx, 0, 10, dt);
      this.facing = dx >= 0 ? 1 : -1;
      if (this.stateTimer >= this.data.windup) {
        this.state = 'active';
        this.stateTimer = 0;
        if (this.kind === 'archer') {
          this.fireArrow(game);
          this.didHit = true;
        }
      }
      return;
    }

    if (this.state === 'active') {
      this.stateTimer += dt;
      if (!this.didHit && this.stateTimer >= 0.045) {
        this.didHit = true;
        this.resolveAttack(game);
      }
      if (this.stateTimer >= this.data.active) {
        this.state = 'recover';
        this.stateTimer = 0;
      }
      return;
    }

    if (this.state === 'recover') {
      this.stateTimer += dt;
      this.vx = damp(this.vx, 0, 11, dt);
      if (this.stateTimer >= this.data.recover) {
        this.state = 'idle';
        this.stateTimer = 0;
        this.cooldown = this.data.cooldown;
      }
      return;
    }

    this.facing = dx >= 0 ? 1 : -1;
    let move = 0;
    if (this.kind === 'grunt') {
      if (dist < this.data.attackRange && this.cooldown <= 0) this.startWindup();
      else if (dist > 58) move = Math.sign(dx);
    } else if (this.kind === 'archer') {
      if (this.cooldown <= 0 && dist < this.data.attackRange && dist > 115) this.startWindup();
      else if (dist < 205) move = -Math.sign(dx);
      else if (dist > 350) move = Math.sign(dx);
    } else if (this.kind === 'brute') {
      if (dist < this.data.attackRange && this.cooldown <= 0 && this.onGround) this.startWindup();
      else if (dist > 72) move = Math.sign(dx);
    }

    this.vx = approach(this.vx, move * this.data.speed, (this.onGround ? 620 : 300) * dt);
    if (move !== 0 && this.onGround) {
      this.moveDust -= dt;
      if (this.moveDust <= 0) {
        this.moveDust = this.kind === 'brute' ? 0.42 : 0.28;
        game.addParticle({
          x: this.x - this.facing * 10,
          y: GROUND_Y - 2,
          vx: -this.facing * rand(10, 40),
          vy: rand(-30, -5),
          life: rand(0.25, 0.45),
          size: rand(3, 6),
          color: '#967b62',
          kind: 'dust',
        });
      }
    }
  }

  startWindup() {
    this.state = 'windup';
    this.stateTimer = 0;
    this.didHit = false;
    this.vx = 0;
    this.game.sound.play('ui', 0.35);
  }

  resolveAttack(game) {
    const p = game.player;
    if (p.dead) return;
    const dx = p.x - this.x;
    const facingOk = Math.sign(dx || this.facing) === this.facing || Math.abs(dx) < 20;
    if (this.kind === 'grunt') {
      if (Math.abs(dx) < 96 && facingOk && Math.abs(p.y - this.y) < 100) {
        game.hurtPlayer(this.data.damage * this.damageScale, this.x, { knock: 240 });
        game.sound.play('swingHeavy', 0.45);
      } else {
        game.sound.play('miss');
      }
    } else if (this.kind === 'brute') {
      if (Math.abs(dx) < 152 && Math.abs(p.y - this.y) < 130) {
        game.hurtPlayer(this.data.damage * this.damageScale, this.x, { knock: 340 });
        game.sound.play('explode', 0.65);
        game.shake(10);
      } else {
        game.sound.play('miss');
      }
      game.addParticle({
        x: this.x + this.facing * 45,
        y: GROUND_Y - 6,
        vx: 0,
        vy: 0,
        life: 0.42,
        size: 20,
        color: '#c19c70',
        kind: 'shockwave',
      });
      for (let i = 0; i < 16; i += 1) {
        game.addParticle({
          x: this.x + this.facing * rand(10, 70),
          y: GROUND_Y - rand(0, 10),
          vx: rand(-160, 160),
          vy: rand(-230, -50),
          life: rand(0.25, 0.6),
          size: rand(3, 8),
          color: choose(['#a88e70', '#7a6b5c']),
          kind: 'dust',
          gravity: 700,
        });
      }
    }
  }

  fireArrow(game) {
    const p = game.player;
    const sx = this.x + this.facing * 28;
    const sy = this.y - 54;
    const tx = p.x;
    const ty = p.y - 55;
    const angle = Math.atan2(ty - sy, tx - sx);
    game.projectiles.push(
      new Projectile({
        x: sx,
        y: sy,
        vx: Math.cos(angle) * 490,
        vy: Math.sin(angle) * 490,
        radius: 8,
        life: 2.2,
        owner: 'enemy',
        type: 'arrow',
        damage: this.data.damage * this.damageScale,
      })
    );
    game.sound.play('swing', 0.55);
    for (let i = 0; i < 6; i += 1) {
      game.addParticle({
        x: sx,
        y: sy,
        vx: this.facing * rand(20, 90),
        vy: rand(-30, 30),
        life: rand(0.15, 0.3),
        size: rand(1.5, 3.5),
        color: '#d8b477',
        kind: 'spark',
      });
    }
  }

  updateBoss(game, dt) {
    const p = game.player;
    const dx = p.x - this.x;
    const dist = Math.abs(dx);
    if (this.phase === 'intro') {
      this.stateTimer += dt;
      this.vx = 0;
      this.facing = dx >= 0 ? 1 : -1;
      if (this.stateTimer > 1.15) {
        this.phase = 'idle';
        this.stateTimer = 0;
        this.actionCd = 1.1;
        game.onBossEngaged?.(this);
      }
      return;
    }
    if (this.phase === 'idle') {
      this.facing = dx >= 0 ? 1 : -1;
      this.actionCd -= dt;
      if (dist > 135) this.vx = approach(this.vx, this.facing * this.data.speed, 500 * dt);
      else this.vx = damp(this.vx, 0, 8, dt);
      if (this.actionCd <= 0) {
        if (this.hp < this.maxHp * 0.56 && !this.summoned) {
          this.summoned = true;
          this.beginBossPhase('summon', 0.82);
        } else if (dist > 330) {
          this.beginBossPhase('chargeWindup', 0.62);
        } else if (chance(0.48)) {
          this.beginBossPhase('cleaveWindup', 0.52);
        } else {
          this.beginBossPhase('slamWindup', 0.6);
        }
      }
      return;
    }

    this.stateTimer += dt;
    if (this.phase === 'chargeWindup') {
      this.vx = damp(this.vx, 0, 12, dt);
      this.facing = dx >= 0 ? 1 : -1;
      if (this.stateTimer >= 0.62) {
        this.phase = 'charge';
        this.stateTimer = 0;
        this.vx = this.facing * 980;
        this.chargeHit = false;
        game.sound.play('swingHeavy', 0.85);
        game.shake(5);
      }
      return;
    }

    if (this.phase === 'charge') {
      this.vx = this.facing * 980;
      this.x += this.vx * dt;
      this.x = clamp(this.x, 60, LEVEL_W - 60);
      if (this.onGround) {
        game.addParticle({
          x: this.x - this.facing * rand(10, 40),
          y: GROUND_Y - rand(0, 10),
          vx: -this.facing * rand(80, 230),
          vy: rand(-120, -30),
          life: rand(0.25, 0.5),
          size: rand(4, 10),
          color: '#977b60',
          kind: 'dust',
        });
      }
      if (!this.chargeHit && Math.abs(p.x - this.x) < 78 && Math.abs(p.y - this.y) < 120 && !p.dead) {
        this.chargeHit = true;
        game.hurtPlayer(32, this.x, { knock: 500 });
        game.shake(13);
        game.hitstop(0.06);
      }
      if (this.stateTimer >= 0.46 || Math.abs(this.x - p.x) < 30) {
        this.phase = 'recover';
        this.stateTimer = 0;
        this.targetX = this.x;
      }
      return;
    }

    if (this.phase === 'slamWindup') {
      this.vx = damp(this.vx, 0, 12, dt);
      if (this.stateTimer >= 0.6) {
        this.phase = 'slamAir';
        this.stateTimer = 0;
        this.vy = -980;
        this.onGround = false;
        this.vx = clamp(dx / 0.8, -500, 500);
        this.targetX = clamp(p.x, 90, LEVEL_W - 90);
        game.sound.play('jump', 1.2);
        game.shake(8);
      }
      return;
    }

    if (this.phase === 'slamAir') {
      this.vy += GRAVITY * 1.35 * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.y >= GROUND_Y && this.vy > 0) {
        this.y = GROUND_Y;
        this.vy = 0;
        this.onGround = true;
        this.phase = 'recover';
        this.stateTimer = 0;
        this.bossSlam(game);
      }
      this.x = clamp(this.x, 60, LEVEL_W - 60);
      return;
    }

    if (this.phase === 'cleaveWindup') {
      this.vx = damp(this.vx, 0, 12, dt);
      this.facing = dx >= 0 ? 1 : -1;
      if (this.stateTimer >= 0.55) {
        this.phase = 'cleave';
        this.stateTimer = 0;
        this.didHit = false;
        game.sound.play('swingHeavy', 0.9);
      }
      return;
    }

    if (this.phase === 'cleave') {
      if (!this.didHit && this.stateTimer >= 0.06) {
        this.didHit = true;
        const inFront = this.facing > 0 ? p.x > this.x - 10 && p.x < this.x + 190 : p.x < this.x + 10 && p.x > this.x - 190;
        if (inFront && Math.abs(p.y - this.y) < 140 && !p.dead) {
          game.hurtPlayer(31, this.x, { knock: 420 });
        }
        game.addParticle({
          x: this.x + this.facing * 60,
          y: this.y - 84,
          vx: this.facing * 20,
          vy: 0,
          life: 0.28,
          size: 22,
          color: '#ff9c5f',
          kind: 'slash',
          line: 110,
        });
      }
      if (this.stateTimer >= 0.3) {
        this.phase = 'recover';
        this.stateTimer = 0;
      }
      return;
    }

    if (this.phase === 'summon') {
      this.vx = damp(this.vx, 0, 8, dt);
      if (!this.didHit && this.stateTimer >= 0.62) {
        this.didHit = true;
        game.spawnBossAdds(this);
        game.shake(10);
      }
      if (this.stateTimer >= 0.92) {
        this.phase = 'recover';
        this.stateTimer = 0;
      }
      return;
    }

    if (this.phase === 'recover') {
      this.vx = damp(this.vx, 0, 7, dt);
      if (this.stateTimer >= 0.85) {
        this.phase = 'idle';
        this.stateTimer = 0;
        this.actionCd = rand(1.0, 1.6);
      }
    }
  }

  beginBossPhase(phase, duration) {
    this.phase = phase;
    this.stateTimer = 0;
    this.didHit = false;
    this.game.sound.play('boss', 0.35);
    this.game.shake(4);
    if (phase === 'slamWindup') this.targetX = clamp(this.game.player.x, 90, LEVEL_W - 90);
    if (phase === 'chargeWindup') this.facing = this.game.player.x >= this.x ? 1 : -1;
  }

  bossSlam(game) {
    game.shake(20);
    game.hitstop(0.08);
    game.sound.play('explode', 1.3);
    const p = game.player;
    if (Math.abs(p.x - this.x) < 205 && p.y > GROUND_Y - 160 && !p.dead) {
      game.hurtPlayer(38, this.x, { knock: 480 });
    }
    game.addParticle({
      x: this.x,
      y: GROUND_Y - 6,
      vx: 0,
      vy: 0,
      life: 0.6,
      size: 30,
      color: '#ff9d57',
      kind: 'shockwave',
    });
    game.addParticle({
      x: this.x,
      y: GROUND_Y - 6,
      vx: 0,
      vy: 0,
      life: 0.45,
      size: 70,
      color: '#ffd27a',
      kind: 'ring',
      line: 8,
    });
    for (let i = 0; i < 34; i += 1) {
      const dir = i % 2 === 0 ? -1 : 1;
      game.addParticle({
        x: this.x + rand(-50, 50),
        y: GROUND_Y - rand(0, 20),
        vx: dir * rand(90, 520),
        vy: rand(-520, -100),
        life: rand(0.35, 0.9),
        size: rand(4, 13),
        color: choose(['#b49672', '#897460', '#d8b88d']),
        kind: 'dust',
        gravity: 900,
        drag: 0.93,
      });
    }
    for (let i = 0; i < 12; i += 1) {
      const a = rand(0, Math.PI * 2);
      game.addParticle({
        x: this.x + Math.cos(a) * rand(20, 90),
        y: GROUND_Y - 10,
        vx: Math.cos(a) * rand(120, 500),
        vy: Math.sin(a) * rand(80, 350) - 160,
        life: rand(0.2, 0.5),
        size: rand(3, 8),
        color: '#ffab55',
        kind: 'spark',
        gravity: 500,
      });
    }
  }

  updatePhysics(game, dt) {
    if (this.isBoss && (this.phase === 'slamAir' || this.phase === 'charge')) return;
    this.vy += GRAVITY * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.x = clamp(this.x, 44, LEVEL_W - 44);
    if (this.y >= GROUND_Y) {
      this.y = GROUND_Y;
      this.vy = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }
  }

  separate(game) {
    if (this.dead || this.isBoss) return;
    for (const other of game.enemies) {
      if (other === this || other.dead) continue;
      const dx = this.x - other.x;
      if (Math.abs(dx) < (this.w + other.w) * 0.42 && Math.abs(this.y - other.y) < 80) {
        const push = (1 - Math.abs(dx) / ((this.w + other.w) * 0.42)) * 28;
        this.x += (dx >= 0 ? 1 : -1) * push * 0.02;
      }
    }
  }

  takeHit(game, damage, opts = {}) {
    if (this.dead) return;
    this.hp -= damage;
    this.hitFlash = 0.1;
    const dir = opts.sourceX != null && opts.sourceX > this.x ? -1 : 1;
    const resistance = this.isBoss ? 0.08 : this.kind === 'brute' ? 0.35 : 1;
    this.vx += dir * (opts.knock || 100) * resistance;
    if (opts.launch && !this.isBoss && this.kind !== 'brute') {
      this.vy = opts.launch;
      this.onGround = false;
    }
    if (!this.isBoss && this.kind !== 'brute') {
      this.state = 'hurt';
      this.stateTimer = 0.19;
      this.didHit = false;
    }
    if (this.hp <= 0) this.die(game);
  }

  die(game) {
    if (this.dead) return;
    this.dead = true;
    this.state = 'dead';
    this.deathTimer = 0;
    this.vx = (this.facing || 1) * rand(-80, 80);
    this.vy = -330;
    this.hp = 0;
    game.sound.play('death', this.isBoss ? 1.4 : 0.8);
    game.shake(this.isBoss ? 18 : 5);
    for (let i = 0; i < (this.isBoss ? 50 : 18); i += 1) {
      const a = rand(0, Math.PI * 2);
      const speed = rand(40, this.isBoss ? 520 : 280);
      game.addParticle({
        x: this.x + rand(-this.w / 2, this.w / 2),
        y: this.y - rand(10, this.h),
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 100,
        life: rand(0.3, 0.9),
        size: rand(3, this.isBoss ? 11 : 7),
        color: choose(this.isBoss ? ['#ffb45e', '#ff713e', '#f5df9d'] : ['#c7a779', '#8e5f48', '#e8c98b']),
        kind: 'spark',
        gravity: 520,
        drag: 0.92,
      });
    }
    if (!this.rewarded) {
      this.rewarded = true;
      game.onEnemyKilled(this);
    }
  }

  drawHealthBar(ctx) {
    if (this.isBoss || this.dead) return;
    const pct = clamp(this.hp / this.maxHp, 0, 1);
    if (pct >= 1 && this.hitFlash <= 0 && this.spawnTime <= 0) return;
    const w = Math.max(40, this.w * 0.9);
    const x = this.x - w / 2;
    const y = this.y - this.h * this.visualScale - 20;
    ctx.save();
    fillRound(ctx, x, y, w, 5, 2, 'rgba(3,5,9,0.72)');
    if (pct > 0) {
      ctx.fillStyle = pct > 0.4 ? '#cf5d46' : '#e8a24f';
      ctx.fillRect(x + 1, y + 1, (w - 2) * pct, 3);
    }
    ctx.strokeStyle = 'rgba(228,196,137,0.2)';
    ctx.strokeRect(x, y, w, 5);
    ctx.restore();
  }

  draw(ctx, game, time) {
    if (this.remove) return;
    if (this.spawnTime > 0) return;
    const fade = this.dead ? clamp(1 - (this.deathTimer - 0.65) / 0.6, 0, 1) : 1;
    if (fade <= 0) return;
    ctx.save();
    ctx.globalAlpha = fade;
    if (this.dead) {
      ctx.translate(this.x, this.y);
      ctx.rotate((this.deathTimer * 1.8) * (this.facing > 0 ? 1 : -1));
      ctx.translate(-this.x, -this.y);
    }
    // shadow
    if (!this.dead) {
      const airH = clamp((GROUND_Y - this.y) / 180, 0, 1);
      ctx.globalAlpha = fade * 0.3 * (1 - airH * 0.6);
      ctx.fillStyle = '#040509';
      ctx.beginPath();
      ctx.ellipse(this.x, GROUND_Y + 4, this.w * 0.58, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = fade;
    }

    this.drawTelegraph(ctx, game, time);

    if (!this.isBoss) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, this.x, this.y - this.h * 0.52, this.w * 0.95, '#ffb26c', 0.055);
      ctx.restore();
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.facing * this.visualScale, this.visualScale);
    if (this.kind === 'grunt') this.drawGrunt(ctx, time);
    else if (this.kind === 'archer') this.drawArcher(ctx, time);
    else if (this.kind === 'brute') this.drawBrute(ctx, time);
    else this.drawBoss(ctx, game, time);
    ctx.restore();

    if (this.hitFlash > 0 && !this.dead) {
      const a = clamp(this.hitFlash / 0.1, 0, 1);
      const h = this.h * this.visualScale;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.3 * a;
      ctx.fillStyle = '#ffe8b8';
      ctx.beginPath();
      ctx.ellipse(this.x, this.y - h * 0.45, this.w * 0.52 * this.visualScale, h * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    this.drawHealthBar(ctx);
    ctx.restore();
  }

  drawTelegraph(ctx, game, time) {
    if (this.dead) return;
    const p = game.player;
    ctx.save();
    const pulse = 0.38 + Math.sin(time * 18) * 0.14;
    if (this.kind === 'grunt' && this.state === 'windup') {
      const k = clamp(this.stateTimer / this.data.windup, 0, 1);
      ctx.save();
      ctx.translate(this.x, this.y - 42);
      ctx.scale(this.facing, 1);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,108,79,${pulse * k})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 72, -1.1, 0.7);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,205,131,${pulse * k * 0.6})`;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(0, 0, 62, -0.9, 0.5);
      ctx.stroke();
      ctx.restore();
    } else if (this.kind === 'archer' && this.state === 'windup') {
      const k = clamp(this.stateTimer / this.data.windup, 0, 1);
      const sx = this.x + this.facing * 29;
      const sy = this.y - 54;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,116,82,${0.2 + k * 0.4})`;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(p.x, p.y - 54);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = `rgba(255,214,153,${pulse})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 3 + k * 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.kind === 'brute' && this.state === 'windup') {
      const k = clamp(this.stateTimer / this.data.windup, 0, 1);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,109,66,${pulse * (0.4 + k * 0.5)})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(this.x + this.facing * 25, GROUND_Y + 3, 130 * (0.55 + k * 0.45), 26, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(191,53,32,${0.06 + k * 0.11})`;
      ctx.beginPath();
      ctx.ellipse(this.x + this.facing * 25, GROUND_Y + 3, 130 * (0.55 + k * 0.45), 26, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.isBoss) {
      if (this.phase === 'chargeWindup') {
        const k = clamp(this.stateTimer / 0.62, 0, 1);
        ctx.globalCompositeOperation = 'lighter';
        const grad = ctx.createLinearGradient(this.x, 0, this.x + this.facing * 620, 0);
        grad.addColorStop(0, `rgba(255,111,72,${0.4 * k})`);
        grad.addColorStop(1, 'rgba(255,111,72,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(this.facing > 0 ? this.x : this.x - 620, GROUND_Y - 34, 620, 34);
        ctx.strokeStyle = `rgba(255,205,126,${0.4 * k})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x, GROUND_Y - 2);
        ctx.lineTo(this.x + this.facing * 620, GROUND_Y - 2);
        ctx.stroke();
      } else if (this.phase === 'slamWindup') {
        const k = clamp(this.stateTimer / 0.6, 0, 1);
        const tx = this.targetX;
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(255,105,66,${0.28 + k * 0.5})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(tx, GROUND_Y + 3, 190 * (0.5 + k * 0.5), 35, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = `rgba(170,46,26,${0.08 + k * 0.12})`;
        ctx.beginPath();
        ctx.ellipse(tx, GROUND_Y + 3, 190 * (0.5 + k * 0.5), 35, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(255,219,145,${pulse * 0.5})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tx - 18, GROUND_Y - 30);
        ctx.lineTo(tx + 18, GROUND_Y - 30);
        ctx.moveTo(tx, GROUND_Y - 48);
        ctx.lineTo(tx, GROUND_Y - 12);
        ctx.stroke();
      } else if (this.phase === 'cleaveWindup') {
        const k = clamp(this.stateTimer / 0.55, 0, 1);
        ctx.save();
        ctx.translate(this.x, this.y - 82);
        ctx.scale(this.facing, 1);
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(255,108,67,${pulse * k})`;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 0, 155, -1.15, 0.8);
        ctx.stroke();
        ctx.restore();
      } else if (this.phase === 'summon') {
        const k = clamp(this.stateTimer / 0.82, 0, 1);
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(255,168,88,${pulse * k})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(this.x, GROUND_Y + 3, 120, 24, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(this.x, GROUND_Y + 3, 86, 17, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawGrunt(ctx, time) {
    const moving = Math.abs(this.vx) > 12;
    const run = time * 9 + this.animTime * 3;
    const bob = moving ? Math.sin(run * 2) * 2 : Math.sin(time * 2.2 + this.animTime) * 1.4;
    const wind = this.state === 'windup';
    const active = this.state === 'active';
    const k = wind ? clamp(this.stateTimer / this.data.windup, 0, 1) : 0;

    // legs
    ctx.strokeStyle = '#4c5a43';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    const swing = moving ? Math.sin(run) * 8 : 0;
    ctx.beginPath();
    ctx.moveTo(-6, -28);
    ctx.lineTo(-14 + swing, -3);
    ctx.moveTo(6, -28);
    ctx.lineTo(14 - swing, -3);
    ctx.stroke();
    ctx.fillStyle = '#2b2621';
    ctx.beginPath();
    ctx.ellipse(-14 + swing, -2, 8, 3.4, 0, 0, Math.PI * 2);
    ctx.ellipse(14 - swing, -2, 8, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // body
    ctx.save();
    ctx.translate(0, -42 + bob);
    ctx.fillStyle = '#62744c';
    ctx.beginPath();
    ctx.ellipse(0, 0, 20, 22, 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#48523c';
    ctx.beginPath();
    ctx.moveTo(-19, -5);
    ctx.lineTo(-23, 18);
    ctx.lineTo(-4, 24);
    ctx.lineTo(15, 19);
    ctx.lineTo(18, -2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#9a7b4e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-15, -6);
    ctx.lineTo(14, -6);
    ctx.stroke();
    // chest armor
    ctx.fillStyle = '#6e5b3f';
    ctx.beginPath();
    ctx.ellipse(4, 2, 11, 14, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(221,190,128,0.3)';
    ctx.beginPath();
    ctx.arc(4, 2, 11, -1.2, 1.8);
    ctx.stroke();
    // arms
    ctx.strokeStyle = '#70825a';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(12, -12);
    ctx.lineTo(22, 5);
    ctx.stroke();
    ctx.strokeStyle = '#495638';
    ctx.beginPath();
    ctx.moveTo(-13, -12);
    ctx.lineTo(-22, 3);
    ctx.stroke();
    // club
    ctx.save();
    ctx.translate(22, 2);
    ctx.rotate(active ? 0.9 : wind ? -1.5 - k * 0.5 : -0.4);
    ctx.strokeStyle = '#6b482b';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -42);
    ctx.stroke();
    ctx.fillStyle = '#7a5533';
    ctx.beginPath();
    ctx.ellipse(0, -47, 9, 13, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(230,198,139,0.28)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // head
    ctx.save();
    ctx.translate(2, -68 + bob);
    ctx.fillStyle = '#70825a';
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fill();
    // ears
    ctx.fillStyle = '#58674b';
    ctx.beginPath();
    ctx.moveTo(-14, -5);
    ctx.lineTo(-26, -16);
    ctx.lineTo(-18, 2);
    ctx.closePath();
    ctx.fill();
    // horns
    ctx.strokeStyle = '#d9c49b';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-8, -11);
    ctx.quadraticCurveTo(-10, -24, -2, -28);
    ctx.moveTo(9, -10);
    ctx.quadraticCurveTo(13, -22, 20, -23);
    ctx.stroke();
    // face
    ctx.fillStyle = '#a2b37e';
    ctx.beginPath();
    ctx.ellipse(4, 3, 11, 10, 0.1, 0, Math.PI * 2);
    ctx.fill();
    // eyes
    ctx.fillStyle = '#ffb35e';
    ctx.beginPath();
    ctx.ellipse(0, -2, 3, 2.2, -0.3, 0, Math.PI * 2);
    ctx.ellipse(8, -2, 3, 2.2, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b1b15';
    ctx.beginPath();
    ctx.arc(0.4, -2, 1.1, 0, Math.PI * 2);
    ctx.arc(8.4, -2, 1.1, 0, Math.PI * 2);
    ctx.fill();
    // mouth
    ctx.strokeStyle = '#342a21';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-1, 8);
    ctx.lineTo(10, 8);
    ctx.stroke();
    ctx.fillStyle = '#d7c49d';
    ctx.beginPath();
    ctx.moveTo(1, 8);
    ctx.lineTo(3, 12);
    ctx.lineTo(5, 8);
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  drawArcher(ctx, time) {
    const moving = Math.abs(this.vx) > 10;
    const run = time * 8 + this.animTime;
    const bob = moving ? Math.sin(run * 2) * 2 : Math.sin(time * 2 + this.animTime) * 1.2;
    const wind = this.state === 'windup';
    const k = wind ? clamp(this.stateTimer / this.data.windup, 0, 1) : 0;
    // legs
    const swing = moving ? Math.sin(run) * 7 : 0;
    ctx.strokeStyle = '#33282f';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-5, -31);
    ctx.lineTo(-13 + swing, -2);
    ctx.moveTo(6, -31);
    ctx.lineTo(13 - swing, -2);
    ctx.stroke();
    ctx.fillStyle = '#211a20';
    ctx.beginPath();
    ctx.ellipse(-13 + swing, -2, 7, 3, 0, 0, Math.PI * 2);
    ctx.ellipse(13 - swing, -2, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // cloak
    ctx.save();
    ctx.translate(0, -46 + bob);
    const cloak = ctx.createLinearGradient(-18, -24, 15, 20);
    cloak.addColorStop(0, '#4d3247');
    cloak.addColorStop(1, '#251c28');
    ctx.fillStyle = cloak;
    ctx.beginPath();
    ctx.moveTo(-12, -21);
    ctx.quadraticCurveTo(-24, -2, -18, 22 - Math.abs(this.vx) * 0.02);
    ctx.lineTo(12, 24);
    ctx.quadraticCurveTo(22, -2, 12, -21);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(211,152,91,0.35)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-11, -14);
    ctx.quadraticCurveTo(0, -4, 11, -14);
    ctx.stroke();
    // head + hood
    ctx.fillStyle = '#2d2230';
    ctx.beginPath();
    ctx.arc(2, -33, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5e3e49';
    ctx.beginPath();
    ctx.moveTo(-12, -35);
    ctx.quadraticCurveTo(1, -57, 15, -36);
    ctx.quadraticCurveTo(6, -44, -12, -35);
    ctx.fill();
    ctx.fillStyle = '#d2a475';
    ctx.beginPath();
    ctx.ellipse(7, -30, 8, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd06e';
    ctx.beginPath();
    ctx.ellipse(10, -33, 2.2, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2c1714';
    ctx.beginPath();
    ctx.arc(10.5, -33, 0.8, 0, Math.PI * 2);
    ctx.fill();
    // bow
    ctx.save();
    ctx.translate(19, -27);
    ctx.strokeStyle = '#a77945';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 22, -1.25, 1.25);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(234,215,172,0.8)';
    ctx.lineWidth = 1;
    const pull = wind ? k * 10 : 2;
    ctx.beginPath();
    ctx.moveTo(7, -21);
    ctx.lineTo(-pull, 0);
    ctx.lineTo(7, 21);
    ctx.stroke();
    if (wind) {
      ctx.strokeStyle = '#ffc66e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-pull, 0);
      ctx.lineTo(25, 0);
      ctx.stroke();
      ctx.fillStyle = '#fff0bd';
      ctx.beginPath();
      ctx.moveTo(28, 0);
      ctx.lineTo(21, -3);
      ctx.lineTo(21, 3);
      ctx.fill();
    }
    ctx.restore();
    ctx.restore();
  }

  drawBrute(ctx, time) {
    const moving = Math.abs(this.vx) > 8;
    const run = time * 5 + this.animTime;
    const bob = moving ? Math.sin(run * 2) * 2.5 : Math.sin(time * 1.7 + this.animTime) * 1.1;
    const wind = this.state === 'windup';
    const k = wind ? clamp(this.stateTimer / this.data.windup, 0, 1) : 0;
    const smash = this.state === 'active';
    // legs
    const swing = moving ? Math.sin(run) * 7 : 0;
    ctx.strokeStyle = '#4b4642';
    ctx.lineWidth = 15;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-14, -38);
    ctx.lineTo(-22 + swing, -4);
    ctx.moveTo(12, -38);
    ctx.lineTo(21 - swing, -4);
    ctx.stroke();
    ctx.fillStyle = '#2b2826';
    ctx.beginPath();
    ctx.ellipse(-22 + swing, -3, 13, 5, 0, 0, Math.PI * 2);
    ctx.ellipse(21 - swing, -3, 13, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(0, -58 + bob);
    // body rock
    const g = ctx.createLinearGradient(-30, -30, 25, 35);
    g.addColorStop(0, '#726861');
    g.addColorStop(0.55, '#514b47');
    g.addColorStop(1, '#373331');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-28, -28);
    ctx.lineTo(-8, -37);
    ctx.lineTo(16, -32);
    ctx.lineTo(31, -10);
    ctx.lineTo(27, 16);
    ctx.lineTo(9, 32);
    ctx.lineTo(-17, 27);
    ctx.lineTo(-31, 8);
    ctx.closePath();
    ctx.fill();
    // belly plate
    ctx.fillStyle = '#625a52';
    ctx.beginPath();
    ctx.ellipse(2, 8, 18, 22, 0.1, 0, Math.PI * 2);
    ctx.fill();
    // cracks
    ctx.strokeStyle = 'rgba(255,157,78,0.55)';
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(-12, -26);
    ctx.lineTo(-2, -14);
    ctx.lineTo(-7, -3);
    ctx.lineTo(2, 7);
    ctx.moveTo(13, -23);
    ctx.lineTo(8, -9);
    ctx.lineTo(16, 1);
    ctx.moveTo(-22, 10);
    ctx.lineTo(-12, 15);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,138,58,0.24)';
    ctx.beginPath();
    ctx.arc(3, -2, 7, 0, Math.PI * 2);
    ctx.fill();
    // shoulder rocks
    ctx.fillStyle = '#5d554f';
    ctx.beginPath();
    ctx.arc(-29, -22, 15, 0, Math.PI * 2);
    ctx.arc(29, -20, 16, 0, Math.PI * 2);
    ctx.fill();
    // arms
    const armY = wind ? -22 - k * 22 : smash ? 23 : 7;
    const armX = wind ? 30 + k * 9 : smash ? 38 : 33;
    ctx.strokeStyle = '#5c544d';
    ctx.lineWidth = 17;
    ctx.beginPath();
    ctx.moveTo(24, -19);
    ctx.quadraticCurveTo(armX + 8, armY - 10, armX, armY);
    ctx.moveTo(-24, -19);
    ctx.quadraticCurveTo(-armX - 8, armY - 10, -armX, armY);
    ctx.stroke();
    ctx.fillStyle = '#71665c';
    ctx.beginPath();
    ctx.arc(armX, armY, 13, 0, Math.PI * 2);
    ctx.arc(-armX, armY, 13, 0, Math.PI * 2);
    ctx.fill();
    // head
    ctx.save();
    ctx.translate(2, -52);
    ctx.fillStyle = '#6c6158';
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#817361';
    ctx.beginPath();
    ctx.ellipse(7, 5, 11, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    // horns
    ctx.strokeStyle = '#d6c19b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-9, -13);
    ctx.quadraticCurveTo(-16, -27, -6, -31);
    ctx.moveTo(10, -12);
    ctx.quadraticCurveTo(20, -24, 14, -30);
    ctx.stroke();
    // eyes
    ctx.fillStyle = '#ff9c52';
    ctx.beginPath();
    ctx.ellipse(2, -3, 3.3, 2.1, 0, 0, Math.PI * 2);
    ctx.ellipse(12, -3, 3.3, 2.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2c1c14';
    ctx.beginPath();
    ctx.arc(2.5, -3, 1.1, 0, Math.PI * 2);
    ctx.arc(12.5, -3, 1.1, 0, Math.PI * 2);
    ctx.fill();
    // mouth
    ctx.strokeStyle = '#2f2822';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, 11);
    ctx.lineTo(14, 10);
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  }

  drawBoss(ctx, game, time) {
    const bob = Math.sin(time * 1.7) * 2;
    const phase = this.phase;
    const wind = ['chargeWindup', 'slamWindup', 'cleaveWindup', 'summon'].includes(phase);
    const k = wind ? clamp(this.stateTimer / 0.7, 0, 1) : 0;
    const moving = Math.abs(this.vx) > 20;
    const run = time * 5.2 + this.animTime;
    const stride = moving ? Math.sin(run) * 8 : 0;
    // aura
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, 0, -78, 110 + Math.sin(time * 2.6) * 12, '#b3372d', 0.2);
    ctx.restore();
    // shadow handled outside

    // cape
    ctx.save();
    ctx.translate(-18, -105 + bob);
    const cape = ctx.createLinearGradient(-20, -20, 40, 55);
    cape.addColorStop(0, '#431f28');
    cape.addColorStop(1, '#1a1119');
    ctx.fillStyle = cape;
    ctx.beginPath();
    ctx.moveTo(-20, -20);
    ctx.quadraticCurveTo(-62, 18, -50, 82);
    ctx.quadraticCurveTo(-20, 65, -12, 78);
    ctx.quadraticCurveTo(-2, 35, 20, 8);
    ctx.lineTo(22, -22);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(216,171,92,0.24)';
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.restore();

    // legs
    ctx.strokeStyle = '#322326';
    ctx.lineWidth = 21;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-17, -55);
    ctx.lineTo(-28 + stride, -5);
    ctx.moveTo(17, -55);
    ctx.lineTo(28 - stride, -5);
    ctx.stroke();
    ctx.fillStyle = '#1c1416';
    ctx.beginPath();
    ctx.ellipse(-28 + stride, -4, 19, 7, 0, 0, Math.PI * 2);
    ctx.ellipse(28 - stride, -4, 19, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    // leg armor plates
    ctx.fillStyle = '#7d2f2d';
    ctx.beginPath();
    ctx.ellipse(-20, -33, 13, 26, 0.15, 0, Math.PI * 2);
    ctx.ellipse(20, -33, 13, 26, -0.15, 0, Math.PI * 2);
    ctx.fill();

    // torso
    const body = ctx.createLinearGradient(-38, -130, 35, -10);
    body.addColorStop(0, '#57312f');
    body.addColorStop(0.45, '#3c2426');
    body.addColorStop(1, '#21161a');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-34, -108);
    ctx.quadraticCurveTo(-48, -64, -30, -27);
    ctx.quadraticCurveTo(0, -8, 30, -27);
    ctx.quadraticCurveTo(48, -64, 34, -108);
    ctx.quadraticCurveTo(0, -132, -34, -108);
    ctx.closePath();
    ctx.fill();

    // chest plate
    ctx.fillStyle = '#7d302d';
    ctx.beginPath();
    ctx.moveTo(-31, -103);
    ctx.lineTo(31, -103);
    ctx.lineTo(25, -59);
    ctx.quadraticCurveTo(0, -43, -25, -59);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#d3a44f';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-29, -98);
    ctx.quadraticCurveTo(0, -88, 29, -98);
    ctx.moveTo(-24, -64);
    ctx.quadraticCurveTo(0, -53, 24, -64);
    ctx.moveTo(0, -101);
    ctx.lineTo(0, -53);
    ctx.stroke();
    // chest gem
    drawDiamond(ctx, 0, -78, 8, '#ffb24f');
    glow(ctx, 0, -78, 26, '#ff8c42', 0.5);

    // shoulder pauldrons
    for (const sx of [-35, 35]) {
      ctx.fillStyle = '#4a292a';
      ctx.beginPath();
      ctx.ellipse(sx, -104, 20, 17, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#c4954b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, -104, 14, -0.8, 2.2);
      ctx.stroke();
    }

    // arms + axe
    const armLift = wind ? -64 - k * 16 : -46;
    ctx.strokeStyle = '#4a2c2a';
    ctx.lineWidth = 17;
    ctx.beginPath();
    ctx.moveTo(-31, -97);
    ctx.quadraticCurveTo(-62, armLift - 14, -58, armLift + 10);
    ctx.moveTo(32, -97);
    ctx.quadraticCurveTo(62, armLift - 14, 61, armLift + 12);
    ctx.stroke();
    ctx.fillStyle = '#782f2c';
    ctx.beginPath();
    ctx.arc(-58, armLift + 13, 11, 0, Math.PI * 2);
    ctx.arc(61, armLift + 15, 11, 0, Math.PI * 2);
    ctx.fill();

    // axe in right hand
    ctx.save();
    ctx.translate(64, armLift + 22);
    const axeAngle = phase === 'chargeWindup' ? -1.5 : phase === 'slamWindup' ? -2.1 : phase === 'cleave' ? 1.2 : -0.6;
    ctx.rotate(axeAngle);
    ctx.strokeStyle = '#5f402b';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 40);
    ctx.lineTo(0, -76);
    ctx.stroke();
    // massive double-bladed battle axe
    const blade = ctx.createLinearGradient(-54, -86, 54, -52);
    blade.addColorStop(0, '#4a4547');
    blade.addColorStop(0.35, '#9b8e85');
    blade.addColorStop(0.7, '#6b6060');
    blade.addColorStop(1, '#403b3e');
    ctx.fillStyle = blade;
    ctx.beginPath();
    ctx.moveTo(-5, -69);
    ctx.quadraticCurveTo(-32, -90, -53, -73);
    ctx.quadraticCurveTo(-57, -57, -44, -49);
    ctx.quadraticCurveTo(-34, -57, -8, -58);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(5, -69);
    ctx.quadraticCurveTo(32, -90, 53, -73);
    ctx.quadraticCurveTo(57, -57, 44, -49);
    ctx.quadraticCurveTo(34, -57, 8, -58);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#d9b165';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-5, -69);
    ctx.quadraticCurveTo(-32, -90, -53, -73);
    ctx.quadraticCurveTo(-57, -57, -44, -49);
    ctx.moveTo(5, -69);
    ctx.quadraticCurveTo(32, -90, 53, -73);
    ctx.quadraticCurveTo(57, -57, 44, -49);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,247,212,0.72)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-46, -55);
    ctx.quadraticCurveTo(-54, -69, -44, -76);
    ctx.moveTo(46, -55);
    ctx.quadraticCurveTo(54, -69, 44, -76);
    ctx.stroke();
    ctx.fillStyle = '#d0a65b';
    ctx.fillRect(-7, -73, 14, 10);
    // red tassel
    ctx.strokeStyle = '#b33c2d';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-2, -64);
    ctx.quadraticCurveTo(-14, -56, -16, -42);
    ctx.stroke();
    ctx.restore();

    // head
    ctx.save();
    ctx.translate(2, -139 + bob);
    ctx.fillStyle = '#55302c';
    ctx.beginPath();
    ctx.arc(0, 0, 25, 0, Math.PI * 2);
    ctx.fill();
    // ears
    ctx.fillStyle = '#6b3a33';
    ctx.beginPath();
    ctx.moveTo(-23, -4);
    ctx.lineTo(-40, -15);
    ctx.lineTo(-27, 7);
    ctx.fill();
    // horns
    ctx.strokeStyle = '#d8c4a0';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-13, -20);
    ctx.quadraticCurveTo(-31, -44, -9, -51);
    ctx.moveTo(14, -20);
    ctx.quadraticCurveTo(34, -45, 11, -52);
    ctx.stroke();
    // helmet
    ctx.fillStyle = '#412326';
    ctx.beginPath();
    ctx.arc(0, -5, 26, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c8994d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -5, 25, Math.PI, Math.PI * 2);
    ctx.stroke();
    drawDiamond(ctx, 0, -27, 4.5, '#e4b55a');
    // face
    ctx.fillStyle = '#80423a';
    ctx.beginPath();
    ctx.ellipse(4, 8, 18, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5e2f2a';
    ctx.beginPath();
    ctx.ellipse(2, 17, 10, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    // eyes
    ctx.fillStyle = '#ffb54e';
    ctx.beginPath();
    ctx.ellipse(-6, 2, 6, 3.2, 0.1, 0, Math.PI * 2);
    ctx.ellipse(11, 2, 6, 3.2, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#301c14';
    ctx.beginPath();
    ctx.ellipse(-5, 2, 2.5, 2.7, 0, 0, Math.PI * 2);
    ctx.ellipse(12, 2, 2.5, 2.7, 0, 0, Math.PI * 2);
    ctx.fill();
    // tusks
    ctx.fillStyle = '#ead6ae';
    ctx.beginPath();
    ctx.moveTo(-4, 18);
    ctx.lineTo(-8, 27);
    ctx.lineTo(-1, 21);
    ctx.moveTo(14, 18);
    ctx.lineTo(20, 26);
    ctx.lineTo(11, 21);
    ctx.fill();
    // mouth
    ctx.strokeStyle = '#301b18';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(2, 19);
    ctx.lineTo(17, 18);
    ctx.stroke();
    ctx.restore();

    if (phase === 'intro') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,169,92,${0.2 + Math.sin(time * 8) * 0.1})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, -76, 90, 120, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}
