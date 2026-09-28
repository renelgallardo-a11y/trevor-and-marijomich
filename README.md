# Trevor &amp; Marijomich — Wedding Invitation

A personalised online wedding invitation. Every guest receives their own link,
sees their own name, and can confirm attendance. Messages posted by guests appear
on the shared wishes wall, and every reply is written to a Google Sheet.

The layout and the flow of the page follow the Joshua &amp; Alpha invitation
(welcome screen → story → save the date → details → gallery → entourage →
wishes → RSVP → closing). All photos, illustrations, colours and fonts are
Trevor &amp; Marijomich's.

---

## Folder map

```
Trevor-Marijomich-Wedding/
├── index.html                 the invitation guests see
├── styles.css                 all styling
├── script.js                  page behaviour
├── css/aos.css                scroll-triggered animation effects
├── js/aos.js                  the engine that triggers them
├── admin.html                 invitation manager
├── admin.js                   admin behaviour
├── 404.html                   lets /invite/<token> work on GitHub Pages
├── .nojekyll
├── rsvp-apps-script.gs        Google Apps Script that writes RSVPs to a Sheet
├── js/
│   ├── config.js              >>> PASTE YOUR KEYS HERE <<<
│   ├── aos.js                 animation engine
│   └── store.js               data layer (Supabase, or browser preview mode)
├── supabase/
│   └── schema.sql             tables + security rules
└── assets/
    ├── images/                all photos and illustrations
    └── fonts/                 script.woff, cover-script.woff, sans.woff
```

---

## It works right now, before any setup

Open `index.html` in a browser. With no keys in `js/config.js` the site runs in
**preview mode**: invitations, wishes and replies are kept in the browser's
local storage, so you can click through everything, create test links and try
the RSVP form. Nothing is shared between devices yet.

Once you add the Supabase keys, the same code switches to the shared database
automatically. No other file needs to change.

---

## Step 1 — Connect Supabase (wishes, invitations, RSVP list)

1. Create a free project at <https://supabase.com>.
2. Open **SQL Editor → New query**, paste the whole of `supabase/schema.sql`
   and press **Run**.
3. In that file, replace `YOUR-EMAIL-HERE` in the `admins` table with your own
   email address, then re-run just that statement:
   ```sql
   insert into public.admins (email) values ('you@example.com')
   on conflict (email) do nothing;
   ```
4. **Authentication → Users → Add user** and create an account with that same
   email and a password. This is the account for the admin page.
5. **Project Settings → API** and copy:
   * **Project URL** → `supabaseUrl`
   * **anon public** key → `supabaseAnonKey`

   Paste both into `js/config.js`:
   ```js
   supabaseUrl: 'https://xxxxxxxxxxxx.supabase.co',
   supabaseAnonKey: 'eyJhbGciOi...',
   ```

> Never paste the `service_role` key into this project. It bypasses every
> security rule and must stay on a server.

---

## Step 2 — Send RSVPs to a Google Sheet

Google Docs cannot collect form replies by itself, so a small Apps Script adds
one row per reply.

1. Create a Google Sheet, for example **Wedding RSVPs**.
2. **Extensions → Apps Script**, delete the sample code, paste everything from
   `rsvp-apps-script.gs`, press **Save**.
3. **Deploy → New deployment**
   * Type: **Web app**
   * Execute as: **Me**
   * Who has access: **Anyone**
4. Copy the Web app URL (it ends in `/exec`) and paste it into `js/config.js`:
   ```js
   googleAppsScriptUrl: 'https://script.google.com/macros/s/AKfy.../exec',
   ```
5. Test it: open that `/exec` URL in a browser — it should say `Ready`.
   Submit the RSVP form on the site and a new row appears in the sheet.

The sheet gets the columns: Replied, Name, Email, Attending, Number of Pax,
Dietary Notes, Message, Invitation Token.

Replies are **also** saved in Supabase, so the admin page can list and export
them even if the Sheet is unavailable.

---

## Step 3 — Optional extras in `js/config.js`

| Setting | What it does |
| --- | --- |
| `musicAudioSrc` | Background music from a file, e.g. `assets/audio/song.mp3` |
| `musicVideoId` | Or use a YouTube id instead; the music button then appears |
| `wedding.*` | Names, date, venue and the default number of reserved seats |

The music button stays hidden until one of the music settings is filled in.

---

## Step 4 — Publish on GitHub Pages

1. Create a GitHub repository and upload this whole folder.
2. **Settings → Pages → Source: Deploy from a branch**, choose `main` and
   `/ (root)`, then save.
3. The site is published at `https://<user>.github.io/<repo>/`.
4. The admin page is at `https://<user>.github.io/<repo>/admin.html`.

`404.html` is what makes the pretty guest links work. GitHub Pages has no URL
rewriting, so `/invite/a1b2c3d4` is caught by the 404 page, which forwards the
token to `index.html`. Because of this, the first load of a guest link goes
through one quick redirect — that is expected and invisible to the guest.

---

## Page flow

```
1.  Envelope welcome screen  (greeting, envelope, "Click to Open...")
2.  Hero                     Trevor & Marijomich · 04 . 01 . 2027
3.  Story                    the invitation and both families
4.  Save the Date            date, time and live countdown
5.  Location                 venue photograph, address and map
6.  The Details              dresscode and colour motif
7.  Gallery                  15 photos, tap to enlarge
8.  Entourage                family, sponsors and the wedding party
9.  Wishes                   the message wall
10. Wishes & RSVP            reply form
11. Closing                  with love
```

## Seamless scrolling

The drifting feel of the Joshua & Alpha invitation is reproduced with three
things, all in `styles.css`:

1. `scroll-behavior: smooth` on `<html>`.
2. The big photo backgrounds are **pinned** with
   `background-attachment: fixed` on screens 768px and wider, so the photo
   stays still on screen while its content scrolls past.
3. Every photo **fades at its top and bottom edge** into one shared tone, so a
   pinned background arrives and leaves softly instead of snapping against the
   next section.

Pinning is limited to desktop on purpose — mobile browsers ignore it and iOS
scrolls poorly with it, so phones get the soft fades only.

Two values at the top of that block let you retune it:

```css
--seam: #2f3a26;   /* the colour the backgrounds melt into  */
--seam-fade: 11%;  /* longer = softer transition            */
```

## Animations

The page animates its content in as you scroll, in the same style as the
reference invitation. It is built from two small files of our own, so nothing
is downloaded from a third party and everything still works offline:

| File | What it does |
| --- | --- |
| `css/aos.css` | the animation effects |
| `js/aos.js` | watches the page and triggers them |

### Applying an animation

Add `data-aos` with an effect name to any element:

```html
<h2 data-aos="zoom-out-down">Location</h2>

<div data-aos="zoom-in"
     data-aos-delay="200"
     data-aos-easing="ease-out-back"> ... </div>
```

### Effects

| Group | Names |
| --- | --- |
| zoom in (grows into place) | `zoom-in`, `zoom-in-up`, `zoom-in-down`, `zoom-in-left`, `zoom-in-right` |
| zoom out (shrinks into place) | `zoom-out`, `zoom-out-up`, `zoom-out-down`, `zoom-out-left`, `zoom-out-right` |
| fade | `fade`, `fade-up`, `fade-down`, `fade-left`, `fade-right` |
| slide | `slide-up`, `slide-down`, `slide-left`, `slide-right` |
| flip (3D) | `flip-up`, `flip-down`, `flip-left`, `flip-right` |

### Options

| Attribute | Default | Meaning |
| --- | --- | --- |
| `data-aos-delay` | `0` | milliseconds to wait before animating |
| `data-aos-duration` | `1200` | how long the animation takes |
| `data-aos-offset` | `120` | how far past the edge the element must travel |
| `data-aos-once` | `false` | `true` animates once and stays; `false` replays |
| `data-aos-easing` | `ease-in-out-cubic` | any name listed in `css/aos.css` |

### Replaying

By default an element animates in, and the class is **removed again as it
leaves the viewport**. Scrolling back up therefore replays the entrance
instead of leaving the element frozen in its final state. So on every pass
down the page each section reanimates.

If you would rather a heading animated only the first time, add
`data-aos-once="true"` to it:

```html
<h2 data-aos="zoom-out-down" data-aos-once="true">Location</h2>
```

Staggering delays is what makes a group feel choreographed — for example the
four countdown boxes use 0, 100, 200 and 300 ms so they arrive in sequence.

### The envelope opening

The welcome screen is not scroll-triggered, so it uses timed transitions
instead. It follows the original floral cover: a pale washed background and a
large envelope ringed with the florals. Top to bottom it reads:

1. **Dear,** and the guest's own name, with their reserved seats
2. the envelope
3. **"Join us for a Special Celebration"** in outlined olive script
4. **"Click to Open..."** just beneath it

Three things open the invitation, all of them real buttons for keyboard and
screen-reader users:

* the envelope itself
* the "Click to Open..." line
* the `Esc` key (clicking the backdrop also works)

The entrance builds in that same order — greeting, envelope, script, then the
call to action — using the `--in-delay` custom property on each element in
`index.html`.

The opening runs in order, each piece on its own delay:

| Time | What happens |
| --- | --- |
| 0 – 450 ms | the wax seal lifts off and fades |
| 170 – 810 ms | the flap hinges upward and folds back |
| 420 – 1080 ms | the cream card rises out of the envelope |
| 420 – 1200 ms | the florals scatter in different directions |
| 760 – 1660 ms | the envelope and card float away |
| 900 – 1520 ms | the whole screen fades |

The flap is not a separate image. The envelope artwork is cut into two
matching halves with `clip-path` — the body keeps everything except the flap
triangle, and the flap is the same artwork clipped to the triangle, hinged on
its top edge. That is what lets it swing open and show a real V-shaped
opening rather than a ghost of the closed flap. The `--flap` value on
`.welcome__env` (default `62%`) is where the flap meets the body; change it if
you ever swap the envelope image.

To retune the pacing, change the `transition-delay` values on the
`.welcome.is-opening ...` rules in `styles.css`.

### Also included

* **Loading bar** — a hairline that fills as the photos download.
* **Drifting blossoms** — petals generated in `script.js`, sized to the screen,
  each with its own speed, sway, spin and tint. Disable it by deleting the
  `<div class="petal-field">` line from `index.html`.
* **Welcome screen** — timed keyframes (not scroll triggered) build the
  envelope, seal, name and button in sequence. The seal breathes gently and
  lifts away when the invitation is opened.
* **Countdown** — the numbers tick up and over instead of silently changing.
* **Gallery** — each photo animates in with a stagger; the lightbox fades and
  zooms the picture into place.
* **Reduced motion** — anyone whose system asks for less motion gets every
  element in its final state immediately, and the petals are switched off.


`admin.html` lets you:

* create a personal link for each guest, with the number of seats reserved
* copy, rename, change the seats, revoke, restore or delete any link
* read every RSVP, with a running head count and a CSV download
* delete any message from the wishes wall

Guest links look like:

```
https://<user>.github.io/<repo>/invite/a1b2c3d4
```

Guests who open one see their own name on the welcome screen, in the RSVP form
(the field is locked so it always matches the guest list), and in the note
about their reserved seats. They can still choose a higher number of pax if
they are bringing extra guests.

Anyone opening the site without a link sees the generic version.

---

## Notes

* Wishes start **empty** — nothing is pre-filled, so every message on the wall
  comes from a real guest.
* The site is responsive and works on desktop and mobile.
* Reduced-motion preferences are respected.
* There is no build step and no framework: it is plain HTML, CSS and JavaScript.
