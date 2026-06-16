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
  widthRatio: number;   // fraction of screen height
  heightRatio: number;
  speedFactor: number;  // relative to scroll speed (1.0 = same, <1 = slower, >1 = faster)
  hitboxShrink: number; // 0=full size, 0.3=30% smaller hitbox
  color: string;
  accentColor: string;
}

export const OBSTACLE_CONFIGS: Record<ObstacleKind, ObstacleConfig> = {
  [ObstacleKind.ROCK]: {
    label: 'ROCK', widthRatio: 0.06, heightRatio: 0.05,
    speedFactor: 0.0, hitboxShrink: 0.1,
    color: '#6B5B4E', accentColor: '#4A3F35',
  },
  [ObstacleKind.TOURIST_SWIM]: {
    label: 'SWIMMER', widthRatio: 0.05, heightRatio: 0.06,
    speedFactor: 0.15, hitboxShrink: 0.25,
    color: '#FF6B9D', accentColor: '#FFD93D',
  },
  [ObstacleKind.TOURIST_FLOAT]: {
    label: 'FLOATIE', widthRatio: 0.08, heightRatio: 0.07,
    speedFactor: 0.1, hitboxShrink: 0.2,
    color: '#FF4757', accentColor: '#FFD700',
  },
  [ObstacleKind.KAYAK]: {
    label: 'KAYAK', widthRatio: 0.11, heightRatio: 0.04,
    speedFactor: 0.4, hitboxShrink: 0.15,
    color: '#FFA502', accentColor: '#FF6348',
  },
  [ObstacleKind.OTHER_SURFER]: {
    label: 'SURFER', widthRatio: 0.05, heightRatio: 0.09,
    speedFactor: 0.7, hitboxShrink: 0.2,
    color: '#2ED573', accentColor: '#1E90FF',
  },
  [ObstacleKind.SHARK]: {
    label: 'SHARK!', widthRatio: 0.09, heightRatio: 0.07,
    speedFactor: 1.2, hitboxShrink: 0.1,
    color: '#747D8C', accentColor: '#2F3542',
  },
  [ObstacleKind.DOLPHIN]: {
    label: 'DOLPHIN', widthRatio: 0.08, heightRatio: 0.06,
    speedFactor: 0.9, hitboxShrink: 0.3,
    color: '#4A90D9', accentColor: '#8ECFFF',
  },
};
