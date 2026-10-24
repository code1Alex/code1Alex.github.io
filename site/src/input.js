import { VIEW_W, VIEW_H, clamp } from './core.js';

const BLOCK_KEYS = new Set([
  'Space',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'KeyJ',
  'KeyK',
  'KeyL',
  'KeyU',
  'KeyR',
  'KeyM',
  'KeyP',
  'ShiftLeft',
  'ShiftRight',
  'Escape',
]);

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.virtual = new Set();
    this.pressed = new Set();
    this.pointer = { x: VIEW_W / 2, y: VIEW_H / 2, inside: false, down: false };
    this.clicked = false;

    window.addEventListener('keydown', (e) => {
      if (BLOCK_KEYS.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.down.add(e.code);
      this.pressed.add(e.code);
      this.anyKey = true;
    });

    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
    });

    window.addEventListener('blur', () => {
      this.down.clear();
      this.virtual.clear();
    });

    canvas.addEventListener('pointermove', (e) => {
      this.updatePointer(e);
      this.pointer.inside = true;
    });

    canvas.addEventListener('pointerleave', () => {
      this.pointer.inside = false;
    });

    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.updatePointer(e);
      this.pointer.down = true;
      this.pointer.inside = true;
      this.clicked = true;
      this.anyKey = true;
      canvas.focus?.();
    });

    window.addEventListener('pointerup', () => {
      this.pointer.down = false;
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  updatePointer(e) {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.pointer.x = clamp(((e.clientX - rect.left) / rect.width) * VIEW_W, 0, VIEW_W);
    this.pointer.y = clamp(((e.clientY - rect.top) / rect.height) * VIEW_H, 0, VIEW_H);
  }

  isDown(...codes) {
    return codes.some((code) => this.down.has(code) || this.virtual.has(code));
  }

  wasPressed(...codes) {
    return codes.some((code) => this.pressed.has(code));
  }

  virtualDown(code) {
    if (!this.virtual.has(code)) this.pressed.add(code);
    this.virtual.add(code);
  }

  virtualUp(code) {
    this.virtual.delete(code);
  }

  clearVirtual() {
    this.virtual.clear();
  }

  clearFrame() {
    this.pressed.clear();
    this.clicked = false;
    this.anyKey = false;
  }
}
