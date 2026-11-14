import { SURVIVAL } from '../data/config';

// Zaman saniye cinsinden. Bir döngü: gündüz + gece.
export function cycleLength(): number {
  return SURVIVAL.dayLength + SURVIVAL.nightLength;
}

export function isNight(t: number): boolean {
  return t % cycleLength() >= SURVIVAL.dayLength;
}

// 1'den başlayan gün sayısı.
export function dayNumber(t: number): number {
  return Math.floor(t / cycleLength()) + 1;
}
