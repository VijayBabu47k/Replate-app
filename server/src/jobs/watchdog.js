import { prisma } from '../lib/prisma.js';
import { expireStale, broadcast, addEvent, alertVolunteers } from '../lib/lifecycle.js';
import { notifyUsers, orgUsers, mail } from '../lib/notify.js';

const CASCADE_L2_MIN = 5;
const CASCADE_L3_MIN = 10;
const VOLUNTEER_STALL_MIN = 25;

/**
 * Runs every minute so food is collected before it spoils:
 *  1. expire listings whose safe window has closed
 *  2. widen the search for unclaimed listings (cascade broadcast)
 *  3. reassign volunteers who accepted but never picked up
 */
export async function runWatchdog() {
  const expired = await expireStale();
  const now = Date.now();

  const unclaimed = await prisma.listing.findMany({ where: { status: 'POSTED', broadcastLevel: { lt: 3 } }, include: { donorOrg: true } });
  for (const l of unclaimed) {
    const age = (now - l.createdAt.getTime()) / 60000;
    const next = age >= CASCADE_L3_MIN ? 3 : age >= CASCADE_L2_MIN ? 2 : 1;
    if (next > l.broadcastLevel) {
      await prisma.listing.update({ where: { id: l.id }, data: { broadcastLevel: next } });
      const n = await broadcast(l, next);
      await addEvent(l.id, 'POSTED', next === 2 ? `Unclaimed after ${CASCADE_L2_MIN} min — alerted ${n} more receivers` : `Unclaimed after ${CASCADE_L3_MIN} min — alerted all remaining eligible receivers (${n})`);
    }
  }

  const stalled = await prisma.listing.findMany({
    where: { status: 'ASSIGNED', claim: { assignedAt: { lt: new Date(now - VOLUNTEER_STALL_MIN * 60000) } } },
    include: { claim: { include: { volunteer: { select: { id: true, name: true, email: true } } } } },
  });
  for (const l of stalled) {
    await prisma.claim.update({ where: { id: l.claim.id }, data: { volunteerId: null, assignedAt: null } });
    await prisma.listing.update({ where: { id: l.id }, data: { status: 'CLAIMED' } });
    await addEvent(l.id, 'CLAIMED', `No pickup ${VOLUNTEER_STALL_MIN} min after accepting — volunteer released and task reopened automatically`);
    await notifyUsers([l.claim.volunteer], {
      message: `"${l.title}" was reassigned because it wasn't picked up in time`,
      link: '/volunteer',
      email: { subject: `Task reassigned: ${l.title}`, html: mail.p(`You accepted <b>${mail.esc(l.title)}</b> but it wasn't picked up within ${VOLUNTEER_STALL_MIN} minutes, so we offered it to other volunteers.`) },
    });
    await notifyUsers([...(await orgUsers(l.donorOrgId)), ...(await orgUsers(l.claim.receiverOrgId))], {
      message: `Finding a new volunteer for "${l.title}"`,
      link: `/listings/${l.id}`,
      email: { subject: `Finding a new volunteer: ${l.title}`, html: mail.p(`The volunteer for <b>${mail.esc(l.title)}</b> didn't pick it up in time. We have alerted other volunteers nearby and will email you when someone accepts.`) },
    });
    await alertVolunteers(l.id);
  }

  if (expired || stalled.length) console.log(`[watchdog] expired=${expired} reassigned=${stalled.length}`);
}

export function startWatchdog(intervalMs = 60_000) {
  const tick = () => runWatchdog().catch((e) => console.error('[watchdog]', e.message));
  tick();
  return setInterval(tick, intervalMs);
}
