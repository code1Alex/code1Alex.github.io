import { HEROES, WEAPONS, ARMOR, ITEMS, MONSTERS, EVENTS, ARMOR_SETS, SLOTS, MAP_NODE_TYPES, FINAL_BOSS } from './data.js';
import { generateMap, makeSeed, starterLoadout, makeRewardOptions, makeShopOffers, buildEncounter, pickEvent, hydrateConsumable, equipmentPrice } from './rogue.js';
import { hydrateItem, itemScore, formatNumber, RARITIES } from './core.js';
import { heroArt, bossArt, itemCard, nodeGlyph, nodeColor, formatKey, rankColor, statLine } from './ui.js';
import { DEFAULT_BINDINGS, ACTION_LABELS } from './input.js';

const SETTINGS_KEY = 'qitian-settings-v3';
const PROGRESS_KEY = 'qitian-progress-v3';

const DEFAULT_SETTINGS = {
  music: 0.7,
  sfx: 0.8,
  screenShake: true,
  effects: 'high',
  bindings: { ...DEFAULT_BINDINGS },
};

const DEFAULT_PROGRESS = {
  unlocked: ['wukong'],
  runs: 0,
  completions: 0,
};

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return structuredClone(fallback);
    return JSON.parse(raw);
  } catch {
    return structuredClone(fallback);
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export class App {
  constructor(game, input, sound) {
    this.game = game;
    this.input = input;
    this.sound = sound;
    this.frame = document.getElementById('frame');
    this.root = document.getElementById('screen-root');
    this.progress = { ...DEFAULT_PROGRESS, ...loadJson(PROGRESS_KEY, DEFAULT_PROGRESS) };
    if (!Array.isArray(this.progress.unlocked) || !this.progress.unlocked.includes('wukong')) {
      this.progress.unlocked = ['wukong'];
    }
    const savedSettings = loadJson(SETTINGS_KEY, DEFAULT_SETTINGS);
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...savedSettings,
      bindings: { ...DEFAULT_BINDINGS, ...(savedSettings.bindings || {}) },
    };
    this.screen = 'menu';
    this.run = null;
    this.selectedHero = 'wukong';
    this.codexSlot = 'weapon';
    this.bindingAction = null;
    this.noticeTimer = null;
    this.endTimer = null;
    this.pendingNode = null;
    this.currentEvent = null;
    this.shopOffers = null;
    this.rewardOptions = null;
    this.battleNode = null;
    this.applySettings();
    this.bindEvents();
    this.game.phase = 'meta';
    this.renderMenu();
  }

  applySettings() {
    this.sound.setMusicVolume(this.settings.music);
    this.sound.setSfxVolume(this.settings.sfx);
    this.input.setBindings(this.settings.bindings);
    this.game.settings.screenShake = this.settings.screenShake !== false;
    this.game.effectsQuality = this.settings.effects || 'high';
    const hint = document.getElementById('page-hint');
    if (hint) {
      const b = this.settings.bindings;
      hint.textContent = `${formatKey(b.left)} / ${formatKey(b.right)} 移动 · ${formatKey(b.jump)} 二段跳 · ${formatKey(b.attack)} 连击 · ${formatKey(b.heavy)} 破军 · ${formatKey(b.flame)} 烈焰 · ${formatKey(b.ult)} 神威 · ${formatKey(b.dash)} 闪避`;
    }
    if (!this.game.ambientPetals) return;
    const count = this.game.effectsQuality === 'low' ? 10 : this.game.effectsQuality === 'medium' ? 17 : 26;
    if (this.game.ambientPetals.length > count) this.game.ambientPetals.length = count;
    while (this.game.ambientPetals.length < count) this.game.ambientPetals.push(this.game.makePetal(true));
  }

  saveSettings() {
    saveJson(SETTINGS_KEY, this.settings);
    this.applySettings();
  }

  saveProgress() {
    saveJson(PROGRESS_KEY, this.progress);
  }

  bindEvents() {
    this.root.addEventListener('click', (event) => this.onClick(event));
    this.root.addEventListener('input', (event) => this.onInput(event));
    window.addEventListener('pointerdown', () => {
      this.sound.init();
      this.sound.startMusic();
    }, { once: true });
    window.addEventListener('keydown', (event) => {
      if (this.bindingAction) {
        event.preventDefault();
        event.stopPropagation();
        this.captureBinding(event);
        return;
      }
      if (event.code === 'Escape') {
        if (this.screen === 'hero' || this.screen === 'codex' || this.screen === 'settings') {
          event.preventDefault();
          this.renderMenu();
        } else if (this.screen === 'node') {
          event.preventDefault();
          this.renderMap();
        }
      }
    }, true);
  }

  onClick(event) {
    event.preventDefault();
    const target = event.target.closest('button, [data-node], [data-reward], [data-choice]');
    if (!target) return;
    this.sound.init();
    this.sound.startMusic();
    if (target.dataset.nav) {
      this.sound.play('ui');
      if (target.dataset.nav === 'start') this.renderHeroSelect();
      if (target.dataset.nav === 'codex') this.renderCodex();
      if (target.dataset.nav === 'settings') this.renderSettings();
      return;
    }
    if (target.dataset.back) {
      this.sound.play('ui');
      if (target.dataset.back === 'menu') this.renderMenu();
      if (target.dataset.back === 'hero') this.renderHeroSelect();
      return;
    }
    if (target.dataset.heroCard) {
      this.selectHero(target.dataset.heroCard);
      return;
    }
    if (target.dataset.startRun != null) {
      this.startRun();
      return;
    }
    if (target.dataset.codexSlot) {
      this.codexSlot = target.dataset.codexSlot;
      this.renderCodex();
      return;
    }
    if (target.dataset.quality) {
      this.settings.effects = target.dataset.quality;
      this.saveSettings();
      this.renderSettings();
      return;
    }
    if (target.dataset.toggleShake != null) {
      this.settings.screenShake = !this.settings.screenShake;
      this.saveSettings();
      this.renderSettings();
      return;
    }
    if (target.dataset.fullscreen != null) {
      this.toggleFullscreen();
      return;
    }
    if (target.dataset.keybind) {
      this.bindingAction = target.dataset.keybind;
      this.renderSettings();
      return;
    }
    if (target.dataset.resetKeys != null) {
      this.settings.bindings = { ...DEFAULT_BINDINGS };
      this.saveSettings();
      this.renderSettings();
      return;
    }
    if (target.dataset.node) {
      this.openNode(target.dataset.node);
      return;
    }
    if (target.dataset.nodeClose != null) {
      this.renderMap();
      return;
    }
    if (target.dataset.fight != null) {
      this.startBattle(this.pendingNode, this.pendingEncounter);
      return;
    }
    if (target.dataset.choice != null) {
      this.resolveEventChoice(Number(target.dataset.choice));
      return;
    }
    if (target.dataset.eventContinue != null) {
      this.completeNode(this.pendingNode);
      return;
    }
    if (target.dataset.shopBuy != null) {
      this.buyShopOffer(Number(target.dataset.shopBuy));
      return;
    }
    if (target.dataset.shopLeave != null) {
      this.completeNode(this.pendingNode);
      return;
    }
    if (target.dataset.tavernHeal != null) {
      this.tavernHeal();
      return;
    }
    if (target.dataset.tavernUpgrade != null) {
      this.renderUpgradeChoices();
      return;
    }
    if (target.dataset.upgradeSlot) {
      this.upgradeGear(target.dataset.upgradeSlot);
      return;
    }
    if (target.dataset.reward != null) {
      this.claimReward(Number(target.dataset.reward));
      return;
    }
    if (target.dataset.useItem != null) {
      this.useItem(Number(target.dataset.useItem));
      return;
    }
    if (target.dataset.returnMenu != null) {
      this.returnToMenu();
      return;
    }
    if (target.dataset.newRun != null) {
      this.renderHeroSelect();
      return;
    }
  }

  onInput(event) {
    const input = event.target;
    if (input.dataset.volume) {
      const value = Number(input.value) / 100;
      this.settings[input.dataset.volume] = value;
      if (input.dataset.volume === 'music') this.sound.setMusicVolume(value);
      if (input.dataset.volume === 'sfx') this.sound.setSfxVolume(value);
      const label = input.parentElement.querySelector('.range-value');
      if (label) label.textContent = `${input.value}%`;
      saveJson(SETTINGS_KEY, this.settings);
    }
  }

  captureBinding(event) {
    if (event.code === 'Escape') {
      this.bindingAction = null;
      this.renderSettings();
      return;
    }
    const action = this.bindingAction;
    const duplicate = Object.entries(this.settings.bindings).find(([other, code]) => other !== action && code === event.code);
    if (duplicate) {
      this.notify(`这个按键已绑定给「${ACTION_LABELS[duplicate[0]]}」`);
      return;
    }
    this.settings.bindings[action] = event.code;
    this.bindingAction = null;
    this.saveSettings();
    this.renderSettings();
    this.notify(`「${ACTION_LABELS[action]}」已改为 ${formatKey(event.code)}`);
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => this.notify('当前浏览器不允许全屏'));
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }

  notify(text) {
    let el = this.frame.querySelector('.ui-notice');
    if (!el) {
      el = document.createElement('div');
      el.className = 'ui-notice';
      this.frame.appendChild(el);
    }
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  clearNotice() {
    const el = this.frame.querySelector('.ui-notice');
    if (el) el.remove();
    clearTimeout(this.noticeTimer);
  }

  show(html, screen) {
    this.clearNotice();
    this.screen = screen;
    this.game.phase = 'meta';
    document.body.classList.add('in-meta');
    document.body.classList.remove('in-battle');
    this.root.classList.add('active');
    this.root.innerHTML = `<section class="screen screen-${screen}">${html}</section>`;
    this.root.scrollTop = 0;
  }

  hideScreens() {
    this.root.classList.remove('active');
    this.root.innerHTML = '';
    document.body.classList.remove('in-meta');
    document.body.classList.add('in-battle');
  }

  renderMenu() {
    this.run = null;
    const unlocked = this.progress.unlocked.length;
    const html = `
      <div class="menu-scene">
        <div class="menu-veil"></div>
        <div class="menu-hero">${heroArt('wukong')}</div>
        <div class="menu-grain"></div>
        <div class="menu-left">
          <div class="menu-kicker">SHI TU · LUN HUI</div>
          <h1 class="menu-title">齐天伏妖录</h1>
          <p class="menu-poem">一棍扫尽十万妖<br>十层轮回，终局无相</p>
          <nav class="menu-list" aria-label="主菜单">
            <button class="menu-item" data-nav="start"><span class="menu-index">壹</span><span class="menu-label">开始游戏</span><span class="menu-note">踏入十层轮回</span></button>
            <button class="menu-item" data-nav="codex"><span class="menu-index">贰</span><span class="menu-label">百科</span><span class="menu-note">装备 · 道具 · 妖物</span></button>
            <button class="menu-item" data-nav="settings"><span class="menu-index">叁</span><span class="menu-label">设定</span><span class="menu-note">音量 · 画面 · 键位</span></button>
          </nav>
          <div class="menu-meta">
            <span>轮回 ${this.progress.runs} 次</span>
            <span>已解锁 ${unlocked} / 4</span>
            <span>v0.2 · 十层试炼</span>
          </div>
        </div>
        <div class="menu-seal">无相</div>
      </div>`;
    this.show(html, 'menu');
  }

  renderHeroSelect() {
    const selected = HEROES.find((hero) => hero.id === this.selectedHero) || HEROES[0];
    const unlocked = new Set(this.progress.unlocked);
    const cards = HEROES.map((hero) => {
      const locked = !unlocked.has(hero.id);
      const active = hero.id === selected.id;
      const lockNote = hero.id === 'tangseng' ? '结束一局解锁' : hero.id === 'shaseng' ? '唐僧一局解锁' : '抵达终局解锁';
      return `<button class="hero-card ${locked ? 'locked' : ''} ${active ? 'selected' : ''}" data-hero-card="${hero.id}" style="--hero-color:${hero.color};--hero-dark:${hero.dark};--hero-accent:${hero.accent}">
        <span class="hero-card-inner">
          <span class="hero-card-num">0${hero.order}</span>
          <span class="hero-card-name">${hero.name}</span>
          <span class="hero-card-title">${hero.title}</span>
          <span class="hero-card-state">${locked ? lockNote : active ? '当前选择' : '可选择'}</span>
        </span>
      </button>`;
    }).join('');
    const lockedReason = (() => {
      if (unlocked.has(selected.id)) return '';
      if (selected.id === 'tangseng') return '完成任意一局后解锁';
      if (selected.id === 'shaseng') return '使用唐僧完成一局后解锁';
      return '抵达第十层终局后解锁';
    })();
    const canStart = unlocked.has(selected.id);
    const html = `
      <div class="hero-stage">
        <div class="hero-backdrop" data-hero="${selected.id}">${heroArt(selected.id)}</div>
        <div class="hero-fade"></div>
        <button class="back-btn" data-back="menu">← 返回</button>
        <div class="hero-copy">
          <div class="hero-eyebrow">英 雄 选 择 · ${selected.order} / 4</div>
          <h2 style="--hero-color:${selected.color}">${selected.name}</h2>
          <p class="hero-title" style="--hero-color:${selected.color}">${selected.title} · ${selected.subtitle}</p>
          <p class="hero-desc">${selected.desc}</p>
          <p class="hero-passive"><span>本命</span>${selected.passive}</p>
          ${lockedReason ? `<p class="hero-locked">${lockedReason}</p>` : ''}
        </div>
        <div class="hero-bottom">
          <div class="hero-strip-wrap">
            <div class="hero-strip">${cards}</div>
          </div>
          <div class="hero-actions">
            <span class="seed-hint">每一局的路线、事件、奖励都会重新生成</span>
            <button class="primary-btn" data-start-run ${canStart ? '' : 'disabled'}>${canStart ? '开始轮回' : '尚未解锁'}</button>
          </div>
        </div>
      </div>`;
    this.show(html, 'hero');
  }

  selectHero(id) {
    const unlocked = this.progress.unlocked.includes(id);
    const hero = HEROES.find((h) => h.id === id);
    if (!unlocked) {
      if (id === 'tangseng') this.notify('先完成任意一局，唐僧才会踏上轮回');
      else if (id === 'shaseng') this.notify('用唐僧完成一局，沙悟净才会加入');
      else this.notify('抵达第十层终局后，猪八戒才会出现');
      return;
    }
    this.selectedHero = id;
    this.sound.play('ui');
    this.renderHeroSelect();
  }

  startRun() {
    const hero = HEROES.find((h) => h.id === this.selectedHero);
    if (!hero || !this.progress.unlocked.includes(hero.id)) return;
    const seed = makeSeed();
    const loadout = starterLoadout(hero.id);
    this.game.setupRogueRun(hero, loadout);
    this.run = {
      style: 'rogue',
      seed,
      heroId: hero.id,
      map: generateMap(seed),
      available: [],
      floor: 0,
      currentNode: null,
      items: [],
      rewardsTaken: 0,
      shopSeed: 0,
      eventSeed: 0,
      finished: false,
      reachedEnd: false,
      nextGuard: 0,
    };
    this.run.available = [...this.run.map.start];
    this.pendingNode = null;
    this.pendingEncounter = null;
    this.sound.play('wave');
    this.renderMap();
  }

  renderCodex() {
    const slot = this.codexSlot;
    const weaponList = WEAPONS;
    const armorList = ARMOR.filter((item) => item.slot === slot);
    const equipment = slot === 'weapon' ? weaponList : armorList;
    const equipmentHtml = equipment
      .map((item) => {
        const meta = slot === 'weapon' ? '' : `<div class="data-card-foot">${item.setName || ''} · 本命 ${item.favored ? HEROES.find((h) => h.id === item.favored)?.name || '通用' : '通用'} · 本命穿戴属性 +15%</div>`;
        return itemCard({ ...item, rarity: RARITIES[item.rank || 0], kind: 'equipment' }, meta);
      })
      .join('');
    const itemHtml = ITEMS.map((item) => itemCard({ ...item, rarity: { name: '奇物', color: '#d9c18b' }, kind: 'item' })).join('');
    const monsterHtml = [...MONSTERS, { ...FINAL_BOSS, floor: '终局', elite: true, desc: FINAL_BOSS.desc }].map((monster) => {
      const floorLabel = monster.id === 'final' ? '终局' : `${monster.floor} 层`;
      return `<article class="monster-card ${monster.elite ? 'elite' : ''}">
        <div class="monster-head"><strong>${monster.name}</strong><span>${monster.elite ? '精英 / 首领' : '妖物'} · ${floorLabel}</span></div>
        <p>${monster.desc}</p>
      </article>`;
    }).join('');
    const tabs = SLOTS.map(
      (s) => `<button class="codex-tab ${slot === s.id ? 'active' : ''}" data-codex-slot="${s.id}">${s.name}</button>`
    ).join('');
    const html = `
      <div class="codex-screen">
        <header class="screen-head">
          <button class="back-btn" data-back="menu">← 返回</button>
          <div><p class="screen-kicker">THE BESTIARY</p><h2>百 科</h2></div>
          <div class="head-note">装备 · 道具 · 妖物</div>
        </header>
        <div class="codex-grid">
          <section class="codex-panel">
            <div class="panel-title"><span>壹</span><h3>装备</h3><small>${equipment.length} 件</small></div>
            <div class="codex-tabs">${tabs}</div>
            <div class="codex-scroll">${equipmentHtml}</div>
          </section>
          <section class="codex-panel">
            <div class="panel-title"><span>贰</span><h3>道具</h3><small>${ITEMS.length} 件</small></div>
            <div class="codex-scroll">${itemHtml}</div>
          </section>
          <section class="codex-panel">
            <div class="panel-title"><span>叁</span><h3>妖物</h3><small>${MONSTERS.length + 1} 种</small></div>
            <div class="codex-scroll">${monsterHtml}</div>
          </section>
        </div>
      </div>`;
    this.show(html, 'codex');
  }

  renderSettings() {
    const bindings = this.settings.bindings;
    const keyRows = Object.keys(DEFAULT_BINDINGS)
      .map((action) => {
        const active = this.bindingAction === action;
        return `<div class="key-row">
          <span class="key-action">${ACTION_LABELS[action]}</span>
          <button class="key-button ${active ? 'listening' : ''}" data-keybind="${action}">${active ? '按下新键…' : formatKey(bindings[action])}</button>
        </div>`;
      })
      .join('');
    const html = `
      <div class="settings-screen">
        <header class="screen-head">
          <button class="back-btn" data-back="menu">← 返回</button>
          <div><p class="screen-kicker">PREFERENCES</p><h2>设 定</h2></div>
          <div class="head-note">设置会自动保存</div>
        </header>
        <div class="settings-body">
          <div class="settings-main">
            <section class="settings-panel">
              <div class="panel-title"><span>壹</span><h3>声音</h3></div>
              <label class="range-row">
                <span>游戏音量</span>
                <input type="range" min="0" max="100" value="${Math.round(this.settings.music * 100)}" data-volume="music">
                <b class="range-value">${Math.round(this.settings.music * 100)}%</b>
              </label>
              <label class="range-row">
                <span>音效音量</span>
                <input type="range" min="0" max="100" value="${Math.round(this.settings.sfx * 100)}" data-volume="sfx">
                <b class="range-value">${Math.round(this.settings.sfx * 100)}%</b>
              </label>
            </section>
            <section class="settings-panel">
              <div class="panel-title"><span>贰</span><h3>视频设置</h3></div>
              <div class="setting-row"><span>画面震动</span><button class="toggle ${this.settings.screenShake ? 'on' : ''}" data-toggle-shake>${this.settings.screenShake ? '开' : '关'}</button></div>
              <div class="setting-row"><span>特效强度</span><div class="segmented">
                ${['high', 'medium', 'low'].map((q) => `<button class="${this.settings.effects === q ? 'active' : ''}" data-quality="${q}">${q === 'high' ? '高' : q === 'medium' ? '中' : '低'}</button>`).join('')}
              </div></div>
              <div class="setting-row"><span>全屏</span><button class="key-button" data-fullscreen>切换全屏</button></div>
            </section>
            <section class="settings-panel key-panel">
              <div class="panel-title"><span>叁</span><h3>键盘键位</h3><button class="text-btn" data-reset-keys>恢复默认</button></div>
              <p class="setting-hint">单击键位后，按下新的按键。Esc 取消。所有键位会自动保存。</p>
              <div class="key-grid">${keyRows}</div>
            </section>
          </div>
          <aside class="settings-aside">
            <p class="aside-verse">心猿归正<br>六贼无踪</p>
            <p>鼠标左键也可以普攻。手机横屏时，移动与技能按钮会出现在画面两侧，不覆盖战斗区域。</p>
            <div class="settings-mark">齐天</div>
          </aside>
        </div>
      </div>`;
    this.show(html, 'settings');
  }

  renderMap() {
    if (!this.run) return this.renderMenu();
    const run = this.run;
    const map = run.map;
    const available = new Set(run.available);
    const yOf = (floor) => 92 - (floor - 1) * 8.4;
    const xOf = (node) => (node.count === 1 ? 50 : 20 + node.col * 30);
    const edges = [];
    for (const node of map.nodes.values()) {
      for (const nextId of node.next) {
        const next = map.nodes.get(nextId);
        edges.push(
          `<line class="${node.completed && available.has(nextId) ? 'active' : ''}" x1="${xOf(node)}" y1="${yOf(node.floor)}" x2="${xOf(next)}" y2="${yOf(next.floor)}" />`
        );
      }
    }
    const nodes = [...map.nodes.values()]
      .map((node) => {
        const isAvailable = available.has(node.id);
        const classes = [
          'map-node',
          `node-${node.type}`,
          node.completed ? 'completed' : '',
          isAvailable ? 'available' : '',
          run.currentNode?.id === node.id ? 'current' : '',
        ].join(' ');
        return `<button class="${classes}" data-node="${node.id}" style="left:${xOf(node)}%;top:${yOf(node.floor)}%;--node-color:${nodeColor(node.type)}" ${isAvailable ? '' : 'disabled'}>
          <span class="map-node-glyph">${node.completed ? '✓' : nodeGlyph(node.type)}</span>
          <span class="map-node-label">${node.completed ? '已过' : MAP_NODE_TYPES[node.type].label}</span>
        </button>`;
      })
      .join('');
    const floors = Array.from({ length: 10 }, (_, index) => {
      const floor = index + 1;
      return `<span class="floor-tag" style="top:${yOf(floor)}%">${String(floor).padStart(2, '0')}</span>`;
    }).join('');
    const gearHtml = Object.entries(this.game.equipped)
      .map(([slot, item]) => {
        const color = item.rarity?.color || rankColor(item.rank);
        return `<div class="gear-line"><span class="gear-slot">${SLOTS.find((s) => s.id === slot)?.name || slot}</span><span class="gear-name" style="color:${color}">${item.name}</span><span class="gear-rank">${item.rarity?.name || RARITIES[item.rank || 0].name}</span></div>`;
      })
      .join('');
    const itemHtml = run.items.length
      ? run.items.map((item, index) => `<div class="bag-line"><span>${item.name}</span><button class="text-btn" data-use-item="${index}">使用</button></div>`).join('')
      : '<p class="empty-hint">行囊空空。回血只能靠道具、事件或酒馆。</p>';
    const hpPct = Math.max(0, Math.min(1, this.game.player.hp / this.game.player.maxHp));
    const html = `
      <div class="map-screen">
        <header class="map-head">
          <div class="map-heading">
            <p class="screen-kicker">THE TENFOLD PATH</p>
            <h2>十层妖途 <small>第 ${Math.max(1, run.floor)} / 10 层</small></h2>
          </div>
          <div class="map-resources">
            <div class="resource-hp"><span>气血</span><i><em style="width:${hpPct * 100}%"></em></i><b>${Math.ceil(this.game.player.hp)} / ${this.game.player.maxHp}</b></div>
            <div class="resource-coin">灵石 <b>${formatNumber(this.game.wallet)}</b></div>
            <div class="resource-seed">种子 <b>${run.seed}</b></div>
          </div>
        </header>
        <div class="map-body">
          <div class="map-sheet">
            <div class="map-mist"></div>
            <svg class="map-edges" viewBox="0 0 100 100" preserveAspectRatio="none">${edges.join('')}</svg>
            ${floors}
            ${nodes}
            <div class="map-legend">
              <span><i class="dot battle"></i>妖径</span><span><i class="dot elite"></i>凶煞</span><span><i class="dot event"></i>未知</span><span><i class="dot shop"></i>妖市</span><span><i class="dot tavern"></i>酒馆</span><span><i class="dot boss"></i>终局</span>
            </div>
          </div>
          <aside class="map-side">
            <div class="side-hero">
              <div class="side-portrait" style="--hero-color:${HEROES.find((h) => h.id === run.heroId).color}">${HEROES.find((h) => h.id === run.heroId).name.slice(0, 1)}</div>
              <div><p>${HEROES.find((h) => h.id === run.heroId).title}</p><h3>${HEROES.find((h) => h.id === run.heroId).name}</h3></div>
            </div>
            <div class="side-section"><div class="side-title">随身装备</div>${gearHtml}</div>
            <div class="side-section"><div class="side-title">行囊</div>${itemHtml}</div>
            <div class="side-section side-note"><p>战斗结束后不会回血。</p><p>路线只能向前，选择后不可回头。</p></div>
          </aside>
        </div>
      </div>`;
    this.show(html, 'map');
  }

  openNode(id) {
    const node = this.run?.map.nodes.get(id);
    if (!node || !this.run.available.includes(id)) return;
    this.pendingNode = node;
    this.run.currentNode = node;
    this.run.shopSeed = node.id;
    this.run.eventSeed = node.id;
    if (node.type === 'boss') {
      this.showEnding();
      return;
    }
    if (node.type === 'battle' || node.type === 'elite') {
      this.pendingEncounter = buildEncounter(this.run, node);
      this.renderBattlePrep(node, this.pendingEncounter);
      return;
    }
    if (node.type === 'event') {
      this.currentEvent = pickEvent(this.run, node.floor);
      this.renderEvent(node);
      return;
    }
    if (node.type === 'shop') {
      this.shopOffers = makeShopOffers(this.run, node.floor);
      this.renderShop(node);
      return;
    }
    if (node.type === 'tavern') this.renderTavern(node);
  }

  renderBattlePrep(node, encounter) {
    const names = encounter.specs
      .map((spec) => `<div class="enemy-chip ${spec.boss ? 'elite' : ''}"><span>${spec.boss ? '煞' : '妖'}</span><b>${spec.name}</b><small>${spec.boss ? '精英' : '小妖'}</small></div>`)
      .join('');
    const html = `
      <div class="node-modal-wrap">
        <div class="node-modal">
          <p class="screen-kicker">${node.type === 'elite' ? 'ELITE ENCOUNTER' : 'ENCOUNTER'} · 第 ${node.floor} 层</p>
          <h2>${node.type === 'elite' ? '凶 煞 拦 路' : '妖 气 逼 近'}</h2>
          <p class="node-copy">${node.type === 'elite' ? '这不是普通的小妖。打赢它，才有资格继续向第十层走。' : '山道上的妖物已经闻到生人的气味。它们不会让你轻易过去。'}</p>
          <div class="enemy-row">${names}</div>
          <div class="node-warning">战斗结束后<span>不会自动回复气血</span>。</div>
          <div class="node-actions">
            <button class="ghost-btn" data-node-close>返回路线</button>
            <button class="primary-btn" data-fight>进入战斗</button>
          </div>
        </div>
      </div>`;
    this.show(html, 'node');
  }

  startBattle(node, encounter) {
    this.battleNode = node;
    this.screen = 'battle';
    this.hideScreens();
    if (this.run) this.run.floor = node.floor;
    const guard = this.run?.nextGuard || 0;
    if (this.run) this.run.nextGuard = 0;
    this.game.startEncounter({
      specs: encounter.specs,
      label: encounter.label,
      battleGuard: guard,
      onComplete: (result) => this.onBattleComplete(result, node),
    });
  }

  onBattleComplete(result, node) {
    if (!result) return;
    if (!result.victory) {
      this.endRun(false);
      return;
    }
    this.game.wallet += 8 + node.floor * 4;
    this.run.floor = Math.max(this.run.floor, node.floor);
    this.run.rewardsTaken += 1;
    this.rewardOptions = makeRewardOptions(this.run, node.floor, node.type === 'elite', 3);
    const rewards = this.rewardOptions
      .map((option, index) => {
        const item = option.item;
        const color = item.rarity?.color || rankColor(item.rank);
        const detail = [statLine(item), item.effect || item.desc].filter(Boolean).join(' · ');
        return `<button class="reward-card" data-reward="${index}" style="--rarity:${color}">
          <span class="reward-kind">${option.type === 'item' ? '奇物' : '装备'}</span>
          <strong>${item.name}</strong>
          <small>${detail}</small>
          <em>${option.type === 'item' ? '收进行囊' : '拾取'}</em>
        </button>`;
      })
      .join('');
    const html = `
      <div class="reward-wrap">
        <div class="reward-panel">
          <p class="screen-kicker">SPOILS OF BATTLE · 第 ${node.floor} 层</p>
          <h2>${node.type === 'elite' ? '凶 煞 已 破' : '妖 气 暂 散'}</h2>
          <p class="node-copy">气血不会自动回复。选一件战利品，然后继续向更深处走。</p>
          <div class="reward-row">${rewards}</div>
          <div class="reward-foot">当前气血 <b>${Math.ceil(this.game.player.hp)} / ${this.game.player.maxHp}</b> · 战斗额外获得 <b>${8 + node.floor * 4}</b> 灵石</div>
        </div>
      </div>`;
    this.show(html, 'reward');
  }

  claimReward(index) {
    const option = this.rewardOptions?.[index];
    if (!option || !this.pendingNode) return;
    if (option.type === 'item') {
      this.run.items.push(option.item);
      this.notify(`${option.item.name} 已放入行囊`);
    } else {
      const result = this.applyEquipment(option.item);
      this.notify(result.message);
    }
    this.rewardOptions = null;
    this.completeNode(this.pendingNode);
  }

  applyEquipment(item) {
    const hydrated = hydrateItem(item);
    const current = this.game.equipped[hydrated.slot];
    if (current && itemScore(hydrated) <= itemScore(current)) {
      const salvage = Math.max(8, Math.round(equipmentPrice(hydrated) * 0.55));
      this.game.wallet += salvage;
      return { equipped: false, message: `${hydrated.name} 不如当前装备，分解为 ${salvage} 灵石` };
    }
    this.game.equipped[hydrated.slot] = hydrated;
    this.game.recalcStats();
    return { equipped: true, message: `${hydrated.name} 已自动装备` };
  }

  completeNode(node) {
    if (!node) return this.renderMap();
    node.completed = true;
    this.run.floor = Math.max(this.run.floor, node.floor);
    this.run.currentNode = node;
    this.run.available = [...node.next];
    this.pendingNode = null;
    this.pendingEncounter = null;
    this.currentEvent = null;
    this.shopOffers = null;
    this.renderMap();
  }

  renderEvent(node) {
    const event = this.currentEvent;
    const choices = event.choices
      .map((choice, index) => {
        const locked = choice.require?.coins && this.game.wallet < choice.require.coins;
        return `<button class="event-choice" data-choice="${index}" ${locked ? 'disabled' : ''}>
          <b>${choice.label}</b><span>${choice.desc}</span>${locked ? '<em>灵石不足</em>' : ''}
        </button>`;
      })
      .join('');
    const html = `
      <div class="node-modal-wrap">
        <div class="node-modal event-modal">
          <p class="screen-kicker">UNKNOWN EVENT · 第 ${node.floor} 层</p>
          <h2>${event.title}</h2>
          <p class="node-copy">${event.text}</p>
          <div class="event-choices">${choices}</div>
          <div class="node-actions"><button class="ghost-btn" data-node-close>不看了，返回</button></div>
        </div>
      </div>`;
    this.show(html, 'node');
  }

  resolveEventChoice(index) {
    const event = this.currentEvent;
    const choice = event?.choices[index];
    if (!choice) return;
    const messages = this.applyOutcome(choice.outcome || {});
    this.eventResult = messages;
    const html = `
      <div class="node-modal-wrap">
        <div class="node-modal event-modal">
          <p class="screen-kicker">EVENT RESULT</p>
          <h2>${event.title}</h2>
          <div class="event-result">${messages.map((m) => `<p>${m}</p>`).join('') || '<p>风从耳边过去了，什么也没有发生。</p>'}</div>
          <div class="node-actions"><button class="primary-btn" data-event-continue>继续上路</button></div>
        </div>
      </div>`;
    this.show(html, 'node');
  }

  applyOutcome(outcome) {
    const messages = [];
    if (outcome.coins) {
      this.game.wallet = Math.max(0, this.game.wallet + outcome.coins);
      messages.push(outcome.coins >= 0 ? `获得 ${outcome.coins} 灵石。` : `失去 ${-outcome.coins} 灵石。`);
    }
    if (outcome.heal) {
      const before = this.game.player.hp;
      this.game.player.heal(this.game.player.maxHp * outcome.heal, this.game, true);
      messages.push(`回复 ${Math.round(this.game.player.hp - before)} 点气血。`);
    }
    if (outcome.damage) {
      const before = this.game.player.hp;
      const loss = Math.round(this.game.player.maxHp * outcome.damage);
      this.game.player.hp = Math.max(1, this.game.player.hp - loss);
      messages.push(`失去 ${before - this.game.player.hp} 点气血。`);
    }
    if (outcome.maxHp) {
      this.game.heroBase.hp += outcome.maxHp;
      this.game.recalcStats();
      messages.push(`气血上限 +${outcome.maxHp}。`);
    }
    if (outcome.item) {
      const item = hydrateConsumable(ITEMS.find((i) => i.id === outcome.item) || ITEMS[0]);
      this.run.items.push(item);
      messages.push(`获得「${item.name}」。`);
    }
    if (outcome.randomItem) {
      const item = hydrateConsumable(ITEMS[Math.floor(Math.random() * ITEMS.length)]);
      this.run.items.push(item);
      messages.push(`获得「${item.name}」。`);
    }
    if (outcome.randomGear) {
      const gear = makeRewardOptions(this.run, this.pendingNode?.floor || 1, false, 1)[0]?.item;
      if (gear) {
        const result = this.applyEquipment(gear);
        messages.push(result.message);
      }
    }
    if (outcome.gamble != null) {
      if (Math.random() < 0.5) {
        this.game.wallet += 90;
        messages.push('赌局赢了，获得 90 灵石。');
      } else {
        this.game.wallet = Math.max(0, this.game.wallet - 40);
        messages.push('赌局输了，失去 40 灵石。');
      }
    }
    if (outcome.gambleGear) {
      if (Math.random() < 0.5) {
        const gear = makeRewardOptions(this.run, this.pendingNode?.floor || 1, true, 2)[0]?.item;
        if (gear) {
          const result = this.applyEquipment(gear);
          messages.push(`赌赢了：${result.message}`);
        }
      } else {
        const loss = Math.round(this.game.player.maxHp * 0.2);
        this.game.player.hp = Math.max(1, this.game.player.hp - loss);
        messages.push(`赌输了，失去 ${loss} 点气血。`);
      }
    }
    return messages;
  }

  renderShop(node) {
    const offers = this.shopOffers || [];
    const cards = offers
      .map((offer, index) => {
        const item = offer.item;
        const color = item.rarity?.color || rankColor(item.rank);
        const canBuy = this.game.wallet >= offer.price;
        const detail = [statLine(item), item.effect || item.desc].filter(Boolean).join(' · ');
        return `<button class="shop-card ${canBuy ? '' : 'expensive'}" data-shop-buy="${index}" style="--rarity:${color}">
          <span>${offer.type === 'item' ? '奇物' : '装备'}</span>
          <strong>${item.name}</strong>
          <small>${detail}</small>
          <b>${offer.price} 灵石</b>
        </button>`;
      })
      .join('');
    const html = `
      <div class="node-modal-wrap">
        <div class="node-modal shop-modal">
          <p class="screen-kicker">BLACK MARKET · 第 ${node.floor} 层</p>
          <h2>妖 市</h2>
          <p class="node-copy">摊主戴着笑脸面具，东西是真的，价格也是真的。当前灵石：<b>${formatNumber(this.game.wallet)}</b></p>
          <div class="shop-grid">${cards || '<p class="empty-hint">摊主已经收摊了。</p>'}</div>
          <div class="node-actions"><button class="ghost-btn" data-shop-leave>离开妖市</button></div>
        </div>
      </div>`;
    this.show(html, 'node');
  }

  buyShopOffer(index) {
    const offer = this.shopOffers?.[index];
    if (!offer) return;
    if (this.game.wallet < offer.price) {
      this.notify('灵石不够');
      return;
    }
    this.game.wallet -= offer.price;
    if (offer.type === 'item') {
      this.run.items.push(offer.item);
      this.notify(`买下 ${offer.item.name}`);
    } else {
      this.notify(this.applyEquipment(offer.item).message);
    }
    this.shopOffers.splice(index, 1);
    this.renderShop(this.pendingNode);
  }

  renderTavern(node) {
    const html = `
      <div class="node-modal-wrap">
        <div class="node-modal tavern-modal">
          <p class="screen-kicker">TAVERN · 第 ${node.floor} 层</p>
          <h2>酒 馆</h2>
          <p class="node-copy">灯笼昏黄，炉火正旺。老板娘替你温了一壶酒，铁匠在角落里磨着刀。只能选一样。</p>
          <div class="tavern-options">
            <button class="tavern-option" data-tavern-heal><span>汤</span><b>喝一碗热汤</b><small>回复 35% 最大气血</small></button>
            <button class="tavern-option" data-tavern-upgrade><span>铁</span><b>请铁匠淬炼</b><small>选择一件装备，强化它的属性</small></button>
          </div>
        </div>
      </div>`;
    this.show(html, 'node');
  }

  tavernHeal() {
    this.game.player.heal(this.game.player.maxHp * 0.35, this.game);
    this.sound.play('heal');
    this.notify('热汤下肚，气血恢复');
    this.completeNode(this.pendingNode);
  }

  renderUpgradeChoices() {
    const rows = Object.entries(this.game.equipped)
      .map(([slot, item]) => {
        const color = item.rarity?.color || rankColor(item.rank);
        return `<button class="upgrade-row" data-upgrade-slot="${slot}">
          <span>${SLOTS.find((s) => s.id === slot)?.name}</span>
          <strong style="color:${color}">${item.name}</strong>
          <small>${statLine(item)}</small>
        </button>`;
      })
      .join('');
    const html = `
      <div class="node-modal-wrap">
        <div class="node-modal event-modal">
          <p class="screen-kicker">FORGE</p>
          <h2>淬 炼</h2>
          <p class="node-copy">铁匠只说一句：选一件，我只敲一锤。</p>
          <div class="upgrade-list">${rows}</div>
        </div>
      </div>`;
    this.show(html, 'node');
  }

  upgradeGear(slot) {
    const item = this.game.equipped[slot];
    if (!item) return;
    if (slot === 'weapon') item.stats.atk = (item.stats.atk || 0) + 3;
    else {
      item.stats.hp = (item.stats.hp || 0) + (slot === 'chest' ? 24 : 14);
      item.stats.def = (item.stats.def || 0) + (slot === 'chest' ? 2 : 1);
      if (slot === 'boots') item.stats.speed = (item.stats.speed || 0) + 4;
    }
    this.game.recalcStats();
    this.sound.play('equip');
    this.notify(`${item.name} 已淬炼`);
    this.completeNode(this.pendingNode);
  }

  useItem(index) {
    const item = this.run?.items[index];
    if (!item) return;
    const use = item.use || {};
    if (use.heal) this.game.player.heal(this.game.player.maxHp * use.heal, this.game, true);
    if (use.maxHp) {
      this.game.heroBase.hp += use.maxHp;
      this.game.recalcStats();
    }
    if (use.energy === 1) this.game.player.energy = this.game.player.maxEnergy;
    if (use.energyFlat) this.game.player.energy = Math.min(this.game.player.maxEnergy, this.game.player.energy + use.energyFlat);
    if (use.crit) {
      this.game.heroBase.crit += use.crit;
      this.game.recalcStats();
    }
    if (use.sell) this.game.wallet += use.sell;
    if (use.guardNext) this.run.nextGuard = (this.run.nextGuard || 0) + use.guardNext;
    if (use.shield) this.run.nextGuard = (this.run.nextGuard || 0) + use.shield;
    this.run.items.splice(index, 1);
    this.sound.play('heal');
    this.notify(`使用了 ${item.name}`);
    this.renderMap();
  }

  finishRun(reachedEnd) {
    if (!this.run || this.run.finished) return this.run?.unlocks || [];
    this.run.finished = true;
    this.run.reachedEnd = reachedEnd;
    const unlocked = [];
    const add = (id) => {
      if (!this.progress.unlocked.includes(id)) {
        this.progress.unlocked.push(id);
        unlocked.push(HEROES.find((hero) => hero.id === id));
      }
    };
    this.progress.runs += 1;
    add('tangseng');
    if (this.run.heroId === 'tangseng') add('shaseng');
    if (reachedEnd) {
      this.progress.completions += 1;
      add('bajie');
    }
    this.run.unlocks = unlocked;
    this.saveProgress();
    return unlocked;
  }

  endRun() {
    const unlocks = this.finishRun(false);
    const run = this.run;
    const unlockHtml = unlocks.length
      ? `<div class="unlock-line">新英雄解锁：${unlocks.map((hero) => `<b>${hero.name}</b>`).join('、')}</div>`
      : '';
    const html = `
      <div class="result-screen">
        <div class="result-inner">
          <p class="screen-kicker">THE CYCLE ENDS</p>
          <h1>力 竭</h1>
          <p class="result-copy">你倒在了第 ${run?.floor || 1} 层。气血不会自动回复，下一次要记得在酒馆里多坐一会儿。</p>
          <div class="result-stats">
            <div><b>${run?.floor || 1}</b><span>抵达层数</span></div>
            <div><b>${this.game.kills}</b><span>击杀</span></div>
            <div><b>${run?.seed || '—'}</b><span>本局种子</span></div>
          </div>
          ${unlockHtml}
          <div class="result-actions">
            <button class="ghost-btn" data-return-menu>回到初始界面</button>
            <button class="primary-btn" data-new-run>再入轮回</button>
          </div>
        </div>
      </div>`;
    this.show(html, 'result');
  }

  showEnding() {
    this.clearNotice();
    const unlocks = this.finishRun(true);
    this.screen = 'ending';
    this.game.phase = 'meta';
    document.body.classList.add('in-meta');
    document.body.classList.remove('in-battle');
    const unlockText = unlocks.length ? `新的身影在轮回尽头醒来：${unlocks.map((hero) => hero.name).join('、')}` : '';
    const html = `
      <div class="ending-screen">
        <div class="ending-boss">${bossArt()}</div>
        <div class="ending-fade"></div>
        <div class="ending-copy">
          <p class="screen-kicker">THE TENTH FLOOR · ${FINAL_BOSS.name}</p>
          <h1>你 倒 下 了</h1>
          <p class="ending-verse">十层妖途，万般因果。<br>你在无相劫主面前力竭，轮回重新合拢。</p>
          <p class="ending-unlock">${unlockText}</p>
          <button class="primary-btn ending-btn" data-return-menu>回到初始界面</button>
        </div>
        <div class="falling-hero"><i></i><b></b></div>
      </div>`;
    this.root.classList.add('active');
    this.root.innerHTML = `<section class="screen screen-ending">${html}</section>`;
    clearTimeout(this.endTimer);
    this.endTimer = setTimeout(() => {
      if (this.screen === 'ending') this.returnToMenu();
    }, 12000);
  }

  returnToMenu() {
    clearTimeout(this.endTimer);
    this.endTimer = null;
    this.run = null;
    this.battleNode = null;
    this.renderMenu();
  }
}
