# Allegiance Event Concierge

An event invitation, QR-ticketing, and front-desk attendance app branded for
Allegiance Real Estate · Global Investment Advisory. Built on top of an
agent's Salesforce account so every introduction, attendance, and follow-up
task is recorded against the correct Lead.

## What it does

1. **Salesforce sign-in.** Agents authenticate through Salesforce OAuth — no
   separate accounts.
2. **Issue an invitation.** Look up one of your own Salesforce leads (no manual
   typing of name / email — search the records you already own), attach an
   event name, date/time, and notes. The app issues a ticket number
   (`ALG-YYYYMMDD-NNNN`) and a QR code.
3. **Salesforce updates on invite.** A Task is created under the Lead and the
   Lead's `lead_update__c` field is set to `Meeting Scheduled`.
4. **Recent invitations ledger.** Every ticket with client, agent, event,
   date/time, and live status:
   - **Pending** — created, not yet scanned, event time still ahead
   - **Attended** — scanned at the door
   - **Absent** — event time passed without a scan (4-hour grace window)
5. **Front-desk scan.** Either type a ticket number or use the device camera
   to scan the QR. Marking attendance creates a second `Event attendance`
   Task and sets `lead_update__c` to `Event Attendees`.
6. **Walk-in registration.** Capture a guest at the door who arrived without
   an invitation. They are recorded immediately as Attended and counted in
   walk-in totals.
7. **Dashboard.** Totals for invitations, attended, pending, absent, walk-ins.

## Setup

### 1. Salesforce Connected App

In your Salesforce org: **Setup → App Manager → New Connected App**.

- Enable OAuth Settings
- Callback URL: `http://localhost:3000/auth/salesforce/callback`
- Selected OAuth Scopes:
  - Access the Salesforce API (api)
  - Manage user data via APIs (refresh_token, offline_access)
  - Access your basic information (id, profile, email)
- Save and copy the **Consumer Key** and **Consumer Secret**.

### 2. Lead field

The app expects a custom field on Lead named `lead_update__c` (override via
`SF_LEAD_STATUS_FIELD` in `.env` if your org uses a different API name). Make
sure the picklist or text field accepts the values `Meeting Scheduled` and
`Event Attendees`, or change the values via env vars.

### 3. Environment

```
cp .env.example .env
# fill in SF_CLIENT_ID, SF_CLIENT_SECRET, SESSION_SECRET
```

### 4. Install & run

```
npm install
npm start
```

Open http://localhost:3000 and sign in with your Salesforce account.

## Project layout

```
server.js                Express entrypoint
routes/
  auth.js                Salesforce OAuth (login, callback, logout)
  api.js                 JSON API: leads, invitations, walk-ins, scan, stats
lib/
  salesforce.js          jsforce client + lead/task/status helpers
  store.js               JSON-file persistence + ticket numbering
views/                   EJS templates (dashboard, invite, scan, walk-in…)
public/
  css/allegiance.css     Brand tokens, type scale, components
  js/                    Front-end ES-module scripts
data/invitations.json    Created at runtime; not committed
```

## Brand

The interface follows the Allegiance design language:

- Three-colour palette only — dark green `#06342C`, gold `#C1A777`, grey
  `#6D6E71`, on ivory `#FBF8F2`.
- Playfair Display for display type, Inter for UI/body (closest open match
  for Google Sans Flex).
- Gold is an accent — eyebrows, hairlines, single-word emphasis. Never a
  background fill.
- Silk hero is textured (gradient + fractal-noise overlay), never a flat
  green swatch.
- Advisory voice — *clients*, *introductions*, no exclamation marks, no
  hype, no emoji.

## Notes

- Invitations persist to `data/invitations.json`. For multi-agent production
  use, swap the store for a real database (Postgres / DynamoDB / Salesforce
  custom object).
- The QR payload is just the ticket number string — short, robust, and
  scannable by any QR reader.
- The 4-hour grace window before a Pending ticket flips to Absent is a
  default in [lib/store.js](lib/store.js) — adjust as needed.
