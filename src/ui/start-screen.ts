const WAVE_NAMES = ['The Pipeline', 'Jaws', 'Mavericks', 'Teahupo\'o', 'Nazaré', 'The Box', 'Cloudbreak'];

export class StartScreen {
  private waveName = WAVE_NAMES[Math.floor(Math.random() * WAVE_NAMES.length)] ?? 'The Pipeline';

  pickNewWave(): void {
    this.waveName = WAVE_NAMES[Math.floor(Math.random() * WAVE_NAMES.length)] ?? 'The Pipeline';
  }

  getWaveName(): string { return this.waveName; }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, isTouchDevice: boolean): void {
    ctx.save();

    // Dark overlay
    ctx.fillStyle = 'rgba(0,10,28,0.65)';
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const baseFont = Math.min(h * 0.13, w * 0.08);

    // Title glow
    ctx.shadowColor = '#00CFFF';
    ctx.shadowBlur  = 40;
    ctx.font        = `bold ${baseFont}px 'Courier New', monospace`;
    ctx.fillStyle   = '#FFFFFF';
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SANSSURF', cx, h * 0.38);

    ctx.shadowBlur  = 0;
    ctx.font        = `bold ${baseFont * 0.35}px 'Courier New', monospace`;
    ctx.fillStyle   = '#FFD700';
    ctx.fillText('ARCADE SURFING', cx, h * 0.50);

    // Blink prompt
    if (Math.floor(Date.now() / 550) % 2 === 0) {
      ctx.font      = `${baseFont * 0.28}px 'Courier New', monospace`;
      ctx.fillStyle = '#FFFFFF';
      const prompt  = isTouchDevice ? 'TAP TO RIDE' : 'PRESS ANY KEY TO RIDE';
      ctx.fillText(prompt, cx, h * 0.64);
    }

    // Controls hint
    ctx.font      = `${baseFont * 0.18}px 'Courier New', monospace`;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    if (isTouchDevice) {
      ctx.fillText('TILT TO STEER  •  TAP TO PUMP', cx, h * 0.76);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillText('↓ FAST  •  ↑ SLOW', cx, h * 0.82);
    } else {
      ctx.fillText('← → move on wave   ↑ stand (slow)   ↓ crouch (fast)   pump: ↓↑↓↑', cx, h * 0.78);
    }

    ctx.restore();
  }
}
