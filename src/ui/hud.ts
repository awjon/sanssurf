import { SurferState } from '../game/surfer';

export interface TouchZoneLayout {
  left:   { x: number; y: number; w: number; h: number };
  right:  { x: number; y: number; w: number; h: number };
  up:     { x: number; y: number; w: number; h: number };
  down:   { x: number; y: number; w: number; h: number };
}

export class HUD {
  drawHUD(
    ctx: CanvasRenderingContext2D,
    w: number, h: number,
    distance: number,
    speed: number,
    momentum: number,
    surfer: SurferState,
  ): void {
    ctx.save();

    const fs = Math.min(h * 0.042, 28);

    // Distance
    ctx.font      = `bold ${fs}px 'Courier New', monospace`;
    ctx.fillStyle = '#FFD700';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur  = 6;
    ctx.fillText(`${distance}m`, 16, 14);

    // Speed bar
    const barW  = Math.min(w * 0.18, 160);
    const barH  = 10;
    const barX  = w - barW - 16;
    const barY  = 18;
    const fill  = Math.min(speed / 18, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);
    const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    grad.addColorStop(0, '#00CFFF');
    grad.addColorStop(1, '#FF4757');
    ctx.fillStyle = grad;
    ctx.fillRect(barX, barY, barW * fill, barH);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth   = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    // Pump meter
    if (momentum > 0.2) {
      const pFill = Math.min(momentum / 6, 1);
      const pY    = barY + barH + 5;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(barX - 2, pY - 2, barW + 4, 6);
      ctx.fillStyle = '#FFD700';
      ctx.fillRect(barX, pY, barW * pFill, 6);
    }

    // Stance indicator
    ctx.font      = `${fs * 0.65}px 'Courier New', monospace`;
    ctx.fillStyle = surfer.stance === 'crouch' ? '#FF4757' : '#2ED573';
    ctx.textAlign = 'right';
    ctx.fillText(surfer.stance === 'crouch' ? '▼ FAST' : '▲ CRUISE', w - 16, 38);

    ctx.restore();
  }

  drawTouchControls(
    ctx: CanvasRenderingContext2D,
    w: number, h: number,
    zones: TouchZoneLayout,
  ): TouchZoneLayout {
    ctx.save();

    const drawBtn = (zone: { x: number; y: number; w: number; h: number }, label: string, color: string) => {
      ctx.fillStyle = `rgba(${color},0.22)`;
      roundRect(ctx, zone.x, zone.y, zone.w, zone.h, 14);
      ctx.fill();
      ctx.strokeStyle = `rgba(${color},0.6)`;
      ctx.lineWidth = 2;
      roundRect(ctx, zone.x, zone.y, zone.w, zone.h, 14);
      ctx.stroke();
      ctx.fillStyle = `rgba(${color},0.85)`;
      ctx.font = `bold ${zone.h * 0.45}px 'Courier New', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, zone.x + zone.w / 2, zone.y + zone.h / 2);
    };

    drawBtn(zones.left,  '◀', '255,255,255');
    drawBtn(zones.right, '▶', '255,255,255');
    drawBtn(zones.up,    '▲', '100,220,255');
    drawBtn(zones.down,  '▼', '255,180,80');

    ctx.restore();
    return zones;
  }

  defaultTouchZones(w: number, h: number): TouchZoneLayout {
    const btnW = Math.min(w * 0.18, 110);
    const btnH = Math.min(h * 0.13, 80);
    const pad  = 16;
    const bot  = h - btnH - pad;
    return {
      left:  { x: pad,             y: bot,            w: btnW, h: btnH },
      right: { x: pad + btnW + 8,  y: bot,            w: btnW, h: btnH },
      up:    { x: w - btnW - pad,  y: bot - btnH - 8, w: btnW, h: btnH },
      down:  { x: w - btnW - pad,  y: bot,            w: btnW, h: btnH },
    };
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
