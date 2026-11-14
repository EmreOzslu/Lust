export interface Vec2 {
  x: number;
  y: number;
}

// Daire-dikdörtgen kesişimi: merkez (cx,cy), yarıçap r, tile kutusu [x0,x1]x[y0,y1].
function circleOverlapsBlocked(
  cx: number,
  cy: number,
  r: number,
  tileSize: number,
  isBlocked: (tx: number, ty: number) => boolean,
): boolean {
  const minTx = Math.floor((cx - r) / tileSize);
  const maxTx = Math.floor((cx + r) / tileSize);
  const minTy = Math.floor((cy - r) / tileSize);
  const maxTy = Math.floor((cy + r) / tileSize);

  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      if (!isBlocked(tx, ty)) continue;
      const x0 = tx * tileSize;
      const y0 = ty * tileSize;
      const closestX = Math.max(x0, Math.min(cx, x0 + tileSize));
      const closestY = Math.max(y0, Math.min(cy, y0 + tileSize));
      const dx = cx - closestX;
      const dy = cy - closestY;
      if (dx * dx + dy * dy < r * r) return true;
    }
  }
  return false;
}

// Eksen-ayrık hareket: önce X, sonra Y. Duvara çarpınca o eksende durur, diğer eksende kayar.
export function moveCircle(
  pos: Vec2,
  dx: number,
  dy: number,
  radius: number,
  tileSize: number,
  isBlocked: (tx: number, ty: number) => boolean,
): Vec2 {
  let { x, y } = pos;
  const nx = x + dx;
  if (!circleOverlapsBlocked(nx, y, radius, tileSize, isBlocked)) x = nx;
  const ny = y + dy;
  if (!circleOverlapsBlocked(x, ny, radius, tileSize, isBlocked)) y = ny;
  return { x, y };
}
