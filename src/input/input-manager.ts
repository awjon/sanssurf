export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  action: boolean;      // space / enter / tap to start / retry
  justAction: boolean;  // only true the frame it was pressed
}

interface TouchZone {
  id: string;
  x: number; y: number; w: number; h: number;
}

export class InputManager {
  private keys = new Set<string>();
  private justPressed = new Set<string>();
  private touchZones: TouchZone[] = [];
  private activeTouches = new Map<number, string>(); // touchId → zoneId
  private touchJustTapped = new Set<string>();

  private state: InputState = {
    left: false, right: false, up: false, down: false, action: false, justAction: false,
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
  }

  setTouchZones(zones: TouchZone[]): void { this.touchZones = zones; }

  private zoneAt(cx: number, cy: number): string | null {
    for (const z of this.touchZones) {
      if (cx >= z.x && cx <= z.x + z.w && cy >= z.y && cy <= z.y + z.h) return z.id;
    }
    return null;
  }

  private handleTouchStart(e: TouchEvent): void {
    for (const touch of Array.from(e.changedTouches)) {
      // Convert to CSS pixels
      const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
      const cx = touch.clientX - rect.left;
      const cy = touch.clientY - rect.top;
      const zone = this.zoneAt(cx, cy);
      if (zone) {
        this.activeTouches.set(touch.identifier, zone);
        if (zone === 'action') this.touchJustTapped.add('action');
      } else {
        // anywhere = action for start/game-over screens
        this.activeTouches.set(touch.identifier, 'action');
        this.touchJustTapped.add('action');
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

    this.state.left   = keyLeft   || held('left');
    this.state.right  = keyRight  || held('right');
    this.state.up     = keyUp     || held('up');
    this.state.down   = keyDown   || held('down');
    this.state.action = keyAct || this.touchJustTapped.has('action');
    this.state.justAction = keyAct || this.touchJustTapped.has('action');

    this.justPressed.clear();
    this.touchJustTapped.clear();
  }

  getState(): Readonly<InputState> { return this.state; }
}
