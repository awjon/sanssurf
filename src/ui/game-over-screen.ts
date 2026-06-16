import { ScoreEntry } from '../game/scoring';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export class GameOverScreen {
  private nameChars  = ['A', 'A', 'A'];
  private cursorPos  = 0;
  private nameDone   = false;
  private scores: ScoreEntry[] = [];
  private distance   = 0;
  private personalBest = 0;
  private hitLabel   = '';

  setup(distance: number, personalBest: number, scores: ScoreEntry[], hitLabel: string): void {
    this.distance     = distance;
    this.personalBest = personalBest;
    this.scores       = scores;
    this.nameChars    = ['A', 'A', 'A'];
    this.cursorPos    = 0;
    this.nameDone     = false;
    this.hitLabel     = hitLabel;
  }

  getName(): string { return this.nameChars.join(''); }
  isDone(): boolean { return this.nameDone; }

  handleInput(input: { left: boolean; right: boolean; down: boolean; action: boolean; justAction: boolean }): boolean {
    if (this.nameDone) return input.justAction;

    if (input.justAction) {
      // Advance cursor or confirm
      if (this.cursorPos < 2) {
        this.cursorPos++;
      } else {
        this.nameDone = true;
      }
      return false;
    }

    // Scroll letters (held keys checked externally; caller debounces)
    return false;
  }

  scrollLetter(dir: 1 | -1): void {
    if (this.nameDone) return;
    const cur = this.nameChars[this.cursorPos] ?? 'A';
    const idx = (ALPHABET.indexOf(cur) + dir + 26) % 26;
    this.nameChars[this.cursorPos] = ALPHABET[idx] ?? 'A';
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, elapsed: number, isTouchDevice: boolean): void {
    ctx.save();

    // Full overlay
    ctx.fillStyle = 'rgba(0,8,22,0.82)';
    ctx.fillRect(0, 0, w, h);

    const cx   = w / 2;
    const base = Math.min(h * 0.065, w * 0.045);

    // Panel
    const pw = Math.min(w * 0.85, 560);
    const ph = Math.min(h * 0.80, 520);
    const px = cx - pw / 2;
    const py = h * 0.10;
    ctx.fillStyle = 'rgba(0,20,50,0.92)';
    roundRect(ctx, px, py, pw, ph, 18);
    ctx.fill();
    ctx.strokeStyle = '#00CFFF';
    ctx.lineWidth   = 2;
    roundRect(ctx, px, py, pw, ph, 18);
    ctx.stroke();

    let ry = py + base * 0.8;

    // Header
    ctx.font      = `bold ${base * 1.1}px 'Courier New', monospace`;
    ctx.fillStyle = '#FF4757';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor = '#FF4757';
    ctx.shadowBlur  = 20;
    ctx.fillText('WIPEOUT!', cx, ry);
    ctx.shadowBlur = 0;
    ry += base * 1.4;

    if (this.hitLabel) {
      ctx.font      = `${base * 0.55}px 'Courier New', monospace`;
      ctx.fillStyle = '#FF6B6B';
      ctx.fillText(`hit: ${this.hitLabel}`, cx, ry);
      ry += base * 0.8;
    }

    // Distance
    ctx.font      = `bold ${base * 0.85}px 'Courier New', monospace`;
    ctx.fillStyle = '#FFD700';
    ctx.fillText(`${this.distance} m`, cx, ry);
    ry += base * 1.0;

    if (this.distance > this.personalBest) {
      ctx.font      = `${base * 0.45}px 'Courier New', monospace`;
      ctx.fillStyle = '#2ED573';
      ctx.fillText('★ NEW PERSONAL BEST! ★', cx, ry);
      ry += base * 0.7;
    } else if (this.personalBest > 0) {
      ctx.font      = `${base * 0.4}px 'Courier New', monospace`;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText(`best: ${this.personalBest} m`, cx, ry);
      ry += base * 0.65;
    }

    ry += base * 0.3;

    // Name entry
    if (!this.nameDone) {
      ctx.font      = `${base * 0.45}px 'Courier New', monospace`;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText('ENTER YOUR NAME:', cx, ry);
      ry += base * 0.65;

      const lw  = base * 0.8;
      const lh  = base * 1.0;
      const lsp = base * 0.15;
      const lx  = cx - (lw * 3 + lsp * 2) / 2;
      for (let i = 0; i < 3; i++) {
        const x = lx + i * (lw + lsp);
        const blink = i === this.cursorPos && Math.floor(Date.now() / 400) % 2 === 0;
        ctx.fillStyle = i === this.cursorPos ? 'rgba(0,207,255,0.22)' : 'rgba(255,255,255,0.1)';
        ctx.fillRect(x, ry, lw, lh);
        ctx.strokeStyle = i === this.cursorPos ? (blink ? '#FFD700' : '#00CFFF') : 'rgba(255,255,255,0.3)';
        ctx.lineWidth   = 2;
        ctx.strokeRect(x, ry, lw, lh);
        ctx.font      = `bold ${lh * 0.65}px 'Courier New', monospace`;
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText(this.nameChars[i] ?? 'A', x + lw / 2, ry + lh * 0.15);
      }
      ry += lh + base * 0.3;

      ctx.font = `${base * 0.36}px 'Courier New', monospace`;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      if (isTouchDevice) {
        ctx.fillText('← → change letter   TAP = next / confirm', cx, ry);
      } else {
        ctx.fillText('← → change letter   ENTER / SPACE = confirm', cx, ry);
      }
      ry += base * 0.6;
    } else {
      // Leaderboard
      ctx.font = `${base * 0.45}px 'Courier New', monospace`;
      ctx.fillStyle = '#FFD700';
      ctx.fillText('— TOP SURFERS —', cx, ry);
      ry += base * 0.65;

      const top5 = this.scores.slice(0, 5);
      for (let i = 0; i < top5.length; i++) {
        const entry = top5[i];
        if (!entry) continue;
        ctx.font      = `${base * 0.38}px 'Courier New', monospace`;
        ctx.fillStyle = i === 0 ? '#FFD700' : 'rgba(255,255,255,0.75)';
        ctx.fillText(`${i + 1}. ${entry.name}  ${entry.distance}m`, cx, ry);
        ry += base * 0.52;
      }
      ry += base * 0.3;

      if (Math.floor(Date.now() / 600) % 2 === 0) {
        ctx.font      = `${base * 0.42}px 'Courier New', monospace`;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(isTouchDevice ? 'TAP TO RETRY' : 'R / ENTER TO RETRY', cx, ry);
      }
    }

    ctx.restore();
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
