import commonWgsl     from '../shaders/common.wgsl?raw';
import backgroundWgsl from '../shaders/background.wgsl?raw';
import { createUniformBuffer, GLOBALS_SIZE } from '../gpu/buffer-utils';

export class BackgroundRenderer {
  private pipeline!: GPURenderPipeline;
  private bindGroup!: GPUBindGroup;
  private globalsBuffer!: GPUBuffer;

  constructor(private device: GPUDevice, private format: GPUTextureFormat) {}

  init(): void {
    const module = this.device.createShaderModule({
      code: commonWgsl + '\n' + backgroundWgsl,
    });

    this.globalsBuffer = createUniformBuffer(this.device, GLOBALS_SIZE);

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
      fragment: { module, entryPoint: 'fs_background', targets: [{ format: this.format }] },
      primitive: { topology: 'triangle-list' },
    });
  }

  getGlobalsBuffer(): GPUBuffer { return this.globalsBuffer; }

  encode(encoder: GPUCommandEncoder, view: GPUTextureView): void {
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view,
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: { r: 0.0, g: 0.07, b: 0.16, a: 1.0 },
      }],
    });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(6);
    pass.end();
  }
}
