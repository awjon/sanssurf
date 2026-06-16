export type Stance = 'stand' | 'crouch';

export interface SurferState {
  lanePosition: number; // -1 (trough) to +1 (lip)
  speed: number;        // virtual m/s
  momentum: number;     // accumulated pump energy
  stance: Stance;
  recentlyCrouched: boolean;
  crouchTimer: number;
  wiped: boolean;
  wipeoutTimer: number;
  animFrame: number;
  animTimer: number;
}

export function createSurfer(): SurferState {
  return {
    lanePosition: 0.0,
    speed: 8.0,
    momentum: 0.0,
    stance: 'stand',
    recentlyCrouched: false,
    crouchTimer: 0,
    wiped: false,
    wipeoutTimer: 0,
    animFrame: 0,
    animTimer: 0,
  };
}

// Constants
export const SURFER_SCREEN_X_RATIO = 0.285; // fraction of screen width
export const LANE_TOP    = 0.16;             // UV Y where lane = +1 (top/lip)
export const LANE_BOTTOM = 0.84;             // UV Y where lane = -1 (trough)

/** Map lane position to UV Y (0=top, 1=bottom) */
export function laneToUVY(lane: number): number {
  // lane +1 → UV Y = LANE_TOP,  lane -1 → UV Y = LANE_BOTTOM
  return LANE_BOTTOM + (lane - (-1)) / 2 * (LANE_TOP - LANE_BOTTOM);
}

/** Map UV Y to screen pixel Y */
export function uvYToScreen(uvY: number, height: number): number {
  return uvY * height;
}
