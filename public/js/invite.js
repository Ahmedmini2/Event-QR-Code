import { api, escapeHtml, toast, populateEventSelect } from '/js/common.js';

populateEventSelect(document.getElementById('eventName'), document.getElementById('no-events-hint'));

const search = document.getElementById('lead-search');
const results = document.getElementById('lead-results');
const selected = document.getElementById('selected-lead');
const selName = document.getElementById('sel-name');
const selMeta = document.getElementById('sel-meta');
const leadIdInput = document.getElementById('leadId');
const clearBtn = document.getElementById('clear-lead');

let activeIdx = -1;
let rows = [];
let timer;

async function runSearch(q) {
  if (q.length < 2) {
    results.hidden = true;
    return;
  }
  try {
    const { results: r } = await api('/api/leads/search?q=' + encodeURIComponent(q));
    rows = r;
    if (rows.length === 0) {
      results.innerHTML = '<div class="row"><span class="meta">No matching leads in your Salesforce account.</span></div>';
      results.hidden = false;
      return;
    }
    results.innerHTML = rows.map((lead, i) => `
      <div class="row" data-i="${i}">
        <div class="name">${escapeHtml(lead.name || '')}</div>
        <div class="meta">${escapeHtml([lead.email, lead.company, lead.phone].filter(Boolean).join(' · '))}</div>
      </div>
    `).join('');
    results.hidden = false;
    activeIdx = -1;
  } catch (e) {
    toast(e.message, 'warn');
  }
}

function pick(i) {
  const lead = rows[i];
  if (!lead) return;
  leadIdInput.value = lead.id;
  selName.textContent = lead.name;
  selMeta.textContent = [lead.email, lead.company].filter(Boolean).join(' · ');
  selected.hidden = false;
  search.hidden = true;
  results.hidden = true;
}

search.addEventListener('input', (e) => {
  clearTimeout(timer);
  timer = setTimeout(() => runSearch(e.target.value.trim()), 250);
});

results.addEventListener('click', (e) => {
  const row = e.target.closest('.row');
  if (!row) return;
  const i = Number(row.dataset.i);
  if (Number.isFinite(i)) pick(i);
});

search.addEventListener('keydown', (e) => {
  const visible = !results.hidden && rows.length > 0;
  if (!visible) return;
  if (e.key === 'ArrowDown') {
    activeIdx = Math.min(rows.length - 1, activeIdx + 1);
    paintActive();
    e.preventDefault();
  } else if (e.key === 'ArrowUp') {
    activeIdx = Math.max(0, activeIdx - 1);
    paintActive();
    e.preventDefault();
  } else if (e.key === 'Enter') {
    if (activeIdx >= 0) { pick(activeIdx); e.preventDefault(); }
  } else if (e.key === 'Escape') {
    results.hidden = true;
  }
});

function paintActive() {
  results.querySelectorAll('.row').forEach((el, i) => el.classList.toggle('active', i === activeIdx));
}

clearBtn.addEventListener('click', () => {
  leadIdInput.value = '';
  selected.hidden = true;
  search.hidden = false;
  search.value = '';
  search.focus();
});

document.getElementById('invite-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const leadId = leadIdInput.value;
  const eventName = document.getElementById('eventName').value.trim();
  const eventAt = document.getElementById('eventAt').value;
  const notes = document.getElementById('notes').value.trim();

  if (!leadId) { toast('Choose a client from the lookup first.', 'warn'); return; }
  if (!eventName || !eventAt) { toast('Event name and date are required.', 'warn'); return; }

  try {
    const { invitation, warnings } = await api('/api/invitations', {
      method: 'POST',
      body: { leadId, eventName, eventAt, notes },
    });
    if (warnings?.task) toast('Salesforce task: ' + warnings.task, 'warn');
    if (warnings?.status) toast('Lead status: ' + warnings.status, 'warn');
    window.location.href = '/app/ticket/' + encodeURIComponent(invitation.ticketNumber);
  } catch (err) {
    toast(err.message, 'warn');
  }
});
