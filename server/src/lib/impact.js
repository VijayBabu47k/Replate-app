import { prisma } from './prisma.js';
import { CATEGORY_INFO } from './safety.js';

export async function getAssumptions() {
  const rows = await prisma.impactAssumption.findMany({ orderBy: { key: 'asc' } });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    rows,
    kgPerMeal: map.KG_PER_MEAL ?? 0.4,
    co2ePerKg: map.CO2E_PER_KG ?? 2.5,
    waterLPerKg: map.WATER_L_PER_KG ?? 1000,
    defaultDisposalCostPerKg: map.DISPOSAL_COST_PER_KG ?? 6,
  };
}

function weekStart(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Monday
  return x;
}

/**
 * Compute impact for any scope. Only DELIVERED listings that the receiver did not reject count
 * as "saved". Expired / cancelled / rejected food is reported separately as loss.
 */
export async function computeImpact({ donorOrgId, receiverOrgId, zone, volunteerId, weeks = 8 } = {}) {
  const a = await getAssumptions();
  const where = {};
  if (donorOrgId) where.donorOrgId = donorOrgId;
  if (zone) where.donorOrg = { zone };
  if (receiverOrgId) where.claim = { receiverOrgId };
  if (volunteerId) where.claim = { volunteerId };

  const listings = await prisma.listing.findMany({
    where,
    include: { claim: { include: { receiverOrg: { select: { id: true, name: true } } } }, donorOrg: { select: { id: true, name: true, zone: true, disposalCostPerKg: true } } },
  });

  const saved = listings.filter((l) => l.status === 'DELIVERED' && l.claim?.qualityAccepted !== false);
  const kgOf = (l) => l.claim?.receivedKg ?? l.quantityKg;
  const totalKg = saved.reduce((s, l) => s + kgOf(l), 0);
  const disposal = saved.reduce((s, l) => s + kgOf(l) * (l.donorOrg.disposalCostPerKg ?? a.defaultDisposalCostPerKg), 0);

  // Weekly trend
  const since = weekStart(new Date(Date.now() - (weeks - 1) * 7 * 86400000));
  const trendMap = {};
  for (let i = 0; i < weeks; i++) {
    const w = new Date(since.getTime() + i * 7 * 86400000);
    trendMap[w.toISOString().slice(0, 10)] = { week: w.toISOString().slice(0, 10), kg: 0, meals: 0, posted: 0, lost: 0 };
  }
  for (const l of listings) {
    const key = weekStart(l.createdAt).toISOString().slice(0, 10);
    const t = trendMap[key];
    if (!t) continue;
    t.posted += 1;
    if (saved.includes(l)) {
      t.kg += kgOf(l);
      t.meals += kgOf(l) / a.kgPerMeal;
    } else if (['EXPIRED', 'CANCELLED', 'REJECTED'].includes(l.status)) t.lost += 1;
  }
  const trend = Object.values(trendMap).map((t) => ({ ...t, kg: +t.kg.toFixed(1), meals: Math.round(t.meals) }));

  const byCategory = {};
  for (const l of saved) {
    const k = CATEGORY_INFO[l.category]?.label || l.category;
    byCategory[k] = (byCategory[k] || 0) + kgOf(l);
  }

  const byZone = {};
  for (const l of saved) byZone[l.donorOrg.zone] = (byZone[l.donorOrg.zone] || 0) + kgOf(l);

  const byReceiver = {};
  for (const l of saved) {
    const n = l.claim?.receiverOrg?.name;
    if (n) byReceiver[n] = (byReceiver[n] || 0) + kgOf(l);
  }

  const funnel = {
    posted: listings.length,
    claimed: listings.filter((l) => l.claim).length,
    collected: listings.filter((l) => l.claim?.collectedAt).length,
    delivered: listings.filter((l) => ['DELIVERED', 'REJECTED'].includes(l.status)).length,
    accepted: saved.length,
  };
  const losses = {
    expired: listings.filter((l) => l.status === 'EXPIRED').length,
    cancelled: listings.filter((l) => l.status === 'CANCELLED').length,
    rejected: listings.filter((l) => l.status === 'REJECTED').length,
  };

  const fmt = (o) => Object.entries(o).map(([name, kg]) => ({ name, kg: +kg.toFixed(1), meals: Math.round(kg / a.kgPerMeal) })).sort((x, y) => y.kg - x.kg);

  return {
    totals: {
      kgSaved: +totalKg.toFixed(1),
      mealsSaved: Math.round(totalKg / a.kgPerMeal),
      co2eKg: Math.round(totalKg * a.co2ePerKg),
      waterLitres: Math.round(totalKg * a.waterLPerKg),
      disposalSavingsInr: Math.round(disposal),
      deliveries: saved.length,
      rescueRate: listings.length ? +(saved.length / listings.length).toFixed(2) : 0,
    },
    formulas: {
      mealsSaved: `kg delivered & accepted ÷ ${a.kgPerMeal} kg per meal`,
      co2eKg: `kg delivered × ${a.co2ePerKg} kg CO₂e per kg of food waste avoided`,
      waterLitres: `kg delivered × ${a.waterLPerKg} L embedded water per kg`,
      disposalSavingsInr: `kg delivered × donor's disposal cost per kg (default ₹${a.defaultDisposalCostPerKg})`,
      rescueRate: 'delivered & accepted listings ÷ all posted listings',
    },
    assumptions: a.rows,
    trend,
    byCategory: fmt(byCategory),
    byZone: fmt(byZone),
    byReceiver: fmt(byReceiver),
    funnel,
    losses,
  };
}
