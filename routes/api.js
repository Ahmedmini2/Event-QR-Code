import { Router } from 'express';
import QRCode from 'qrcode';
import {
  connectionFromSession,
  searchOwnedLeads,
  getLead,
  createInvitationTask,
  createAttendanceTask,
  markLeadInvited,
  markLeadAttended,
} from '../lib/salesforce.js';
import {
  nextTicketNumber,
  listInvitations,
  findByTicket,
  addInvitation,
  updateInvitation,
  statusFor,
  listEvents,
  addEvent,
  updateEvent,
  findActiveEventByName,
} from '../lib/store.js';
const router = Router();

router.use((req, res, next) => {
  if (!req.session?.sf) return res.status(401).json({ error: 'Not signed in' });
  next();
});

function resolveScope(req) {
  const sf = req.session.sf;
  const requested = req.query.scope;
  if (sf.isAdmin) {
    if (requested === 'mine') return { ownerId: sf.userId };
    return { ownerId: null };
  }
  return { ownerId: sf.userId };
}

router.get('/leads/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ results: [] });
  try {
    const conn = connectionFromSession(req.session);
    const ownerId = req.session.sf.userId;
    const results = await searchOwnedLeads(conn, ownerId, q);
    res.json({ results });
  } catch (err) {
    console.error('Lead search failed:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/invitations', async (req, res) => {
  const { leadId, eventName, eventAt, notes } = req.body || {};
  if (!leadId || !eventName || !eventAt) {
    return res.status(400).json({ error: 'Missing leadId, eventName, or eventAt' });
  }
  const eventEntry = await findActiveEventByName(eventName);
  if (!eventEntry) {
    return res.status(400).json({ error: 'That event is not in the approved list. Ask an administrator to add it under Events.' });
  }

  const conn = connectionFromSession(req.session);
  const ownerId = req.session.sf.userId;

  try {
    const lead = await getLead(conn, leadId);
    const ticketNumber = await nextTicketNumber();

    let taskWarning = null;
    let statusWarning = null;

    try {
      await createInvitationTask(conn, {
        leadId, ownerId, eventName, eventAt, notes, ticketNumber,
      });
    } catch (err) {
      console.warn('Task creation failed:', err.message);
      taskWarning = err.message;
    }

    try {
      await markLeadInvited(conn, leadId);
    } catch (err) {
      console.warn('Lead status update failed:', err.message);
      statusWarning = err.message;
    }

    const invitation = {
      ticketNumber,
      type: 'invitation',
      leadId,
      leadName: lead.name,
      leadEmail: lead.email,
      ownerId,
      ownerName: req.session.sf.name,
      eventName,
      eventAt,
      notes: notes || '',
      createdAt: new Date().toISOString(),
      scannedAt: null,
    };
    await addInvitation(invitation);

    res.json({
      invitation: { ...invitation, status: statusFor(invitation) },
      warnings: { task: taskWarning, status: statusWarning },
    });
  } catch (err) {
    console.error('Create invitation failed:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/invitations', async (req, res) => {
  const { ownerId } = resolveScope(req);
  const rows = await listInvitations({ ownerId });
  const enriched = rows.map((r) => ({ ...r, status: statusFor(r) }));
  res.json({ invitations: enriched });
});

router.get('/invitations/:ticket', async (req, res) => {
  const inv = await findByTicket(req.params.ticket);
  if (!inv) return res.status(404).json({ error: 'Ticket not found' });
  if (!req.session.sf.isAdmin && inv.ownerId !== req.session.sf.userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json({ invitation: { ...inv, status: statusFor(inv) } });
});

router.get('/invitations/:ticket/qr.png', async (req, res) => {
  const inv = await findByTicket(req.params.ticket);
  if (!inv) return res.status(404).send('Not found');
  if (!req.session.sf.isAdmin && inv.ownerId !== req.session.sf.userId) {
    return res.status(403).send('Forbidden');
  }
  const png = await QRCode.toBuffer(inv.ticketNumber, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 480,
    color: { dark: '#06342C', light: '#FBF8F2' },
  });
  res.type('image/png').send(png);
});

router.post('/invitations/:ticket/scan', async (req, res) => {
  const inv = await findByTicket(req.params.ticket);
  if (!inv) return res.status(404).json({ error: 'Ticket not found' });
  if (inv.scannedAt) {
    return res.json({
      invitation: { ...inv, status: statusFor(inv) },
      alreadyScanned: true,
    });
  }

  const now = new Date().toISOString();
  const scannerId = req.session.sf.userId;
  const scannerName = req.session.sf.name;
  const updated = await updateInvitation(inv.ticketNumber, {
    scannedAt: now,
    scannedBy: scannerId,
    scannedByName: scannerName,
  });

  let taskWarning = null;
  let statusWarning = null;
  if (inv.type === 'invitation' && inv.leadId) {
    const conn = connectionFromSession(req.session);
    try {
      await createAttendanceTask(conn, {
        leadId: inv.leadId,
        ownerId: inv.ownerId,
        eventName: inv.eventName,
        ticketNumber: inv.ticketNumber,
        scannedByName: scannerName,
      });
    } catch (err) {
      console.warn('Attendance task failed:', err.message);
      taskWarning = err.message;
    }
    try {
      await markLeadAttended(conn, inv.leadId);
    } catch (err) {
      console.warn('Lead status update failed:', err.message);
      statusWarning = err.message;
    }
  }

  res.json({
    invitation: { ...updated, status: statusFor(updated) },
    warnings: { task: taskWarning, status: statusWarning },
  });
});

router.post('/walkins', async (req, res) => {
  const { name, email, eventName, notes } = req.body || {};
  if (!name || !eventName) return res.status(400).json({ error: 'Missing name or eventName' });
  const eventEntry = await findActiveEventByName(eventName);
  if (!eventEntry) {
    return res.status(400).json({ error: 'That event is not in the approved list. Ask an administrator to add it under Events.' });
  }
  const ticketNumber = await nextTicketNumber();
  const now = new Date().toISOString();
  const invitation = {
    ticketNumber,
    type: 'walk-in',
    leadId: null,
    leadName: name,
    leadEmail: email || '',
    ownerId: req.session.sf.userId,
    ownerName: req.session.sf.name,
    eventName,
    eventAt: now,
    notes: notes || '',
    createdAt: now,
    scannedAt: now,
    scannedBy: req.session.sf.userId,
    scannedByName: req.session.sf.name,
  };
  await addInvitation(invitation);
  res.json({ invitation: { ...invitation, status: statusFor(invitation) } });
});

router.get('/dashboard/stats', async (req, res) => {
  const { ownerId } = resolveScope(req);
  const rows = await listInvitations({ ownerId });
  const stats = { invitations: 0, attended: 0, pending: 0, absent: 0, walkIns: 0 };
  for (const r of rows) {
    const status = statusFor(r);
    if (r.type === 'walk-in') stats.walkIns += 1;
    else stats.invitations += 1;
    if (status === 'Attended') stats.attended += 1;
    else if (status === 'Pending') stats.pending += 1;
    else if (status === 'Absent') stats.absent += 1;
  }
  res.json({ stats });
});

router.get('/events', async (req, res) => {
  const isAdmin = req.session.sf.isAdmin;
  const events = await listEvents({ includeArchived: isAdmin });
  res.json({ events });
});

router.post('/events', async (req, res) => {
  if (!req.session.sf.isAdmin) return res.status(403).json({ error: 'Admin only' });
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Event name is required' });
  if (name.length > 120) return res.status(400).json({ error: 'Event name is too long' });
  try {
    const event = await addEvent({ name, createdBy: req.session.sf.userId });
    res.json({ event });
  } catch (err) {
    if (err.code === 'DUPLICATE') return res.status(409).json({ error: err.message });
    throw err;
  }
});

router.patch('/events/:id', async (req, res) => {
  if (!req.session.sf.isAdmin) return res.status(403).json({ error: 'Admin only' });
  const patch = {};
  if (typeof req.body?.name === 'string') patch.name = req.body.name;
  if (typeof req.body?.archived === 'boolean') patch.archived = req.body.archived;
  const event = await updateEvent(req.params.id, patch);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  res.json({ event });
});

export default router;
