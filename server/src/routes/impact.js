import { Router } from 'express';
import { ah } from '../lib/asyncHandler.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { computeImpact } from '../lib/impact.js';
import { prisma } from '../lib/prisma.js';

const r = Router();
r.use(requireAuth);

// scope=mine (default for donor/receiver/volunteer) | city (everyone can see the city-wide view)
r.get('/', ah(async (req, res) => {
  const u = req.user;
  const scope = req.query.scope || 'mine';
  const zone = req.query.zone || undefined;
  let filter = { zone };
  if (scope === 'mine') {
    if (u.role === 'DONOR') filter.donorOrgId = u.organizationId;
    if (u.role === 'RECEIVER') filter.receiverOrgId = u.organizationId;
    if (u.role === 'VOLUNTEER') filter.volunteerId = u.id;
  }
  const impact = await computeImpact(filter);
  // Area filter options: every area/city that has a donor organisation
  const orgs = await prisma.organization.findMany({ where: { type: 'DONOR' }, select: { zone: true, city: true }, distinct: ['zone', 'city'], orderBy: [{ city: 'asc' }, { zone: 'asc' }] });
  const cities = [...new Set(orgs.map((o) => o.city))];
  res.json({ scope, city: cities.join(' · '), zones: orgs.map((o) => ({ value: o.zone, label: `${o.zone}, ${o.city}` })), ...impact });
}));

r.get('/report.csv', requireRole('DONOR'), ah(async (req, res) => {
  const filter = { donorOrgId: req.user.organizationId };
  const imp = await computeImpact({ ...filter, weeks: 12 });
  const lines = [
    '# RePlate — impact record (synthetic demo data). Not a tax or legal document.',
    'week_starting,listings_posted,kg_saved,meals_saved,listings_lost',
    ...imp.trend.map((t) => `${t.week},${t.posted},${t.kg},${t.meals},${t.lost}`),
    '',
    'assumption,value,unit,source',
    ...imp.assumptions.map((a) => `"${a.label}",${a.value},"${a.unit}","${a.source}"`),
  ];
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="impact-report.csv"');
  res.send(lines.join('\n'));
}));

export default r;
