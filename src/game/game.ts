import { GameState }                                from './state';
import { SurferState, createSurfer, laneToScreenX,
         SURFER_Y_RATIO }                           from './surfer';
import { updatePhysics }                            from './physics';
import { ObstacleManager, Obstacle }               from './obstacle-manager';
import { Scoring }                                  from './scoring';
import { InputManager }                            from '../input/input-manager';
import { StartScreen }                              from '../ui/start-screen';
import { HUD, TouchZoneLayout }                    from '../ui/hud';
import { GameOverScreen }                           from '../ui/game-over-screen';
import { ObstacleKind, OBSTACLE_CONFIGS }          from '../entities/obstacle-types';
import { lerp, easeOutCubic }                      from '../utils/math';
import { Clock }                                    from '../utils/time';

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

export interface SpriteCall {
  textureKey: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity?: number;
  flipX?: boolean;
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
  spriteCalls: SpriteCall[];
}

export class Game {
  private state      = GameState.LOADING;
  private stateTimer = 0;
  private clock      = new Clock();

  private surfer    = createSurfer();
  private obstacles = new ObstacleManager();
  private scoring   = new Scoring();

  private startScreen    = new StartScreen();
  private hud            = new HUD();
  private gameOverScreen = new GameOverScreen();

  private cameraScroll = 0;
  private waveXOffset  = -0.65;
  private shakeX       = 0;
  private shakeTimer   = 0;
  private hitLabel     = '';

  private touchZones: TouchZoneLayout | null = null;
  private letterScrollTimer = 0;

  constructor(
    private input: InputManager,
    private canvas: HTMLCanvasElement,
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

    const spriteCalls: SpriteCall[] = [];

    // Screen shake decay
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      this.shakeX = (this.shakeTimer > 0)
        ? (Math.random() - 0.5) * 0.012 * (this.shakeTimer / 0.4)
        : 0;
    }

    switch (this.state) {
      case GameState.START:
        if (inp.justAction) {
          // Tap is the required user gesture for iOS DeviceOrientation permission
          void this.input.requestTiltPermission();
          this.transition(GameState.WAVE_ENTER);
        }
        break;

      case GameState.WAVE_ENTER: {
        const progress = Math.min(this.stateTimer / WAVE_ENTER_DURATION, 1);
        this.waveXOffset = lerp(-0.65, 0, easeOutCubic(progress));
        if (this.stateTimer >= WAVE_ENTER_DURATION) this.transition(GameState.SURFING);
        break;
      }

      case GameState.SURFING: {
        updatePhysics(this.surfer, inp, dt);
        this.cameraScroll += this.surfer.speed * dt;
        this.scoring.update(this.surfer.speed, dt);

        const surferX = laneToScreenX(this.surfer.lanePosition, W);
        const surferY = H * SURFER_Y_RATIO;
        const surferW = H * 0.07;
        const surferH = H * 0.12;

        const hit = this.obstacles.checkCollision(surferX, surferY, surferW, surferH);
        if (hit !== null) {
          this.hitLabel = OBSTACLE_CONFIGS[hit]?.label ?? 'OBSTACLE';
          this.surfer.wiped = true;
        }

        if (this.surfer.wiped) {
          this.shakeTimer = 0.4;
          this.transition(GameState.WIPEOUT);
        }

        this.obstacles.update(dt, this.surfer.speed, W, H);

        // Surfer sprite
        spriteCalls.push({
          textureKey: this.surfer.stance === 'crouch' ? 'surfer-crouch' : 'surfer-stand',
          x: surferX, y: surferY,
          width: surferW, height: surferH,
          opacity: 1.0,
        });

        // Obstacle sprites
        for (const obs of this.obstacles.getActive()) {
          const cfg = OBSTACLE_CONFIGS[obs.kind];
          if (!cfg) continue;
          spriteCalls.push({
            textureKey: cfg.textureKey,
            x: obs.screenX, y: obs.y,
            width: obs.drawWidth, height: obs.drawHeight,
          });
        }

        if (this.input.isTouchPrimary && !this.input.isTiltActive) {
          this.touchZones = this.hud.defaultTouchZones(W, H);
          this.input.setTouchZones([
            { id: 'left',  ...this.touchZones.left  },
            { id: 'right', ...this.touchZones.right },
            { id: 'up',    ...this.touchZones.up    },
            { id: 'down',  ...this.touchZones.down  },
          ]);
        } else {
          this.touchZones = null;
          this.input.setTouchZones([]);
        }
        break;
      }

      case GameState.WIPEOUT: {
        this.obstacles.update(dt, this.surfer.speed, W, H);

        // Obstacles keep rendering as sprites during wipeout
        for (const obs of this.obstacles.getActive()) {
          const cfg = OBSTACLE_CONFIGS[obs.kind];
          if (!cfg) continue;
          spriteCalls.push({
            textureKey: cfg.textureKey,
            x: obs.screenX, y: obs.y,
            width: obs.drawWidth, height: obs.drawHeight,
          });
        }

        if (this.stateTimer >= WIPEOUT_DURATION) {
          const scores = this.scoring.loadScores();
          this.gameOverScreen.setup(
            this.scoring.getDistance(),
            this.scoring.getPersonalBest(),
            scores,
            this.hitLabel,
          );
          this.transition(GameState.GAME_OVER);
        }
        break;
      }

      case GameState.GAME_OVER: {
        this.touchZones = null;
        this.input.setTouchZones([]);

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

    this.drawUI(t, W, H);

    frame({
      globals: {
        time: t, deltaTime: dt,
        cameraScroll: this.cameraScroll,
        waveXOffset:  this.waveXOffset,
        waveState:    this.state === GameState.SURFING ? 1 : 0,
        shakeX:       this.shakeX,
      },
      state:       this.state,
      surfer:      { ...this.surfer },
      obstacles:   this.obstacles.getActive(),
      stateTimer:  this.stateTimer,
      waveName:    this.startScreen.getWaveName(),
      screenWidth: W,
      screenHeight: H,
      touchZones:  this.touchZones,
      hitLabel:    this.hitLabel,
      spriteCalls,
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
    this.waveXOffset  = -0.65;
    this.hitLabel     = '';
    this.startScreen.pickNewWave();
    this.transition(GameState.WAVE_ENTER);
  }

  private drawUI(t: number, W: number, H: number): void {
    this.ctx.clearRect(0, 0, W, H);

    // Landscape warning on mobile (portrait is the intended orientation)
    if (this.input.isTouchPrimary && W > H) {
      this.ctx.fillStyle = 'rgba(0,10,30,0.95)';
      this.ctx.fillRect(0, 0, W, H);
      this.ctx.fillStyle = '#FFD700';
      this.ctx.font = `bold ${Math.min(H * 0.08, 32)}px 'Courier New', monospace`;
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
        this.drawWaveIntro(W, H);
        break;

      case GameState.SURFING:
        this.hud.drawHUD(this.ctx, W, H, this.scoring.getDistance(), this.surfer.speed, this.surfer.momentum, this.surfer);
        if (this.input.isTouchPrimary && !this.input.isTiltActive && this.touchZones) {
          this.hud.drawTouchControls(this.ctx, W, H, this.touchZones);
        }
        break;

      case GameState.WIPEOUT:
        this.drawWipeoutSurfer(t, W, H);
        this.hud.drawHUD(this.ctx, W, H, this.scoring.getDistance(), 0, 0, this.surfer);
        break;

      case GameState.GAME_OVER:
        this.gameOverScreen.draw(this.ctx, W, H, this.stateTimer, this.input.isTouchPrimary);
        break;
    }
  }

  private drawWaveIntro(W: number, H: number): void {
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

  private drawWipeoutSurfer(t: number, W: number, H: number): void {
    const surferX = laneToScreenX(this.surfer.lanePosition, W);
    const surferY = H * SURFER_Y_RATIO;
    const sh = H * 0.12;
    const sw = sh * 0.55;

    const sx = surferX + this.stateTimer * W * 0.05;
    const sy = surferY + this.stateTimer * H * 0.08;

    this.ctx.save();
    this.ctx.translate(sx, sy);
    this.ctx.rotate(this.stateTimer * 8.0);
    this.ctx.globalAlpha = Math.max(0, 1 - this.stateTimer / WIPEOUT_DURATION);
    drawStandSurfer(this.ctx, sw, sh);
    this.ctx.restore();
  }
}

// ---- Procedural wipeout surfer (Canvas 2D only) ----

function drawStandSurfer(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const hd = h * 0.14;

  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(255,255,255,0.4)';
  ctx.shadowBlur  = 6;
  ctx.beginPath();
  ctx.ellipse(0, h * 0.45, w * 0.75, h * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#1A1A2E';
  ctx.beginPath();
  ctx.roundRect(-w * 0.22, -h * 0.3, w * 0.44, h * 0.62, [w * 0.12]);
  ctx.fill();

  ctx.fillStyle = '#0066CC';
  ctx.beginPath();
  ctx.roundRect(-w * 0.22, h * 0.0, w * 0.44, h * 0.28, [w * 0.06]);
  ctx.fill();

  ctx.fillStyle = '#F4C2A1';
  ctx.beginPath();
  ctx.arc(0, -h * 0.38, hd, 0, Math.PI * 2);
  ctx.fill();

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
