import { api, fmt, escapeHtml, toast } from '/js/common.js';

const tbody = document.querySelector('#ledger tbody');
const empty = document.getElementById('empty');
const scope = document.getElementById('scope');

const fSearch = document.getElementById('f-search');
const fAgent = document.getElementById('f-agent');
const fEvent = document.getElementById('f-event');
const fStatus = document.getElementById('f-status');
const fType = document.getElementById('f-type');
const fFrom = document.getElementById('f-from');
const fTo = document.getElementById('f-to');
const resetBtn = document.getElementById('reset-filters');
const exportBtn = document.getElementById('export-btn');

const pagerSummary = document.getElementById('pager-summary');
const pageIndicator = document.getElementById('page-indicator');
const prevBtn = document.getElementById('prev-page');
const nextBtn = document.getElementById('next-page');
const pageSizeSel = document.getElementById('page-size');

let allRows = [];
let filtered = [];
let page = 1;

function getPageSize() {
  const v = pageSizeSel.value;
  return v === 'all' ? Infinity : Number(v) || 25;
}

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
  const type = fType.value;
  const from = fFrom.value ? new Date(fFrom.value + 'T00:00:00').getTime() : null;
  const to = fTo.value ? new Date(fTo.value + 'T23:59:59').getTime() : null;

  filtered = allRows.filter((r) => {
    if (agent && r.ownerName !== agent) return false;
    if (event && r.eventName !== event) return false;
    if (status && r.status !== status) return false;
    if (type && r.type !== type) return false;
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
  page = 1;
  render();
}

function render() {
  const size = getPageSize();
  const total = filtered.length;
  const totalPages = size === Infinity ? 1 : Math.max(1, Math.ceil(total / size));
  if (page > totalPages) page = totalPages;
  const startIdx = size === Infinity ? 0 : (page - 1) * size;
  const endIdx = size === Infinity ? total : Math.min(total, startIdx + size);
  const slice = filtered.slice(startIdx, endIdx);

  tbody.innerHTML = '';
  if (total === 0) {
    empty.hidden = false;
  } else {
    empty.hidden = true;
    for (const inv of slice) {
      const tr = document.createElement('tr');
      const scannedCell = inv.scannedByName
        ? `${escapeHtml(inv.scannedByName)}<div class="t-meta">${fmt.dateTime(inv.scannedAt)}</div>`
        : '<span class="t-meta">—</span>';
      const clientLine = [inv.leadEmail, inv.leadPhone].filter(Boolean).join(' · ');
      tr.innerHTML = `
        <td class="t-mono"><a href="/app/ticket/${encodeURIComponent(inv.ticketNumber)}">${escapeHtml(inv.ticketNumber)}</a></td>
        <td>${escapeHtml(inv.leadName)}${clientLine ? `<div class="t-meta">${escapeHtml(clientLine)}</div>` : ''}</td>
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

  if (total === 0) {
    pagerSummary.textContent = '0 results';
  } else if (size === Infinity) {
    pagerSummary.textContent = `Showing all ${total} ticket${total === 1 ? '' : 's'}`;
  } else {
    pagerSummary.textContent = `Showing ${startIdx + 1}–${endIdx} of ${total}`;
  }
  pageIndicator.textContent = `Page ${page} of ${totalPages}`;
  prevBtn.disabled = page <= 1;
  nextBtn.disabled = page >= totalPages;
}

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function exportCSV() {
  const rows = filtered.length ? filtered : allRows;
  if (!rows.length) {
    toast('Nothing to export.', 'warn');
    return;
  }
  const header = ['Ticket', 'Type', 'Client', 'Email', 'Phone', 'Agent', 'Event', 'Event date/time', 'Status', 'Created', 'Scanned at', 'Scanned by', 'Notes'];
  const lines = [header.map(csvEscape).join(',')];
  for (const r of rows) {
    lines.push([
      r.ticketNumber, r.type, r.leadName, r.leadEmail, r.leadPhone, r.ownerName,
      r.eventName, r.eventAt, r.status, r.createdAt, r.scannedAt || '', r.scannedByName || '', r.notes || '',
    ].map(csvEscape).join(','));
  }
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  a.href = url;
  a.download = `invitations-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
}

async function load() {
  const scopeValue = scope ? scope.value : null;
  const url = '/api/invitations' + (scopeValue ? `?scope=${encodeURIComponent(scopeValue)}` : '');
  const { invitations } = await api(url);
  allRows = invitations;
  populateSelect(fAgent, new Set(allRows.map((r) => r.ownerName).filter(Boolean)));
  populateSelect(fEvent, new Set(allRows.map((r) => r.eventName).filter(Boolean)));
  applyFilters();
}

if (scope) scope.addEventListener('change', () => load().catch((e) => toast(e.message, 'warn')));

[fAgent, fEvent, fStatus, fType, fFrom, fTo].forEach((el) => el.addEventListener('change', applyFilters));
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
  fType.value = '';
  fFrom.value = '';
  fTo.value = '';
  applyFilters();
});

prevBtn.addEventListener('click', () => { if (page > 1) { page--; render(); } });
nextBtn.addEventListener('click', () => { page++; render(); });
pageSizeSel.addEventListener('change', () => { page = 1; render(); });
exportBtn.addEventListener('click', exportCSV);

load().catch((e) => toast(e.message, 'warn'));
