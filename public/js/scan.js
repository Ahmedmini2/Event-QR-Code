import { api, fmt, escapeHtml, toast } from '/js/common.js';

const result = document.getElementById('result');
const resultBody = document.getElementById('result-body');

async function markAttended(ticket) {
  try {
    const { invitation, warnings, alreadyScanned } = await api(
      `/api/invitations/${encodeURIComponent(ticket)}/scan`,
      { method: 'POST' },
    );
    render(invitation, { alreadyScanned, warnings });
    if (alreadyScanned) toast('Ticket already scanned.', 'warn');
    else toast('Welcome — ' + invitation.leadName + '.');
  } catch (err) {
    toast(err.message, 'warn');
  }
}

function render(inv, extras = {}) {
  result.hidden = false;
  resultBody.innerHTML = `
    <div class="t-mono" style="font-size:1.1rem;">${escapeHtml(inv.ticketNumber)}</div>
    <hr class="rule" />
    <div class="grid cols-2">
      <div>
        <div class="t-meta">Client</div>
        <div class="t-subhead">${escapeHtml(inv.leadName)}</div>
        <div class="t-meta">${escapeHtml(inv.leadEmail || '')}</div>
      </div>
      <div>
        <div class="t-meta">Event</div>
        <div class="t-subhead">${escapeHtml(inv.eventName)}</div>
        <div class="t-meta">${fmt.dateTime(inv.eventAt)}</div>
      </div>
      <div>
        <div class="t-meta">Inviting agent</div>
        <div>${escapeHtml(inv.ownerName || '')}</div>
        ${inv.scannedByName ? `
          <div class="t-meta" style="margin-top:.6rem;">Scanned by</div>
          <div>${escapeHtml(inv.scannedByName)}</div>
          <div class="t-meta">${fmt.dateTime(inv.scannedAt)}</div>
        ` : ''}
      </div>
      <div>
        <div class="t-meta">Status</div>
        <span class="${fmt.pillClass(inv.status)}">${escapeHtml(inv.status)}</span>
        ${extras.alreadyScanned ? '<div class="t-meta" style="margin-top:.4rem;">Already checked in earlier.</div>' : ''}
      </div>
    </div>
    ${inv.notes ? `
      <hr class="rule" />
      <div class="t-meta">Notes</div>
      <div class="t-body" style="white-space: pre-wrap;">${escapeHtml(inv.notes)}</div>
    ` : ''}
  `;
}

document.getElementById('ticket-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const t = document.getElementById('ticket-input').value.trim();
  if (!t) return;
  await markAttended(t);
});

const scannerEl = document.getElementById('scanner');
const startBtn = document.getElementById('start-scan');
const stopBtn = document.getElementById('stop-scan');
let scanner;

startBtn.addEventListener('click', async () => {
  if (!window.Html5Qrcode) { toast('Scanner library failed to load.', 'warn'); return; }
  scannerEl.id = 'scanner';
  scanner = new Html5Qrcode('scanner');
  try {
    await scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 240, height: 240 } },
      async (decodedText) => {
        await scanner.stop();
        scanner.clear();
        startBtn.hidden = false;
        stopBtn.hidden = true;
        document.getElementById('ticket-input').value = decodedText;
        await markAttended(decodedText);
      },
    );
    startBtn.hidden = true;
    stopBtn.hidden = false;
  } catch (err) {
    toast('Camera unavailable: ' + err.message, 'warn');
  }
});

stopBtn.addEventListener('click', async () => {
  if (scanner) {
    try { await scanner.stop(); scanner.clear(); } catch {}
  }
  startBtn.hidden = false;
  stopBtn.hidden = true;
});
