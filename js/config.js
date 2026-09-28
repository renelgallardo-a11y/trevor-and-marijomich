/* ==========================================================================
   SITE CONFIG  —  Trevor & Marijomich wedding invitation
   --------------------------------------------------------------------------
   THIS IS THE ONLY FILE YOU NEED TO EDIT TO GO LIVE.
   Fill in the three blank values below, then upload the site to GitHub Pages.
   ========================================================================== */

window.SITE_CONFIG = {

  /* ----------------------------------------------------------------------
     1) SUPABASE  —  powers the guest list, the wishes wall and the RSVP list
     ----------------------------------------------------------------------
     How to fill this in:
       a. Go to https://supabase.com and create a free project.
       b. Open  Project Settings  ->  API.
       c. Copy the "Project URL" into supabaseUrl.
       d. Copy the "anon public" key into supabaseAnonKey.
          (NEVER paste the service_role key here. It must stay secret.)

     While these two values are empty the site still works: everything is
     stored in the visitor's own browser so you can test the whole flow.
     ---------------------------------------------------------------------- */
  supabaseUrl: '',
  supabaseAnonKey: '',

  /* ----------------------------------------------------------------------
     2) GOOGLE SHEET / DOCS  —  where each RSVP is written
     ----------------------------------------------------------------------
     Google Docs cannot receive form replies, so an Apps Script web app is
     used to append a row to a Google Sheet.

     How to fill this in:
       a. Create a Google Sheet named e.g. "Wedding RSVPs".
       b. Extensions -> Apps Script -> paste the code from
          rsvp-apps-script.gs (in this folder) -> Save.
       c. Deploy -> New deployment -> type "Web app".
          Execute as: Me     |     Who has access: Anyone
       d. Copy the /exec URL and paste it into googleAppsScriptUrl below.
          It looks like: https://script.google.com/macros/s/AKfy.../exec

     Leave it empty and RSVPs are stored in Supabase only
     (and still show up in the admin page).
     ---------------------------------------------------------------------- */
  googleAppsScriptUrl: '',

  /* ----------------------------------------------------------------------
     3) OPTIONAL EXTRAS
     ---------------------------------------------------------------------- */

  /* Background music.
     Either drop an .mp3 into assets/audio/ and point to it here,
     or paste a YouTube video id and it will play in a hidden player.
     The music button stays hidden until one of these is filled in. */
  musicAudioSrc: '',
  musicVideoId: '',

  /* Admin page fallback password.
     This is ONLY used while Supabase is not connected, so the admin page
     can still be opened on a static host. Change it, and once Supabase is
     connected this value is ignored. */
  localAdminPasscode: 'change-me',

  /* ----------------------------------------------------------------------
     4) WEDDING DETAILS
     Edit these if any detail changes. Most of them are also written
     directly in index.html — this block feeds the countdown and calendar.
     ---------------------------------------------------------------------- */
  wedding: {
    groom: 'Trevor George White',
    bride: 'Marijomich Denniece Torres',
    /* 4:00 PM Philippine time on 4 January 2027 */
    startISO: '2027-01-04T16:00:00+08:00',
    endISO: '2027-01-04T22:00:00+08:00',
    venue: 'Hacienda Solange Indang',
    venueLine2: '@ EMV Flower Farm',
    mapsQuery: 'Hacienda Solange Indang EMV Flower Farm',
    /* Seats reserved per guest, used on the welcome screen and the RSVP form */
    defaultSeats: 2
  }
};
