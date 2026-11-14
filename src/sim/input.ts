import type { Vec2 } from './movement';

// Joystick sapmasını (piksel) [-1,1] vektöre çevirir. Ölü bölge çıkarılır, uzunluk 1'de sınırlanır.
export function stickVector(dx: number, dy: number, radius: number, deadzone: number): Vec2 {
  const nx = dx / radius;
  const ny = dy / radius;
  const len = Math.hypot(nx, ny);
  if (len === 0) return { x: 0, y: 0 };
  const magnitude = Math.max(0, Math.min(1, (len - deadzone) / (1 - deadzone)));
  return { x: (nx / len) * magnitude, y: (ny / len) * magnitude };
}
