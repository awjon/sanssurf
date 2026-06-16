export interface Vec2 { x: number; y: number; }

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function randomRange(lo: number, hi: number): number {
  return lo + Math.random() * (hi - lo);
}

export function randomInt(lo: number, hi: number): number {
  return Math.floor(randomRange(lo, hi + 1));
}

export function mapRange(v: number, inLo: number, inHi: number, outLo: number, outHi: number): number {
  return outLo + ((v - inLo) / (inHi - inLo)) * (outHi - outLo);
}
