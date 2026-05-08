import { api, fmt, escapeHtml, toast } from '/js/common.js';

const tbody = document.querySelector('#recent-table tbody');
const empty = document.getElementById('empty');
const summary = document.getElementById('d-summary');

const fSearch = document.getElementById('d-search');
const fAgent = document.getElementById('d-agent');
const fEvent = document.getElementById('d-event');
const fStatus = document.getElementById('d-status');
const fFrom = document.getElementById('d-from');
const fTo = document.getElementById('d-to');
const resetBtn = document.getElementById('d-reset');

let allRows = [];

function populateSelect(select, values) {
  const current = select.value;
  const placeholder = select.querySelector('option[value=""]');
  select.innerHTML = '';
  if (placeholder) select.appendChild(placeholder);
  for (const v of [...values].sort((a, b) => a.localeCompare(b))) {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    select.appendChild(opt);
  }
  if ([...select.options].some((o) => o.value === current)) select.value = current;
}

function applyFilters() {
  const q = fSearch.value.trim().toLowerCase();
  const agent = fAgent.value;
  const event = fEvent.value;
  const status = fStatus.value;
  const from = fFrom.value ? new Date(fFrom.value + 'T00:00:00').getTime() : null;
  const to = fTo.value ? new Date(fTo.value + 'T23:59:59').getTime() : null;

  const filtered = allRows.filter((r) => {
    if (agent && r.ownerName !== agent) return false;
    if (event && r.eventName !== event) return false;
    if (status && r.status !== status) return false;
    const ts = new Date(r.eventAt || r.createdAt).getTime();
    if (from && ts < from) return false;
    if (to && ts > to) return false;
    if (q) {
      const hay = [r.ticketNumber, r.leadName, r.leadEmail, r.leadPhone, r.eventName, r.ownerName]
        .filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  renderStats(filtered);
  renderTable(filtered);
}

function renderStats(rows) {
  const stats = { invitations: 0, attended: 0, pending: 0, absent: 0, walkIns: 0 };
  for (const r of rows) {
    if (r.type === 'walk-in') stats.walkIns += 1;
    else stats.invitations += 1;
    if (r.status === 'Attended') stats.attended += 1;
    else if (r.status === 'Pending') stats.pending += 1;
    else if (r.status === 'Absent') stats.absent += 1;
  }
  for (const key of Object.keys(stats)) {
    const el = document.querySelector(`[data-stat="${key}"]`);
    if (el) el.textContent = stats[key];
  }
}

function renderTable(rows) {
  tbody.innerHTML = '';
  const slice = rows.slice(0, 8);
  if (slice.length === 0) {
    empty.hidden = false;
  } else {
    empty.hidden = true;
    for (const inv of slice) {
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
  const total = rows.length;
  const shown = Math.min(slice.length, total);
  summary.textContent = total === 0
    ? '0 results'
    : `Showing ${shown} of ${total} matching ticket${total === 1 ? '' : 's'}`;
}

async function load() {
  const { invitations } = await api('/api/invitations');
  allRows = invitations;
  populateSelect(fAgent, new Set(allRows.map((r) => r.ownerName).filter(Boolean)));
  populateSelect(fEvent, new Set(allRows.map((r) => r.eventName).filter(Boolean)));
  applyFilters();
}

[fAgent, fEvent, fStatus, fFrom, fTo].forEach((el) => el.addEventListener('change', applyFilters));
let searchTimer;
fSearch.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(applyFilters, 200);
});
resetBtn.addEventListener('click', () => {
  fSearch.value = '';
  fAgent.value = '';
  fEvent.value = '';
  fStatus.value = '';
  fFrom.value = '';
  fTo.value = '';
  applyFilters();
});

load().catch((e) => toast(e.message, 'warn'));
