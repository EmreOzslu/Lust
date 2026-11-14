import { PAL } from '../data/palette';
import { TILE } from '../data/tiles';
import { mulberry32 } from '../sim/rng';
import { TILE_PX } from './atlas';

type Ctx = CanvasRenderingContext2D;
type Rnd = () => number;

const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

function circle(ctx: Ctx, x: number, y: number, r: number, color: number, alpha = 1): void {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = hex(color);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function speckle(ctx: Ctx, rnd: Rnd, ox: number, oy: number, n: number, colors: number[], maxSize: number): void {
  for (let i = 0; i < n; i++) {
    const s = 0.8 + rnd() * maxSize;
    ctx.fillStyle = hex(colors[Math.floor(rnd() * colors.length)]);
    ctx.globalAlpha = 0.35 + rnd() * 0.35;
    ctx.fillRect(ox + rnd() * TILE_PX, oy + rnd() * TILE_PX, s, s);
  }
  ctx.globalAlpha = 1;
}

function groundBase(ctx: Ctx, ox: number, oy: number, rnd: Rnd, color: number): void {
  ctx.fillStyle = hex(color);
  ctx.fillRect(ox, oy, TILE_PX, TILE_PX);
  speckle(ctx, rnd, ox, oy, 18, [PAL.grassDark, PAL.grassLight], 1.6);
}

function grass(ctx: Ctx, ox: number, oy: number, v: number, rnd: Rnd): void {
  groundBase(ctx, ox, oy, rnd, PAL.grass);
  // Nemli toprak lekeleri: tonal değişim
  for (let i = 0; i < 3; i++) {
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = hex(i % 2 ? PAL.grassDark : PAL.grassLight);
    ctx.beginPath();
    ctx.ellipse(ox + rnd() * TILE_PX, oy + rnd() * TILE_PX, 5 + rnd() * 4, 3 + rnd() * 3, rnd() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Ot kümeleri: üç bıçaklı tutamlar
  ctx.strokeStyle = hex(PAL.grassLight);
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const x = ox + 2 + rnd() * (TILE_PX - 4);
    const y = oy + 5 + rnd() * (TILE_PX - 7);
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 2, y - 4);
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 5);
    ctx.moveTo(x, y);
    ctx.lineTo(x + 2, y - 4);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (v === 1) {
    // Yağmur birikintisi: turkuaz yansıma
    circle(ctx, ox + 10 + rnd() * 12, oy + 10 + rnd() * 12, 3.5, PAL.sheen, 0.25);
    circle(ctx, ox + 10 + rnd() * 12, oy + 10 + rnd() * 12, 1.2, PAL.sheen, 0.5);
  }
}

function forest(ctx: Ctx, ox: number, oy: number, v: number, rnd: Rnd): void {
  groundBase(ctx, ox, oy, rnd, PAL.grassDark);
  const cx = ox + TILE_PX / 2 + (v ? 1 : -1);
  const cy = oy + TILE_PX / 2;
  // Yere düşen gölge
  circle(ctx, cx + 3, cy + 4, 13, 0x000000, 0.3);
  // Düzensiz taç: birbirine geçen küçük lekeler, koyudan açığa
  const blobs: [number, number, number, number][] = [];
  for (let i = 0; i < 7; i++) {
    const a = rnd() * Math.PI * 2;
    const d = rnd() * 6;
    blobs.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d, 4 + rnd() * 3, i % 3]);
  }
  const shades = [PAL.canopyC, PAL.canopyA, PAL.canopyB];
  for (const [x, y, r, k] of blobs) circle(ctx, x, y, r, shades[k]);
  // Taç kenarı: sülfür turkuazı ışık, yalnızca üst-sol tarafta
  ctx.strokeStyle = hex(PAL.sulfur);
  ctx.lineWidth = 1;
  for (const [x, y, r] of blobs.slice(0, 4)) {
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.arc(x, y, r - 0.5, Math.PI * 1.15, Math.PI * 1.45);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // Gövde ucu, neredeyse görünmez
  circle(ctx, cx + 1, cy + 1, 1.2, PAL.trunk, 0.8);
}

function rock(ctx: Ctx, ox: number, oy: number, v: number, rnd: Rnd): void {
  groundBase(ctx, ox, oy, rnd, PAL.stoneDark);
  const cx = ox + TILE_PX / 2;
  const cy = oy + TILE_PX / 2 + 1;
  const n = 7;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.3;
    const r = 10 + rnd() * 3 - (v ? 1 : 0);
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.85]);
  }
  const trace = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < n; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  };
  // Gölge
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.ellipse(cx + 2, cy + 4, 11, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  // Gövde
  trace();
  ctx.fillStyle = hex(PAL.stone);
  ctx.fill();
  // Yüzey: aydınlık üst-sol yüz, koyu alt-sağ yüz (kaba fasetleme)
  ctx.save();
  trace();
  ctx.clip();
  ctx.fillStyle = hex(PAL.stoneDark);
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  ctx.moveTo(cx + 12, cy - 2);
  ctx.lineTo(cx + 2, cy + 12);
  ctx.lineTo(cx + 14, cy + 12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = hex(PAL.stoneLight);
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.ellipse(cx - 4, cy - 5, 6, 3.5, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
  // Çatlak: zigzag çizgi
  ctx.strokeStyle = hex(PAL.stoneDark);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 6, cy - 3);
  ctx.lineTo(cx - 2, cy - 1);
  ctx.lineTo(cx - 4, cy + 2);
  ctx.lineTo(cx + 1, cy + 3);
  ctx.stroke();
  // Islaklık: turkuaz parıltı çizgisi
  ctx.strokeStyle = hex(PAL.sheen);
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  ctx.moveTo(cx + 3, cy - 6);
  ctx.lineTo(cx + 6, cy - 4);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function water(ctx: Ctx, ox: number, oy: number, v: number, rnd: Rnd): void {
  const g = ctx.createLinearGradient(0, oy, 0, oy + TILE_PX);
  g.addColorStop(0, hex(PAL.waterTop));
  g.addColorStop(1, hex(PAL.waterBottom));
  ctx.fillStyle = g;
  ctx.fillRect(ox, oy, TILE_PX, TILE_PX);
  // Dalgacıklar
  ctx.strokeStyle = hex(PAL.sheen);
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const y = oy + 7 + i * 9 + (v ? 2 : 0);
    const x = ox + 4 + rnd() * 12;
    ctx.globalAlpha = 0.25 + rnd() * 0.15;
    ctx.beginPath();
    ctx.arc(x, y, 4 + rnd() * 3, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function scrap(ctx: Ctx, ox: number, oy: number, v: number, rnd: Rnd): void {
  groundBase(ctx, ox, oy, rnd, PAL.scrapGround);
  const plates = [PAL.rust, PAL.rustLight, PAL.rustDark];
  for (let i = 0; i < 3; i++) {
    const x = ox + 3 + (i % 2) * 14 + (v ? 1 : 0);
    const y = oy + 3 + Math.floor(i / 2) * 13;
    ctx.fillStyle = hex(plates[i]);
    ctx.fillRect(x, y, 13, 11);
    ctx.strokeStyle = hex(PAL.scrapGround);
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, 12, 10);
    circle(ctx, x + 2, y + 2, 0.9, PAL.rivet);
    circle(ctx, x + 11, y + 9, 0.9, PAL.rivet);
  }
}

function bush(ctx: Ctx, ox: number, oy: number, v: number, rnd: Rnd): void {
  groundBase(ctx, ox, oy, rnd, PAL.grassDark);
  const cx = ox + TILE_PX / 2;
  const cy = oy + TILE_PX / 2;
  circle(ctx, cx + 2, cy + 3, 11, 0x000000, 0.2);
  circle(ctx, cx, cy, 11, PAL.moss);
  circle(ctx, cx - 3, cy - 3, 6, PAL.mossLight);
  circle(ctx, cx + 4, cy + 2, 5, PAL.moss);
  // Meyveler
  const spots = v ? [[-4, 1], [3, -3], [1, 4]] : [[-2, -1], [4, 2], [-5, 4]];
  for (const [dx, dy] of spots) {
    circle(ctx, cx + dx, cy + dy, 1.8, PAL.plum);
    circle(ctx, cx + dx - 0.6, cy + dy - 0.6, 0.6, PAL.plumLight, 0.9);
  }
}

const DRAW: Record<number, (ctx: Ctx, ox: number, oy: number, v: number, rnd: Rnd) => void> = {
  [TILE.Grass]: grass,
  [TILE.Forest]: forest,
  [TILE.Rock]: rock,
  [TILE.Water]: water,
  [TILE.Scrap]: scrap,
  [TILE.Bush]: bush,
};

// Atlas: her (tip, varyant) çifti bir kare. Sıra: frameFor(kind, v).
export function drawAtlas(ctx: Ctx, frames: number): void {
  const rnd = mulberry32(4242);
  for (let kind = 0; kind < frames / 2; kind++) {
    for (let v = 0; v < 2; v++) {
      const ox = (kind * 2 + v) * TILE_PX;
      const draw = DRAW[kind];
      if (draw) draw(ctx, ox, 0, v, rnd);
    }
  }
}

// Oyuncu: üstten görünüm. Omuzlu palto, atkı, geniş kenarlı şapka.
export function drawPlayer(ctx: Ctx, size: number): void {
  const c = size / 2;
  // Gölge
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.ellipse(c + 2, c + 4, 10, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  // Omuzlar ve palto
  ctx.fillStyle = hex(PAL.coat);
  ctx.beginPath();
  ctx.ellipse(c, c + 1, 10, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Palto ışığı: üst-sol kıvrım
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = hex(PAL.stoneLight);
  ctx.beginPath();
  ctx.ellipse(c - 3, c - 2, 4, 2.5, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  // Atkı: önden bir yay
  ctx.strokeStyle = hex(PAL.scarf);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(c, c + 1, 5.5, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
  // Şapka: kenar ve taç
  ctx.strokeStyle = hex(PAL.hat);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(c, c - 1, 8, 6.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  circle(ctx, c, c - 1, 4.5, PAL.hatLight);
  // Lamba yansıması şapkada
  circle(ctx, c - 1.5, c - 3, 1, PAL.lamp, 0.7);
}

// Ölüm çantası: deri sırt çantası, pirinç toka.
export function drawBag(ctx: Ctx, size: number): void {
  const c = size / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(c - 8, c - 4, 16, 12);
  ctx.fillStyle = hex(PAL.satchel);
  ctx.fillRect(c - 8, c - 6, 16, 12);
  ctx.fillStyle = hex(PAL.satchelDark);
  ctx.fillRect(c - 8, c - 6, 16, 4);
  ctx.strokeStyle = hex(PAL.satchelDark);
  ctx.lineWidth = 1;
  ctx.strokeRect(c - 8.5, c - 6.5, 17, 13);
  circle(ctx, c, c - 3, 1.6, PAL.rivet);
}
