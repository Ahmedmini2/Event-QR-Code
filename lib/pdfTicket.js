import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

const C = {
  green: '#06342C',
  greenDeep: '#052B24',
  gold: '#C1A777',
  ivory: '#FBF8F2',
  paper: '#FFFFFF',
  grey: '#6D6E71',
  greyMid: '#4D4E50',
  hairline: '#D7D2C7',
};

const SERIF = 'Times-Italic';
const SERIF_BOLD = 'Times-Bold';
const SANS = 'Helvetica';
const SANS_BOLD = 'Helvetica-Bold';
const MONO = 'Courier';

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric', month: 'long', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

function drawBackground(doc) {
  doc.save();
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(C.ivory);
  doc.restore();
}

function drawHeader(doc) {
  const top = 36;
  const left = 50;
  const right = doc.page.width - 50;

  doc.save();
  doc.rect(0, 0, doc.page.width, 110).fillAndStroke(C.greenDeep, C.greenDeep);
  doc.restore();

  doc.fillColor(C.ivory).font(SERIF_BOLD).fontSize(18)
    .text('Allegiance', left, top + 8, { lineBreak: false });
  const wmW = doc.widthOfString('Allegiance');
  doc.save();
  doc.lineWidth(1).strokeColor(C.gold).moveTo(left + wmW + 8, top + 22).lineTo(left + wmW + 24, top + 22).stroke();
  doc.restore();
  doc.font(SERIF).fillColor(C.gold).fontSize(13)
    .text('Concierge', left + wmW + 30, top + 10, { lineBreak: false });

  doc.font(SANS).fontSize(8).fillColor(C.gold)
    .text('EVENT TICKET', left, top + 46, { characterSpacing: 3, lineBreak: false });

  doc.font(SANS).fontSize(8).fillColor('#E6D6B6')
    .text('ALLEGIANCE REAL ESTATE  ·  GLOBAL INVESTMENT ADVISORY', 0, top + 46, {
      characterSpacing: 1.5, align: 'right', width: right, lineBreak: false,
    });

  doc.save();
  doc.lineWidth(1).strokeColor(C.gold).moveTo(left, 110).lineTo(right, 110).stroke();
  doc.restore();
}

function drawFooter(doc, inv) {
  const left = 50;
  const right = doc.page.width - 50;
  const y = doc.page.height - 70;

  doc.save();
  doc.lineWidth(0.6).strokeColor(C.gold).moveTo(left, y).lineTo(right, y).stroke();
  doc.restore();

  doc.font(SANS).fontSize(8).fillColor(C.grey)
    .text('ALLEGIANCE REAL ESTATE  ·  GLOBAL INVESTMENT ADVISORY', left, y + 12, {
      characterSpacing: 2, lineBreak: false,
    });

  doc.font(MONO).fontSize(8).fillColor(C.greyMid)
    .text(`${inv.ticketNumber}   ·   issued ${fmtDate(inv.createdAt)}`, 0, y + 12, {
      align: 'right', width: right, lineBreak: false,
    });

  doc.font(SERIF).fontSize(8).fillColor(C.grey)
    .text('An introduction worth keeping.', left, y + 30, { lineBreak: false });
}

async function drawBody(doc, inv) {
  const left = 50;
  const right = doc.page.width - 50;
  const top = 150;

  doc.font(SANS).fontSize(8).fillColor(C.gold)
    .text('INVITATION', left, top, { characterSpacing: 3, lineBreak: false });

  doc.save();
  doc.lineWidth(1).strokeColor(C.gold).moveTo(left, top + 18).lineTo(left + 60, top + 18).stroke();
  doc.restore();

  doc.font(SERIF).fontSize(28).fillColor(C.green)
    .text(inv.eventName || 'Allegiance Event', left, top + 28, {
      width: right - left,
      lineGap: 4,
    });

  let cursorY = doc.y + 6;
  doc.save();
  doc.lineWidth(0.5).strokeColor(C.hairline).moveTo(left, cursorY).lineTo(right, cursorY).stroke();
  doc.restore();
  cursorY += 18;

  const colW = (right - left - 40) / 2;
  const colLeft = left;
  const colRight = left + colW + 40;
  const startY = cursorY;

  // Left column — guest details
  let y = startY;
  const label = (text, yy) => {
    doc.font(SANS).fontSize(7).fillColor(C.grey)
      .text(text, colLeft, yy, { characterSpacing: 2, lineBreak: false });
  };
  const bigSerif = (text, yy) => {
    doc.font(SERIF).fontSize(18).fillColor(C.green).text(text, colLeft, yy, { width: colW });
  };
  const bodyText = (text, yy) => {
    doc.font(SANS).fontSize(10).fillColor(C.greyMid).text(text, colLeft, yy, { width: colW });
  };

  label('GUEST', y); y += 10;
  bigSerif(inv.leadName || '—', y); y = doc.y + 2;
  if (inv.leadEmail) { bodyText(inv.leadEmail, y); y = doc.y + 4; }
  y += 10;

  label('SCHEDULED', y); y += 10;
  doc.font(SANS_BOLD).fontSize(11).fillColor(C.green).text(fmtDate(inv.eventAt), colLeft, y, { width: colW });
  y = doc.y + 14;

  label('ASSIGNED AGENT', y); y += 10;
  doc.font(SANS).fontSize(11).fillColor(C.greyMid).text(inv.ownerName || '—', colLeft, y, { width: colW });
  y = doc.y + 14;

  label('STATUS', y); y += 10;
  const statusColor = inv.status === 'Attended' ? C.green : inv.status === 'Pending' ? C.gold : C.grey;
  doc.font(SANS_BOLD).fontSize(10).fillColor(statusColor)
    .text((inv.status || 'Pending').toUpperCase(), colLeft, y, { characterSpacing: 2, width: colW });
  y = doc.y + 14;

  if (inv.notes) {
    label('NOTES', y); y += 10;
    doc.font(SERIF).fontSize(10).fillColor(C.greyMid)
      .text(inv.notes, colLeft, y, { width: colW, lineGap: 2 });
    y = doc.y + 6;
  }

  // Right column — QR + ticket number
  const qrSize = 200;
  const qrX = colRight + (colW - qrSize) / 2;
  const qrY = startY + 6;

  const qrBuf = await QRCode.toBuffer(inv.ticketNumber, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: qrSize * 3,
    color: { dark: C.green, light: C.ivory },
  });

  doc.save();
  doc.rect(qrX - 12, qrY - 12, qrSize + 24, qrSize + 24).fill(C.paper);
  doc.lineWidth(0.5).strokeColor(C.hairline).rect(qrX - 12, qrY - 12, qrSize + 24, qrSize + 24).stroke();
  doc.restore();

  doc.image(qrBuf, qrX, qrY, { width: qrSize, height: qrSize });

  doc.font(SANS).fontSize(7).fillColor(C.grey)
    .text('TICKET NUMBER', colRight, qrY + qrSize + 22, { characterSpacing: 3, width: colW, align: 'center' });
  doc.font(MONO).fontSize(13).fillColor(C.green)
    .text(inv.ticketNumber, colRight, qrY + qrSize + 36, { width: colW, align: 'center' });

  if (inv.type === 'walk-in') {
    doc.font(SANS).fontSize(7).fillColor(C.gold)
      .text('WALK-IN REGISTRATION', colRight, qrY + qrSize + 60, {
        characterSpacing: 3, width: colW, align: 'center',
      });
  }
}

export async function writeTicketPdf(stream, invitation) {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 0,
    info: {
      Title: `Ticket ${invitation.ticketNumber}`,
      Author: 'Allegiance Concierge',
      Subject: invitation.eventName || 'Event Ticket',
    },
  });
  doc.pipe(stream);

  drawBackground(doc);
  drawHeader(doc);
  await drawBody(doc, invitation);
  drawFooter(doc, invitation);

  doc.end();
}
