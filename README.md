# Trevor &amp; Marijomich — Wedding Invitation

A personalised online wedding invitation. Every guest receives their own link,
sees their own name, and can confirm attendance. Everything they send is
stored in **Supabase** and read back through the **admin page** — there is no
spreadsheet and no second service to maintain.

The layout follows the original floral cover: an opening envelope, the story,
save the date, location, details, gallery, entourage, the message wall, RSVP
and closing.

---

## Folder map

```
trevor-and-marijomich/
├── index.html                 the invitation guests see
├── styles.css                 all styling
├── script.js                  page behaviour
├── css/aos.css                scroll-triggered animation effects
├── js/aos.js                  the engine that triggers them
├── admin.html                 the manager — invitations, replies, messages
├── admin.js                   admin behaviour
├── 404.html                   lets /invite/<token> work on GitHub Pages
├── .gitignore
├── .nojekyll
├── js/
│   ├── config.js              >>> PASTE YOUR SUPABASE KEYS HERE <<<
│   ├── aos.js                 animation engine
│   └── store.js               data layer (Supabase, or browser preview mode)
├── supabase/
│   └── schema.sql             tables + security rules
└── assets/
    ├── images/                all photos and illustrations
    └── fonts/                 script.woff, cover-script.woff, sans.woff
```

**Live site:** <https://renelgallardo-a11y.github.io/trevor-and-marijomich/>
**Admin page:** <https://renelgallardo-a11y.github.io/trevor-and-marijomich/admin.html>

---

## One backend, one place to look

| What a guest does | Where it lands | Where you read it |
| --- | --- | --- |
| opens their personal link | `invitations` | Admin → Invitations |
| confirms or declines | `rsvps` | Admin → RSVPs |
| writes a message | `wishes` | Admin → Wishes |

The admin page also has a **Download CSV** button on the RSVPs tab if you ever
want a copy outside the browser.

---

## It works right now, before any setup

Open `index.html` in a browser. With no keys in `js/config.js` the site runs in
**preview mode**: invitations, wishes and replies are kept in the browser's
local storage, so you can click through everything, create test links and try
the RSVP form. Nothing is shared between devices yet.

Once you add the Supabase keys, the same code switches to the shared database
automatically. No other file needs to change.

---

## Step 1 — Connect Supabase (the only setup step)

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
   email and a password. This is the account you use on the admin page.
5. **Project Settings → API** and copy:
   * **Project URL** → `supabaseUrl`
   * **anon public** key → `supabaseAnonKey`

   Paste both into `js/config.js`:
   ```js
   supabaseUrl: 'https://xxxxxxxxxxxx.supabase.co',
   supabaseAnonKey: 'eyJhbGciOi...',
   ```

> Never paste the `service_role` key into this project. It bypasses every
> security rule and must stay on a server. The `anon` key is designed to be
> public — the RLS rules in `schema.sql` are what protect the guest data.

Commit and push afterwards, and the live site picks it up.

---

## Optional extras in `js/config.js`

| Setting | What it does |
| --- | --- |
| `musicAudioSrc` | Background music from a file, e.g. `assets/audio/song.mp3` |
| `musicVideoId` | Or use a YouTube id instead; the music button then appears |
| `wedding.*` | Names, date, venue and the default number of reserved seats |

The music button stays hidden until one of the music settings is filled in.

---

## The admin page

`admin.html` lets you:

* create a personal link for each guest, with the number of seats reserved
* copy, rename, change the seats, revoke, restore or delete any link
* read every RSVP, with a running head count and a CSV download
* delete any message from the wishes wall

Guest links look like:

```
https://renelgallardo-a11y.github.io/trevor-and-marijomich/invite/a1b2c3d4
```

Guests who open one see their own name on the welcome screen, in the RSVP form
(the field is locked so it always matches the guest list), and in the note
about their reserved seats. They can still choose a higher number of pax if
they are bringing extra guests.

Anyone opening the site without a link sees the generic version.

While Supabase is not connected yet, the admin page accepts any email plus the
passcode in `localAdminPasscode`. **Change that passcode.** It is only a
placeholder lock for the preview — once Supabase is connected a real
authenticated account is used instead and this value is ignored.

---

## How it is put together

* **Responsive** and tested on desktop and mobile.
* **No build step and no framework** — plain HTML, CSS and JavaScript.
* **No third-party libraries** — the scroll animations, lightbox, petals and
  loading bar are all written from scratch, so nothing can fail to load.
* **Reduced motion** is respected throughout.
