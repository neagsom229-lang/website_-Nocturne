import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Resend } from 'resend';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const fromEmail = process.env.EMAIL_FROM || 'Nocturne <onboarding@resend.dev>';
const appUrl = process.env.APP_URL || 'http://localhost:5173';

async function renderTemplate(templateName, variables) {
  try {
    const filePath = path.join(__dirname, '../templates/emails', `${templateName}.html`);
    let html = await fs.readFile(filePath, 'utf8');
    for (const [key, val] of Object.entries(variables)) {
      html = html.replaceAll(`{{${key}}}`, val ?? '');
    }
    return html;
  } catch (err) {
    console.error(`Error rendering email template ${templateName}:`, err);
    return `<p>Hello ${variables.displayName || ''}</p>`;
  }
}

async function sendEmail({ to, subject, template, variables }) {
  if (!to) return;
  const html = await renderTemplate(template, { appUrl, ...variables });
  if (!resend) {
    console.info(`[emailService] Resend API key not configured. Mock sending email to ${to}: subject="${subject}"`);
    return;
  }
  try {
    await resend.emails.send({
      from: fromEmail,
      to,
      subject,
      html,
    });
  } catch (error) {
    console.error('[emailService] Failed to send email:', error);
  }
}

export async function sendWelcomeEmail(user) {
  await sendEmail({
    to: user.email,
    subject: 'Welcome to Nocturne',
    template: 'welcome',
    variables: { displayName: user.displayName || user.email?.split('@')[0] || 'Listener' },
  });
}

export async function sendPasswordChangedEmail(user) {
  await sendEmail({
    to: user.email,
    subject: 'Your Nocturne password was changed',
    template: 'password-changed',
    variables: { displayName: user.displayName || user.email?.split('@')[0] || 'Listener' },
  });
}

export async function sendNewDeviceEmail(user, { ip, userAgent }) {
  await sendEmail({
    to: user.email,
    subject: 'New sign-in to Nocturne from unrecognized device',
    template: 'new-device',
    variables: {
      displayName: user.displayName || user.email?.split('@')[0] || 'Listener',
      ip: ip || 'Unknown IP',
      userAgent: userAgent || 'Unknown Browser/Device',
    },
  });
}

export async function sendAccountDeletedEmail(user) {
  await sendEmail({
    to: user.email,
    subject: 'Your Nocturne account has been deleted',
    template: 'account-deleted',
    variables: { displayName: user.displayName || user.email?.split('@')[0] || 'Listener' },
  });
}

export async function checkAndSendNewDeviceEmail(database, user, { ip, userAgent, acceptLanguage }) {
  if (!user || !user.email) return;
  const subnet = ip ? ip.split('.').slice(0, 3).join('.') : 'unknown';
  const rawString = `${userAgent || ''}-${acceptLanguage || ''}-${subnet}`;
  const deviceHash = crypto.createHash('sha256').update(rawString).digest('hex');

  try {
    const existing = await database.prepare(`
      SELECT 1 FROM user_devices WHERE user_id = $1 AND device_hash = $2
    `).get(user.id, deviceHash);

    if (!existing) {
      const recentDevice = await database.prepare(`
        SELECT 1 FROM user_devices WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 hour'
      `).get(user.id);

      await database.prepare(`
        INSERT INTO user_devices (user_id, device_hash, user_agent, ip)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, device_hash) DO NOTHING
      `).run(user.id, deviceHash, userAgent || null, ip || null);

      if (!recentDevice) {
        await sendNewDeviceEmail(user, { ip: ip || 'Unknown', userAgent: userAgent || 'Unknown' });
      }
    }
  } catch (err) {
    console.error('[emailService] checkAndSendNewDeviceEmail error:', err);
  }
}
