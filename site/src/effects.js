import { FONT_UI, FONT_TITLE, clamp, rand } from './core.js';
import { glow, hexToRgba } from './gfx.js';

export class Particle {
  constructor(opts) {
    Object.assign(
      this,
      {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        gravity: 0,
        drag: 0.98,
        life: 0.5,
        maxLife: 0.5,
        size: 4,
        color: '#ffcf78',
        kind: 'spark',
        rotation: 0,
        spin: 0,
        alpha: 1,
        text: '',
        textSize: 18,
        line: 0,
      },
      opts
    );
    this.maxLife = this.life;
  }

  update(dt) {
    this.life -= dt;
    if (this.life <= 0) return false;
    this.vy += this.gravity * dt;
    this.vx *= Math.pow(this.drag, dt * 60);
    this.vy *= Math.pow(this.drag, dt * 60);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rotation += this.spin * dt;
    return true;
  }

  draw(ctx) {
    const t = clamp(this.life / this.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = this.alpha * (this.kind === 'smoke' ? t * 0.62 : Math.min(1, t * 1.6));
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    switch (this.kind) {
      case 'spark': {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = this.color;
        ctx.lineCap = 'round';
        ctx.lineWidth = this.size * 0.55;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-this.vx * 0.022, -this.vy * 0.022);
        ctx.stroke();
        ctx.fillStyle = '#fff3cf';
        ctx.beginPath();
        ctx.arc(0, 0, this.size * 0.38, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'ember':
      case 'mote': {
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, 0, 0, this.size * 3.2, this.color, 0.65 * t);
        break;
      }
      case 'dust': {
        const r = this.size * (1.8 - t * 0.5);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0, hexToRgba(this.color, 0.5));
        g.addColorStop(1, hexToRgba(this.color, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'smoke': {
        const r = this.size * (2.4 - t * 1.1);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0, hexToRgba(this.color, 0.23));
        g.addColorStop(1, hexToRgba(this.color, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'ring': {
        const p = 1 - t;
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = hexToRgba(this.color, t * 0.9);
        ctx.lineWidth = this.line * (1 - p) + 1;
        ctx.beginPath();
        ctx.arc(0, 0, this.size + p * 100, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'shockwave': {
        const p = 1 - t;
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = hexToRgba(this.color, t * 0.95);
        ctx.lineWidth = 7 * t + 1;
        ctx.beginPath();
        ctx.ellipse(0, 0, this.size + p * 170, (this.size + p * 170) * 0.22, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'petal': {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, this.size, this.size * 0.4, this.rotation, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'star': {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-this.size, 0);
        ctx.lineTo(this.size, 0);
        ctx.moveTo(0, -this.size);
        ctx.lineTo(0, this.size);
        ctx.stroke();
        glow(ctx, 0, 0, this.size * 2, this.color, 0.4);
        break;
      }
      case 'glyph': {
        ctx.font = `700 ${this.textSize}px ${FONT_TITLE}`;
        ctx.fillStyle = this.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 18;
        ctx.fillText(this.text, 0, 0);
        break;
      }
      case 'slash': {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = this.color;
        ctx.lineCap = 'round';
        ctx.lineWidth = this.size;
        ctx.beginPath();
        ctx.arc(0, 0, this.line, -1.2, 1.1);
        ctx.stroke();
        break;
      }
      default:
        break;
    }
    ctx.restore();
  }
}

export class DamageText {
  constructor(x, y, text, opts = {}) {
    this.x = x;
    this.y = y;
    this.text = String(text);
    this.color = opts.color || '#ffe4a8';
    this.size = opts.size || 22;
    this.crit = opts.crit || false;
    this.life = opts.life || 0.8;
    this.maxLife = this.life;
    this.vx = opts.vx ?? rand(-18, 18);
    this.vy = opts.vy ?? rand(-120, -82);
    this.gravity = 115;
  }

  update(dt) {
    this.life -= dt;
    if (this.life <= 0) return false;
    this.vy += this.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    return true;
  }

  draw(ctx) {
    const t = clamp(this.life / this.maxLife, 0, 1);
    const pop = this.life > this.maxLife - 0.09 ? 1 + (this.life - (this.maxLife - 0.09)) * 4.4 : 1;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(pop, pop);
    ctx.globalAlpha = Math.min(1, t * 2);
    ctx.font = `800 ${this.size}px ${FONT_UI}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(7,8,12,0.8)';
    ctx.strokeText(this.text, 0, 0);
    ctx.fillStyle = this.color;
    ctx.fillText(this.text, 0, 0);
    if (this.crit) {
      ctx.font = `700 11px ${FONT_UI}`;
      ctx.strokeStyle = 'rgba(7,8,12,0.8)';
      ctx.lineWidth = 3;
      ctx.strokeText('会心', 0, -this.size * 0.8);
      ctx.fillStyle = '#ffcf6d';
      ctx.fillText('会心', 0, -this.size * 0.8);
    }
    ctx.restore();
  }
}
