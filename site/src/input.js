import { VIEW_W, VIEW_H, clamp } from './core.js';

export const DEFAULT_BINDINGS = {
  left: 'KeyA',
  right: 'KeyD',
  jump: 'Space',
  attack: 'KeyJ',
  heavy: 'KeyK',
  flame: 'KeyL',
  ult: 'KeyU',
  dash: 'ShiftLeft',
  pause: 'Escape',
};

export const ACTION_LABELS = {
  left: '向左移动',
  right: '向右移动',
  jump: '跳跃 / 二段跳',
  attack: '普攻',
  heavy: '破军',
  flame: '烈焰',
  ult: '神威',
  dash: '闪避',
  pause: '暂停',
};

const CODE_TO_ACTION = {
  KeyA: 'left',
  KeyD: 'right',
  Space: 'jump',
  KeyJ: 'attack',
  KeyK: 'heavy',
  KeyL: 'flame',
  KeyU: 'ult',
  ShiftLeft: 'dash',
  ShiftRight: 'dash',
  KeyC: 'dash',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Escape: 'pause',
  KeyP: 'pause',
};

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
  'Tab',
]);

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.virtual = new Set();
    this.pressed = new Set();
    this.actionsDown = new Set();
    this.actionsPressed = new Set();
    this.bindings = { ...DEFAULT_BINDINGS };
    this.codeToAction = { ...CODE_TO_ACTION };
    this.pointer = { x: VIEW_W / 2, y: VIEW_H / 2, inside: false, down: false };
    this.clicked = false;
    this.setBindings(this.bindings);

    window.addEventListener('keydown', (e) => {
      if (e.target?.closest?.('input, textarea, select')) return;
      if (BLOCK_KEYS.has(e.code) || this.codeToAction[e.code]) e.preventDefault();
      if (e.repeat) return;
      const action = this.codeToAction[e.code];
      if (action) {
        this.actionsDown.add(action);
        this.actionsPressed.add(action);
      }
      this.down.add(e.code);
      this.pressed.add(e.code);
      this.anyKey = true;
    });

    window.addEventListener('keyup', (e) => {
      if (e.target?.closest?.('input, textarea, select')) return;
      this.down.delete(e.code);
      const action = this.codeToAction[e.code];
      if (action && !this.isActionDownByOtherKey(action, e.code)) this.actionsDown.delete(action);
    });

    window.addEventListener('blur', () => {
      this.down.clear();
      this.virtual.clear();
      this.actionsDown.clear();
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

  setBindings(bindings) {
    this.bindings = { ...DEFAULT_BINDINGS, ...bindings };
    this.codeToAction = {};
    for (const [action, code] of Object.entries(this.bindings)) {
      if (code) this.codeToAction[code] = action;
    }
    // Keep keyboard alternates available for accessibility.
    this.codeToAction.ArrowLeft = 'left';
    this.codeToAction.ArrowRight = 'right';
    this.codeToAction.ShiftRight = 'dash';
    this.codeToAction.KeyC = 'dash';
    this.down.clear();
    this.actionsDown.clear();
  }

  isActionDownByOtherKey(action, exceptCode) {
    for (const [code, mappedAction] of Object.entries(this.codeToAction)) {
      if (mappedAction === action && code !== exceptCode && this.down.has(code)) return true;
    }
    return false;
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

  isActionDown(action) {
    return this.actionsDown.has(action) || this.virtual.has(`action:${action}`);
  }

  wasActionPressed(action) {
    return this.actionsPressed.has(action);
  }

  virtualDown(code) {
    if (!this.virtual.has(code)) this.pressed.add(code);
    this.virtual.add(code);
    const action = CODE_TO_ACTION[code];
    if (action) {
      this.virtual.add(`action:${action}`);
      this.actionsPressed.add(action);
    }
  }

  virtualUp(code) {
    this.virtual.delete(code);
    const action = CODE_TO_ACTION[code];
    if (action) this.virtual.delete(`action:${action}`);
  }

  clearVirtual() {
    for (const value of [...this.virtual]) {
      if (!value.startsWith('action:')) this.virtualUp(value);
    }
    this.virtual.clear();
    this.actionsDown.clear();
  }

  clearFrame() {
    this.pressed.clear();
    this.actionsPressed.clear();
    this.clicked = false;
    this.anyKey = false;
  }
}
