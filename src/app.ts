import { initGPU }               from './gpu/device';
import { buildGlobals } from './gpu/buffer-utils';
import { loadTextureWithFallback }           from './gpu/texture-utils';
import { BackgroundRenderer }    from './render/background-renderer';
import { WaveRenderer }          from './render/wave-renderer';
import { SpriteRenderer }        from './render/sprite-renderer';
import { InputManager }          from './input/input-manager';
import { Game, RenderFrame }     from './game/game';
import { OBSTACLE_CONFIGS }      from './entities/obstacle-types';
import { ObstacleKind }          from './entities/obstacle-types';

async function buildTextureMap(device: GPUDevice): Promise<Map<string, GPUTexture>> {
  const textures = new Map<string, GPUTexture>();

  // Surfer textures
  textures.set('surfer-stand',  await loadTextureWithFallback(
    device, '/sprites/surfer-stand.png',  'surfer-stand',
    [26, 26, 46, 245]));
  textures.set('surfer-crouch', await loadTextureWithFallback(
    device, '/sprites/surfer-crouch.png', 'surfer-crouch',
    [26, 26, 46, 245]));

  // Obstacle textures
  const kinds = Object.values(ObstacleKind).filter(k => typeof k === 'number') as ObstacleKind[];
  for (const kind of kinds) {
    const cfg = OBSTACLE_CONFIGS[kind];
    if (!cfg) continue;
    const [r, g, b, a] = cfg.placeholderColor;
    textures.set(cfg.textureKey, await loadTextureWithFallback(
      device, `/sprites/${cfg.textureKey}.png`, cfg.textureKey,
      [r, g, b, a]));
  }

  return textures;
}

export class App {
  private rafId = 0;

  async run(): Promise<void> {
    const gpuCanvas = document.getElementById('gpu-canvas') as HTMLCanvasElement;
    const uiCanvas  = document.getElementById('ui-canvas')  as HTMLCanvasElement;
    const ctx2d     = uiCanvas.getContext('2d')!;

    const syncCanvases = () => {
      const dpr = window.devicePixelRatio || 1;
      const w   = Math.floor(window.innerWidth  * dpr);
      const h   = Math.floor(window.innerHeight * dpr);
      if (uiCanvas.width !== w || uiCanvas.height !== h) {
        uiCanvas.width  = w;
        uiCanvas.height = h;
      }
      uiCanvas.style.width  = `${window.innerWidth}px`;
      uiCanvas.style.height = `${window.innerHeight}px`;
    };
    window.addEventListener('resize', syncCanvases);
    syncCanvases();

    const { device, context, format } = await initGPU(gpuCanvas);

    const bgRenderer   = new BackgroundRenderer(device, format);
    bgRenderer.init();

    const waveRenderer = new WaveRenderer(device, format, bgRenderer.getGlobalsBuffer());
    waveRenderer.init();

    const textures      = await buildTextureMap(device);
    const spriteRenderer = new SpriteRenderer();
    spriteRenderer.init(device, format, bgRenderer.getGlobalsBuffer(), textures);

    const input = new InputManager();
    const game  = new Game(input, uiCanvas, ctx2d);
    game.start();

    const loop = (timestamp: number) => {
      syncCanvases();

      game.tick(timestamp, (frame: RenderFrame) => {
        const g = frame.globals;
        const W = gpuCanvas.width;
        const H = gpuCanvas.height;

        const globalsData = buildGlobals(
          g.time, g.deltaTime, W, H,
          g.cameraScroll, g.waveXOffset, g.waveState, g.shakeX,
        );
        device.queue.writeBuffer(
          bgRenderer.getGlobalsBuffer(), 0,
          globalsData.buffer as ArrayBuffer,
          globalsData.byteOffset,
          globalsData.byteLength,
        );

        const encoder = device.createCommandEncoder();
        const view    = context.getCurrentTexture().createView();
        bgRenderer.encode(encoder, view);
        waveRenderer.encode(encoder, view);
        spriteRenderer.encode(encoder, view, frame.spriteCalls);
        device.queue.submit([encoder.finish()]);
      });

      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  destroy(): void {
    cancelAnimationFrame(this.rafId);
  }
}
