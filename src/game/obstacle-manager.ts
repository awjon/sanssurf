import { ObstacleKind, OBSTACLE_CONFIGS } from '../entities/obstacle-types';
import { randomRange, randomInt } from '../utils/math';

export interface Obstacle {
  id: number;
  kind: ObstacleKind;
  x: number;       // screen X pixels
  y: number;       // screen Y pixels
  baseY: number;   // stable Y that bob oscillates around
  width: number;
  height: number;
  active: boolean;
  bobPhase: number;
  label: string;
}

const POOL_SIZE = 24;
const BASE_INTERVAL = 2.8; // seconds between spawns at difficulty=1
const MAX_DIFFICULTY = 3.0;

export class ObstacleManager {
  private pool: Obstacle[] = [];
  private spawnTimer = 0;
  private idCounter = 0;
  private difficulty = 1.0;
  private elapsed = 0;

  constructor() {
    for (let i = 0; i < POOL_SIZE; i++) {
      this.pool.push({
        id: i, kind: ObstacleKind.ROCK, x: -9999, y: -9999, baseY: -9999,
        width: 0, height: 0, active: false, bobPhase: 0, label: '',
      });
    }
  }

  reset(): void {
    this.pool.forEach(o => { o.active = false; });
    this.spawnTimer = 0;
    this.elapsed = 0;
    this.difficulty = 1.0;
  }

  update(dt: number, scrollSpeed: number, screenWidth: number, screenHeight: number): void {
    this.elapsed += dt;
    this.difficulty = Math.min(MAX_DIFFICULTY, 1.0 + this.elapsed / 25.0);
    this.spawnTimer += dt;

    const interval = BASE_INTERVAL / this.difficulty;
    if (this.spawnTimer >= interval) {
      this.spawnTimer -= interval;
      this.spawn(screenWidth, screenHeight);
    }

    // Move active obstacles left
    for (const obs of this.pool) {
      if (!obs.active) continue;
      const cfg = OBSTACLE_CONFIGS[obs.kind];
      // scrollSpeed = base drift speed; speedFactor adds extra approach speed
      const moveSpeed = scrollSpeed * (1.0 + cfg.speedFactor * 0.55);
      obs.x -= moveSpeed * dt;
      obs.bobPhase += dt * 2.0;
      // Oscillate around baseY — never accumulate drift
      obs.y = obs.baseY + Math.sin(obs.bobPhase) * (obs.height * 0.18);
      if (obs.x < -obs.width * 2) obs.active = false;
    }
  }

  private spawn(screenWidth: number, screenHeight: number): void {
    const slot = this.pool.find(o => !o.active);
    if (!slot) return;

    const kinds = Object.values(ObstacleKind).filter(k => typeof k === 'number') as ObstacleKind[];
    const kind  = kinds[randomInt(0, kinds.length - 1)] ?? ObstacleKind.ROCK;
    const cfg   = OBSTACLE_CONFIGS[kind];

    const w = cfg.widthRatio  * screenHeight;
    const h = cfg.heightRatio * screenHeight;

    // Y anywhere in the ocean area (20%..80% of screen height)
    const y = randomRange(screenHeight * 0.20, screenHeight * 0.80);

    slot.kind     = kind;
    slot.x        = screenWidth * 1.05;
    slot.y        = y;
    slot.baseY    = y;
    slot.width    = w;
    slot.height   = h;
    slot.active   = true;
    slot.bobPhase = randomRange(0, Math.PI * 2);
    slot.label    = cfg.label;
    slot.id       = this.idCounter++;
  }

  checkCollision(surferX: number, surferY: number, surferW: number, surferH: number): ObstacleKind | null {
    for (const obs of this.pool) {
      if (!obs.active) continue;
      const cfg  = OBSTACLE_CONFIGS[obs.kind];
      const shrk = cfg.hitboxShrink;
      const hw = obs.width  * (1 - shrk) * 0.5;
      const hh = obs.height * (1 - shrk) * 0.5;
      if (
        Math.abs(surferX - obs.x) < (surferW * 0.4 + hw) &&
        Math.abs(surferY - obs.y) < (surferH * 0.45 + hh)
      ) {
        obs.active = false;
        return obs.kind;
      }
    }
    return null;
  }

  getActive(): readonly Obstacle[] { return this.pool.filter(o => o.active); }
}
