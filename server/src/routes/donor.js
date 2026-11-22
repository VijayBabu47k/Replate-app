import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { ah } from '../lib/asyncHandler.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { getAssumptions } from '../lib/impact.js';
import { HttpError } from '../lib/asyncHandler.js';
import { toKg, computeConsumeBy, CATEGORY_INFO } from '../lib/safety.js';
import { rankReceivers } from '../lib/matching.js';
import { FEE, suggestFee, median } from '../lib/fees.js';

const r = Router();
r.use(requireAuth, requireRole('DONOR'));

// ---------- Last post (powers 'Repeat last' on the Post surplus page) ----------
r.get('/last-post', ah(async (req, res) => {
  const last = await prisma.listing.findFirst({ where: { donorOrgId: req.user.organizationId }, orderBy: { createdAt: 'desc' } });
  res.json({ last });
}));

// ---------- Surplus analytics: the "why use it every week" value ----------
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Suggested delivery fee for a draft post: based on the distance to the likely receivers
r.post('/fee-estimate', ah(async (req, res) => {
  const b = req.body || {};
  if (!CATEGORY_INFO[b.category]) throw new HttpError(400, 'Choose a food category');
  const qty = Number(b.quantity);
  if (!(qty > 0)) throw new HttpError(400, 'Enter a quantity');
  const quantityKg = toKg(b.category, qty, b.unit || 'KG');
  const preparedAt = new Date(Date.now() - (Number(b.preparedMinsAgo) || 30) * 60000);
  const { kgPerMeal } = await getAssumptions();
  const draft = {
    donorOrgId: req.user.organizationId,
    dietType: b.dietType || 'VEG',
    storage: b.storage || 'HOT_HELD',
    consumeBy: computeConsumeBy(b.category, b.storage || 'HOT_HELD', preparedAt),
    estimatedMeals: Math.max(1, Math.round(quantityKg / kgPerMeal)),
  };
  const ranked = await rankReceivers(draft);
  const km = median(ranked.filter((m) => m.eligible).slice(0, 3).map((m) => m.distanceKm)) ?? FEE.DEFAULT_KM;
  res.json({ suggested: suggestFee({ kmEstimate: km, quantityKg }), km: +km.toFixed(1), min: FEE.MIN, max: FEE.MAX });
}));

r.get('/analytics', ah(async (req, res) => {
  const a = await getAssumptions();
  const foodCost = a.rows.find((x) => x.key === 'FOOD_COST_PER_KG')?.value ?? 90;
  const since = new Date(Date.now() - 56 * 86400000);
  const listings = await prisma.listing.findMany({ where: { donorOrgId: req.user.organizationId, createdAt: { gte: since } } });
  const weeks = 8;

  const byDay = DAYS.map((d) => ({ day: d, kg: 0, posts: 0 }));
  const byTitle = {};
  const byCategory = {};
  let totalKg = 0;
  let totalPostSec = 0;
  let timedPosts = 0;
  for (const l of listings) {
    const d = new Date(l.createdAt).getDay();
    byDay[d].kg += l.quantityKg;
    byDay[d].posts += 1;
    totalKg += l.quantityKg;
    const t = (byTitle[l.title] ||= { title: l.title, kg: 0, count: 0, days: {} });
    t.kg += l.quantityKg;
    t.count += 1;
    t.days[DAYS[d]] = (t.days[DAYS[d]] || 0) + l.quantityKg;
    byCategory[l.category] = (byCategory[l.category] || 0) + l.quantityKg;
    if (l.postDurationSec) { totalPostSec += l.postDurationSec; timedPosts += 1; }
  }

  // Overproduction insights: items that repeatedly show up as surplus on the same weekday
  const insights = Object.values(byTitle)
    .filter((t) => t.count >= 3)
    .map((t) => {
      const [peakDay, peakKg] = Object.entries(t.days).sort((x, y) => y[1] - x[1])[0];
      const avgPerWeek = peakKg / weeks;
      return {
        title: t.title,
        peakDay,
        avgKgOnPeakDay: +avgPerWeek.toFixed(1),
        occurrences: t.count,
        monthlyFoodCostInr: Math.round(avgPerWeek * 4.3 * foodCost),
        suggestion: `Try cooking ~${Math.max(1, Math.round(avgPerWeek * 0.7))} kg less ${t.title.toLowerCase()} on ${peakDay}s.`,
      };
    })
    .sort((x, y) => y.monthlyFoodCostInr - x.monthlyFoodCostInr)
    .slice(0, 5);

  const fees = await prisma.earning.aggregate({ _sum: { amount: true }, _count: true, where: { listing: { donorOrgId: req.user.organizationId } } });

  res.json({
    periodDays: 56,
    deliveryFeesPaid: fees._sum.amount || 0,
    paidDeliveries: fees._count,
    totalKg: +totalKg.toFixed(1),
    totalPosts: listings.length,
    avgPostSeconds: timedPosts ? Math.round(totalPostSec / timedPosts) : null,
    foodCostPerKg: foodCost,
    byDay: byDay.map((d) => ({ ...d, kg: +(d.kg / weeks).toFixed(1) })),
    byCategory: Object.entries(byCategory).map(([name, kg]) => ({ name, kg: +kg.toFixed(1) })).sort((x, y) => y.kg - x.kg),
    insights,
  });
}));

export default r;
