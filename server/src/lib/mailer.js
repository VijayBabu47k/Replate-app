import nodemailer from 'nodemailer';
import { prisma } from './prisma.js';

/*
 * Email delivery via Nodemailer. MAIL_MODE (server/.env) picks the transport:
 *   log      – no network; emails are rendered and kept in EmailLog (the in-app Outbox). Default.
 *   gmail    – real delivery through Gmail using an App Password (GMAIL_USER + GMAIL_APP_PASSWORD).
 *   smtp     – any SMTP server (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS).
 *   ethereal – throwaway Ethereal inbox; each email gets a preview link.
 *
 * Demo accounts use made-up domains (e.g. @demo.rescue), which would bounce. In gmail/smtp mode their
 * emails are delivered to MAIL_REDIRECT_TO (your own inbox) if set, otherwise skipped.
 * Real addresses always go to the real recipient.
 */

const FAKE_DOMAINS = /\.(rescue|example|test|invalid|local)$/i;
// Reuse a few SMTP connections and pace sends: Gmail answers bursts of new connections with "421 try again later"
const POOL = { pool: true, maxConnections: 2, maxMessages: 100, rateDelta: 1000, rateLimit: 4 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isTemporary = (e) => /^4\d\d$/.test(String(e.responseCode || '')) || /^(ECONNECTION|ETIMEDOUT|ESOCKET|ECONNRESET)$/.test(e.code || '') || /\b4\d\d[ -]4\.\d\.\d/.test(e.message || '');
let transporterPromise;

const env = (k) => (process.env[k] || '').trim();
const mode = () => (env('MAIL_MODE') || 'log').toLowerCase();

function buildTransport() {
  const m = mode();
  if (m === 'gmail') {
    const user = env('GMAIL_USER');
    // Google shows app passwords as "abcd efgh ijkl mnop"; the spaces are not part of the password.
    const pass = env('GMAIL_APP_PASSWORD').replace(/\s+/g, '');
    if (!user || !pass) throw new Error('MAIL_MODE=gmail needs GMAIL_USER and GMAIL_APP_PASSWORD in server/.env');
    if (pass.length !== 16) console.warn(`[mail] GMAIL_APP_PASSWORD is ${pass.length} characters; Google app passwords are 16. Check it was copied fully.`);
    return { mode: m, from: env('MAIL_FROM') || `RePlate <${user}>`, t: nodemailer.createTransport({ service: 'gmail', auth: { user, pass }, ...POOL }) };
  }
  if (m === 'smtp') {
    if (!env('SMTP_HOST')) throw new Error('MAIL_MODE=smtp needs SMTP_HOST in server/.env');
    const port = Number(env('SMTP_PORT') || 587);
    const isGmail = /gmail\.com$/i.test(env('SMTP_HOST'));
    // Gmail app passwords are shown as "abcd efgh ijkl mnop"; the spaces are not part of the password
    const pass = isGmail ? env('SMTP_PASS').replace(/\s+/g, '') : env('SMTP_PASS');
    return {
      mode: m,
      from: env('MAIL_FROM') || `RePlate <${env('SMTP_USER') || 'no-reply@localhost'}>`,
      t: nodemailer.createTransport({
        host: env('SMTP_HOST'), port, secure: port === 465,
        auth: env('SMTP_USER') ? { user: env('SMTP_USER'), pass } : undefined,
        ...POOL,
      }),
    };
  }
  return null;
}

async function getTransporter() {
  if (transporterPromise) return transporterPromise;
  transporterPromise = (async () => {
    const m = mode();
    if (m === 'gmail' || m === 'smtp') return buildTransport();
    if (m === 'ethereal') {
      try {
        const acct = await nodemailer.createTestAccount();
        console.log(`[mail] Ethereal inbox: ${acct.user}`);
        return {
          mode: m, from: env('MAIL_FROM') || 'RePlate <no-reply@replate.example>',
          t: nodemailer.createTransport({ host: acct.smtp.host, port: acct.smtp.port, secure: acct.smtp.secure, auth: { user: acct.user, pass: acct.pass } }),
        };
      } catch (e) {
        console.warn('[mail] Ethereal unavailable, falling back to log mode:', e.message);
      }
    }
    return { mode: 'log', from: env('MAIL_FROM') || 'RePlate <no-reply@replate.example>', t: nodemailer.createTransport({ jsonTransport: true }) };
  })();
  // Don't cache a failed setup forever: let the next email retry after .env is fixed and the server restarts
  transporterPromise.catch(() => { transporterPromise = undefined; });
  return transporterPromise;
}

const hint = (e) => {
  if (/535|Username and Password not accepted|Invalid login/i.test(e.message)) {
    return 'Gmail rejected the login. Use a 16-character App Password (not your normal password), with 2-Step Verification on for that account.';
  }
  if (/ETIMEDOUT|ECONNREFUSED|ENOTFOUND/i.test(e.message)) return 'Could not reach the mail server. Check your network or firewall.';
  return '';
};

/** Check the mail configuration at startup and log a clear result. Never throws. */
export async function verifyMailer() {
  const m = mode();
  if (m === 'log') { console.log('[mail] MAIL_MODE=log: emails are stored in the in-app Outbox, not sent.'); return { ok: true, mode: m }; }
  try {
    const { t, mode: active } = await getTransporter();
    if (active === 'log') return { ok: true, mode: active };
    await t.verify();
    const redirect = env('MAIL_REDIRECT_TO');
    console.log(`[mail] ${active} transport ready${redirect ? `; demo-account emails go to ${redirect}` : ''}.`);
    return { ok: true, mode: active };
  } catch (e) {
    console.error(`[mail] ${m} transport not ready: ${e.message}`);
    const h = hint(e);
    if (h) console.error(`[mail] ${h}`);
    return { ok: false, mode: m, error: e.message, hint: h };
  }
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function emailLayout(title, bodyHtml) {
  return `<!doctype html><html><body style="margin:0;padding:24px 12px;background:#f1f5f3">
<div style="font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;max-width:560px;margin:auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e3ebe6">
  <div style="background:linear-gradient(120deg,#16a34a,#047857 55%,#0f766e);background-color:#047857;padding:22px 28px">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,0.18);text-align:center;vertical-align:middle;color:#fff;font-size:18px;font-weight:700">RP</td>
      <td style="padding-left:12px;color:#ffffff;font-size:16px;font-weight:600;letter-spacing:-0.01em">RePlate</td>
    </tr></table>
  </div>
  <div style="padding:28px;color:#0b1510;font-size:14px;line-height:1.65">
    <h2 style="margin:0 0 14px;font-size:20px;font-weight:600;letter-spacing:-0.02em;color:#0b1510">${esc(title)}</h2>
    ${bodyHtml}
  </div>
  <div style="background:#f6f9f7;border-top:1px solid #e3ebe6;padding:16px 28px;font-size:11.5px;line-height:1.6;color:#55645d">
    This platform connects people and does not certify that food is safe. Follow the handling guidance and time limits on each listing.
  </div>
</div></body></html>`;
}

export async function sendMail({ to, subject, title, html }) {
  const full = emailLayout(title || subject, html);
  let status = 'sent';
  let previewUrl = null;
  let deliveredTo = to;
  try {
    const { t, mode: active, from } = await getTransporter();
    const redirect = env('MAIL_REDIRECT_TO');
    const real = active === 'gmail' || active === 'smtp';
    const demoAddress = FAKE_DOMAINS.test(to.split('@')[1] || '');
    if (real && demoAddress && redirect) deliveredTo = redirect;
    if (real && demoAddress && !redirect) {
      status = 'skipped: demo address (set MAIL_REDIRECT_TO to receive these)';
    } else {
      const message = {
        from,
        to: deliveredTo,
        subject: deliveredTo !== to ? `${subject} [for ${to}]` : subject,
        html: full,
        text: `${title || subject}\n\n${html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}`,
      };
      // Retry temporary server errors (421/45x, dropped connections) with backoff: 2s, 6s, 15s
      let info;
      for (let attempt = 0; ; attempt++) {
        try {
          info = await t.sendMail(message);
          break;
        } catch (e) {
          if (attempt >= 3 || !isTemporary(e)) throw e;
          await sleep([2000, 6000, 15000][attempt]);
        }
      }
      if (active === 'ethereal') previewUrl = nodemailer.getTestMessageUrl(info) || null;
      if (active === 'log') status = 'logged';
    }
  } catch (e) {
    const h = hint(e);
    status = `failed: ${e.message}${h ? ` (${h})` : ''}`.slice(0, 500);
    console.error('[mail] send failed:', e.message);
  }
  await prisma.emailLog.create({ data: { to, subject, html: full, status, previewUrl } });
  return status;
}
