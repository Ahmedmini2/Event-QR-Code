import { api, fmt, escapeHtml, toast } from '/js/common.js';

const ticket = window.__TICKET__;
const img = document.getElementById('qr-img');
img.src = `/api/invitations/${encodeURIComponent(ticket)}/qr.png`;

(async () => {
  try {
    const { invitation } = await api('/api/invitations/' + encodeURIComponent(ticket));
    document.getElementById('status-eyebrow').innerHTML =
      `<span class="${fmt.pillClass(invitation.status)}">${escapeHtml(invitation.status)}</span>`;
    document.getElementById('lead-name').textContent = invitation.leadName;
    document.getElementById('lead-meta').textContent = invitation.leadEmail || '';
    document.getElementById('event-name').textContent = invitation.eventName;
    document.getElementById('event-when').textContent = fmt.dateTime(invitation.eventAt);
    document.getElementById('agent-name').textContent = invitation.ownerName || '';
    document.getElementById('notes').textContent = invitation.notes || '—';
  } catch (e) {
    toast(e.message, 'warn');
  }
})();

document.getElementById('print-btn').addEventListener('click', () => {
  window.open(`/api/invitations/${encodeURIComponent(ticket)}/ticket.pdf`, '_blank');
});
