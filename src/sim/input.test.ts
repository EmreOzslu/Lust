import { describe, it, expect } from 'vitest';
import { stickVector } from './input';

describe('stickVector', () => {
  it('ölü bölge içinde sıfır verir', () => {
    expect(stickVector(2, 0, 56, 0.12)).toEqual({ x: 0, y: 0 });
  });

  it('tam sapmada birim vektör verir', () => {
    const v = stickVector(56, 0, 56, 0.12);
    expect(v.x).toBeCloseTo(1, 6);
    expect(v.y).toBeCloseTo(0, 6);
  });

  it('radius dışına taşınca 1\'de sınırlanır', () => {
    const v = stickVector(500, 0, 56, 0.12);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1, 6);
  });

  it('yönü korur', () => {
    const v = stickVector(-30, 40, 56, 0.12);
    expect(v.x).toBeLessThan(0);
    expect(v.y).toBeGreaterThan(0);
  });
});
