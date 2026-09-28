/* ==========================================================================
   store.js — data layer for the Trevor & Marijomich invitation
   --------------------------------------------------------------------------
   Everything the site needs to read or write goes through this file:

     • invitations  (who each personal link belongs to)
     • wishes       (the message wall)
     • rsvps        (attendance replies)

   It has two backends and picks one automatically:

     1. "supabase"  — used as soon as js/config.js has a supabaseUrl and a
                      supabaseAnonKey. This is the real, shared database.
     2. "local"     — used while those are still blank. Data is kept in the
                      browser's localStorage so you can try every screen and
                      form right now. Nothing is shared between devices.

   Because both backends expose exactly the same functions, the pages never
   need to know which one is active.
   ========================================================================== */

(function () {
  'use strict';

  const config = window.SITE_CONFIG || {};
  const LS = {
    invitations: 'tm.invitations',
    wishes: 'tm.wishes',
    rsvps: 'tm.rsvps',
    session: 'tm.admin.session'
  };

  const isSupabaseConfigured = Boolean(config.supabaseUrl && config.supabaseAnonKey);

  let client = null;
  let clientPromise = null;

  /* ------------------------------------------------------------------ *
   * Small localStorage helpers (used by the "local" backend and as a
   * write-through cache so a page reload never loses pending items).
   * ------------------------------------------------------------------ */
  function readLocal(key) {
    try {
      const value = JSON.parse(window.localStorage.getItem(key) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (error) {
      return [];
    }
  }

  function writeLocal(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      /* private mode / quota — the page keeps working in memory only */
    }
  }

  function uid() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  /* Short, readable, hard to guess: used for the /invite/<token> part. */
  function makeToken() {
    const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
    const bytes = new Uint8Array(8);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
    }
    let out = '';
    for (let i = 0; i < bytes.length; i += 1) out += alphabet[bytes[i] % alphabet.length];
    return out;
  }

  function nowISO() {
    return new Date().toISOString();
  }

  /* ------------------------------------------------------------------ *
   * Supabase client — loaded on demand from the official CDN so the site
   * works offline / before any credentials are added.
   * ------------------------------------------------------------------ */
  const SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';

  function loadSupabase() {
    if (client) return Promise.resolve(client);
    if (clientPromise) return clientPromise;

    clientPromise = new Promise((resolve, reject) => {
      if (window.supabase && window.supabase.createClient) {
        client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
        resolve(client);
        return;
      }
      const script = document.createElement('script');
      script.src = SUPABASE_CDN;
      script.async = true;
      script.onload = () => {
        if (!window.supabase) {
          reject(new Error('The Supabase library could not be loaded.'));
          return;
        }
        client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
        resolve(client);
      };
      script.onerror = () => reject(new Error('The Supabase library could not be loaded. Check your connection.'));
      document.head.appendChild(script);
    });

    return clientPromise;
  }

  function unwrap(result) {
    if (!result) return null;
    if (result.error) throw result.error;
    return result.data;
  }

  /* ------------------------------------------------------------------ *
   * Row mapping — database snake_case <-> the camelCase the pages use
   * ------------------------------------------------------------------ */
  const fromInvitationRow = (row) => ({
    id: row.id,
    token: row.token,
    name: row.name,
    seats: row.seats == null ? (config.wedding.defaultSeats || 2) : row.seats,
    note: row.note || '',
    active: row.active !== false,
    createdAt: row.created_at
  });

  const fromWishRow = (row) => ({
    id: row.id,
    name: row.name,
    message: row.message,
    token: row.token || '',
    approved: row.is_approved !== false,
    createdAt: row.created_at
  });

  const fromRsvpRow = (row) => ({
    id: row.id,
    name: row.name,
    email: row.email || '',
    attendance: row.attendance,
    pax: row.pax == null ? 0 : row.pax,
    dietary: row.dietary || '',
    message: row.message || '',
    token: row.token || '',
    createdAt: row.created_at
  });

  /* ================================================================== *
   * PUBLIC API
   * ================================================================== */
  const store = {
    mode: isSupabaseConfigured ? 'supabase' : 'local',
    isSupabaseConfigured: isSupabaseConfigured,

    /* ---------------- invitations ---------------- */

    async getInvitation(token) {
      if (!token) return null;

      if (store.mode === 'supabase') {
        await loadSupabase();
        const data = unwrap(await client
          .from('invitations')
          .select('*')
          .eq('token', token)
          .maybeSingle());
        return data ? fromInvitationRow(data) : null;
      }

      const match = readLocal(LS.invitations).find((item) => item.token === token);
      return match || null;
    },

    async listInvitations() {
      if (store.mode === 'supabase') {
        await loadSupabase();
        const data = unwrap(await client
          .from('invitations')
          .select('*')
          .order('created_at', { ascending: false }));
        return (data || []).map(fromInvitationRow);
      }

      return readLocal(LS.invitations).slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    },

    async createInvitation({ name, seats, note }) {
      const cleanName = String(name || '').trim();
      if (!cleanName) throw new Error('Please enter the invited person’s name.');

      const seatsValue = Number(seats);
      const safeSeats = Number.isFinite(seatsValue) && seatsValue > 0
        ? Math.min(Math.round(seatsValue), 20)
        : (config.wedding.defaultSeats || 2);
      const cleanNote = String(note || '').trim();

      if (store.mode === 'supabase') {
        await loadSupabase();
        let token = makeToken();
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const clash = unwrap(await client.from('invitations').select('token').eq('token', token).maybeSingle());
          if (!clash) break;
          token = makeToken();
        }
        const data = unwrap(await client
          .from('invitations')
          .insert({ token, name: cleanName, seats: safeSeats, note: cleanNote, active: true })
          .select()
          .single());
        return fromInvitationRow(data);
      }

      const list = readLocal(LS.invitations);
      let token = makeToken();
      while (list.some((item) => item.token === token)) token = makeToken();
      const record = {
        id: uid(),
        token,
        name: cleanName,
        seats: safeSeats,
        note: cleanNote,
        active: true,
        createdAt: nowISO()
      };
      list.push(record);
      writeLocal(LS.invitations, list);
      return record;
    },

    async updateInvitation(token, patch) {
      const changes = {};
      if (typeof patch.name === 'string' && patch.name.trim()) changes.name = patch.name.trim();
      if (patch.seats != null) changes.seats = Number(patch.seats);
      if (typeof patch.note === 'string') changes.note = patch.note.trim();
      if (patch.active != null) changes.active = Boolean(patch.active);
      if (!Object.keys(changes).length) throw new Error('Nothing to update.');

      if (store.mode === 'supabase') {
        await loadSupabase();
        const data = unwrap(await client
          .from('invitations')
          .update(changes)
          .eq('token', token)
          .select()
          .single());
        return fromInvitationRow(data);
      }

      const list = readLocal(LS.invitations);
      const index = list.findIndex((item) => item.token === token);
      if (index === -1) throw new Error('Invitation not found.');
      list[index] = Object.assign({}, list[index], changes);
      writeLocal(LS.invitations, list);
      return list[index];
    },

    async revokeInvitation(token) {
      return store.updateInvitation(token, { active: false });
    },

    async restoreInvitation(token) {
      return store.updateInvitation(token, { active: true });
    },

    async deleteInvitation(token) {
      if (store.mode === 'supabase') {
        await loadSupabase();
        unwrap(await client.from('invitations').delete().eq('token', token));
        return;
      }
      writeLocal(LS.invitations, readLocal(LS.invitations).filter((item) => item.token !== token));
    },

    /* ---------------- wishes ---------------- */

    async listWishes() {
      if (store.mode === 'supabase') {
        await loadSupabase();
        const data = unwrap(await client
          .from('wishes')
          .select('*')
          .order('created_at', { ascending: false }));
        return (data || []).map(fromWishRow);
      }

      return readLocal(LS.wishes).slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    },

    async addWish({ name, message, token }) {
      const cleanName = String(name || '').trim() || 'A guest';
      const cleanMessage = String(message || '').trim();
      if (!cleanMessage) throw new Error('Please write a short message first.');

      if (store.mode === 'supabase') {
        await loadSupabase();
        const data = unwrap(await client
          .from('wishes')
          .insert({
            name: cleanName,
            message: cleanMessage,
            token: token || null,
            is_approved: true
          })
          .select()
          .single());
        return fromWishRow(data);
      }

      const list = readLocal(LS.wishes);
      const record = { id: uid(), name: cleanName, message: cleanMessage, token: token || '', approved: true, createdAt: nowISO() };
      list.push(record);
      writeLocal(LS.wishes, list);
      return record;
    },

    async deleteWish(id) {
      if (store.mode === 'supabase') {
        await loadSupabase();
        unwrap(await client.from('wishes').delete().eq('id', id));
        return;
      }
      writeLocal(LS.wishes, readLocal(LS.wishes).filter((item) => item.id !== id));
    },

    /* ---------------- rsvps ---------------- */

    async listRsvps() {
      if (store.mode === 'supabase') {
        await loadSupabase();
        const data = unwrap(await client
          .from('rsvps')
          .select('*')
          .order('created_at', { ascending: false }));
        return (data || []).map(fromRsvpRow);
      }

      return readLocal(LS.rsvps).slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    },

    async addRsvp(record) {
      if (store.mode === 'supabase') {
        await loadSupabase();
        const data = unwrap(await client
          .from('rsvps')
          .insert({
            name: record.name,
            email: record.email || null,
            attendance: record.attendance,
            pax: record.attendance === 'Yes' ? Number(record.pax) || 1 : 0,
            dietary: record.dietary || null,
            message: record.message || null,
            token: record.token || null
          })
          .select()
          .single());
        return fromRsvpRow(data);
      }

      const list = readLocal(LS.rsvps);
      const saved = {
        id: uid(),
        name: record.name,
        email: record.email || '',
        attendance: record.attendance,
        pax: record.attendance === 'Yes' ? Number(record.pax) || 1 : 0,
        dietary: record.dietary || '',
        message: record.message || '',
        token: record.token || '',
        createdAt: nowISO()
      };
      list.push(saved);
      writeLocal(LS.rsvps, list);
      return saved;
    },

    /* ---------------- admin authentication ---------------- */

    async currentUser() {
      if (store.mode === 'supabase') {
        await loadSupabase();
        const { data } = await client.auth.getSession();
        return data && data.session ? data.session.user : null;
      }
      try {
        return window.sessionStorage.getItem(LS.session) ? { email: 'local-admin' } : null;
      } catch (error) {
        return null;
      }
    },

    async signIn(email, password) {
      if (store.mode === 'supabase') {
        await loadSupabase();
        const data = unwrap(await client.auth.signInWithPassword({ email, password }));
        if (!data || !data.user) throw new Error('Sign in failed.');
        return data.user;
      }

      if (password !== config.localAdminPasscode) {
        throw new Error('That passcode is not correct.');
      }
      try {
        window.sessionStorage.setItem(LS.session, '1');
      } catch (error) { /* ignore */ }
      return { email: email || 'local-admin' };
    },

    async signOut() {
      if (store.mode === 'supabase') {
        await loadSupabase();
        await client.auth.signOut();
        return;
      }
      try {
        window.sessionStorage.removeItem(LS.session);
      } catch (error) { /* ignore */ }
    },

    onAuthChange(callback) {
      if (store.mode !== 'supabase') {
        callback(null);
        return;
      }
      loadSupabase().then(() => {
        client.auth.onAuthStateChange((_event, session) => {
          callback(session ? session.user : null);
        });
      }).catch(() => callback(null));
    }
  };

  /* ---------------- link helpers ---------------- */

  store.inviteUrl = function (token) {
    const base = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
    return base + 'invite/' + token;
  };

  /* Accepts /invite/<token>, ?token=.., ?to=.. and #<token> so the links
     keep working on GitHub Pages, on a custom domain and in local previews. */
  store.tokenFromLocation = function (href) {
    const url = new URL(href || window.location.href);

    const pathMatch = url.pathname.match(/\/invite\/([A-Za-z0-9_-]+)\/?$/);
    if (pathMatch) return decodeURIComponent(pathMatch[1]);

    const params = url.searchParams;
    const fromQuery = params.get('token') || params.get('to') || params.get('guest');
    if (fromQuery) return fromQuery;

    const hash = (url.hash || '').replace(/^#/, '').trim();
    if (hash && /^[A-Za-z0-9_-]+$/.test(hash)) return hash;

    return '';
  };

  window.WeddingStore = store;
}());
