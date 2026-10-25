import {
  VIEW_W,
  VIEW_H,
  GROUND_Y,
  LEVEL_W,
  FONT_UI,
  FONT_TITLE,
  clamp,
  lerp,
  rand,
  randInt,
  choose,
  chance,
  damp,
  easeOutCubic,
  formatNumber,
  RARITIES,
  SLOT_LABEL,
  SLOT_ORDER,
  makeStarterGear,
  makeEquipment,
  itemScore,
  itemStatsText,
} from './core.js';
import {
  drawBackground,
  drawVignette,
  drawPanel,
  drawBar,
  drawKeycap,
  drawCoin,
  drawDiamond,
  drawTitle,
  drawText,
  drawSlash,
  drawFocusLines,
  drawRadialCooldown,
  drawWheel,
  fillRound,
  strokeRound,
  glow,
  hexToRgba,
} from './gfx.js';
import { Player, Enemy, Projectile, Pickup, Particle, DamageText } from './entities.js';
import { formatKey } from './ui.js';

const WAVE_COMPOSITIONS = {
  1: ['grunt', 'grunt', 'grunt'],
  2: ['grunt', 'archer', 'grunt', 'archer'],
  3: ['grunt', 'grunt', 'brute', 'archer'],
  4: ['grunt', 'archer', 'brute', 'archer', 'brute', 'grunt'],
  5: ['boss'],
};

const WAVE_TITLES = {
  1: ['第一波', '山魈拦路'],
  2: ['第二波', '赤羽掠空'],
  3: ['第三波', '石甲镇山'],
  4: ['第四波', '群妖乱舞'],
  5: ['关底', '混世妖将'],
};

export class Game {
  constructor(canvas, input, sound) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = input;
    this.sound = sound;
    this.damageOverlay = this.createDamageOverlay();
    this.phase = 'title';
    this.time = 0;
    this.titleTime = 0;
    this.camera = { x: 0, sx: 0, sy: 0 };
    this.shakeAmt = 0;
    this.hitstopTimer = 0;
    this.bufferedInput = new Set();
    this.bufferedActions = new Set();
    this.bufferedClick = false;
    this.slowTimer = 0;
    this.screenFlash = 0;
    this.damageFlash = 0;
    this.flashColor = '#ffcf78';
    this.hitSoundCd = 0;

    this.heroId = 'wukong';
    this.heroName = '孙悟空';
    this.heroTitle = '齐天大圣';
    this.heroBase = {
      hp: 660,
      atk: 46,
      def: 2,
      speed: 356,
      crit: 12,
      critMult: 1.95,
      regen: 5.6,
    };
    this.passives = {};
    this.setCounts = {};
    this.weaponMods = { range: 1, speed: 1, mult: 1, heavy: 1 };
    this.rogueMode = false;
    this.uiPaused = false;
    this.encounterLabel = '';
    this.battleCleared = false;
    this.battleClearTimer = 0;
    this.bossContinue = null;
    this.onBattleComplete = null;
    this.effectsQuality = 'high';
    this.settings = { screenShake: true };

    this.equipped = makeStarterGear();
    this.level = 1;
    this.xp = 0;
    this.xpNext = 40;
    this.stats = {};
    this.recalcStats();

    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.particles = [];
    this.texts = [];
    this.player = new Player(this);
    this.player.x = 470;
    this.player.hp = this.player.maxHp;

    this.wallet = 0;
    this.kills = 0;
    this.maxCombo = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.comboPop = 0;
    this.runTime = 0;

    this.wave = 0;
    this.maxWave = 5;
    this.waveState = 'idle';
    this.waveTimer = 0;
    this.boss = null;
    this.victoryTimer = 0;
    this.gameOverTimer = 0;
    this.bossDefeated = false;
    this.bossEngaged = false;

    this.banner = null;
    this.toast = null;
    this.itemToast = null;
    this.tutorialTime = 0;
    this.aimHover = false;

    this.ambientPetals = Array.from({ length: 26 }, () => this.makePetal(true));
    this.ambientMotes = Array.from({ length: 24 }, () => ({
      x: rand(0, VIEW_W),
      y: rand(120, VIEW_H - 40),
      r: rand(0.8, 2.2),
      speed: rand(4, 16),
      phase: rand(0, 10),
      alpha: rand(0.1, 0.35),
    }));

    this.best = { wave: 1, combo: 0 };
    try {
      const saved = JSON.parse(localStorage.getItem('qitian-best') || 'null');
      if (saved) this.best = { ...this.best, ...saved };
    } catch {
      /* ignore */
    }
  }

  createDamageOverlay() {
    const c = document.createElement('canvas');
    c.width = VIEW_W;
    c.height = VIEW_H;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 180, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.7);
    grad.addColorStop(0, 'rgba(170,32,28,0)');
    grad.addColorStop(0.68, 'rgba(170,32,28,0.32)');
    grad.addColorStop(1, 'rgba(170,32,28,1)');
    g.fillStyle = grad;
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    return c;
  }

  recalcStats() {
    const base = this.heroBase;
    let maxHp = base.hp + (this.level - 1) * 38;
    let atk = base.atk + (this.level - 1) * 4;
    let def = base.def;
    let crit = base.crit;
    let critMult = base.critMult;
    let speed = base.speed;
    let energyRegen = base.regen;
    const passives = {
      combo: 0,
      crit: 0,
      heavyRange: 0,
      heavy: 0,
      burn: 0,
      critEnergy: 0,
      heal: 0,
      skill: 0,
      guard: 0,
      dashEnergy: 0,
      thorns: 0,
      lifesteal: 0,
      block: 0,
      killHeal: 0,
      coinHeal: 0,
      dashCd: 0,
      dashRange: 0,
      energy: 0,
      cooldown: 0,
      hitSpeed: 0,
      dashGuard: 0,
      critPerCombo: 0,
      coin: 0,
    };
    const setCounts = {};
    for (const slot of SLOT_ORDER) {
      const item = this.equipped[slot];
      if (!item) continue;
      const s = item.stats || {};
      const favored = item.favored && item.favored === this.heroId ? 1.15 : 1;
      maxHp += (s.hp || 0) * favored;
      atk += (s.atk || 0) * favored;
      def += (s.def || 0) * favored;
      crit += (s.crit || 0) * favored;
      speed += (s.speed || 0) * favored;
      energyRegen += (s.energy || 0) * favored;
      for (const [key, value] of Object.entries(item.passive || {})) {
        if (key in passives) passives[key] += value;
      }
      if (favored > 1) {
        if (item.set === 'qitian') passives.combo += 0.015;
        if (item.set === 'jinchan') passives.heal += 0.03;
        if (item.set === 'juanlian') passives.guard += 0.015;
        if (item.set === 'jingtan') passives.lifesteal += 0.01;
        if (item.set === 'hunyuan') passives.crit += 0.6;
      }
      if (item.set) setCounts[item.set] = (setCounts[item.set] || 0) + 1;
    }
    if (this.heroId === 'wukong') passives.combo += 0.02;
    if (this.heroId === 'tangseng') {
      passives.heal += 0.18;
      energyRegen += 2;
    }
    if (this.heroId === 'shaseng') {
      passives.block += 0.1;
      def += 6;
    }
    if (this.heroId === 'bajie') passives.lifesteal += 0.03;
    if ((setCounts.qitian || 0) >= 2) passives.combo += 0.08;
    if ((setCounts.qitian || 0) >= 4) passives.perfectCrit = true;
    if ((setCounts.jinchan || 0) >= 2) passives.heal += 0.2;
    if ((setCounts.jinchan || 0) >= 4) passives.firstShield = true;
    if ((setCounts.juanlian || 0) >= 2) def += 8;
    if ((setCounts.juanlian || 0) >= 4) passives.thorns += 0.1;
    if ((setCounts.jingtan || 0) >= 2) passives.lifesteal += 0.05;
    if ((setCounts.jingtan || 0) >= 4) passives.killHeal += 0.1;
    if ((setCounts.hunyuan || 0) >= 2) crit += 5;
    if ((setCounts.hunyuan || 0) >= 4) passives.coin += 0.25;
    crit += passives.crit || 0;
    energyRegen *= 1 + (passives.energy || 0);
    this.passives = passives;
    this.setCounts = setCounts;
    this.weaponMods = { range: 1, speed: 1, mult: 1, heavy: 1, ...(this.equipped.weapon?.mods || {}) };
    this.stats = {
      maxHp: Math.round(maxHp),
      atk: Math.round(atk),
      def: Math.round(def),
      crit: Math.round(crit * 10) / 10,
      critMult,
      speed: Math.round(speed),
      energyRegen: Math.round(energyRegen * 10) / 10,
    };
    if (this.player) this.player.syncMaxHp(this.stats.maxHp, !this.rogueMode);
  }

  setupRogueRun(hero, loadout) {
    this.rogueMode = true;
    this.heroId = hero.id;
    this.heroName = hero.name;
    this.heroTitle = hero.title;
    this.heroBase = {
      hp: hero.base.hp,
      atk: hero.base.atk,
      def: hero.base.def,
      speed: hero.base.speed,
      crit: hero.base.crit,
      critMult: hero.base.critMult,
      regen: hero.base.regen,
    };
    this.equipped = loadout;
    this.battleGuard = 0;
    this.uiPaused = false;
    this.level = 1;
    this.xp = 0;
    this.xpNext = 40;
    this.wallet = 0;
    this.kills = 0;
    this.maxCombo = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.runTime = 0;
    this.recalcStats();
    this.player = new Player(this);
    this.player.x = 400;
    this.player.hp = this.player.maxHp;
    this.player.energy = this.player.maxEnergy;
    this.phase = 'meta';
    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.particles = [];
    this.texts = [];
    this.boss = null;
    this.bossDefeated = false;
    this.bossEngaged = false;
    this.battleCleared = false;
    this.bossContinue = null;
    this.bossContinueTimer = 0;
    this.battleClearTimer = 0;
    this.gameOverTimer = 0;
    this.victoryTimer = 0;
    this.screenFlash = 0;
    this.damageFlash = 0;
    this.hitstopTimer = 0;
    this.slowTimer = 0;
    this.banner = null;
    this.toast = null;
    this.itemToast = null;
    this.camera.x = 0;
    this.updateCamera(1);
  }

  startEncounter({ specs = [], label = '妖径', onComplete = null, battleGuard = 0 } = {}) {
    this.rogueMode = true;
    this.battleGuard = battleGuard;
    this.phase = 'playing';
    this.encounterLabel = label;
    this.onBattleComplete = onComplete;
    this.battleCleared = false;
    this.battleClearTimer = 0;
    this.gameOverTimer = 0;
    this.victoryTimer = 0;
    this.bossDefeated = false;
    this.bossEngaged = false;
    this.boss = null;
    this.bossContinue = null;
    this.bossContinueTimer = 0;
    this.wave = 1;
    this.waveState = 'idle';
    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.particles = [];
    this.texts = [];
    this.combo = 0;
    this.comboTimer = 0;
    this.damageFlash = 0;
    this.screenFlash = 0;
    this.slowTimer = 0;
    this.hitstopTimer = 0;
    this.camera.x = 0;
    this.player.dead = false;
    this.player.state = 'idle';
    this.player.hp = Math.min(this.player.hp, this.player.maxHp);
    this.player.energy = this.player.maxEnergy;
    this.player.x = 380;
    this.player.y = 620;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.invuln = 1;
    this.player.comboStep = 0;
    this.player.comboWindow = 0;
    this.player.attackBuffer = 0;
    this.player.heavyCd = 0;
    this.player.castCd = 0;
    this.player.dashCd = 0;
    this.player.ultActive = false;
    if (this.passives.firstShield) this.player.firstShield = true;
    this.player.forceCrit = false;
    const startX = 760;
    specs.forEach((spec, index) => {
      const x = Math.min(2380, startX + index * 140);
      const enemy = this.spawnEnemy(spec.kind || 'grunt', x, {
        hpScale: spec.hpScale || 1,
        damageScale: spec.damageScale || 1,
        displayName: spec.name,
      });
      if (spec.boss) {
        enemy.isElite = true;
        this.boss = enemy;
        this.bossEngaged = true;
      }
    });
    this.showBanner(label, '妖气挡住了去路', '击败所有敌人', 1.6, '#f0d49a');
    this.sound.startMusic();
    this.sound.play('wave');
  }

  finishEncounter(victory) {
    if (this.phase === 'meta') return;
    if (victory) {
      for (const pickup of this.pickups) {
        if (pickup.type === 'coin') {
          this.wallet += pickup.value;
          pickup.remove = true;
        }
      }
    }
    this.phase = 'meta';
    this.battleCleared = true;
    const callback = this.onBattleComplete;
    this.onBattleComplete = null;
    callback?.({ victory, hp: this.player.hp, maxHp: this.player.maxHp, wallet: this.wallet });
  }

  showBossContinue(title, subtitle, callback) {
    this.phase = 'bossCleared';
    this.battleCleared = true;
    this.bossContinue = callback;
    this.bossContinueTitle = title || '妖王已伏';
    this.bossContinueSubtitle = subtitle || '塔门在尽头缓缓开启';
    this.bossContinueTimer = 0;
    this.input.clearFrame();
    this.sound.play('levelup', 0.8);
    this.sound.play('boss', 0.55);
    this.flash('#f1cc82', 0.24);
  }

  getBossContinueButton() {
    return { x: VIEW_W / 2 - 132, y: 432, w: 264, h: 62 };
  }

  drawBossContinue(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(3,4,7,0.78)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const g = ctx.createRadialGradient(VIEW_W / 2, 300, 30, VIEW_W / 2, 300, 560);
    g.addColorStop(0, 'rgba(148,105,43,0.18)');
    g.addColorStop(1, 'rgba(3,4,7,0.3)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const fade = clamp((this.bossContinueTimer || 0) / 0.7, 0, 1);
    ctx.globalAlpha = fade;
    drawText(ctx, 'THE TOWER GATE', VIEW_W / 2, 250, {
      font: `600 13px ${FONT_UI}`,
      color: 'rgba(231,198,133,0.62)',
      align: 'center',
    });
    drawTitle(ctx, this.bossContinueTitle || '妖王已伏', VIEW_W / 2, 312, 68, '#f4d99e');
    drawText(ctx, this.bossContinueSubtitle || '塔门在尽头缓缓开启', VIEW_W / 2, 368, {
      font: `15px ${FONT_UI}`,
      color: 'rgba(231,211,178,0.58)',
      align: 'center',
    });
    const button = this.getBossContinueButton();
    this.drawButton(ctx, button, '踏 入 高 楼', this.touchMode ? '点击继续' : `${formatKey(this.input.bindings.attack)} / Enter / 点击`, true);
    ctx.restore();
  }

  resetRun() {
    this.phase = 'playing';
    this.time = 0;
    this.runTime = 0;
    this.camera.x = 0;
    this.camera.sx = 0;
    this.camera.sy = 0;
    this.shakeAmt = 0;
    this.hitstopTimer = 0;
    this.bufferedInput = new Set();
    this.bufferedActions = new Set();
    this.bufferedClick = false;
    this.slowTimer = 0;
    this.screenFlash = 0;
    this.damageFlash = 0;
    this.equipped = makeStarterGear();
    this.level = 1;
    this.xp = 0;
    this.xpNext = 40;
    this.recalcStats();
    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.particles = [];
    this.texts = [];
    this.player = new Player(this);
    this.player.x = 400;
    this.player.hp = this.player.maxHp;
    this.wallet = 0;
    this.kills = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.comboTimer = 0;
    this.comboPop = 0;
    this.wave = 0;
    this.waveState = 'intermission';
    this.waveTimer = 1.4;
    this.boss = null;
    this.bossDefeated = false;
    this.bossEngaged = false;
    this.victoryTimer = 0;
    this.gameOverTimer = 0;
    this.banner = null;
    this.toast = null;
    this.itemToast = null;
    this.tutorialTime = 9;
    this.sound.init();
    this.sound.startMusic();
    this.sound.play('wave');
    this.showBanner('花果山 · 试炼', '五波妖潮，一根棍子打穿', '妖气正在汇聚', 2.4);
  }

  makePetal(initial = false) {
    return {
      x: rand(-120, VIEW_W + 120),
      y: initial ? rand(-100, VIEW_H) : rand(-100, -20),
      vx: rand(14, 44),
      vy: rand(20, 54),
      size: rand(2.2, 5.2),
      rotation: rand(0, Math.PI * 2),
      spin: rand(-1.8, 1.8),
      alpha: rand(0.16, 0.5),
      sway: rand(0, 10),
      phase: rand(0, Math.PI * 2),
    };
  }

  addParticle(opts) {
    const cap = this.effectsQuality === 'low' ? 150 : this.effectsQuality === 'medium' ? 300 : 480;
    if (this.effectsQuality === 'low' && chance(0.45)) return;
    if (this.particles.length >= cap) this.particles.shift();
    this.particles.push(new Particle(opts));
  }

  addText(x, y, text, opts = {}) {
    this.texts.push(new DamageText(x, y, text, opts));
  }

  shake(amount) {
    if (this.settings && this.settings.screenShake === false) return;
    this.shakeAmt = Math.min(30, Math.max(this.shakeAmt, amount));
  }

  hitstop(seconds) {
    // Keep the impact freeze subtle so high-refresh monitors don't feel input lag.
    this.hitstopTimer = Math.max(this.hitstopTimer, Math.min(seconds * 0.65, 0.035));
  }

  slow(seconds) {
    this.slowTimer = Math.max(this.slowTimer, seconds);
  }

  flash(color = '#ffcf78', strength = 0.45) {
    this.screenFlash = Math.max(this.screenFlash, strength);
    this.flashColor = color;
  }

  showBanner(kicker, title, sub = '', duration = 2.2, color = '#f3d59a') {
    this.banner = { kicker, title, sub, life: duration, duration, color };
  }

  showToast(title, sub = '', color = '#f3d59a', duration = 2.4) {
    this.toast = { title, sub, life: duration, duration, color };
  }

  update(dt) {
    dt = Math.min(dt, 0.05);
    this.time += dt;
    this.updateAmbient(dt);
    this.shakeAmt = damp(this.shakeAmt, 0, 7, dt);
    this.screenFlash = Math.max(0, this.screenFlash - dt * 3.8);
    this.damageFlash = Math.max(0, this.damageFlash - dt * 2.8);
    this.hitSoundCd = Math.max(0, this.hitSoundCd - dt);
    this.updatePetals(dt);
    this.sound.updateMusic();

    if (this.uiPaused) {
      this.updateVisuals(dt);
      return;
    }

    if (this.phase === 'title') {
      this.updateTitle(dt);
      this.updateVisuals(dt);
      return;
    }

    if (this.input.wasPressed('KeyM')) {
      const muted = this.sound.toggleMuted();
      this.showToast(muted ? '静音' : '声音开启', muted ? '按 M 恢复' : '按 M 静音', '#c9d7ea', 1.6);
    }

    if (this.phase === 'paused') {
      this.handlePauseInput();
      this.updateVisuals(dt);
      this.updateCamera(dt);
      return;
    }

    if (this.phase === 'bossCleared') {
      this.bossContinueTimer = (this.bossContinueTimer || 0) + dt;
      const button = this.getBossContinueButton();
      const clicked = this.input.clicked && this.pointIn(button);
      const pressed = this.input.wasActionPressed('attack') || this.input.wasPressed('Enter', 'Space', 'NumpadEnter');
      if ((clicked || pressed) && this.bossContinueTimer > 0.6) {
        const callback = this.bossContinue;
        this.bossContinue = null;
        this.phase = 'meta';
        this.battleCleared = true;
        this.input.clearFrame();
        callback?.();
        return;
      }
      this.updateEffects(dt);
      this.updateCamera(dt);
      this.updateVisuals(dt);
      return;
    }

    if (this.phase === 'gameover' || this.phase === 'victory') {
      this.updateResultsInput();
      this.updateEffects(dt);
      this.updateCamera(dt);
      this.updateVisuals(dt);
      return;
    }

    if (this.phase !== 'playing') return;

    if (this.input.wasActionPressed('pause')) {
      this.phase = 'paused';
      this.sound.play('ui');
      return;
    }

    this.runTime += dt;
    if (this.banner) {
      this.banner.life -= dt;
      if (this.banner.life <= 0) this.banner = null;
    }
    if (this.toast) {
      this.toast.life -= dt;
      if (this.toast.life <= 0) this.toast = null;
    }
    if (this.itemToast) {
      this.itemToast.life -= dt;
      if (this.itemToast.life <= 0) this.itemToast = null;
    }
    this.tutorialTime = Math.max(0, this.tutorialTime - dt);
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
      }
    }
    this.comboPop = Math.max(0, this.comboPop - dt * 5);

    if (this.hitstopTimer > 0) {
      // Keep inputs that land during the impact freeze; otherwise fast players
      // lose a combo press and the game feels unresponsive.
      for (const code of this.input.pressed) this.bufferedInput.add(code);
      for (const action of this.input.actionsPressed) this.bufferedActions.add(action);
      if (this.input.clicked) this.bufferedClick = true;
      this.hitstopTimer -= dt;
      this.updateEffects(dt * 0.45);
      this.updateCamera(dt);
      return;
    }

    if (this.bufferedInput.size) {
      for (const code of this.bufferedInput) this.input.pressed.add(code);
      this.bufferedInput.clear();
    }
    if (this.bufferedActions.size) {
      for (const action of this.bufferedActions) this.input.actionsPressed.add(action);
      this.bufferedActions.clear();
    }
    if (this.bufferedClick) {
      this.input.pressed.add('KeyJ');
      this.input.actionsPressed.add('attack');
      this.bufferedClick = false;
    } else if (this.input.clicked) {
      this.input.pressed.add('KeyJ');
      this.input.actionsPressed.add('attack');
    }

    this.player.update(this, dt);

    const edt = this.slowTimer > 0 ? dt * 0.32 : dt;
    this.slowTimer = Math.max(0, this.slowTimer - dt);
    for (const enemy of this.enemies) enemy.update(this, edt);
    for (const proj of this.projectiles) proj.update(this, edt);
    for (const pickup of this.pickups) pickup.update(this, dt);
    this.updateEffects(dt);
    if (this.rogueMode) {
      if (!this.player.dead && !this.battleCleared && this.enemies.length > 0 && this.enemies.every((enemy) => enemy.dead)) {
        this.battleClearTimer += dt;
        if (this.battleClearTimer > 0.8) this.finishEncounter(true);
      }
      if (this.enemies.length === 0 && !this.battleCleared) {
        this.battleClearTimer += dt;
        if (this.battleClearTimer > 0.8) this.finishEncounter(true);
      }
    } else {
      this.updateWaves(dt);
    }
    this.updateCamera(dt);

    this.enemies = this.enemies.filter((enemy) => !enemy.remove);
    this.projectiles = this.projectiles.filter((proj) => !proj.remove);
    this.pickups = this.pickups.filter((pickup) => !pickup.remove);

    if (this.player.dead) {
      this.gameOverTimer -= dt;
      if (this.gameOverTimer <= 0) {
        if (this.rogueMode) this.finishEncounter(false);
        else this.showGameOver();
      }
    }
    if (this.bossDefeated && !this.rogueMode) {
      this.victoryTimer -= dt;
      if (this.victoryTimer <= 0) this.showVictory();
    }
  }

  updateTitle(dt) {
    this.titleTime += dt;
    if (this.titleTime > 0.4 && this.input.wasPressed('Enter', 'Space', 'NumpadEnter')) {
      this.resetRun();
      return;
    }
    if (this.input.clicked) {
      this.sound.init();
      this.resetRun();
    }
    this.player.animTime += dt;
  }

  handlePauseInput() {
    if (this.input.wasActionPressed('pause') || this.input.wasPressed('Enter', 'Space')) {
      this.phase = 'playing';
      this.sound.play('ui');
    }
    if (this.input.wasPressed('KeyR')) {
      if (this.rogueMode) this.finishEncounter(false);
      else this.resetRun();
    }
    if (this.input.clicked) {
      const b = this.getPauseButtons();
      if (this.pointIn(b.resume)) {
        this.phase = 'playing';
        this.sound.play('ui');
      } else if (this.pointIn(b.restart)) {
        if (this.rogueMode) this.finishEncounter(false);
        else this.resetRun();
      }
    }
  }

  updateResultsInput() {
    if (this.input.wasPressed('KeyR', 'Enter', 'NumpadEnter')) {
      this.resetRun();
      return;
    }
    if (this.input.clicked && this.pointIn(this.getResultButton())) {
      this.resetRun();
    }
  }

  getPauseButtons() {
    return {
      resume: { x: VIEW_W / 2 - 142, y: 405, w: 284, h: 58 },
      restart: { x: VIEW_W / 2 - 142, y: 478, w: 284, h: 50 },
    };
  }

  getResultButton() {
    return { x: VIEW_W / 2 - 142, y: 500, w: 284, h: 58 };
  }

  pointIn(r) {
    const p = this.input.pointer;
    return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  }

  updateCamera(dt) {
    let target;
    if (this.boss && !this.boss.dead && this.bossEngaged) {
      target = (this.player.x + this.boss.x) / 2 - VIEW_W * 0.5;
    } else {
      target = this.player.x - VIEW_W * 0.38 + this.player.facing * 45;
    }
    target = clamp(target, 0, LEVEL_W - VIEW_W);
    this.camera.x = damp(this.camera.x, target, 4.4, dt);
    this.camera.sx = rand(-1, 1) * this.shakeAmt;
    this.camera.sy = rand(-1, 1) * this.shakeAmt * 0.65;
  }

  updateAmbient(dt) {
    for (const mote of this.ambientMotes) {
      mote.y -= mote.speed * dt;
      mote.x += Math.sin(this.time * 0.8 + mote.phase) * 4 * dt;
      if (mote.y < 80) {
        mote.y = VIEW_H - 30;
        mote.x = rand(0, VIEW_W);
      }
    }
  }

  updatePetals(dt) {
    for (const petal of this.ambientPetals) {
      petal.x += (petal.vx + Math.sin(this.time + petal.phase) * 13) * dt;
      petal.y += petal.vy * dt;
      petal.rotation += petal.spin * dt;
      if (petal.y > VIEW_H + 30) {
        Object.assign(petal, this.makePetal());
      }
      if (petal.x > VIEW_W + 140) petal.x = -120;
    }
  }

  updateVisuals(dt) {
    if (this.banner) {
      this.banner.life -= dt;
      if (this.banner.life <= 0) this.banner = null;
    }
    if (this.toast) {
      this.toast.life -= dt;
      if (this.toast.life <= 0) this.toast = null;
    }
    if (this.itemToast) {
      this.itemToast.life -= dt;
      if (this.itemToast.life <= 0) this.itemToast = null;
    }
    this.updateEffects(dt);
  }

  updateEffects(dt) {
    for (const p of this.particles) p.update(dt);
    for (const t of this.texts) t.update(dt);
    this.particles = this.particles.filter((p) => p.life > 0);
    this.texts = this.texts.filter((t) => t.life > 0);
  }

  // ---------------------------------------------------------------- combat

  playerStrike(rect, opts) {
    let hits = 0;
    let crits = 0;
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      const box = { x: enemy.x - enemy.w / 2, y: enemy.y - enemy.h, w: enemy.w, h: enemy.h };
      if (rect.x < box.x + box.w && rect.x + rect.w > box.x && rect.y < box.y + box.h && rect.y + rect.h > box.y) {
        const result = this.hitEnemy(enemy, opts.mult, opts);
        if (result) {
          hits += 1;
          if (result.crit) crits += 1;
        }
      }
    }
    if (hits > 0) {
      this.hitstop(opts.hitstop || 0.03);
      this.shake(opts.shake || 2.5);
      if (!this.hitSoundCd) {
        this.sound.play(crits > 0 ? 'crit' : 'hit', crits > 0 ? 1.1 : 0.85);
        this.hitSoundCd = 0.04;
      }
    }
    return hits;
  }

  playerStrikeCircle(circle, opts) {
    let hits = 0;
    let crits = 0;
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      const dx = enemy.x - circle.x;
      const dy = enemy.y - enemy.h / 2 - circle.y;
      const reach = circle.r + enemy.w * 0.4;
      if (dx * dx + dy * dy < reach * reach) {
        const result = this.hitEnemy(enemy, opts.mult, opts);
        if (result) {
          hits += 1;
          if (result.crit) crits += 1;
        }
      }
    }
    if (hits > 0) {
      this.hitstop(opts.hitstop || 0.04);
      this.shake(opts.shake || 4);
      this.sound.play(crits > 0 ? 'crit' : 'hit', 1);
    }
    return hits;
  }

  hitEnemy(enemy, mult, opts = {}) {
    if (enemy.dead) return null;
    const atk = this.stats.atk;
    const comboCrit = (this.passives.critPerCombo || 0) * this.combo;
    const critChance = clamp(this.stats.crit + (opts.critBonus || 0) + comboCrit, 0, 75);
    let forced = false;
    if (this.player?.forceCrit && opts.canCrit !== false && opts.sourceX != null) {
      this.player.forceCrit = false;
      forced = true;
    }
    const crit = forced || (opts.canCrit !== false && chance(critChance / 100));
    const comboBonus = 1 + (this.passives.combo || 0) * this.combo;
    let damage = atk * mult * comboBonus * rand(0.94, 1.06);
    if (opts.fixed != null) damage = opts.fixed;
    if (crit) damage *= this.stats.critMult;
    if (this.passives.burn) damage += this.passives.burn;
    damage = Math.max(1, Math.round(damage));
    enemy.takeHit(this, damage, opts);
    if (!this.player.dead && (this.passives.lifesteal || 0) > 0) {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + damage * this.passives.lifesteal);
    }

    const dx = enemy.x;
    const dy = enemy.y - enemy.h * 0.62;
    this.addText(dx + rand(-22, 22), dy + rand(-18, 5), damage, {
      color: crit ? '#ffd36c' : opts.color || '#ffe1a2',
      size: crit ? 34 : 22,
      crit,
      vy: crit ? -145 : -105,
    });
    this.combo += 1;
    this.comboTimer = 2.35;
    this.comboPop = 1;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;

    if (opts.energy !== false && !this.player.dead) this.player.addEnergy(crit ? 4.2 + (this.passives.critEnergy || 0) : 2.4);
    this.shake(opts.shake ?? 2);
    for (let i = 0; i < (crit ? 15 : 8); i += 1) {
      const a = rand(-Math.PI, 0.45 * Math.PI);
      const speed = rand(60, crit ? 400 : 260);
      this.addParticle({
        x: enemy.x + rand(-enemy.w * 0.3, enemy.w * 0.3),
        y: dy + rand(-12, 16),
        vx: Math.cos(a) * speed + (opts.sourceX != null ? Math.sign(enemy.x - opts.sourceX) * 80 : 0),
        vy: Math.sin(a) * speed,
        life: rand(0.18, crit ? 0.52 : 0.38),
        size: rand(2, crit ? 7 : 5),
        color: crit ? choose(['#fff2b5', '#ffd05f', '#ff9b3f']) : choose(['#ffe1a2', '#ffb45d', '#ff7a42']),
        kind: 'spark',
        gravity: 350,
        drag: 0.93,
      });
    }
    if (crit) {
      this.addParticle({
        x: enemy.x,
        y: dy,
        vx: 0,
        vy: 0,
        life: 0.3,
        size: 22,
        color: '#ffd166',
        kind: 'ring',
        line: 3,
      });
      this.hitstop(0.045);
      this.shake(5);
    }
    return { damage, crit };
  }

  hurtPlayer(amount, sourceX, opts = {}) {
    if (this.phase !== 'playing' || this.player.dead) return 0;
    const damage = this.player.takeDamage(this, amount, sourceX, opts);
    if (damage > 0) {
      this.combo = 0;
      this.comboTimer = 0;
      this.damageFlash = 1;
    }
    return damage;
  }

  spawnHeroOrb(type, x, y, facing) {
    const configs = {
      fire: { type: 'flame', mult: 1.05 * (1 + (this.passives.skill || 0)), speed: 850, radius: 15, life: 0.9, pierce: 1, color: '#ff9d4f', critBonus: 2 },
      ice: { type: 'ice', mult: 0.9 * (1 + (this.passives.skill || 0)), speed: 740, radius: 12, life: 1.05, pierce: 2, color: '#9fe0ff', critBonus: 5 },
      chaos: { type: 'chaos', mult: 1.65 * (1 + (this.passives.skill || 0)), speed: 430, radius: 23, life: 1.35, pierce: 1, color: '#b487ff', critBonus: 0 },
    };
    const config = configs[type] || configs.fire;
    this.projectiles.push(
      new Projectile({
        x,
        y,
        vx: facing * config.speed,
        vy: 0,
        radius: config.radius,
        life: config.life,
        owner: 'player',
        type: config.type,
        mult: config.mult,
        pierce: config.pierce,
        critBonus: config.critBonus,
        color: config.color,
      })
    );
    this.sound.play(type === 'chaos' ? 'ult' : 'fire', type === 'chaos' ? 0.28 : 0.85);
    this.flash(config.color, type === 'chaos' ? 0.2 : 0.12);
    this.shake(type === 'chaos' ? 3.4 : 1.8);
    for (let i = 0; i < 14; i += 1) {
      this.addParticle({
        x,
        y,
        vx: facing * rand(20, 160) + rand(-50, 50),
        vy: rand(-90, 90),
        life: rand(0.15, 0.38),
        size: rand(2, 6),
        color: config.color,
        kind: 'spark',
        drag: 0.9,
      });
    }
  }

  spawnPlayerFlame(x, y, facing) {
    this.projectiles.push(
      new Projectile({
        x,
        y,
        vx: facing * 850,
        vy: 0,
        radius: 17,
        life: 0.72,
        owner: 'player',
        type: 'flame',
        mult: 2.45 * (1 + (this.passives.skill || 0)),
        pierce: 2,
        critBonus: 4,
        color: '#ffb347',
      })
    );
    this.sound.play('fire', 1);
    this.flash('#ff9f4a', 0.16);
  }

  startUltimate(player) {
    this.sound.play('ult');
    this.flash('#ffd578', 0.75);
    this.shake(13);
    this.slow(1.1);
    this.addText(player.x, player.y - 155, '齐 天 大 圣', {
      color: '#ffe29a',
      size: 30,
      crit: false,
      vy: -45,
      life: 1.5,
    });
    for (let i = 0; i < 40; i += 1) {
      const a = rand(0, Math.PI * 2);
      const r = rand(30, 150);
      this.addParticle({
        x: player.x + Math.cos(a) * r,
        y: player.y - 55 + Math.sin(a) * r * 1.3,
        vx: -Math.cos(a) * rand(40, 190),
        vy: -rand(30, 160),
        life: rand(0.35, 0.9),
        size: rand(2, 7),
        color: choose(['#ffe6a5', '#ffc95c', '#ff913f']),
        kind: 'ember',
        drag: 0.95,
      });
    }
  }

  ultimatePulse(player, index) {
    const color = index < 2 ? '#ffe9b0' : '#ffc05c';
    this.flash(color, 0.2);
    this.shake(11 + index * 1.2);
    this.hitstop(0.025);
    this.sound.play(index === 0 ? 'explode' : 'swingHeavy', 1.2);
    this.playerStrikeCircle(
      { x: player.x, y: player.y - 55, r: 600 },
      {
        mult: 1.02 + index * 0.05,
        sourceX: player.x,
        knock: 360,
        launch: -240,
        hitstop: 0.025,
        shake: 8,
        color,
        critBonus: 18,
        energy: false,
      }
    );
    this.addParticle({
      x: player.x,
      y: player.y - 50,
      vx: 0,
      vy: 0,
      life: 0.55,
      size: 40 + index * 20,
      color,
      kind: 'ring',
      line: 10,
    });
    for (let i = 0; i < 12; i += 1) {
      this.addParticle({
        x: player.x + rand(-90, 90),
        y: player.y - rand(20, 180),
        vx: rand(-120, 120),
        vy: rand(-300, -80),
        life: rand(0.3, 0.65),
        size: rand(2, 6),
        color: choose(['#fff3c2', '#ffd36a', '#ff9f4f']),
        kind: 'spark',
        gravity: 250,
      });
    }
    if (index === 2) {
      for (let i = 0; i < 3; i += 1) {
        this.addParticle({
          x: player.x + rand(-160, 160),
          y: player.y - rand(90, 200),
          vx: rand(-15, 15),
          vy: rand(-40, -15),
          life: 1.1,
          size: 30,
          color: 'rgba(255,226,150,0.85)',
          kind: 'glyph',
          text: choose(['破', '天', '战']),
          textSize: 44,
        });
      }
    }
  }

  // ---------------------------------------------------------------- death

  onEnemyKilled(enemy) {
    this.kills += 1;
    if ((this.passives.killHeal || 0) > 0 && !this.player.dead) {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.maxHp * this.passives.killHeal);
    }
    const xp = enemy.data.xp;
    this.gainXp(xp);
    this.sound.play(enemy.isBoss ? 'explode' : 'death', enemy.isBoss ? 1.4 : 0.6);
    if (this.rogueMode) {
      const [minCoin, maxCoin] = enemy.data.coins;
      const total = randInt(minCoin, maxCoin) + (enemy.isBoss ? 18 : 0);
      const count = clamp(Math.round(total / 3), 1, 6);
      for (let i = 0; i < count; i += 1) {
        this.pickups.push(
          new Pickup('coin', enemy.x + rand(-40, 40), enemy.y - rand(25, 75), {
            value: Math.max(1, Math.round(total / count)),
          })
        );
      }
      if (enemy.isBoss) {
        this.shake(16);
        this.flash('#ffd77a', 0.35);
      }
      return;
    }
    if (enemy.isBoss) {
      this.bossDefeated = true;
      this.victoryTimer = 2.7;
      this.slow(1.3);
      this.flash('#ffd77a', 0.8);
      this.shake(24);
      this.showBanner('妖将伏诛', '花果山，重回清静', '战利品已散落', 3, '#ffd77a');
      for (let i = 0; i < 6; i += 1) {
        const item = makeEquipment({
          slot: SLOT_ORDER[i % 3],
          wave: 6,
          level: this.level,
          rarity: i < 2 ? Math.min(4, 2 + i) : null,
        });
        this.pickups.push(
          new Pickup('equipment', enemy.x + rand(-150, 150), enemy.y - rand(80, 210), { item })
        );
      }
      for (let i = 0; i < 9; i += 1) {
        this.pickups.push(
          new Pickup('coin', enemy.x + rand(-150, 150), enemy.y - rand(40, 150), {
            value: randInt(8, 18),
          })
        );
      }
      this.pickups.push(new Pickup('heal', enemy.x, enemy.y - 120, { value: 0.35 }));
      // clear remaining adds quietly
      for (const other of this.enemies) {
        if (other !== enemy && !other.dead) {
          other.hp = 0;
          other.dead = true;
          other.deathTimer = 0;
          other.vy = -260;
          other.vx = rand(-110, 110);
          this.addParticle({ x: other.x, y: other.y - 40, vx: 0, vy: 0, life: 0.4, size: 20, color: '#ffbd6b', kind: 'ring', line: 3 });
        }
      }
      return;
    }

    // level-scaled loot
    const [minCoin, maxCoin] = enemy.data.coins;
    const total = randInt(minCoin, maxCoin);
    const count = clamp(Math.round(total / 3), 1, 5);
    for (let i = 0; i < count; i += 1) {
      this.pickups.push(
        new Pickup('coin', enemy.x + rand(-26, 26), enemy.y - rand(30, 60), {
          value: Math.max(1, Math.round(total / count)),
        })
      );
    }
    const equipChance = enemy.kind === 'brute' ? 0.34 : enemy.kind === 'archer' ? 0.12 : 0.09;
    if (chance(equipChance)) {
      this.pickups.push(
        new Pickup('equipment', enemy.x, enemy.y - 50, {
          item: makeEquipment({ wave: this.wave, level: this.level }),
        })
      );
    }
    if (chance(0.1)) {
      this.pickups.push(new Pickup('heal', enemy.x, enemy.y - 30, { value: 0.18 }));
    }
  }

  onPlayerDeath() {
    this.gameOverTimer = 1.8;
    this.slow(1.2);
    this.shake(18);
    this.flash('#d64c3c', 0.5);
    this.showBanner('力竭', '这条轮回到此为止', this.rogueMode ? '本次探索将结束' : '失败没有惩罚', 2.4, '#ff8d7a');
    if (!this.rogueMode) this.saveBest();
  }

  gainXp(amount) {
    this.xp += amount;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level += 1;
      this.xpNext = Math.round(this.xpNext * 1.42 + 16);
      const oldMax = this.player.maxHp;
      this.recalcStats();
      if (!this.rogueMode) this.player.hp = this.player.maxHp;
      this.sound.play('levelup');
      this.flash('#ffd77a', 0.35);
      this.showToast('境界提升', `Lv.${this.level} · 气血 +${this.player.maxHp - oldMax} · 攻击提升`, '#ffd77a', 3.2);
      this.addParticle({
        x: this.player.x,
        y: this.player.y - 110,
        vx: 0,
        vy: -18,
        life: 1.1,
        size: 42,
        color: '#ffe29a',
        kind: 'glyph',
        text: '突破',
        textSize: 42,
      });
      for (let i = 0; i < 30; i += 1) {
        const a = rand(0, Math.PI * 2);
        this.addParticle({
          x: this.player.x + Math.cos(a) * rand(10, 50),
          y: this.player.y - 60 + Math.sin(a) * rand(10, 60),
          vx: Math.cos(a) * rand(40, 160),
          vy: Math.sin(a) * rand(40, 140) - 100,
          life: rand(0.4, 0.9),
          size: rand(2, 6),
          color: choose(['#ffe8aa', '#ffcf68', '#ffffff']),
          kind: 'spark',
          gravity: 130,
        });
      }
    }
  }

  // ---------------------------------------------------------------- loot

  collectCoin(value, x, y) {
    const bonus = 1 + (this.passives.coin || 0);
    value = Math.max(1, Math.round(value * bonus));
    this.wallet += value;
    if ((this.passives.coinHeal || 0) > 0) {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.maxHp * this.passives.coinHeal);
    }
    this.sound.play('coin', 0.55);
    this.addText(x, y - 12, `+${value}`, { color: '#ffd26a', size: 15, vy: -55, life: 0.6 });
    for (let i = 0; i < 3; i += 1) {
      this.addParticle({
        x,
        y,
        vx: rand(-50, 50),
        vy: rand(-80, -20),
        life: rand(0.2, 0.4),
        size: rand(1.5, 3),
        color: '#ffd26a',
        kind: 'spark',
      });
    }
  }

  collectHeal(value, x, y) {
    this.player.heal(Math.round(this.player.maxHp * value), this);
    this.flash('#7be6a1', 0.1);
  }

  collectEquipment(item, x, y) {
    const old = this.equipped[item.slot];
    const newScore = itemScore(item);
    const oldScore = itemScore(old);
    const better = !old || newScore > oldScore;
    this.sound.play(better ? 'equip' : 'coin', 0.8);
    if (better) {
      this.equipped[item.slot] = item;
      this.recalcStats();
      for (let i = 0; i < 24; i += 1) {
        const a = rand(0, Math.PI * 2);
        this.addParticle({
          x,
          y: y - 20,
          vx: Math.cos(a) * rand(20, 160),
          vy: Math.sin(a) * rand(20, 140) - 60,
          life: rand(0.35, 0.8),
          size: rand(2, 6),
          color: item.rarity.color,
          kind: 'spark',
          gravity: 120,
        });
      }
    } else {
      const salvage = 5 + item.rank * 8 + Math.round(newScore * 0.12);
      this.wallet += salvage;
      this.addText(this.player.x, this.player.y - 100, `分解 +${salvage}`, {
        color: '#c3cad6',
        size: 16,
        vy: -55,
      });
    }
    this.itemToast = {
      item,
      better,
      diff: newScore - oldScore,
      life: 4.2,
      duration: 4.2,
      old,
    };
  }

  // ---------------------------------------------------------------- waves

  updateWaves(dt) {
    if (this.bossDefeated || this.player.dead) return;
    if (this.waveState === 'intermission') {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) this.startWave();
      return;
    }
    if (this.waveState === 'active') {
      const alive = this.enemies.some((enemy) => !enemy.dead);
      if (!alive) this.clearWave();
    }
  }

  startWave() {
    this.wave += 1;
    this.waveState = 'active';
    const [kicker, title] = WAVE_TITLES[this.wave] || ['妖潮', '无尽的妖'];
    const isBoss = this.wave === 5;
    this.showBanner(kicker, title, isBoss ? '小心它的冲锋与震地' : `第 ${this.wave} / ${this.maxWave} 波`, 2.4, isBoss ? '#ff9d62' : '#f3d59a');
    this.sound.play('wave');
    if (isBoss) this.spawnBossWave();
    else this.spawnWave(this.wave);
  }

  spawnWave(wave) {
    const specs = WAVE_COMPOSITIONS[wave] || ['grunt'];
    const px = this.player.x;
    specs.forEach((kind, index) => {
      const side = index % 2 === 0 ? 1 : -1;
      let x = px + side * (390 + Math.floor(index / 2) * 150);
      x = clamp(x, 90, LEVEL_W - 90);
      if (Math.abs(x - px) < 230) x = clamp(px - side * 380, 90, LEVEL_W - 90);
      this.spawnEnemy(kind, x, {
        hpScale: 1 + (wave - 1) * 0.08,
        damageScale: 1 + (wave - 1) * 0.05,
      });
    });
  }

  spawnBossWave() {
    let x = clamp(this.player.x + 480, 150, LEVEL_W - 150);
    if (Math.abs(x - this.player.x) < 320) x = clamp(this.player.x - 480, 150, LEVEL_W - 150);
    const boss = this.spawnEnemy('boss', x, { hpScale: 1, damageScale: 1 });
    this.boss = boss;
    this.sound.play('boss');
    this.shake(12);
    this.flash('#ff8c5a', 0.25);
  }

  onBossEngaged(boss) {
    if (this.rogueMode || this.bossEngaged) return;
    this.bossEngaged = true;
    this.showBanner('关底妖将', '混世妖将 · 震山', '翻滚闪避它的冲锋，跳起躲开震地', 2.4, '#ff9d62');
    this.sound.play('boss');
    this.shake(10);
    for (let i = 0; i < 26; i += 1) {
      const a = rand(0, Math.PI * 2);
      this.addParticle({
        x: boss.x + Math.cos(a) * rand(20, 100),
        y: boss.y - 80 + Math.sin(a) * rand(20, 100),
        vx: Math.cos(a) * rand(30, 150),
        vy: Math.sin(a) * rand(30, 120) - 60,
        life: rand(0.4, 0.9),
        size: rand(3, 8),
        color: choose(['#ff9a55', '#c5422f', '#ffd27a']),
        kind: 'spark',
        gravity: 100,
      });
    }
  }

  spawnEnemy(kind, x, opts = {}) {
    const enemy = new Enemy(this, kind, x, opts);
    this.enemies.push(enemy);
    for (let i = 0; i < (kind === 'boss' ? 34 : 14); i += 1) {
      this.addParticle({
        x: x + rand(-30, 30),
        y: GROUND_Y - rand(0, 70),
        vx: rand(-90, 90),
        vy: rand(-160, -30),
        life: rand(0.3, 0.8),
        size: rand(4, kind === 'boss' ? 16 : 9),
        color: choose(kind === 'boss' ? ['#7e2c29', '#d57f52', '#40232a'] : ['#4f483f', '#86705d', '#292828']),
        kind: 'dust',
        gravity: 220,
      });
    }
    if (kind === 'boss') {
      this.addParticle({
        x,
        y: GROUND_Y - 6,
        vx: 0,
        vy: 0,
        life: 0.8,
        size: 30,
        color: '#ff8655',
        kind: 'shockwave',
      });
    }
    this.sound.play(kind === 'boss' ? 'boss' : 'ui', 0.4);
    return enemy;
  }

  spawnBossAdds(boss) {
    for (const dir of [-1, 1]) {
      const x = clamp(boss.x + dir * 150, 80, LEVEL_W - 80);
      this.spawnEnemy('grunt', x, { hpScale: 0.75, damageScale: 0.85 });
    }
    this.showToast('妖将召来援兵', '优先清掉小妖，别被围住', '#ffb27a', 2.4);
    this.flash('#ff8255', 0.2);
  }

  clearWave() {
    if (this.wave >= this.maxWave) {
      this.showVictory();
      return;
    }
    this.waveState = 'intermission';
    this.waveTimer = 2.6;
    this.player.heal(Math.round(this.player.maxHp * 0.14), this, true);
    this.pickups.push(new Pickup('heal', this.player.x + rand(-60, 60), GROUND_Y - 100, { value: 0.16 }));
    const bonus = 8 + this.wave * 4;
    this.pickups.push(new Pickup('coin', this.player.x + rand(-25, 25), GROUND_Y - 80, { value: bonus }));
    this.sound.play('heal');
    this.showBanner('妖气暂退', '调息回气，准备下一波', '已恢复少量气血', 1.9, '#8ce2b0');
  }

  // ---------------------------------------------------------------- effects

  spawnJumpDust(player) {
    for (let i = 0; i < 7; i += 1) {
      this.addParticle({
        x: player.x + rand(-18, 18),
        y: GROUND_Y - 2,
        vx: rand(-70, 70),
        vy: rand(-50, -10),
        life: rand(0.25, 0.45),
        size: rand(3, 6),
        color: '#a98d72',
        kind: 'dust',
      });
    }
  }

  spawnDoubleJump(player) {
    this.addParticle({
      x: player.x,
      y: player.y - 8,
      vx: 0,
      vy: 0,
      life: 0.35,
      size: 18,
      color: '#ffd57d',
      kind: 'ring',
      line: 2,
    });
    for (let i = 0; i < 10; i += 1) {
      const a = rand(0, Math.PI * 2);
      this.addParticle({
        x: player.x + Math.cos(a) * 12,
        y: player.y - 12 + Math.sin(a) * 6,
        vx: Math.cos(a) * rand(50, 130),
        vy: Math.sin(a) * rand(20, 70) + 30,
        life: rand(0.2, 0.4),
        size: rand(2, 4),
        color: choose(['#ffe4a2', '#ffc566']),
        kind: 'spark',
      });
    }
  }

  spawnLandDust(player, impactSpeed) {
    const count = clamp(Math.round(impactSpeed / 45), 6, 18);
    for (let i = 0; i < count; i += 1) {
      const dir = i % 2 === 0 ? -1 : 1;
      this.addParticle({
        x: player.x + rand(-16, 16),
        y: GROUND_Y - 2,
        vx: dir * rand(20, 120),
        vy: rand(-90, -20),
        life: rand(0.25, 0.55),
        size: rand(3, 7),
        color: '#a98d72',
        kind: 'dust',
      });
    }
  }

  // ---------------------------------------------------------------- render

  draw() {
    const ctx = this.ctx;
    const dpr = this.dpr || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    drawBackground(ctx, this.camera, this.time);
    this.drawAmbientBack(ctx);

    ctx.save();
    ctx.translate(-this.camera.x + this.camera.sx, this.camera.sy);
    for (const pickup of this.pickups) pickup.draw(ctx, this.time);
    const sorted = [...this.enemies].sort((a, b) => a.y - b.y);
    for (const enemy of sorted) enemy.draw(ctx, this, this.time);
    this.player.draw(ctx, this, this.time);
    for (const proj of this.projectiles) proj.draw(ctx);
    for (const particle of this.particles) particle.draw(ctx);
    for (const text of this.texts) text.draw(ctx);
    ctx.restore();

    this.drawAmbientFront(ctx);
    drawVignette(ctx, this.player.hp / this.player.maxHp < 0.3 ? 1 : 0);
    if (this.screenFlash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = this.screenFlash * 0.45;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.restore();
    }
    if (this.damageFlash > 0) {
      ctx.save();
      ctx.globalAlpha = 0.3 * this.damageFlash;
      ctx.drawImage(this.damageOverlay, 0, 0);
      ctx.restore();
    }
    if (this.player.ultActive) drawFocusLines(ctx, 0.9, '#ffd578');

    if (this.phase === 'title') {
      this.drawTitleScreen(ctx);
    } else {
      this.drawHUD(ctx);
      if (this.phase === 'paused') this.drawPause(ctx);
      if (this.phase === 'bossCleared') this.drawBossContinue(ctx);
      if (this.phase === 'gameover') this.drawGameOver(ctx);
      if (this.phase === 'victory') this.drawVictory(ctx);
    }
  }

  drawAmbientBack(ctx) {
    for (const p of this.ambientPetals) {
      if (p.y < VIEW_H * 0.55) continue;
      this.drawPetal(ctx, p);
    }
    for (const mote of this.ambientMotes) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = mote.alpha * (0.6 + Math.sin(this.time * 2 + mote.phase) * 0.4);
      ctx.fillStyle = '#ffdca0';
      ctx.beginPath();
      ctx.arc(mote.x, mote.y, mote.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawAmbientFront(ctx) {
    for (const p of this.ambientPetals) {
      if (p.y >= VIEW_H * 0.55) continue;
      this.drawPetal(ctx, p);
    }
  }

  drawPetal(ctx, p) {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.fillStyle = p.size > 3.7 ? '#e8a6ae' : '#f0c2bc';
    ctx.beginPath();
    ctx.ellipse(0, 0, p.size, p.size * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawHUD(ctx) {
    if (this.touchMode) {
      this.drawMobilePlayerPanel(ctx);
      this.drawMobileTopRight(ctx);
    } else {
      this.drawPlayerPanel(ctx);
      this.drawTopRight(ctx);
    }
    this.drawBossBar(ctx);
    this.drawCombo(ctx);
    if (!this.touchMode) this.drawSkillBar(ctx);
    this.drawBanner(ctx);
    this.drawToast(ctx);
    this.drawItemToast(ctx);
    if (!this.touchMode) {
      drawText(ctx, 'Esc 暂停  ·  M 静音', VIEW_W - 26, VIEW_H - 18, {
        font: `11px ${FONT_UI}`,
        color: 'rgba(220,201,164,0.38)',
        align: 'right',
      });
    }
  }

  drawMobilePlayerPanel(ctx) {
    const x = 14;
    const y = 10;
    const w = 470;
    const h = 92;
    drawPanel(ctx, x, y, w, h, { fill: 'rgba(9,12,20,0.82)', border: 'rgba(219,183,112,0.34)', radius: 8 });
    const cx = x + 50;
    const cy = y + 46;
    ctx.save();
    glow(ctx, cx, cy, 46, '#d8a35e', 0.18);
    ctx.fillStyle = 'rgba(20,18,23,0.96)';
    ctx.beginPath();
    ctx.arc(cx, cy, 33, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(226,190,119,0.64)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(cx, cy, 33, 0, Math.PI * 2);
    ctx.stroke();
    this.drawPortrait(ctx, cx, cy);
    ctx.restore();

    const left = x + 94;
    drawText(ctx, `${this.heroName} · ${this.heroTitle}`, left, y + 23, {
      font: `600 18px ${FONT_TITLE}`,
      color: '#f2e2c0',
    });
    drawText(ctx, `Lv.${this.level}`, x + w - 16, y + 23, {
      font: `600 16px ${FONT_UI}`,
      color: '#e0bd78',
      align: 'right',
    });
    const hpPct = this.player.hp / this.player.maxHp;
    drawBar(ctx, left, y + 31, 354, 23, hpPct, hpPct < 0.3 ? '#e35d4a' : '#d96a45', '#8f2f30', {
      glowColor: '#ff7c4e',
      border: 'rgba(236,205,153,0.28)',
    });
    drawText(ctx, `${Math.ceil(this.player.hp)} / ${this.player.maxHp}`, left + 346, y + 48, {
      font: `700 14px ${FONT_UI}`,
      color: 'rgba(255,238,206,0.9)',
      align: 'right',
    });
    const energyPct = this.player.energy / this.player.maxEnergy;
    drawBar(ctx, left, y + 61, 238, 10, energyPct, '#66d7cb', '#2c6f82', {
      glowColor: '#61e0d2',
      border: 'rgba(105,199,195,0.2)',
    });
    drawText(ctx, `灵力 ${Math.floor(this.player.energy)}`, left + 246, y + 70, {
      font: `12px ${FONT_UI}`,
      color: 'rgba(151,225,216,0.72)',
    });
  }

  drawMobileTopRight(ctx) {
    drawCoin(ctx, VIEW_W - 198, 32, 12, this.time);
    drawText(ctx, `${formatNumber(this.wallet)}`, VIEW_W - 180, 39, {
      font: `700 21px ${FONT_UI}`,
      color: '#f1d18a',
    });
    drawText(ctx, this.rogueMode ? (this.encounterLabel || '十层妖途') : `第 ${Math.max(1, this.wave)} / ${this.maxWave} 波`, VIEW_W - 22, 69, {
      font: `600 15px ${FONT_UI}`,
      color: 'rgba(232,215,183,0.7)',
      align: 'right',
    });
    drawText(ctx, this.sound.muted ? '静音中' : `击杀 ${this.kills}`, VIEW_W - 22, 91, {
      font: `12px ${FONT_UI}`,
      color: 'rgba(221,204,174,0.45)',
      align: 'right',
    });
  }

  drawPlayerPanel(ctx) {
    const x = 24;
    const y = 20;
    const w = 402;
    const h = 132;
    drawPanel(ctx, x, y, w, h, { fill: 'rgba(9,12,20,0.82)', border: 'rgba(219,183,112,0.32)', radius: 8 });

    const cx = x + 58;
    const cy = y + 59;
    ctx.save();
    glow(ctx, cx, cy, 52, '#d8a35e', 0.18);
    ctx.fillStyle = 'rgba(20,18,23,0.96)';
    ctx.beginPath();
    ctx.arc(cx, cy, 37, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(226,190,119,0.64)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(cx, cy, 37, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(226,190,119,0.2)';
    ctx.beginPath();
    ctx.arc(cx, cy, 32, 0, Math.PI * 2);
    ctx.stroke();
    this.drawPortrait(ctx, cx, cy);
    ctx.restore();
    drawText(ctx, `Lv.${this.level}`, cx, y + 116, {
      font: `600 10px ${FONT_UI}`,
      color: '#e0bd78',
      align: 'center',
    });

    const left = x + 110;
    drawText(ctx, `${this.heroName} · ${this.heroTitle}`, left, y + 25, {
      font: `600 14px ${FONT_TITLE}`,
      color: '#f2e2c0',
    });
    drawText(ctx, `修为 ${Math.floor(this.xp)} / ${this.xpNext}`, x + w - 16, y + 25, {
      font: `9px ${FONT_UI}`,
      color: 'rgba(213,191,153,0.5)',
      align: 'right',
    });

    const hpPct = this.player.hp / this.player.maxHp;
    drawBar(ctx, left, y + 36, 274, 19, hpPct, hpPct < 0.3 ? '#e35d4a' : '#d96a45', '#8f2f30', {
      glowColor: '#ff7c4e',
      border: 'rgba(236,205,153,0.28)',
    });
    drawText(ctx, `${Math.ceil(this.player.hp)} / ${this.player.maxHp}`, left + 268, y + 50, {
      font: `600 11px ${FONT_UI}`,
      color: 'rgba(255,238,206,0.9)',
      align: 'right',
    });

    const energyPct = this.player.energy / this.player.maxEnergy;
    drawBar(ctx, left, y + 63, 186, 8, energyPct, '#66d7cb', '#2c6f82', {
      glowColor: '#61e0d2',
      border: 'rgba(105,199,195,0.2)',
    });
    drawText(ctx, `灵力 ${Math.floor(this.player.energy)}`, left + 192, y + 70, {
      font: `9px ${FONT_UI}`,
      color: 'rgba(151,225,216,0.7)',
    });

    const xpPct = this.xp / this.xpNext;
    drawBar(ctx, left, y + 76, 186, 3, xpPct, '#c9a35f', '#7b5e34', {
      border: 'rgba(213,182,124,0.15)',
      radius: 2,
    });
    drawText(ctx, `会心 ${this.stats.crit.toFixed(1)}%`, left + 192, y + 81, {
      font: `9px ${FONT_UI}`,
      color: 'rgba(231,194,124,0.52)',
    });

    let ex = left;
    const gearGlyph = { weapon: '武', head: '冠', chest: '甲', legs: '裈', boots: '履' };
    for (const slot of SLOT_ORDER) {
      const item = this.equipped[slot];
      const color = item?.rarity?.color || '#aeb7c5';
      ctx.save();
      fillRound(ctx, ex, y + 91, 50, 26, 4, 'rgba(5,8,13,0.6)');
      strokeRound(ctx, ex, y + 91, 50, 26, 4, hexToRgba(color, 0.4), 1);
      drawText(ctx, gearGlyph[slot] || '装', ex + 10, y + 108, {
        font: `11px ${FONT_UI}`,
        color: 'rgba(224,208,178,0.62)',
      });
      drawText(ctx, item?.rarity?.name?.slice(0, 1) || '凡', ex + 42, y + 108, {
        font: `9px ${FONT_UI}`,
        color,
        align: 'right',
      });
      ctx.restore();
      ex += 56;
    }
  }

  drawPortrait(ctx, cx, cy) {
    if (this.heroId !== 'wukong') {
      const colors = { tangseng: '#e8ddb5', shaseng: '#7bd4c2', bajie: '#e99b80' };
      const color = colors[this.heroId] || '#e8b45f';
      ctx.save();
      ctx.translate(cx, cy);
      const g = ctx.createRadialGradient(-8, -10, 2, 0, 0, 28);
      g.addColorStop(0, '#2c2620');
      g.addColorStop(1, '#0c0d12');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 25, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(color, 0.65);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = `700 22px ${FONT_TITLE}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.heroName.slice(0, 1), 0, 1);
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.translate(cx, cy - 1);
    ctx.fillStyle = '#d3a070';
    ctx.beginPath();
    ctx.arc(-15, -3, 6, 0, Math.PI * 2);
    ctx.arc(15, -3, 6, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createRadialGradient(3, -5, 2, 0, 0, 24);
    g.addColorStop(0, '#5e3b2c');
    g.addColorStop(1, '#30201d');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e4bb8b';
    ctx.beginPath();
    ctx.ellipse(7, 3, 13, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd26d';
    ctx.beginPath();
    ctx.ellipse(10, -2, 2.4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2c1a14';
    ctx.beginPath();
    ctx.arc(10.5, -2, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e9c36c';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, -1, 21, -2.75, -0.42);
    ctx.stroke();
    ctx.fillStyle = '#f4d078';
    ctx.beginPath();
    ctx.arc(2, -21, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawTopRight(ctx) {
    drawCoin(ctx, VIEW_W - 212, 39, 9, this.time);
    drawText(ctx, `${formatNumber(this.wallet)}`, VIEW_W - 196, 45, {
      font: `700 16px ${FONT_UI}`,
      color: '#f1d18a',
    });
    drawText(ctx, '灵石', VIEW_W - 148, 45, {
      font: `10px ${FONT_UI}`,
      color: 'rgba(225,200,153,0.45)',
    });
    drawText(ctx, this.rogueMode ? (this.encounterLabel || '十层妖途') : `第 ${Math.max(1, this.wave)} / ${this.maxWave} 波`, VIEW_W - 28, 78, {
      font: `600 13px ${FONT_UI}`,
      color: 'rgba(232,215,183,0.72)',
      align: 'right',
    });
    if (this.sound.muted) {
      drawText(ctx, '静音中 · M', VIEW_W - 28, 99, {
        font: `10px ${FONT_UI}`,
        color: 'rgba(230,120,100,0.7)',
        align: 'right',
      });
    } else {
      drawText(ctx, '击杀 ' + this.kills, VIEW_W - 28, 99, {
        font: `10px ${FONT_UI}`,
        color: 'rgba(221,204,174,0.4)',
        align: 'right',
      });
    }
    if (!this.rogueMode) {
      const bestWave = Math.max(this.best.wave, this.wave);
      if (bestWave > 1) {
        drawText(ctx, `最远 ${bestWave} 波`, VIEW_W - 80, 99, {
          font: `10px ${FONT_UI}`,
          color: 'rgba(221,204,174,0.32)',
          align: 'right',
        });
      }
    }
  }

  drawBossBar(ctx) {
    if (!this.boss) return;
    if (this.boss.remove) return;
    const boss = this.boss;
    const mobile = this.touchMode;
    const pct = clamp(boss.hp / boss.maxHp, 0, 1);
    const x = mobile ? 505 : 452;
    const y = mobile ? 22 : 26;
    const w = mobile ? 350 : 380;
    ctx.save();
    drawText(ctx, boss.displayName || '混世妖将', x, y - 6, {
      font: `700 ${mobile ? 18 : 14}px ${FONT_TITLE}`,
      color: '#ffc187',
      shadow: true,
    });
    if (!mobile) {
      drawText(ctx, this.rogueMode ? (this.encounterLabel?.startsWith('第十层') ? '塔前 · 守关者' : '十层妖途 · 凶煞') : '花果山守关', x + w, y - 6, {
        font: `10px ${FONT_UI}`,
        color: 'rgba(255,180,130,0.55)',
        align: 'right',
      });
    }
    drawBar(ctx, x, y, w, mobile ? 14 : 10, pct, '#b53f32', '#5f1f24', {
      glowColor: '#ff6c4b',
      border: 'rgba(255,177,122,0.28)',
      radius: 5,
    });
    ctx.strokeStyle = 'rgba(255,195,132,0.16)';
    for (let i = 1; i < 8; i += 1) {
      const sx = x + (w / 8) * i;
      ctx.beginPath();
      ctx.moveTo(sx, y + 1);
      ctx.lineTo(sx, y + (mobile ? 13 : 9));
      ctx.stroke();
    }
    drawText(ctx, `${Math.max(0, Math.ceil(boss.hp))} / ${boss.maxHp}`, x + w / 2, y + (mobile ? 28 : 22), {
      font: `${mobile ? 11 : 9}px ${FONT_UI}`,
      color: 'rgba(255,206,175,0.5)',
      align: 'center',
    });
    ctx.restore();
  }

  drawCombo(ctx) {
    if (this.combo < 2 || this.comboTimer <= 0) return;
    const x = VIEW_W - 36;
    const y = 306;
    const scale = 1 + this.comboPop * 0.22;
    const hue = this.combo > 30 ? '#ff7a5c' : this.combo > 15 ? '#ffb45e' : '#ffd47d';
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = `800 54px ${FONT_UI}`;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = hexToRgba(hue, 0.18);
    ctx.lineWidth = 13;
    ctx.strokeText(String(this.combo), 0, 0);
    ctx.strokeStyle = 'rgba(8,8,12,0.62)';
    ctx.lineWidth = 5;
    ctx.strokeText(String(this.combo), 0, 0);
    ctx.fillStyle = hue;
    ctx.fillText(String(this.combo), 0, 0);
    ctx.font = `600 13px ${FONT_UI}`;
    ctx.fillStyle = 'rgba(255,226,183,0.72)';
    ctx.fillText('连 击', 0, 36);
    ctx.restore();
  }

  drawSkillBar(ctx) {
    const x = 24;
    const y = 630;
    drawPanel(ctx, x, y, 450, 70, {
      fill: 'rgba(7,10,17,0.76)',
      border: 'rgba(213,177,108,0.24)',
      radius: 7,
      accent: false,
    });
    const bind = this.input.bindings;
    const attackInfo = {
      wukong: { label: '棍击', icon: 'staff' },
      tangseng: { label: '法球', icon: 'orb' },
      shaseng: { label: '铲击', icon: 'shovel' },
      bajie: { label: '耙击', icon: 'rake' },
    }[this.heroId] || { label: '棍击', icon: 'staff' };
    const slots = [
      { key: hudKeyLabel(bind.attack), label: attackInfo.label, cd: 0, cost: 0, color: '#e8c575', icon: attackInfo.icon, ready: true },
      {
        key: hudKeyLabel(bind.heavy),
        label: '破军',
        cd: this.player.heavyCd / 3.4,
        cost: 15,
        color: '#ff9e58',
        icon: 'burst',
        ready: this.player.heavyCd <= 0 && this.player.energy >= 15,
      },
      {
        key: hudKeyLabel(bind.flame),
        label: '烈焰',
        cd: this.player.castCd / 2.3,
        cost: 20,
        color: '#ff7c45',
        icon: 'flame',
        ready: this.player.castCd <= 0 && this.player.energy >= 20,
      },
      {
        key: hudKeyLabel(bind.ult),
        label: '神威',
        cd: 0,
        cost: 100,
        color: '#ffd87b',
        icon: 'ult',
        ready: this.player.energy >= 100,
        charge: this.player.energy / this.player.maxEnergy,
      },
      {
        key: hudKeyLabel(bind.dash),
        label: '闪避',
        cd: this.player.dashCd / 0.7,
        cost: 0,
        color: '#87d8d0',
        icon: 'dash',
        ready: this.player.dashCd <= 0,
      },
    ];
    slots.forEach((slot, i) => {
      const sx = x + 14 + i * 86;
      const sy = y + 9;
      this.drawSkillSlot(ctx, sx, sy, 52, slot);
    });
  }

  drawSkillSlot(ctx, x, y, size, slot) {
    ctx.save();
    const active = slot.ready;
    fillRound(ctx, x, y, size, size, 6, active ? 'rgba(24,25,29,0.9)' : 'rgba(11,13,18,0.88)');
    strokeRound(ctx, x, y, size, size, 6, active ? hexToRgba(slot.color, 0.52) : 'rgba(160,150,130,0.16)', 1);
    if (active) glow(ctx, x + size / 2, y + size / 2, size * 0.9, slot.color, 0.08);
    drawKeycap(ctx, x + 3, y + 3, 16, slot.key, active, slot.color);
    ctx.translate(x + size / 2, y + size / 2 + 2);
    drawSkillIcon(ctx, slot.icon, slot.color, active);
    if (slot.cd > 0) {
      drawRadialCooldown(ctx, -size / 2, -size / 2 - 2, size / 2 + 2, slot.cd);
      drawText(ctx, slot.cd.toFixed(1), 0, 2, {
        font: `700 12px ${FONT_UI}`,
        color: 'rgba(255,255,255,0.72)',
        align: 'center',
        baseline: 'middle',
      });
    }
    if (slot.charge != null && slot.charge < 1) {
      ctx.strokeStyle = 'rgba(255,215,120,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.38, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * slot.charge);
      ctx.stroke();
    }
    ctx.restore();
    drawText(ctx, slot.label, x + size / 2, y + size + 10, {
      font: `10px ${FONT_UI}`,
      color: active ? 'rgba(235,218,186,0.72)' : 'rgba(178,168,150,0.32)',
      align: 'center',
    });
    if (slot.cost > 0) {
      drawText(ctx, String(slot.cost), x + size - 4, y + size - 4, {
        font: `9px ${FONT_UI}`,
        color: active ? 'rgba(255,214,132,0.62)' : 'rgba(190,178,155,0.26)',
        align: 'right',
      });
    }
  }

  drawBanner(ctx) {
    if (!this.banner) return;
    const b = this.banner;
    const p = 1 - b.life / b.duration;
    const fadeIn = clamp(p / 0.12, 0, 1);
    const fadeOut = clamp((1 - p) / 0.22, 0, 1);
    const alpha = Math.min(fadeIn, fadeOut);
    const y = 166;
    ctx.save();
    ctx.globalAlpha = alpha;
    const g = ctx.createLinearGradient(0, y - 20, VIEW_W, y - 20);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.5, 'rgba(8,10,16,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, y - 36, VIEW_W, 96);
    ctx.strokeStyle = hexToRgba(b.color, 0.28);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(VIEW_W / 2 - 220, y - 23);
    ctx.lineTo(VIEW_W / 2 - 40, y - 23);
    ctx.moveTo(VIEW_W / 2 + 40, y - 23);
    ctx.lineTo(VIEW_W / 2 + 220, y - 23);
    ctx.stroke();
    drawText(ctx, b.kicker, VIEW_W / 2, y - 32, {
      font: `600 12px ${FONT_UI}`,
      color: hexToRgba(b.color, 0.7),
      align: 'center',
    });
    drawTitle(ctx, b.title, VIEW_W / 2, y + 4, 38, b.color);
    if (b.sub) {
      drawText(ctx, b.sub, VIEW_W / 2, y + 34, {
        font: `12px ${FONT_UI}`,
        color: 'rgba(229,213,184,0.56)',
        align: 'center',
      });
    }
    ctx.restore();
  }

  drawToast(ctx) {
    if (!this.toast) return;
    const t = this.toast;
    const fade = clamp(t.life / 0.4, 0, 1) * clamp((t.duration - t.life) / 0.15, 0, 1);
    const mobile = this.touchMode;
    ctx.save();
    ctx.globalAlpha = fade;
    const w = mobile ? 430 : 310;
    const h = mobile ? 76 : 58;
    const x = VIEW_W / 2 - w / 2;
    const y = mobile ? 250 : 294;
    drawPanel(ctx, x, y, w, h, {
      fill: 'rgba(8,11,18,0.9)',
      border: hexToRgba(t.color, 0.4),
      radius: 5,
      accent: false,
    });
    drawText(ctx, t.title, x + (mobile ? 20 : 16), y + (mobile ? 30 : 24), {
      font: `700 ${mobile ? 21 : 15}px ${FONT_TITLE}`,
      color: t.color,
    });
    drawText(ctx, t.sub, x + (mobile ? 20 : 16), y + (mobile ? 55 : 43), {
      font: `${mobile ? 15 : 11}px ${FONT_UI}`,
      color: 'rgba(228,211,180,0.58)',
    });
    ctx.restore();
  }

  drawItemToast(ctx) {
    if (!this.itemToast) return;
    const data = this.itemToast;
    const item = data.item;
    const fade = clamp(data.life / 0.4, 0, 1);
    const mobile = this.touchMode;
    const w = mobile ? 430 : 320;
    const h = mobile ? 118 : 96;
    const x = VIEW_W - w - 26;
    const y = 142;
    ctx.save();
    ctx.globalAlpha = fade;
    drawPanel(ctx, x, y, w, h, {
      fill: 'rgba(8,11,18,0.92)',
      border: hexToRgba(item.rarity.color, 0.48),
      radius: 6,
    });
    drawDiamond(ctx, x + (mobile ? 28 : 24), y + (mobile ? 36 : 30), mobile ? 11 : 9, item.rarity.color, item.rarity.color);
    drawText(ctx, `${item.rarity.name} · ${item.name}`, x + (mobile ? 50 : 42), y + (mobile ? 36 : 30), {
      font: `700 ${mobile ? 21 : 16}px ${FONT_TITLE}`,
      color: item.rarity.color,
    });
    drawText(ctx, SLOT_LABEL[item.slot], x + w - (mobile ? 22 : 18), y + (mobile ? 34 : 28), {
      font: `${mobile ? 13 : 10}px ${FONT_UI}`,
      color: 'rgba(223,207,178,0.44)',
      align: 'right',
    });
    const stats = itemStatsText(item);
    drawText(ctx, stats.slice(0, 3).join('   '), x + (mobile ? 24 : 20), y + (mobile ? 67 : 55), {
      font: `${mobile ? 15 : 11}px ${FONT_UI}`,
      color: 'rgba(236,221,192,0.76)',
    });
    drawText(ctx, stats.slice(3).join('   '), x + (mobile ? 24 : 20), y + (mobile ? 87 : 72), {
      font: `${mobile ? 15 : 11}px ${FONT_UI}`,
      color: 'rgba(236,221,192,0.55)',
    });
    drawText(ctx, data.better ? '已自动装备' : '低于当前装备 · 已分解', x + w - (mobile ? 22 : 18), y + (mobile ? 100 : 76), {
      font: `600 ${mobile ? 13 : 10}px ${FONT_UI}`,
      color: data.better ? '#7be0a1' : 'rgba(196,184,162,0.55)',
      align: 'right',
    });
    ctx.restore();
  }

  drawTutorial(ctx) {
    const alpha = clamp(this.tutorialTime / 1.2, 0, 1) * 0.9;
    ctx.save();
    ctx.globalAlpha = alpha;
    const text = '连按 J 打出三段棍法  ·  Shift 闪避有无敌帧  ·  K 破军范围击飞';
    const w = 602;
    const x = VIEW_W / 2 - w / 2;
    const y = 570;
    fillRound(ctx, x, y, w, 34, 17, 'rgba(6,8,14,0.68)');
    strokeRound(ctx, x, y, w, 34, 17, 'rgba(222,188,118,0.2)', 1);
    drawText(ctx, text, VIEW_W / 2, y + 18, {
      font: `12px ${FONT_UI}`,
      color: 'rgba(236,220,189,0.8)',
      align: 'center',
      baseline: 'middle',
    });
    ctx.restore();
  }

  drawPause(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(4,6,11,0.72)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const w = 420;
    const h = 310;
    const x = VIEW_W / 2 - w / 2;
    const y = 220;
    drawPanel(ctx, x, y, w, h, {
      fill: 'rgba(10,13,20,0.96)',
      border: 'rgba(225,186,111,0.4)',
      radius: 8,
    });
    drawTitle(ctx, '暂 停', VIEW_W / 2, y + 54, 44, '#ecd19a');
    drawText(ctx, '花果山的妖气暂时凝滞了', VIEW_W / 2, y + 88, {
      font: `12px ${FONT_UI}`,
      color: 'rgba(222,205,172,0.46)',
      align: 'center',
    });
    const buttons = this.getPauseButtons();
    this.drawButton(ctx, buttons.resume, '继续试炼', this.touchMode ? '点击继续' : `${formatKey(this.input.bindings.pause)} / 点击`, true);
    this.drawButton(ctx, buttons.restart, this.rogueMode ? '结束本局' : '重新开始', this.touchMode ? '点击结束' : 'R', false, 15);
    drawText(ctx, this.rogueMode ? '结束本局会直接回到英雄选择 · 按 B 打开行囊' : '闪避可穿过妖物的攻击 · 装备会自动比较', VIEW_W / 2, 556, {
      font: `${this.touchMode ? 14 : 10}px ${FONT_UI}`,
      color: 'rgba(221,202,165,0.38)',
      align: 'center',
    });
    ctx.restore();
  }

  drawGameOver(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(8,5,8,0.76)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 80, VIEW_W / 2, VIEW_H / 2, 640);
    g.addColorStop(0, 'rgba(90,24,22,0.12)');
    g.addColorStop(1, 'rgba(8,4,7,0.6)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    drawTitle(ctx, '力 竭', VIEW_W / 2, 180, 76, '#e8a07e');
    drawText(ctx, '这一局到此为止。失败没有惩罚，下一局会更顺。', VIEW_W / 2, 236, {
      font: `14px ${FONT_UI}`,
      color: 'rgba(232,206,179,0.56)',
      align: 'center',
    });
    this.drawRunStats(ctx, 300, 288);
    this.drawButton(ctx, this.getResultButton(), '再 战 一 次', this.touchMode ? '点击按钮' : 'R / Enter', true);
    drawText(ctx, `你的最好成绩：第 ${this.best.wave} 波 · 最高 ${this.best.combo} 连击`, VIEW_W / 2, 590, {
      font: `11px ${FONT_UI}`,
      color: 'rgba(221,196,158,0.4)',
      align: 'center',
    });
    ctx.restore();
  }

  drawVictory(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(7,7,10,0.72)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const g = ctx.createRadialGradient(VIEW_W / 2, 300, 40, VIEW_W / 2, 300, 650);
    g.addColorStop(0, 'rgba(146,103,41,0.18)');
    g.addColorStop(1, 'rgba(5,6,10,0.64)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    drawText(ctx, '花果山 · 试炼完成', VIEW_W / 2, 132, {
      font: `600 13px ${FONT_UI}`,
      color: 'rgba(237,204,142,0.68)',
      align: 'center',
    });
    drawTitle(ctx, '大 圣 威 名', VIEW_W / 2, 194, 72, '#ffe2a0');
    drawText(ctx, '妖将伏诛，群妖退散。这一棍，够爽。', VIEW_W / 2, 246, {
      font: `14px ${FONT_UI}`,
      color: 'rgba(239,219,184,0.58)',
      align: 'center',
    });
    this.drawRunStats(ctx, 300, 296);
    this.drawButton(ctx, this.getResultButton(), '再 战 花 果 山', this.touchMode ? '点击按钮' : 'R / Enter', true);
    drawText(ctx, '本原型不含充值、体力、耐久与背包容量限制。', VIEW_W / 2, 590, {
      font: `11px ${FONT_UI}`,
      color: 'rgba(224,198,154,0.4)',
      align: 'center',
    });
    ctx.restore();
  }

  drawRunStats(ctx, x, y) {
    const stats = [
      ['等级', `Lv.${this.level}`],
      ['击杀', this.kills],
      ['最高连击', this.maxCombo],
      ['用时', this.formatTime(this.runTime)],
    ];
    const w = 700;
    drawPanel(ctx, x, y, w, 142, {
      fill: 'rgba(10,12,18,0.76)',
      border: 'rgba(219,181,110,0.2)',
      radius: 6,
      accent: false,
    });
    stats.forEach(([label, value], i) => {
      const cx = x + w / 4 * (i + 0.5);
      drawText(ctx, String(value), cx, y + 42, {
        font: `700 28px ${FONT_UI}`,
        color: i === 2 ? '#ffbf68' : '#efdcb7',
        align: 'center',
        baseline: 'middle',
      });
      drawText(ctx, label, cx, y + 68, {
        font: `11px ${FONT_UI}`,
        color: 'rgba(216,196,161,0.46)',
        align: 'center',
      });
      if (i < 3) {
        ctx.strokeStyle = 'rgba(219,181,110,0.13)';
        ctx.beginPath();
        ctx.moveTo(x + w / 4 * (i + 1), y + 24);
        ctx.lineTo(x + w / 4 * (i + 1), y + 76);
        ctx.stroke();
      }
    });
    ctx.strokeStyle = 'rgba(219,181,110,0.14)';
    ctx.beginPath();
    ctx.moveTo(x + 22, y + 88);
    ctx.lineTo(x + w - 22, y + 88);
    ctx.stroke();
    let gx = x + 30;
    for (const slot of SLOT_ORDER) {
      const item = this.equipped[slot];
      const color = item?.rarity?.color || 'rgba(180,170,150,0.35)';
      drawDiamond(ctx, gx + 4, y + 111, 4, color);
      drawText(ctx, `${SLOT_LABEL[slot]} · ${item?.name || '空'}`, gx + 16, y + 115, {
        font: `10px ${FONT_UI}`,
        color: hexToRgba(color, 0.7),
      });
      gx += 218;
    }
  }

  drawButton(ctx, rect, label, sub, primary = false, textYOffset = 0) {
    const hover = this.pointIn(rect);
    drawPanel(ctx, rect.x, rect.y, rect.w, rect.h, {
      fill: hover || primary ? 'rgba(57,42,31,0.92)' : 'rgba(18,18,22,0.88)',
      border: hover ? 'rgba(245,209,138,0.9)' : 'rgba(217,179,105,0.42)',
      radius: 6,
    });
    if (hover) glow(ctx, rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w * 0.55, '#e5b86a', 0.08);
    drawText(ctx, label, rect.x + rect.w / 2, rect.y + 27 + textYOffset, {
      font: `700 21px ${FONT_TITLE}`,
      color: hover ? '#ffe9bc' : '#e9d09e',
      align: 'center',
      baseline: 'middle',
    });
    drawText(ctx, sub, rect.x + rect.w / 2, rect.y + 48 + textYOffset, {
      font: `10px ${FONT_UI}`,
      color: 'rgba(224,203,166,0.5)',
      align: 'center',
    });
  }

  drawTitleScreen(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(5,7,13,0.46)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, 'rgba(5,7,13,0.5)');
    g.addColorStop(0.44, 'rgba(5,7,13,0.06)');
    g.addColorStop(1, 'rgba(5,7,13,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    drawText(ctx, '花 果 山 · 试 炼 之 地', VIEW_W / 2, 128, {
      font: `500 15px ${FONT_UI}`,
      color: 'rgba(230,202,146,0.78)',
      align: 'center',
    });
    ctx.strokeStyle = 'rgba(224,189,118,0.38)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(VIEW_W / 2 - 210, 148);
    ctx.lineTo(VIEW_W / 2 - 58, 148);
    ctx.moveTo(VIEW_W / 2 + 58, 148);
    ctx.lineTo(VIEW_W / 2 + 210, 148);
    ctx.stroke();
    drawDiamond(ctx, VIEW_W / 2, 148, 4, '#e3bd70');

    const titleGrad = ctx.createLinearGradient(0, 165, 0, 292);
    titleGrad.addColorStop(0, '#fff5d6');
    titleGrad.addColorStop(0.52, '#e8c67e');
    titleGrad.addColorStop(1, '#b27f37');
    ctx.save();
    ctx.font = `800 106px ${FONT_TITLE}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255,156,70,0.3)';
    ctx.shadowBlur = 40;
    ctx.fillStyle = titleGrad;
    ctx.fillText('齐天伏妖录', VIEW_W / 2, 232);
    ctx.restore();

    ctx.strokeStyle = 'rgba(214,168,91,0.45)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(VIEW_W / 2 - 256, 298);
    ctx.quadraticCurveTo(VIEW_W / 2, 305, VIEW_W / 2 + 256, 298);
    ctx.stroke();
    drawText(ctx, '一棍破万法 · 不肝也不氪', VIEW_W / 2, 328, {
      font: `500 18px ${FONT_TITLE}`,
      color: 'rgba(238,221,184,0.78)',
      align: 'center',
    });

    const startRect = { x: VIEW_W / 2 - 142, y: 382, w: 284, h: 64 };
    const hover = this.pointIn(startRect);
    if (hover) glow(ctx, VIEW_W / 2, 414, 190, '#e2b566', 0.13);
    drawPanel(ctx, startRect.x, startRect.y, startRect.w, startRect.h, {
      fill: hover ? 'rgba(68,48,31,0.94)' : 'rgba(20,18,20,0.9)',
      border: hover ? 'rgba(246,211,139,0.88)' : 'rgba(218,179,104,0.5)',
      radius: 6,
    });
    drawText(ctx, '开 始 试 炼', VIEW_W / 2, startRect.y + 29, {
      font: `700 24px ${FONT_TITLE}`,
      color: hover ? '#ffe9bc' : '#e8cd98',
      align: 'center',
      baseline: 'middle',
    });
    drawText(ctx, this.touchMode ? '点击画面开始' : 'Enter / 点击画面', VIEW_W / 2, startRect.y + 49, {
      font: `${this.touchMode ? 14 : 10}px ${FONT_UI}`,
      color: 'rgba(225,206,167,0.48)',
      align: 'center',
      baseline: 'middle',
    });

    if (this.touchMode) {
      drawText(ctx, '左下移动 · 右下连击 / 跳跃 / 闪避 / 技能', VIEW_W / 2, 660, {
        font: `17px ${FONT_UI}`,
        color: 'rgba(238,220,185,0.74)',
        align: 'center',
      });
    } else {
      const controls = [
        ['A D', '移动'],
        ['空格', '二段跳'],
        ['J', '三段棍'],
        ['K', '破军'],
        ['L', '烈焰'],
        ['U', '神威'],
        ['Shift', '闪避'],
      ];
      let totalWidth = 0;
      const gaps = [];
      ctx.font = `12px ${FONT_UI}`;
      for (const [key, label] of controls) {
        const kw = Math.max(30, ctx.measureText(key).width + 14);
        gaps.push({ key, label, kw, lw: ctx.measureText(label).width });
        totalWidth += kw + 8 + ctx.measureText(label).width + 28;
      }
      let cx = VIEW_W / 2 - totalWidth / 2;
      for (const item of gaps) {
        drawKeycap(ctx, cx, 648, 26, item.key, false, '#e6c884');
        drawText(ctx, item.label, cx + item.kw + 8, 665, {
          font: `12px ${FONT_UI}`,
          color: 'rgba(226,210,179,0.62)',
        });
        cx += item.kw + 8 + item.lw + 28;
      }
    }

    drawText(ctx, '装备自动比较 · 自动分解 · 无需管理背包', VIEW_W / 2, 697, {
      font: `${this.touchMode ? 15 : 12}px ${FONT_UI}`,
      color: 'rgba(215,197,162,0.5)',
      align: 'center',
    });
    drawText(ctx, '原型 v0.1 · 浏览器实机', VIEW_W - 28, VIEW_H - 9, {
      font: `9px ${FONT_UI}`,
      color: 'rgba(210,192,158,0.26)',
      align: 'right',
    });
    ctx.restore();
  }

  formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  saveBest() {
    const best = {
      wave: Math.max(this.best.wave, this.wave),
      combo: Math.max(this.best.combo, this.maxCombo),
    };
    this.best = best;
    try {
      localStorage.setItem('qitian-best', JSON.stringify(best));
    } catch {
      /* ignore */
    }
  }

  showGameOver() {
    if (this.phase !== 'playing') return;
    this.phase = 'gameover';
    this.itemToast = null;
    this.toast = null;
    this.banner = null;
    this.saveBest();
    this.sound.play('death', 1.2);
  }

  showVictory() {
    if (this.phase !== 'playing') return;
    this.phase = 'victory';
    this.itemToast = null;
    this.toast = null;
    this.banner = null;
    this.saveBest();
    this.sound.play('levelup', 1.2);
    this.flash('#ffd77a', 0.6);
  }
}

function hudKeyLabel(code) {
  if (!code) return '—';
  if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'KeyC') return '⇧';
  if (code === 'Space') return '跳';
  if (code === 'Escape') return 'Esc';
  return formatKey(code);
}

function drawSkillIcon(ctx, kind, color, active) {
  ctx.save();
  ctx.strokeStyle = active ? color : 'rgba(175,165,148,0.3)';
  ctx.fillStyle = active ? color : 'rgba(175,165,148,0.3)';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  if (kind === 'staff') {
    ctx.rotate(-0.75);
    ctx.beginPath();
    ctx.moveTo(-13, 0);
    ctx.lineTo(13, 0);
    ctx.stroke();
    ctx.fillStyle = active ? '#ffe7ad' : 'rgba(175,165,148,0.3)';
    ctx.beginPath();
    ctx.arc(-13, 0, 3.2, 0, Math.PI * 2);
    ctx.arc(13, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'rake') {
    ctx.rotate(-0.55);
    ctx.beginPath();
    ctx.moveTo(-13, 0);
    ctx.lineTo(11, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(10, -9);
    ctx.lineTo(10, 9);
    ctx.stroke();
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.moveTo(10, -7 + i * 4.8);
      ctx.quadraticCurveTo(17, -4 + i * 4.8, 15, 1 + i * 4.8);
      ctx.stroke();
    }
  } else if (kind === 'shovel') {
    ctx.rotate(-0.65);
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(12, 0);
    ctx.stroke();
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(dir * 12, 0, 8, dir > 0 ? -1.1 : 2.05, dir > 0 ? 1.1 : 4.25);
      ctx.stroke();
    }
  } else if (kind === 'orb') {
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 13, Math.sin(a) * 13);
      ctx.lineTo(Math.cos(a) * 18, Math.sin(a) * 18);
      ctx.stroke();
    }
  } else if (kind === 'burst') {
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 6, Math.sin(a) * 6);
      ctx.lineTo(Math.cos(a) * 15, Math.sin(a) * 15);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.stroke();
  } else if (kind === 'flame') {
    ctx.beginPath();
    ctx.moveTo(0, 15);
    ctx.bezierCurveTo(-15, 3, -7, -8, -1, -16);
    ctx.bezierCurveTo(-2, -4, 8, -8, 7, 2);
    ctx.bezierCurveTo(13, -1, 13, 7, 0, 15);
    ctx.fill();
  } else if (kind === 'ult') {
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.stroke();
    drawDiamond(ctx, 0, 0, 3.5, active ? color : 'rgba(175,165,148,0.3)');
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 16, Math.sin(a) * 16);
      ctx.lineTo(Math.cos(a) * 20, Math.sin(a) * 20);
      ctx.stroke();
    }
  } else if (kind === 'dash') {
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(-16 + i * 6, -8 + i * 8);
      ctx.quadraticCurveTo(-2, -9 + i * 7, 13, -5 + i * 7);
      ctx.stroke();
    }
  }
  ctx.restore();
}
