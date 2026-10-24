export const HEROES = [
  {
    id: 'wukong',
    name: '孙悟空',
    title: '齐天大圣',
    subtitle: '棍扫凌霄',
    order: 1,
    color: '#f0c56d',
    dark: '#2a1b1d',
    accent: '#c74734',
    desc: '花果山灵石所生，一根如意金箍棒打遍九霄。前左下劈、前右下劈、横扫、回身 360° 下砸，四段棍法越连越烈。',
    passive: '连击每段 +2% 伤害',
    base: { hp: 660, atk: 46, def: 2, speed: 356, crit: 12, critMult: 1.95, regen: 5.6 },
    starterWeapon: 'w-wukong-1',
    set: 'qitian',
  },
  {
    id: 'tangseng',
    name: '唐僧',
    title: '金蝉子',
    subtitle: '一念渡苍生',
    order: 2,
    color: '#e8ddb5',
    dark: '#191b20',
    accent: '#c9a95c',
    desc: '金蝉子转世，左手持九环锡杖。不近身搏杀，只从杖头法球放出火焰、冰晶与混沌法术。',
    passive: '治疗效果 +18%，每秒额外回灵 +2',
    base: { hp: 720, atk: 38, def: 4, speed: 340, crit: 8, critMult: 1.8, regen: 7.2 },
    starterWeapon: 'w-tangseng-1',
    set: 'jinchan',
  },
  {
    id: 'shaseng',
    name: '沙悟净',
    title: '卷帘大将',
    subtitle: '流沙镇河山',
    order: 3,
    color: '#7bd4c2',
    dark: '#101d21',
    accent: '#3c8d86',
    desc: '昔日卷帘大将，右手持双月牙铲。前三段沉猛扫击，第四段向前突刺；护体与格挡极强。',
    passive: '护体 +6，受击时 10% 概率格挡',
    base: { hp: 820, atk: 40, def: 10, speed: 324, crit: 8, critMult: 1.8, regen: 4.8 },
    starterWeapon: 'w-shaseng-1',
    set: 'juanlian',
  },
  {
    id: 'bajie',
    name: '猪八戒',
    title: '天蓬元帅',
    subtitle: '九齿破山河',
    order: 4,
    color: '#e99b80',
    dark: '#211317',
    accent: '#9a4439',
    desc: '天蓬元帅，右手把九齿钉耙斜靠在肩上。挺着肚子小跑，左右挥耙，最后旋身 360° 向下砸。',
    passive: '攻击吸取 3% 伤害为气血',
    base: { hp: 940, atk: 50, def: 5, speed: 306, crit: 10, critMult: 2, regen: 4.4 },
    starterWeapon: 'w-bajie-1',
    set: 'jingtan',
  },
];

export const SLOTS = [
  { id: 'weapon', name: '武器', glyph: '兵' },
  { id: 'head', name: '头饰', glyph: '冠' },
  { id: 'chest', name: '胸甲', glyph: '甲' },
  { id: 'legs', name: '护腿', glyph: '裈' },
  { id: 'boots', name: '靴子', glyph: '履' },
];

export const ARMOR_SETS = [
  {
    id: 'qitian',
    name: '齐天 · 战意',
    favored: 'wukong',
    color: '#d6a651',
    desc: '凤翅冠、黄金甲、虎皮裙、步云履。以连击和会心滚雪球。',
    two: '连击伤害 +8%',
    four: '闪避后的下一击必定会心',
  },
  {
    id: 'jinchan',
    name: '金蝉 · 禅心',
    favored: 'tangseng',
    color: '#e5ddb6',
    desc: '毗卢帽、锦襕袈裟、素罗裙、云头履。以治疗和护盾拖垮对手。',
    two: '治疗效果 +20%',
    four: '每场战斗第一次受击时获得护盾',
  },
  {
    id: 'juanlian',
    name: '卷帘 · 镇水',
    favored: 'shaseng',
    color: '#62c7ba',
    desc: '卷帘盔、流沙甲、水纹裈、踏浪靴。以护体和反伤站场。',
    two: '护体 +8',
    four: '受击时反弹 10% 伤害',
  },
  {
    id: 'jingtan',
    name: '净坛 · 饕餮',
    favored: 'bajie',
    color: '#d87962',
    desc: '逍遥巾、纳福袍、宽腰裈、饱食靴。以吸血和击杀回复续航。',
    two: '吸血 +5%',
    four: '击杀敌人回复 10% 气血',
  },
  {
    id: 'hunyuan',
    name: '混元 · 星斗',
    favored: null,
    color: '#a78ce0',
    desc: '星斗冠、混元甲、云纹裈、踏星履。谁穿都能获得会心与灵巧。',
    two: '会心 +5%',
    four: '灵石获取 +25%',
  },
];

const weapon = (hero, id, name, rank, stats, effect, passive, glow, mods = {}) => ({
  id,
  slot: 'weapon',
  hero,
  name,
  rank,
  kind: 'weapon',
  stats,
  effect,
  passive,
  glow,
  mods: { range: 1, speed: 1, mult: 1, heavy: 1, ...mods },
  desc: effect,
});

export const WEAPONS = [
  weapon('wukong', 'w-wukong-1', '如意金箍棒', 2, { atk: 7, crit: 2 }, '连击第 3 段伤害 +15%', { combo: 0.03 }, '#ffd166', { mult: 1.02 }),
  weapon('wukong', 'w-wukong-2', '定海神针', 3, { atk: 14, crit: 1 }, '破军范围 +20%，击飞更远', { heavyRange: 0.2, heavy: 0.15 }, '#8be4dd', { speed: 0.9, heavy: 1.18 }),
  weapon('wukong', 'w-wukong-3', '蟠龙棍', 2, { atk: 5, crit: 4 }, '普攻第 3 段附加灼烧', { burn: 8 }, '#ff955c', { speed: 1.14, range: 0.96 }),
  weapon('wukong', 'w-wukong-4', '七星如意棍', 3, { atk: 9, crit: 8 }, '会心时回复 5 点灵力', { critEnergy: 5 }, '#cba4ff', { range: 1.05 }),

  weapon('tangseng', 'w-tangseng-1', '九环锡杖', 2, { atk: 5, energy: 1.2 }, '治疗效果 +10%', { heal: 0.1 }, '#f2e6b5', { range: 1.08 }),
  weapon('tangseng', 'w-tangseng-2', '梵音杖', 3, { atk: 9, energy: 0.8 }, '技能伤害 +20%', { skill: 0.2 }, '#ffd47b', { mult: 1.06 }),
  weapon('tangseng', 'w-tangseng-3', '锦襕禅杖', 2, { atk: 4, hp: 50, def: 3 }, '受击减伤 8%', { guard: 0.08 }, '#9bdfaa', { speed: 0.96 }),
  weapon('tangseng', 'w-tangseng-4', '菩提杖', 3, { atk: 6, energy: 2 }, '闪避后回复 10 点灵力', { dashEnergy: 10 }, '#87c8ff', { speed: 1.1 }),

  weapon('shaseng', 'w-shaseng-1', '降妖宝杖', 2, { atk: 9, def: 3 }, '格挡后反震妖物', { thorns: 0.08 }, '#6fd6c4', { heavy: 1.08 }),
  weapon('shaseng', 'w-shaseng-2', '月牙铲', 3, { atk: 13, def: 2 }, '破军范围 +25%，伤害更高', { heavyRange: 0.25 }, '#b8f0d7', { speed: 0.9, range: 1.08, heavy: 1.22 }),
  weapon('shaseng', 'w-shaseng-3', '流沙杖', 2, { atk: 8, hp: 60 }, '攻击吸取 4% 伤害', { lifesteal: 0.04 }, '#78b7c9', { speed: 0.98 }),
  weapon('shaseng', 'w-shaseng-4', '碧水禅杖', 3, { atk: 7, def: 7 }, '护体 +6，受击反伤 8%', { thorns: 0.08, guard: 0.04 }, '#72e0d0', { range: 1.02 }),

  weapon('bajie', 'w-bajie-1', '九齿钉耙', 2, { atk: 10, hp: 40 }, '攻击吸取 4% 伤害', { lifesteal: 0.04 }, '#e9a07b', { range: 1.04, heavy: 1.1 }),
  weapon('bajie', 'w-bajie-2', '上宝沁金耙', 3, { atk: 16, hp: 60 }, '重击伤害 +25%，攻速略慢', { heavy: 0.25 }, '#ffd083', { speed: 0.86, heavy: 1.25 }),
  weapon('bajie', 'w-bajie-3', '破山耙', 2, { atk: 9, hp: 80 }, '破军范围 +20%', { heavyRange: 0.2 }, '#dc8066', { heavy: 1.1 }),
  weapon('bajie', 'w-bajie-4', '饕餮耙', 3, { atk: 11, hp: 100 }, '击杀回复 6% 气血', { killHeal: 0.06 }, '#b85a58', { range: 1.1 }),
];

const armor = (set, slot, id, name, rank, stats, effect, passive) => {
  const meta = ARMOR_SETS.find((s) => s.id === set);
  return {
    id,
    slot,
    set,
    setName: meta.name,
    favored: meta.favored,
    name,
    rank,
    kind: 'armor',
    stats,
    effect,
    passive,
    glow: meta.color,
    desc: effect,
  };
};

export const ARMOR = [
  armor('qitian', 'head', 'a-qitian-head', '凤翅紫金冠', 2, { hp: 30, crit: 2.5 }, '会心 +2.5%，连击更易起势', { crit: 2.5 }),
  armor('qitian', 'chest', 'a-qitian-chest', '锁子黄金甲', 3, { hp: 95, def: 7 }, '连击伤害 +4%', { combo: 0.04 }),
  armor('qitian', 'legs', 'a-qitian-legs', '虎皮战裙', 2, { hp: 50, speed: 8 }, '闪避冷却 -8%', { dashCd: 0.08 }),
  armor('qitian', 'boots', 'a-qitian-boots', '藕丝步云履', 3, { hp: 45, speed: 13 }, '闪避距离 +10%', { dashRange: 0.1 }),

  armor('jinchan', 'head', 'a-jinchan-head', '毗卢帽', 2, { hp: 45, energy: 1 }, '灵力回复 +8%', { energy: 0.08 }),
  armor('jinchan', 'chest', 'a-jinchan-chest', '锦襕袈裟', 3, { hp: 90, def: 6, energy: 1.2 }, '治疗效果 +12%', { heal: 0.12 }),
  armor('jinchan', 'legs', 'a-jinchan-legs', '素罗禅裙', 2, { hp: 55, energy: 1.5 }, '技能冷却 -6%', { cooldown: 0.06 }),
  armor('jinchan', 'boots', 'a-jinchan-boots', '云头履', 3, { hp: 40, speed: 11, energy: 0.6 }, '受击后短暂加速', { hitSpeed: 0.08 }),

  armor('juanlian', 'head', 'a-juanlian-head', '卷帘将盔', 2, { hp: 70, def: 4 }, '格挡概率 +6%', { block: 0.06 }),
  armor('juanlian', 'chest', 'a-juanlian-chest', '流沙玄甲', 3, { hp: 130, def: 9 }, '受击反弹 6% 伤害', { thorns: 0.06 }),
  armor('juanlian', 'legs', 'a-juanlian-legs', '水纹战裈', 2, { hp: 80, def: 3, speed: 4 }, '站在地面时减伤 5%', { guard: 0.05 }),
  armor('juanlian', 'boots', 'a-juanlian-boots', '踏浪靴', 3, { hp: 55, def: 2, speed: 10 }, '闪避后获得水幕护盾', { dashGuard: 0.08 }),

  armor('jingtan', 'head', 'a-jingtan-head', '逍遥巾', 2, { hp: 60 }, '击杀回复 2% 气血', { killHeal: 0.02 }),
  armor('jingtan', 'chest', 'a-jingtan-chest', '纳福宝袍', 3, { hp: 120, atk: 4 }, '吸血 +4%', { lifesteal: 0.04 }),
  armor('jingtan', 'legs', 'a-jingtan-legs', '宽腰战裈', 2, { hp: 95, def: 3 }, '重击范围 +10%', { heavyRange: 0.1 }),
  armor('jingtan', 'boots', 'a-jingtan-boots', '饱食云靴', 3, { hp: 45, speed: 9 }, '拾取灵石回复 1% 气血', { coinHeal: 0.01 }),

  armor('hunyuan', 'head', 'a-hunyuan-head', '星斗冠', 2, { crit: 3, energy: 1 }, '会心 +3%', { crit: 3 }),
  armor('hunyuan', 'chest', 'a-hunyuan-chest', '混元道甲', 3, { hp: 80, atk: 5, def: 3 }, '连击每段 +1% 会心', { critPerCombo: 0.01 }),
  armor('hunyuan', 'legs', 'a-hunyuan-legs', '云纹法裈', 2, { speed: 7, energy: 1 }, '技能伤害 +10%', { skill: 0.1 }),
  armor('hunyuan', 'boots', 'a-hunyuan-boots', '踏星履', 3, { speed: 12, crit: 1.5 }, '灵石获取 +10%', { coin: 0.1 }),
];

export const STARTER_ARMOR = [
  { id: 's-head', slot: 'head', name: '旧布巾', rank: 0, kind: 'armor', stats: { hp: 20 }, effect: '没有特殊效果', passive: {}, glow: '#9aa1aa' },
  { id: 's-chest', slot: 'chest', name: '旧布衣', rank: 0, kind: 'armor', stats: { hp: 40, def: 1 }, effect: '没有特殊效果', passive: {}, glow: '#9aa1aa' },
  { id: 's-legs', slot: 'legs', name: '粗布裈', rank: 0, kind: 'armor', stats: { hp: 25 }, effect: '没有特殊效果', passive: {}, glow: '#9aa1aa' },
  { id: 's-boots', slot: 'boots', name: '草鞋', rank: 0, kind: 'armor', stats: { speed: 5 }, effect: '没有特殊效果', passive: {}, glow: '#9aa1aa' },
];

export const ITEMS = [
  { id: 'i-peach', name: '蟠桃', glyph: '桃', price: 46, desc: '回复 35% 最大气血。', use: { heal: 0.35 } },
  { id: 'i-ginseng', name: '人参果', glyph: '参', price: 82, desc: '回复 60% 最大气血，气血上限 +15。', use: { heal: 0.6, maxHp: 15 } },
  { id: 'i-pill', name: '九转金丹', glyph: '丹', price: 110, desc: '气血上限 +45，并回复 30% 气血。', use: { heal: 0.3, maxHp: 45 } },
  { id: 'i-wind', name: '定风丹', glyph: '风', price: 38, desc: '下一场战斗首次受击减伤 60%。', use: { shield: 0.6 } },
  { id: 'i-pearl', name: '避水珠', glyph: '珠', price: 52, desc: '下一场战斗受到的伤害 -20%。', use: { guardNext: 0.2 } },
  { id: 'i-eye', name: '火眼金睛符', glyph: '眼', price: 60, desc: '本局会心 +8%。', use: { crit: 8 } },
  { id: 'i-wine', name: '醉仙酿', glyph: '酒', price: 70, desc: '回复 25% 气血与全部灵力。', use: { heal: 0.25, energy: 1 } },
  { id: 'i-bodhi', name: '菩提子', glyph: '菩', price: 88, desc: '气血上限 +30，回复 20% 气血。', use: { heal: 0.2, maxHp: 30 } },
  { id: 'i-bean', name: '妖丹', glyph: '妖', price: 0, desc: '可在妖市出售，换 30 灵石。', use: { sell: 30 } },
  { id: 'i-incense', name: '定神香', glyph: '香', price: 44, desc: '立即回复 12 点灵力。', use: { energyFlat: 12 } },
];

export const MONSTERS = [
  { id: 'm-shanxiao', name: '山魈斥候', kind: 'grunt', floor: '1-4', elite: false, desc: '花果山外围最常见的小妖，举着木棒巡山，喜欢成群扑上来。' },
  { id: 'm-wolf', name: '狼烟小妖', kind: 'grunt', floor: '1-5', elite: false, desc: '闻到血腥味就会嚎叫的狼妖，速度比山魈更快。' },
  { id: 'm-bone-archer', name: '白骨弓手', kind: 'archer', floor: '2-6', elite: false, desc: '白骨洞的守陵弓手，箭上带着阴火，会与玩家保持距离。' },
  { id: 'm-spider', name: '盘丝蛛女', kind: 'archer', floor: '3-7', elite: false, desc: '盘丝洞的蛛女，吐出的丝线会拖慢脚步。' },
  { id: 'm-tiger', name: '虎先锋', kind: 'brute', floor: '2-6', elite: false, desc: '黄风岭的先锋虎妖，抡起双刀便是一轮横冲直撞。' },
  { id: 'm-oxhead', name: '牛头鬼', kind: 'brute', floor: '4-7', elite: false, desc: '地府边缘的牛头，力大无穷，震地时整座山都在抖。' },
  { id: 'm-huangfeng', name: '黄风怪', kind: 'brute', floor: '5-8', elite: true, desc: '一口黄风遮天蔽日，近身时会突然加速冲撞。' },
  { id: 'm-liuer', name: '六耳猕猴', kind: 'boss', floor: '6-8', elite: true, desc: '与孙悟空一模一样的六耳猕猴，会模仿你的棍势，也会预判你的闪避。' },
  { id: 'm-redboy', name: '红孩儿', kind: 'boss', floor: '6-8', elite: true, desc: '火云洞圣婴大王，三昧真火落下时，连脚步都会被点燃。' },
  { id: 'm-baigujing', name: '白骨夫人', kind: 'archer', floor: '5-8', elite: true, desc: '三次化形的白骨精，会用假身与冷箭把战场切成几块。' },
  { id: 'm-blackbear', name: '黑熊精', kind: 'boss', floor: '7-9', elite: true, desc: '偷了袈裟的黑风山妖王，皮糙肉厚，擅长防守反击。' },
  { id: 'm-goldhorn', name: '金角大王', kind: 'boss', floor: '7-9', elite: true, desc: '平顶山莲花洞的妖王，手中的葫芦能收人，也会召来银角助阵。' },
];

export const EVENTS = [
  {
    id: 'e-temple',
    title: '古庙残灯',
    text: '荒山深处有一座废弃古庙，佛前长明灯还剩一线火苗。供桌下压着半只干瘪的蟠桃。',
    choices: [
      { label: '添灯上香', desc: '回复 25% 气血，心境澄明。', outcome: { heal: 0.25 } },
      { label: '翻找供桌', desc: '获得 35 灵石，但惊动阴气，失去 10% 气血。', outcome: { coins: 35, damage: 0.1 } },
      { label: '合掌离开', desc: '什么也不发生。', outcome: {} },
    ],
  },
  {
    id: 'e-river',
    title: '流沙渡口',
    text: '黄沙漫过脚踝，一条黑水河横在面前。岸边插着一块木牌：渡河者，留下买路财。',
    choices: [
      { label: '付 30 灵石渡河', desc: '安全过河，并回复 10% 气血。', outcome: { coins: -30, heal: 0.1 }, require: { coins: 30 } },
      { label: '涉水硬闯', desc: '失去 18% 气血，获得一件随机装备。', outcome: { damage: 0.18, randomGear: true } },
      { label: '沿河绕路', desc: '什么也不发生。', outcome: {} },
    ],
  },
  {
    id: 'e-bodhi',
    title: '菩提树下',
    text: '一株老菩提把月光筛成碎金。树根旁坐着个看不见脸的僧人，只问：你为何向西？',
    choices: [
      { label: '坐下听禅', desc: '气血上限 +20，回复 15% 气血。', outcome: { maxHp: 20, heal: 0.15 } },
      { label: '摘一枚菩提子', desc: '获得「菩提子」。', outcome: { item: 'i-bodhi' } },
      { label: '不答，继续赶路', desc: '什么也不发生。', outcome: {} },
    ],
  },
  {
    id: 'e-gamble',
    title: '妖市赌局',
    text: '戴着笑脸面具的妖商摇着骰盅：押大押小，赢了我给你一件宝贝，输了你留下一点血。',
    choices: [
      { label: '押 40 灵石', desc: '五成概率获得 90 灵石，五成概率失去 40 灵石。', outcome: { gamble: 0.5 }, require: { coins: 40 } },
      { label: '押一缕气血', desc: '五成概率获得随机装备，五成概率失去 20% 气血。', outcome: { gambleGear: true } },
      { label: '不赌', desc: '离开妖市。', outcome: {} },
    ],
  },
  {
    id: 'e-whisper',
    title: '六耳低语',
    text: '你听见自己的声音从背后传来：别往前走了，前面那个你，已经输过一次。',
    choices: [
      { label: '回头', desc: '获得一件随机装备，但受到 12% 气血伤害。', outcome: { randomGear: true, damage: 0.12 } },
      { label: '捂住耳朵继续走', desc: '获得 20 灵石。', outcome: { coins: 20 } },
    ],
  },
  {
    id: 'e-well',
    title: '无底洞',
    text: '洞口没有底，只有风。风里夹着细碎的铃声，像有人在下面数着你的脚步。',
    choices: [
      { label: '丢下一枚灵石', desc: '获得 25 灵石与 1 件消耗品。', outcome: { coins: 25, randomItem: true } },
      { label: '攀绳下探', desc: '气血上限 +15，失去 15% 气血。', outcome: { maxHp: 15, damage: 0.15 } },
      { label: '离开', desc: '什么也不发生。', outcome: {} },
    ],
  },
];

export const FINAL_BOSS = {
  id: 'final',
  name: '无相劫主',
  title: '大雷音寺 · 无相',
  desc: '他没有脸，也没有名字。你走了十层，只是为了在他面前承认：这条路还没有走完。',
};

export const TOWER_GUARDIAN = {
  id: 'tower-guardian',
  name: '镇塔明王',
  title: '十层塔前 · 守门者',
  desc: '金身不坏，镇守塔门。他不问来路，只问一句：你凭什么上去？',
};

export const MAP_NODE_TYPES = {
  battle: { label: '妖径', glyph: '战', color: '#d8bd86' },
  elite: { label: '凶煞', glyph: '煞', color: '#e17d62' },
  event: { label: '未知', glyph: '？', color: '#9a8fd0' },
  shop: { label: '妖市', glyph: '市', color: '#75c7a8' },
  tavern: { label: '酒馆', glyph: '酒', color: '#e7b45d' },
  boss: { label: '塔前', glyph: '塔', color: '#f0d49a' },
};

export const ALL_EQUIPMENT = [...WEAPONS, ...ARMOR];
