import { api, fmt, escapeHtml, toast } from '/js/common.js';

const tbody = document.querySelector('#ledger tbody');
const empty = document.getElementById('empty');
const scope = document.getElementById('scope');

async function load() {
  const scopeValue = scope ? scope.value : null;
  const url = '/api/invitations' + (scopeValue ? `?scope=${encodeURIComponent(scopeValue)}` : '');
  const { invitations } = await api(url);
  tbody.innerHTML = '';
  if (invitations.length === 0) { empty.hidden = false; return; }
  empty.hidden = true;
  for (const inv of invitations) {
    const tr = document.createElement('tr');
    const scannedCell = inv.scannedByName
      ? `${escapeHtml(inv.scannedByName)}<div class="t-meta">${fmt.dateTime(inv.scannedAt)}</div>`
      : '<span class="t-meta">—</span>';
    tr.innerHTML = `
      <td class="t-mono"><a href="/app/ticket/${encodeURIComponent(inv.ticketNumber)}">${escapeHtml(inv.ticketNumber)}</a></td>
      <td>${escapeHtml(inv.leadName)}${inv.leadEmail ? `<div class="t-meta">${escapeHtml(inv.leadEmail)}</div>` : ''}</td>
      <td>${escapeHtml(inv.ownerName || '')}</td>
      <td>${escapeHtml(inv.eventName)}${inv.type === 'walk-in' ? ' <span class="t-meta">(walk-in)</span>' : ''}</td>
      <td>${fmt.dateTime(inv.eventAt)}</td>
      <td><span class="${fmt.pillClass(inv.status)}">${escapeHtml(inv.status)}</span></td>
      <td>${scannedCell}</td>
      <td><a href="/app/ticket/${encodeURIComponent(inv.ticketNumber)}" class="t-meta">View</a></td>
    `;
    tbody.appendChild(tr);
  }
}

if (scope) {
  scope.addEventListener('change', () => {
    load().catch((e) => toast(e.message, 'warn'));
  });
}

load().catch((e) => toast(e.message, 'warn'));
