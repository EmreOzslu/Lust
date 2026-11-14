// Tüm ayarlanabilir sayılar burada. Sistem kodunda sayı gömülmez.
export const CONFIG = {
  seed: 1337,
  mapSize: 96,
  tileSize: 32,
  noiseCells: 8,
  waterElevation: 0.3,
  rockElevation: 0.74,
  forestMoisture: 0.6,
  scrapChance: 0.02,
  spawnClearRadius: 3,
  spawnOpenRadius: 12,
  minSpawnPocket: 800,
  playerSpeed: 150,
  playerRadius: 10,
  cameraZoom: 1.6,
  joystickDeadzone: 0.12,
  joystickRadius: 56,
} as const;
