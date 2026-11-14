import { describe, it, expect } from 'vitest';
import { frameFor, variantAt, FRAME_COUNT, VARIANTS } from './atlas';
import { TILE } from '../data/tiles';

describe('atlas', () => {
  it('her tip ve varyant için geçerli, benzersiz kare indeksi', () => {
    const seen = new Set<number>();
    for (const kind of Object.values(TILE)) {
      for (let v = 0; v < VARIANTS; v++) {
        const f = frameFor(kind, v);
        expect(f).toBeGreaterThanOrEqual(0);
        expect(f).toBeLessThan(FRAME_COUNT);
        expect(seen.has(f)).toBe(false);
        seen.add(f);
      }
    }
    expect(seen.size).toBe(FRAME_COUNT);
  });

  it('varyant konuma bağlı ve kararlı', () => {
    expect(variantAt(10, 20)).toBe(variantAt(10, 20));
    const values = new Set<number>();
    for (let x = 0; x < 20; x++) values.add(variantAt(x, 3));
    expect(values.size).toBe(VARIANTS);
  });
});
