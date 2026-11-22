import { prisma } from './prisma.js';
import { rankReceivers, scoreTaskForVolunteer } from './matching.js';
import { notifyUsers, orgUsers, mail } from './notify.js';

export async function addEvent(listingId, status, note, actorId = null, tx = prisma) {
  return tx.statusEvent.create({ data: { listingId, status, note, actorId } });
}

export const otp = () => String(Math.floor(1000 + Math.random() * 9000));

/** Expire listings whose safe window has closed before collection. */
export async function expireStale() {
  const now = new Date();
  const stale = await prisma.listing.findMany({
    where: { status: { in: ['POSTED', 'CLAIMED', 'ASSIGNED'] }, consumeBy: { lt: now } },
    include: { claim: { include: { volunteer: { select: { id: true, name: true, email: true } } } } },
  });
  for (const l of stale) {
    await prisma.listing.update({ where: { id: l.id }, data: { status: 'EXPIRED' } });
    await addEvent(l.id, 'EXPIRED', 'Safe time window closed before collection. Food should be disposed of safely, not served.');
    await notifyUsers(await orgUsers(l.donorOrgId), {
      message: `"${l.title}" expired before collection. Please dispose of it safely.`,
      link: `/listings/${l.id}`,
      email: { subject: `Expired: ${l.title}`, html: mail.p(`The safe window for <b>${mail.esc(l.title)}</b> closed before it was collected. Please <b>dispose of it safely</b>; do not serve it.`) },
    });
    const others = [...(await orgUsers(l.claim?.receiverOrgId)), l.claim?.volunteer].filter(Boolean);
    await notifyUsers(others, {
      message: `"${l.title}" expired before collection. No pickup is needed.`,
      link: `/listings/${l.id}`,
      email: { subject: `Expired: ${l.title}`, html: mail.p(`<b>${mail.esc(l.title)}</b> passed its safe window before collection, so it has been withdrawn. No pickup or delivery is needed.`) },
    });
  }
  return stale.length;
}

/** Notify the best-matched receivers. level 1 = top 3, level 2 = next 5, level 3 = everyone eligible. */
export async function broadcast(listing, level) {
  const matches = (await rankReceivers(listing)).filter((m) => m.eligible);
  const slice = level === 1 ? matches.slice(0, 3) : level === 2 ? matches.slice(3, 8) : matches.slice(8);
  const users = slice.flatMap((m) => m.coordinators);
  const label = level === 1 ? 'New surplus matched to you' : level === 2 ? 'Still unclaimed — widened search' : 'Urgent: unclaimed surplus nearby';
  await notifyUsers(users, {
    message: `${label}: ${listing.title} (${listing.estimatedMeals} meals), consume by ${new Date(listing.consumeBy).toLocaleTimeString('en-IN', { timeStyle: 'short' })}`,
    link: `/listings/${listing.id}`,
    email: {
      subject: `${label}: ${listing.title}`,
      html: `<p><b>${listing.title}</b> — about ${listing.estimatedMeals} meals (${listing.quantityKg} kg).</p>
             <p>Pickup by <b>${new Date(listing.pickupBy).toLocaleString('en-IN')}</b>. Consume by <b>${new Date(listing.consumeBy).toLocaleString('en-IN')}</b>.</p>
             <p>Allergens: ${listing.allergens.length ? listing.allergens.join(', ') : 'none declared'}.</p>
             <p>Open the app to claim it.</p>`,
    },
  });
  return slice.length;
}

/** Notify available volunteers who can actually do the trip. */
export async function alertVolunteers(listingId, limit = 5) {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { donorOrg: true, claim: { include: { receiverOrg: true } } },
  });
  const vols = await prisma.volunteerProfile.findMany({ where: { available: true }, include: { user: true } });
  const ranked = vols
    .map((v) => ({ v, s: scoreTaskForVolunteer(listing, v) }))
    .filter((x) => x.s.eligible)
    .sort((a, b) => b.s.score - a.s.score)
    .slice(0, limit);
  await notifyUsers(ranked.map((x) => x.v.user), {
    message: `Pickup needed: ${listing.title} from ${listing.donorOrg.name} → ${listing.claim.receiverOrg.name}`,
    link: `/volunteer`,
    email: {
      subject: `Volunteer pickup needed: ${listing.title}`,
      html: `<p>${listing.quantityKg} kg from <b>${listing.donorOrg.zone}</b> to <b>${listing.claim.receiverOrg.zone}</b>.</p><p>Consume by ${new Date(listing.consumeBy).toLocaleString('en-IN')}.</p>`,
    },
  });
}
