import { HEROES, SLOTS, ARMOR_SETS, WEAPONS, ARMOR, ITEMS, MONSTERS, MAP_NODE_TYPES } from './data.js';
import { RARITIES, itemStatsText } from './core.js';

const HERO_ART_META = {
  wukong: { halo: '#e0a83e', robe: '#8f2f2b', robe2: '#d0a14e', skin: '#6f4432', weapon: 'staff' },
  tangseng: { halo: '#efdba7', robe: '#e8e0ca', robe2: '#b69454', skin: '#d8b08a', weapon: 'ringstaff' },
  shaseng: { halo: '#4bb7a8', robe: '#315b61', robe2: '#7fc5b7', skin: '#a87555', weapon: 'shovel' },
  bajie: { halo: '#c46a58', robe: '#5b2e31', robe2: '#d19b78', skin: '#b97a61', weapon: 'rake' },
};

export function heroArt(heroId) {
  const meta = HERO_ART_META[heroId] || HERO_ART_META.wukong;
  const hero = HEROES.find((h) => h.id === heroId) || HEROES[0];
  const id = heroId;
  const weapon = weaponSvg(meta.weapon, id);
  const head =
    heroId === 'wukong'
      ? `
      <path d="M405 348 Q366 326 358 368 Q358 400 390 408" fill="${meta.skin}" opacity=".9"/>
      <path d="M495 348 Q534 326 542 368 Q542 400 510 408" fill="${meta.skin}" opacity=".9"/>
      <ellipse cx="450" cy="344" rx="64" ry="70" fill="${meta.skin}"/>
      <ellipse cx="468" cy="352" rx="39" ry="45" fill="#d6a77c"/>
      <path d="M415 310 Q450 286 488 310" stroke="#e6bf67" stroke-width="6" fill="none" stroke-linecap="round"/>
      <circle cx="450" cy="300" r="11" fill="#f6d47b"/>
      <path d="M423 332 Q443 322 463 332" stroke="#2c1914" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M454 340 Q466 333 480 340" stroke="#2c1914" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M458 341 q7 4 0 8" stroke="#1f130f" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M462 384 q17 6 30 -3" stroke="#6d3b2a" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M476 371 l10 2" stroke="#3c2419" stroke-width="3" stroke-linecap="round"/>
      <path d="M400 320 Q378 294 332 284" stroke="#d7a44a" stroke-width="6" fill="none" stroke-linecap="round"/>
      <path d="M400 320 Q370 302 324 306" stroke="#b34535" stroke-width="3.5" fill="none" stroke-linecap="round"/>`
      : heroId === 'tangseng'
        ? `
      <circle cx="450" cy="346" r="68" fill="${meta.skin}"/>
      <path d="M386 330 Q450 282 514 330" fill="#d9c9a2" opacity=".2"/>
      <path d="M390 356 Q450 330 510 356" stroke="#b19055" stroke-width="4" fill="none"/>
      <path d="M416 354 q12 6 24 0" stroke="#5d4231" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M462 354 q12 6 24 0" stroke="#5d4231" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M440 388 q10 4 20 0" stroke="#8c5b49" stroke-width="3" fill="none" stroke-linecap="round"/>
      <circle cx="450" cy="444" r="6" fill="#d9b35f"/>
      <circle cx="450" cy="470" r="5" fill="#d9b35f"/>
      <circle cx="450" cy="496" r="4" fill="#d9b35f"/>`
        : heroId === 'shaseng'
          ? `
      <circle cx="450" cy="348" r="68" fill="${meta.skin}"/>
      <path d="M396 392 Q450 448 504 392 Q496 436 450 446 Q404 436 396 392" fill="#2c2925" opacity=".75"/>
      <path d="M390 326 Q450 292 510 326" stroke="#383231" stroke-width="7" fill="none" stroke-linecap="round"/>
      <path d="M410 350 q14 -7 28 0" stroke="#1d1715" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M462 350 q14 -7 28 0" stroke="#1d1715" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M428 400 q22 6 44 0" stroke="#5a3b30" stroke-width="3" fill="none" stroke-linecap="round"/>`
          : `
      <ellipse cx="450" cy="354" rx="80" ry="72" fill="${meta.skin}"/>
      <path d="M370 326 Q334 298 320 350 Q322 388 366 392" fill="${meta.skin}"/>
      <path d="M530 326 Q566 298 580 350 Q578 388 534 392" fill="${meta.skin}"/>
      <ellipse cx="450" cy="378" rx="34" ry="25" fill="#d99c83"/>
      <circle cx="438" cy="374" r="4.5" fill="#71412f"/>
      <circle cx="462" cy="374" r="4.5" fill="#71412f"/>
      <path d="M432 398 q18 8 36 0" stroke="#814b3a" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M432 398 l-9 12 M468 398 l9 12" stroke="#e7d7b0" stroke-width="4" stroke-linecap="round"/>
      <path d="M388 314 Q450 278 512 314" stroke="#e0b18a" stroke-width="5" fill="none"/>`;

  const body =
    heroId === 'wukong'
      ? `
      <path d="M350 700 Q330 560 388 478 L512 478 Q570 560 550 700 Z" fill="url(#robe-${id})"/>
      <path d="M388 478 Q450 505 512 478 L530 540 Q450 580 370 540 Z" fill="${meta.robe2}" opacity=".86"/>
      <path d="M450 474 L450 630" stroke="#e4bd66" stroke-width="5" opacity=".7"/>
      <path d="M330 530 Q250 570 240 650 Q292 620 342 610" fill="#b94533" opacity=".9"/>
      <path d="M570 530 Q658 552 680 628 Q620 604 566 612" fill="#b94533" opacity=".75"/>`
      : heroId === 'tangseng'
        ? `
      <path d="M336 710 Q320 558 388 472 L512 472 Q584 558 566 710 Z" fill="url(#robe-${id})"/>
      <path d="M388 472 Q450 500 512 472 L544 530 L450 608 L356 530 Z" fill="${meta.robe2}" opacity=".55"/>
      <path d="M450 482 L450 650" stroke="#b39254" stroke-width="4" opacity=".8"/>
      <path d="M348 520 Q300 600 310 710" stroke="#d6c6a0" stroke-width="18" opacity=".32"/>
      <path d="M552 520 Q600 600 590 710" stroke="#d6c6a0" stroke-width="18" opacity=".32"/>`
        : heroId === 'shaseng'
          ? `
      <path d="M330 710 Q310 546 384 462 L516 462 Q590 546 570 710 Z" fill="url(#robe-${id})"/>
      <path d="M376 476 Q450 514 524 476 L546 550 Q450 594 354 550 Z" fill="${meta.robe2}" opacity=".45"/>
      <path d="M380 500 L350 620 L390 630" stroke="#a0ded3" stroke-width="6" opacity=".35" fill="none"/>
      <path d="M520 500 L550 620 L510 630" stroke="#a0ded3" stroke-width="6" opacity=".35" fill="none"/>`
          : `
      <path d="M304 710 Q292 534 384 460 L516 460 Q610 534 596 710 Z" fill="url(#robe-${id})"/>
      <circle cx="450" cy="566" r="78" fill="#7d4035" opacity=".6"/>
      <path d="M390 470 Q450 505 510 470" stroke="#d6a578" stroke-width="7" fill="none" opacity=".55"/>
      <path d="M336 536 Q292 586 300 660" stroke="#d6a578" stroke-width="12" opacity=".25"/>
      <path d="M564 536 Q608 586 600 660" stroke="#d6a578" stroke-width="12" opacity=".25"/>`;

  return `
  <svg class="hero-art-svg" viewBox="0 0 900 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs>
      <radialGradient id="halo-${id}" cx="50%" cy="46%" r="52%">
        <stop offset="0" stop-color="${meta.halo}" stop-opacity=".35"/>
        <stop offset=".58" stop-color="${meta.halo}" stop-opacity=".09"/>
        <stop offset="1" stop-color="${meta.halo}" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="robe-${id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${meta.robe}"/>
        <stop offset="1" stop-color="#120e12"/>
      </linearGradient>
    </defs>
    <circle cx="450" cy="390" r="360" fill="url(#halo-${id})"/>
    <g opacity=".26" fill="none" stroke="${meta.halo}" stroke-width="2">
      <path d="M70 610 Q210 540 350 596 T710 570 T900 600"/>
      <path d="M40 660 Q220 590 390 646 T760 620 T920 646"/>
      <circle cx="450" cy="390" r="245" stroke-dasharray="3 14"/>
    </g>
    <g opacity=".2" fill="${meta.halo}">
      <circle cx="190" cy="220" r="3"/><circle cx="720" cy="180" r="4"/>
      <circle cx="760" cy="420" r="2"/><circle cx="150" cy="470" r="2"/>
      <circle cx="660" cy="620" r="3"/><circle cx="245" cy="680" r="2"/>
    </g>
    ${weapon}
    ${body}
    ${head}
    <g opacity=".65">
      <path d="M270 710 Q450 680 630 710 L700 900 L200 900 Z" fill="#08080b"/>
    </g>
  </svg>`;
}

function weaponSvg(type, id) {
  if (type === 'staff') {
    return `<g>
      <path d="M250 735 L660 260" stroke="#7d4a25" stroke-width="18" stroke-linecap="round"/>
      <path d="M252 735 L662 260" stroke="#f0c45e" stroke-width="6" stroke-linecap="round" opacity=".9"/>
      <circle cx="660" cy="260" r="20" fill="#f6d781"/><circle cx="250" cy="735" r="17" fill="#e9bd5e"/>
    </g>`;
  }
  if (type === 'ringstaff') {
    return `<g>
      <path d="M665 120 L680 730" stroke="#c9a65d" stroke-width="12" stroke-linecap="round"/>
      <path d="M665 120 L680 730" stroke="#f5e4b4" stroke-width="3" opacity=".7"/>
      <g fill="none" stroke="#e6cd8e" stroke-width="4">
        <circle cx="658" cy="155" r="18"/><circle cx="664" cy="195" r="16"/><circle cx="670" cy="233" r="14"/>
      </g>
    </g>`;
  }
  if (type === 'shovel') {
    return `<g>
      <path d="M245 735 L690 180" stroke="#7b5a3f" stroke-width="14" stroke-linecap="round"/>
      <path d="M630 180 q80 -74 126 -20 q24 52 -60 82 q-54 14 -66 -62 Z" fill="#d4e5dd" stroke="#7fd8c9" stroke-width="5"/>
      <path d="M286 704 q-80 74 -126 20 q-24 -52 60 -82 q54 -14 66 62 Z" fill="#d4e5dd" stroke="#7fd8c9" stroke-width="4" opacity=".85"/>
    </g>`;
  }
  return `<g>
    <path d="M250 735 L690 180" stroke="#8b5439" stroke-width="15" stroke-linecap="round"/>
    <path d="M674 204 L765 135" stroke="#d7b47b" stroke-width="18" stroke-linecap="round"/>
    <g stroke="#e8c88e" stroke-width="9" stroke-linecap="round">
      <path d="M742 133 L736 236"/><path d="M760 132 L755 238"/><path d="M778 129 L774 236"/>
    </g>
  </g>`;
}

export function rankColor(rank) {
  return RARITIES[Math.max(0, Math.min(RARITIES.length - 1, rank || 0))].color;
}

export function statLine(item) {
  if (!item.stats) return item.kind === 'item' ? '使用后生效' : '无额外属性';
  const parts = itemStatsText(item);
  return parts.length ? parts.join(' · ') : '无额外属性';
}

export function formatKey(code) {
  if (!code) return '未绑定';
  const map = {
    Space: '空格',
    ShiftLeft: '左 Shift',
    ShiftRight: '右 Shift',
    Escape: 'Esc',
    ArrowLeft: '←',
    ArrowRight: '→',
    ArrowUp: '↑',
    ArrowDown: '↓',
    Enter: 'Enter',
    NumpadEnter: '小键盘 Enter',
  };
  if (map[code]) return map[code];
  return code.replace('Key', '').replace('Digit', '').replace('Numpad', '');
}

export function itemCard(item, extra = '') {
  const color = item.rarity?.color || rankColor(item.rank);
  return `<article class="data-card" style="--rarity:${color}">
    <div class="data-card-head">
      <span class="data-card-name">${item.name}</span>
      <span class="data-card-rank">${item.rarity?.name || RARITIES[item.rank || 0].name}</span>
    </div>
    <div class="data-card-meta">${item.kind === 'item' ? '消耗品' : `${SLOTS.find((s) => s.id === item.slot)?.name || ''}${item.setName ? ' · ' + item.setName : ''}${item.hero ? ' · ' + (HEROES.find((h) => h.id === item.hero)?.name || '') : ''}`}</div>
    <div class="data-card-stats">${statLine(item)}</div>
    <div class="data-card-effect">${item.effect || item.desc || ''}</div>
    ${extra}
  </article>`;
}

export function nodeGlyph(type) {
  return MAP_NODE_TYPES[type]?.glyph || '？';
}

export function nodeColor(type) {
  return MAP_NODE_TYPES[type]?.color || '#d8bd86';
}

export function bossArt() {
  return `<svg viewBox="0 0 900 700" class="boss-art-svg" aria-hidden="true">
    <defs>
      <radialGradient id="boss-halo" cx="50%" cy="46%" r="55%">
        <stop offset="0" stop-color="#ba4b3c" stop-opacity=".42"/>
        <stop offset=".62" stop-color="#6f2527" stop-opacity=".12"/>
        <stop offset="1" stop-color="#060608" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <circle cx="450" cy="300" r="330" fill="url(#boss-halo)"/>
    <g opacity=".22" fill="none" stroke="#caa05e" stroke-width="2">
      <circle cx="450" cy="300" r="205" stroke-dasharray="2 12"/>
      <path d="M90 610 Q260 500 450 590 T900 560"/>
    </g>
    <g>
      <path d="M300 670 Q320 470 390 410 L510 410 Q580 470 600 670 Z" fill="#180f15"/>
      <path d="M390 410 Q450 460 510 410 L560 510 Q450 560 340 510 Z" fill="#2b161b"/>
      <circle cx="450" cy="330" r="90" fill="#241317"/>
      <path d="M380 310 Q330 230 355 170 Q390 250 420 280 Z" fill="#d4bd94" opacity=".65"/>
      <path d="M520 310 Q570 230 545 170 Q510 250 480 280 Z" fill="#d4bd94" opacity=".65"/>
      <path d="M398 320 q16 -8 32 0" stroke="#ff8c55" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M470 320 q16 -8 32 0" stroke="#ff8c55" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M450 338 q8 10 0 20" stroke="#6e2b28" stroke-width="4" fill="none"/>
      <path d="M408 360 l22 18 l-18 20 M492 360 l-22 18 l18 20" stroke="#8e3f34" stroke-width="2.5" fill="none" opacity=".8"/>
      <path d="M320 470 Q250 520 235 610" stroke="#684037" stroke-width="22" fill="none" stroke-linecap="round"/>
      <path d="M580 470 Q650 520 665 610" stroke="#684037" stroke-width="22" fill="none" stroke-linecap="round"/>
    </g>
    <g opacity=".4" fill="#e5c481">
      <circle cx="220" cy="260" r="2"/><circle cx="690" cy="220" r="3"/><circle cx="720" cy="520" r="2"/>
      <circle cx="170" cy="500" r="2"/><circle cx="520" cy="610" r="3"/>
    </g>
  </svg>`;
}

export function allCodexData() {
  return { HEROES, SLOTS, ARMOR_SETS, WEAPONS, ARMOR, ITEMS, MONSTERS };
}

export function nodeIcon(type) {
  const common = 'class="node-icon-svg" viewBox="0 0 32 32" aria-hidden="true"';
  if (type === 'battle') {
    return `<svg ${common}>
      <path d="M16 28 V10 M11 14 H21 M10 25 H22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M16 5 L11 12 L16 10 L21 12 Z" fill="currentColor" opacity=".85"/>
      <path d="M13 28 H19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".6"/>
    </svg>`;
  }
  if (type === 'elite') {
    return `<svg ${common}>
      <path d="M9 12 Q7 6 12 4 L16 9 L20 4 Q25 6 23 12 L25 20 Q24 27 16 28 Q8 27 7 20 Z" fill="currentColor" opacity=".16" stroke="currentColor" stroke-width="1.6"/>
      <path d="M11 15 l4 -1 l-2 4 M21 15 l-4 -1 l2 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M12 23 Q16 20 20 23" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    </svg>`;
  }
  if (type === 'event') {
    return `<svg ${common}>
      <path d="M16 5 Q25 9 25 17 Q25 25 16 28 Q7 25 7 17 Q7 9 16 5 Z" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".65"/>
      <circle cx="16" cy="16" r="6.2" fill="currentColor" opacity=".14"/>
      <path d="M13 14 Q16 10.5 19 14 Q19 16 16 17 Q16 18.5 16 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <circle cx="16" cy="23" r="1.2" fill="currentColor"/>
      <path d="M10 10 l2 2 M22 10 l-2 2 M10 23 l2 -2 M22 23 l-2 -2" fill="none" stroke="currentColor" stroke-width="1" opacity=".55"/>
    </svg>`;
  }
  if (type === 'shop') {
    return `<svg ${common}>
      <path d="M6 13 L8 7 H24 L26 13 Z" fill="currentColor" opacity=".14" stroke="currentColor" stroke-width="1.5"/>
      <path d="M8 13 V26 H24 V13 M8 13 Q11 16 13 13 Q16 16 19 13 Q21 16 24 13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M13 26 V19 H19 V26" fill="none" stroke="currentColor" stroke-width="1.3" opacity=".7"/>
      <circle cx="16" cy="10" r="1.2" fill="currentColor"/>
    </svg>`;
  }
  if (type === 'tavern') {
    return `<svg ${common}>
      <path d="M10 12 Q7 9 11 7 Q8 4 13 3 M17 12 Q14 9 18 7 Q15 4 20 3" fill="none" stroke="currentColor" stroke-width="1.1" opacity=".55"/>
      <path d="M9 14 Q8 24 14 27 H18 Q24 24 23 14 Z" fill="currentColor" opacity=".12" stroke="currentColor" stroke-width="1.5"/>
      <path d="M10 18 H22 M12 22 H20" fill="none" stroke="currentColor" stroke-width="1.1" opacity=".55"/>
      <path d="M24 17 Q28 19 26 23 Q25 25 23 24" fill="none" stroke="currentColor" stroke-width="1.5"/>
    </svg>`;
  }
  return `<svg ${common}>
    <path d="M6 27 V12 L10 8 L14 12 V27 M18 27 V12 L22 8 L26 12 V27 M4 27 H28" fill="currentColor" opacity=".1" stroke="currentColor" stroke-width="1.5"/>
    <path d="M12 21 Q16 17 20 21 L19 27 H13 Z" fill="currentColor" opacity=".2"/>
    <circle cx="16" cy="20" r="2" fill="currentColor"/>
    <path d="M12 8 L8 2 M20 8 L24 2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
  </svg>`;
}

export function towerArt() {
  const tiers = Array.from({ length: 7 }, (_, i) => {
    const y = 650 - i * 72;
    const w = 230 - i * 24;
    const x = 450 - w / 2;
    return `<g>
      <path d="M${x - 28} ${y} Q${450} ${y - 22} ${x + w + 28} ${y} Q${450} ${y + 10} ${x - 28} ${y} Z" fill="#191218" stroke="#8f6b3b" stroke-width="1.6"/>
      <rect x="${x + 18}" y="${y - 52}" width="${w - 36}" height="46" fill="#231720" stroke="#6f4e2e" stroke-width="1"/>
      <rect x="${450 - 17}" y="${y - 43}" width="34" height="28" fill="#b88745" opacity=".36"/>
      <path d="M${450 - 17} ${y - 43} H${450 + 17} M${450} ${y - 43} V${y - 15}" stroke="#e2b970" stroke-width="1" opacity=".5"/>
    </g>`;
  }).join('');
  return `<svg viewBox="0 0 900 760" class="tower-art-svg" aria-hidden="true">
    <defs>
      <radialGradient id="tower-moon" cx="50%" cy="50%" r="50%">
        <stop offset="0" stop-color="#f5e4b4" stop-opacity=".8"/>
        <stop offset=".55" stop-color="#cba35f" stop-opacity=".22"/>
        <stop offset="1" stop-color="#cba35f" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="tower-ink" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#0b0b10"/>
        <stop offset="1" stop-color="#1d1720"/>
      </linearGradient>
    </defs>
    <rect width="900" height="760" fill="url(#tower-ink)"/>
    <circle cx="675" cy="168" r="138" fill="url(#tower-moon)"/>
    <circle cx="675" cy="168" r="48" fill="#e9d6a6" opacity=".24"/>
    <g fill="none" stroke="#c8a363" stroke-width="1" opacity=".18">
      <path d="M-40 430 Q160 380 320 430 T700 408 T980 440"/>
      <path d="M-30 520 Q210 470 380 512 T760 486 T980 520"/>
    </g>
    <g opacity=".9">
      ${tiers}
      <path d="M420 650 H480 L500 690 H400 Z" fill="#100d13" stroke="#7d5b34" stroke-width="1.4"/>
      <path d="M450 650 V80 M450 80 L420 110 H480 Z" fill="#b38a50" opacity=".55"/>
      <circle cx="450" cy="72" r="7" fill="#edc879" opacity=".7"/>
    </g>
    <g opacity=".65" fill="#07070b">
      <ellipse cx="380" cy="690" rx="240" ry="34"/>
    </g>
    <g opacity=".7" fill="none" stroke="#c9a268" stroke-width="1.2">
      <path d="M300 690 Q330 650 360 690" />
      <path d="M510 690 Q540 648 570 690" />
    </g>
  </svg>`;
}

export function uiIcon(name) {
  const open = '<svg class="ui-icon" viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
  if (name === 'bag') {
    return `${open}<path d="M10 12 V9 a6 6 0 0 1 12 0 v3"/><path d="M7 12 H25 L23 28 H9 Z"/><path d="M12 16 V23 M16 16 V23 M20 16 V23" opacity=".55"/></svg>`;
  }
  if (name === 'map') {
    return `${open}<path d="M4 8 L12 5 L20 8 L28 5 V25 L20 28 L12 25 L4 28 Z"/><path d="M12 5 V25 M20 8 V28" opacity=".55"/><path d="M15 14 h4 M17 12 v4" opacity=".7"/></svg>`;
  }
  return `${open}<path d="M5 9 H27 M5 16 H27 M5 23 H27"/><circle cx="11" cy="9" r="2.2"/><circle cx="21" cy="16" r="2.2"/><circle cx="14" cy="23" r="2.2"/></svg>`;
}
