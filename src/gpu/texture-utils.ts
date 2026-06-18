export async function loadTextureWithFallback(
  device: GPUDevice,
  url: string,
  label: string,
  placeholderColor: [number, number, number, number],
): Promise<GPUTexture> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob   = await response.blob();
    const bitmap = await createImageBitmap(blob);
    return uploadBitmap(device, bitmap, label);
  } catch {
    return makePlaceholderTexture(device, label, placeholderColor);
  }
}

export function makePlaceholderTexture(
  device: GPUDevice,
  label: string,
  color: [number, number, number, number],
  w = 128,
  h = 128,
): GPUTexture {
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d')!;

  const [r, g, b, a] = color;
  ctx.fillStyle = `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`;
  ctx.fillRect(0, 0, w, h);

  // Border
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, w - 4, h - 4);

  // Label
  const words = label.split(' ');
  const fontSize = Math.max(10, Math.floor(w / 7));
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.90)';
  const lineH = fontSize * 1.25;
  const startY = h / 2 - ((words.length - 1) * lineH) / 2;
  for (let i = 0; i < words.length; i++) {
    ctx.fillText(words[i]!, w / 2, startY + i * lineH);
  }

  return uploadBitmap(device, canvas.transferToImageBitmap(), label);
}

function uploadBitmap(device: GPUDevice, bitmap: ImageBitmap, label: string): GPUTexture {
  const tex = device.createTexture({
    label,
    size:  [bitmap.width, bitmap.height, 1],
    format: 'rgba8unorm',
    usage:  GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  });
  device.queue.copyExternalImageToTexture(
    { source: bitmap },
    { texture: tex },
    [bitmap.width, bitmap.height],
  );
  return tex;
}
