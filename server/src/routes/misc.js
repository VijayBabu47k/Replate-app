import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { ah } from '../lib/asyncHandler.js';
import { requireAuth } from '../lib/auth.js';
import { CATEGORY_INFO, safeHours, DELIVERY_BUFFER_MIN } from '../lib/safety.js';
import { WEIGHTS } from '../lib/matching.js';
import { LOCATIONS } from '../lib/locations.js';
import { getAssumptions } from '../lib/impact.js';
import { FEE } from '../lib/fees.js';

const r = Router();

// Public metadata used by forms
r.get('/meta', ah(async (_req, res) => {
  const storages = ['ROOM_TEMP', 'HOT_HELD', 'REFRIGERATED'];
  const a = await getAssumptions();
  res.json({
    locations: LOCATIONS.map((c) => ({ name: c.name, states: c.states.map((s) => ({ name: s.name, cities: s.cities.map((ci) => ({ name: ci.name, pincodes: ci.pincodes.map((p) => ({ code: p.code, area: p.area })) })) })) })),
    categories: Object.entries(CATEGORY_INFO).map(([value, i]) => ({
      value, label: i.label, highRisk: i.highRisk,
      safeHours: Object.fromEntries(storages.map((s) => [s, safeHours(value, s)])),
      kgPerServing: i.kgPerServing, kgPerTray: i.kgPerTray, kgPerVessel: i.kgPerVessel,
    })),
    storages,
    diets: ['VEG', 'JAIN', 'VEGAN', 'EGG', 'NON_VEG'],
    units: ['SERVINGS', 'KG', 'TRAYS', 'VESSELS'],
    allergens: ['Nuts', 'Peanuts', 'Dairy', 'Gluten', 'Soy', 'Egg', 'Sesame', 'Mustard', 'Fish', 'Shellfish'],
    vehicles: ['BICYCLE', 'BIKE', 'CAR', 'VAN'],
    deliveryBufferMin: DELIVERY_BUFFER_MIN,
    matchingWeights: WEIGHTS,
    kgPerMeal: a.kgPerMeal,
    deliveryFee: { min: FEE.MIN, max: FEE.MAX, minPayout: FEE.MIN_PAYOUT },
  });
}));

r.get('/notifications', requireAuth, ah(async (req, res) => {
  const items = await prisma.notification.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 40 });
  const unread = await prisma.notification.count({ where: { userId: req.user.id, read: false } });
  res.json({ items, unread });
}));

r.post('/notifications/read-all', requireAuth, ah(async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user.id, read: false }, data: { read: true } });
  res.json({ ok: true });
}));

// Outbox: emails sent by Nodemailer to the signed-in user (demo inbox)
r.get('/emails', requireAuth, ah(async (req, res) => {
  const items = await prisma.emailLog.findMany({ where: { to: req.user.email }, orderBy: { createdAt: 'desc' }, take: 50 });
  res.json({ items });
}));

export default r;
