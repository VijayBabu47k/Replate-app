import { prisma } from './prisma.js';
import { sendMail } from './mailer.js';

const appUrl = (link) => `${(process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '')}${link || '/'}`;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Small HTML helpers so every email looks the same. */
export const mail = {
  p: (html) => `<p style="margin:0 0 12px">${html}</p>`,
  /** Key/value detail table. Rows with empty values are skipped. */
  details: (rows) => `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:6px 0 16px;border-collapse:collapse;font-size:13.5px">${rows
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `<tr><td style="padding:7px 0;color:#55645d;width:38%;vertical-align:top;border-bottom:1px solid #eef2ef">${esc(k)}</td><td style="padding:7px 0;color:#0b1510;font-weight:600;border-bottom:1px solid #eef2ef">${v}</td></tr>`)
    .join('')}</table>`,
  /** Highlighted one-time code. */
  code: (label, value) => `<div style="margin:6px 0 16px;padding:14px 16px;border:1px dashed #10b981;border-radius:12px;background:#ecfdf5"><div style="font-size:12px;color:#047857;font-weight:600;text-transform:uppercase;letter-spacing:.08em">${esc(label)}</div><div style="font-family:ui-monospace,Menlo,monospace;font-size:26px;font-weight:700;letter-spacing:.3em;color:#065f46">${esc(value)}</div></div>`,
  esc,
};

const button = (link, label = 'Open in RePlate') =>
  `<p style="margin:20px 0 4px"><a href="${appUrl(link)}" style="display:inline-block;background:#047857;color:#ffffff;text-decoration:none;font-weight:600;padding:11px 20px;border-radius:10px">${label}</a></p>`;

/**
 * Create in-app notifications and (optionally) emails for a set of users.
 * Emails go out in the background so the API responds immediately.
 * Never throws: notification failures must not break the rescue flow.
 */
export async function notifyUsers(users, { message, link, email }) {
  try {
    const uniq = [...new Map(users.filter(Boolean).map((u) => [u.id, u])).values()];
    if (!uniq.length) return;
    await prisma.notification.createMany({ data: uniq.map((u) => ({ userId: u.id, message, link })) });
    if (email) {
      const html = email.html + (email.noButton ? '' : button(link, email.cta));
      Promise.allSettled(uniq.filter((u) => u.email).map((u) => sendMail({ to: u.email, subject: email.subject, title: email.title, html })))
        .catch(() => {});
    }
  } catch (e) {
    console.error('[notify]', e.message);
  }
}

export async function orgUsers(orgId) {
  if (!orgId) return [];
  return prisma.user.findMany({ where: { organizationId: orgId }, select: { id: true, email: true, name: true } });
}
