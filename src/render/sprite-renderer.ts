import type { SpriteCall } from '../game/game';
import commonWgsl from '../shaders/common.wgsl?raw';
import spriteWgsl from '../shaders/sprite.wgsl?raw';

const MAX_SPRITES     = 64;
const INSTANCE_FLOATS = 8;   // x y w h opacity flipX pad pad
const INSTANCE_BYTES  = INSTANCE_FLOATS * 4;

export class SpriteRenderer {
  private device!: GPUDevice;
  private pipeline!: GPURenderPipeline;
  private instanceBuffer!: GPUBuffer;
  private instanceData = new Float32Array(MAX_SPRITES * INSTANCE_FLOATS);
  private globalsBindGroup!: GPUBindGroup;
  private instanceBindGroup!: GPUBindGroup;
  private textureBindGroups = new Map<string, GPUBindGroup>();

  init(
    device: GPUDevice,
    format: GPUTextureFormat,
    globalsBuffer: GPUBuffer,
    textures: Map<string, GPUTexture>,
  ): void {
    this.device = device;

    const shader = device.createShaderModule({
      label: 'sprite-shader',
      code: commonWgsl + spriteWgsl,
    });

    this.instanceBuffer = device.createBuffer({
      label: 'sprite-instance-buffer',
      size:  MAX_SPRITES * INSTANCE_BYTES,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    const bgl0 = device.createBindGroupLayout({
      label: 'sprite-bgl-globals',
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      }],
    });
    const bgl1 = device.createBindGroupLayout({
      label: 'sprite-bgl-instances',
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: 'read-only-storage' },
      }],
    });
    const bgl2 = device.createBindGroupLayout({
      label: 'sprite-bgl-texture',
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      ],
    });

    this.pipeline = device.createRenderPipeline({
      label: 'sprite-pipeline',
      layout: device.createPipelineLayout({ bindGroupLayouts: [bgl0, bgl1, bgl2] }),
      vertex:   { module: shader, entryPoint: 'vs_sprite' },
      fragment: {
        module: shader,
        entryPoint: 'fs_sprite',
        targets: [{
          format,
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one',       dstFactor: 'one-minus-src-alpha', operation: 'add' },
          },
        }],
      },
      primitive: { topology: 'triangle-list' },
    });

    this.globalsBindGroup = device.createBindGroup({
      label:   'sprite-globals-bg',
      layout:  bgl0,
      entries: [{ binding: 0, resource: { buffer: globalsBuffer } }],
    });

    this.instanceBindGroup = device.createBindGroup({
      label:   'sprite-instance-bg',
      layout:  bgl1,
      entries: [{ binding: 0, resource: { buffer: this.instanceBuffer } }],
    });

    const sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });

    for (const [key, tex] of textures) {
      this.textureBindGroups.set(key, device.createBindGroup({
        label:   `sprite-tex-bg-${key}`,
        layout:  bgl2,
        entries: [
          { binding: 0, resource: tex.createView() },
          { binding: 1, resource: sampler },
        ],
      }));
    }
  }

  encode(
    encoder: GPUCommandEncoder,
    view: GPUTextureView,
    spriteCalls: readonly SpriteCall[],
  ): void {
    if (spriteCalls.length === 0) return;

    // Group calls by textureKey, preserving order
    const byTexture = new Map<string, SpriteCall[]>();
    for (const sc of spriteCalls) {
      if (!this.textureBindGroups.has(sc.textureKey)) continue;
      let arr = byTexture.get(sc.textureKey);
      if (!arr) { arr = []; byTexture.set(sc.textureKey, arr); }
      arr.push(sc);
    }
    if (byTexture.size === 0) return;

    // Pack all instances into CPU buffer
    let offset = 0;
    const drawCalls: Array<{ bg: GPUBindGroup; first: number; count: number }> = [];

    for (const [key, calls] of byTexture) {
      const bg    = this.textureBindGroups.get(key)!;
      const first = offset;
      for (const sc of calls) {
        if (offset >= MAX_SPRITES) break;
        const base = offset * INSTANCE_FLOATS;
        this.instanceData[base + 0] = sc.x;
        this.instanceData[base + 1] = sc.y;
        this.instanceData[base + 2] = sc.width;
        this.instanceData[base + 3] = sc.height;
        this.instanceData[base + 4] = sc.opacity ?? 1.0;
        this.instanceData[base + 5] = sc.flipX ? 1.0 : 0.0;
        this.instanceData[base + 6] = 0;
        this.instanceData[base + 7] = 0;
        offset++;
      }
      if (offset > first) drawCalls.push({ bg, first, count: offset - first });
    }

    this.device.queue.writeBuffer(
      this.instanceBuffer, 0,
      this.instanceData.buffer as ArrayBuffer,
      0,
      offset * INSTANCE_BYTES,
    );

    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view,
        loadOp:  'load',
        storeOp: 'store',
      }],
    });

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.globalsBindGroup);
    pass.setBindGroup(1, this.instanceBindGroup);
    for (const dc of drawCalls) {
      pass.setBindGroup(2, dc.bg);
      pass.draw(6, dc.count, 0, dc.first);
    }
    pass.end();
  }
}
