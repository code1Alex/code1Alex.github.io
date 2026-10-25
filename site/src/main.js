import { VIEW_W, VIEW_H, clamp } from './core.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { Game } from './game.js';
import { App } from './app.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const input = new Input(canvas);
const sound = new Sound();
const game = new Game(canvas, input, sound);
const app = new App(game, input, sound);
window.__QITIAN__ = { game, sound, input, app };

const touchQuery = window.matchMedia('(pointer: coarse)');
const touchButtons = [...document.querySelectorAll('.touch-btn')];
const activePointers = new Map();
const codePointerCounts = new Map();

function applyResolution() {
  // A 2x canvas on a large desktop monitor makes every hit effect much more
  // expensive to rasterize. Touch screens keep native density because the
  // viewport is physically smaller.
  const maxDpr = touchQuery.matches ? 2 : 1.5;
  const dpr = clamp(window.devicePixelRatio || 1, 1, maxDpr);
  const pixelWidth = Math.round(VIEW_W * dpr);
  const pixelHeight = Math.round(VIEW_H * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  game.dpr = dpr;
  game.ctx.imageSmoothingEnabled = true;
}

function updateTouchMode() {
  game.touchMode = touchQuery.matches;
  document.body.classList.toggle('touch-device', game.touchMode);
}

function releaseTouchPointer(pointerId) {
  const entry = activePointers.get(pointerId);
  if (!entry) return;
  activePointers.delete(pointerId);
  const next = Math.max(0, (codePointerCounts.get(entry.code) || 1) - 1);
  if (next === 0) {
    codePointerCounts.delete(entry.code);
    input.virtualUp(entry.code);
    entry.buttons.forEach((btn) => btn.classList.remove('pressed'));
  } else {
    codePointerCounts.set(entry.code, next);
  }
}

function releaseAllTouches() {
  for (const pointerId of [...activePointers.keys()]) releaseTouchPointer(pointerId);
  input.clearVirtual();
  for (const btn of touchButtons) btn.classList.remove('pressed');
}

for (const button of touchButtons) {
  const code = button.dataset.key;
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      button.setPointerCapture(event.pointerId);
    } catch {
      /* older browsers */
    }
    const existing = activePointers.get(event.pointerId);
    if (existing) return;
    activePointers.set(event.pointerId, {
      code,
      buttons: touchButtons.filter((b) => b.dataset.key === code),
    });
    const count = codePointerCounts.get(code) || 0;
    codePointerCounts.set(code, count + 1);
    if (count === 0) input.virtualDown(code);
    for (const b of touchButtons) {
      if (b.dataset.key === code) b.classList.add('pressed');
    }
    canvas.focus?.();
  });
  const release = (event) => {
    event.preventDefault?.();
    releaseTouchPointer(event.pointerId);
  };
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
  button.addEventListener('contextmenu', (event) => event.preventDefault());
}

for (const eventName of ['gesturestart', 'gesturechange']) {
  document.addEventListener(eventName, (event) => event.preventDefault(), { passive: false });
}

updateTouchMode();
applyResolution();
window.addEventListener('resize', () => {
  updateTouchMode();
  applyResolution();
});
if (touchQuery.addEventListener) touchQuery.addEventListener('change', updateTouchMode);

function syncTouchButtons() {
  if (!game.touchMode || app.screen !== 'battle' || game.phase !== 'playing' || app.backpackOpen || game.uiPaused) return;
  const p = game.player;
  const states = {
    KeyK: { locked: p.heavyCd > 0 || p.energy < 15, ready: false },
    KeyL: { locked: p.castCd > 0 || p.energy < 20, ready: false },
    KeyU: { locked: p.energy < 100, ready: p.energy >= 100 },
    ShiftLeft: { locked: p.dashCd > 0, ready: false },
  };
  for (const button of touchButtons) {
    const state = states[button.dataset.key];
    if (!state) continue;
    button.classList.toggle('locked', state.locked);
    button.classList.toggle('ready', state.ready);
  }
}

let last = performance.now();
let totalFrames = 0;
let fpsTime = 0;
let touchActive = false;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  totalFrames += 1;
  fpsTime += dt;
  if (fpsTime > 0.5) {
    game.fps = Math.round(totalFrames / fpsTime);
    totalFrames = 0;
    fpsTime = 0;
  }
  sound.updateMusic();
  if (app.screen === 'battle') {
    game.update(dt);
    game.draw();
  }
  const shouldShowTouch = game.touchMode && app.screen === 'battle' && game.phase === 'playing' && !app.backpackOpen && !game.uiPaused;
  if (shouldShowTouch !== touchActive) {
    touchActive = shouldShowTouch;
    document.body.classList.toggle('touch-active', shouldShowTouch);
    if (!shouldShowTouch) releaseAllTouches();
  }
  syncTouchButtons();
  input.clearFrame();
  requestAnimationFrame(frame);
}

window.addEventListener('blur', () => {
  releaseAllTouches();
  if (app.screen === 'battle' && game.phase === 'playing') {
    game.phase = 'paused';
    last = performance.now();
  }
});

document.addEventListener('visibilitychange', () => {
  releaseAllTouches();
  if (document.hidden && app.screen === 'battle' && game.phase === 'playing') {
    game.phase = 'paused';
  }
  last = performance.now();
});

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
}, { passive: false });

canvas.focus();
requestAnimationFrame(frame);
