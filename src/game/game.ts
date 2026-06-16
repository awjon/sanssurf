import { GameState }                            from './state';
import { Wave }                                  from './wave';
import { SurferState, createSurfer, SURFER_SCREEN_X_RATIO, laneToUVY, uvYToScreen } from './surfer';
import { updatePhysics }                         from './physics';
import { ObstacleManager, Obstacle }            from './obstacle-manager';
import { Scoring }                               from './scoring';
import { InputManager }                         from '../input/input-manager';
import { StartScreen }                           from '../ui/start-screen';
import { HUD, TouchZoneLayout }                 from '../ui/hud';
import { GameOverScreen }                        from '../ui/game-over-screen';
import { ObstacleKind, OBSTACLE_CONFIGS }       from '../entities/obstacle-types';
import { lerp, easeOutCubic, clamp }            from '../utils/math';
import { Clock }                                 from '../utils/time';

const WAVE_ENTER_DURATION = 2.8;
const WIPEOUT_DURATION    = 1.0;

export interface RenderGlobals {
  time: number;
  deltaTime: number;
  cameraScroll: number;
  waveXOffset: number;
  waveState: number;
  shakeX: number;
}

export interface RenderFrame {
  globals: RenderGlobals;
  state: GameState;
  surfer: SurferState;
  obstacles: readonly Obstacle[];
  stateTimer: number;
  waveName: string;
  screenWidth: number;
  screenHeight: number;
  touchZones: TouchZoneLayout | null;
  hitLabel: string;
}

export class Game {
  private state     = GameState.LOADING;
  private stateTimer = 0;
  private clock     = new Clock();

  private wave      = new Wave();
  private surfer    = createSurfer();
  private obstacles = new ObstacleManager();
  private scoring   = new Scoring();

  private startScreen   = new StartScreen();
  private hud           = new HUD();
  private gameOverScreen = new GameOverScreen();

  private cameraScroll = 0;
  private waveXOffset  = -0.55;
  private shakeX       = 0;
  private shakeTimer   = 0;
  private hitLabel     = '';

  private touchZones: TouchZoneLayout | null = null;
  private letterScrollTimer = 0;

  constructor(
    private input: InputManager,
    private canvas: HTMLCanvasElement,  // ui-canvas for 2D
    private ctx: CanvasRenderingContext2D,
  ) {}

  start(): void {
    this.state = GameState.START;
    this.startScreen.pickNewWave();
  }

  tick(timestamp: number, frame: (rf: RenderFrame) => void): void {
    const dt = this.clock.tick(timestamp);
    const t  = this.clock.getElapsed();

    this.input.update();
    const inp = this.input.getState();

    const W = this.canvas.clientWidth;
    const H = this.canvas.clientHeight;

    // Screen shake decay
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      this.shakeX = (this.shakeTimer > 0) ? (Math.random() - 0.5) * 0.012 * (this.shakeTimer / 0.4) : 0;
    }

    switch (this.state) {
      case GameState.START:
        if (inp.justAction) this.transition(GameState.WAVE_ENTER);
        break;

      case GameState.WAVE_ENTER: {
        const progress = Math.min(this.stateTimer / WAVE_ENTER_DURATION, 1);
        this.waveXOffset = lerp(-0.55, 0, easeOutCubic(progress));
        if (this.stateTimer >= WAVE_ENTER_DURATION) this.transition(GameState.SURFING);
        break;
      }

      case GameState.SURFING: {
        updatePhysics(this.surfer, inp, dt);
        this.cameraScroll += this.surfer.speed * dt;
        this.scoring.update(this.surfer.speed, dt);

        const uvY  = laneToUVY(this.surfer.lanePosition);
        const face = this.wave.rightEdgeUV(uvY, t) + this.waveXOffset;
        const sxPx = face * W;
        const syPx = uvYToScreen(uvY, H);

        const surferW = H * 0.06;
        const surferH = H * 0.10;

        const hit = this.obstacles.checkCollision(sxPx, syPx, surferW, surferH);
        if (hit !== null) {
          this.hitLabel = OBSTACLE_CONFIGS[hit]?.label ?? 'OBSTACLE';
          this.surfer.wiped = true;
        }

        if (this.surfer.wiped) {
          this.shakeTimer = 0.4;
          this.transition(GameState.WIPEOUT);
        }

        // scrollSpeed in px/s: matches how fast the background appears to move
        this.obstacles.update(dt, this.surfer.speed * W * 0.0085, W, H);

        if (this.input.isTouchPrimary) {
          this.touchZones = this.hud.defaultTouchZones(W, H);
          this.input.setTouchZones([
            { id: 'left',  ...this.touchZones.left  },
            { id: 'right', ...this.touchZones.right },
            { id: 'up',    ...this.touchZones.up    },
            { id: 'down',  ...this.touchZones.down  },
          ]);
        }
        break;
      }

      case GameState.WIPEOUT:
        this.obstacles.update(dt, this.surfer.speed * W * 0.0085, W, H);
        if (this.stateTimer >= WIPEOUT_DURATION) {
          const scores = this.scoring.loadScores();
          this.gameOverScreen.setup(this.scoring.getDistance(), this.scoring.getPersonalBest(), scores, this.hitLabel);
          this.transition(GameState.GAME_OVER);
        }
        break;

      case GameState.GAME_OVER: {
        this.touchZones = null;
        this.input.setTouchZones([]);

        // Letter scrolling
        this.letterScrollTimer -= dt;
        if (this.letterScrollTimer <= 0) {
          if (inp.left)  { this.gameOverScreen.scrollLetter(-1); this.letterScrollTimer = 0.12; }
          if (inp.right) { this.gameOverScreen.scrollLetter( 1); this.letterScrollTimer = 0.12; }
        }

        const shouldRetry = this.gameOverScreen.handleInput(inp);
        if (shouldRetry) {
          this.scoring.saveScore(this.gameOverScreen.getName());
          this.restart();
        }
        break;
      }

      default: break;
    }

    this.stateTimer += dt;

    // Draw Canvas 2D
    this.drawUI(t, W, H);

    // Provide render frame to WebGPU layer
    frame({
      globals: {
        time: t, deltaTime: dt,
        cameraScroll: this.cameraScroll,
        waveXOffset: this.waveXOffset,
        waveState: this.state === GameState.SURFING ? 1 : 0,
        shakeX: this.shakeX,
      },
      state: this.state,
      surfer: { ...this.surfer },
      obstacles: this.obstacles.getActive(),
      stateTimer: this.stateTimer,
      waveName: this.startScreen.getWaveName(),
      screenWidth: W,
      screenHeight: H,
      touchZones: this.touchZones,
      hitLabel: this.hitLabel,
    });
  }

  private transition(next: GameState): void {
    this.state = next;
    this.stateTimer = 0;
  }

  private restart(): void {
    this.surfer       = createSurfer();
    this.obstacles.reset();
    this.scoring.reset();
    this.cameraScroll = 0;
    this.waveXOffset  = 0;
    this.hitLabel     = '';
    this.startScreen.pickNewWave();
    this.transition(GameState.WAVE_ENTER);
  }

  private drawUI(t: number, W: number, H: number): void {
    this.ctx.clearRect(0, 0, W, H);

    // Portrait warning
    if (W < H && W < 600) {
      this.ctx.fillStyle = 'rgba(0,10,30,0.95)';
      this.ctx.fillRect(0, 0, W, H);
      this.ctx.fillStyle = '#FFD700';
      this.ctx.font = `bold ${Math.min(W * 0.1, 32)}px 'Courier New', monospace`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('↻ ROTATE TO PLAY', W / 2, H / 2);
      return;
    }

    switch (this.state) {
      case GameState.START:
        this.startScreen.draw(this.ctx, W, H, this.input.isTouchPrimary);
        break;

      case GameState.WAVE_ENTER:
        this.drawWaveIntro(t, W, H);
        break;

      case GameState.SURFING:
        this.drawSurfer(t, W, H);
        this.drawObstacles(W, H);
        this.hud.drawHUD(this.ctx, W, H, this.scoring.getDistance(), this.surfer.speed, this.surfer.momentum, this.surfer);
        if (this.input.isTouchPrimary && this.touchZones) {
          this.hud.drawTouchControls(this.ctx, W, H, this.touchZones);
        }
        break;

      case GameState.WIPEOUT:
        this.drawWipeoutSurfer(t, W, H);
        this.drawObstacles(W, H);
        this.hud.drawHUD(this.ctx, W, H, this.scoring.getDistance(), 0, 0, this.surfer);
        break;

      case GameState.GAME_OVER:
        this.gameOverScreen.draw(this.ctx, W, H, this.stateTimer, this.input.isTouchPrimary);
        break;
    }
  }

  private drawWaveIntro(t: number, W: number, H: number): void {
    const progress = Math.min(this.stateTimer / WAVE_ENTER_DURATION, 1);
    const alpha    = progress < 0.3
      ? easeOutCubic(progress / 0.3)
      : progress > 0.75
        ? 1 - easeOutCubic((progress - 0.75) / 0.25)
        : 1;

    if (alpha <= 0) return;
    const base = Math.min(H * 0.08, W * 0.05);
    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillStyle = 'rgba(0,0,0,0.45)';
    this.ctx.fillRect(W * 0.5 - W * 0.35, H * 0.38, W * 0.7, base * 2.8);
    this.ctx.font = `${base * 0.45}px 'Courier New', monospace`;
    this.ctx.fillStyle = '#00CFFF';
    this.ctx.fillText('INCOMING WAVE', W / 2, H * 0.44);
    this.ctx.font = `bold ${base}px 'Courier New', monospace`;
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.shadowColor = '#FFD700';
    this.ctx.shadowBlur  = 30;
    this.ctx.fillText(this.startScreen.getWaveName().toUpperCase(), W / 2, H * 0.54);
    this.ctx.restore();
  }

  private drawSurfer(t: number, W: number, H: number): void {
    const uvY  = laneToUVY(this.surfer.lanePosition);
    const face = this.wave.rightEdgeUV(uvY, t) + this.waveXOffset;
    const sx   = face * W;
    const sy   = uvY * H;

    const sh = H * 0.10;
    const sw = sh * 0.55;

    this.ctx.save();
    this.ctx.translate(sx, sy);

    const bob = Math.sin(t * 3.5 + this.surfer.animFrame) * (H * 0.004);
    this.ctx.translate(0, bob);

    if (this.surfer.stance === 'crouch') {
      drawCrouchSurfer(this.ctx, sw, sh);
    } else {
      drawStandSurfer(this.ctx, sw, sh);
    }

    // Spray trail at surfboard
    if (this.surfer.speed > 9) {
      drawSpray(this.ctx, sw, sh, this.surfer.speed, t);
    }

    this.ctx.restore();
  }

  private drawWipeoutSurfer(t: number, W: number, H: number): void {
    const uvY  = laneToUVY(this.surfer.lanePosition);
    const face = this.wave.rightEdgeUV(uvY, t) + this.waveXOffset;
    const sx   = face * W + this.stateTimer * W * 0.05;
    const sy   = uvY * H + this.stateTimer * H * 0.12;
    const sh   = H * 0.10;
    const sw   = sh * 0.55;

    this.ctx.save();
    this.ctx.translate(sx, sy);
    this.ctx.rotate(this.stateTimer * 8.0);
    this.ctx.globalAlpha = Math.max(0, 1 - this.stateTimer / WIPEOUT_DURATION);
    drawStandSurfer(this.ctx, sw, sh);
    this.ctx.restore();
  }

  private drawObstacles(W: number, H: number): void {
    for (const obs of this.obstacles.getActive()) {
      const cfg = OBSTACLE_CONFIGS[obs.kind];
      if (!cfg) continue;
      this.ctx.save();
      this.ctx.translate(obs.x, obs.y);
      drawObstacleShape(this.ctx, obs.kind, obs.width, obs.height, cfg.color, cfg.accentColor);
      this.ctx.restore();
    }
  }
}

// ---- Procedural drawing helpers ----

function drawStandSurfer(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const hd = h * 0.14; // head radius

  // Board
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(255,255,255,0.4)';
  ctx.shadowBlur  = 6;
  ctx.beginPath();
  ctx.ellipse(0, h * 0.45, w * 0.75, h * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;

  // Body
  ctx.fillStyle = '#1A1A2E';
  ctx.beginPath();
  ctx.roundRect(-w * 0.22, -h * 0.3, w * 0.44, h * 0.62, [w * 0.12]);
  ctx.fill();

  // Wetsuit accent
  ctx.fillStyle = '#0066CC';
  ctx.beginPath();
  ctx.roundRect(-w * 0.22, h * 0.0, w * 0.44, h * 0.28, [w * 0.06]);
  ctx.fill();

  // Head
  ctx.fillStyle = '#F4C2A1';
  ctx.beginPath();
  ctx.arc(0, -h * 0.38, hd, 0, Math.PI * 2);
  ctx.fill();

  // Arms
  ctx.strokeStyle = '#1A1A2E';
  ctx.lineWidth   = w * 0.16;
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(-w * 0.22, -h * 0.12);
  ctx.lineTo(-w * 0.6,  -h * 0.0);
  ctx.moveTo( w * 0.22, -h * 0.12);
  ctx.lineTo( w * 0.5,   h * 0.05);
  ctx.stroke();
}

function drawCrouchSurfer(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const hd = h * 0.13;
  const bh = h * 0.38;

  // Board
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(255,255,255,0.4)';
  ctx.shadowBlur  = 6;
  ctx.beginPath();
  ctx.ellipse(0, h * 0.28, w * 0.80, h * 0.065, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Body (low, wide)
  ctx.fillStyle = '#1A1A2E';
  ctx.beginPath();
  ctx.roundRect(-w * 0.28, -h * 0.16, w * 0.56, bh, [w * 0.10]);
  ctx.fill();
  ctx.fillStyle = '#0066CC';
  ctx.beginPath();
  ctx.roundRect(-w * 0.28, h * 0.04, w * 0.56, bh * 0.4, [w * 0.05]);
  ctx.fill();

  // Head (lower)
  ctx.fillStyle = '#F4C2A1';
  ctx.beginPath();
  ctx.arc(w * 0.05, -h * 0.22, hd, 0, Math.PI * 2);
  ctx.fill();

  // Arms out for balance
  ctx.strokeStyle = '#1A1A2E';
  ctx.lineWidth   = w * 0.14;
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(-w * 0.28, -h * 0.05);
  ctx.lineTo(-w * 0.65, -h * 0.12);
  ctx.moveTo( w * 0.28, -h * 0.05);
  ctx.lineTo( w * 0.65, -h * 0.05);
  ctx.stroke();
}

function drawSpray(ctx: CanvasRenderingContext2D, w: number, h: number, speed: number, t: number): void {
  const intensity = (speed - 9) / 9;
  ctx.save();
  ctx.globalAlpha = intensity * 0.55;
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI + (Math.random() - 0.5) * 0.8;
    const len   = w * (0.5 + Math.random() * 0.9);
    const px    = -w * 0.6 + Math.cos(angle) * len;
    const py    =  h * 0.44 + Math.sin(angle) * len * 0.4;
    ctx.fillStyle = `rgba(255,255,255,${0.4 + Math.random() * 0.4})`;
    ctx.beginPath();
    ctx.arc(px, py, w * (0.04 + Math.random() * 0.08), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawObstacleShape(
  ctx: CanvasRenderingContext2D,
  kind: ObstacleKind,
  w: number, h: number,
  color: string, accent: string,
): void {
  switch (kind) {
    case ObstacleKind.ROCK:
      drawRock(ctx, w, h, color, accent);
      break;
    case ObstacleKind.TOURIST_SWIM:
      drawTouristSwim(ctx, w, h, color, accent);
      break;
    case ObstacleKind.TOURIST_FLOAT:
      drawTouristFloat(ctx, w, h, color, accent);
      break;
    case ObstacleKind.KAYAK:
      drawKayak(ctx, w, h, color, accent);
      break;
    case ObstacleKind.OTHER_SURFER:
      drawOtherSurfer(ctx, w, h, color, accent);
      break;
    case ObstacleKind.SHARK:
      drawShark(ctx, w, h, color, accent);
      break;
    case ObstacleKind.DOLPHIN:
      drawDolphin(ctx, w, h, color, accent);
      break;
  }
}

function drawRock(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, accent: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-w * 0.5, h * 0.3);
  ctx.lineTo(-w * 0.35, -h * 0.4);
  ctx.lineTo(-w * 0.05, -h * 0.5);
  ctx.lineTo( w * 0.3,  -h * 0.35);
  ctx.lineTo( w * 0.5,   h * 0.1);
  ctx.lineTo( w * 0.35,  h * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(-w * 0.2, -h * 0.35);
  ctx.lineTo( w * 0.0, -h * 0.48);
  ctx.lineTo( w * 0.2, -h * 0.28);
  ctx.closePath();
  ctx.fill();
}

function drawTouristSwim(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, accent: string): void {
  // Body in water
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, h * 0.1, w * 0.35, h * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();
  // Head
  ctx.fillStyle = '#F4C2A1';
  ctx.beginPath();
  ctx.arc(0, -h * 0.22, h * 0.18, 0, Math.PI * 2);
  ctx.fill();
  // Swim cap
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(0, -h * 0.28, h * 0.15, Math.PI, 0);
  ctx.fill();
  // Arms splashing
  ctx.strokeStyle = color;
  ctx.lineWidth   = w * 0.12;
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(-w * 0.3, h * 0.05);
  ctx.lineTo(-w * 0.55, -h * 0.1);
  ctx.moveTo(w * 0.3, h * 0.05);
  ctx.lineTo(w * 0.55, -h * 0.1);
  ctx.stroke();
}

function drawTouristFloat(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, accent: string): void {
  // Ring
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, h * 0.05, w * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    ctx.moveTo(Math.cos(a) * w * 0.45, Math.sin(a) * h * 0.3 + h * 0.05);
    ctx.arc(Math.cos(a) * w * 0.32, Math.sin(a) * h * 0.21 + h * 0.05, w * 0.12, 0, Math.PI * 2);
  }
  ctx.fill();
  // Hole
  ctx.fillStyle = 'rgba(0,80,160,0.6)';
  ctx.beginPath();
  ctx.arc(0, h * 0.05, w * 0.20, 0, Math.PI * 2);
  ctx.fill();
  // Person
  ctx.fillStyle = '#F4C2A1';
  ctx.beginPath();
  ctx.arc(0, -h * 0.22, h * 0.16, 0, Math.PI * 2);
  ctx.fill();
}

function drawKayak(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, accent: string): void {
  // Hull
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, h * 0.1, w * 0.5, h * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.ellipse(0, h * 0.05, w * 0.5, h * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  // Paddler
  ctx.fillStyle = '#F4C2A1';
  ctx.beginPath();
  ctx.arc(0, -h * 0.25, h * 0.14, 0, Math.PI * 2);
  ctx.fill();
  // Paddle
  ctx.strokeStyle = '#8B5A2B';
  ctx.lineWidth   = w * 0.06;
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(-w * 0.65, -h * 0.1);
  ctx.lineTo( w * 0.65, -h * 0.1);
  ctx.stroke();
  // Paddle blades
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.ellipse(-w * 0.65, -h * 0.1, w * 0.12, h * 0.18, -0.4, 0, Math.PI * 2);
  ctx.ellipse( w * 0.65, -h * 0.1, w * 0.12, h * 0.18,  0.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawOtherSurfer(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, accent: string): void {
  // Board
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.ellipse(0, h * 0.4, w * 0.7, h * 0.065, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(-w * 0.2, -h * 0.25, w * 0.4, h * 0.55, [w * 0.1]);
  ctx.fill();
  ctx.fillStyle = '#F4C2A1';
  ctx.beginPath();
  ctx.arc(0, -h * 0.35, h * 0.13, 0, Math.PI * 2);
  ctx.fill();
}

function drawShark(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, accent: string): void {
  ctx.fillStyle = color;
  // Body
  ctx.beginPath();
  ctx.moveTo(-w * 0.5, h * 0.1);
  ctx.quadraticCurveTo(-w * 0.1, -h * 0.05, w * 0.5, h * 0.05);
  ctx.quadraticCurveTo( w * 0.3, h * 0.3, -w * 0.5, h * 0.25);
  ctx.closePath();
  ctx.fill();
  // Dorsal fin
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.05);
  ctx.lineTo(w * 0.1, -h * 0.38);
  ctx.lineTo(w * 0.25, h * 0.02);
  ctx.closePath();
  ctx.fill();
  // Tail fin
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-w * 0.45, h * 0.15);
  ctx.lineTo(-w * 0.7, -h * 0.15);
  ctx.lineTo(-w * 0.55, h * 0.25);
  ctx.lineTo(-w * 0.75, h * 0.42);
  ctx.lineTo(-w * 0.45, h * 0.28);
  ctx.closePath();
  ctx.fill();
  // Eye
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(w * 0.35, h * 0.06, w * 0.04, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(w * 0.36, h * 0.06, w * 0.025, 0, Math.PI * 2);
  ctx.fill();
}

function drawDolphin(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, accent: string): void {
  ctx.fillStyle = color;
  // Body
  ctx.beginPath();
  ctx.moveTo(-w * 0.5, h * 0.08);
  ctx.quadraticCurveTo(0, -h * 0.18, w * 0.45, h * 0.05);
  ctx.quadraticCurveTo(w * 0.3, h * 0.28, -w * 0.5, h * 0.22);
  ctx.closePath();
  ctx.fill();
  // Belly
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.ellipse(w * 0.05, h * 0.16, w * 0.28, h * 0.08, -0.1, 0, Math.PI * 2);
  ctx.fill();
  // Dorsal fin
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(w * 0.05, h * 0.02);
  ctx.lineTo(w * 0.18, -h * 0.28);
  ctx.lineTo(w * 0.28, h * 0.0);
  ctx.closePath();
  ctx.fill();
  // Tail
  ctx.beginPath();
  ctx.moveTo(-w * 0.45, h * 0.14);
  ctx.lineTo(-w * 0.65, -h * 0.10);
  ctx.lineTo(-w * 0.52, h * 0.20);
  ctx.lineTo(-w * 0.68, h * 0.38);
  ctx.lineTo(-w * 0.45, h * 0.26);
  ctx.closePath();
  ctx.fill();
  // Eye
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(w * 0.38, h * 0.04, w * 0.035, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1A1A2E';
  ctx.beginPath();
  ctx.arc(w * 0.39, h * 0.04, w * 0.02, 0, Math.PI * 2);
  ctx.fill();
}
