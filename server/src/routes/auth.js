import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { ah, HttpError } from '../lib/asyncHandler.js';
import { ROLES, signToken, requireAuth, publicUser } from '../lib/auth.js';
import { sendMail } from '../lib/mailer.js';
import { findLocation, pointNear } from '../lib/locations.js';

const r = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const str = (v) => (typeof v === 'string' ? v.trim() : '');

r.post('/login', ah(async (req, res) => {
  const email = str(req.body?.email).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!email || !password) throw new HttpError(400, 'Email and password are required');
  if (email.length > 120 || !EMAIL_RE.test(email)) throw new HttpError(400, 'Enter a valid email address');
  if (password.length > 64) throw new HttpError(401, 'Wrong email or password');
  const user = await prisma.user.findUnique({
    where: { email },
    include: { organization: true, volunteerProfile: true },
  });
  if (!user || !(await bcrypt.compare(String(password || ''), user.passwordHash)))
    throw new HttpError(401, 'Wrong email or password');
  res.json({ token: signToken(user), user: publicUser(user) });
}));

r.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

// Demo accounts listed on the login screen (synthetic data only)
r.get('/demo-accounts', ah(async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: '@demo.rescue' } },
    select: { name: true, email: true, role: true, title: true, organization: { select: { name: true } } },
    orderBy: [{ role: 'asc' }, { email: 'asc' }],
  });
  res.json({ password: 'Password@123', users });
}));

// Same rules as client/src/lib/validation.js
const VEHICLES = ['BICYCLE', 'BIKE', 'CAR', 'VAN'];
const SUBTYPES = {
  DONOR: ['Corporate Cafeteria', 'Contract Caterer', 'Hostel Mess', 'Restaurant', 'Event Organiser'],
  RECEIVER: ['NGO', 'Shelter', 'Community Kitchen', "Children's Home", 'Old Age Home'],
};
const PLATE_RE = /^[A-Z]{2}\s?\d{1,2}\s?[A-Z]{0,3}\s?\d{4}$/; // e.g. KA 01 AB 1234, DL 3C 1234
const FSSAI_RE = /^\d{14}$/;
const REG_NO_RE = /^[A-Za-z0-9][A-Za-z0-9 /-]{3,29}$/;
const NAME_RE = /^[A-Za-z][A-Za-z .'-]{1,79}$/;
const intIn = (v, lo, hi) => /^\d+$/.test(String(v ?? '').trim()) && +v >= lo && +v <= hi;
const bad = (msg) => { throw new HttpError(400, msg); };

r.post('/register', ah(async (req, res) => {
  const b = req.body || {};
  const { role } = b;
  const name = str(b.name);
  const email = str(b.email).toLowerCase();
  const password = typeof b.password === 'string' ? b.password : '';

  if (!ROLES.includes(role)) bad(`Role must be one of ${ROLES.join(', ')}`);
  if (!NAME_RE.test(name)) bad('Full name must be 2–80 letters (spaces, . \' - allowed)');
  if (!email || email.length > 120 || !EMAIL_RE.test(email)) bad('Enter a valid email address');
  if (password.length < 8 || password.length > 64) bad('Password must be 8–64 characters');
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) bad('Password must include at least one letter and one number');

  const phoneDigits = str(b.phone).replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  if (!/^[6-9]\d{9}$/.test(phoneDigits)) bad('Enter a valid 10-digit Indian mobile number');

  const loc = findLocation(b);
  if (!loc) bad('Choose a valid country, state, city and pincode');

  // Role-specific validation (before any writes)
  let vehicle, vehicleNumber, vehicleModel, maxRadiusKm;
  if (role === 'VOLUNTEER') {
    if (!VEHICLES.includes(b.vehicle)) bad('Choose a vehicle type');
    vehicle = b.vehicle;
    vehicleModel = str(b.vehicleModel) || null;
    vehicleNumber = str(b.vehicleNumber).toUpperCase().replace(/\s+/g, ' ') || null;
    if (vehicleModel && (vehicleModel.length < 2 || vehicleModel.length > 40)) bad('Vehicle make & model must be 2–40 characters');
    if (vehicle !== 'BICYCLE') {
      if (!vehicleModel) bad('Vehicle make & model is required');
      if (!vehicleNumber || !PLATE_RE.test(vehicleNumber)) bad('Enter a valid vehicle registration number, e.g. KA 01 AB 1234');
    } else vehicleNumber = null;
    if (!intIn(b.maxRadiusKm ?? 8, 1, 30)) bad('Max pickup distance must be 1–30 km');
    maxRadiusKm = Number(b.maxRadiusKm ?? 8);
  } else {
    const orgName = str(b.orgName);
    if (orgName.length < 2 || orgName.length > 100) bad('Organisation name must be 2–100 characters');
    if (!SUBTYPES[role].includes(str(b.orgSubType))) bad('Choose a valid organisation type');
    if (!str(b.title) || str(b.title).length > 60) bad('Choose your role in the organisation');
    const address = str(b.address);
    if (address.length < 5 || address.length > 200) bad('Address must be 5–200 characters');
    if (role === 'DONOR' && str(b.fssaiNumber) && !FSSAI_RE.test(str(b.fssaiNumber))) bad('FSSAI licence number must be exactly 14 digits');
    if (role === 'RECEIVER') {
      if (str(b.registrationNumber) && !REG_NO_RE.test(str(b.registrationNumber))) bad('Registration number must be 4–30 letters, numbers, spaces, / or -');
      if (!intIn(b.capacityMealsPerDay, 1, 10000)) bad('Capacity (meals per day) must be a whole number between 1 and 10,000');
      if (str(String(b.beneficiariesCount ?? '')) && !intIn(b.beneficiariesCount, 0, 100000)) bad('People served must be a whole number between 0 and 100,000');
      if (str(b.beneficiaryType).length > 80) bad('"Who you serve" must be at most 80 characters');
    }
  }

  if (await prisma.user.findUnique({ where: { email } })) throw new HttpError(409, 'An account with this email already exists');

  const user = await prisma.$transaction(async (tx) => {
    let organizationId = null;
    if (role !== 'VOLUNTEER') {
      const org = await tx.organization.create({
        data: {
          name: str(b.orgName),
          type: role,
          subType: str(b.orgSubType) || (role === 'DONOR' ? 'Corporate Cafeteria' : 'NGO'),
          zone: loc.area,
          address: str(b.address),
          country: loc.country, state: loc.state, city: loc.city, pincode: loc.pincode,
          ...pointNear(loc),
          disposalCostPerKg: role === 'DONOR' ? 6 : null,
          fssaiNumber: role === 'DONOR' ? str(b.fssaiNumber) || null : null,
          registrationNumber: role === 'RECEIVER' ? str(b.registrationNumber) || null : null,
        },
      });
      organizationId = org.id;
      if (role === 'RECEIVER') {
        await tx.receiverProfile.create({
          data: {
            organizationId,
            capacityMealsPerDay: Math.round(Number(b.capacityMealsPerDay)),
            beneficiariesCount: Math.max(0, Math.round(Number(b.beneficiariesCount) || 0)),
            beneficiaryType: str(b.beneficiaryType) || 'Community',
            hasFridge: !!b.hasFridge,
            canSelfPickup: !!b.canSelfPickup,
            dietAccepted: ['VEG', 'EGG', 'NON_VEG'], intakeStart: '08:00', intakeEnd: '22:00',
          },
        });
      }
    }
    const u = await tx.user.create({
      data: {
        name, email, phone: `91${phoneDigits}`, role, organizationId,
        title: str(b.title) || (role === 'DONOR' ? 'Kitchen Manager' : role === 'RECEIVER' ? 'Coordinator' : 'Volunteer'),
        passwordHash: await bcrypt.hash(password, 10),
      },
    });
    if (role === 'VOLUNTEER') {
      await tx.volunteerProfile.create({
        data: {
          userId: u.id, vehicle, vehicleModel, vehicleNumber, maxRadiusKm, hasInsulatedBag: !!b.hasInsulatedBag,
          country: loc.country, state: loc.state, city: loc.city, pincode: loc.pincode, area: loc.area,
          ...pointNear(loc),
        },
      });
    }
    return tx.user.findUnique({ where: { id: u.id }, include: { organization: true, volunteerProfile: true } });
  });

  await sendMail({
    to: user.email,
    subject: 'Welcome to RePlate',
    html: `<p>Hi ${user.name},</p><p>Your <b>${role.toLowerCase()}</b> account is ready. Thank you for helping surplus food reach people who need it.</p>`,
  });
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
}));

export default r;
