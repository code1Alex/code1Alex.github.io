import {
  VIEW_W,
  VIEW_H,
  GROUND_Y,
  FONT_TITLE,
  FONT_UI,
  clamp,
  lerp,
} from './core.js';

export function hexToRgba(hex, alpha = 1) {
  if (!hex) return `rgba(255,255,255,${alpha})`;
  if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex;
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function roundedPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function fillRound(ctx, x, y, w, h, r, fill) {
  roundedPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function strokeRound(ctx, x, y, w, h, r, stroke, width = 1) {
  roundedPath(ctx, x, y, w, h, r);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.stroke();
}

export function glow(ctx, x, y, radius, color, alpha = 1) {
  if (radius <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, hexToRgba(color, alpha));
  g.addColorStop(0.4, hexToRgba(color, alpha * 0.42));
  g.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

export function drawPanel(ctx, x, y, w, h, opts = {}) {
  const {
    fill = 'rgba(10,13,23,0.82)',
    border = 'rgba(215,182,113,0.35)',
    radius = 8,
    accent = true,
    inner = true,
  } = opts;
  ctx.save();
  roundedPath(ctx, x, y, w, h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.stroke();
  if (inner) {
    roundedPath(ctx, x + 3, y + 3, w - 6, h - 6, Math.max(2, radius - 2));
    ctx.strokeStyle = 'rgba(255,255,255,0.045)';
    ctx.stroke();
  }
  if (accent) {
    ctx.strokeStyle = 'rgba(232,197,121,0.72)';
    ctx.lineWidth = 1.4;
    const c = 11;
    ctx.beginPath();
    ctx.moveTo(x + 8, y + c);
    ctx.lineTo(x + 8, y + 8);
    ctx.lineTo(x + c, y + 8);
    ctx.moveTo(x + w - c, y + 8);
    ctx.lineTo(x + w - 8, y + 8);
    ctx.lineTo(x + w - 8, y + c);
    ctx.moveTo(x + 8, y + h - c);
    ctx.lineTo(x + 8, y + h - 8);
    ctx.lineTo(x + c, y + h - 8);
    ctx.moveTo(x + w - c, y + h - 8);
    ctx.lineTo(x + w - 8, y + h - 8);
    ctx.lineTo(x + w - 8, y + h - c);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawBar(ctx, x, y, w, h, pct, colorA, colorB, opts = {}) {
  const {
    bg = 'rgba(0,0,0,0.52)',
    border = 'rgba(238,213,158,0.24)',
    glowColor = null,
    radius = h / 2,
  } = opts;
  ctx.save();
  roundedPath(ctx, x, y, w, h, radius);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.stroke();

  const inset = 2;
  const innerW = Math.max(0, (w - inset * 2) * clamp(pct, 0, 1));
  if (innerW > 1) {
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, colorB);
    g.addColorStop(0.52, colorA);
    g.addColorStop(1, colorB);
    ctx.save();
    roundedPath(ctx, x + inset, y + inset, innerW, h - inset * 2, Math.max(1, radius - 1));
    ctx.clip();
    ctx.fillStyle = g;
    ctx.fillRect(x + inset, y + inset, innerW, h - inset * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(x + inset, y + inset, innerW, Math.max(1, h * 0.26));
    ctx.restore();
    if (glowColor && innerW > 4) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, x + innerW, y + h / 2, h * 1.1, glowColor, 0.22);
      ctx.restore();
    }
  }
  ctx.restore();
}

export function drawKeycap(ctx, x, y, size, label, active = false, accent = '#e6c884') {
  ctx.save();
  fillRound(ctx, x, y, size, size, 5, active ? hexToRgba(accent, 0.22) : 'rgba(5,7,12,0.72)');
  strokeRound(ctx, x, y, size, size, 5, active ? hexToRgba(accent, 0.9) : 'rgba(232,210,160,0.24)', 1);
  ctx.fillStyle = active ? accent : 'rgba(235,221,190,0.78)';
  ctx.font = `600 ${size * 0.52}px ${FONT_UI}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + size / 2, y + size / 2 + 0.5);
  ctx.restore();
}

export function drawCoin(ctx, x, y, r, time = 0) {
  ctx.save();
  ctx.translate(x, y);
  const squash = 0.45 + Math.abs(Math.cos(time * 2.2)) * 0.55;
  ctx.scale(squash, 1);
  const g = ctx.createLinearGradient(-r, -r, r, r);
  g.addColorStop(0, '#ffe7a1');
  g.addColorStop(0.5, '#e8b958');
  g.addColorStop(1, '#a8782f');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(92,57,15,0.8)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(120,76,22,0.7)';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,247,210,0.6)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.3, -r * 0.35, r * 0.26, r * 0.12, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawDiamond(ctx, x, y, r, color, glowColor = null) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  if (glowColor) {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 14;
  }
  ctx.fillStyle = color;
  ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,248,226,0.52)';
  ctx.lineWidth = 1;
  ctx.strokeRect(-r, -r, r * 2, r * 2);
  ctx.restore();
}

export function drawSlash(ctx, x, y, radius, start, end, color, alpha, width) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(x, y);
  const g = ctx.createRadialGradient(0, 0, radius * 0.55, 0, 0, radius);
  g.addColorStop(0, hexToRgba(color, 0));
  g.addColorStop(0.65, hexToRgba(color, alpha * 0.45));
  g.addColorStop(1, hexToRgba(color, alpha));
  ctx.strokeStyle = g;
  ctx.lineCap = 'round';
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(0, 0, radius, start, end);
  ctx.stroke();
  ctx.strokeStyle = hexToRgba('#fff6dd', alpha * 0.78);
  ctx.lineWidth = Math.max(1, width * 0.24);
  ctx.beginPath();
  ctx.arc(0, 0, radius + 1, start, end);
  ctx.stroke();
  ctx.restore();
}

export function drawText(ctx, text, x, y, opts = {}) {
  const {
    font = `14px ${FONT_UI}`,
    color = '#f0e2c2',
    align = 'left',
    baseline = 'alphabetic',
    shadow = true,
    alpha = 1,
  } = opts;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  if (shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;
  }
  ctx.fillText(text, x, y);
  ctx.restore();
}

export function drawTitle(ctx, text, x, y, size, color = '#f3ddb0', align = 'center') {
  ctx.save();
  ctx.font = `700 ${size}px ${FONT_TITLE}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(255,169,91,0.35)';
  ctx.shadowBlur = 22;
  ctx.fillText(text, x, y);
  ctx.restore();
}

export function wrapText(ctx, text, maxWidth, font) {
  ctx.save();
  ctx.font = font;
  const lines = [];
  let line = '';
  for (const char of text) {
    const test = line + char;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = char;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  ctx.restore();
  return lines;
}

function drawMountainLayer(ctx, offset, baseY, color, points, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-300, baseY);
  ctx.lineTo(points[0][0] - offset, points[0][1]);
  for (let i = 1; i < points.length; i += 1) {
    const [px, py] = points[i - 1];
    const [cx, cy] = points[i];
    const midX = (px + cx) / 2;
    const midY = (py + cy) / 2;
    ctx.quadraticCurveTo(px - offset, py, midX - offset, midY);
  }
  const last = points[points.length - 1];
  ctx.quadraticCurveTo(last[0] - offset, last[1], VIEW_W + 320, last[1] + 80);
  ctx.lineTo(VIEW_W + 320, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawCloud(ctx, x, y, scale, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale * 0.52);
  const g = ctx.createRadialGradient(0, 0, 6, 0, 0, 150);
  g.addColorStop(0, `rgba(225,207,190,${alpha})`);
  g.addColorStop(0.45, `rgba(192,170,164,${alpha * 0.45})`);
  g.addColorStop(1, 'rgba(170,150,150,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 150, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPeachTree(ctx, x, y, scale, time, flip = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * flip, scale);
  // trunk
  ctx.strokeStyle = '#2a2022';
  ctx.lineCap = 'round';
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-8, -80, 22, -150, 8, -230);
  ctx.stroke();
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(6, -130);
  ctx.bezierCurveTo(-45, -175, -80, -206, -120, -220);
  ctx.moveTo(9, -175);
  ctx.bezierCurveTo(48, -205, 78, -230, 116, -245);
  ctx.stroke();
  ctx.lineWidth = 4;
  for (const branch of [
    [-120, -220, -156, -255],
    [-75, -204, -95, -260],
    [60, -224, 82, -280],
    [116, -245, 150, -268],
    [4, -230, 8, -282],
  ]) {
    ctx.beginPath();
    ctx.moveTo(branch[0], branch[1]);
    ctx.quadraticCurveTo((branch[0] + branch[2]) / 2 - 8, (branch[1] + branch[3]) / 2, branch[2], branch[3]);
    ctx.stroke();
  }

  const sway = Math.sin(time * 0.55) * 2;
  const clusters = [
    [-130, -232, 27],
    [-82, -252, 24],
    [-25, -272, 28],
    [35, -268, 25],
    [96, -258, 29],
    [148, -272, 22],
    [10, -238, 26],
    [64, -232, 23],
    [-48, -222, 25],
  ];
  for (let i = 0; i < clusters.length; i += 1) {
    const [cx, cy, cr] = clusters[i];
    const g = ctx.createRadialGradient(cx + sway, cy, 2, cx + sway, cy, cr * 1.7);
    g.addColorStop(0, i % 3 === 0 ? 'rgba(255,224,207,0.55)' : 'rgba(244,187,183,0.4)');
    g.addColorStop(0.62, 'rgba(193,112,132,0.2)');
    g.addColorStop(1, 'rgba(160,88,111,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx + sway, cy, cr * 1.7, 0, Math.PI * 2);
    ctx.fill();
  }
  // crisp little blossoms over the soft canopy
  for (let i = 0; i < 54; i += 1) {
    const angle = i * 2.399;
    const radius = 14 + (i % 8) * 12;
    const cx = -25 + Math.cos(angle) * radius * 2.2 + sway;
    const cy = -248 + Math.sin(angle) * radius * 0.9;
    const size = 1.6 + (i % 4) * 0.7;
    ctx.fillStyle = i % 5 === 0 ? 'rgba(255,231,216,0.75)' : i % 3 === 0 ? 'rgba(249,200,198,0.6)' : 'rgba(230,160,174,0.55)';
    ctx.beginPath();
    ctx.arc(cx, cy, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawGate(ctx, x, y, scale, time) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.globalAlpha = 0.78;
  const ink = '#241d25';
  ctx.fillStyle = ink;
  ctx.fillRect(-118, -180, 18, 180);
  ctx.fillRect(100, -180, 18, 180);
  ctx.fillRect(-142, -192, 284, 16);
  ctx.fillRect(-126, -160, 252, 10);
  ctx.fillStyle = '#2a2028';
  ctx.beginPath();
  ctx.moveTo(-178, -198);
  ctx.quadraticCurveTo(0, -242, 178, -198);
  ctx.lineTo(148, -210);
  ctx.quadraticCurveTo(0, -246, -148, -210);
  ctx.closePath();
  ctx.fill();
  // lanterns
  for (const lx of [-96, 96]) {
    ctx.strokeStyle = 'rgba(35,28,30,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(lx, -160);
    ctx.lineTo(lx, -132);
    ctx.stroke();
    const flicker = 0.8 + Math.sin(time * 3 + lx) * 0.12;
    glow(ctx, lx, -121, 26, '#ff9d57', 0.35 * flicker);
    ctx.fillStyle = `rgba(242,142,75,${0.92 * flicker})`;
    ctx.beginPath();
    ctx.ellipse(lx, -121, 9, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,230,160,0.55)';
    ctx.beginPath();
    ctx.ellipse(lx - 2, -124, 3, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // sign
  ctx.fillStyle = '#1d1820';
  ctx.fillRect(-30, -183, 60, 25);
  ctx.strokeStyle = 'rgba(211,174,105,0.42)';
  ctx.strokeRect(-28, -181, 56, 21);
  ctx.fillStyle = 'rgba(218,186,124,0.72)';
  ctx.font = `700 13px ${FONT_TITLE}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('花果山', 0, -170);
  ctx.restore();
}

export function drawBackground(ctx, camera, time) {
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y + 30);
  sky.addColorStop(0, '#0a1020');
  sky.addColorStop(0.36, '#181b31');
  sky.addColorStop(0.63, '#382b3b');
  sky.addColorStop(0.82, '#7b4c43');
  sky.addColorStop(0.95, '#b97656');
  sky.addColorStop(1, '#d49369');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // stars
  ctx.save();
  for (let i = 0; i < 62; i += 1) {
    const x = ((i * 197.3 + 41) % VIEW_W) - camera.x * 0.008;
    const y = 28 + ((i * 83.7) % 320);
    const twinkle = 0.24 + Math.max(0, Math.sin(time * (0.7 + (i % 5) * 0.13) + i)) * 0.5;
    ctx.globalAlpha = twinkle * (1 - y / 500);
    ctx.fillStyle = i % 7 === 0 ? '#ffd9a1' : '#dfe8ff';
    ctx.fillRect(x, y, i % 7 === 0 ? 2 : 1.3, i % 7 === 0 ? 2 : 1.3);
  }
  ctx.restore();

  // moon
  const moonX = 1015 - camera.x * 0.012;
  const moonY = 148;
  glow(ctx, moonX, moonY, 185, '#ffd9a0', 0.16);
  const moon = ctx.createRadialGradient(moonX - 18, moonY - 22, 6, moonX, moonY, 72);
  moon.addColorStop(0, '#fff9e4');
  moon.addColorStop(0.72, '#f6e1b1');
  moon.addColorStop(1, '#cfb488');
  ctx.fillStyle = moon;
  ctx.beginPath();
  ctx.arc(moonX, moonY, 66, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(120,97,76,0.075)';
  ctx.beginPath();
  ctx.arc(moonX - 17, moonY - 11, 12, 0, Math.PI * 2);
  ctx.arc(moonX + 22, moonY + 20, 8, 0, Math.PI * 2);
  ctx.arc(moonX + 8, moonY - 34, 5, 0, Math.PI * 2);
  ctx.fill();

  // clouds
  drawCloud(ctx, 230 - camera.x * 0.03 + Math.sin(time * 0.05) * 24, 128, 1.25, 0.13);
  drawCloud(ctx, 760 - camera.x * 0.045 + Math.sin(time * 0.04 + 2) * 30, 235, 1.5, 0.1);
  drawCloud(ctx, 1120 - camera.x * 0.025 + Math.sin(time * 0.06 + 4) * 18, 92, 0.9, 0.09);

  // far mountains
  drawMountainLayer(
    ctx,
    camera.x * 0.055,
    505,
    '#232839',
    [
      [-100, 420], [30, 354], [120, 405], [225, 312], [315, 392], [430, 296],
      [540, 390], [675, 322], [760, 400], [900, 280], [1010, 372], [1120, 320],
      [1230, 402], [1360, 330], [1480, 410], [1600, 350],
    ],
    0.96
  );
  drawMountainLayer(
    ctx,
    camera.x * 0.1,
    540,
    '#2d2b3d',
    [
      [-100, 475], [80, 400], [200, 466], [330, 372], [460, 468], [610, 386],
      [740, 470], [870, 404], [1000, 465], [1140, 380], [1270, 462], [1400, 404],
      [1530, 472], [1650, 432],
    ],
    0.94
  );

  // mist
  const mist = ctx.createLinearGradient(0, 430, 0, 610);
  mist.addColorStop(0, 'rgba(215,166,144,0)');
  mist.addColorStop(0.5, 'rgba(205,158,138,0.09)');
  mist.addColorStop(1, 'rgba(160,121,119,0)');
  ctx.fillStyle = mist;
  ctx.fillRect(0, 420, VIEW_W, 200);

  // distant gate on a ridge
  const gateX = 1540 - camera.x * 0.36;
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#24202b';
  ctx.beginPath();
  ctx.moveTo(gateX - 360, 545);
  ctx.quadraticCurveTo(gateX - 80, 480, gateX + 240, 548);
  ctx.lineTo(gateX + 420, 620);
  ctx.lineTo(gateX - 500, 620);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  drawGate(ctx, gateX, 535, 0.62, time);

  // near ridge
  const ridgeOffset = camera.x * 0.5;
  ctx.save();
  const ridge = ctx.createLinearGradient(0, 500, 0, 650);
  ridge.addColorStop(0, '#2b2730');
  ridge.addColorStop(1, '#17151d');
  ctx.fillStyle = ridge;
  ctx.beginPath();
  ctx.moveTo(-240 - (ridgeOffset % 600), 620);
  for (let x = -240; x < VIEW_W + 300; x += 240) {
    const wx = x - (ridgeOffset % 600);
    const h = 560 + Math.sin((x + ridgeOffset) * 0.011) * 22;
    ctx.quadraticCurveTo(wx + 120, h - 26, wx + 240, h + 18);
  }
  ctx.lineTo(VIEW_W + 300, 660);
  ctx.lineTo(-240, 660);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // peach trees
  drawPeachTree(ctx, 120 - camera.x * 0.62, 596, 0.94, time, 1);
  drawPeachTree(ctx, 2240 - camera.x * 0.72, 590, 1.03, time, -1);

  // lantern strands
  drawLanternStrand(ctx, 280 - camera.x * 0.8, 68, 380, time);
  drawLanternStrand(ctx, 1820 - camera.x * 0.74, 102, 330, time);

  // ground
  drawGround(ctx, camera, time);

  // atmosphere
  ctx.save();
  const fog = ctx.createLinearGradient(0, GROUND_Y - 80, 0, GROUND_Y + 20);
  fog.addColorStop(0, 'rgba(194,138,116,0)');
  fog.addColorStop(1, 'rgba(184,126,105,0.11)');
  ctx.fillStyle = fog;
  ctx.fillRect(0, GROUND_Y - 80, VIEW_W, 100);
  ctx.restore();
}

function drawLanternStrand(ctx, x, y, width, time) {
  ctx.save();
  ctx.strokeStyle = 'rgba(19,15,22,0.65)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x, y + 8);
  ctx.quadraticCurveTo(x + width / 2, y + 56, x + width, y + 4);
  ctx.stroke();
  for (let i = 0; i < 5; i += 1) {
    const t = (i + 0.5) / 5;
    const lx = x + width * t;
    const ly = y + 8 + Math.sin(t * Math.PI) * 48;
    const flicker = 0.78 + Math.sin(time * 2.4 + i * 1.7) * 0.14;
    ctx.strokeStyle = 'rgba(30,22,26,0.8)';
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx, ly + 12);
    ctx.stroke();
    glow(ctx, lx, ly + 21, 26, '#ff9b52', 0.22 * flicker);
    ctx.fillStyle = `rgba(236,133,66,${0.8 * flicker})`;
    ctx.beginPath();
    ctx.ellipse(lx, ly + 22, 6.5, 8.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,211,139,0.48)';
    ctx.stroke();
  }
  ctx.restore();
}

function drawGround(ctx, camera, time) {
  // platform face
  const face = ctx.createLinearGradient(0, GROUND_Y, 0, VIEW_H);
  face.addColorStop(0, '#443b3b');
  face.addColorStop(0.12, '#332e32');
  face.addColorStop(0.7, '#1b1a21');
  face.addColorStop(1, '#0e0e15');
  ctx.fillStyle = face;
  ctx.fillRect(0, GROUND_Y, VIEW_W, VIEW_H - GROUND_Y);

  // top edge
  const lip = ctx.createLinearGradient(0, GROUND_Y - 7, 0, GROUND_Y + 8);
  lip.addColorStop(0, '#b29070');
  lip.addColorStop(0.35, '#745e4e');
  lip.addColorStop(1, '#3a3232');
  ctx.fillStyle = lip;
  ctx.fillRect(0, GROUND_Y - 4, VIEW_W, 12);
  ctx.fillStyle = 'rgba(247,213,167,0.29)';
  ctx.fillRect(0, GROUND_Y - 4, VIEW_W, 1.5);

  // stone slabs
  const startX = Math.floor((camera.x - 120) / 190) * 190;
  for (let wx = startX; wx < camera.x + VIEW_W + 220; wx += 190) {
    const x = wx - camera.x;
    const n = Math.abs(Math.floor(wx / 190));
    const y = GROUND_Y + 12 + (n % 2) * 2;
    const h = 52 + (n % 3) * 9;
    ctx.strokeStyle = 'rgba(178,150,124,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, 186, h);
    ctx.fillStyle = 'rgba(255,255,255,0.018)';
    ctx.fillRect(x + 3, y + 3, 180, 2);
    for (let j = 0; j < 2; j += 1) {
      const cx = x + 40 + ((n * 53 + j * 79) % 120);
      const cy = y + 16 + ((n * 31 + j * 23) % 34);
      ctx.strokeStyle = 'rgba(198,163,128,0.14)';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + 14, cy + 5);
      ctx.lineTo(cx + 20, cy + 13);
      ctx.stroke();
    }
  }

  // grass and stones at the seam
  for (let i = 0; i < 60; i += 1) {
    const wx = i * 53 + ((i * 37) % 31);
    const x = wx - camera.x;
    if (x < -30 || x > VIEW_W + 30) continue;
    const sway = Math.sin(time * 1.3 + i) * 2;
    ctx.strokeStyle = i % 4 === 0 ? 'rgba(167,145,95,0.32)' : 'rgba(79,101,74,0.42)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(x, GROUND_Y - 2);
    ctx.quadraticCurveTo(x + sway, GROUND_Y - 9, x + 3 + sway, GROUND_Y - 16 - (i % 3) * 3);
    ctx.moveTo(x + 3, GROUND_Y - 1);
    ctx.quadraticCurveTo(x + 6 - sway, GROUND_Y - 7, x + 9 - sway, GROUND_Y - 12);
    ctx.stroke();
  }

  // tiny glowing runes in the distance
  for (let i = 0; i < 8; i += 1) {
    const wx = 240 + i * 337;
    const x = wx - camera.x;
    if (x < -20 || x > VIEW_W + 20) continue;
    const a = 0.12 + Math.sin(time * 1.7 + i) * 0.05;
    glow(ctx, x, GROUND_Y + 42, 22, '#e8a353', a);
  }

  // foreground grass silhouettes
  ctx.save();
  ctx.globalAlpha = 0.55;
  for (let i = 0; i < 26; i += 1) {
    const x = ((i * 173 - camera.x * 1.18) % (VIEW_W + 240)) - 120;
    const sway = Math.sin(time * 0.9 + i) * 4;
    ctx.strokeStyle = '#07080d';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x, VIEW_H + 6);
    ctx.quadraticCurveTo(x + 12 + sway, VIEW_H - 40, x + 4 + sway * 2, VIEW_H - 68 - (i % 4) * 14);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawVignette(ctx, lowHealth = 0) {
  const v = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.36, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.72);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(0.72, 'rgba(0,0,0,0.18)');
  v.addColorStop(1, 'rgba(0,0,0,0.58)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  if (lowHealth > 0) {
    const pulseAlpha = 0.1 + Math.sin(performance.now() * 0.006) * 0.05;
    const red = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.3, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.68);
    red.addColorStop(0, 'rgba(130,20,25,0)');
    red.addColorStop(1, `rgba(150,22,25,${pulseAlpha * lowHealth})`);
    ctx.fillStyle = red;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

export function drawFocusLines(ctx, intensity, color = '#ffcf78') {
  if (intensity <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(VIEW_W / 2, VIEW_H / 2);
  for (let i = 0; i < 26; i += 1) {
    const angle = (i / 26) * Math.PI * 2 + 0.08;
    const inner = 270 + (i % 4) * 42;
    const outer = inner + 180 + (i % 3) * 80;
    ctx.strokeStyle = hexToRgba(color, 0.035 * intensity);
    ctx.lineWidth = 2 + (i % 3);
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawLetterbox(ctx, amount) {
  if (amount <= 0) return;
  ctx.fillStyle = '#05060a';
  ctx.fillRect(0, 0, VIEW_W, amount);
  ctx.fillRect(0, VIEW_H - amount, VIEW_W, amount);
}

export function drawWheel(ctx, x, y, radius, pct, colorA, colorB, time) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();
  if (pct > 0) {
    ctx.strokeStyle = colorA;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2 * clamp(pct, 0, 1));
    ctx.stroke();
  }
  ctx.restore();
}

export function drawRadialCooldown(ctx, x, y, radius, pct) {
  if (pct <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, radius, 0, Math.PI * 2 * clamp(pct, 0, 1));
  ctx.closePath();
  ctx.fillStyle = 'rgba(4,6,10,0.64)';
  ctx.fill();
  ctx.restore();
}
