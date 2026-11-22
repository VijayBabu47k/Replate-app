import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { ah, HttpError } from '../lib/asyncHandler.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { computeConsumeBy, toKg, DELIVERY_BUFFER_MIN, CATEGORY_INFO } from '../lib/safety.js';
import { rankReceivers, scoreFor } from '../lib/matching.js';
import { listingInclude, serializeListing } from '../lib/serialize.js';
import { addEvent, otp, expireStale, broadcast, alertVolunteers } from '../lib/lifecycle.js';
import { notifyUsers, orgUsers, mail } from '../lib/notify.js';
import { getAssumptions } from '../lib/impact.js';
import { DIETS, UNITS, STORAGES, QTY_LIMITS, bad, str, isWhole, optText, wholeIn } from '../lib/validate.js';
import { FEE } from '../lib/fees.js';

const r = Router();
r.use(requireAuth);

// ---------- Email content helpers ----------
const when = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const fullAddress = (o) => (o ? mail.esc([o.address, o.zone, o.city].filter(Boolean).join(', ') + (o.pincode ? ` – ${o.pincode}` : '')) : '');
const foodRows = (l) => [
  ['Food', mail.esc(l.title)],
  ['Quantity', `${l.quantityKg} kg · about ${l.estimatedMeals} meals`],
  ['Allergens', mail.esc(l.allergens?.length ? l.allergens.join(', ') : 'None declared')],
  ['Pickup by', when(l.pickupBy)],
  ['Consume by', when(l.consumeBy)],
];
/** "919876543210" -> "+91 98765 43210" (readable), digits kept for tel: links. */
const fmtPhone = (raw) => {
  const d = String(raw || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) return `+91 ${d.slice(2, 7)} ${d.slice(7)}`;
  if (d.length === 10) return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
  return d ? `+${d}` : '';
};
const telHref = (raw) => {
  const d = String(raw || '').replace(/\D/g, '');
  return d.length === 10 ? `tel:+91${d}` : `tel:+${d}`;
};

/** Highlighted "please pay the volunteer" box for the donor, with phone and UPI ID. */
export const payVolunteerBox = (vol, amount, title) => {
  const phone = fmtPhone(vol.phone);
  const upi = vol.volunteerProfile?.upiId;
  const row = (k, v) => `<tr><td style="padding:5px 0;color:#065f46;width:34%">${k}</td><td style="padding:5px 0;font-weight:700;color:#064e3b">${v}</td></tr>`;
  return `<div style="margin:8px 0 16px;padding:16px 18px;border:1px solid #a7f3d0;border-radius:12px;background:#ecfdf5">
    <div style="font-size:15px;font-weight:700;color:#064e3b;margin-bottom:4px">Please pay ₹${amount} to the volunteer</div>
    <div style="font-size:13px;color:#047857;margin-bottom:8px">Send the delivery fee directly to ${mail.esc(vol.name)} by UPI or phone payment (GPay, PhonePe, Paytm).</div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:13.5px;border-collapse:collapse">
      ${row('Volunteer', mail.esc(vol.name))}
      ${phone ? row('Phone', `<a href="${telHref(vol.phone)}" style="color:#064e3b;text-decoration:none">${mail.esc(phone)}</a>`) : ''}
      ${upi ? row('UPI ID', mail.esc(upi)) : ''}
      ${row('Amount', `₹${amount}`)}
    </table>
    <div style="font-size:12px;color:#047857;margin-top:8px">Please add "RePlate: ${mail.esc(title)}" in the payment note so the volunteer can match it.</div>
  </div>`;
};

const vehicleText = (v) => {
  const p = v?.volunteerProfile;
  if (!p) return '';
  return mail.esc([{ BICYCLE: 'Bicycle', BIKE: 'Bike / scooter', CAR: 'Car', VAN: 'Van' }[p.vehicle], p.vehicleModel, p.vehicleNumber].filter(Boolean).join(' · '));
};

const load = (id) => prisma.listing.findUnique({ where: { id }, include: listingInclude });

async function mustLoad(id) {
  const l = await load(id);
  if (!l) throw new HttpError(404, 'Listing not found');
  return l;
}

// ---------- List ----------
r.get('/', ah(async (req, res) => {
  await expireStale();
  const u = req.user;
  const { status, scope } = req.query;
  const where = {};
  if (status) where.status = { in: String(status).split(',') };

  if (u.role === 'DONOR') where.donorOrgId = u.organizationId;
  else if (u.role === 'RECEIVER') {
    if (scope === 'feed') where.status = 'POSTED';
    else where.claim = { receiverOrgId: u.organizationId };
  } else if (u.role === 'VOLUNTEER') where.claim = { volunteerId: u.id };

  const rows = await prisma.listing.findMany({
    where,
    include: listingInclude,
    orderBy: { createdAt: 'desc' },
    take: Math.min(Number(req.query.limit) || 200, 500),
  });
  let items = rows.map((l) => serializeListing(l, u));

  if (u.role === 'RECEIVER' && scope === 'feed') {
    const withScores = [];
    for (const l of rows) {
      const m = await scoreFor(l, u.organizationId);
      withScores.push({ ...serializeListing(l, u), match: m });
    }
    items = withScores.sort((a, b) => (b.match?.eligible - a.match?.eligible) || (b.match?.score ?? 0) - (a.match?.score ?? 0));
  }
  res.json({ items });
}));

r.get('/:id', ah(async (req, res) => {
  await expireStale();
  const l = await mustLoad(req.params.id);
  const u = req.user;
  if (u.role === 'DONOR' && l.donorOrgId !== u.organizationId) throw new HttpError(403, 'Not your listing');
  const out = serializeListing(l, u);
  if (u.role === 'RECEIVER' && l.status === 'POSTED') out.match = await scoreFor(l, u.organizationId);
  res.json(out);
}));

r.get('/:id/matches', requireRole('DONOR'), ah(async (req, res) => {
  const l = await mustLoad(req.params.id);
  if (req.user.role === 'DONOR' && l.donorOrgId !== req.user.organizationId) throw new HttpError(403, 'Not your listing');
  const matches = await rankReceivers(l, { includeExcluded: true });
  res.json({ matches: matches.map(({ coordinators, ...m }) => m) });
}));

// ---------- Donor: create (target < 60s) ----------
r.post('/', requireRole('DONOR'), ah(async (req, res) => {
  const b = req.body || {};
  const required = ['title', 'category', 'dietType', 'quantity', 'unit', 'storage', 'pickupBy'];
  for (const k of required) if (b[k] === undefined || b[k] === '') throw new HttpError(400, `${k} is required`);
  if (!CATEGORY_INFO[b.category]) throw new HttpError(400, 'Unknown food category');
  if (!b.declarationAccepted) throw new HttpError(400, 'Please confirm the donor declaration');
  if (!Array.isArray(b.allergens)) throw new HttpError(400, 'Allergens must be declared (send an empty list if none)');
  const title = str(b.title);
  if (title.length < 2 || title.length > 80 || !/[A-Za-z]/.test(title)) bad('Dish name must be 2–80 characters and include a letter');
  if (!DIETS.includes(b.dietType)) bad('Unknown diet type');
  if (!UNITS.includes(b.unit)) bad('Unknown unit');
  if (!STORAGES.includes(b.storage)) bad('Unknown storage type');
  const qty = Number(b.quantity);
  if (!Number.isFinite(qty) || qty <= 0) bad('Quantity must be greater than 0');
  if (b.unit !== 'KG' && !isWhole(b.quantity)) bad('Quantity must be a whole number for this unit');
  if (qty > QTY_LIMITS[b.unit]) bad(`Quantity can be at most ${QTY_LIMITS[b.unit]} ${b.unit.toLowerCase()} per post`);
  if (b.allergens.length > 20 || b.allergens.some((a) => typeof a !== 'string' || !a.trim() || a.length > 40)) bad('Invalid allergen list');
  const notes = optText(b.notes, 300, 'Notes');
  const pickupInstructions = optText(b.pickupInstructions, 200, 'Pickup instructions');
  if (b.preparedAt && Number.isNaN(new Date(b.preparedAt).getTime())) bad('Invalid prepared time');
  if (b.preparedAt && new Date(b.preparedAt) > new Date(Date.now() + 60000)) bad('Prepared time cannot be in the future');
  if (Number.isNaN(new Date(b.pickupBy).getTime())) bad('Invalid pickup-by time');
  const deliveryFee = b.deliveryFee === undefined || b.deliveryFee === '' ? 0 : wholeIn(b.deliveryFee, FEE.MIN, FEE.MAX, 'Delivery fee (₹)');

  const preparedAt = b.preparedAt ? new Date(b.preparedAt) : new Date(Date.now() - 30 * 60000);
  const pickupBy = new Date(b.pickupBy);
  const consumeBy = computeConsumeBy(b.category, b.storage, preparedAt);
  const now = new Date();
  if (pickupBy <= now) throw new HttpError(400, 'Pickup-by time must be in the future');
  if (consumeBy - now < 45 * 60000)
    throw new HttpError(400, `This food's safe window closes at ${consumeBy.toLocaleTimeString('en-IN', { timeStyle: 'short' })} — too soon for a safe pickup and delivery. Please do not post it.`);
  const latestPickup = new Date(consumeBy.getTime() - DELIVERY_BUFFER_MIN * 60000);
  const finalPickupBy = pickupBy > latestPickup ? latestPickup : pickupBy;

  const { kgPerMeal } = await getAssumptions();
  const quantityKg = toKg(b.category, b.quantity, b.unit);
  const estimatedMeals = Math.max(1, Math.round(quantityKg / kgPerMeal));

  const listing = await prisma.listing.create({
    data: {
      donorOrgId: req.user.organizationId,
      createdById: req.user.id,
      title,
      category: b.category,
      dietType: b.dietType,
      quantity: qty,
      unit: b.unit,
      quantityKg,
      estimatedMeals,
      allergens: b.allergens.map(String),
      storage: b.storage,
      preparedAt,
      pickupBy: finalPickupBy,
      consumeBy,
      notes,
      pickupInstructions,
      deliveryFee,
      declarationAccepted: true,
      postDurationSec: b.postDurationSec ? Math.round(b.postDurationSec) : null,
      events: {
        create: {
          status: 'POSTED',
          actorId: req.user.id,
          note: finalPickupBy < pickupBy ? 'Pickup-by moved earlier so delivery finishes inside the safe window' : 'Listing posted',
        },
      },
    },
    include: listingInclude,
  });

  const notified = await broadcast(listing, 1);
  await notifyUsers(await orgUsers(listing.donorOrgId), {
    message: `"${listing.title}" is live. ${notified} matched receivers alerted.`,
    link: `/listings/${listing.id}`,
    email: {
      subject: `Your surplus is live: ${listing.title}`,
      html: mail.p(`Thanks for posting. We alerted <b>${notified}</b> best-matched receivers and will widen the search if nobody claims it within 5 minutes.`)
        + mail.details([...foodRows(listing), ['Delivery fee', listing.deliveryFee ? `₹${listing.deliveryFee} (paid to the volunteer on delivery)` : 'None']]),
      cta: 'Track this listing',
    },
  });
  const matches = (await rankReceivers(listing, { includeExcluded: true })).map(({ coordinators, ...m }) => m);
  res.status(201).json({ listing: serializeListing(listing, req.user), matches, notified, pickupAdjusted: finalPickupBy < pickupBy });
}));

r.post('/:id/cancel', requireRole('DONOR'), ah(async (req, res) => {
  const l = await mustLoad(req.params.id);
  if (l.donorOrgId !== req.user.organizationId) throw new HttpError(403, 'Not your listing');
  if (!['POSTED', 'CLAIMED', 'ASSIGNED'].includes(l.status)) throw new HttpError(400, `Cannot cancel a ${l.status.toLowerCase()} listing`);
  await prisma.listing.update({ where: { id: l.id }, data: { status: 'CANCELLED' } });
  await addEvent(l.id, 'CANCELLED', req.body?.reason || 'Cancelled by donor', req.user.id);
  const reason = mail.esc(req.body?.reason || 'Cancelled by donor');
  const affected = [...(await orgUsers(l.claim?.receiverOrgId)), l.claim?.volunteer].filter(Boolean);
  await notifyUsers(affected, {
    message: `"${l.title}" was cancelled by the donor.`,
    link: `/listings/${l.id}`,
    email: {
      subject: `Cancelled: ${l.title}`,
      html: mail.p(`<b>${mail.esc(l.donorOrg.name)}</b> cancelled <b>${mail.esc(l.title)}</b>. No pickup or delivery is needed.`) + mail.details([['Reason', reason]]),
    },
  });
  await notifyUsers(await orgUsers(l.donorOrgId), {
    message: `You cancelled "${l.title}"`,
    link: `/listings/${l.id}`,
    email: {
      subject: `Listing cancelled: ${l.title}`,
      html: mail.p(`Your listing <b>${mail.esc(l.title)}</b> was cancelled.${affected.length ? ' Everyone involved has been told.' : ''}`) + mail.details([['Reason', reason]]),
    },
  });
  res.json(serializeListing(await load(l.id), req.user));
}));

// ---------- Receiver: claim ----------
r.post('/:id/claim', requireRole('RECEIVER'), ah(async (req, res) => {
  const selfPickup = !!req.body?.selfPickup;
  if (selfPickup && !req.user.organization?.receiverProfile?.canSelfPickup) {
    throw new HttpError(400, 'Self pickup is turned off for your organisation. Turn on "We can collect ourselves" in Needs & capacity, or claim for delivery.');
  }
  const result = await prisma.$transaction(async (tx) => {
    const l = await tx.listing.findUnique({ where: { id: req.params.id } });
    if (!l) throw new HttpError(404, 'Listing not found');
    if (l.status !== 'POSTED') throw new HttpError(409, 'Someone else has already claimed this listing');
    if (new Date(l.consumeBy) < new Date()) throw new HttpError(409, 'This listing has expired');
    // Guarded update prevents two receivers claiming at the same moment
    const upd = await tx.listing.updateMany({ where: { id: l.id, status: 'POSTED' }, data: { status: 'CLAIMED' } });
    if (!upd.count) throw new HttpError(409, 'Someone else has already claimed this listing');
    return l;
  });
  const full = await load(result.id);
  const m = await scoreFor(full, req.user.organizationId);
  if (m && !m.eligible) {
    // roll back: receiver isn't eligible (e.g. diet clash / closed / no time)
    await prisma.listing.update({ where: { id: result.id }, data: { status: 'POSTED' } });
    throw new HttpError(400, `You can't claim this: ${m.excluded.join('; ')}`);
  }
  await prisma.claim.create({
    data: {
      listingId: result.id,
      receiverOrgId: req.user.organizationId,
      claimedById: req.user.id,
      selfPickup,
      matchScore: m?.score ?? 0,
      pickupOtp: otp(),
      deliveryOtp: otp(),
    },
  });
  await addEvent(result.id, 'CLAIMED', `Claimed by ${req.user.organization.name}${selfPickup ? ' (self pickup)' : ' — volunteer needed'}`, req.user.id);

  const claimed = await load(result.id);
  const rOrg = claimed.claim.receiverOrg;
  await notifyUsers(await orgUsers(result.donorOrgId), {
    message: `${req.user.organization.name} claimed "${result.title}"`,
    link: `/listings/${result.id}`,
    email: {
      subject: `Claimed: ${result.title}`,
      html: mail.p(`<b>${mail.esc(rOrg.name)}</b> claimed your listing. ${selfPickup ? 'They will collect it themselves.' : 'We are finding a volunteer to deliver it now.'}`)
        + mail.code('Pickup code: give this to the collector', claimed.claim.pickupOtp)
        + mail.details([...foodRows(claimed), ['Receiver', mail.esc(rOrg.name)], ['Delivery', selfPickup ? 'Receiver collects' : 'Volunteer delivers']]),
    },
  });
  await notifyUsers(await orgUsers(req.user.organizationId), {
    message: `You claimed "${result.title}"${selfPickup ? ' for self pickup' : '. Finding a volunteer.'}`,
    link: `/listings/${result.id}`,
    email: {
      subject: `You claimed: ${result.title}`,
      html: (selfPickup
        ? mail.p('Please collect it from the donor before the pickup time. Ask their staff for the 4-digit pickup code and enter it in the app.')
        : mail.p('We are alerting nearby volunteers. Share the delivery code below <b>only when the food reaches you</b>.') + mail.code('Delivery code', claimed.claim.deliveryOtp))
        + mail.details([...foodRows(claimed), ['Pickup from', `${mail.esc(claimed.donorOrg.name)}<br><span style="font-weight:400">${fullAddress(claimed.donorOrg)}</span>`], ['Instructions', mail.esc(claimed.pickupInstructions || '')]]),
    },
  });
  if (!selfPickup) await alertVolunteers(result.id);
  res.json(serializeListing(await load(result.id), req.user));
}));

// ---------- Volunteer: accept / release a task ----------
r.post('/:id/accept-task', requireRole('VOLUNTEER'), ah(async (req, res) => {
  // Duty status is stored on the volunteer profile; off-duty volunteers can't take new orders
  if (!req.user.volunteerProfile?.available) throw new HttpError(403, "You're off duty. Go on duty to accept pickups.");
  const l = await mustLoad(req.params.id);
  if (l.status !== 'CLAIMED' || !l.claim || l.claim.selfPickup || l.claim.volunteerId)
    throw new HttpError(409, 'This task is no longer available');
  const upd = await prisma.listing.updateMany({ where: { id: l.id, status: 'CLAIMED' }, data: { status: 'ASSIGNED' } });
  if (!upd.count) throw new HttpError(409, 'Another volunteer just took this task');
  await prisma.claim.update({ where: { id: l.claim.id }, data: { volunteerId: req.user.id, assignedAt: new Date() } });
  await addEvent(l.id, 'ASSIGNED', `${req.user.name} (${req.user.volunteerProfile?.vehicle?.toLowerCase() || 'volunteer'}) is on the way to pick up`, req.user.id);
  const vol = { ...req.user, volunteerProfile: req.user.volunteerProfile };
  const volRows = [['Volunteer', mail.esc(req.user.name)], ['Vehicle', vehicleText(vol)]];
  await notifyUsers(await orgUsers(l.donorOrgId), {
    message: `Volunteer ${req.user.name} is coming to collect "${l.title}"`,
    link: `/listings/${l.id}`,
    email: {
      subject: `Volunteer on the way: ${l.title}`,
      html: mail.p(`<b>${mail.esc(req.user.name)}</b> is on the way to collect <b>${mail.esc(l.title)}</b>. Give them the pickup code when they arrive.`)
        + mail.code('Pickup code', l.claim.pickupOtp) + mail.details(volRows),
    },
  });
  await notifyUsers(await orgUsers(l.claim.receiverOrgId), {
    message: `Volunteer ${req.user.name} will deliver "${l.title}"`,
    link: `/listings/${l.id}`,
    email: {
      subject: `Volunteer assigned: ${l.title}`,
      html: mail.p(`<b>${mail.esc(req.user.name)}</b> will collect <b>${mail.esc(l.title)}</b> from ${mail.esc(l.donorOrg.name)} and bring it to you. Share your delivery code only when the food arrives.`)
        + mail.code('Delivery code', l.claim.deliveryOtp) + mail.details(volRows),
    },
  });
  await notifyUsers([req.user], {
    message: `You accepted "${l.title}". Head to the pickup point.`,
    link: '/volunteer',
    email: {
      subject: `Pickup confirmed: ${l.title}`,
      html: mail.p('Thanks for taking this pickup. Ask the donor for the 4-digit <b>pickup code</b>, and the receiver for the <b>delivery code</b> when you arrive.')
        + mail.details([
          ...foodRows(l),
          ['1. Pick up', `${mail.esc(l.donorOrg.name)}<br><span style="font-weight:400">${fullAddress(l.donorOrg)}</span>`],
          ['Instructions', mail.esc(l.pickupInstructions || '')],
          ['2. Deliver to', `${mail.esc(l.claim.receiverOrg.name)}<br><span style="font-weight:400">${fullAddress(l.claim.receiverOrg)}</span>`],
          ['You earn', l.deliveryFee ? `₹${l.deliveryFee} on delivery` : ''],
        ]),
      cta: 'Open my pickup',
    },
  });
  res.json(serializeListing(await load(l.id), req.user));
}));

r.post('/:id/release', requireRole('VOLUNTEER'), ah(async (req, res) => {
  const l = await mustLoad(req.params.id);
  if (l.claim?.volunteerId !== req.user.id || l.status !== 'ASSIGNED') throw new HttpError(400, 'You can only drop a task before pickup');
  await prisma.claim.update({ where: { id: l.claim.id }, data: { volunteerId: null, assignedAt: null } });
  await prisma.listing.update({ where: { id: l.id }, data: { status: 'CLAIMED' } });
  await addEvent(l.id, 'CLAIMED', `${req.user.name} dropped the task (${req.body?.reason || 'no reason given'}). Finding another volunteer.`, req.user.id);
  await notifyUsers([...(await orgUsers(l.donorOrgId)), ...(await orgUsers(l.claim.receiverOrgId))], {
    message: `${req.user.name} can't make it for "${l.title}". Finding another volunteer.`,
    link: `/listings/${l.id}`,
    email: {
      subject: `Finding a new volunteer: ${l.title}`,
      html: mail.p(`<b>${mail.esc(req.user.name)}</b> can no longer do this pickup. We have alerted other volunteers nearby and will email you when someone accepts.`) + mail.details(foodRows(l)),
    },
  });
  await notifyUsers([req.user], {
    message: `You dropped "${l.title}"`,
    link: '/volunteer',
    email: { subject: `Task released: ${l.title}`, html: mail.p(`You released <b>${mail.esc(l.title)}</b>. No problem, another volunteer has been alerted.`) },
  });
  await alertVolunteers(l.id);
  res.json(serializeListing(await load(l.id), req.user));
}));

// ---------- Handover: pickup OTP ----------
r.post('/:id/collect', requireRole('VOLUNTEER', 'RECEIVER'), ah(async (req, res) => {
  const l = await mustLoad(req.params.id);
  const u = req.user;
  const isVol = u.role === 'VOLUNTEER' && l.claim?.volunteerId === u.id && l.status === 'ASSIGNED';
  const isSelf = u.role === 'RECEIVER' && l.claim?.selfPickup && l.claim.receiverOrgId === u.organizationId && l.status === 'CLAIMED';
  if (!isVol && !isSelf) throw new HttpError(400, 'You are not the collector for this listing, or it is not ready for pickup');
  if (String(req.body?.otp) !== l.claim.pickupOtp) throw new HttpError(400, 'Wrong pickup code. Ask the donor for the 4-digit code.');
  if (new Date(l.consumeBy) < new Date()) throw new HttpError(409, 'Safe window has closed — do not collect this food');
  await prisma.claim.update({ where: { id: l.claim.id }, data: { collectedAt: new Date() } });
  await prisma.listing.update({ where: { id: l.id }, data: { status: 'COLLECTED' } });
  await addEvent(l.id, 'COLLECTED', 'Pickup code verified at donor', u.id);
  const collector = isVol ? mail.esc(u.name) : mail.esc(l.claim.receiverOrg.name);
  await notifyUsers(await orgUsers(l.donorOrgId), {
    message: `"${l.title}" was collected by ${isVol ? u.name : l.claim.receiverOrg.name}`,
    link: `/listings/${l.id}`,
    email: {
      subject: `Collected: ${l.title}`,
      html: mail.p(`<b>${collector}</b> collected <b>${mail.esc(l.title)}</b> from your kitchen. It is on its way to <b>${mail.esc(l.claim.receiverOrg.name)}</b>.`),
    },
  });
  if (isVol) {
    await notifyUsers(await orgUsers(l.claim.receiverOrgId), {
      message: `"${l.title}" is on its way to you`,
      link: `/listings/${l.id}`,
      email: {
        subject: `On its way: ${l.title}`,
        html: mail.p(`<b>${collector}</b> picked up <b>${mail.esc(l.title)}</b> and is heading to you. Share this code only when the food arrives.`)
          + mail.code('Delivery code', l.claim.deliveryOtp),
      },
    });
    await notifyUsers([u], {
      message: `Pickup confirmed for "${l.title}". Deliver to ${l.claim.receiverOrg.name}.`,
      link: `/listings/${l.id}`,
      email: {
        subject: `Picked up: ${l.title}`,
        html: mail.p('Pickup verified. Please deliver it now and ask the receiver for their delivery code.')
          + mail.details([['Deliver to', `${mail.esc(l.claim.receiverOrg.name)}<br><span style="font-weight:400">${fullAddress(l.claim.receiverOrg)}</span>`], ['Consume by', when(l.consumeBy)]]),
      },
    });
  }
  res.json(serializeListing(await load(l.id), u));
}));

// ---------- Handover: delivery OTP ----------
r.post('/:id/deliver', requireRole('VOLUNTEER', 'RECEIVER'), ah(async (req, res) => {
  const l = await mustLoad(req.params.id);
  const u = req.user;
  if (l.status !== 'COLLECTED') throw new HttpError(400, 'Listing must be collected first');
  if (u.role === 'VOLUNTEER') {
    if (l.claim.volunteerId !== u.id) throw new HttpError(403, 'Not your delivery');
    if (String(req.body?.otp) !== l.claim.deliveryOtp) throw new HttpError(400, 'Wrong delivery code. Ask the receiver for their 4-digit code.');
  } else if (!(l.claim.selfPickup && l.claim.receiverOrgId === u.organizationId)) throw new HttpError(403, 'Not your delivery');
  // Mark delivered and credit the volunteer in one transaction; the status guard stops a double delivery
  const paid = u.role === 'VOLUNTEER' && !l.claim.selfPickup && l.deliveryFee > 0;
  await prisma.$transaction(async (tx) => {
    const upd = await tx.listing.updateMany({ where: { id: l.id, status: 'COLLECTED' }, data: { status: 'DELIVERED' } });
    if (!upd.count) throw new HttpError(409, 'This delivery was already recorded');
    await tx.claim.update({ where: { id: l.claim.id }, data: { deliveredAt: new Date() } });
    if (paid) await tx.earning.create({ data: { volunteerId: u.id, listingId: l.id, amount: l.deliveryFee } });
  });
  await addEvent(l.id, 'DELIVERED', u.role === 'VOLUNTEER' ? 'Delivery code verified at receiver' : 'Brought back to receiver kitchen', u.id);
  if (u.role === 'VOLUNTEER') {
    await notifyUsers([u], {
      message: paid ? `You earned ₹${l.deliveryFee} for delivering "${l.title}"` : `Delivered "${l.title}". Thank you!`,
      link: paid ? '/volunteer/earnings' : '/volunteer',
      email: paid
        ? { subject: `You earned ₹${l.deliveryFee}`, html: mail.p(`Thanks for delivering <b>${mail.esc(l.title)}</b> to <b>${mail.esc(l.claim.receiverOrg.name)}</b>.`) + mail.p(`<b>₹${l.deliveryFee}</b> has been added to your earnings. Withdraw any time from the Earnings page.`), cta: 'View earnings' }
        : { subject: `Delivered: ${l.title}`, html: mail.p(`Thanks for delivering <b>${mail.esc(l.title)}</b> to <b>${mail.esc(l.claim.receiverOrg.name)}</b>. About ${l.estimatedMeals} meals will reach people today.`) },
    });
  }
  await notifyUsers(await orgUsers(l.claim.receiverOrgId), {
    message: `"${l.title}" delivered. Please check and confirm the food.`,
    link: `/listings/${l.id}`,
    email: {
      subject: `Delivered: ${l.title}. Please confirm`,
      html: mail.p(`<b>${mail.esc(l.title)}</b> has arrived. Check how it looks, smells and its temperature, then accept or reject it in the app. If in doubt, don't serve it.`)
        + mail.details([['Consume by', when(l.consumeBy)]]),
      cta: 'Check & confirm',
    },
  });
  await notifyUsers(await orgUsers(l.donorOrgId), {
    message: paid
      ? `"${l.title}" reached ${l.claim.receiverOrg.name}. Please pay ₹${l.deliveryFee} to ${u.name} (${fmtPhone(u.phone)}).`
      : `"${l.title}" reached ${l.claim.receiverOrg.name}`,
    link: `/listings/${l.id}`,
    email: {
      subject: paid ? `Delivered: ${l.title} · Please pay ₹${l.deliveryFee} to the volunteer` : `Delivered: ${l.title}`,
      title: `Delivered: ${l.title}`,
      html: mail.p(`<b>${mail.esc(l.title)}</b> reached <b>${mail.esc(l.claim.receiverOrg.name)}</b>${u.role === 'VOLUNTEER' ? ` thanks to <b>${mail.esc(u.name)}</b>` : ''}. The receiver is checking it now.`)
        + (paid ? payVolunteerBox(u, l.deliveryFee, l.title) : ''),
    },
  });
  res.json(serializeListing(await load(l.id), u));
}));

// ---------- Receiver: quality check ----------
r.post('/:id/confirm', requireRole('RECEIVER'), ah(async (req, res) => {
  const l = await mustLoad(req.params.id);
  if (l.claim?.receiverOrgId !== req.user.organizationId) throw new HttpError(403, 'Not your claim');
  if (l.status !== 'DELIVERED' || l.claim.qualityAccepted !== null) throw new HttpError(400, 'Nothing to confirm');
  const accepted = !!req.body?.accepted;
  let receivedKg = l.quantityKg;
  if (accepted && req.body?.receivedKg !== undefined && req.body.receivedKg !== '') {
    receivedKg = Number(req.body.receivedKg);
    if (!Number.isFinite(receivedKg) || receivedKg <= 0) bad('Quantity received must be greater than 0');
    if (receivedKg > l.quantityKg) bad(`Quantity received cannot be more than the ${l.quantityKg} kg sent`);
  }
  if (!accepted) {
    const reason = str(req.body?.reason);
    if (reason.length < 3 || reason.length > 200) bad('Please give a reason (3–200 characters)');
    req.body.reason = reason;
  }
  await prisma.claim.update({
    where: { id: l.claim.id },
    data: { qualityAccepted: accepted, receivedKg: accepted ? receivedKg : 0, rejectReason: accepted ? null : req.body?.reason || 'Not specified' },
  });
  if (!accepted) {
    await prisma.listing.update({ where: { id: l.id }, data: { status: 'REJECTED' } });
    await addEvent(l.id, 'REJECTED', `Receiver did not accept the food: ${req.body?.reason || 'not specified'}`, req.user.id);
  } else {
    await addEvent(l.id, 'DELIVERED', `Receiver checked and accepted ${receivedKg} kg`, req.user.id);
  }
  const { kgPerMeal, co2ePerKg } = await getAssumptions();
  const meals = Math.round(receivedKg / kgPerMeal);
  const why = mail.esc(req.body?.reason || 'Not specified');
  await notifyUsers(await orgUsers(l.donorOrgId), {
    message: accepted ? `"${l.title}" delivered: ~${meals} meals saved` : `"${l.title}" was not accepted by the receiver (${req.body?.reason || 'no reason'})`,
    link: `/listings/${l.id}`,
    email: accepted
      ? {
          subject: `Impact: ${meals} meals saved`,
          html: mail.p(`Your surplus <b>${mail.esc(l.title)}</b> was accepted by <b>${mail.esc(l.claim.receiverOrg.name)}</b>.`)
            + mail.details([['Delivered', `${receivedKg} kg ≈ ${meals} meals`], ['CO₂e avoided', `≈ ${Math.round(receivedKg * co2ePerKg)} kg`]])
            + '<p style="margin:0;color:#6b7280;font-size:12px">Estimates: ' + kgPerMeal + ' kg per meal, ' + co2ePerKg + ' kg CO₂e per kg. This is an impact record, not a tax or legal document.</p>',
        }
      : {
          subject: `Not accepted: ${l.title}`,
          html: mail.p(`<b>${mail.esc(l.claim.receiverOrg.name)}</b> checked <b>${mail.esc(l.title)}</b> and did not accept it.`) + mail.details([['Reason', why]])
            + mail.p('Please review how this item was stored and packed before posting it again.'),
        },
  });
  if (l.claim.volunteer) {
    await notifyUsers([l.claim.volunteer], {
      message: accepted ? `${l.claim.receiverOrg.name} accepted "${l.title}"` : `${l.claim.receiverOrg.name} did not accept "${l.title}"`,
      link: `/listings/${l.id}`,
      email: {
        subject: accepted ? `Accepted: ${l.title}` : `Not accepted: ${l.title}`,
        html: accepted
          ? mail.p(`<b>${mail.esc(l.claim.receiverOrg.name)}</b> accepted the food you delivered: about <b>${meals} meals</b>. Thank you!`)
          : mail.p(`<b>${mail.esc(l.claim.receiverOrg.name)}</b> did not accept <b>${mail.esc(l.title)}</b> (${why}).${l.deliveryFee ? ` Your ₹${l.deliveryFee} delivery earning is unaffected.` : ''}`),
      },
    });
  }
  res.json(serializeListing(await load(l.id), req.user));
}));

export default r;
