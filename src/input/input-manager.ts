export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  action: boolean;
  justAction: boolean;
  tiltLane: number | null; // null = tilt not active; [-1..+1] when active
}

interface TouchZone {
  id: string;
  x: number; y: number; w: number; h: number;
}

const TILT_DEAD_ZONE = 4;  // degrees of tilt with no movement (prevents drift)
const TILT_RANGE     = 26; // degrees beyond the dead zone for full lane deflection

export class InputManager {
  private keys = new Set<string>();
  private justPressed = new Set<string>();
  private touchZones: TouchZone[] = [];
  private activeTouches = new Map<number, string>();
  private touchJustTapped = new Set<string>();

  // Tilt state
  private tiltGamma    = 0;
  private tiltNeutral: number | null = null; // calibrated resting angle
  private _isTiltActive = false;
  private tiltPump     = 0; // 0=none, 1=down-frame, 2=up-frame

  private state: InputState = {
    left: false, right: false, up: false, down: false,
    action: false, justAction: false, tiltLane: null,
  };

  readonly isTouchPrimary: boolean;

  constructor() {
    this.isTouchPrimary = window.matchMedia('(pointer: coarse)').matches;

    window.addEventListener('keydown', e => {
      if (!this.keys.has(e.code)) this.justPressed.add(e.code);
      this.keys.add(e.code);
      e.preventDefault();
    });
    window.addEventListener('keyup', e => { this.keys.delete(e.code); });

    const canvas = document.getElementById('ui-canvas') as HTMLCanvasElement;
    canvas.style.pointerEvents = 'auto';
    canvas.addEventListener('touchstart', e => { e.preventDefault(); this.handleTouchStart(e); }, { passive: false });
    canvas.addEventListener('touchend',   e => { e.preventDefault(); this.handleTouchEnd(e);   }, { passive: false });
    canvas.addEventListener('touchcancel',e => { e.preventDefault(); this.handleTouchEnd(e);   }, { passive: false });
    canvas.addEventListener('click', () => { this.touchJustTapped.add('action'); });

    // Android / non-iOS: start tilt immediately (no permission needed)
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof (DeviceOrientationEvent as unknown as { requestPermission?: unknown }).requestPermission !== 'function') {
      this.startTiltListening();
    }
  }

  get isTiltActive(): boolean { return this._isTiltActive; }

  /** Call this inside a user-gesture handler (e.g. the "tap to ride" button).
   *  iOS 13+ shows a system dialog; Android resolves immediately. */
  async requestTiltPermission(): Promise<boolean> {
    if (typeof DeviceOrientationEvent === 'undefined') return false;
    const DOE = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    if (typeof DOE.requestPermission === 'function') {
      try {
        const result = await DOE.requestPermission();
        if (result === 'granted') { this.startTiltListening(); return true; }
        return false;
      } catch {
        return false;
      }
    }
    // Already listening (Android path from constructor)
    return this._isTiltActive;
  }

  private startTiltListening(): void {
    window.addEventListener('deviceorientation', (e: DeviceOrientationEvent) => {
      if (e.gamma !== null) {
        // Calibrate the resting angle on the first reading so "holding the
        // phone naturally" maps to centre, not whatever raw angle gamma reports.
        if (this.tiltNeutral === null) this.tiltNeutral = e.gamma;
        this.tiltGamma = e.gamma;
        this._isTiltActive = true;
      }
    });
  }

  /** Re-capture the resting tilt angle on the next reading (call on each run). */
  recalibrateTilt(): void { this.tiltNeutral = null; }

  setTouchZones(zones: TouchZone[]): void { this.touchZones = zones; }

  private zoneAt(cx: number, cy: number): string | null {
    for (const z of this.touchZones) {
      if (cx >= z.x && cx <= z.x + z.w && cy >= z.y && cy <= z.y + z.h) return z.id;
    }
    return null;
  }

  private handleTouchStart(e: TouchEvent): void {
    for (const touch of Array.from(e.changedTouches)) {
      const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
      const cx = touch.clientX - rect.left;
      const cy = touch.clientY - rect.top;
      const zone = this.zoneAt(cx, cy);

      if (zone) {
        this.activeTouches.set(touch.identifier, zone);
        if (zone === 'action') this.touchJustTapped.add('action');
      } else {
        // tap with no zone: action (menus) + pump (tilt surfing)
        this.activeTouches.set(touch.identifier, 'action');
        this.touchJustTapped.add('action');
        if (this._isTiltActive && this.tiltPump === 0) this.tiltPump = 1;
      }
    }
  }

  private handleTouchEnd(e: TouchEvent): void {
    for (const touch of Array.from(e.changedTouches)) {
      this.activeTouches.delete(touch.identifier);
    }
  }

  update(): void {
    const held = (zoneId: string) => {
      for (const z of this.activeTouches.values()) if (z === zoneId) return true;
      return false;
    };

    const keyLeft  = this.keys.has('ArrowLeft')  || this.keys.has('KeyA');
    const keyRight = this.keys.has('ArrowRight') || this.keys.has('KeyD');
    const keyUp    = this.keys.has('ArrowUp')   || this.keys.has('KeyW');
    const keyDown  = this.keys.has('ArrowDown') || this.keys.has('KeyS');
    const keyAct   = this.justPressed.has('Space') || this.justPressed.has('Enter') ||
                     this.justPressed.has('KeyR')  || this.justPressed.has('ArrowLeft') ||
                     this.justPressed.has('ArrowRight') || this.justPressed.has('ArrowUp') ||
                     this.justPressed.has('ArrowDown');

    this.state.left  = keyLeft  || held('left');
    this.state.right = keyRight || held('right');
    this.state.up    = keyUp    || held('up');
    this.state.down  = keyDown  || held('down');

    // Tilt pump: inject crouch-then-stand over two frames
    if (this._isTiltActive) {
      if (this.tiltPump === 1) {
        this.state.down = true;
        this.tiltPump = 2;
      } else if (this.tiltPump === 2) {
        this.state.up = true;
        this.tiltPump = 0;
      }
    }

    this.state.action     = keyAct || this.touchJustTapped.has('action');
    this.state.justAction = keyAct || this.touchJustTapped.has('action');

    if (this._isTiltActive && this.tiltNeutral !== null) {
      const raw = this.tiltGamma - this.tiltNeutral;
      const mag = Math.max(0, Math.abs(raw) - TILT_DEAD_ZONE);
      this.state.tiltLane = Math.sign(raw) * Math.min(mag / TILT_RANGE, 1);
    } else {
      this.state.tiltLane = null;
    }

    this.justPressed.clear();
    this.touchJustTapped.clear();
  }

  getState(): Readonly<InputState> { return this.state; }
}
