import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'invitations.json');

let cache = null;
let writeQueue = Promise.resolve();

async function readFromDisk() {
  try {
    const buf = await fs.readFile(FILE, 'utf8');
    return JSON.parse(buf);
  } catch (err) {
    if (err.code === 'ENOENT') return { invitations: [], events: [], counter: 0 };
    throw err;
  }
}

async function writeToDisk(data) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(data, null, 2), 'utf8');
}

async function load() {
  if (!cache) cache = await readFromDisk();
  return cache;
}

async function save() {
  writeQueue = writeQueue.then(() => writeToDisk(cache)).catch((e) => {
    console.error('Failed to persist invitations:', e);
  });
  await writeQueue;
}

export async function nextTicketNumber() {
  const db = await load();
  db.counter = (db.counter || 0) + 1;
  const yyyymmdd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const seq = String(db.counter).padStart(4, '0');
  await save();
  return `ALG-${yyyymmdd}-${seq}`;
}

export async function listInvitations({ ownerId } = {}) {
  const db = await load();
  let rows = db.invitations.slice();
  if (ownerId) rows = rows.filter((r) => r.ownerId === ownerId);
  rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return rows;
}

export async function findByTicket(ticket) {
  const db = await load();
  return db.invitations.find((r) => r.ticketNumber === ticket) || null;
}

export async function addInvitation(invitation) {
  const db = await load();
  db.invitations.push(invitation);
  await save();
  return invitation;
}

export async function updateInvitation(ticket, patch) {
  const db = await load();
  const idx = db.invitations.findIndex((r) => r.ticketNumber === ticket);
  if (idx === -1) return null;
  db.invitations[idx] = { ...db.invitations[idx], ...patch };
  await save();
  return db.invitations[idx];
}

export async function listEvents({ includeArchived = false } = {}) {
  const db = await load();
  let events = (db.events || []).slice();
  if (!includeArchived) events = events.filter((e) => !e.archived);
  events.sort((a, b) => a.name.localeCompare(b.name));
  return events;
}

export async function addEvent({ name, createdBy }) {
  const db = await load();
  if (!db.events) db.events = [];
  const trimmed = name.trim();
  const dup = db.events.find((e) => !e.archived && e.name.toLowerCase() === trimmed.toLowerCase());
  if (dup) {
    const err = new Error('An active event with that name already exists');
    err.code = 'DUPLICATE';
    throw err;
  }
  const event = {
    id: 'ev_' + crypto.randomUUID(),
    name: trimmed,
    createdBy,
    createdAt: new Date().toISOString(),
    archived: false,
  };
  db.events.push(event);
  await save();
  return event;
}

export async function updateEvent(id, patch) {
  const db = await load();
  const idx = (db.events || []).findIndex((e) => e.id === id);
  if (idx === -1) return null;
  const next = { ...db.events[idx] };
  if (typeof patch.name === 'string' && patch.name.trim()) next.name = patch.name.trim();
  if (typeof patch.archived === 'boolean') next.archived = patch.archived;
  db.events[idx] = next;
  await save();
  return next;
}

export async function findActiveEventByName(name) {
  const db = await load();
  const target = String(name || '').trim().toLowerCase();
  return (db.events || []).find((e) => !e.archived && e.name.toLowerCase() === target) || null;
}

export function statusFor(invitation, now = new Date()) {
  if (invitation.scannedAt) return 'Attended';
  if (invitation.type === 'walk-in') return 'Attended';
  const eventTime = new Date(invitation.eventAt).getTime();
  const graceMs = 4 * 60 * 60 * 1000;
  if (Number.isFinite(eventTime) && now.getTime() > eventTime + graceMs) {
    return 'Absent';
  }
  return 'Pending';
}
