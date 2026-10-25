export const VIEW_W = 1280;
export const VIEW_H = 720;
export const GROUND_Y = 620;
export const LEVEL_W = 2860;

export const FONT_TITLE = '"STKaiti", "KaiTi", "Noto Serif SC", "Songti SC", serif';
export const FONT_UI = '"Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", sans-serif';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
let entitySequence = 1;
export const nextId = () => entitySequence++;
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const choose = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const chance = (p) => Math.random() < p;
export const approach = (v, target, delta) => {
  if (v < target) return Math.min(v + delta, target);
  return Math.max(v - delta, target);
};
export const damp = (v, target, lambda, dt) => lerp(v, target, 1 - Math.exp(-lambda * dt));
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t) => t * t * t;
export const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const pulse = (t, speed = 1) => 0.5 + 0.5 * Math.sin(t * speed * Math.PI * 2);
export const pad2 = (n) => String(n).padStart(2, '0');

export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function circleHitsRect(cx, cy, cr, r) {
  const nx = clamp(cx, r.x, r.x + r.w);
  const ny = clamp(cy, r.y, r.y + r.h);
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy <= cr * cr;
}

export const RARITIES = [
  { name: '凡品', color: '#aeb7c5', rgb: '174,183,197', mult: 1, weight: 1 },
  { name: '灵品', color: '#70d7a4', rgb: '112,215,164', mult: 1.38, weight: 1.38 },
  { name: '玄品', color: '#75b9ff', rgb: '117,185,255', mult: 1.85, weight: 1.85 },
  { name: '仙品', color: '#c690ff', rgb: '198,144,255', mult: 2.45, weight: 2.45 },
  { name: '神品', color: '#ffc95c', rgb: '255,201,92', mult: 3.25, weight: 3.25 },
];

export const SLOT_LABEL = { weapon: '武器', head: '头饰', chest: '胸甲', legs: '护腿', boots: '靴子' };
export const SLOT_ORDER = ['weapon', 'head', 'chest', 'legs', 'boots'];

export const ITEM_NAMES = {
  weapon: ['旧木棍', '青竹棍', '赤铜棍', '鎏金棍', '蟠龙棍'],
  head: ['旧布巾', '藤冠', '玄铁盔', '鎏金冠', '星斗冠'],
  chest: ['粗布衣', '藤甲', '玄铁甲', '锁子甲', '蟠龙战袍'],
  legs: ['粗布裈', '藤护腿', '玄铁腿甲', '虎皮战裙', '云纹法裈'],
  boots: ['草鞋', '皮靴', '玄铁靴', '踏云履', '踏星履'],
};

let nextItemId = 1;

export function rollRarity(wave, bonus = 0) {
  const stage = clamp(wave + bonus, 1, 7);
  const weights = [
    Math.max(5, 66 - stage * 9),
    27 + stage * 1.5,
    Math.max(4, 7 + stage * 5),
    Math.max(1, -4 + stage * 4),
    Math.max(0, -8 + stage * 1.8),
  ];
  const total = weights.reduce((sum, n) => sum + n, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < weights.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) return i;
  }
  return 0;
}

export function makeEquipment({ slot, wave = 1, level = 1, rarity = null } = {}) {
  slot = slot || choose(SLOT_ORDER);
  const rank = rarity == null ? rollRarity(wave) : rarity;
  const r = RARITIES[rank];
  const stats = {};
  const power = 1 + wave * 0.22 + level * 0.08;

  if (slot === 'weapon') {
    stats.atk = Math.max(3, Math.round((4 + wave * 2.1) * r.mult * power * 0.62));
    stats.crit = Math.round(([0, 1.2, 2.2, 3.6, 5.2][rank]) * 10) / 10;
  } else if (slot === 'chest' || slot === 'legs') {
    stats.hp = Math.max(20, Math.round((26 + wave * 8.5) * r.mult * power * 0.72));
    stats.def = Math.max(1, Math.round((1.5 + wave * 0.9) * r.mult));
  } else if (slot === 'head') {
    stats.hp = Math.max(12, Math.round((12 + wave * 3.5) * r.mult * power * 0.6));
    stats.crit = Math.round(([0, 0.8, 1.4, 2.4, 3.4][rank]) * 10) / 10;
  } else {
    stats.speed = Math.max(3, Math.round((4 + wave * 1.7) * r.mult * power * 0.55));
    stats.energy = Math.round((0.7 + wave * 0.36) * r.mult * 10) / 10;
    stats.crit = Math.round(([0, 0.5, 1, 2, 3][rank]) * 10) / 10;
  }

  return {
    id: nextItemId++,
    slot,
    rank,
    rarity: r,
    name: ITEM_NAMES[slot][rank],
    stats,
    level: wave,
  };
}

export function makeStarterGear() {
  return {
    weapon: {
      id: nextItemId++,
      slot: 'weapon',
      rank: 0,
      rarity: RARITIES[0],
      name: '旧木棍',
      stats: { atk: 4, crit: 0 },
      level: 1,
    },
    head: {
      id: nextItemId++,
      slot: 'head',
      rank: 0,
      rarity: RARITIES[0],
      name: '旧布巾',
      stats: { hp: 20 },
      level: 1,
    },
    chest: {
      id: nextItemId++,
      slot: 'chest',
      rank: 0,
      rarity: RARITIES[0],
      name: '粗布衣',
      stats: { hp: 45, def: 1 },
      level: 1,
    },
    legs: {
      id: nextItemId++,
      slot: 'legs',
      rank: 0,
      rarity: RARITIES[0],
      name: '粗布裈',
      stats: { hp: 25 },
      level: 1,
    },
    boots: {
      id: nextItemId++,
      slot: 'boots',
      rank: 0,
      rarity: RARITIES[0],
      name: '草鞋',
      stats: { speed: 5 },
      level: 1,
    },
  };
}

export function hydrateItem(item) {
  return {
    ...item,
    stats: { ...(item.stats || {}) },
    rarity: RARITIES[item.rank || 0],
  };
}

export function itemScore(item) {
  if (!item) return 0;
  const s = item.stats || {};
  return Math.round(
    (s.atk || 0) * 4.2 +
      (s.hp || 0) * 0.32 +
      (s.def || 0) * 3.2 +
      (s.speed || 0) * 1.8 +
      (s.energy || 0) * 9 +
      (s.crit || 0) * 22
  );
}

export function itemStatsText(item) {
  const s = item.stats || {};
  const parts = [];
  if (s.atk) parts.push(`攻击 +${s.atk}`);
  if (s.hp) parts.push(`气血 +${s.hp}`);
  if (s.def) parts.push(`护体 +${s.def}`);
  if (s.speed) parts.push(`身法 +${s.speed}`);
  if (s.energy) parts.push(`回灵 +${s.energy}/秒`);
  if (s.crit) parts.push(`会心 +${s.crit}%`);
  return parts;
}

export function formatNumber(n) {
  if (n >= 100000) return `${(n / 10000).toFixed(1)}万`;
  return Math.floor(n).toLocaleString('zh-CN');
}
