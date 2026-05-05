import jsforce from 'jsforce';
import crypto from 'node:crypto';

const {
  SF_CLIENT_ID,
  SF_CLIENT_SECRET,
  SF_LOGIN_URL = 'https://login.salesforce.com',
  SF_CALLBACK_URL,
  SF_LEAD_STATUS_FIELD = 'lead_update__c',
  SF_STATUS_INVITED = 'Meeting Scheduled',
  SF_STATUS_ATTENDED = 'Event Attendees',
  SF_TASK_DUE_DATETIME_FIELD = 'Task_Due_Date__c',
  SF_TASK_REMINDER_DATETIME_FIELD = 'Task_Reminder_Date__c',
  SF_ADMIN_PROFILE_NAMES = 'System Administrator',
} = process.env;

export const STATUS_FIELD = SF_LEAD_STATUS_FIELD;
export const STATUS_INVITED = SF_STATUS_INVITED;
export const STATUS_ATTENDED = SF_STATUS_ATTENDED;
export const TASK_DUE_DT_FIELD = SF_TASK_DUE_DATETIME_FIELD;
export const TASK_REMIND_DT_FIELD = SF_TASK_REMINDER_DATETIME_FIELD;
export const ADMIN_PROFILE_NAMES = SF_ADMIN_PROFILE_NAMES.split(',').map((s) => s.trim()).filter(Boolean);

export function buildOAuth2() {
  return new jsforce.OAuth2({
    loginUrl: SF_LOGIN_URL,
    clientId: SF_CLIENT_ID,
    clientSecret: SF_CLIENT_SECRET,
    redirectUri: SF_CALLBACK_URL,
  });
}

export function generatePkcePair() {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  return { codeVerifier, codeChallenge };
}

export function authorizeUrl(state, codeChallenge) {
  const oauth2 = buildOAuth2();
  const params = {
    scope: 'api refresh_token',
    state,
  };
  if (codeChallenge) {
    params.code_challenge = codeChallenge;
    params.code_challenge_method = 'S256';
  }
  return oauth2.getAuthorizationUrl(params);
}

export async function exchangeCode(code, codeVerifier) {
  const conn = new jsforce.Connection({ oauth2: buildOAuth2() });
  const params = codeVerifier ? { code_verifier: codeVerifier } : undefined;
  const userInfo = await conn.authorize(code, params);
  let name = '';
  let email = '';
  let username = '';
  let profileName = '';
  try {
    const r = await conn.query(
      `SELECT Id, Name, Email, Username, Profile.Name FROM User WHERE Id = '${escapeSoql(userInfo.id)}'`,
    );
    const u = r.records[0] || {};
    name = u.Name || '';
    email = u.Email || '';
    username = u.Username || '';
    profileName = u.Profile?.Name || '';
  } catch (err) {
    console.warn('Could not fetch User record:', err.message);
  }
  const isAdmin = ADMIN_PROFILE_NAMES.includes(profileName);
  return {
    accessToken: conn.accessToken,
    refreshToken: conn.refreshToken,
    instanceUrl: conn.instanceUrl,
    userId: userInfo.id,
    organizationId: userInfo.organizationId,
    name,
    email,
    username,
    profileName,
    isAdmin,
  };
}

export function connectionFromSession(session) {
  if (!session?.sf) throw new Error('Not authenticated with Salesforce');
  return new jsforce.Connection({
    oauth2: buildOAuth2(),
    instanceUrl: session.sf.instanceUrl,
    accessToken: session.sf.accessToken,
    refreshToken: session.sf.refreshToken,
  });
}

function escapeSoql(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export async function searchOwnedLeads(conn, ownerId, query) {
  const q = escapeSoql(query.trim());
  if (!q) return [];

  const soql = `
    SELECT Id, Name, FirstName, LastName, Email, Phone, Company, Status
    FROM Lead
    WHERE OwnerId = '${escapeSoql(ownerId)}'
      AND IsConverted = false
      AND (Name LIKE '%${q}%' OR Email LIKE '%${q}%' OR Phone LIKE '%${q}%' OR Company LIKE '%${q}%')
    ORDER BY LastModifiedDate DESC
    LIMIT 20
  `;
  const result = await conn.query(soql);
  return result.records.map((r) => ({
    id: r.Id,
    name: r.Name,
    firstName: r.FirstName,
    lastName: r.LastName,
    email: r.Email,
    phone: r.Phone,
    company: r.Company,
    status: r.Status,
  }));
}

export async function getLead(conn, leadId) {
  const r = await conn.sobject('Lead').retrieve(leadId);
  return {
    id: r.Id,
    name: r.Name,
    email: r.Email,
    company: r.Company,
    ownerId: r.OwnerId,
  };
}

export async function createInvitationTask(conn, { leadId, ownerId, eventName, eventAt, notes, ticketNumber }) {
  const eventDate = new Date(eventAt);
  const activityDate = eventDate.toISOString().slice(0, 10);
  const eventIso = eventDate.toISOString();
  const subject = `Event invitation: ${eventName}`;
  const description = [
    `Ticket: ${ticketNumber}`,
    `Event: ${eventName}`,
    `Scheduled: ${eventDate.toLocaleString()}`,
    notes ? `Notes: ${notes}` : null,
  ].filter(Boolean).join('\n');

  const task = {
    WhoId: leadId,
    OwnerId: ownerId,
    Subject: subject,
    Description: description,
    ActivityDate: activityDate,
    Status: 'Not Started',
    Priority: 'Normal',
    Type: 'Event',
  };
  if (TASK_DUE_DT_FIELD) task[TASK_DUE_DT_FIELD] = eventIso;
  if (TASK_REMIND_DT_FIELD) task[TASK_REMIND_DT_FIELD] = eventIso;
  return conn.sobject('Task').create(task);
}

export async function createAttendanceTask(conn, { leadId, ownerId, eventName, ticketNumber }) {
  const now = new Date();
  const nowIso = now.toISOString();
  const task = {
    WhoId: leadId,
    OwnerId: ownerId,
    Subject: `Event Attendees: ${eventName}`,
    Description: `Ticket ${ticketNumber} scanned at ${now.toLocaleString()}.`,
    ActivityDate: nowIso.slice(0, 10),
    Status: 'Completed',
    Priority: 'Normal',
    Type: 'Event',
  };
  if (TASK_DUE_DT_FIELD) task[TASK_DUE_DT_FIELD] = nowIso;
  if (TASK_REMIND_DT_FIELD) task[TASK_REMIND_DT_FIELD] = nowIso;
  return conn.sobject('Task').create(task);
}

export async function updateLeadStatus(conn, leadId, value) {
  const update = { Id: leadId };
  update[STATUS_FIELD] = value;
  return conn.sobject('Lead').update(update);
}

export async function markLeadInvited(conn, leadId) {
  return updateLeadStatus(conn, leadId, STATUS_INVITED);
}

export async function markLeadAttended(conn, leadId) {
  return updateLeadStatus(conn, leadId, STATUS_ATTENDED);
}
