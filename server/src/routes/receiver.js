import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { ah, HttpError } from '../lib/asyncHandler.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { DIETS, bad, optText, wholeIn } from '../lib/validate.js';

const r = Router();
r.use(requireAuth, requireRole('RECEIVER'));

r.get('/profile', ah(async (req, res) => {
  const profile = await prisma.receiverProfile.findUnique({ where: { organizationId: req.user.organizationId } });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const claimsToday = await prisma.claim.findMany({
    where: { receiverOrgId: req.user.organizationId, claimedAt: { gte: today }, listing: { status: { notIn: ['CANCELLED', 'EXPIRED'] } } },
    include: { listing: { select: { estimatedMeals: true } } },
  });
  const mealsToday = claimsToday.reduce((s, c) => s + c.listing.estimatedMeals, 0);
  res.json({
    organization: req.user.organization,
    profile,
    mealsToday,
  });
}));

r.patch('/profile', ah(async (req, res) => {
  const b = req.body || {};
  const data = {};
  if (b.capacityMealsPerDay !== undefined) data.capacityMealsPerDay = wholeIn(b.capacityMealsPerDay, 1, 10000, 'Capacity');
  if (b.dietAccepted !== undefined) {
    if (!Array.isArray(b.dietAccepted) || !b.dietAccepted.length || b.dietAccepted.some((d) => !DIETS.includes(d))) bad('Choose at least one valid food type');
    data.dietAccepted = [...new Set(b.dietAccepted)];
  }
  for (const k of ['intakeStart', 'intakeEnd']) if (b[k] !== undefined) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(b[k])) bad(`${k === 'intakeStart' ? 'Opening' : 'Closing'} time must be HH:MM`);
    data[k] = b[k];
  }
  if (data.intakeStart || data.intakeEnd) {
    const cur = await prisma.receiverProfile.findUnique({ where: { organizationId: req.user.organizationId }, select: { intakeStart: true, intakeEnd: true } });
    if ((data.intakeEnd || cur.intakeEnd) <= (data.intakeStart || cur.intakeStart)) bad('Closing time must be after the opening time');
  }
  for (const k of ['hasFridge', 'acceptingToday', 'canSelfPickup']) if (b[k] !== undefined) data[k] = !!b[k];
  if (b.beneficiaryType !== undefined) data.beneficiaryType = optText(b.beneficiaryType, 80, 'Who you serve');
  if (b.beneficiariesCount !== undefined) data.beneficiariesCount = b.beneficiariesCount === '' ? 0 : wholeIn(b.beneficiariesCount, 0, 100000, 'People served');
  const profile = await prisma.receiverProfile.update({ where: { organizationId: req.user.organizationId }, data });
  res.json(profile);
}));

export default r;
