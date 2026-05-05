import { api, fmt, escapeHtml, toast } from '/js/common.js';

async function loadStats() {
  const { stats } = await api('/api/dashboard/stats');
  for (const key of Object.keys(stats)) {
    const el = document.querySelector(`[data-stat="${key}"]`);
    if (el) el.textContent = stats[key];
  }
}

async function loadRecent() {
  const { invitations } = await api('/api/invitations');
  const tbody = document.querySelector('#recent-table tbody');
  const empty = document.getElementById('empty');
  tbody.innerHTML = '';
  const recent = invitations.slice(0, 8);
  if (recent.length === 0) { empty.hidden = false; return; }
  empty.hidden = true;
  for (const inv of recent) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="t-mono"><a href="/app/ticket/${encodeURIComponent(inv.ticketNumber)}">${escapeHtml(inv.ticketNumber)}</a></td>
      <td>${escapeHtml(inv.leadName)}</td>
      <td>${escapeHtml(inv.ownerName || '')}</td>
      <td>${escapeHtml(inv.eventName)}</td>
      <td>${fmt.dateTime(inv.eventAt)}</td>
      <td><span class="${fmt.pillClass(inv.status)}">${escapeHtml(inv.status)}</span></td>
    `;
    tbody.appendChild(tr);
  }
}

(async () => {
  try {
    await Promise.all([loadStats(), loadRecent()]);
  } catch (e) {
    toast(e.message, 'warn');
  }
})();
