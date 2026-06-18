import { SurferState } from './surfer';
import { InputState } from '../input/input-manager';
import { clamp } from '../utils/math';

const BASE_SPEED     = 8.0;   // m/s
const LATERAL_SPEED  = 1.8;   // lane units/s
const PUMP_BOOST     = 1.8;   // m/s added per pump
const MOMENTUM_DECAY = 1.2;   // decay rate /s
const MAX_SPEED      = 18.0;
const MIN_SPEED      = 3.5;

export function updatePhysics(s: SurferState, input: InputState, dt: number): void {
  if (s.wiped) {
    s.wipeoutTimer += dt;
    return;
  }

  // Stance
  const prevStance = s.stance;
  if (input.down) {
    s.stance = 'crouch';
  } else if (input.up) {
    s.stance = 'stand';
  }

  // Pumping: transition from crouch → stand
  if (prevStance === 'crouch' && s.stance === 'stand') {
    s.momentum += PUMP_BOOST;
    s.recentlyCrouched = true;
    s.crouchTimer = 0;
  }
  if (s.stance === 'crouch') {
    s.crouchTimer += dt;
    s.recentlyCrouched = s.crouchTimer < 0.5;
  }

  // Momentum decay
  s.momentum = Math.max(0, s.momentum - MOMENTUM_DECAY * s.momentum * dt);

  // Speed
  const stanceMult = s.stance === 'crouch' ? 1.35 : 0.72;
  s.speed = clamp(BASE_SPEED * stanceMult + s.momentum, MIN_SPEED, MAX_SPEED);

  // Lateral movement — tilt drives position directly; buttons drive rate
  if (input.tiltLane !== null) {
    s.lanePosition += (input.tiltLane - s.lanePosition) * Math.min(9 * dt, 1);
  } else {
    if (input.left)  s.lanePosition -= LATERAL_SPEED * dt;
    if (input.right) s.lanePosition += LATERAL_SPEED * dt;
  }

  s.lanePosition = clamp(s.lanePosition, -1.0, 1.0);

  // Wipeout at edges
  if (s.lanePosition >= 0.98 || s.lanePosition <= -0.98) {
    s.wiped = true;
  }

  // Sprite animation
  s.animTimer += dt;
  if (s.animTimer > 0.18) {
    s.animTimer = 0;
    s.animFrame = (s.animFrame + 1) % 4;
  }
}
