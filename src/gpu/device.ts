export interface GPUContext {
  device: GPUDevice;
  context: GPUCanvasContext;
  format: GPUTextureFormat;
}

export async function initGPU(canvas: HTMLCanvasElement): Promise<GPUContext> {
  if (!navigator.gpu) throw new Error('WebGPU not supported');

  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) throw new Error('No WebGPU adapter');

  const device = await adapter.requestDevice();
  device.lost.then((info) => {
    console.error('WebGPU device lost:', info.message);
    document.getElementById('no-webgpu')?.classList.add('visible');
  });

  const context = canvas.getContext('webgpu') as GPUCanvasContext;
  const format = navigator.gpu.getPreferredCanvasFormat();

  const resize = () => {
    const w = Math.floor(window.innerWidth * devicePixelRatio);
    const h = Math.floor(window.innerHeight * devicePixelRatio);
    canvas.width  = w;
    canvas.height = h;
    context.configure({ device, format, alphaMode: 'opaque' });
  };

  window.addEventListener('resize', resize);
  resize();

  return { device, context, format };
}
