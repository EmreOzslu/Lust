import { describe, it, expect } from 'vitest';
import { moveCircle } from './movement';

const T = 32;
// Tile (2,0) duvar: x ∈ [64,96), tüm y.
const wall = (tx: number) => tx === 2;

describe('moveCircle', () => {
  it('engelsiz alanda serbest hareket eder', () => {
    const p = moveCircle({ x: 10, y: 10 }, 5, 3, 8, T, () => false);
    expect(p).toEqual({ x: 15, y: 13 });
  });

  it('duvara girmez, o eksende durur', () => {
    const p = moveCircle({ x: 50, y: 16 }, 40, 0, 8, T, wall);
    expect(p.x).toBeLessThan(64 - 8 + 0.001);
    expect(p.y).toBe(16);
  });

  it('duvara köşeden yaklaşınca diğer eksende kayar', () => {
    const p = moveCircle({ x: 50, y: 16 }, 20, 4, 8, T, wall);
    expect(p.x).toBe(50);
    expect(p.y).toBe(20);
  });

  it('sınır dışı (engelli) tile kenarında durur', () => {
    const blockedOutside = (tx: number, ty: number) => tx < 0 || ty < 0;
    const p = moveCircle({ x: 4, y: 4 }, -10, -10, 8, T, blockedOutside);
    expect(p.x).toBe(4);
    expect(p.y).toBe(4);
  });
});
