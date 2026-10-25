import { HEROES, WEAPONS, ARMOR, STARTER_ARMOR, ITEMS, MONSTERS, EVENTS, TOWER_GUARDIAN } from './data.js';
import { hydrateItem, itemScore, clamp } from './core.js';

export function makeSeed() {
  const base = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return base.slice(-8).toUpperCase();
}

export function mulberry32(seed) {
  let a = 0;
  const text = String(seed);
  for (let i = 0; i < text.length; i += 1) a = (Math.imul(31, a) + text.charCodeAt(i)) | 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

export function shuffle(rng, arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function generateMap(seed) {
  const rng = mulberry32(`${seed}:map`);
  const floors = [];
  const nodeMap = new Map();
  const lanes = [0, 1, 2, 3, 4];
  for (let row = 0; row < 10; row += 1) {
    const single = row === 8 || row === 9;
    const count = single ? 1 : 5;
    // 五条固定车道：相邻节点在横向上只差一条车道，路线可以做得更陡。
    const chosenCols = single ? [2] : lanes;
    const nodes = [];
    for (let index = 0; index < count; index += 1) {
      const col = chosenCols[index];
      const type =
        row === 0
          ? 'battle'
          : row === 8
            ? 'tavern'
            : row === 9
              ? 'boss'
              : pickNodeType(rng, row);
      const node = {
        id: `f${row + 1}-${index}`,
        floor: row + 1,
        row,
        col,
        count,
        jitter: single ? 0 : (rng() - 0.5) * 0.7,
        type,
        next: [],
        completed: false,
      };
      nodes.push(node);
      nodeMap.set(node.id, node);
    }
    floors.push(nodes);
  }

  // Guarantee the middle of the road contains at least one real shop and one elite.
  const middle = floors.slice(1, 8).flat();
  if (!middle.some((node) => node.type === 'elite')) {
    const target = middle.filter((node) => node.type === 'battle');
    if (target.length) pick(rng, target).type = 'elite';
  }
  if (!middle.some((node) => node.type === 'shop')) {
    const target = middle.filter((node) => node.type !== 'elite');
    if (target.length) pick(rng, target).type = 'shop';
  }
  if (middle.filter((node) => node.type === 'battle').length < 3) {
    const target = middle.filter((node) => ['event', 'shop'].includes(node.type));
    target.slice(0, 3).forEach((node) => { node.type = 'battle'; });
  }

  // 非线性的五路连接图：每个节点 1–3 条出边，相邻两层之间允许直上、左斜、右斜。
  // 每个 pattern 都是“不交叉”的单调目标序列；目标索引跨度最多 2，配合地图高度保持陡峭。
  const EDGE_PATTERNS = [
    [[0, 1], [1, 2], [2, 3], [3, 4], [4]],       // 右斜梯
    [[0], [0, 1], [1, 2], [2, 3], [3, 4]],       // 左斜梯
    [[0], [0, 1, 2], [2, 3], [3, 4], [4]],       // 中央三岔
    [[0], [0, 1], [1, 2, 3], [3, 4], [4]],       // 中央向左
    [[0], [0, 1], [1, 2], [2, 3, 4], [4]],       // 中央向右靠后
    [[0, 1], [1, 2], [2], [2, 3], [3, 4]],       // 收束再分开
  ];
  let lastPattern = -1;
  for (let row = 0; row < 7; row += 1) {
    const current = [...floors[row]].sort((a, b) => a.col - b.col);
    const next = [...floors[row + 1]].sort((a, b) => a.col - b.col);
    // 70% 使用“4 个分叉节点”的模板，保证大部分节点不是单线死路。
    const richPatterns = [0, 1, 5];
    let patternIndex = rng() < 0.7
      ? richPatterns[Math.floor(rng() * richPatterns.length)]
      : Math.floor(rng() * EDGE_PATTERNS.length);
    if (patternIndex === lastPattern) {
      patternIndex = (patternIndex + 1 + Math.floor(rng() * (EDGE_PATTERNS.length - 1))) % EDGE_PATTERNS.length;
    }
    lastPattern = patternIndex;
    const pattern = EDGE_PATTERNS[patternIndex];
    for (let i = 0; i < current.length; i += 1) {
      current[i].next = pattern[i].map((index) => next[index].id);
    }
  }
  // 第 9 层酒馆和第 10 层塔前：五路收束到同一个节点。
  for (const node of floors[7]) node.next = [floors[8][0].id];
  floors[8][0].next = [floors[9][0].id];
  for (const node of nodeMap.values()) {
    node.next = [...new Set(node.next)];
  }
  return {
    seed,
    floors,
    nodes: nodeMap,
    start: floors[0].map((node) => node.id),
  };
}

function pickNodeType(rng, row) {
  const roll = rng();
  if (row <= 1) {
    if (roll < 0.55) return 'battle';
    if (roll < 0.8) return 'event';
    return 'elite';
  }
  if (row === 7) {
    if (roll < 0.45) return 'battle';
    if (roll < 0.75) return 'elite';
    return 'event';
  }
  if (roll < 0.4) return 'battle';
  if (roll < 0.62) return 'event';
  if (roll < 0.78) return 'elite';
  return 'shop';
}

export function starterLoadout(heroId) {
  const hero = HEROES.find((item) => item.id === heroId);
  const starterWeapon = WEAPONS.find((item) => item.id === hero.starterWeapon) || WEAPONS[0];
  const loadout = {
    weapon: hydrateItem(starterWeapon),
    head: hydrateItem(STARTER_ARMOR[0]),
    chest: hydrateItem(STARTER_ARMOR[1]),
    legs: hydrateItem(STARTER_ARMOR[2]),
    boots: hydrateItem(STARTER_ARMOR[3]),
  };
  return loadout;
}

export function scaleItem(item, floor = 1, elite = false) {
  const clone = hydrateItem(item);
  const mult = 1 + (floor - 1) * 0.045 + (elite ? 0.12 : 0);
  for (const [key, value] of Object.entries(clone.stats)) {
    if (key === 'crit') clone.stats[key] = Math.round(value * (1 + (floor - 1) * 0.012) * 10) / 10;
    else clone.stats[key] = Math.round(value * mult);
  }
  clone.level = floor;
  return clone;
}

export function randomEquipment(heroId, floor, rng, elite = false) {
  const candidateWeapons = WEAPONS.filter((item) => item.hero === heroId);
  const armor = ARMOR;
  if (rng() < 0.42) return scaleItem(pick(rng, candidateWeapons), floor, elite);
  return scaleItem(pick(rng, armor), floor, elite);
}

export function hydrateConsumable(item) {
  return { ...item, kind: 'item', rarity: { name: '奇物', color: '#d9c18b' } };
}

export function makeRewardOptions(run, floor, elite, count = 3) {
  const rng = mulberry32(`${run.seed}:reward:${floor}:${elite}:${run.rewardsTaken || 0}`);
  const options = [];
  options.push({ type: 'equipment', item: randomEquipment(run.heroId, floor, rng, elite) });
  options.push({ type: 'equipment', item: randomEquipment(run.heroId, floor, rng, elite) });
  if (elite || rng() < 0.7) options.push({ type: 'item', item: hydrateConsumable(pick(rng, ITEMS)) });
  else options.push({ type: 'equipment', item: randomEquipment(run.heroId, floor, rng, true) });
  return options.slice(0, count);
}

export function makeShopOffers(run, floor) {
  const rng = mulberry32(`${run.seed}:shop:${floor}:${run.shopSeed || 0}`);
  const offers = [];
  for (let i = 0; i < 2; i += 1) {
    const item = randomEquipment(run.heroId, floor, rng, rng() < 0.35);
    offers.push({ type: 'equipment', item, price: equipmentPrice(item) });
  }
  const item = hydrateConsumable(pick(rng, ITEMS));
  offers.push({ type: 'item', item, price: item.price });
  return offers;
}

export function equipmentPrice(item) {
  return Math.max(24, Math.round(itemScore(item) * 0.42 + (item.rank || 0) * 14));
}

export function pickEvent(run, floor) {
  const rng = mulberry32(`${run.seed}:event:${floor}:${run.eventSeed || 0}`);
  return pick(rng, EVENTS);
}

export function buildEncounter(run, node) {
  const rng = mulberry32(`${run.seed}:battle:${node.id}`);
  const allAdds = MONSTERS.filter((monster) => !monster.elite);
  const elitePool = MONSTERS.filter((monster) => monster.elite);
  const floor = node.floor;
  const addPool = allAdds.filter((monster) => {
    if (floor <= 1) return monster.kind === 'grunt';
    if (floor <= 3) return monster.kind !== 'brute';
    return true;
  });
  const specs = [];
  if (node.type === 'boss') {
    return {
      specs: [{
        kind: 'boss',
        name: TOWER_GUARDIAN.name,
        hpScale: 1.28,
        damageScale: 1.22,
        boss: true,
        finalBoss: true,
      }],
      label: `第十层 · ${TOWER_GUARDIAN.name}`,
      finalBoss: true,
    };
  }
  if (node.type === 'elite') {
    const elite = pick(rng, elitePool);
    specs.push({
      kind: elite.kind,
      name: elite.name,
      hpScale: elite.kind === 'boss' ? 0.32 + floor * 0.05 : 2.2 + floor * 0.16,
      damageScale: 1.02 + floor * 0.035,
      boss: true,
    });
    const addCount = rng() < 0.5 ? 1 : 2;
    for (let i = 0; i < addCount; i += 1) {
      const add = pick(rng, addPool);
      specs.push({
        kind: add.kind,
        name: add.name,
        hpScale: 0.75 + floor * 0.03,
        damageScale: 0.85 + floor * 0.02,
      });
    }
  } else {
    const count = floor <= 2 ? 2 : 3;
    for (let i = 0; i < count; i += 1) {
      const monster = pick(rng, addPool);
      specs.push({
        kind: monster.kind,
        name: monster.name,
        hpScale: 0.9 + floor * 0.055,
        damageScale: 0.9 + floor * 0.025,
      });
    }
  }
  return {
    specs,
    label: node.type === 'elite' ? `第 ${floor} 层 · 凶煞` : `第 ${floor} 层 · 妖径`,
  };
}

export function enemyLabel(spec) {
  return spec.name || '妖物';
}
