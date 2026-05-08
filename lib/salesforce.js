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
  SF_WALKIN_LEAD_SOURCE = 'Marketing',
  SF_WALKIN_PIPELINE_FIELD = 'Pipeline__c',
  SF_WALKIN_PIPELINE_VALUE = 'Events',
  SF_WALKIN_DEFAULT_COMPANY = 'Walk-in',
  SF_CAMPAIGN_MEMBER_STATUS = 'Responded',
} = process.env;

export const STATUS_FIELD = SF_LEAD_STATUS_FIELD;
export const STATUS_INVITED = SF_STATUS_INVITED;
export const STATUS_ATTENDED = SF_STATUS_ATTENDED;
export const TASK_DUE_DT_FIELD = SF_TASK_DUE_DATETIME_FIELD;
export const TASK_REMIND_DT_FIELD = SF_TASK_REMINDER_DATETIME_FIELD;
export const ADMIN_PROFILE_NAMES = SF_ADMIN_PROFILE_NAMES.split(',').map((s) => s.trim()).filter(Boolean);
export const WALKIN_LEAD_SOURCE = SF_WALKIN_LEAD_SOURCE;
export const WALKIN_PIPELINE_FIELD = SF_WALKIN_PIPELINE_FIELD;
export const WALKIN_PIPELINE_VALUE = SF_WALKIN_PIPELINE_VALUE;
export const WALKIN_DEFAULT_COMPANY = SF_WALKIN_DEFAULT_COMPANY;
export const CAMPAIGN_MEMBER_STATUS = SF_CAMPAIGN_MEMBER_STATUS;

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

export async function searchLeads(conn, query, { ownerId = null } = {}) {
  const q = escapeSoql(query.trim());
  if (!q) return [];

  const ownerClause = ownerId ? `OwnerId = '${escapeSoql(ownerId)}' AND ` : '';
  const soql = `
    SELECT Id, Name, FirstName, LastName, Email, Phone, Company, Status, Owner.Name
    FROM Lead
    WHERE ${ownerClause}IsConverted = false
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
    ownerName: r.Owner?.Name || '',
  }));
}

export const searchOwnedLeads = (conn, ownerId, query) => searchLeads(conn, query, { ownerId });

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

export async function createAttendanceTask(conn, { leadId, ownerId, eventName, ticketNumber, scannedByName }) {
  const now = new Date();
  const nowIso = now.toISOString();
  const description = [
    `Ticket ${ticketNumber} scanned at ${now.toLocaleString()}.`,
    scannedByName ? `Scanned by ${scannedByName}.` : null,
  ].filter(Boolean).join('\n');
  const task = {
    WhoId: leadId,
    OwnerId: ownerId,
    Subject: `Event Attendees: ${eventName}`,
    Description: description,
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

function splitName(fullName) {
  const trimmed = String(fullName || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return { firstName: '', lastName: '' };
  const parts = trimmed.split(' ');
  if (parts.length === 1) return { firstName: '', lastName: parts[0] };
  return { firstName: parts.shift(), lastName: parts.join(' ') };
}

export async function findCampaignByName(conn, name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return null;
  const r = await conn.query(
    `SELECT Id, Name FROM Campaign WHERE Name = '${escapeSoql(trimmed)}' ORDER BY CreatedDate DESC LIMIT 1`,
  );
  return r.records[0] || null;
}

export async function createWalkinLead(conn, { fullName, email, phone, eventName, ownerId }) {
  const { firstName, lastName } = splitName(fullName);
  const lead = {
    FirstName: firstName || null,
    LastName: lastName || fullName || 'Guest',
    Email: email || null,
    Phone: phone || null,
    Company: WALKIN_DEFAULT_COMPANY,
    LeadSource: WALKIN_LEAD_SOURCE,
    OwnerId: ownerId,
  };
  if (WALKIN_PIPELINE_FIELD) lead[WALKIN_PIPELINE_FIELD] = WALKIN_PIPELINE_VALUE;
  const created = await conn.sobject('Lead').create(lead);
  if (!created.success) {
    const msg = (created.errors || []).map((e) => e.message || e).join('; ') || 'Lead create failed';
    throw new Error(msg);
  }
  const leadId = created.id;

  let campaignWarning = null;
  try {
    const campaign = await findCampaignByName(conn, eventName);
    if (campaign) {
      const cm = await conn.sobject('CampaignMember').create({
        CampaignId: campaign.Id,
        LeadId: leadId,
        Status: CAMPAIGN_MEMBER_STATUS,
      });
      if (!cm.success) {
        campaignWarning = (cm.errors || []).map((e) => e.message || e).join('; ') || 'CampaignMember create failed';
      }
    } else {
      campaignWarning = `No Salesforce Campaign found with name "${eventName}"`;
    }
  } catch (err) {
    campaignWarning = err.message;
  }

  return { leadId, campaignWarning };
}
