import commonWgsl     from '../shaders/common.wgsl?raw';
import backgroundWgsl from '../shaders/background.wgsl?raw';
import bgImageWgsl    from '../shaders/bg-image.wgsl?raw';
import { createUniformBuffer, GLOBALS_SIZE } from '../gpu/buffer-utils';

export class BackgroundRenderer {
  private pipeline!: GPURenderPipeline;
  private bindGroup!: GPUBindGroup;
  private globalsBuffer!: GPUBuffer;

  // Photo background (optional – set via setPhotoBackground)
  private photoPipeline: GPURenderPipeline | null = null;
  private photoBindGroup: GPUBindGroup | null = null;

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

  setPhotoBackground(texture: GPUTexture): void {
    const module = this.device.createShaderModule({
      code: commonWgsl + '\n' + bgImageWgsl,
    });

    const globalsBgl = this.device.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX, buffer: {} }],
    });
    const texBgl = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      ],
    });

    this.photoPipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [globalsBgl, texBgl] }),
      vertex:   { module, entryPoint: 'vs_fullscreen' },
      fragment: { module, entryPoint: 'fs_bg_photo', targets: [{ format: this.format }] },
      primitive: { topology: 'triangle-list' },
    });

    const sampler = this.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      mipmapFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    });

    const globalsBindGroup = this.device.createBindGroup({
      layout: globalsBgl,
      entries: [{ binding: 0, resource: { buffer: this.globalsBuffer } }],
    });

    this.photoBindGroup = this.device.createBindGroup({
      layout: texBgl,
      entries: [
        { binding: 0, resource: texture.createView() },
        { binding: 1, resource: sampler },
      ],
    });

    // Store globals bind group separately for photo pipeline
    this._photoGlobalsBindGroup = globalsBindGroup;
  }

  private _photoGlobalsBindGroup: GPUBindGroup | null = null;

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

    if (this.photoPipeline && this.photoBindGroup && this._photoGlobalsBindGroup) {
      pass.setPipeline(this.photoPipeline);
      pass.setBindGroup(0, this._photoGlobalsBindGroup);
      pass.setBindGroup(1, this.photoBindGroup);
    } else {
      pass.setPipeline(this.pipeline);
      pass.setBindGroup(0, this.bindGroup);
    }

    pass.draw(6);
    pass.end();
  }
}
