/* ==========================================================================
   script.js — Trevor & Marijomich invitation
   Page behaviour: welcome screen, personalisation, countdown, gallery,
   wishes wall, RSVP and background music.
   ========================================================================== */

document.documentElement.classList.add('js');

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

const CONFIG = window.SITE_CONFIG || {};
const STORE = window.WeddingStore;
const WEDDING = CONFIG.wedding || {};
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const welcome = $('#welcome');

/* ------------------------------------------------------------------ *
 * 1. Who is this invitation for?
 *    Accepts  /invite/<token>  ·  ?token=  ·  ?to=  ·  #<token>
 * ------------------------------------------------------------------ */
const inviteToken = STORE ? STORE.tokenFromLocation() : '';
let invitation = null;

function pluralSeats(value) {
  return value === 1 ? '1 seat' : value + ' seats';
}

/* Builds the "reserved seats" note. Text is inserted as text nodes, never
   as HTML, so a note typed in the admin panel can never inject markup. */
function setSeatsNote(reservedSeats, note) {
  const box = $('#rsvp-seats-note');
  box.replaceChildren();

  box.append('Trevor & Marijomich have reserved ');
  const strong = document.createElement('b');
  strong.textContent = pluralSeats(reservedSeats);
  box.appendChild(strong);

  box.append(' for you');
  if (note) box.append(' — ' + note);
  box.append('. If you are bringing more guests, please enter the total number of pax above and tell us in the message.');
}

function applyInvitation(record) {
  invitation = record;
  const reservedSeats = record ? Number(record.seats) || 2 : Number(WEDDING.defaultSeats) || 2;

  if (record && record.name) {
    $('#welcome-title').textContent = record.name;
    document.title = record.name + ' | Trevor & Marijomich';
  }

  if (record && record.active === false) $('#welcome-note').hidden = false;

  $('#welcome-seats').replaceChildren(
    document.createTextNode('( We have reserved '),
    Object.assign(document.createElement('b'), { textContent: pluralSeats(reservedSeats) }),
    document.createTextNode(' for you )')
  );

  /* RSVP form: the guest's name comes from their link and cannot be edited */
  const nameInput = $('#guest-name');
  if (record && record.name) {
    nameInput.value = record.name;
    nameInput.readOnly = true;
    nameInput.classList.add('is-locked');
    nameInput.title = 'This name comes from your invitation link.';

    const banner = $('#rsvp-guest');
    banner.replaceChildren(
      document.createTextNode('Invited guest: '),
      Object.assign(document.createElement('strong'), { textContent: record.name }),
      document.createTextNode(' · ' + pluralSeats(reservedSeats) + ' reserved')
    );
    banner.hidden = false;

    setSeatsNote(reservedSeats, record.note);
  } else {
    setSeatsNote(reservedSeats, '');
  }
}

async function loadInvitation() {
  if (!inviteToken) {
    applyInvitation(null);
    return;
  }
  try {
    const record = await STORE.getInvitation(inviteToken);
    applyInvitation(record);
  } catch (error) {
    applyInvitation(null);
  } finally {
    rsvpIsValid();
  }
}

/* ------------------------------------------------------------------ *
 * 2. Welcome screen + music
 * ------------------------------------------------------------------ */
const musicButton = $('#music-toggle');
const music = $('#background-music');
const musicFrame = $('#music-frame');
let musicWanted = false;

function setMusicState(playing) {
  if (!musicButton) return;
  musicButton.classList.toggle('is-playing', playing);
  musicButton.setAttribute('aria-pressed', String(playing));
  musicButton.setAttribute('aria-label', playing ? 'Pause music' : 'Play music');
}

function startMusic() {
  if (!musicButton) return;

  if (CONFIG.musicAudioSrc && music) {
    music.src = CONFIG.musicAudioSrc;
    music.play().then(() => setMusicState(true)).catch(() => setMusicState(false));
    return;
  }

  if (CONFIG.musicVideoId && musicFrame) {
    musicFrame.src = 'https://www.youtube-nocookie.com/embed/' + CONFIG.musicVideoId +
      '?autoplay=1&loop=1&playlist=' + CONFIG.musicVideoId + '&playsinline=1';
    setMusicState(true);
  }
}

function stopMusic() {
  if (music) music.pause();
  if (musicFrame) musicFrame.removeAttribute('src');
  setMusicState(false);
}

if (musicButton) {
  /* The button only appears when a track has been configured */
  if (CONFIG.musicAudioSrc || CONFIG.musicVideoId) musicButton.hidden = false;
  if (CONFIG.musicVideoId) musicButton.classList.add('is-playing');
}

/* The envelope button and the "Open Invitation" button both carry
   data-open-invitation, so one listener covers them. */
function openInvitation() {
  if (!welcome || welcome.classList.contains('is-opening') || welcome.classList.contains('is-hidden')) return;

  /* the seal lifts, the flap folds back, the envelope flies away, then the
     screen fades — see the .is-opening rules in styles.css */
  welcome.classList.add('is-opening');
  document.body.classList.remove('modal-open', 'welcome-open');

  window.setTimeout(() => {
    welcome.classList.add('is-hidden');
  }, reduceMotion ? 0 : 1600);

  /* Audio can only start inside the click that opened the invitation */
  if (CONFIG.musicAudioSrc || CONFIG.musicVideoId) {
    musicWanted = true;
    startMusic();
  }
}

$$('[data-open-invitation]').forEach((button) => button.addEventListener('click', openInvitation));

if (welcome) {
  welcome.addEventListener('click', (event) => {
    /* clicking the backdrop still opens it, unless the click landed on a
       control that handles itself */
    if (event.target.closest('[data-open-invitation]')) return;
    if (event.target === welcome || event.target.classList.contains('welcome__background') || event.target.classList.contains('welcome__shade')) openInvitation();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !welcome.classList.contains('is-hidden')) openInvitation();
  });
}

if (musicButton) {
  musicButton.addEventListener('click', () => {
    if (musicButton.classList.contains('is-playing')) {
      musicWanted = false;
      stopMusic();
    } else {
      musicWanted = true;
      startMusic();
    }
  });

  if (music) {
    music.addEventListener('play', () => setMusicState(true));
    music.addEventListener('pause', () => setMusicState(false));
    music.addEventListener('error', () => setMusicState(false));
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (music) music.pause();
    } else if (musicWanted) {
      startMusic();
    }
  });
}

/* ------------------------------------------------------------------ *
 * 3. Countdown
 * ------------------------------------------------------------------ */
const countdownTarget = new Date(WEDDING.startISO || '2027-01-04T16:00:00+08:00').getTime();
const countdownFields = {
  days: $('#countdown-days'),
  hours: $('#countdown-hours'),
  minutes: $('#countdown-minutes'),
  seconds: $('#countdown-seconds')
};
let countdownInterval;
let lastTick = { days: null, hours: null, minutes: null, seconds: null };

/* Nudges a value upward for a moment so the change is visible, the way a
   mechanical counter jumps rather than silently swapping. */
function tickField(field, value) {
  if (!field || field.textContent === value) return;
  field.textContent = value;
  if (reduceMotion) return;
  field.classList.add('is-ticking');
  window.setTimeout(() => field.classList.remove('is-ticking'), 300);
}

function updateCountdown() {
  if (!Object.values(countdownFields).every(Boolean)) return;
  const remaining = countdownTarget - Date.now();

  if (remaining <= 0) {
    Object.values(countdownFields).forEach((field) => { field.textContent = '—'; });
    if (countdownInterval) window.clearInterval(countdownInterval);
    return;
  }

  const totalSeconds = Math.floor(remaining / 1000);
  const next = {
    days: String(Math.floor(totalSeconds / 86400)),
    hours: String(Math.floor((totalSeconds % 86400) / 3600)).padStart(2, '0'),
    minutes: String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0'),
    seconds: String(totalSeconds % 60).padStart(2, '0')
  };

  Object.keys(next).forEach((key) => {
    if (lastTick[key] === next[key]) return;
    /* the very first paint should not animate, only later changes */
    tickField(countdownFields[key], next[key]);
    lastTick[key] = next[key];
  });
}

updateCountdown();
if (countdownTarget > Date.now()) countdownInterval = window.setInterval(updateCountdown, 1000);

/* ------------------------------------------------------------------ *
 * 4. Wishes wall — read live from the store, never hard-coded
 * ------------------------------------------------------------------ */
const wishesList = $('#wishes-list');
const wishesStatus = $('#wishes-status');

function renderWish(wish, prepend) {
  const article = document.createElement('article');
  article.className = 'wish';

  const text = document.createElement('p');
  text.textContent = wish.message;
  article.appendChild(text);

  const author = document.createElement('strong');
  author.textContent = wish.name;
  article.appendChild(author);

  if (wish.createdAt) {
    const time = document.createElement('time');
    time.dateTime = wish.createdAt;
    time.textContent = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(wish.createdAt));
    article.appendChild(time);
  }

  if (prepend) wishesList.prepend(article);
  else wishesList.appendChild(article);
}

async function loadWishes() {
  if (!wishesList) return;

  try {
    const wishes = await STORE.listWishes();
    wishesList.replaceChildren();

    if (!wishes.length) {
      const empty = document.createElement('p');
      empty.className = 'wishes__empty';
      empty.textContent = 'No messages yet — be the first to leave a wish below.';
      wishesList.appendChild(empty);
    } else {
      wishes.forEach((wish) => renderWish(wish, false));
    }
  } catch (error) {
    wishesList.replaceChildren();
    const empty = document.createElement('p');
    empty.className = 'wishes__empty';
    empty.textContent = 'The message wall could not be loaded just now. Please try again later.';
    wishesList.appendChild(empty);
  }
}

/* ------------------------------------------------------------------ *
 * 5. RSVP form
 * ------------------------------------------------------------------ */
const rsvpForm = $('#rsvp-form');
const attendance = $('#attendance');
const pax = $('#pax');
const rsvpSubmit = rsvpForm ? $('.button--submit', rsvpForm) : null;
const formMessage = $('#form-message');

function updatePaxState() {
  if (!attendance || !pax) return;
  const isAttending = attendance.value === 'Yes';
  pax.disabled = !isAttending;
  if (!isAttending) pax.value = '';
}

function rsvpIsValid() {
  if (!rsvpForm || !attendance || !rsvpSubmit) return false;
  const name = $('#guest-name');
  const valid = Boolean(name && name.value.trim()) &&
    Boolean(attendance.value) &&
    (attendance.value === 'No' || Boolean(pax && pax.value));
  rsvpSubmit.disabled = !valid;
  return valid;
}

function showFormMessage(text, isError) {
  if (!formMessage) return;
  formMessage.textContent = text;
  formMessage.classList.add('is-visible');
  formMessage.classList.toggle('is-error', Boolean(isError));
  window.setTimeout(() => formMessage.classList.remove('is-visible'), 7000);
}

if (attendance) attendance.addEventListener('change', () => {
  updatePaxState();
  rsvpIsValid();
});

if (rsvpForm) {
  $$('input, select, textarea', rsvpForm).forEach((field) => field.addEventListener('input', rsvpIsValid));
  rsvpForm.addEventListener('input', rsvpIsValid);

  rsvpForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!rsvpIsValid()) return;

    const record = {
      name: $('#guest-name').value.trim(),
      email: $('#guest-email').value.trim(),
      attendance: attendance.value,
      pax: pax ? pax.value : '',
      dietary: $('#guest-diet').value.trim(),
      message: $('#guest-wish').value.trim(),
      token: inviteToken
    };

    rsvpSubmit.disabled = true;
    const originalLabel = rsvpSubmit.textContent;
    rsvpSubmit.textContent = 'Sending…';

    let savedReply = false;

    /* a) Save the reply to Supabase, which is what the admin page reads */
    try {
      await STORE.addRsvp(record);
      savedReply = true;
    } catch (error) {
      /* nothing else to fall back on, so the guest is told below */
    }

    /* b) Post the greeting on the wishes wall */
    if (record.message) {
      try {
        const wish = await STORE.addWish({
          name: record.name,
          message: record.message,
          token: inviteToken
        });
        const empty = $('.wishes__empty', wishesList);
        if (empty) empty.remove();
        renderWish(wish, true);
      } catch (error) { /* the RSVP itself still counts */ }
    }

    if (!savedReply) {
      showFormMessage('Sorry, something went wrong and your reply was not saved. Please try again in a moment.', true);
      rsvpSubmit.textContent = originalLabel;
      rsvpIsValid();
      return;
    }

    showFormMessage(
      record.attendance === 'Yes'
        ? 'Thank you! Your RSVP has been received. We cannot wait to celebrate with you.'
        : 'Thank you for letting us know. We will miss you, and we are grateful you answered.',
      false
    );

    rsvpForm.reset();
    if (invitation && invitation.name) {
      const nameInput = $('#guest-name');
      nameInput.value = invitation.name;
      nameInput.readOnly = true;
    }
    rsvpSubmit.textContent = originalLabel;
    updatePaxState();
    rsvpIsValid();
  });
}

/* ------------------------------------------------------------------ *
 * 6. Reveal sections
 *
 * Scroll-triggered entrances are handled by the AOS engine in js/aos.js.
 * Messages added to the wishes wall after the first pass get their own
 * entrance so they do not just appear.
 * ------------------------------------------------------------------ */
const revealItems = $$('.reveal');
if (reduceMotion || !('IntersectionObserver' in window)) {
  revealItems.forEach((item) => item.classList.add('is-visible'));
} else {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -5% 0px' });
  revealItems.forEach((item) => revealObserver.observe(item));
}

/* ------------------------------------------------------------------ *
 * 7. Drifting blossoms
 * ------------------------------------------------------------------ */
function buildPetals() {
  const field = $('#petal-field');
  if (!field || reduceMotion) return;

  /* one petal per ~26000 square pixels, so phones get fewer than desktops */
  const area = window.innerWidth * window.innerHeight;
  const count = Math.max(10, Math.min(34, Math.round(area / 26000)));
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < count; i += 1) {
    const petal = document.createElement('i');
    petal.style.setProperty('--left', (Math.random() * 104 - 2).toFixed(2) + '%');
    petal.style.setProperty('--size', (4 + Math.random() * 6).toFixed(2) + 'px');
    petal.style.setProperty('--duration', (11 + Math.random() * 11).toFixed(2) + 's');
    /* negative delays start the field mid-flight, so it never looks empty */
    petal.style.setProperty('--delay', (-Math.random() * 18).toFixed(2) + 's');
    petal.style.setProperty('--spin', Math.round(240 + Math.random() * 480) + 'deg');
    petal.style.setProperty('--drift', Math.round(-70 + Math.random() * 140) + 'px');
    petal.style.setProperty('--sway', Math.round(8 + Math.random() * 30) + 'px');
    petal.style.setProperty('--alpha', (0.32 + Math.random() * 0.35).toFixed(2));
    fragment.appendChild(petal);
  }

  field.appendChild(fragment);
}

/* ------------------------------------------------------------------ *
 * 8. Loading bar
 * ------------------------------------------------------------------ */
function setupLoader() {
  const loader = $('#page-loader');
  if (!loader) return;
  const bar = loader.firstElementChild;
  if (!bar) return;

  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    bar.style.setProperty('--load', '100%');
    window.setTimeout(() => loader.classList.add('is-done'), 320);
  };

  /* creep forward while the page loads, so the bar always looks alive */
  let creep = 0;
  const timer = window.setInterval(() => {
    creep = Math.min(creep + 6 + Math.random() * 11, 88);
    bar.style.setProperty('--load', creep + '%');
  }, 180);

  const settle = () => {
    window.clearInterval(timer);
    window.setTimeout(finish, 120);
  };

  if (document.readyState === 'complete') settle();
  else window.addEventListener('load', settle, { once: true });

  /* never let a slow asset hold the bar hostage */
  window.setTimeout(finish, 4000);
}

/* ------------------------------------------------------------------ *
 * 9. Gallery lightbox
 * ------------------------------------------------------------------ */
const galleryButtons = $$('[data-gallery-index]');
const lightbox = $('#lightbox');
const lightboxImage = $('#lightbox-image');
const lightboxCaption = $('#lightbox-caption');
let activeGalleryIndex = 0;

function showGalleryImage(index) {
  if (!lightbox || !lightboxImage || !galleryButtons.length) return;
  activeGalleryIndex = (index + galleryButtons.length) % galleryButtons.length;
  const image = $('img', galleryButtons[activeGalleryIndex]);
  if (!image) return;
  lightboxImage.src = image.currentSrc || image.src;
  lightboxImage.alt = image.alt;
  if (lightboxCaption) lightboxCaption.textContent = (activeGalleryIndex + 1) + ' / ' + galleryButtons.length;
}

function openLightbox(index) {
  if (!lightbox) return;
  showGalleryImage(index);
  lightbox.hidden = false;
  document.body.classList.add('lightbox-open');
  /* the fade-in only runs on the frame after the element becomes visible */
  window.requestAnimationFrame(() => lightbox.classList.add('is-open'));
  const close = $('[data-close-lightbox]', lightbox);
  if (close) close.focus();
}

function closeLightbox() {
  if (!lightbox) return;
  lightbox.classList.remove('is-open');
  document.body.classList.remove('lightbox-open');
  window.setTimeout(() => { lightbox.hidden = true; }, reduceMotion ? 0 : 300);
}

galleryButtons.forEach((button) => {
  button.addEventListener('click', () => openLightbox(Number(button.dataset.galleryIndex || 0)));
});

const lightboxPrev = $('[data-lightbox-prev]');
const lightboxNext = $('[data-lightbox-next]');
const lightboxClose = $('[data-close-lightbox]');
if (lightboxPrev) lightboxPrev.addEventListener('click', () => showGalleryImage(activeGalleryIndex - 1));
if (lightboxNext) lightboxNext.addEventListener('click', () => showGalleryImage(activeGalleryIndex + 1));
if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
if (lightbox) {
  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox) closeLightbox();
  });
}

document.addEventListener('keydown', (event) => {
  if (lightbox && !lightbox.hidden) {
    if (event.key === 'Escape') closeLightbox();
    if (event.key === 'ArrowLeft') showGalleryImage(activeGalleryIndex - 1);
    if (event.key === 'ArrowRight') showGalleryImage(activeGalleryIndex + 1);
  }
});

/* ------------------------------------------------------------------ *
 * 10. Boot
 * ------------------------------------------------------------------ */
setupLoader();
buildPetals();
loadInvitation();
loadWishes().then(function () {
  /* messages changed the height of the wall, so re-measure the triggers */
  if (window.AOS) window.AOS.refresh();
});
updatePaxState();
rsvpIsValid();

/* the wishes wall can grow while the page is open */
if (STORE) {
  window.setTimeout(function () { loadWishes(); }, 30000);
}
