// Send a test email with the current server/.env mail settings.
// Usage: npm run mail:test -- you@example.com
import 'dotenv/config';
import { verifyMailer, sendMail } from '../src/lib/mailer.js';
import { prisma } from '../src/lib/prisma.js';

const to = process.argv[2] || process.env.MAIL_REDIRECT_TO || process.env.GMAIL_USER;
if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) {
  console.error('Usage: npm run mail:test -- you@example.com');
  process.exit(1);
}

const check = await verifyMailer();
if (!check.ok) {
  await prisma.$disconnect();
  process.exit(1);
}
const status = await sendMail({
  to,
  subject: 'RePlate: test email',
  title: 'Your email setup works',
  html: `<p>This is a test from RePlate using <b>MAIL_MODE=${check.mode}</b>.</p><p>Notifications about listings, claims and deliveries will arrive like this.</p>`,
});
console.log(`[mail] ${to}: ${status}`);
await prisma.$disconnect();
process.exit(status.startsWith('failed') ? 1 : 0);
