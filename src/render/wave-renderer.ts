import commonWgsl from '../shaders/common.wgsl?raw';
import waveWgsl   from '../shaders/wave.wgsl?raw';

export class WaveRenderer {
  private pipeline!: GPURenderPipeline;
  private bindGroup!: GPUBindGroup;

  constructor(
    private device: GPUDevice,
    private format: GPUTextureFormat,
    private globalsBuffer: GPUBuffer,
  ) {}

  init(): void {
    const module = this.device.createShaderModule({
      code: commonWgsl + '\n' + waveWgsl,
    });

    const bgl = this.device.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX, buffer: {} }],
    });

    this.bindGroup = this.device.createBindGroup({
      layout: bgl,
      entries: [{ binding: 0, resource: { buffer: this.globalsBuffer } }],
    });

    this.pipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [bgl] }),
      vertex:   { module, entryPoint: 'vs_fullscreen' },
      fragment: {
        module,
        entryPoint: 'fs_wave',
        targets: [{
          format: this.format,
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one',       dstFactor: 'one-minus-src-alpha', operation: 'add' },
          },
        }],
      },
      primitive: { topology: 'triangle-list' },
    });
  }

  encode(encoder: GPUCommandEncoder, view: GPUTextureView): void {
    const pass = encoder.beginRenderPass({
      colorAttachments: [{ view, loadOp: 'load', storeOp: 'store' }],
    });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(6);
    pass.end();
  }
}
