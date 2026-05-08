import { api, toast, populateEventSelect } from '/js/common.js';

populateEventSelect(document.getElementById('eventName'), document.getElementById('no-events-hint'));

document.getElementById('walkin-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const eventName = document.getElementById('eventName').value.trim();
  const notes = document.getElementById('notes').value.trim();
  if (!name || !phone || !eventName) {
    toast('Name, phone, and event are required.', 'warn');
    return;
  }

  try {
    const { invitation, warnings } = await api('/api/walkins', {
      method: 'POST',
      body: { name, email, phone, eventName, notes },
    });
    if (warnings?.lead) toast('Salesforce lead: ' + warnings.lead, 'warn');
    if (warnings?.campaign) toast('Campaign: ' + warnings.campaign, 'warn');
    window.location.href = '/app/ticket/' + encodeURIComponent(invitation.ticketNumber);
  } catch (err) {
    toast(err.message, 'warn');
  }
});
