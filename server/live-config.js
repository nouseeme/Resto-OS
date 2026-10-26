import { assertLiveAccess } from './demo-mode.js';
import { createClient } from '@supabase/supabase-js';

export async function liveConfig(req, store) {
  assertLiveAccess();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return { mode: 'fallback' };
  if (!req.staff) return { mode: 'supabase', url, key, topic: 'resto:catalog' };
  let credentials = req.staffSession?.realtime;
  // Sessions created before this rollout remain valid with lightweight checks.
  if (!credentials) return { mode: 'fallback' };
  if (credentials.expiresAt * 1000 < Date.now() + 90000) {
    const auth = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await auth.auth.refreshSession({ refresh_token: credentials.refreshToken });
    if (error || !data.session) return { mode: 'fallback' };
    credentials = { accessToken: data.session.access_token, refreshToken: data.session.refresh_token, expiresAt: data.session.expires_at };
    await store.transaction(s => {
      const session = s.sessions.find(x => x.token === req.staffSession.token && Date.parse(x.expiresAt) > Date.now());
      if (session) session.realtime = credentials;
    });
  }
  return { mode: 'supabase', url, key, topic: 'resto:staff', accessToken: credentials.accessToken, expiresAt: credentials.expiresAt };
}
