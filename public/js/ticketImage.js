// Renders a branded PNG ticket on the client using <canvas>.
// Mirrors the PDF header (wordmark + gold rule + EVENT TICKET eyebrow) and
// shows guest, schedule, agent, status — no notes, no footer.

const C = {
  green: '#06342C',
  greenDeep: '#052B24',
  greenLight: '#0A4338',
  gold: '#C1A777',
  goldSoft: '#E6D6B6',
  ivory: '#FBF8F2',
  paper: '#FFFFFF',
  grey: '#6D6E71',
  greyMid: '#4D4E50',
  hairline: '#D7D2C7',
};

const W = 1080;
const H = 1500;
const PAD = 80;

function fmtDateTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric', month: 'long', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function setLetterSpacing(ctx, px) {
  if ('letterSpacing' in ctx) ctx.letterSpacing = px + 'px';
}

function drawHeader(ctx) {
  const headerH = 200;
  const grad = ctx.createLinearGradient(0, 0, W, headerH);
  grad.addColorStop(0, C.greenDeep);
  grad.addColorStop(0.45, C.green);
  grad.addColorStop(1, C.greenLight);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, headerH);

  const radial = ctx.createRadialGradient(W * 0.3, 0, 50, W * 0.3, 0, 600);
  radial.addColorStop(0, 'rgba(193, 167, 119, 0.10)');
  radial.addColorStop(1, 'rgba(193, 167, 119, 0)');
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, W, headerH);

  ctx.textBaseline = 'alphabetic';
  setLetterSpacing(ctx, 0);
  ctx.fillStyle = C.ivory;
  ctx.font = '600 44px "Playfair Display", Georgia, serif';
  ctx.fillText('Allegiance', PAD, 105);
  const wmW = ctx.measureText('Allegiance').width;

  ctx.strokeStyle = C.gold;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD + wmW + 16, 92);
  ctx.lineTo(PAD + wmW + 52, 92);
  ctx.stroke();

  ctx.fillStyle = C.gold;
  ctx.font = 'italic 500 30px "Playfair Display", Georgia, serif';
  ctx.fillText('Concierge', PAD + wmW + 64, 105);

  ctx.fillStyle = C.gold;
  setLetterSpacing(ctx, 5);
  ctx.font = '500 15px Inter, "Helvetica Neue", Arial, sans-serif';
  ctx.fillText('EVENT TICKET', PAD, 152);

  ctx.fillStyle = C.goldSoft;
  ctx.font = '500 13px Inter, "Helvetica Neue", Arial, sans-serif';
  setLetterSpacing(ctx, 3);
  ctx.textAlign = 'right';
  ctx.fillText('ALLEGIANCE REAL ESTATE  ·  GLOBAL INVESTMENT ADVISORY', W - PAD, 152);
  ctx.textAlign = 'left';
  setLetterSpacing(ctx, 0);

  ctx.strokeStyle = C.gold;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, headerH);
  ctx.lineTo(W - PAD, headerH);
  ctx.stroke();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text || '').split(/\s+/);
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      yy += lineHeight;
      line = word;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
  return yy + lineHeight;
}

async function drawBody(ctx, inv) {
  // Eyebrow
  ctx.fillStyle = C.gold;
  setLetterSpacing(ctx, 6);
  ctx.font = '500 14px Inter, sans-serif';
  ctx.fillText('INVITATION', PAD, 290);

  // Short gold rule
  ctx.strokeStyle = C.gold;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, 308);
  ctx.lineTo(PAD + 100, 308);
  ctx.stroke();

  // Event title
  setLetterSpacing(ctx, 0);
  ctx.fillStyle = C.green;
  ctx.font = '500 60px "Playfair Display", Georgia, serif';
  const titleEnd = wrapText(ctx, inv.eventName || 'Allegiance Event', PAD, 380, W - PAD * 2, 70);

  // Hairline rule below title
  const ruleY = Math.max(titleEnd + 10, 460);
  ctx.strokeStyle = C.hairline;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, ruleY);
  ctx.lineTo(W - PAD, ruleY);
  ctx.stroke();

  // Two columns: left details, right QR
  const colTop = ruleY + 50;
  const leftX = PAD;
  const rightX = 600;
  const colW = 460;

  // Left column
  let y = colTop;
  const labelLine = (text, yy) => {
    ctx.fillStyle = C.grey;
    setLetterSpacing(ctx, 4);
    ctx.font = '500 12px Inter, sans-serif';
    ctx.fillText(text, leftX, yy);
  };

  labelLine('GUEST', y);
  y += 26;
  setLetterSpacing(ctx, 0);
  ctx.fillStyle = C.green;
  ctx.font = 'italic 500 32px "Playfair Display", Georgia, serif';
  y = wrapText(ctx, inv.leadName || '—', leftX, y + 16, colW, 38);
  if (inv.leadEmail) {
    ctx.fillStyle = C.greyMid;
    ctx.font = '400 16px Inter, sans-serif';
    ctx.fillText(inv.leadEmail, leftX, y);
    y += 18;
  }
  y += 18;

  labelLine('SCHEDULED', y);
  y += 26;
  setLetterSpacing(ctx, 0);
  ctx.fillStyle = C.green;
  ctx.font = '600 18px Inter, sans-serif';
  ctx.fillText(fmtDateTime(inv.eventAt), leftX, y);
  y += 36;

  labelLine('ASSIGNED AGENT', y);
  y += 26;
  setLetterSpacing(ctx, 0);
  ctx.fillStyle = C.greyMid;
  ctx.font = '400 18px Inter, sans-serif';
  ctx.fillText(inv.ownerName || '—', leftX, y);
  y += 50;

  // Closing message — italic Playfair, gentle advisory tone
  ctx.fillStyle = C.greyMid;
  ctx.font = 'italic 500 22px "Playfair Display", Georgia, serif';
  y = wrapText(ctx, 'We look forward to welcoming you at the event.', leftX, y, colW, 30);
  const leftBottom = y;

  // Right column — QR with paper card behind it
  const qrSize = 340;
  const qrX = rightX + (colW - qrSize) / 2;
  const qrY = colTop;
  const padFrame = 24;

  ctx.fillStyle = C.paper;
  ctx.fillRect(qrX - padFrame, qrY - padFrame, qrSize + padFrame * 2, qrSize + padFrame * 2);
  ctx.strokeStyle = C.hairline;
  ctx.lineWidth = 1;
  ctx.strokeRect(qrX - padFrame, qrY - padFrame, qrSize + padFrame * 2, qrSize + padFrame * 2);

  const qrImg = await loadImage(`/api/invitations/${encodeURIComponent(inv.ticketNumber)}/qr.png?t=${Date.now()}`);
  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

  ctx.fillStyle = C.grey;
  setLetterSpacing(ctx, 4);
  ctx.font = '500 12px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TICKET NUMBER', rightX + colW / 2, qrY + qrSize + padFrame + 36);

  setLetterSpacing(ctx, 1);
  ctx.fillStyle = C.green;
  ctx.font = '500 22px "IBM Plex Mono", "Courier New", monospace';
  ctx.fillText(inv.ticketNumber, rightX + colW / 2, qrY + qrSize + padFrame + 70);
  ctx.textAlign = 'left';
  setLetterSpacing(ctx, 0);

  const rightBottom = qrY + qrSize + padFrame + 70 + 12;
  return Math.max(leftBottom, rightBottom);
}

export async function generateTicketPng(invitation) {
  await (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve());

  const stage = document.createElement('canvas');
  stage.width = W;
  stage.height = H;
  const ctx = stage.getContext('2d');

  ctx.fillStyle = C.ivory;
  ctx.fillRect(0, 0, W, H);

  drawHeader(ctx);
  const contentBottom = await drawBody(ctx, invitation);
  const finalH = Math.min(H, Math.ceil(contentBottom + 60));

  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = W;
  finalCanvas.height = finalH;
  const finalCtx = finalCanvas.getContext('2d');
  finalCtx.fillStyle = C.ivory;
  finalCtx.fillRect(0, 0, W, finalH);
  finalCtx.drawImage(stage, 0, 0);

  return new Promise((resolve, reject) => {
    finalCanvas.toBlob((blob) => {
      if (!blob) return reject(new Error('PNG generation failed'));
      resolve(blob);
    }, 'image/png');
  });
}

export async function downloadTicketPng(invitation) {
  const blob = await generateTicketPng(invitation);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ticket-${invitation.ticketNumber}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
