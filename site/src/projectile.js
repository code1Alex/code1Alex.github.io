import {
  GROUND_Y,
  LEVEL_W,
  FONT_UI,
  clamp,
  rand,
  choose,
  chance,
  RARITIES,
} from './core.js';
import { glow, hexToRgba, drawCoin, drawDiamond } from './gfx.js';

export class Projectile {
  constructor(config) {
    Object.assign(
      this,
      {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        radius: 12,
        life: 1,
        maxLife: 1,
        owner: 'player',
        type: 'flame',
        damage: 20,
        mult: 2.2,
        pierce: 1,
        gravity: 0,
        hit: new Set(),
        remove: false,
        rotation: 0,
        color: '#ffae52',
        critBonus: 0,
        hitCount: 0,
      },
      config
    );
  }

  update(game, dt) {
    this.life -= dt;
    if (this.life <= 0) {
      this.remove = true;
      if (this.type === 'flame') this.explode(game);
      return;
    }
    this.vy += this.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rotation += dt * 12;
    if (this.type === 'flame' && chance(0.8)) {
      game.addParticle({
        x: this.x + rand(-8, 8),
        y: this.y + rand(-7, 7),
        vx: rand(-50, 50) - this.vx * 0.06,
        vy: rand(-60, 20),
        life: rand(0.2, 0.4),
        size: rand(4, 9),
        color: choose(['#ff8a3d', '#ffc35f', '#ff5e35']),
        kind: 'ember',
        drag: 0.94,
      });
    }
    if (this.type === 'arrow' && this.y >= GROUND_Y - 3) {
      this.remove = true;
      game.addParticle({
        x: this.x,
        y: GROUND_Y - 4,
        vx: 0,
        vy: -50,
        life: 0.3,
        size: 8,
        color: '#a08b72',
        kind: 'dust',
      });
    }

    if (this.owner === 'player') {
      for (const enemy of game.enemies) {
        if (enemy.dead || this.hit.has(enemy.id)) continue;
        const box = { x: enemy.x - enemy.w / 2, y: enemy.y - enemy.h, w: enemy.w, h: enemy.h };
        if (
          this.x + this.radius > box.x &&
          this.x - this.radius < box.x + box.w &&
          this.y + this.radius > box.y &&
          this.y - this.radius < box.y + box.h
        ) {
          this.hit.add(enemy.id);
          this.hitCount += 1;
          game.hitEnemy(enemy, this.mult, {
            sourceX: this.x,
            knock: 180,
            launch: -80,
            hitstop: 0.045,
            shake: 4,
            color: '#ffc562',
            critBonus: this.critBonus,
          });
          if (this.hitCount >= this.pierce) {
            this.explode(game);
            this.remove = true;
            break;
          }
        }
      }
    } else {
      const p = game.player;
      if (!p.dead) {
        const box = { x: p.x - p.w / 2, y: p.y - p.h, w: p.w, h: p.h };
        if (
          this.x + this.radius > box.x &&
          this.x - this.radius < box.x + box.w &&
          this.y + this.radius > box.y &&
          this.y - this.radius < box.y + box.h
        ) {
          game.hurtPlayer(this.damage, this.x, { knock: 180, launch: -80 });
          this.remove = true;
          game.addParticle({ x: this.x, y: this.y, vx: 0, vy: 0, life: 0.2, size: 16, color: '#ff9b64', kind: 'ring', line: 2 });
        }
      }
    }
  }

  explode(game) {
    if (this.type !== 'flame') return;
    game.sound.play('explode', 0.75);
    game.shake(7);
    game.addParticle({
      x: this.x,
      y: this.y,
      vx: 0,
      vy: 0,
      life: 0.35,
      size: 10,
      color: '#ffae52',
      kind: 'ring',
      line: 5,
    });
    for (let i = 0; i < 18; i += 1) {
      const a = rand(0, Math.PI * 2);
      const speed = rand(50, 330);
      game.addParticle({
        x: this.x,
        y: this.y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 50,
        life: rand(0.2, 0.55),
        size: rand(2, 7),
        color: choose(['#ff7b34', '#ffb347', '#ffe09a']),
        kind: 'spark',
        gravity: 260,
        drag: 0.92,
      });
    }
    game.addParticle({
      x: this.x,
      y: this.y,
      vx: 0,
      vy: -30,
      life: 0.5,
      size: 26,
      color: '#d98047',
      kind: 'smoke',
      drag: 0.94,
    });
    for (const enemy of game.enemies) {
      if (enemy.dead) continue;
      const dx = enemy.x - this.x;
      const dy = enemy.y - enemy.h / 2 - this.y;
      if (dx * dx + dy * dy < 95 * 95) {
        game.hitEnemy(enemy, this.mult * 0.45, {
          sourceX: this.x,
          knock: 140,
          launch: -90,
          hitstop: 0.02,
          shake: 1,
          color: '#ffc562',
          canCrit: false,
          quake: false,
        });
      }
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.type === 'flame') {
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, 0, 0, 54, '#ff813c', 0.4);
      ctx.rotate(this.rotation);
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, this.radius);
      g.addColorStop(0, '#fff9dc');
      g.addColorStop(0.3, '#ffd36d');
      g.addColorStop(0.72, '#ff7c33');
      g.addColorStop(1, 'rgba(190,46,20,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      for (let i = 0; i < 9; i += 1) {
        const a = (i / 9) * Math.PI * 2;
        const r = i % 2 === 0 ? this.radius * 1.3 : this.radius * 0.7;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    } else if (this.type === 'arrow') {
      const angle = Math.atan2(this.vy, this.vx);
      ctx.rotate(angle);
      ctx.strokeStyle = '#3b2b23';
      ctx.lineWidth = 2.3;
      ctx.beginPath();
      ctx.moveTo(-20, 0);
      ctx.lineTo(12, 0);
      ctx.stroke();
      ctx.fillStyle = '#d7c7a3';
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(8, -4);
      ctx.lineTo(8, 4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#b05b44';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-18, 0);
      ctx.lineTo(-25, -4);
      ctx.moveTo(-18, 0);
      ctx.lineTo(-25, 4);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawItemGlyph(ctx, slot, x, y, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  if (slot === 'weapon') {
    ctx.beginPath();
    ctx.moveTo(-9, 9);
    ctx.lineTo(8, -10);
    ctx.moveTo(5, -12);
    ctx.lineTo(11, -6);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-9, 9);
    ctx.lineTo(8, -10);
    ctx.stroke();
  } else if (slot === 'armor') {
    ctx.beginPath();
    ctx.moveTo(-10, -7);
    ctx.lineTo(-4, -11);
    ctx.lineTo(0, -7);
    ctx.lineTo(4, -11);
    ctx.lineTo(10, -7);
    ctx.lineTo(7, 9);
    ctx.lineTo(-7, 9);
    ctx.closePath();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(0, -8);
    ctx.moveTo(0, 8);
    ctx.lineTo(0, 14);
    ctx.stroke();
    drawDiamond(ctx, 0, 0, 3.2, color);
  }
  ctx.restore();
}

export class Pickup {
  constructor(type, x, y, data = {}) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.vx = data.vx ?? rand(-130, 130);
    this.vy = data.vy ?? rand(-430, -230);
    this.value = data.value ?? 1;
    this.item = data.item ?? null;
    this.grounded = false;
    this.life = data.life ?? (type === 'equipment' ? 45 : 28);
    this.maxLife = this.life;
    this.remove = false;
    this.bob = rand(0, Math.PI * 2);
    this.radius = type === 'equipment' ? 22 : 15;
    this.attract = false;
  }

  update(game, dt) {
    this.life -= dt;
    if (this.life <= 0) {
      this.remove = true;
      return;
    }
    this.bob += dt * 2.4;
    const p = game.player;
    const dx = p.x - this.x;
    const dy = p.y - 50 - this.y;
    const dist = Math.hypot(dx, dy);
    if (!p.dead && (this.type !== 'equipment' || dist < 95) && dist < 190) this.attract = true;
    if (this.attract && !p.dead) {
      const speed = 680;
      this.vx = (dx / Math.max(1, dist)) * speed;
      this.vy = (dy / Math.max(1, dist)) * speed;
      this.grounded = false;
    } else {
      this.vy += 1650 * dt;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.y >= GROUND_Y - (this.type === 'equipment' ? 18 : 8)) {
      this.y = GROUND_Y - (this.type === 'equipment' ? 18 : 8);
      if (!this.grounded && Math.abs(this.vy) > 100) {
        game.addParticle({
          x: this.x,
          y: GROUND_Y - 2,
          vx: rand(-30, 30),
          vy: rand(-60, -20),
          life: 0.28,
          size: 6,
          color: '#aa8e70',
          kind: 'dust',
        });
      }
      this.vy = 0;
      this.vx *= 0.82;
      this.grounded = true;
    }
    if (this.y < 30) {
      this.y = 30;
      this.vy = Math.abs(this.vy) * 0.3;
    }
    this.x = clamp(this.x, 30, LEVEL_W - 30);

    if (dist < (this.type === 'equipment' ? 40 : 32) && !p.dead) {
      this.remove = true;
      if (this.type === 'coin') game.collectCoin(this.value, this.x, this.y);
      else if (this.type === 'heal') game.collectHeal(this.value, this.x, this.y);
      else if (this.type === 'equipment') game.collectEquipment(this.item, this.x, this.y);
    }
  }

  draw(ctx, time) {
    const blink = this.life < 6 && Math.sin(this.life * 18) > 0;
    if (blink) return;
    const bobY = this.grounded ? Math.sin(this.bob) * 3 : 0;
    ctx.save();
    ctx.translate(this.x, this.y + bobY);
    if (this.type === 'coin') {
      glow(ctx, 0, 0, 32, '#ffc95c', 0.3);
      drawCoin(ctx, 0, 0, 9, time + this.bob);
    } else if (this.type === 'heal') {
      glow(ctx, 0, 0, 36, '#74df9b', 0.35);
      ctx.fillStyle = '#cf5c46';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f0d6a2';
      ctx.beginPath();
      ctx.ellipse(0, -9, 5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f4ddaa';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(0, 8);
      ctx.stroke();
      ctx.fillStyle = '#67c987';
      ctx.font = `700 10px ${FONT_UI}`;
      ctx.textAlign = 'center';
      ctx.fillText('+', 0, 4);
    } else if (this.type === 'equipment') {
      const color = RARITIES[this.item.rank].color;
      glow(ctx, 0, -8, 58, color, 0.45 + Math.sin(time * 3 + this.bob) * 0.12);
      ctx.translate(0, -8 + Math.sin(this.bob * 1.3) * 2);
      ctx.rotate(time * 0.9 + this.bob);
      ctx.strokeStyle = hexToRgba(color, 0.85);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        const x = Math.cos(a) * 24;
        const y = Math.sin(a) * 24;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.rotate(-(time * 0.9 + this.bob));
      drawItemGlyph(ctx, this.item.slot, 0, 0, color);
    }
    ctx.restore();
  }
}
