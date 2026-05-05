import { api, fmt, escapeHtml, toast } from '/js/common.js';

const tbody = document.querySelector('#events-table tbody');
const empty = document.getElementById('empty');
const form = document.getElementById('add-event-form');
const nameInput = document.getElementById('new-event-name');

async function load() {
  const { events } = await api('/api/events');
  tbody.innerHTML = '';
  if (events.length === 0) { empty.hidden = false; return; }
  empty.hidden = true;
  for (const ev of events) {
    const tr = document.createElement('tr');
    const statusPill = ev.archived
      ? '<span class="pill absent">Archived</span>'
      : '<span class="pill attended">Active</span>';
    const action = ev.archived
      ? `<button data-id="${escapeHtml(ev.id)}" data-action="restore" class="btn secondary" style="padding:.4rem .8rem; font-size:.7rem;">Restore</button>`
      : `<button data-id="${escapeHtml(ev.id)}" data-action="archive" class="btn secondary" style="padding:.4rem .8rem; font-size:.7rem;">Archive</button>`;
    tr.innerHTML = `
      <td>${escapeHtml(ev.name)}</td>
      <td class="t-meta">${fmt.dateTime(ev.createdAt)}</td>
      <td>${statusPill}</td>
      <td style="text-align:right;">${action}</td>
    `;
    tbody.appendChild(tr);
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  if (!name) return;
  try {
    await api('/api/events', { method: 'POST', body: { name } });
    nameInput.value = '';
    toast('Event added.');
    await load();
  } catch (err) {
    toast(err.message, 'warn');
  }
});

tbody.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;
  const archived = action === 'archive';
  try {
    await api('/api/events/' + encodeURIComponent(id), {
      method: 'PATCH',
      body: { archived },
    });
    toast(archived ? 'Event archived.' : 'Event restored.');
    await load();
  } catch (err) {
    toast(err.message, 'warn');
  }
});

load().catch((e) => toast(e.message, 'warn'));
