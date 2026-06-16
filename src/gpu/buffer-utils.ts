export function createUniformBuffer(device: GPUDevice, sizeBytes: number): GPUBuffer {
  return device.createBuffer({
    size: sizeBytes,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
}

export function writeUniform(device: GPUDevice, buffer: GPUBuffer, data: Float32Array): void {
  device.queue.writeBuffer(buffer, 0, data.buffer as ArrayBuffer, data.byteOffset, data.byteLength);
}

// 8 floats = 32 bytes for the Globals struct
export const GLOBALS_SIZE = 32;

export function buildGlobals(
  time: number,
  deltaTime: number,
  width: number,
  height: number,
  cameraScroll: number,
  waveXOffset: number,
  waveState: number,
  shakeX: number,
): Float32Array {
  return new Float32Array([time, deltaTime, width, height, cameraScroll, waveXOffset, waveState, shakeX]);
}
