import { prisma } from './prisma.js';
import { distanceKm, etaMinutes, VEHICLE_MAX_KG } from './geo.js';

export const WEIGHTS = {
  proximity: 0.25,
  timeFeasibility: 0.2,
  quantityFit: 0.15,
  needUrgency: 0.2,
  reliability: 0.1,
  dietFit: 0.1,
};

const DIET_COMPAT = {
  // listing diet -> receiver must accept one of these
  VEGAN: ['VEGAN', 'VEG', 'JAIN', 'EGG', 'NON_VEG'],
  JAIN: ['JAIN', 'VEG', 'EGG', 'NON_VEG'],
  VEG: ['VEG', 'EGG', 'NON_VEG'],
  EGG: ['EGG', 'NON_VEG'],
  NON_VEG: ['NON_VEG'],
};

function minutesOfDay(d) {
  return d.getHours() * 60 + d.getMinutes();
}
function hhmmToMin(s) {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function receiverStats() {
  const today = startOfToday();
  const claims = await prisma.claim.findMany({
    select: { receiverOrgId: true, claimedAt: true, qualityAccepted: true, listing: { select: { estimatedMeals: true, status: true } } },
  });
  const stats = {};
  for (const c of claims) {
    const s = (stats[c.receiverOrgId] ||= { mealsToday: 0, total: 0, good: 0 });
    if (c.claimedAt >= today && !['CANCELLED', 'EXPIRED'].includes(c.listing.status)) s.mealsToday += c.listing.estimatedMeals;
    if (['DELIVERED', 'REJECTED', 'EXPIRED'].includes(c.listing.status)) {
      s.total += 1;
      if (c.listing.status === 'DELIVERED') s.good += 1;
    }
  }
  return stats;
}

/**
 * Rank receivers for a listing. Hard filters exclude receivers who cannot take the food
 * safely in time; soft scores rank the rest. Every match carries human-readable reasons.
 */
export async function rankReceivers(listing, { includeExcluded = false } = {}) {
  const donor = listing.donorOrg || (await prisma.organization.findUnique({ where: { id: listing.donorOrgId } }));
  const receivers = await prisma.organization.findMany({
    where: { type: 'RECEIVER' },
    include: { receiverProfile: true, users: { select: { id: true, email: true, name: true } } },
  });
  const stats = await receiverStats();
  const now = new Date();
  const minutesLeft = (new Date(listing.consumeBy) - now) / 60000;
  const results = [];

  for (const r of receivers) {
    const p = r.receiverProfile;
    if (!p) continue;
    const km = distanceKm(donor, r);
    const etaDrop = etaMinutes(km);
    const etaTotal = etaDrop + 15; // ~15 min for a volunteer to reach the donor
    const s = stats[r.id] || { mealsToday: 0, total: 0, good: 0 };
    const remainingCap = Math.max(0, p.capacityMealsPerDay - s.mealsToday);
    const excluded = [];

    if (!p.acceptingToday) excluded.push('Not accepting food today');
    if (!p.dietAccepted.some((d) => (DIET_COMPAT[listing.dietType] || []).includes(d)))
      excluded.push(`Does not accept ${listing.dietType.replace('_', '-').toLowerCase()} food`);
    if (remainingCap <= 0) excluded.push('No capacity left today');
    const slack = minutesLeft - etaTotal - 10;
    if (slack < 0) excluded.push(`Cannot arrive before consume-by (needs ~${etaTotal} min, ${Math.max(0, Math.round(minutesLeft))} min left)`);
    const arrival = minutesOfDay(new Date(now.getTime() + etaTotal * 60000));
    if (arrival < hhmmToMin(p.intakeStart) || arrival > hhmmToMin(p.intakeEnd))
      excluded.push(`Closed at arrival time (intake ${p.intakeStart}–${p.intakeEnd})`);
    if (listing.storage === 'REFRIGERATED' && !p.hasFridge && minutesLeft > 360)
      excluded.push('No fridge for chilled food that will be stored overnight');

    const proximity = Math.max(0, 1 - km / 15);
    const timeFeasibility = Math.max(0, Math.min(1, slack / 120));
    // 1.0 when the receiver can take everything without lots of idle capacity; partial if it can only take some
    const quantityFit = !remainingCap
      ? 0
      : remainingCap >= listing.estimatedMeals
        ? 1 - Math.min(0.4, ((remainingCap - listing.estimatedMeals) / remainingCap) * 0.4)
        : remainingCap / listing.estimatedMeals;
    const needUrgency = Math.max(0, 1 - s.mealsToday / p.capacityMealsPerDay);
    const reliability = s.total ? s.good / s.total : 0.8;
    const dietFit = p.dietAccepted.includes(listing.dietType) ? 1 : 0.7;

    const breakdown = { proximity, timeFeasibility, quantityFit, needUrgency, reliability, dietFit };
    const score = Object.entries(WEIGHTS).reduce((acc, [k, w]) => acc + w * breakdown[k], 0);

    const reasons = [];
    reasons.push(`${km} km away (~${etaDrop} min drive)`);
    reasons.push(slack >= 0 ? `${Math.round(slack)} min spare before consume-by` : 'Too late for safe window');
    reasons.push(
      remainingCap >= listing.estimatedMeals
        ? `Has room for all ${listing.estimatedMeals} meals (${remainingCap} left today)`
        : `Can take ~${remainingCap} of ${listing.estimatedMeals} meals`,
    );
    reasons.push(`${s.mealsToday} meals received today of ${p.capacityMealsPerDay} capacity`);
    reasons.push(`${Math.round(reliability * 100)}% past deliveries accepted`);

    if (!excluded.length || includeExcluded) {
      results.push({
        receiverOrgId: r.id,
        receiverName: r.name,
        subType: r.subType,
        zone: r.zone,
        coordinators: r.users,
        distanceKm: km,
        etaMinutes: etaDrop,
        remainingCapacity: remainingCap,
        score: +score.toFixed(3),
        breakdown: Object.fromEntries(Object.entries(breakdown).map(([k, v]) => [k, +v.toFixed(2)])),
        reasons,
        excluded,
        eligible: excluded.length === 0,
      });
    }
  }
  results.sort((a, b) => (b.eligible - a.eligible) || b.score - a.score);
  return results;
}

/** Score a single receiver for a listing (used in the receiver feed). */
export async function scoreFor(listing, receiverOrgId) {
  const all = await rankReceivers(listing, { includeExcluded: true });
  return all.find((m) => m.receiverOrgId === receiverOrgId);
}

/** Rank claimed-but-unassigned listings for a volunteer. */
export function scoreTaskForVolunteer(listing, volunteer) {
  const donor = listing.donorOrg;
  const receiver = listing.claim?.receiverOrg;
  const toDonor = distanceKm(volunteer, donor);
  const donorToReceiver = receiver ? distanceKm(donor, receiver) : 0;
  const totalMin = etaMinutes(toDonor) + etaMinutes(donorToReceiver);
  const minutesLeft = (new Date(listing.consumeBy) - new Date()) / 60000;
  const vehicleOk = listing.quantityKg <= VEHICLE_MAX_KG[volunteer.vehicle];
  const inRadius = toDonor <= volunteer.maxRadiusKm;
  const feasible = totalMin + 10 < minutesLeft;
  const reasons = [
    `${toDonor} km to pickup, ${donorToReceiver} km to drop`,
    `~${totalMin} min total trip, ${Math.max(0, Math.round(minutesLeft))} min until consume-by`,
    vehicleOk ? `${listing.quantityKg} kg fits on your ${volunteer.vehicle.toLowerCase()}` : `${listing.quantityKg} kg is too much for a ${volunteer.vehicle.toLowerCase()}`,
  ];
  if (listing.storage !== 'ROOM_TEMP' && !volunteer.hasInsulatedBag) reasons.push('Insulated bag recommended');
  const score = (Math.max(0, 1 - toDonor / 15) * 0.5 + Math.max(0, Math.min(1, (minutesLeft - totalMin) / 120)) * 0.5);
  return {
    toDonorKm: toDonor,
    donorToReceiverKm: donorToReceiver,
    tripMinutes: totalMin,
    eligible: vehicleOk && inRadius && feasible,
    score: +score.toFixed(3),
    reasons,
    blockers: [!vehicleOk && 'Vehicle too small', !inRadius && 'Outside your radius', !feasible && 'Not enough time'].filter(Boolean),
  };
}
