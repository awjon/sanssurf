export class Clock {
  private last = 0;
  private elapsed = 0;

  tick(timestamp: number): number {
    if (this.last === 0) this.last = timestamp;
    const dt = Math.min((timestamp - this.last) / 1000, 0.05);
    this.last = timestamp;
    this.elapsed += dt;
    return dt;
  }

  getElapsed(): number { return this.elapsed; }
  reset(): void { this.last = 0; this.elapsed = 0; }
}
