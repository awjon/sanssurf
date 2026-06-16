// CPU-side wave model that mirrors the waveRightEdge() WGSL function
// Used for positioning the surfer accurately on the wave face.

export class Wave {
  // Returns the wave face X position in UV space (0..1) at a given UV Y and time
  rightEdgeUV(v: number, t: number): number {
    const base = 0.355;
    const w1   = 0.032 * Math.sin(v * 3.8 + t * 1.3);
    const w2   = 0.014 * Math.sin(v * 8.7 + t * 2.2 + 1.1);
    const w3   = 0.006 * Math.sin(v * 18.0 + t * 3.5 + 0.4);
    const curl = 0.042 * this.smoothstep(0.18, 0.0, v) * (0.6 + 0.4 * Math.sin(t * 0.7));
    return base + w1 + w2 + w3 + curl;
  }

  private smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }
}
