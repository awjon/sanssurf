export type Stance = 'stand' | 'crouch';

export interface SurferState {
  lanePosition: number; // -1 (left edge) to +1 (right edge)
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

// Screen-space constants for perspective view
export const LANE_LEFT_RATIO  = 0.15; // screen X fraction when lanePosition = -1
export const LANE_RIGHT_RATIO = 0.85; // screen X fraction when lanePosition = +1
export const SURFER_Y_RATIO   = 0.63; // sits at the wave crest in chase-cam view

/** Map lane position [-1..+1] to screen pixel X */
export function laneToScreenX(lane: number, W: number): number {
  return W * (LANE_LEFT_RATIO + (lane + 1) / 2 * (LANE_RIGHT_RATIO - LANE_LEFT_RATIO));
}
