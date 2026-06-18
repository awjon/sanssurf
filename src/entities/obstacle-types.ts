export enum ObstacleKind {
  ROCK          = 0,
  TOURIST_SWIM  = 1,
  TOURIST_FLOAT = 2,
  KAYAK         = 3,
  OTHER_SURFER  = 4,
  SHARK         = 5,
  DOLPHIN       = 6,
}

export interface ObstacleConfig {
  label: string;
  textureKey: string;
  widthRatio: number;   // fraction of screen height (at full scale, surfer level)
  heightRatio: number;
  speedFactor: number;  // relative to base approach speed
  hitboxShrink: number; // 0=full size, 0.3=30% smaller hitbox
  placeholderColor: [number, number, number, number]; // rgba 0-255
}

export const OBSTACLE_CONFIGS: Record<ObstacleKind, ObstacleConfig> = {
  [ObstacleKind.ROCK]: {
    label: 'ROCK', textureKey: 'obstacle-rock',
    widthRatio: 0.08, heightRatio: 0.07,
    speedFactor: 0.0, hitboxShrink: 0.1,
    placeholderColor: [107, 91, 78, 240],
  },
  [ObstacleKind.TOURIST_SWIM]: {
    label: 'SWIMMER', textureKey: 'obstacle-tourist-swim',
    widthRatio: 0.07, heightRatio: 0.08,
    speedFactor: 0.15, hitboxShrink: 0.25,
    placeholderColor: [255, 107, 157, 230],
  },
  [ObstacleKind.TOURIST_FLOAT]: {
    label: 'FLOATIE', textureKey: 'obstacle-tourist-float',
    widthRatio: 0.10, heightRatio: 0.09,
    speedFactor: 0.1, hitboxShrink: 0.2,
    placeholderColor: [255, 71, 87, 230],
  },
  [ObstacleKind.KAYAK]: {
    label: 'KAYAK', textureKey: 'obstacle-kayak',
    widthRatio: 0.14, heightRatio: 0.06,
    speedFactor: 0.4, hitboxShrink: 0.15,
    placeholderColor: [255, 165, 2, 235],
  },
  [ObstacleKind.OTHER_SURFER]: {
    label: 'SURFER', textureKey: 'obstacle-surfer',
    widthRatio: 0.07, heightRatio: 0.11,
    speedFactor: 0.7, hitboxShrink: 0.2,
    placeholderColor: [46, 213, 115, 230],
  },
  [ObstacleKind.SHARK]: {
    label: 'SHARK!', textureKey: 'obstacle-shark',
    widthRatio: 0.12, heightRatio: 0.09,
    speedFactor: 1.2, hitboxShrink: 0.1,
    placeholderColor: [116, 125, 140, 240],
  },
  [ObstacleKind.DOLPHIN]: {
    label: 'DOLPHIN', textureKey: 'obstacle-dolphin',
    widthRatio: 0.10, heightRatio: 0.08,
    speedFactor: 0.9, hitboxShrink: 0.3,
    placeholderColor: [74, 144, 217, 220],
  },
};
