import { HEROES, WEAPONS, ARMOR, ITEMS, MONSTERS, SLOTS, MAP_NODE_TYPES, FINAL_BOSS, TOWER_GUARDIAN } from './data.js';
import { generateMap, makeSeed, starterLoadout, makeRewardOptions, makeShopOffers, buildEncounter, pickEvent, hydrateConsumable, equipmentPrice } from './rogue.js';
import { hydrateItem, formatNumber, RARITIES } from './core.js';
import { heroArt, bossArt, towerArt, itemCard, nodeIcon, nodeColor, formatKey, rankColor, statLine, uiIcon } from './ui.js';
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
    this.backpackRoot = document.getElementById('backpack-root');
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
    this.backpackOpen = false;
    this.backpackTab = 'all';
    this.backpackSelected = null;
    this.backpackResumeGame = false;
    this.settingsReturn = 'menu';
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
      hint.textContent = `${formatKey(b.left)} / ${formatKey(b.right)} 移动 · ${formatKey(b.jump)} 二段跳 · ${formatKey(b.attack)} 连击 · ${formatKey(b.heavy)} 破军 · ${formatKey(b.flame)} 烈焰 · ${formatKey(b.ult)} 神威 · ${formatKey(b.dash)} 闪避 · B 背包`;
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
    this.backpackRoot?.addEventListener('click', (event) => this.onBackpackClick(event));
    this.root.addEventListener('keydown', (event) => {
      if (event.target?.id === 'seed-input' && event.code === 'Enter') {
        event.preventDefault();
        this.startRun(event.target.value);
      }
    });
    document.getElementById('touch-backpack')?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.toggleBackpack();
    });
    window.addEventListener('pointerdown', () => {
      this.sound.init();
      this.sound.startMusic();
    }, { once: true });
    window.addEventListener('keydown', (event) => {
      if (event.target?.closest?.('input, textarea, select')) {
        if (event.code === 'Escape') event.target.blur();
        return;
      }
      if (this.bindingAction) {
        event.preventDefault();
        event.stopPropagation();
        this.captureBinding(event);
        return;
      }
      if (event.code === 'KeyB' && !event.repeat && this.run && !['ending', 'result'].includes(this.screen)) {
        event.preventDefault();
        event.stopPropagation();
        this.toggleBackpack();
        return;
      }
      if (event.code === 'Escape' && this.backpackOpen) {
        event.preventDefault();
        event.stopPropagation();
        this.closeBackpack();
        return;
      }
      if (event.code === 'Escape') {
        if (this.screen === 'settings' && this.settingsReturn === 'map') {
          event.preventDefault();
          this.settingsReturn = 'menu';
          this.renderMap();
        } else if (this.screen === 'hero' || this.screen === 'codex' || this.screen === 'settings') {
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
      if (target.dataset.nav === 'settings') {
        this.settingsReturn = 'menu';
        this.renderSettings();
      }
      return;
    }
    if (target.dataset.back) {
      this.sound.play('ui');
      if (target.dataset.back === 'menu') this.renderMenu();
      if (target.dataset.back === 'hero') this.renderHeroSelect();
      if (target.dataset.back === 'map') {
        this.settingsReturn = 'menu';
        this.renderMap();
      }
      return;
    }
    if (target.dataset.mapRefresh != null) {
      this.sound.play('ui');
      this.renderMap();
      return;
    }
    if (target.dataset.mapSettings != null) {
      this.sound.play('ui');
      this.settingsReturn = 'map';
      this.renderSettings();
      return;
    }
    if (target.dataset.rewardForward != null) {
      this.sound.play('ui');
      this.completeNode(this.pendingNode);
      return;
    }
    if (target.dataset.heroCard) {
      this.selectHero(target.dataset.heroCard);
      return;
    }
    if (target.dataset.openBackpack != null) {
      this.toggleBackpack();
      return;
    }
    if (target.dataset.towerEnter != null) {
      this.showEnding();
      return;
    }
    if (target.dataset.startRun != null) {
      this.startRun(document.getElementById('seed-input')?.value || '');
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
    if (this.backpackOpen) this.closeBackpack(true);
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
      const lockNote = hero.id === 'tangseng' ? '结束一局解锁' : hero.id === 'shaseng' ? '唐僧一局解锁' : '登上塔顶解锁';
      return `<button class="hero-card ${locked ? 'locked' : ''} ${active ? 'selected' : ''}" data-hero-card="${hero.id}" style="--hero-color:${hero.color};--hero-dark:${hero.dark};--hero-accent:${hero.accent}">
        <span class="hero-card-art" aria-hidden="true">${heroArt(hero.id)}</span>
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
      return '击败镇塔明王并登上塔顶后解锁';
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
            <div class="hero-start-setup">
              <label class="seed-input-wrap">
                <span>地图种子</span>
                <input id="seed-input" type="text" maxlength="20" placeholder="留空则随机" autocomplete="off" spellcheck="false" aria-label="地图种子">
              </label>
              <span class="seed-hint">同样的种子会生成同一张地图；留空则随机</span>
            </div>
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
      else this.notify('击败镇塔明王并登上塔顶后，猪八戒才会出现');
      return;
    }
    this.selectedHero = id;
    this.sound.play('ui');
    this.renderHeroSelect();
  }

  startRun(seedOverride = '') {
    const hero = HEROES.find((h) => h.id === this.selectedHero);
    if (!hero || !this.progress.unlocked.includes(hero.id)) return;
    const typedSeed = String(seedOverride || '').trim().toUpperCase().replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 20);
    const seed = typedSeed || makeSeed();
    const loadout = starterLoadout(hero.id);
    this.closeBackpack(true);
    this.run = {
      style: 'rogue',
      seed,
      heroId: hero.id,
      map: generateMap(seed),
      available: [],
      floor: 0,
      currentNode: null,
      items: [],
      inventory: [],
      itemSeq: 0,
      rewardsTaken: 0,
      shopSeed: 0,
      eventSeed: 0,
      finished: false,
      reachedEnd: false,
      nextGuard: 0,
    };
    for (const item of Object.values(loadout)) {
      if (item) item.uid = this.nextItemUid();
    }
    this.game.setupRogueRun(hero, loadout);
    this.run.available = [...this.run.map.start];
    this.pendingNode = null;
    this.pendingEncounter = null;
    this.rewardOptions = null;
    this.rewardClaimed = false;
    this.sound.play('wave');
    this.renderMap();
  }

  nextItemUid() {
    if (!this.run) return `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    this.run.itemSeq = (this.run.itemSeq || 0) + 1;
    return `${this.run.seed}-it-${this.run.itemSeq}`;
  }

  ensureUid(item) {
    if (!item.uid) item.uid = this.nextItemUid();
    return item;
  }

  grantEquipment(item) {
    const hydrated = this.ensureUid(hydrateItem(item));
    this.run.inventory.push(hydrated);
    return {
      message: `${hydrated.name} 已收入行囊（按 B 打开背包装备）`,
      item: hydrated,
    };
  }

  grantConsumable(item) {
    const entry = this.ensureUid({ ...item, kind: 'item' });
    this.run.items.push(entry);
    return entry;
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
    const monsterHtml = [...MONSTERS, { ...TOWER_GUARDIAN, floor: '第十层', elite: true }, { ...FINAL_BOSS, floor: '塔顶', elite: true, desc: FINAL_BOSS.desc }].map((monster) => {
      const floorLabel = monster.id === 'final' ? '塔顶' : monster.id === 'tower-guardian' ? '第十层' : `${monster.floor} 层`;
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
            <div class="panel-title"><span>叁</span><h3>妖物</h3><small>${MONSTERS.length + 2} 种</small></div>
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
    const backTarget = this.settingsReturn === 'map' ? 'map' : 'menu';
    const html = `
      <div class="settings-screen">
        <header class="screen-head">
          <button class="back-btn" data-back="${backTarget}">← ${backTarget === 'map' ? '返回地图' : '返回'}</button>
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
    const hero = HEROES.find((h) => h.id === run.heroId) || HEROES[0];
    const available = new Set(run.available);
    const yOf = (floor) => {
      // 最后两段拉开距离，让五路汇入酒馆的路线也保持陡峭
      if (floor === 9) return 16;
      if (floor === 10) return 8;
      return 89 - (floor - 1) * 8.4;
    };
    const xOf = (node) => (node.count === 1 ? 50 : 18 + node.col * 16 + (node.jitter || 0));
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
        return `<button class="${classes}" data-node="${node.id}" data-node-type="${node.type}" aria-label="第${node.floor}层 ${MAP_NODE_TYPES[node.type].label}" title="第${node.floor}层 · ${MAP_NODE_TYPES[node.type].label}" style="left:${xOf(node)}%;top:${yOf(node.floor)}%;--node-color:${nodeColor(node.type)}" ${isAvailable ? '' : 'aria-disabled="true"'}>
          <span class="map-node-icon">${nodeIcon(node.type)}</span>
        </button>`;
      })
      .join('');
    const floors = Array.from({ length: 10 }, (_, index) => {
      const floor = index + 1;
      return `<span class="floor-tag" style="top:${yOf(floor)}%">${String(floor).padStart(2, '0')}</span>`;
    }).join('');
    const gearHtml = Object.entries(this.game.equipped)
      .map(([slot, item]) => {
        if (!item) {
          return `<div class="gear-line empty"><span class="gear-slot">${SLOTS.find((s) => s.id === slot)?.name || slot}</span><span class="gear-name">未装备</span></div>`;
        }
        const color = item.rarity?.color || rankColor(item.rank);
        return `<div class="gear-line"><span class="gear-slot">${SLOTS.find((s) => s.id === slot)?.name || slot}</span><span class="gear-name" style="color:${color}">${item.name}</span><span class="gear-rank">${item.rarity?.name || RARITIES[item.rank || 0].name}</span></div>`;
      })
      .join('');
    const itemHtml = run.items.length
      ? run.items.map((item, index) => `<div class="bag-line"><span>${item.name}</span><button class="text-btn" data-use-item="${index}">使用</button></div>`).join('')
      : '<p class="empty-hint">道具行囊为空。回血只能靠道具、事件或酒馆。</p>';
    const hpPct = Math.max(0, Math.min(1, this.game.player.hp / this.game.player.maxHp));
    const legendText = {
      battle: '小怪战',
      elite: '凶煞精英',
      event: '未知事件',
      shop: '妖市商店',
      tavern: '酒馆 · 回血或淬炼',
      boss: '镇塔明王',
    };
    const legendHtml = ['battle', 'elite', 'event', 'shop', 'tavern', 'boss']
      .map((type) => `<div class="legend-row" data-legend-type="${type}" tabindex="0" style="--legend-color:${nodeColor(type)}">
        <span class="legend-icon">${nodeIcon(type)}</span>
        <span class="legend-copy"><b>${MAP_NODE_TYPES[type].label}</b><small>${legendText[type]}</small></span>
      </div>`)
      .join('');
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
          <div class="map-scroll">
            <div class="map-sheet">
              <div class="map-mist"></div>
              <svg class="map-edges" viewBox="0 0 100 100" preserveAspectRatio="none">${edges.join('')}</svg>
              ${floors}
              ${nodes}
            </div>
          </div>
          <aside class="map-side">
            <div class="map-tools" aria-label="游戏工具">
              <button class="map-tool" data-open-backpack title="行囊（B）" aria-label="行囊">${uiIcon('bag')}</button>
              <button class="map-tool" data-map-refresh title="地图" aria-label="地图">${uiIcon('map')}</button>
              <button class="map-tool" data-map-settings title="设定" aria-label="设定">${uiIcon('settings')}</button>
            </div>
            <div class="side-hero">
              <div class="side-portrait" style="--hero-color:${hero.color}">${hero.name.slice(0, 1)}</div>
              <div><p>${hero.title}</p><h3>${hero.name}</h3></div>
            </div>
            <div class="side-section side-legend-section">
              <div class="side-title">图例</div>
              <div class="legend-list">${legendHtml}</div>
            </div>
            <div class="side-section"><div class="side-title">随身装备</div>${gearHtml}</div>
            <div class="side-section"><div class="side-title">行囊 <button class="text-btn" data-open-backpack>B 打开</button></div>${itemHtml}<p class="bag-equipment-count">装备行囊：${this.run.inventory.length} 件 · 按 B 查看/装备/卸下</p></div>
            <div class="side-section side-note"><p>战斗结束后不会回血。</p><p>路线只能向前，选择后不可回头。</p></div>
          </aside>
        </div>
      </div>`;
    this.show(html, 'map');
    requestAnimationFrame(() => {
      const scroller = this.root.querySelector('.map-scroll');
      if (!scroller) return;
      const targetId = run.available[0] || run.currentNode?.id;
      const target = targetId ? scroller.querySelector(`[data-node="${targetId}"]`) : null;
      if (target) scroller.scrollTop = Math.max(0, target.offsetTop - scroller.clientHeight * 0.62);
      else scroller.scrollTop = scroller.scrollHeight;

      // 图例悬停/聚焦：只把对应种类的地图节点提亮，其他节点退暗
      const sheet = scroller.querySelector('.map-sheet');
      const setLegendFocus = (type) => {
        if (!sheet) return;
        sheet.classList.toggle('legend-focus', !!type);
        for (const node of sheet.querySelectorAll('.map-node')) {
          node.classList.toggle('legend-highlight', !!type && node.dataset.nodeType === type);
        }
        if (type) {
          const first = sheet.querySelector(`.map-node[data-node-type="${type}"]`);
          if (first) {
            const nodeBox = first.getBoundingClientRect();
            const scrollBox = scroller.getBoundingClientRect();
            if (nodeBox.top < scrollBox.top + 28 || nodeBox.bottom > scrollBox.bottom - 28) {
              scroller.scrollTop = Math.max(0, first.offsetTop - scroller.clientHeight * 0.48);
            }
          }
        }
      };
      for (const row of this.root.querySelectorAll('.legend-row')) {
        const type = row.dataset.legendType;
        row.addEventListener('mouseenter', () => setLegendFocus(type));
        row.addEventListener('mouseleave', () => setLegendFocus(''));
        row.addEventListener('focus', () => setLegendFocus(type));
        row.addEventListener('blur', () => setLegendFocus(''));
      }

      // 鼠标停在右侧图例/工具图标上时，滚轮也用来滚动地图
      const scrollMapFromSide = (event) => {
        event.preventDefault();
        scroller.scrollTop += event.deltaY * 0.9;
      };
      for (const zone of this.root.querySelectorAll('.map-tools, .side-legend-section')) {
        zone.addEventListener('wheel', scrollMapFromSide, { passive: false });
      }
    });
  }

  openNode(id) {
    const node = this.run?.map.nodes.get(id);
    if (!node) return;
    if (!this.run.available.includes(id)) {
      this.notify('这条路没有连到当前节点，先走正在发光的节点');
      return;
    }
    this.pendingNode = node;
    this.run.currentNode = node;
    this.run.shopSeed = node.id;
    this.run.eventSeed = node.id;
    if (node.type === 'battle' || node.type === 'elite' || node.type === 'boss') {
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
    const isBoss = node.type === 'boss';
    const names = encounter.specs
      .map((spec) => `<div class="enemy-chip ${spec.boss ? 'elite' : ''}"><span>${spec.boss ? '煞' : '妖'}</span><b>${spec.name}</b><small>${spec.boss ? (isBoss ? '守塔者' : '精英') : '小妖'}</small></div>`)
      .join('');
    const html = `
      <div class="node-modal-wrap">
        <div class="node-modal">
          <p class="screen-kicker">${isBoss ? 'TOWER GATE' : node.type === 'elite' ? 'ELITE ENCOUNTER' : 'ENCOUNTER'} · 第 ${node.floor} 层</p>
          <h2>${isBoss ? '镇 塔 明 王' : node.type === 'elite' ? '凶 煞 拦 路' : '妖 气 逼 近'}</h2>
          <p class="node-copy">${isBoss ? '十层妖途的尽头，塔门紧闭。金身明王横杖而立：打赢我，你才有资格看见塔顶的那个人。' : node.type === 'elite' ? '这不是普通的小妖。打赢它，才有资格继续向第十层走。' : '山道上的妖物已经闻到生人的气味。它们不会让你轻易过去。'}</p>
          <div class="enemy-row">${names}</div>
          <div class="node-warning">战斗结束后<span>不会自动回复气血</span>。</div>
          <div class="node-actions">
            <button class="ghost-btn" data-node-close>返回路线</button>
            <button class="primary-btn" data-fight>${isBoss ? '挑战镇塔明王' : '进入战斗'}</button>
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
    if (node.type === 'boss') {
      this.run.floor = 10;
      this.run.bossDefeated = true;
      node.completed = true;
      this.game.showBossContinue('妖王已伏', '塔门在第十层尽头缓缓开启', () => this.showTower());
      return;
    }
    this.game.wallet += 8 + node.floor * 4;
    this.run.floor = Math.max(this.run.floor, node.floor);
    this.run.rewardsTaken += 1;
    this.rewardNode = node;
    this.rewardClaimed = false;
    this.rewardChosenName = '';
    this.rewardOptions = makeRewardOptions(this.run, node.floor, node.type === 'elite', 3);
    this.renderRewardScreen(node);
  }

  renderRewardScreen(node) {
    const rewards = this.rewardOptions
      .map((option, index) => {
        const item = option.item;
        const color = item.rarity?.color || rankColor(item.rank);
        const detail = [statLine(item), item.effect || item.desc].filter(Boolean).join(' · ');
        return `<button class="reward-card" data-reward="${index}" style="--rarity:${color}" ${this.rewardClaimed ? 'disabled' : ''}>
          <span class="reward-kind">${option.type === 'item' ? '奇物' : '装备'}</span>
          <strong>${item.name}</strong>
          <small>${detail}</small>
          <em>收入行囊</em>
        </button>`;
      })
      .join('');
    const claimed = this.rewardClaimed
      ? `<div class="reward-claimed"><span>已收取</span><b>${this.rewardChosenName || '战利品'}</b><small>已放入行囊，按 B 查看</small></div>`
      : '';
    const html = `
      <div class="reward-wrap">
        <div class="reward-panel">
          <p class="screen-kicker">SPOILS OF BATTLE · 第 ${node.floor} 层</p>
          <h2>${node.type === 'elite' ? '凶 煞 已 破' : '妖 气 暂 散'}</h2>
          <p class="node-copy">气血不会自动回复。战利品会收入行囊，按 <b>B</b> 打开背包装备或使用。</p>
          ${this.rewardClaimed ? claimed : `<div class="reward-row">${rewards}</div>`}
          <div class="reward-foot">当前气血 <b>${Math.ceil(this.game.player.hp)} / ${this.game.player.maxHp}</b> · 战斗额外获得 <b>${8 + node.floor * 4}</b> 灵石</div>
          <button class="reward-forward" data-reward-forward aria-label="向前">
            <span>向前</span><b>→</b>
          </button>
        </div>
      </div>`;
    this.show(html, 'reward');
  }

  claimReward(index) {
    const option = this.rewardOptions?.[index];
    if (!option || !this.pendingNode || this.rewardClaimed) return;
    if (option.type === 'item') {
      this.grantConsumable(option.item);
      this.notify(`${option.item.name} 已放入行囊`);
    } else {
      const result = this.grantEquipment(option.item);
      this.notify(result.message);
    }
    this.rewardClaimed = true;
    this.rewardChosenName = option.item.name;
    this.renderRewardScreen(this.pendingNode);
    this.sound.play('equip');
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
    this.rewardOptions = null;
    this.rewardClaimed = false;
    this.rewardChosenName = '';
    this.rewardNode = null;
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
      const item = this.grantConsumable(hydrateConsumable(ITEMS.find((i) => i.id === outcome.item) || ITEMS[0]));
      messages.push(`获得「${item.name}」，已放入行囊。`);
    }
    if (outcome.randomItem) {
      const item = this.grantConsumable(hydrateConsumable(ITEMS[Math.floor(Math.random() * ITEMS.length)]));
      messages.push(`获得「${item.name}」，已放入行囊。`);
    }
    if (outcome.randomGear) {
      const gear = makeRewardOptions(this.run, this.pendingNode?.floor || 1, false, 1)[0]?.item;
      if (gear) {
        const result = this.grantEquipment(gear);
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
          const result = this.grantEquipment(gear);
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
      this.grantConsumable(offer.item);
      this.notify(`买下 ${offer.item.name}，已放入行囊`);
    } else {
      this.notify(this.grantEquipment(offer.item).message);
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
      .filter(([, item]) => item)
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
          <div class="upgrade-list">${rows || '<p class="empty-hint">身上没有可淬炼的装备。先去行囊里穿上几件。</p>'}</div>
          <div class="node-actions"><button class="ghost-btn" data-node-close>返回酒馆</button></div>
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

  toggleBackpack() {
    if (!this.run || ['ending', 'result'].includes(this.screen)) return;
    if (this.backpackOpen) {
      this.closeBackpack();
      return;
    }
    this.backpackOpen = true;
    this.backpackResumeGame = this.screen === 'battle' && this.game.phase === 'playing';
    if (this.backpackResumeGame) this.game.uiPaused = true;
    this.input.clearVirtual();
    this.backpackSelected = null;
    this.renderBackpack();
    this.backpackRoot?.classList.add('open');
    this.sound.play('ui');
  }

  closeBackpack(silent = false) {
    if (!this.backpackOpen && silent) return;
    this.backpackOpen = false;
    this.backpackRoot?.classList.remove('open');
    if (this.backpackRoot) this.backpackRoot.innerHTML = '';
    if (this.game.uiPaused) this.game.uiPaused = false;
    this.backpackResumeGame = false;
    if (!silent && this.screen === 'map') this.renderMap();
    this.input.clearFrame();
  }

  bagEntries() {
    if (!this.run) return [];
    return [
      ...(this.run.inventory || []).map((item) => ({ kind: 'equipment', item })),
      ...(this.run.items || []).map((item) => ({ kind: 'item', item })),
    ];
  }

  findBagEntry(uid) {
    return this.bagEntries().find((entry) => entry.item.uid === uid) || null;
  }

  renderBackpack() {
    if (!this.run || !this.backpackRoot) return;
    const hero = HEROES.find((h) => h.id === this.run.heroId) || HEROES[0];
    const stats = this.game.stats;
    const tabs = [
      ['all', '全部'],
      ['weapon', '武器'],
      ['head', '头饰'],
      ['chest', '胸甲'],
      ['legs', '护腿'],
      ['boots', '靴子'],
      ['items', '道具'],
    ];
    const entries = this.bagEntries().filter((entry) => {
      if (this.backpackTab === 'all') return true;
      if (this.backpackTab === 'items') return entry.kind === 'item';
      return entry.kind === 'equipment' && entry.item.slot === this.backpackTab;
    });
    if (this.backpackSelected && !entries.some((entry) => entry.item.uid === this.backpackSelected)) {
      this.backpackSelected = null;
    }
    const selected = this.backpackSelected ? this.findBagEntry(this.backpackSelected) : null;
    const slotRows = SLOTS.map((slot) => {
      const item = this.game.equipped[slot.id];
      const color = item?.rarity?.color || '#8a8377';
      return `<div class="bp-slot-row">
        <button class="bp-slot-btn" data-bp-slot="${slot.id}">
          <span class="bp-slot-glyph" style="--slot-color:${color}">${slot.glyph}</span>
          <span class="bp-slot-copy"><b>${slot.name}</b><em style="color:${color}">${item ? item.name : '空置'}</em><small>${item ? `${item.rarity?.name || '凡品'} · ${statLine(item)}` : '卸下后该部位不再提供属性'}</small></span>
        </button>
        <button class="bp-unequip" data-bp-unequip="${slot.id}" ${item ? '' : 'disabled'}>卸下</button>
      </div>`;
    }).join('');
    const cards = entries.map(({ kind, item }) => {
      const color = item.rarity?.color || (kind === 'item' ? '#d9c18b' : '#aeb7c5');
      const icon = kind === 'item' ? item.glyph || '奇' : SLOTS.find((s) => s.id === item.slot)?.glyph || '装';
      const sub = kind === 'item' ? '奇物' : `${SLOTS.find((s) => s.id === item.slot)?.name || '装备'} · ${item.rarity?.name || '凡品'}`;
      return `<button class="bp-card ${this.backpackSelected === item.uid ? 'selected' : ''}" data-bp-select="${item.uid}" style="--rarity:${color}">
        <span class="bp-card-icon">${icon}</span>
        <span class="bp-card-copy"><strong>${item.name}</strong><small>${sub}</small><em>${statLine(item)}</em></span>
      </button>`;
    }).join('');
    const detail = selected
      ? (() => {
          const { kind, item } = selected;
          const color = item.rarity?.color || '#d9c18b';
          const effect = item.effect || item.desc || '没有特殊效果';
          const action = kind === 'item'
            ? `<button class="primary-btn bp-action" data-bp-use="${item.uid}">使用</button>`
            : `<button class="primary-btn bp-action" data-bp-equip="${item.uid}">装备</button>`;
          const salvage = kind === 'equipment'
            ? `<button class="ghost-btn bp-action" data-bp-salvage="${item.uid}">分解 +${this.salvagePrice(item)}</button>`
            : '';
          return `<div class="bp-detail">
            <div class="bp-detail-copy">
              <p class="screen-kicker">${kind === 'item' ? 'TREASURE' : 'EQUIPMENT'}</p>
              <h3 style="color:${color}">${item.name}</h3>
              <p>${effect}</p>
              <small>${statLine(item)}</small>
            </div>
            <div class="bp-detail-actions">${action}${salvage}</div>
          </div>`;
        })()
      : '<div class="bp-detail empty"><p>选择行囊中的一件物品，查看属性与操作。</p></div>';
    const equippedCount = Object.values(this.game.equipped).filter(Boolean).length;
    this.backpackRoot.innerHTML = `
      <div class="bp-panel">
        <header class="bp-head">
          <div><p class="screen-kicker">TRAVELER'S PACK</p><h2>行囊</h2><span>${hero.name} · ${hero.title}</span></div>
          <div class="bp-head-actions"><span class="bp-hint">按 <b>B</b> 关闭</span><button class="ghost-btn" data-bp-close>关闭</button></div>
        </header>
        <div class="bp-body">
          <section class="bp-equipped">
            <div class="bp-section-head"><span>身上装备</span><small>${equippedCount} / 5</small></div>
            <div class="bp-slots">${slotRows}</div>
            <div class="bp-statline">
              <span>攻 <b>${stats.atk}</b></span><span>血 <b>${stats.maxHp}</b></span><span>护 <b>${stats.def}</b></span><span>会心 <b>${stats.crit.toFixed(1)}%</b></span><span>身法 <b>${stats.speed}</b></span>
            </div>
            <p class="bp-note">装备与卸下会立即改变角色外观和战斗属性；不会自动回复气血。</p>
          </section>
          <section class="bp-bag">
            <div class="bp-section-head"><span>行囊</span><small>${entries.length} 件</small></div>
            <div class="bp-tabs">${tabs.map(([id, label]) => `<button class="${this.backpackTab === id ? 'active' : ''}" data-bp-tab="${id}">${label}</button>`).join('')}</div>
            <div class="bp-grid">${cards || '<div class="bp-empty">这个分类还没有东西。战斗、事件和妖市都会把新物品放进这里。</div>'}</div>
            ${detail}
          </section>
        </div>
      </div>`;
  }

  onBackpackClick(event) {
    const target = event.target.closest('button');
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    this.sound.init();
    this.sound.startMusic();
    if (target.dataset.bpClose != null) return this.closeBackpack();
    if (target.dataset.bpTab) {
      this.backpackTab = target.dataset.bpTab;
      this.backpackSelected = null;
      return this.renderBackpack();
    }
    if (target.dataset.bpSlot) {
      this.backpackTab = target.dataset.bpSlot;
      this.backpackSelected = null;
      return this.renderBackpack();
    }
    if (target.dataset.bpSelect) {
      this.backpackSelected = target.dataset.bpSelect;
      return this.renderBackpack();
    }
    if (target.dataset.bpEquip) return this.equipBagItem(target.dataset.bpEquip);
    if (target.dataset.bpUnequip) return this.unequipSlot(target.dataset.bpUnequip);
    if (target.dataset.bpUse) return this.useBagItem(target.dataset.bpUse);
    if (target.dataset.bpSalvage) return this.salvageBagItem(target.dataset.bpSalvage);
  }

  salvagePrice(item) {
    return Math.max(8, Math.round(equipmentPrice(item) * 0.55));
  }

  equipBagItem(uid) {
    const entry = this.findBagEntry(uid);
    if (!entry || entry.kind !== 'equipment') return;
    const item = entry.item;
    const slot = item.slot;
    if (!SLOTS.some((s) => s.id === slot)) return;
    this.run.inventory = (this.run.inventory || []).filter((entryItem) => entryItem.uid !== item.uid);
    const current = this.game.equipped[slot];
    if (current) this.run.inventory.push(this.ensureUid(current));
    this.game.equipped[slot] = item;
    this.game.recalcStats();
    this.backpackSelected = current?.uid || null;
    this.sound.play('equip');
    this.notify(current ? `已装备 ${item.name}，${current.name} 收入行囊` : `已装备 ${item.name}`);
    if (this.screen === 'battle' && this.game.player) {
      this.game.addText(this.game.player.x, this.game.player.y - 116, `${item.name} 已装备`, {
        color: item.rarity?.color || '#e8c575', size: 16, vy: -55,
      });
      this.game.flash('#e8c575', 0.08);
    }
    this.renderBackpack();
  }

  unequipSlot(slotId) {
    const item = this.game.equipped[slotId];
    if (!item) return;
    this.game.equipped[slotId] = null;
    this.run.inventory.push(this.ensureUid(item));
    this.game.recalcStats();
    this.backpackSelected = item.uid;
    this.sound.play('equip');
    this.notify(`已卸下 ${item.name}`);
    if (this.screen === 'battle' && this.game.player) {
      this.game.addText(this.game.player.x, this.game.player.y - 116, `${item.name} 已卸下`, {
        color: '#c9b28a', size: 15, vy: -50,
      });
    }
    this.renderBackpack();
  }

  useBagItem(uid) {
    const entry = this.findBagEntry(uid);
    if (!entry || entry.kind !== 'item') return;
    this.consumeConsumable(entry.item);
    this.backpackSelected = null;
    this.renderBackpack();
  }

  salvageBagItem(uid) {
    const entry = this.findBagEntry(uid);
    if (!entry || entry.kind !== 'equipment') return;
    const price = this.salvagePrice(entry.item);
    this.game.wallet += price;
    this.run.inventory = this.run.inventory.filter((item) => item.uid !== entry.item.uid);
    this.backpackSelected = null;
    this.sound.play('coin');
    this.notify(`${entry.item.name} 分解为 ${price} 灵石`);
    this.renderBackpack();
  }

  consumeConsumable(item) {
    if (!item) return false;
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
    this.run.items = this.run.items.filter((entry) => entry.uid !== item.uid);
    this.sound.play('heal');
    this.notify(`使用了 ${item.name}`);
    if (this.screen === 'battle' && this.game.player) {
      this.game.addText(this.game.player.x, this.game.player.y - 116, item.name, {
        color: '#8be4dd', size: 16, vy: -55,
      });
    }
    return true;
  }

  useItem(index) {
    const item = this.run?.items[index];
    if (!item) return;
    this.consumeConsumable(item);
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

  showTower() {
    if (!this.run) return;
    const hero = HEROES.find((h) => h.id === this.run.heroId) || HEROES[0];
    this.closeBackpack(true);
    this.screen = 'tower';
    this.game.phase = 'meta';
    document.body.classList.add('in-meta');
    document.body.classList.remove('in-battle');
    this.sound.play('boss', 0.5);
    const html = `
      <div class="tower-screen">
        <div class="tower-art">${towerArt()}</div>
        <div class="tower-fade"></div>
        <div class="tower-copy">
          <p class="screen-kicker">THE TENTH FLOOR · BEYOND THE GATE</p>
          <h1>塔 门 之 后</h1>
          <p>镇塔明王倒下，塔门在第十层尽头缓缓开启。<br>${hero.name}踏上第一级台阶，听见楼上有人轻轻笑了一声。</p>
          <button class="primary-btn tower-enter" data-tower-enter>继 续 登 楼</button>
        </div>
        <div class="tower-climber"></div>
      </div>`;
    this.root.classList.add('active');
    this.root.innerHTML = `<section class="screen screen-tower">${html}</section>`;
    clearTimeout(this.towerTimer);
    this.towerTimer = setTimeout(() => {
      if (this.screen === 'tower') this.showEnding();
    }, 8000);
    this.input.clearFrame();
  }

  showEnding() {
    clearTimeout(this.towerTimer);
    this.towerTimer = null;
    this.closeBackpack(true);
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
          <p class="screen-kicker">TOWER TOP · ${FINAL_BOSS.name}</p>
          <h1>你 倒 下 了</h1>
          <p class="ending-verse">十层妖途，万般因果。<br>你登上高楼，在无相劫主面前力竭，轮回重新合拢。</p>
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
    this.closeBackpack(true);
    clearTimeout(this.towerTimer);
    this.towerTimer = null;
    clearTimeout(this.endTimer);
    this.endTimer = null;
    this.run = null;
    this.battleNode = null;
    this.renderMenu();
  }
}
