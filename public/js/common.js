export const fmt = {
  dateTime(value) {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
      });
    } catch { return value; }
  },
  pillClass(status) {
    if (!status) return 'pill';
    const s = status.toLowerCase();
    return 'pill ' + s;
  },
};

export async function api(path, options = {}) {
  const opts = { headers: { 'Content-Type': 'application/json' }, ...options };
  if (opts.body && typeof opts.body !== 'string') opts.body = JSON.stringify(opts.body);
  const res = await fetch(path, opts);
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = (data && data.error) || res.statusText;
    throw new Error(msg);
  }
  return data;
}

const toastEl = () => document.getElementById('toast');
export function toast(message, kind = 'ok') {
  const el = toastEl();
  if (!el) return;
  el.textContent = message;
  el.className = 'toast show' + (kind === 'warn' ? ' warn' : '');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.className = 'toast'; }, 3200);
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export async function populateEventSelect(select, hintEl) {
  try {
    const { events } = await api('/api/events');
    const active = events.filter((e) => !e.archived);
    select.innerHTML = '';
    if (active.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No approved events';
      opt.disabled = true;
      opt.selected = true;
      select.appendChild(opt);
      select.disabled = true;
      if (hintEl) hintEl.hidden = false;
      return;
    }
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Select an event…';
    placeholder.disabled = true;
    placeholder.selected = true;
    select.appendChild(placeholder);
    for (const ev of active) {
      const opt = document.createElement('option');
      opt.value = ev.name;
      opt.textContent = ev.name;
      select.appendChild(opt);
    }
    select.disabled = false;
    if (hintEl) hintEl.hidden = true;
  } catch (err) {
    toast('Could not load events: ' + err.message, 'warn');
  }
}
