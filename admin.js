/* ==========================================================================
   admin.js — invitation, RSVP and wishes management
   Uses the same data layer as the public page (js/store.js), so it works
   with Supabase once configured and in browser-only mode until then.
   ========================================================================== */

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

const STORE = window.WeddingStore;
const CONFIG = window.SITE_CONFIG || {};

const loginView = $('#login-view');
const dashboardView = $('#dashboard-view');
const loginForm = $('#login-form');
const createForm = $('#create-form');
const loginError = $('#login-error');
const loginHint = $('#login-hint');
const createMessage = $('#create-message');
const invitationsBody = $('#invitations-body');
const invitationsEmpty = $('#invitations-empty');
const rsvpsBody = $('#rsvps-body');
const rsvpsEmpty = $('#rsvps-empty');
const rsvpStats = $('#rsvp-stats');

function showMessage(element, message, isError = false) {
  if (!element) return;
  element.textContent = message;
  element.classList.toggle('admin-message--error', isError);
  element.hidden = !message;
}

function showLogin() {
  loginView.hidden = false;
  dashboardView.hidden = true;
}

function showDashboard() {
  loginView.hidden = true;
  dashboardView.hidden = false;
}

/* ---------------- tabs ---------------- */
$$('[data-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    const target = button.dataset.tab;
    $$('[data-tab]').forEach((other) => other.setAttribute('aria-selected', String(other === button)));
    ['invitations', 'rsvps', 'wishes'].forEach((name) => {
      $('#panel-' + name).hidden = name !== target;
    });
    if (target === 'rsvps') loadRsvps();
    if (target === 'wishes') loadWishes();
  });
});

/* ---------------- helpers ---------------- */
function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function createActionButton(label, className, handler) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.addEventListener('click', handler);
  return button;
}

async function copyText(value, successMessage) {
  try {
    await navigator.clipboard.writeText(value);
    showMessage(createMessage, successMessage);
  } catch (error) {
    window.prompt('Copy this text:', value);
  }
}

function describeBackend() {
  const note = $('#backend-note');
  if (STORE.isSupabaseConfigured) {
    note.textContent = 'Connected to Supabase. Links, replies and messages are shared across every device.';
  } else {
    note.textContent = 'Preview mode: data is stored only in this browser. Add your Supabase keys in js/config.js to go live.';
  }

  if (!STORE.isSupabaseConfigured) {
    loginHint.hidden = false;
    loginHint.innerHTML =
      'Supabase is not connected yet, so sign in with any email and the passcode ' +
      '<code>' + (CONFIG.localAdminPasscode || 'change-me') + '</code> ' +
      '(you can change it in <code>js/config.js</code>). ' +
      'This sign-in only unlocks the page in this browser &mdash; it is not real security. ' +
      'Once Supabase is connected this form uses a real Supabase account instead.';
    $('#admin-username').value = 'admin@trevorandmich.com';
  }
}

/* ---------------- invitations ---------------- */
function renderInvitations(invitations) {
  invitationsBody.replaceChildren();
  invitationsEmpty.hidden = invitations.length !== 0;
  if (!invitations.length) return;

  invitations.forEach((invitation) => {
    const url = STORE.inviteUrl(invitation.token);
    const row = document.createElement('tr');
    row.className = invitation.active ? '' : 'admin-row--inactive';

    const nameCell = document.createElement('td');
    nameCell.textContent = invitation.name;
    if (invitation.note) {
      const note = document.createElement('div');
      note.className = 'admin-hint';
      note.textContent = invitation.note;
      nameCell.appendChild(note);
    }

    const seatsCell = document.createElement('td');
    seatsCell.textContent = String(invitation.seats);

    const dateCell = document.createElement('td');
    dateCell.textContent = formatDate(invitation.createdAt);

    const statusCell = document.createElement('td');
    const status = document.createElement('span');
    status.className = invitation.active ? 'admin-status admin-status--active' : 'admin-status admin-status--inactive';
    status.textContent = invitation.active ? 'Active' : 'Revoked';
    statusCell.appendChild(status);

    const linkCell = document.createElement('td');
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = url;
    linkCell.appendChild(link);

    const actionCell = document.createElement('td');
    actionCell.appendChild(createActionButton('Copy', 'admin-small-button', () => copyText(url, 'Invitation link copied.')));

    actionCell.appendChild(createActionButton('Seats', 'admin-small-button', async () => {
      const next = window.prompt('How many seats are reserved for ' + invitation.name + '?', String(invitation.seats));
      if (next === null) return;
      try {
        await STORE.updateInvitation(invitation.token, { seats: Number(next) });
        await loadInvitations();
        showMessage(createMessage, 'Seats updated for ' + invitation.name + '.');
      } catch (error) {
        showMessage(createMessage, error.message, true);
      }
    }));

    actionCell.appendChild(createActionButton('Rename', 'admin-small-button', async () => {
      const next = window.prompt('New name for this invitation:', invitation.name);
      if (next === null || !next.trim()) return;
      try {
        await STORE.updateInvitation(invitation.token, { name: next });
        await loadInvitations();
        showMessage(createMessage, 'Invitation renamed.');
      } catch (error) {
        showMessage(createMessage, error.message, true);
      }
    }));

    if (invitation.active) {
      actionCell.appendChild(createActionButton('Revoke', 'admin-small-button admin-small-button--danger', async () => {
        if (!window.confirm('Revoke the invitation for ' + invitation.name + '?')) return;
        try {
          await STORE.revokeInvitation(invitation.token);
          await loadInvitations();
          showMessage(createMessage, 'Invitation revoked.');
        } catch (error) {
          showMessage(createMessage, error.message, true);
        }
      }));
    } else {
      actionCell.appendChild(createActionButton('Restore', 'admin-small-button', async () => {
        try {
          await STORE.restoreInvitation(invitation.token);
          await loadInvitations();
          showMessage(createMessage, 'Invitation restored.');
        } catch (error) {
          showMessage(createMessage, error.message, true);
        }
      }));
    }

    actionCell.appendChild(createActionButton('Delete', 'admin-small-button admin-small-button--danger', async () => {
      if (!window.confirm('Permanently delete the invitation for ' + invitation.name + '?')) return;
      try {
        await STORE.deleteInvitation(invitation.token);
        await loadInvitations();
        showMessage(createMessage, 'Invitation deleted.');
      } catch (error) {
        showMessage(createMessage, error.message, true);
      }
    }));

    row.append(nameCell, seatsCell, dateCell, statusCell, linkCell, actionCell);
    invitationsBody.appendChild(row);
  });
}

async function loadInvitations() {
  try {
    renderInvitations(await STORE.listInvitations());
  } catch (error) {
    showMessage(createMessage, error.message, true);
  }
}

/* ---------------- rsvps ---------------- */
function renderRsvpStats(rsvps) {
  rsvpStats.replaceChildren();
  const yes = rsvps.filter((item) => item.attendance === 'Yes');
  const pax = yes.reduce((total, item) => total + (Number(item.pax) || 0), 0);

  [
    { value: String(yes.length), label: 'Attending' },
    { value: String(rsvps.length - yes.length), label: 'Declined' },
    { value: String(pax), label: 'Total pax' }
  ].forEach((entry) => {
    const li = document.createElement('li');
    const b = document.createElement('b');
    b.textContent = entry.value;
    const span = document.createElement('span');
    span.textContent = entry.label;
    li.append(b, span);
    rsvpStats.appendChild(li);
  });
}

function renderRsvps(rsvps) {
  rsvpsBody.replaceChildren();
  rsvpsEmpty.hidden = rsvps.length !== 0;
  renderRsvpStats(rsvps);
  if (!rsvps.length) return;

  rsvps.forEach((reply) => {
    const row = document.createElement('tr');

    const guestCell = document.createElement('td');
    guestCell.textContent = reply.name;

    const attendanceCell = document.createElement('td');
    const status = document.createElement('span');
    const attending = reply.attendance === 'Yes';
    status.className = attending ? 'admin-status admin-status--active' : 'admin-status admin-status--inactive';
    status.textContent = attending ? 'Yes' : 'No';
    attendanceCell.appendChild(status);

    const paxCell = document.createElement('td');
    paxCell.textContent = attending ? String(reply.pax || 1) : '—';

    const emailCell = document.createElement('td');
    emailCell.textContent = reply.email || '—';

    const dietCell = document.createElement('td');
    dietCell.textContent = reply.dietary || '—';

    const messageCell = document.createElement('td');
    messageCell.textContent = reply.message || '—';

    const dateCell = document.createElement('td');
    dateCell.textContent = formatDate(reply.createdAt);

    row.append(guestCell, attendanceCell, paxCell, emailCell, dietCell, messageCell, dateCell);
    rsvpsBody.appendChild(row);
  });
}

async function loadRsvps() {
  const loading = document.createElement('p');
  loading.className = 'admin-loading';
  loading.textContent = 'Loading replies…';
  rsvpsBody.replaceChildren();
  try {
    renderRsvps(await STORE.listRsvps());
  } catch (error) {
    rsvpsBody.replaceChildren();
    rsvpsEmpty.hidden = false;
    rsvpsEmpty.textContent = error.message;
  }
}

function downloadCsv(filename, rows) {
  const escape = (value) => '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"';
  const csv = rows.map((row) => row.map(escape).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

$('#export-rsvps').addEventListener('click', async () => {
  try {
    const rsvps = await STORE.listRsvps();
    downloadCsv('trevor-marijomich-rsvps.csv', [
      ['Replied', 'Name', 'Attending', 'Pax', 'Email', 'Dietary notes', 'Message', 'Invitation'],
      ...rsvps.map((item) => [
        formatDate(item.createdAt), item.name, item.attendance,
        item.attendance === 'Yes' ? (item.pax || 1) : 0,
        item.email, item.dietary, item.message, item.token
      ])
    ]);
  } catch (error) {
    showMessage(createMessage, error.message, true);
  }
});

/* ---------------- wishes ---------------- */
async function loadWishes() {
  const list = $('#wishes-admin-list');
  list.replaceChildren();
  const loading = document.createElement('p');
  loading.className = 'admin-loading';
  loading.textContent = 'Loading messages…';
  list.appendChild(loading);

  try {
    const wishes = await STORE.listWishes();
    list.replaceChildren();

    if (!wishes.length) {
      const empty = document.createElement('p');
      empty.className = 'admin-empty';
      empty.textContent = 'No messages yet.';
      list.appendChild(empty);
      return;
    }

    wishes.forEach((wish) => {
      const article = document.createElement('article');
      article.className = 'admin-wish';

      const text = document.createElement('p');
      text.textContent = wish.message;

      const footer = document.createElement('footer');
      const who = document.createElement('strong');
      who.textContent = wish.name;
      const when = document.createElement('span');
      when.textContent = formatDate(wish.createdAt);

      footer.append(who, when);
      footer.appendChild(createActionButton('Delete', 'admin-small-button admin-small-button--danger', async () => {
        if (!window.confirm('Delete the message from ' + wish.name + '?')) return;
        try {
          await STORE.deleteWish(wish.id);
          await loadWishes();
          await loadWishesCount();
        } catch (error) {
          showMessage(createMessage, error.message, true);
        }
      }));

      article.append(text, footer);
      list.appendChild(article);
    });
  } catch (error) {
    list.replaceChildren();
    const failed = document.createElement('p');
    failed.className = 'admin-empty';
    failed.textContent = error.message;
    list.appendChild(failed);
  }
}

async function loadWishesCount() {
  /* keeps the tab count honest after a delete */
  try {
    await STORE.listWishes();
  } catch (error) { /* ignore */ }
}

$('#refresh-wishes').addEventListener('click', loadWishes);

/* ---------------- sign in / create ---------------- */
loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  showMessage(loginError, '');
  const formData = new FormData(loginForm);
  try {
    await STORE.signIn(
      String(formData.get('username') || '').trim(),
      String(formData.get('password') || '')
    );
    showDashboard();
    showMessage(createMessage, '');
    await loadInvitations();
  } catch (error) {
    showMessage(loginError, error.message, true);
  }
});

createForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  showMessage(createMessage, '');
  const formData = new FormData(createForm);
  try {
    const invitation = await STORE.createInvitation({
      name: formData.get('name'),
      seats: formData.get('seats'),
      note: formData.get('note')
    });
    createForm.reset();
    $('#invitee-seats').value = CONFIG.wedding.defaultSeats || 2;
    showMessage(createMessage, 'Invitation created for ' + invitation.name + '. Copy the link and send it to them.');
    await loadInvitations();
  } catch (error) {
    showMessage(createMessage, error.message, true);
  }
});

$('#logout-button').addEventListener('click', async () => {
  try {
    await STORE.signOut();
  } finally {
    showLogin();
  }
});

$('#refresh-button').addEventListener('click', loadInvitations);

/* ---------------- boot ---------------- */
(async function initialiseAdmin() {
  describeBackend();
  try {
    const user = await STORE.currentUser();
    if (user) {
      showDashboard();
      await loadInvitations();
    } else {
      showLogin();
    }
  } catch (error) {
    showLogin();
  }
}());
