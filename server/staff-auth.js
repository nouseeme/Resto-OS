import { createClient } from '@supabase/supabase-js';
import { assert } from './store.js';

// Never share a password-sign-in client with the privileged database client.
function authClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}

export function isStaff(user) {
  return Boolean(user?.email && user.email_confirmed_at &&
    (!user.banned_until || Date.parse(user.banned_until) <= Date.now()));
}

export async function authenticateStaff(email, password, client = authClient()) {
  assert(typeof email === 'string' && email.length <= 254 && typeof password === 'string' && password.length > 0 && password.length <= 200, 'Email atau kata sandi salah.', 401);
  const { data, error } = await client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  assert(!error && isStaff(data?.user), 'Email atau kata sandi salah, atau akun belum dikonfirmasi.', 401);
  return { ...staffProfile(data.user), realtime: { accessToken: data.session.access_token, refreshToken: data.session.refresh_token, expiresAt: data.session.expires_at } };
}

export function staffProfile(user) {
  return { id: user.id, authUserId: user.id, username: user.email.toLowerCase(),
    name: String(user.user_metadata?.name || user.email.split('@')[0]).slice(0, 60) };
}

export async function staffStillAllowed(userId, client = authClient()) {
  const { data, error } = await client.auth.admin.getUserById(userId);
  if (error && error.status !== 404 && error.status !== 403) throw Object.assign(new Error('Validasi akun sementara tidak tersedia.'), { status: 503 });
  return !error && isStaff(data?.user);
}

export async function createStaff({ name, email, password }, save, client = authClient()) {
  assert(typeof name === 'string' && name.trim().length >= 2 && name.length <= 60, 'Nama staf harus 2–60 karakter.');
  assert(typeof email === 'string' && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()), 'Masukkan email yang valid.');
  assert(typeof password === 'string' && password.length >= 10 && password.length <= 200, 'Kata sandi minimal 10 karakter.');
  const { data, error } = await client.auth.admin.createUser({
    email: email.trim().toLowerCase(), password, email_confirm: true, user_metadata: { name: name.trim() }
  });
  assert(!error && data?.user, 'Akun tidak dapat dibuat. Periksa email, kata sandi, atau apakah email sudah digunakan.', 400);
  try {
    await save(staffProfile(data.user));
  } catch (error) {
    const cleanup = await client.auth.admin.deleteUser(data.user.id);
    if (cleanup.error) throw Object.assign(new Error('Penyimpanan akun gagal. Periksa akun tersebut di Supabase sebelum mencoba lagi.'), { status: 503 });
    throw error;
  }
}
