// Mark pending volunteer payouts as paid after you've sent the money (UPI / bank).
// Usage: npm run payouts:settle            -> settle all pending payouts
//        npm run payouts:settle -- <id>    -> settle one payout
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { notifyUsers } from '../src/lib/notify.js';

const id = process.argv[2];
const pending = await prisma.payout.findMany({
  where: { status: 'PENDING', ...(id ? { id } : {}) },
  include: { volunteer: { select: { id: true, email: true, name: true } } },
});
if (!pending.length) console.log(id ? `No pending payout with id ${id}` : 'No pending payouts.');
for (const p of pending) {
  await prisma.payout.update({ where: { id: p.id }, data: { status: 'PAID', paidAt: new Date() } });
  await notifyUsers([p.volunteer], {
    message: `₹${p.amount} paid to ${p.upiId}`,
    link: '/volunteer/earnings',
    email: { subject: `Payout of ₹${p.amount} sent`, html: `<p><b>₹${p.amount}</b> has been paid to your UPI ID <b>${p.upiId}</b>. Thank you for every delivery.</p>` },
  });
  console.log(`Paid ₹${p.amount} to ${p.volunteer.name} (${p.upiId})`);
}
await prisma.$disconnect();
