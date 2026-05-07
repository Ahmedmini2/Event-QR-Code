import { api, fmt, escapeHtml, toast } from '/js/common.js';
import { downloadTicketPng } from '/js/ticketImage.js';

const ticket = window.__TICKET__;
const img = document.getElementById('qr-img');
img.src = `/api/invitations/${encodeURIComponent(ticket)}/qr.png`;

let currentInvitation = null;

(async () => {
  try {
    const { invitation } = await api('/api/invitations/' + encodeURIComponent(ticket));
    currentInvitation = invitation;
    document.getElementById('status-eyebrow').innerHTML =
      `<span class="${fmt.pillClass(invitation.status)}">${escapeHtml(invitation.status)}</span>`;
    document.getElementById('lead-name').textContent = invitation.leadName;
    document.getElementById('lead-meta').textContent = invitation.leadEmail || '';
    document.getElementById('event-name').textContent = invitation.eventName;
    document.getElementById('event-when').textContent = fmt.dateTime(invitation.eventAt);
    document.getElementById('agent-name').textContent = invitation.ownerName || '';
    if (invitation.scannedAt) {
      document.getElementById('scan-block').hidden = false;
      document.getElementById('scanned-by').textContent = invitation.scannedByName || '—';
      document.getElementById('scanned-at').textContent = 'at ' + fmt.dateTime(invitation.scannedAt);
    }
    document.getElementById('notes').textContent = invitation.notes || '—';
  } catch (e) {
    toast(e.message, 'warn');
  }
})();

document.getElementById('print-btn').addEventListener('click', async () => {
  if (!currentInvitation) { toast('Ticket not loaded yet.', 'warn'); return; }
  try {
    await downloadTicketPng(currentInvitation);
  } catch (err) {
    toast('PNG export failed: ' + err.message, 'warn');
  }
});
