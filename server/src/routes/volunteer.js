import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { ah, HttpError } from '../lib/asyncHandler.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { listingInclude, serializeListing } from '../lib/serialize.js';
import { scoreTaskForVolunteer } from '../lib/matching.js';
import { expireStale } from '../lib/lifecycle.js';
import { getAssumptions } from '../lib/impact.js';
import { findLocation, pointNear } from '../lib/locations.js';
import { bad, optText } from '../lib/validate.js';
import { FEE, UPI_RE, autoSettle } from '../lib/fees.js';
import { notifyUsers } from '../lib/notify.js';

const r = Router();
r.use(requireAuth, requireRole('VOLUNTEER'));

const isOverdue = (l) => (new Date(l.pickupBy) < new Date() ? 1 : 0);

r.get('/tasks', ah(async (req, res) => {
  await expireStale();
  const vp = req.user.volunteerProfile;
  const open = await prisma.listing.findMany({
    where: { status: 'CLAIMED', claim: { selfPickup: false, volunteerId: null } },
    include: listingInclude,
  });
  const available = open
    .map((l) => ({ ...serializeListing(l, req.user), task: scoreTaskForVolunteer(l, vp), receiverZone: l.claim.receiverOrg.zone, receiverName: l.claim.receiverOrg.name }))
    // Eligible first, then tasks whose pickup-by hasn't passed, then best score. Overdue tasks sink to the bottom.
    .sort((a, b) => (b.task.eligible - a.task.eligible) || (isOverdue(a) - isOverdue(b)) || b.task.score - a.task.score);
  const mine = await prisma.listing.findMany({ where: { claim: { volunteerId: req.user.id } }, include: listingInclude, orderBy: { updatedAt: 'desc' } });
  const ser = mine.map((l) => serializeListing(l, req.user));
  res.json({
    available,
    active: ser.filter((l) => ['ASSIGNED', 'COLLECTED'].includes(l.status)),
    history: ser.filter((l) => !['ASSIGNED', 'COLLECTED'].includes(l.status)),
  });
}));

r.get('/profile', ah(async (req, res) => {
  const vp = await prisma.volunteerProfile.findUnique({ where: { userId: req.user.id } });
  const { kgPerMeal } = await getAssumptions();
  const done = await prisma.claim.findMany({
    where: { volunteerId: req.user.id, deliveredAt: { not: null } },
    include: { listing: { select: { quantityKg: true } } },
  });
  const minutes = done.reduce((s, c) => s + Math.max(10, (c.deliveredAt - (c.assignedAt || c.claimedAt)) / 60000), 0);
  const kg = done.reduce((s, c) => s + (c.receivedKg ?? c.listing.quantityKg), 0);
  const deliveries = done.length;
  const earned = await prisma.earning.aggregate({ _sum: { amount: true }, where: { volunteerId: req.user.id } });
  res.json({
    profile: vp,
    stats: { deliveries, kg: +kg.toFixed(1), meals: Math.round(kg / kgPerMeal), hours: +(minutes / 60).toFixed(1), earned: earned._sum.amount || 0 },
  });
}));

r.patch('/profile', ah(async (req, res) => {
  const b = req.body || {};
  const data = {};
  if (b.available !== undefined) data.available = !!b.available;
  if (b.hasInsulatedBag !== undefined) data.hasInsulatedBag = !!b.hasInsulatedBag;
  if (b.upiId !== undefined) {
    const upi = String(b.upiId || '').trim();
    if (upi && !UPI_RE.test(upi)) bad('Enter a valid UPI ID, e.g. name@okbank');
    data.upiId = upi || null;
  }
  if (b.vehicle) {
    if (!['BICYCLE', 'BIKE', 'CAR', 'VAN'].includes(b.vehicle)) throw new HttpError(400, 'Unknown vehicle');
    data.vehicle = b.vehicle;
  }
  if (b.maxRadiusKm !== undefined) data.maxRadiusKm = Math.max(1, Math.min(30, Number(b.maxRadiusKm) || 8));
  if (b.vehicleModel !== undefined) {
    data.vehicleModel = optText(b.vehicleModel, 40, 'Make & model');
    if (data.vehicleModel && data.vehicleModel.length < 2) bad('Make & model must be 2–40 characters');
  }
  if (b.maxRadiusKm !== undefined && !(Number(b.maxRadiusKm) >= 1 && Number(b.maxRadiusKm) <= 30)) bad('Max pickup distance must be 1–30 km');
  if (b.vehicleNumber !== undefined) data.vehicleNumber = String(b.vehicleNumber || '').trim().toUpperCase().replace(/\s+/g, ' ') || null;
  const vehicle = data.vehicle || req.user.volunteerProfile.vehicle;
  const vehicleTouched = b.vehicle !== undefined || b.vehicleNumber !== undefined;
  const model = data.vehicleModel !== undefined ? data.vehicleModel : req.user.volunteerProfile.vehicleModel;
  if (vehicle !== 'BICYCLE' && (b.vehicle !== undefined || b.vehicleModel !== undefined) && !model) bad('Make & model is required for motorised vehicles');
  if (vehicle === 'BICYCLE') { if (vehicleTouched) data.vehicleNumber = null; }
  else if (vehicleTouched) {
    const plate = data.vehicleNumber !== undefined ? data.vehicleNumber : req.user.volunteerProfile.vehicleNumber;
    if (!plate || !/^[A-Z]{2}\s?\d{1,2}\s?[A-Z]{0,3}\s?\d{4}$/.test(plate)) throw new HttpError(400, 'Enter a valid vehicle registration number, e.g. KA 01 AB 1234');
  }
  if (b.pincode !== undefined) {
    const loc = findLocation(b);
    if (!loc) throw new HttpError(400, 'Choose a valid country, state, city and pincode');
    if (loc.pincode !== req.user.volunteerProfile.pincode) Object.assign(data, pointNear(loc));
    Object.assign(data, { country: loc.country, state: loc.state, city: loc.city, pincode: loc.pincode, area: loc.area });
  }
  res.json(await prisma.volunteerProfile.update({ where: { userId: req.user.id }, data }));
}));

// ---------- Earnings & payouts ----------
const sum = (xs) => xs.reduce((s, x) => s + x.amount, 0);

r.get('/earnings', ah(async (req, res) => {
  const uid = req.user.id;
  const [earnings, payouts, vp] = await Promise.all([
    prisma.earning.findMany({
      where: { volunteerId: uid },
      orderBy: { createdAt: 'desc' },
      include: { listing: { select: { id: true, title: true, claim: { select: { receiverOrg: { select: { name: true } } } } } } },
    }),
    prisma.payout.findMany({ where: { volunteerId: uid }, orderBy: { requestedAt: 'desc' }, take: 20 }),
    prisma.volunteerProfile.findUnique({ where: { userId: uid }, select: { upiId: true } }),
  ]);
  const weekAgo = Date.now() - 7 * 86400000;
  res.json({
    totals: {
      available: sum(earnings.filter((e) => !e.payoutId)),
      earned: sum(earnings),
      paidOut: sum(payouts.filter((p) => p.status === 'PAID')),
      pending: sum(payouts.filter((p) => p.status === 'PENDING')),
      thisWeek: sum(earnings.filter((e) => +e.createdAt >= weekAgo)),
      deliveries: earnings.length,
    },
    minPayout: FEE.MIN_PAYOUT,
    upiId: vp?.upiId || '',
    earnings: earnings.slice(0, 50).map((e) => ({
      id: e.id, amount: e.amount, createdAt: e.createdAt, paidOut: !!e.payoutId,
      listingId: e.listing.id, title: e.listing.title, receiver: e.listing.claim?.receiverOrg?.name || null,
    })),
    payouts,
  });
}));

r.post('/payouts', ah(async (req, res) => {
  const uid = req.user.id;
  const upiId = String(req.body?.upiId || '').trim();
  if (!UPI_RE.test(upiId)) bad('Enter a valid UPI ID, e.g. name@okbank');
  const payout = await prisma.$transaction(async (tx) => {
    const open = await tx.earning.findMany({ where: { volunteerId: uid, payoutId: null }, select: { id: true, amount: true } });
    const amount = sum(open);
    if (amount < FEE.MIN_PAYOUT) bad(`You need at least ₹${FEE.MIN_PAYOUT} to request a payout (available: ₹${amount})`);
    const settle = autoSettle();
    const p = await tx.payout.create({ data: { volunteerId: uid, amount, upiId, status: settle ? 'PAID' : 'PENDING', paidAt: settle ? new Date() : null } });
    // Only claim earnings that are still unpaid, so two parallel requests can't pay the same earning twice
    const linked = await tx.earning.updateMany({ where: { id: { in: open.map((e) => e.id) }, payoutId: null }, data: { payoutId: p.id } });
    if (linked.count !== open.length) throw new HttpError(409, 'Your balance changed. Please try again.');
    await tx.volunteerProfile.update({ where: { userId: uid }, data: { upiId } });
    return p;
  });
  const paid = payout.status === 'PAID';
  await notifyUsers([req.user], {
    message: paid ? `₹${payout.amount} paid to ${upiId}` : `Payout of ₹${payout.amount} requested to ${upiId}`,
    link: '/volunteer/earnings',
    email: {
      subject: paid ? `Payout of ₹${payout.amount} sent` : `Payout of ₹${payout.amount} requested`,
      html: paid
        ? `<p><b>₹${payout.amount}</b> has been paid to your UPI ID <b>${upiId}</b>. Thank you for every delivery.</p>`
        : `<p>We received your payout request for <b>₹${payout.amount}</b> to <b>${upiId}</b>. It will be settled shortly.</p>`,
    },
  });
  res.status(201).json(payout);
}));

export default r;
