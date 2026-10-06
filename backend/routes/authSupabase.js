import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { supabaseAdmin, supabaseClient } from '../lib/supabaseAdmin.js';



import {
  sendWelcomeEmail,
  sendPasswordChangedEmail,
  checkAndSendNewDeviceEmail,
} from '../lib/emailService.js';

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
    keyGenerator: (request) => {
      const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : '';
      if (email) return `email:${email}`;
      return `ip:${ipKeyGenerator(request.ip)}`;
    },
    message: { error: 'Too many password reset requests. Please try again later.' },
  });

  const confirmResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many reset confirmation attempts. Please try again later.' },
  });

  const magicLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (request) => {
      const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : '';
      if (email) return `email:${email}`;
      return `ip:${ipKeyGenerator(request.ip)}`;
    },
    message: { error: 'Too many magic link requests. Please try again later.' },
  });

  const changePasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many password change attempts. Please try again later.' },
  });

  const verifyResendLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (request) => {
      const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : '';
      if (email) return `email:${email}`;
      return `ip:${ipKeyGenerator(request.ip)}`;
    },
    message: { error: 'Too many verification emails requested. Please try again later.' },
  });

  const verifyResendIpLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many verification emails requested. Please try again later.' },
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

  async function logAuthEvent(db, { userId, eventType, ip, userAgent, metadata }) {
    try {
      await db.prepare(`
        INSERT INTO auth_events (user_id, event_type, ip, user_agent, metadata)
        VALUES ($1, $2, $3, $4, $5)
      `).run(userId || null, eventType, ip || null, userAgent || null, metadata ? JSON.stringify(metadata) : null);
    } catch (err) {
      console.error('[auth] Failed to log auth event:', err);
    }
  }

  function parseUserAgent(ua) {
    if (!ua) return 'Unknown Device';
    if (ua.includes('Firefox')) return 'Firefox on Desktop';
    if (ua.includes('Chrome') && !ua.includes('Mobile')) return 'Chrome on Desktop';
    if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari on Apple Device';
    if (ua.includes('Mobile')) return 'Mobile Browser';
    return ua.substring(0, 50);
  }

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

    const dbUser = await database.prepare(`
      SELECT id, email, display_name AS "displayName", avatar_url AS "avatarUrl", bio, is_public AS "isPublic", email_verified AS "emailVerified", deleted_at AS "deletedAt", welcomed_at AS "welcomedAt"
      FROM users WHERE id = $1
    `).get(userId);

    const userObj = {
      id: dbUser.id,
      email: dbUser.email,
      displayName: dbUser.displayName,
      emailVerified: Boolean(dbUser.emailVerified),
      deletedAt: dbUser.deletedAt || null,
      avatarUrl: dbUser.avatarUrl || null,
      bio: dbUser.bio || null,
      isPublic: Boolean(dbUser.isPublic),
    };

    if (emailVerified && !dbUser.welcomedAt) {
      await sendWelcomeEmail(userObj).catch(() => {});
      await database.prepare('UPDATE users SET welcomed_at = NOW() WHERE id = $1').run(dbUser.id);
    }

    return userObj;
  }

  async function createServerSession(request, response, userId, sessionData) {
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

    const ip = request.ip || '127.0.0.1';
    const userAgent = request.get('user-agent');
    const acceptLanguage = request.get('accept-language');
    const userRecord = await database.prepare('SELECT id, email, display_name AS "displayName" FROM users WHERE id = $1').get(userId);
    if (userRecord) {
      await checkAndSendNewDeviceEmail(database, userRecord, { ip, userAgent, acceptLanguage });
      await logAuthEvent(database, {
        userId,
        eventType: 'signin',
        ip,
        userAgent,
      });
    }
  }

  router.get('/me', async (request, response) => {
    const sessionId = request.cookies[sessionCookie];
    if (!sessionId) {
      return response.status(401).json({ error: 'Please log in to continue' });
    }
    const session = await database.prepare(`
      SELECT user_id AS "userId" FROM sessions WHERE id = $1
    `).get(sessionId);
    if (!session) {
      return response.status(401).json({ error: 'Please log in to continue' });
    }
    const user = await database.prepare(`
      SELECT id, email, supabase_uid AS "supabaseUid", display_name AS "displayName", avatar_url AS "avatarUrl", bio, is_public AS "isPublic", email_verified AS "emailVerified", deleted_at AS "deletedAt"
      FROM users WHERE id = $1 OR supabase_uid = $1
      LIMIT 1
    `).get(session.userId);
    if (!user || user.deletedAt) {
      return response.status(401).json({ error: 'Your account is no longer available' });
    }

    let emailChangePending = false;
    try {
      const adminUser = await supabaseAdmin.auth.admin.getUserById(user.supabaseUid || user.id);
      if (adminUser?.data?.user?.new_email || adminUser?.data?.user?.email_change_sent_at) {
        emailChangePending = true;
      }
    } catch {}

    return response.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        emailVerified: Boolean(user.emailVerified),
        emailChangePending,
        deletedAt: user.deletedAt || null,
        avatarUrl: user.avatarUrl || null,
        bio: user.bio || null,
        isPublic: Boolean(user.isPublic),
      }
    });
  });

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

      await syncUserRecord(data.user, { displayName: displayName.trim(), emailVerified: false });
      await logAuthEvent(database, {
        userId: data.user.id,
        eventType: 'signup',
        ip: request.ip,
        userAgent: request.get('user-agent'),
      });

      return response.status(201).json({ user: null, email: normalizedEmail, message: 'Check your email to verify your account.' });
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
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (!error && data.user && data.session) {
        const emailConfirmed = Boolean(data.user.email_confirmed_at || data.user.confirmed_at);
        if (!emailConfirmed) {
          return response.status(403).json({ error: 'email_not_verified', message: 'Please verify your email address before signing in.' });
        }
        const user = await syncUserRecord(data.user, { emailVerified: true });
        await createServerSession(request, response, user.id, data.session);
        return response.json({ user });
      }

      const legacyAccount = await database.prepare(`
        SELECT id, email, display_name AS "displayName", password_hash AS "passwordHash", email_verified AS "emailVerified"
        FROM users WHERE lower(email) = $1 AND legacy_auth = true AND deleted_at IS NULL
      `).get(email);

      const DUMMY_HASH = '$2b$10$' + 'x'.repeat(53);
      if (!legacyAccount) {
        await bcrypt.compare(password, DUMMY_HASH);
        return response.status(401).json({ error: 'That email and password do not match' });
      }

      if (!legacyAccount.passwordHash || !(await bcrypt.compare(password, legacyAccount.passwordHash))) {
        return response.status(401).json({ error: 'That email and password do not match' });
      }

      if (!legacyAccount.emailVerified) {
        return response.status(403).json({ error: 'email_not_verified', message: 'Please verify your email address before signing in.' });
      }

      let supabaseUid = legacyAccount.id;
      try {
        const created = await supabaseAdmin.auth.admin.createUser({
          email: legacyAccount.email,
          password,
          email_confirm: true,
          user_metadata: { full_name: legacyAccount.displayName },
        });
        if (created.data?.user) {
          supabaseUid = created.data.user.id;
        }
      } catch (err) {
        if (err?.message?.includes('already') || err?.code === 'email_exists') {
          const { rows } = await database.query('SELECT id FROM auth.users WHERE lower(email) = $1 LIMIT 1', [email]);
          if (rows[0]) supabaseUid = rows[0].id;
        }
      }

      const { data: signinData, error: signinError } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (signinError || !signinData.session) {
        return response.status(401).json({ error: 'That email and password do not match' });
      }

      await database.prepare('UPDATE users SET supabase_uid = $1, legacy_auth = false WHERE id = $2').run(supabaseUid, legacyAccount.id);

      const dbUser = await database.prepare(`
        SELECT id, email, display_name AS "displayName", avatar_url AS "avatarUrl", bio, is_public AS "isPublic", email_verified AS "emailVerified", deleted_at AS "deletedAt"
        FROM users WHERE id = $1
      `).get(legacyAccount.id);

      const user = {
        id: dbUser.id,
        email: dbUser.email,
        displayName: dbUser.displayName,
        emailVerified: Boolean(dbUser.emailVerified),
        deletedAt: dbUser.deletedAt || null,
        avatarUrl: dbUser.avatarUrl || null,
        bio: dbUser.bio || null,
        isPublic: Boolean(dbUser.isPublic),
      };
      await createServerSession(request, response, user.id, signinData.session);
      return response.json({ user });
    } catch (error) {
      console.error('Sign-in failed:', error);
      return response.status(500).json({ error: 'Could not sign you in right now' });
    }
  });

  router.get('/signin/google', async (request, response) => {
    try {
      const appUrl = process.env.APP_URL || process.env.CORS_ORIGIN?.split(',')[0] || 'http://localhost:5173';
      const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${appUrl}/auth/callback`,
          skipBrowserRedirect: true,
        },
      });
      if (error || !data?.url) {
        return response.status(500).json({ error: 'oauth_init_failed' });
      }
      return response.json({ url: data.url });
    } catch (err) {
      console.error('[auth] google oauth init failed:', err);
      return response.status(500).json({ error: 'oauth_init_failed' });
    }
  });

  router.get('/signin/facebook', async (request, response) => {
    try {
      const appUrl = process.env.APP_URL || process.env.CORS_ORIGIN?.split(',')[0] || 'http://localhost:5173';
      const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'facebook',
        options: {
          redirectTo: `${appUrl}/auth/callback`,
          skipBrowserRedirect: true,
        },
      });
      if (error || !data?.url) {
        return response.status(500).json({ error: 'oauth_init_failed' });
      }
      return response.json({ url: data.url });
    } catch (err) {
      console.error('[auth] facebook oauth init failed:', err);
      return response.status(500).json({ error: 'oauth_init_failed' });
    }
  });

  router.post('/callback', async (request, response) => {
    console.info('[auth] /callback received:', {
      hasAccessToken: !!request.body?.access_token,
      accessTokenLength: request.body?.access_token?.length,
    });
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
      const sessionRes = await supabaseClient.auth.setSession({ access_token, refresh_token: request.body.refresh_token || '' });
      if (sessionRes.data?.session) {
        await createServerSession(request, response, user.id, sessionRes.data.session);
      } else {
        await createServerSession(request, response, user.id, { refresh_token: request.body.refresh_token || 'oauth-token', expires_in: 3600 });
      }
      console.info('[auth] /callback set cookie for user:', user.id);
      return response.json({ user });
    } catch (error) {
      console.error('[auth] /callback failed:', error);
      console.error('Auth callback failed:', error);
      return response.status(500).json({ error: 'Authentication exchange failed' });
    }
  });

  router.post('/signout', async (request, response) => {
    const sessionId = request.cookies[sessionCookie];
    if (sessionId) {
      const session = await database.prepare('SELECT user_id AS "userId" FROM sessions WHERE id = $1').get(sessionId);
      if (session) {
        await logAuthEvent(database, {
          userId: session.userId,
          eventType: 'signout',
          ip: request.ip,
          userAgent: request.get('user-agent'),
        });
      }
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

  router.post('/verify-email/resend', verifyResendIpLimiter, verifyResendLimiter, async (request, response) => {
    const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : '';
    if (!email || email.length > 254) {
      return response.status(400).json({ error: 'Valid email required' });
    }
    try {
      const appUrl = process.env.APP_URL || process.env.CORS_ORIGIN || 'http://localhost:5173';
      const emailRedirectTo = `${appUrl}/auth/verify`;
      await supabaseClient.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo },
      });
      return response.json({ sent: true });
    } catch (err) {
      console.error('Resend verification failed:', err);
      return response.json({ sent: true });
    }
  });

  // Feature 1: Password Reset
  router.post('/reset-password', resetLimiter, async (request, response) => {
    const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : '';
    if (!email) return response.status(400).json({ error: 'Email required' });
    try {
      const appUrl = process.env.APP_URL || process.env.CORS_ORIGIN || 'http://localhost:5173';
      const redirectTo = `${appUrl}/auth/reset-password`;
      await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });
      const user = await database.prepare('SELECT id FROM users WHERE lower(email) = lower($1)').get(email);
      await logAuthEvent(database, {
        userId: user?.id || null,
        eventType: 'password_reset_requested',
        ip: request.ip,
        userAgent: request.get('user-agent'),
        metadata: { email }
      });
      return response.json({ sent: true });
    } catch {
      return response.json({ sent: true });
    }
  });

  router.post('/reset-password/confirm', confirmResetLimiter, async (request, response) => {
    const { token_hash, newPassword } = request.body ?? {};
    if (!token_hash || typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
      return response.status(400).json({ error: 'Token and password (8-128 chars) required' });
    }
    if (!/[0-9]/.test(newPassword) && !/[^a-zA-Z0-9]/.test(newPassword)) {
      return response.status(400).json({ error: 'Password must contain at least 1 number or symbol' });
    }

    try {
      const { data: otpData, error: otpError } = await supabaseClient.auth.verifyOtp({ type: 'recovery', token_hash });
      if (otpError || !otpData.user) {
        return response.status(400).json({ error: 'Invalid or expired password reset token' });
      }

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(otpData.user.id, { password: newPassword });
      if (updateError) {
        return response.status(400).json({ error: updateError.message });
      }

      const dbUser = await database.prepare('SELECT id, email, display_name AS "displayName" FROM users WHERE supabase_uid = $1 OR id = $1').get(otpData.user.id);
      if (dbUser) {
        await database.prepare('DELETE FROM sessions WHERE user_id = $1').run(dbUser.id);
        await logAuthEvent(database, {
          userId: dbUser.id,
          eventType: 'password_changed',
          ip: request.ip,
          userAgent: request.get('user-agent')
        });
        await sendPasswordChangedEmail(dbUser);
      }

      return response.json({ success: true });
    } catch (err) {
      return response.status(400).json({ error: err.message || 'Password reset failed' });
    }
  });

  // Feature 2: Email Change
  router.post('/change-email', async (request, response) => {
    const sessionId = request.cookies[sessionCookie];
    if (!sessionId) return response.status(401).json({ error: 'Please log in' });
    const session = await database.prepare('SELECT user_id AS "userId" FROM sessions WHERE id = $1').get(sessionId);
    if (!session) return response.status(401).json({ error: 'Please log in' });

    const { newEmail } = request.body ?? {};
    const normalizedNewEmail = typeof newEmail === 'string' ? newEmail.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedNewEmail)) {
      return response.status(400).json({ error: 'Valid email required' });
    }

    const existing = await database.prepare('SELECT id FROM users WHERE lower(email) = lower($1)').get(normalizedNewEmail);
    if (existing) {
      return response.status(409).json({ error: 'Email is already in use' });
    }

    const dbUser = await database.prepare('SELECT id, supabase_uid AS "supabaseUid" FROM users WHERE id = $1').get(session.userId);
    if (!dbUser) return response.status(401).json({ error: 'User not found' });

    const { error } = await supabaseAdmin.auth.admin.updateUserById(dbUser.supabaseUid || dbUser.id, {
      email: normalizedNewEmail,
      email_confirm: false,
    });
    if (error) {
      return response.status(400).json({ error: error.message });
    }

    await logAuthEvent(database, {
      userId: dbUser.id,
      eventType: 'email_changed',
      ip: request.ip,
      userAgent: request.get('user-agent'),
      metadata: { newEmail: normalizedNewEmail }
    });

    return response.json({ sent: true });
  });

  // Feature 3: Magic Link
  router.post('/magic-link', magicLimiter, async (request, response) => {
    const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : '';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return response.status(400).json({ error: 'Valid email required' });
    }
    try {
      const appUrl = process.env.APP_URL || process.env.CORS_ORIGIN || 'http://localhost:5173';
      const emailRedirectTo = `${appUrl}/auth/verify?type=magiclink`;
      await supabaseClient.auth.signInWithOtp({
        email,
        options: { emailRedirectTo },
      });
      const user = await database.prepare('SELECT id FROM users WHERE lower(email) = lower($1)').get(email);
      await logAuthEvent(database, {
        userId: user?.id || null,
        eventType: 'magic_link_sent',
        ip: request.ip,
        userAgent: request.get('user-agent'),
        metadata: { email }
      });
      return response.json({ sent: true });
    } catch {
      return response.json({ sent: true });
    }
  });

  // Feature 4 & 7: Account Security & Sessions
  router.post('/change-password', changePasswordLimiter, async (request, response) => {
    const sessionId = request.cookies[sessionCookie];
    if (!sessionId) return response.status(401).json({ error: 'Please log in' });
    const session = await database.prepare('SELECT user_id AS "userId" FROM sessions WHERE id = $1').get(sessionId);
    if (!session) return response.status(401).json({ error: 'Please log in' });

    const { currentPassword, newPassword } = request.body ?? {};
    if (
      typeof currentPassword !== 'string' ||
      typeof newPassword !== 'string' ||
      newPassword.length < 8 ||
      newPassword.length > 128 ||
      (!/[0-9]/.test(newPassword) && !/[^a-zA-Z0-9]/.test(newPassword))
    ) {
      return response.status(400).json({ error: 'New password must be 8-128 characters and contain at least 1 number or symbol.' });
    }

    const dbUser = await database.prepare('SELECT id, email, supabase_uid AS "supabaseUid", display_name AS "displayName" FROM users WHERE id = $1').get(session.userId);
    if (!dbUser) return response.status(401).json({ error: 'User not found' });

    const { error: signinError } = await supabaseClient.auth.signInWithPassword({ email: dbUser.email, password: currentPassword });
    if (signinError) {
      return response.status(401).json({ error: 'Current password is incorrect' });
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(dbUser.supabaseUid || dbUser.id, { password: newPassword });
    if (updateError) {
      return response.status(400).json({ error: updateError.message });
    }

    await database.prepare('DELETE FROM sessions WHERE user_id = $1 AND id <> $2').run(dbUser.id, sessionId);

    await logAuthEvent(database, {
      userId: dbUser.id,
      eventType: 'password_changed',
      ip: request.ip,
      userAgent: request.get('user-agent')
    });

    await sendPasswordChangedEmail(dbUser);
    return response.json({ success: true });
  });

  router.get('/sessions', async (request, response) => {
    const sessionId = request.cookies[sessionCookie];
    if (!sessionId) return response.status(401).json({ error: 'Please log in' });
    const session = await database.prepare('SELECT user_id AS "userId" FROM sessions WHERE id = $1').get(sessionId);
    if (!session) return response.status(401).json({ error: 'Please log in' });

    const sessions = await database.prepare(`
      SELECT id, created_at AS "createdAt", last_used_at AS "lastUsedAt"
      FROM sessions WHERE user_id = $1 ORDER BY last_used_at DESC
    `).all(session.userId);

    const formatted = sessions.map(s => ({
      id: s.id,
      isCurrent: s.id === sessionId,
      device: parseUserAgent(request.get('user-agent')),
      ip: request.ip || '127.0.0.1',
      lastUsedAt: s.lastUsedAt || s.createdAt,
    }));
    return response.json({ sessions: formatted });
  });

  router.post('/sessions/revoke-others', async (request, response) => {
    const sessionId = request.cookies[sessionCookie];
    if (!sessionId) return response.status(401).json({ error: 'Please log in' });
    const session = await database.prepare('SELECT user_id AS "userId" FROM sessions WHERE id = $1').get(sessionId);
    if (!session) return response.status(401).json({ error: 'Please log in' });

    await database.prepare('DELETE FROM sessions WHERE user_id = $1 AND id <> $2').run(session.userId, sessionId);
    await logAuthEvent(database, {
      userId: session.userId,
      eventType: 'session_revoked',
      ip: request.ip,
      userAgent: request.get('user-agent'),
      metadata: { scope: 'all_others' }
    });
    return response.json({ success: true });
  });

  router.get('/activity', async (request, response) => {
    const sessionId = request.cookies[sessionCookie];
    if (!sessionId) return response.status(401).json({ error: 'Please log in' });
    const session = await database.prepare('SELECT user_id AS "userId" FROM sessions WHERE id = $1').get(sessionId);
    if (!session) return response.status(401).json({ error: 'Please log in' });

    const events = await database.prepare(`
      SELECT id, event_type AS "eventType", ip, user_agent AS "userAgent", metadata, created_at AS "createdAt"
      FROM auth_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20
    `).all(session.userId);

    return response.json({ events });
  });

  return router;
}
