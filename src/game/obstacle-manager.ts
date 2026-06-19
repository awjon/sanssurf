import { ObstacleKind, OBSTACLE_CONFIGS } from '../entities/obstacle-types';
import { SURFER_Y_RATIO } from './surfer';
import { randomRange, randomInt } from '../utils/math';

export interface Obstacle {
  id: number;
  kind: ObstacleKind;
  worldX: number;    // stable center X in world space (set at spawn, constant)
  screenX: number;   // perspective-projected X, computed each frame
  y: number;         // screen Y pixels, moves downward each frame
  baseWidth: number; // full-scale width (at surfer Y)
  baseHeight: number;
  drawWidth: number; // perspective-scaled width
  drawHeight: number;
  bobPhase: number;
  active: boolean;
  label: string;
}

const POOL_SIZE      = 24;
const BASE_INTERVAL  = 2.8; // seconds between spawns at difficulty=1
const MAX_DIFFICULTY = 3.0;
const VP_Y_RATIO     = 0.28; // horizon / vanishing point Y fraction

function perspScale(y: number, H: number): number {
  // Scale from near-zero at the horizon VP to 1.0 at the surfer
  const vpY     = H * VP_Y_RATIO;
  const surferY = H * SURFER_Y_RATIO;
  const t = (y - vpY) / (surferY - vpY);
  return 0.06 + 0.94 * Math.max(0, Math.min(t, 1));
}

export class ObstacleManager {
  private pool: Obstacle[] = [];
  private spawnTimer  = 0;
  private idCounter   = 0;
  private difficulty  = 1.0;
  private elapsed     = 0;

  constructor() {
    for (let i = 0; i < POOL_SIZE; i++) {
      this.pool.push({
        id: i, kind: ObstacleKind.ROCK,
        worldX: 0, screenX: 0, y: -9999,
        baseWidth: 0, baseHeight: 0, drawWidth: 0, drawHeight: 0,
        bobPhase: 0, active: false, label: '',
      });
    }
  }

  reset(): void {
    this.pool.forEach(o => { o.active = false; });
    this.spawnTimer = 0;
    this.elapsed    = 0;
    this.difficulty = 1.0;
  }

  update(dt: number, surferSpeed: number, W: number, H: number): void {
    this.elapsed    += dt;
    this.difficulty  = Math.min(MAX_DIFFICULTY, 1.0 + this.elapsed / 25.0);
    this.spawnTimer += dt;

    const interval = BASE_INTERVAL / this.difficulty;
    if (this.spawnTimer >= interval) {
      this.spawnTimer -= interval;
      this.spawn(W, H);
    }

    // Approach speed: obstacle travels from VP (H*0.28) to surfer (H*0.63) in ~2s
    const baseSpeed = surferSpeed * H * 0.022;

    for (const obs of this.pool) {
      if (!obs.active) continue;
      const cfg = OBSTACLE_CONFIGS[obs.kind];
      const moveSpeed = baseSpeed * (1.0 + cfg.speedFactor * 0.55);

      obs.y       += moveSpeed * dt;
      obs.bobPhase += dt * 2.0;

      const ps = perspScale(obs.y, H);
      obs.drawWidth  = obs.baseWidth  * ps;
      obs.drawHeight = obs.baseHeight * ps;
      obs.screenX    = W / 2 + (obs.worldX - W / 2) * ps;
      // Subtle lateral sway (replaces old Y bob)
      obs.screenX   += Math.sin(obs.bobPhase) * obs.drawWidth * 0.08;

      if (obs.y > H * 0.82) obs.active = false; // deactivate well past surfer (0.63)
    }
  }

  private spawn(W: number, H: number): void {
    const slot = this.pool.find(o => !o.active);
    if (!slot) return;

    const kinds = Object.values(ObstacleKind).filter(k => typeof k === 'number') as ObstacleKind[];
    const kind  = kinds[randomInt(0, kinds.length - 1)] ?? ObstacleKind.ROCK;
    const cfg   = OBSTACLE_CONFIGS[kind];

    const baseW = cfg.widthRatio  * H;
    const baseH = cfg.heightRatio * H;

    slot.kind       = kind;
    slot.worldX     = randomRange(W * 0.15, W * 0.85);
    slot.y          = H * VP_Y_RATIO; // spawn at horizon, appears tiny and grows
    slot.baseWidth  = baseW;
    slot.baseHeight = baseH;
    const ps0       = perspScale(slot.y, H);
    slot.drawWidth  = baseW * ps0;
    slot.drawHeight = baseH * ps0;
    slot.screenX    = W / 2 + (slot.worldX - W / 2) * ps0;
    slot.bobPhase   = randomRange(0, Math.PI * 2);
    slot.active     = true;
    slot.label      = cfg.label;
    slot.id         = this.idCounter++;
  }

  checkCollision(surferX: number, surferY: number, surferW: number, surferH: number): ObstacleKind | null {
    for (const obs of this.pool) {
      if (!obs.active) continue;
      const cfg  = OBSTACLE_CONFIGS[obs.kind];
      const shrk = cfg.hitboxShrink;
      const hw = obs.drawWidth  * (1 - shrk) * 0.5;
      const hh = obs.drawHeight * (1 - shrk) * 0.5;
      if (
        Math.abs(surferX - obs.screenX) < (surferW * 0.4 + hw) &&
        Math.abs(surferY - obs.y)       < (surferH * 0.45 + hh)
      ) {
        obs.active = false;
        return obs.kind;
      }
    }
    return null;
  }

  getActive(): readonly Obstacle[] { return this.pool.filter(o => o.active); }
}
