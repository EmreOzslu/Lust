import { describe, it, expect } from 'vitest';

// M0 duman testi: test altyapısının çalıştığını doğrular.
describe('smoke', () => {
  it('test altyapısı çalışıyor', () => {
    expect(1 + 1).toBe(2);
  });
});
