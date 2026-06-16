import { initGPU }               from './gpu/device';
import { createUniformBuffer, buildGlobals, GLOBALS_SIZE } from './gpu/buffer-utils';
import { BackgroundRenderer }    from './render/background-renderer';
import { WaveRenderer }          from './render/wave-renderer';
import { InputManager }          from './input/input-manager';
import { Game, RenderFrame }     from './game/game';

export class App {
  private rafId = 0;

  async run(): Promise<void> {
    const gpuCanvas = document.getElementById('gpu-canvas') as HTMLCanvasElement;
    const uiCanvas  = document.getElementById('ui-canvas')  as HTMLCanvasElement;
    const ctx2d     = uiCanvas.getContext('2d')!;

    // Sync canvas pixel size with CSS size each frame
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

    const input = new InputManager();
    const game  = new Game(input, uiCanvas, ctx2d);
    game.start();

    const loop = (timestamp: number) => {
      syncCanvases();

      game.tick(timestamp, (frame: RenderFrame) => {
        // Update GPU globals uniform
        const g = frame.globals;
        const W = gpuCanvas.width;
        const H = gpuCanvas.height;
        const globalsData = buildGlobals(
          g.time, g.deltaTime, W, H,
          g.cameraScroll, g.waveXOffset, g.waveState, g.shakeX,
        );
        device.queue.writeBuffer(bgRenderer.getGlobalsBuffer(), 0, globalsData.buffer as ArrayBuffer, globalsData.byteOffset, globalsData.byteLength);

        // Encode and submit GPU frame
        const encoder = device.createCommandEncoder();
        const view    = context.getCurrentTexture().createView();
        bgRenderer.encode(encoder, view);
        waveRenderer.encode(encoder, view);
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
