import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { supabaseAdmin, supabaseClient } from '../lib/supabaseAdmin.js';

export function createAuthRouter({ database, cookieOptions, sessionCookie, initializeUserData }) {
  const router = Router();

  const signupLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 3,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many signup attempts. Please try again in a minute.' },
  });

  const signinLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many signin attempts. Please try again in a minute.' },
  });

  const resetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many password reset requests. Please try again later.' },
  });

  function csrfProtection(request, response, next) {
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
      const origin = request.get('origin');
      const host = request.get('host');
      if (origin && host) {
        try {
          const originHost = new URL(origin).host;
          if (originHost !== host) {
            return response.status(403).json({ error: 'CSRF validation failed: Origin mismatch' });
          }
        } catch {
          return response.status(403).json({ error: 'CSRF validation failed: Invalid origin' });
        }
      }
    }
    return next();
  }

  router.use(csrfProtection);

  async function syncUserRecord(supabaseUser, extra = {}) {
    const supabaseUid = supabaseUser.id;
    const email = supabaseUser.email ?? '';
    const metadata = supabaseUser.user_metadata ?? {};
    const displayName = extra.displayName || metadata.full_name || metadata.name || email.split('@')[0] || 'Listener';
    const avatarUrl = extra.avatarUrl || metadata.avatar_url || null;
    const emailVerified = Boolean(supabaseUser.email_confirmed_at || supabaseUser.confirmed_at || extra.emailVerified);

    let userId = supabaseUid;
    const existingLegacy = await database.prepare(`
      SELECT id FROM users WHERE lower(email) = lower($1) AND legacy_auth = true
    `).get(email);

    if (existingLegacy) {
      userId = existingLegacy.id;
    }

    await database.transaction(async (tx) => {
      await tx.prepare(`
        INSERT INTO users (id, supabase_uid, email, display_name, avatar_url, email_verified, legacy_auth)
        VALUES ($1, $2, $3, $4, $5, $6, COALESCE((SELECT legacy_auth FROM users WHERE id = $1), false))
        ON CONFLICT (id) DO UPDATE SET
          supabase_uid = COALESCE(users.supabase_uid, EXCLUDED.supabase_uid),
          email = EXCLUDED.email,
          display_name = COALESCE(users.display_name, EXCLUDED.display_name),
          avatar_url = COALESCE(users.avatar_url, EXCLUDED.avatar_url),
          email_verified = EXCLUDED.email_verified
      `).run(userId, supabaseUid, email, displayName, avatarUrl, emailVerified);

      const existingData = await tx.prepare('SELECT 1 FROM dating_user_profiles WHERE user_id = $1').get(userId);
      if (!existingData) {
        await initializeUserData({ id: userId, email, displayName }, tx);
      }
    });

    return {
      id: userId,
      email,
      displayName,
      avatarUrl,
      emailVerified,
    };
  }

  async function createServerSession(response, userId, sessionData) {
    const sessionId = randomUUID();
    const refreshToken = sessionData.refresh_token;
    const expiresIn = sessionData.expires_in || 3600;
    const accessTokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    await database.prepare(`
      INSERT INTO sessions (id, user_id, refresh_token, access_token_expires_at, last_used_at)
      VALUES ($1, $2, $3, $4, NOW())
    `).run(sessionId, userId, refreshToken, accessTokenExpiresAt);

    response.cookie(sessionCookie, sessionId, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  router.post('/signup', signupLimiter, async (request, response) => {
    const { displayName, email, password } = request.body ?? {};
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (
      typeof displayName !== 'string' ||
      !displayName.trim() ||
      displayName.trim().length > 80 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
      normalizedEmail.length > 254 ||
      typeof password !== 'string' ||
      password.length < 8 ||
      password.length > 128
    ) {
      return response.status(400).json({
        error: 'Provide a name, valid email, and password between 8 and 128 characters',
      });
    }

    try {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: false,
        user_metadata: { full_name: displayName.trim() },
      });

      if (error) {
        if (error.message.includes('already registered') || error.status === 422) {
          return response.status(409).json({ error: 'An account with that email already exists' });
        }
        throw error;
      }

      const user = await syncUserRecord(data.user, { displayName: displayName.trim(), emailVerified: false });
      return response.status(201).json({ user, message: 'Check your email to verify your account.' });
    } catch (error) {
      console.error('Supabase signup failed:', error);
      return response.status(500).json({ error: error instanceof Error ? error.message : 'Could not create your account right now' });
    }
  });

  router.post('/signin', signinLimiter, async (request, response) => {
    const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : '';
    const password = typeof request.body?.password === 'string' ? request.body.password : '';
    if (!email || !password || email.length > 254 || password.length > 128) {
      return response.status(400).json({ error: 'Enter your email and password' });
    }

    try {
      // 1. Try Supabase Auth signin
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (!error && data.user && data.session) {
        const emailConfirmed = Boolean(data.user.email_confirmed_at || data.user.confirmed_at);
        if (!emailConfirmed) {
          return response.status(403).json({ error: 'email_not_verified', message: 'Please verify your email address before signing in.' });
        }
        const user = await syncUserRecord(data.user, { emailVerified: true });
        await createServerSession(response, user.id, data.session);
        return response.json({ user });
      }

      // 2. Blocker 1 Option A: Auto-migrate legacy user on first signin
      const legacyAccount = await database.prepare(`
        SELECT id, email, display_name AS "displayName", password_hash AS "passwordHash", email_verified AS "emailVerified"
        FROM users WHERE lower(email) = $1 AND legacy_auth = true AND deleted_at IS NULL
      `).get(email);

      const DUMMY_HASH = '$2b$10$' + 'x'.repeat(53);
      if (!legacyAccount) {
        await bcrypt.compare(password, DUMMY_HASH); // constant-time
        return response.status(401).json({ error: 'That email and password do not match' });
      }

      if (!legacyAccount.passwordHash || !(await bcrypt.compare(password, legacyAccount.passwordHash))) {
        return response.status(401).json({ error: 'That email and password do not match' });
      }

      if (!legacyAccount.emailVerified) {
        return response.status(403).json({ error: 'email_not_verified', message: 'Please verify your email address before signing in.' });
      }

      // Create Supabase user for legacy account migration
      let supabaseUid = legacyAccount.id;
      try {
        const created = await supabaseAdmin.auth.admin.createUser({
          email: legacyAccount.email,
          password,
          email_confirm: true,
          user_metadata: { full_name: legacyAccount.displayName },
        });
        if (!created.data?.user) {
          console.error('[auth] legacy migration: createUser returned no user', created.error);
          return response.status(500).json({ error: 'migration_failed' });
        }
        supabaseUid = created.data.user.id;
      } catch (err) {
        // Idempotent: if email already exists in Supabase, fetch the existing user
        if (err?.message?.includes('already') || err?.code === 'email_exists') {
          const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
          const match = existing?.users?.find(u => u.email?.toLowerCase() === email);
          if (match) {
            supabaseUid = match.id;
          } else {
            return response.status(500).json({ error: 'migration_failed' });
          }
        } else {
          console.error('[auth] legacy migration: createUser failed', err);
          return response.status(500).json({ error: 'migration_failed' });
        }
      }

      await database.prepare(
        'UPDATE users SET supabase_uid = $1, legacy_auth = false WHERE id = $2'
      ).run(supabaseUid, legacyAccount.id);

      const { data: signinData, error: signinError } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (signinError || !signinData.session) {
        return response.status(401).json({ error: 'That email and password do not match' });
      }

      const user = {
        id: legacyAccount.id,
        email: legacyAccount.email,
        displayName: legacyAccount.displayName,
        emailVerified: true,
      };
      await createServerSession(response, user.id, signinData.session);
      return response.json({ user });

      return response.status(401).json({ error: 'That email and password do not match' });
    } catch (error) {
      console.error('Sign-in failed:', error);
      return response.status(500).json({ error: 'Could not sign you in right now' });
    }
  });

  router.get('/signin/google', (_request, response) => {
    const redirectTo = `${process.env.CORS_ORIGIN || 'http://localhost:5173'}/auth/callback`;
    supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    }).then(({ data, error }) => {
      if (error || !data?.url) {
        return response.status(500).json({ error: 'Could not initiate Google sign in' });
      }
      return response.json({ url: data.url });
    }).catch((err) => {
      return response.status(500).json({ error: err.message });
    });
  });

  router.get('/signin/facebook', (_request, response) => {
    const redirectTo = `${process.env.CORS_ORIGIN || 'http://localhost:5173'}/auth/callback`;
    supabaseClient.auth.signInWithOAuth({
      provider: 'facebook',
      options: { redirectTo },
    }).then(({ data, error }) => {
      if (error || !data?.url) {
        return response.status(500).json({ error: 'Could not initiate Facebook sign in' });
      }
      return response.json({ url: data.url });
    }).catch((err) => {
      return response.status(500).json({ error: err.message });
    });
  });

  router.post('/callback', async (request, response) => {
    const { access_token } = request.body ?? {};
    if (!access_token) {
      return response.status(400).json({ error: 'Access token required' });
    }
    try {
      const { data, error } = await supabaseClient.auth.getUser(access_token);
      if (error || !data?.user) {
        return response.status(401).json({ error: 'Invalid or expired token' });
      }
      const user = await syncUserRecord(data.user, { emailVerified: true });
      
      // Get session tokens from exchange if present or generate session
      const sessionRes = await supabaseClient.auth.setSession({ access_token, refresh_token: request.body.refresh_token || '' });
      if (sessionRes.data?.session) {
        await createServerSession(response, user.id, sessionRes.data.session);
      } else {
        // Fallback session
        await createServerSession(response, user.id, { refresh_token: request.body.refresh_token || 'oauth-token', expires_in: 3600 });
      }

      return response.json({ user });
    } catch (error) {
      console.error('Auth callback failed:', error);
      return response.status(500).json({ error: 'Authentication exchange failed' });
    }
  });

  router.post('/signout', async (request, response) => {
    const sessionId = request.cookies[sessionCookie];
    if (sessionId) {
      await database.prepare('DELETE FROM sessions WHERE id = $1').run(sessionId);
    }
    response.clearCookie(sessionCookie, cookieOptions);
    response.status(204).end();
  });

  router.post('/verify-email', async (request, response) => {
    const { token_hash, type } = request.body ?? {};
    if (!token_hash) {
      return response.status(400).json({ error: 'Verification token required' });
    }
    try {
      const { data, error } = await supabaseClient.auth.verifyOtp({ token_hash, type: type || 'email' });
      if (error) return response.status(400).json({ error: error.message });
      if (data?.user) {
        await syncUserRecord(data.user, { emailVerified: true });
      }
      return response.json({ verified: true });
    } catch {
      return response.status(500).json({ error: 'Email verification failed' });
    }
  });

  router.post('/reset-password', resetLimiter, async (request, response) => {
    const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : '';
    if (!email) return response.status(400).json({ error: 'Email required' });
    try {
      const redirectTo = `${process.env.CORS_ORIGIN || 'http://localhost:5173'}/auth/reset-password`;
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) return response.status(400).json({ error: error.message });
      return response.json({ sent: true });
    } catch {
      return response.status(500).json({ error: 'Could not send password reset email' });
    }
  });

  return router;
}
