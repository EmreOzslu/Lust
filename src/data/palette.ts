// Decadence görsel dili: yağmurlu lacivert gece, ıslak taş, paslı demir,
// sıcak sarı iç mekân ışığı ve sülfürik turkuaz vurgular.
// Tüm renkler burada; render kodunda sabit renk yazılmaz.

export const PAL = {
  // Gökyüzü ve gece karartması
  night: 0x0a1a2e,
  nightHex: '#0a1a2e',

  // Zemin ve bitki örtüsü (soluk, nemli)
  grass: 0x3a5a48,
  grassDark: 0x2c4a3c,
  grassLight: 0x4d7158,
  moss: 0x3f6b4a,
  mossLight: 0x4f7d58,

  // Orman
  canopyA: 0x1f4a44,
  canopyB: 0x2a5e55,
  canopyC: 0x163a36,
  trunk: 0x15221f,

  // Taş ve su
  stoneDark: 0x2f3a3f,
  stone: 0x5d6670,
  stoneLight: 0x8a949c,
  waterTop: 0x173a4f,
  waterBottom: 0x2a6a78,
  sheen: 0x7fe3d6,

  // Hurdalık ve pas
  scrapGround: 0x3b342c,
  rust: 0x7a4a2a,
  rustLight: 0x8a5a34,
  rustDark: 0x66402a,
  rivet: 0xc9a062,

  // Çalı ve meyve
  plum: 0x8a3f6a,
  plumLight: 0xc77fa6,

  // Arayüz
  panel: 0x111a20,
  brass: 0xc9a062,
  cream: 0xf0e2b6,
  creamHex: '#f0e2b6',
  lamp: 0xf2c46d,
  sulfur: 0x5fd8c8,

  // Karakter
  coat: 0x2f4f5a,
  scarf: 0xd9a441,
  hat: 0x1f1f22,
  hatLight: 0x3a3d42,
  satchel: 0x6b4a2a,
  satchelDark: 0x4f3520,
} as const;

// Durum çubukları
export const BAR = {
  hp: 0xb5533c,
  hunger: 0xd9a441,
  thirst: 0x4fc3d0,
} as const;
