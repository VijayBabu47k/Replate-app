// Seed script — SYNTHETIC DATA ONLY. All organisations, people, phone numbers and addresses are fictional.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { computeConsumeBy, toKg } from '../src/lib/safety.js';
import { emailLayout } from '../src/lib/mailer.js';
import { suggestFee } from '../src/lib/fees.js';

const prisma = new PrismaClient();

// Deterministic RNG so every seed looks the same
let seed = 42;
const rand = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (a, b) => a + rand() * (b - a);
const min = (n) => n * 60000;
const otp = () => String(Math.floor(1000 + rand() * 9000));
const phone = () => `9198${Math.floor(10000000 + rand() * 89999999)}`;

// Demo organisations sit in four Bengaluru pincodes (see src/lib/locations.js)
const BLR = { country: 'India', state: 'Karnataka', city: 'Bengaluru' };
const ZONES = {
  LAKE: { name: 'Bellandur', pincode: '560103', lat: 12.935, lng: 77.69 },
  GREEN: { name: 'Marathahalli', pincode: '560037', lat: 12.958, lng: 77.701 },
  RIVER: { name: 'HSR Layout', pincode: '560102', lat: 12.915, lng: 77.665 },
  MARKET: { name: 'Indiranagar', pincode: '560038', lat: 12.972, lng: 77.66 },
};
const locOf = (z) => ({ ...BLR, pincode: z.pincode });
const fssai = () => String(Math.floor(10000000000000 + rand() * 89999999999999)); // 14-digit synthetic FSSAI number
const near = (z, s = 0.01) => ({ lat: +(z.lat + (rand() - 0.5) * s * 2).toFixed(5), lng: +(z.lng + (rand() - 0.5) * s * 2).toFixed(5) });

async function reset() {
  // order matters for FKs
  await prisma.emailLog.deleteMany();
  await prisma.earning.deleteMany();
  await prisma.payout.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.statusEvent.deleteMany();
  await prisma.claim.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.volunteerProfile.deleteMany();
  await prisma.receiverProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.impactAssumption.deleteMany();
}

async function main() {
  console.log('Resetting database…');
  await reset();
  const passwordHash = await bcrypt.hash('Password@123', 10);

  // ---------- Impact assumptions (shown next to every number) ----------
  await prisma.impactAssumption.createMany({
    data: [
      { key: 'KG_PER_MEAL', label: 'Food per meal', value: 0.4, unit: 'kg/meal', source: 'WRAP (UK) convention of ~420 g per meal, rounded', note: 'Used to convert delivered kg to meals saved' },
      { key: 'CO2E_PER_KG', label: 'Emissions avoided per kg of food waste', value: 2.5, unit: 'kg CO₂e/kg', source: 'Midpoint of published lifecycle estimates (≈1.9–4.5 kg CO₂e/kg; FAO / WRAP)', note: 'Includes production + landfill methane. Treat as an estimate with a range' },
      { key: 'WATER_L_PER_KG', label: 'Embedded water per kg of food', value: 1000, unit: 'litres/kg', source: 'Illustrative average for mixed cooked food (water-footprint literature varies widely)', note: 'Indicative only' },
      { key: 'DISPOSAL_COST_PER_KG', label: 'Default wet-waste disposal cost', value: 6, unit: '₹/kg', source: 'Synthetic assumption for demo; donors can set their own rate', note: 'Used when a donor has not set a rate' },
      { key: 'FOOD_COST_PER_KG', label: 'Average cost of cooked food', value: 90, unit: '₹/kg', source: 'Synthetic assumption for demo (ingredients + fuel + labour)', note: 'Used in over-production savings insights' },
    ],
  });

  // ---------- Donor organisations (several staff users each) ----------
  const donorDefs = [
    {
      key: 'lakeview', name: 'Lakeview Tech Park Cafeteria', subType: 'Corporate Cafeteria', zone: ZONES.LAKE, disposal: 7, verified: true,
      address: 'Food Court, Tower B, Lakeview Tech Park',
      staff: [
        { name: 'Ananya Rao', email: 'donor@demo.rescue', title: 'Kitchen Manager' },
        { name: 'Vikram Shetty', email: 'supervisor.lakeview@demo.rescue', title: 'Shift Supervisor' },
        { name: 'Neha Kulkarni', email: 'ops.lakeview@demo.rescue', title: 'Facility Ops Lead' },
      ],
      menu: [
        { title: 'Veg Biryani', category: 'RICE_DISH', diet: 'VEG', unit: 'KG', q: [6, 14], storage: 'HOT_HELD', allergens: ['Dairy', 'Nuts'], peak: 5 },
        { title: 'Dal Tadka', category: 'CURRY', diet: 'VEG', unit: 'VESSELS', q: [1, 2], storage: 'HOT_HELD', allergens: ['Mustard'], peak: 1 },
        { title: 'Chapati', category: 'BREAD', diet: 'VEG', unit: 'SERVINGS', q: [40, 90], storage: 'ROOM_TEMP', allergens: ['Gluten'], peak: 3 },
        { title: 'Paneer Butter Masala', category: 'CURRY', diet: 'VEG', unit: 'TRAYS', q: [1, 3], storage: 'HOT_HELD', allergens: ['Dairy', 'Nuts'], peak: 4 },
        { title: 'Chicken Curry', category: 'CURRY', diet: 'NON_VEG', unit: 'KG', q: [4, 9], storage: 'HOT_HELD', allergens: [], peak: 3 },
      ],
    },
    {
      key: 'orbit', name: 'Orbit Contract Caterers', subType: 'Contract Caterer', zone: ZONES.GREEN, disposal: 6, verified: true,
      address: 'Central Kitchen, Plot 14, Greenfield Industrial Lane',
      staff: [
        { name: 'Rahul Menon', email: 'manager.orbit@demo.rescue', title: 'Kitchen Manager' },
        { name: 'Sana Qureshi', email: 'supervisor.orbit@demo.rescue', title: 'Shift Supervisor' },
      ],
      menu: [
        { title: 'Jeera Rice', category: 'RICE_DISH', diet: 'VEG', unit: 'KG', q: [5, 12], storage: 'HOT_HELD', allergens: [], peak: 2 },
        { title: 'Mixed Veg Curry', category: 'CURRY', diet: 'VEG', unit: 'VESSELS', q: [1, 2], storage: 'HOT_HELD', allergens: [], peak: 2 },
        { title: 'Egg Fried Rice', category: 'RICE_DISH', diet: 'EGG', unit: 'KG', q: [4, 10], storage: 'HOT_HELD', allergens: ['Egg', 'Soy'], peak: 4 },
        { title: 'Gulab Jamun', category: 'SWEETS', diet: 'VEG', unit: 'SERVINGS', q: [30, 80], storage: 'ROOM_TEMP', allergens: ['Dairy', 'Gluten'], peak: 5 },
      ],
    },
    {
      key: 'greenfield', name: 'Greenfield Campus Canteen', subType: 'Corporate Cafeteria', zone: ZONES.GREEN, disposal: 6.5, verified: true,
      address: 'Ground Floor, Block C, Greenfield Campus',
      staff: [
        { name: 'Karthik Iyer', email: 'manager.greenfield@demo.rescue', title: 'Kitchen Manager' },
        { name: 'Pooja Das', email: 'supervisor.greenfield@demo.rescue', title: 'Shift Supervisor' },
      ],
      menu: [
        { title: 'Assorted Sandwiches', category: 'BREAD', diet: 'VEG', unit: 'TRAYS', q: [1, 3], storage: 'REFRIGERATED', allergens: ['Gluten', 'Dairy'], peak: 1 },
        { title: 'Fruit Salad Cups', category: 'SALAD', diet: 'VEGAN', unit: 'SERVINGS', q: [20, 50], storage: 'REFRIGERATED', allergens: [], peak: 3 },
        { title: 'Lemon Rice', category: 'RICE_DISH', diet: 'VEG', unit: 'KG', q: [4, 9], storage: 'HOT_HELD', allergens: ['Peanuts', 'Mustard'], peak: 4 },
        { title: 'Veg Puffs', category: 'DRY_SNACK', diet: 'VEG', unit: 'SERVINGS', q: [30, 70], storage: 'ROOM_TEMP', allergens: ['Gluten'], peak: 5 },
      ],
    },
    {
      key: 'sunrise', name: 'Sunrise Hostel Mess', subType: 'Hostel Mess', zone: ZONES.RIVER, disposal: 5, verified: false,
      address: 'Mess Hall, Sunrise Students Hostel, Riverside Road',
      staff: [
        { name: 'Manoj Pillai', email: 'manager.sunrise@demo.rescue', title: 'Mess Manager' },
        { name: 'Lakshmi Nair', email: 'supervisor.sunrise@demo.rescue', title: 'Shift Supervisor' },
      ],
      menu: [
        { title: 'Idli & Sambar', category: 'CURRY', diet: 'VEG', unit: 'SERVINGS', q: [30, 70], storage: 'HOT_HELD', allergens: [], peak: 1 },
        { title: 'Lemon Rice', category: 'RICE_DISH', diet: 'VEG', unit: 'KG', q: [3, 8], storage: 'ROOM_TEMP', allergens: ['Peanuts'], peak: 3 },
        { title: 'Banana & Seasonal Fruit', category: 'RAW_PRODUCE', diet: 'VEGAN', unit: 'KG', q: [3, 10], storage: 'ROOM_TEMP', allergens: [], peak: 0 },
        { title: 'Egg Curry', category: 'CURRY', diet: 'EGG', unit: 'KG', q: [3, 7], storage: 'HOT_HELD', allergens: ['Egg'], peak: 6 },
      ],
    },
  ];

  const donors = {};
  for (const d of donorDefs) {
    const org = await prisma.organization.create({
      data: { name: d.name, type: 'DONOR', subType: d.subType, zone: d.zone.name, address: d.address, ...locOf(d.zone), ...near(d.zone, 0.006), verified: d.verified, disposalCostPerKg: d.disposal, fssaiNumber: fssai() },
    });
    const users = [];
    for (const s of d.staff) {
      users.push(await prisma.user.create({ data: { ...s, phone: phone(), role: 'DONOR', organizationId: org.id, passwordHash } }));
    }
    donors[d.key] = { org, users, menu: d.menu, def: d };
  }

  // ---------- Receivers (coordinator + capacity/needs profile) ----------
  const receiverDefs = [
    { key: 'hope', reg: 'KA/2016/0101234', name: 'Hope Night Shelter', subType: 'Shelter', zone: ZONES.LAKE, coord: { name: 'Joseph Mathew', email: 'receiver@demo.rescue' }, extra: { name: 'Ritu Sharma', email: 'staff.hope@demo.rescue', title: 'Kitchen Volunteer Lead' },
      profile: { capacityMealsPerDay: 180, dietAccepted: ['VEG', 'EGG', 'NON_VEG', 'VEGAN', 'JAIN'], intakeStart: '06:00', intakeEnd: '23:30', hasFridge: true, beneficiaryType: 'Homeless adults', beneficiariesCount: 120, canSelfPickup: true } },
    { key: 'annapurna', reg: 'KA/2014/0087321', name: 'Annapurna Community Kitchen', subType: 'Community Kitchen', zone: ZONES.MARKET, coord: { name: 'Gita Bhat', email: 'coordinator.annapurna@demo.rescue' },
      profile: { capacityMealsPerDay: 250, dietAccepted: ['VEG', 'JAIN', 'VEGAN'], intakeStart: '07:00', intakeEnd: '22:00', hasFridge: true, beneficiaryType: 'Daily-wage workers & families', beneficiariesCount: 300, canSelfPickup: true } },
    { key: 'littlesteps', reg: 'KA/2018/0145566', name: "Little Steps Children's Home", subType: "Children's Home", zone: ZONES.RIVER, coord: { name: 'Farah Siddiqui', email: 'coordinator.littlesteps@demo.rescue' },
      profile: { capacityMealsPerDay: 90, dietAccepted: ['VEG', 'EGG', 'VEGAN'], intakeStart: '07:00', intakeEnd: '21:00', hasFridge: true, beneficiaryType: 'Children (6–16 yrs)', beneficiariesCount: 60 } },
    { key: 'seva', reg: 'KA/2012/0063210', name: 'Seva Sahayog NGO', subType: 'NGO', zone: ZONES.GREEN, coord: { name: 'Imran Khan', email: 'coordinator.seva@demo.rescue' },
      profile: { capacityMealsPerDay: 220, dietAccepted: ['VEG', 'EGG', 'NON_VEG', 'VEGAN', 'JAIN'], intakeStart: '05:30', intakeEnd: '23:59', hasFridge: false, beneficiaryType: 'Street-side distribution', beneficiariesCount: 250 } },
    { key: 'elders', reg: null, name: 'Riverside Elders’ Home', subType: 'Old Age Home', zone: ZONES.RIVER, coord: { name: 'Thomas George', email: 'coordinator.elders@demo.rescue' },
      profile: { capacityMealsPerDay: 60, dietAccepted: ['VEG', 'JAIN', 'VEGAN'], intakeStart: '08:00', intakeEnd: '20:00', hasFridge: true, beneficiaryType: 'Senior citizens', beneficiariesCount: 45, acceptingToday: true } },
  ];
  const receivers = {};
  for (const r of receiverDefs) {
    const org = await prisma.organization.create({
      data: { name: r.name, type: 'RECEIVER', subType: r.subType, zone: r.zone.name, address: `${r.subType} premises, Main Road`, ...locOf(r.zone), ...near(r.zone, 0.008), verified: r.key !== 'elders', registrationNumber: r.reg },
    });
    await prisma.receiverProfile.create({ data: { organizationId: org.id, ...r.profile } });
    const users = [await prisma.user.create({ data: { ...r.coord, title: 'Coordinator', phone: phone(), role: 'RECEIVER', organizationId: org.id, passwordHash } })];
    if (r.extra) users.push(await prisma.user.create({ data: { ...r.extra, phone: phone(), role: 'RECEIVER', organizationId: org.id, passwordHash } }));
    receivers[r.key] = { org, users, diets: r.profile.dietAccepted };
  }

  // ---------- Volunteers ----------
  const volDefs = [
    { name: 'Arjun Reddy', email: 'volunteer@demo.rescue', vehicle: 'BIKE', model: 'Honda Activa 6G', plate: 'KA 03 HM 4521', bag: true, zone: ZONES.LAKE, radius: 10 },
    { name: 'Meera Joshi', email: 'meera.vol@demo.rescue', vehicle: 'CAR', model: 'Maruti Suzuki WagonR', plate: 'KA 53 MC 7788', bag: true, zone: ZONES.GREEN, radius: 15 },
    { name: 'Kabir Anand', email: 'kabir.vol@demo.rescue', vehicle: 'BICYCLE', model: 'Hero Sprint', bag: false, zone: ZONES.LAKE, radius: 5 },
    { name: 'Fatima Sheikh', email: 'fatima.vol@demo.rescue', vehicle: 'BIKE', model: 'TVS Jupiter', plate: 'KA 01 JF 2290', bag: true, zone: ZONES.GREEN, radius: 8 },
    { name: 'Rohan Verma', email: 'rohan.vol@demo.rescue', vehicle: 'VAN', model: 'Maruti Suzuki Eeco', plate: 'KA 05 AG 6614', bag: true, zone: ZONES.MARKET, radius: 20 },
    { name: 'Divya Prakash', email: 'divya.vol@demo.rescue', vehicle: 'CAR', model: 'Hyundai i20', plate: 'KA 51 MK 3307', bag: false, zone: ZONES.RIVER, radius: 12, available: false },
  ];
  const volunteers = [];
  for (const v of volDefs) {
    const u = await prisma.user.create({ data: { name: v.name, email: v.email, phone: phone(), role: 'VOLUNTEER', title: 'Volunteer', passwordHash } });
    await prisma.volunteerProfile.create({
      data: { userId: u.id, vehicle: v.vehicle, vehicleModel: v.model, vehicleNumber: v.plate || null, ...locOf(v.zone), area: v.zone.name, hasInsulatedBag: v.bag, maxRadiusKm: v.radius, available: v.available ?? true, ...near(v.zone) },
    });
    volunteers.push(u);
  }

  const now = new Date();

  // ---------- Historical rescues (last 8 weeks) ----------
  const compatibleReceivers = (diet) => {
    const ok = { VEGAN: ['VEGAN', 'VEG', 'JAIN', 'EGG', 'NON_VEG'], JAIN: ['JAIN', 'VEG', 'EGG', 'NON_VEG'], VEG: ['VEG', 'EGG', 'NON_VEG'], EGG: ['EGG', 'NON_VEG'], NON_VEG: ['NON_VEG'] }[diet];
    return Object.values(receivers).filter((r) => r.diets.some((x) => ok.includes(x)));
  };
  const rejectReasons = ['Food was lukewarm on arrival', 'Smelled off — not safe to serve', 'Container lid broken / spilled'];
  const cancelReasons = ['Served to late-shift staff instead', 'Quantity mis-estimated, nothing left'];
  let historyCount = 0;

  for (let dayOffset = 56; dayOffset >= 1; dayOffset--) {
    const day = new Date(now);
    day.setDate(day.getDate() - dayOffset);
    const dow = day.getDay();
    for (const d of Object.values(donors)) {
      const isHostel = d.def.subType === 'Hostel Mess';
      if (!isHostel && (dow === 0 || dow === 6)) continue; // corporate cafeterias closed weekends
      if (rand() > 0.82) continue;
      // Peak-day items are much more likely (gives over-production insights)
      const item = rand() < 0.45 ? d.menu.find((m) => m.peak === dow) || pick(d.menu) : pick(d.menu);
      let quantity = Math.round(between(item.q[0], item.q[1]));
      if (item.peak === dow) quantity = Math.round(quantity * 1.4);
      const createdAt = new Date(day);
      createdAt.setHours(14, Math.floor(between(0, 75)), 0, 0);
      const preparedAt = new Date(createdAt.getTime() - min(between(20, 45)));
      const consumeBy = computeConsumeBy(item.category, item.storage, preparedAt);
      const pickupBy = new Date(Math.min(createdAt.getTime() + min(between(50, 90)), consumeBy.getTime() - min(30)));
      const quantityKg = toKg(item.category, quantity, item.unit);
      const estimatedMeals = Math.max(1, Math.round(quantityKg / 0.4));
      const staff = pick(d.users);

      const roll = rand();
      const outcome = roll < 0.78 ? 'DELIVERED' : roll < 0.83 ? 'REJECTED' : roll < 0.93 ? 'EXPIRED' : 'CANCELLED';
      const expiredUnclaimed = outcome === 'EXPIRED' && rand() < 0.6;
      const receiver = pick(compatibleReceivers(item.diet));
      const selfPickup = receiver.org && rand() < 0.15 && ['hope', 'annapurna'].some((k) => receivers[k].org.id === receiver.org.id);
      const volunteer = selfPickup ? null : pick(volunteers.slice(0, 5));

      const t = {};
      t.claimed = new Date(createdAt.getTime() + min(between(4, 18)));
      t.assigned = new Date(t.claimed.getTime() + min(between(3, 12)));
      t.collected = new Date(t.assigned.getTime() + min(between(12, 25)));
      t.delivered = new Date(t.collected.getTime() + min(between(12, 30)));

      const events = [{ status: 'POSTED', note: 'Listing posted', actorId: staff.id, createdAt }];
      let claim;
      if (!(outcome === 'CANCELLED' && rand() < 0.5) && !expiredUnclaimed) {
        events.push({ status: 'CLAIMED', note: `Claimed by ${receiver.org.name}${selfPickup ? ' (self pickup)' : ' — volunteer needed'}`, actorId: receiver.users[0].id, createdAt: t.claimed });
        claim = {
          receiverOrgId: receiver.org.id, claimedById: receiver.users[0].id, selfPickup, matchScore: +between(0.55, 0.92).toFixed(3),
          pickupOtp: otp(), deliveryOtp: otp(), claimedAt: t.claimed,
        };
        if (['DELIVERED', 'REJECTED'].includes(outcome) || (outcome === 'EXPIRED' && rand() < 0.5)) {
          if (!selfPickup) {
            claim.volunteerId = volunteer.id;
            claim.assignedAt = t.assigned;
            events.push({ status: 'ASSIGNED', note: `${volunteer.name} is on the way to pick up`, actorId: volunteer.id, createdAt: t.assigned });
          }
        }
        if (['DELIVERED', 'REJECTED'].includes(outcome)) {
          claim.collectedAt = t.collected;
          claim.deliveredAt = t.delivered;
          events.push({ status: 'COLLECTED', note: 'Pickup code verified at donor', actorId: selfPickup ? receiver.users[0].id : volunteer.id, createdAt: t.collected });
          events.push({ status: 'DELIVERED', note: selfPickup ? 'Brought back to receiver kitchen' : 'Delivery code verified at receiver', actorId: selfPickup ? receiver.users[0].id : volunteer.id, createdAt: t.delivered });
          const confirmAt = new Date(t.delivered.getTime() + min(5));
          if (outcome === 'DELIVERED') {
            const receivedKg = +(quantityKg * between(0.92, 1)).toFixed(1);
            Object.assign(claim, { qualityAccepted: true, receivedKg });
            events.push({ status: 'DELIVERED', note: `Receiver checked and accepted ${receivedKg} kg`, actorId: receiver.users[0].id, createdAt: confirmAt });
          } else {
            const reason = pick(rejectReasons);
            Object.assign(claim, { qualityAccepted: false, receivedKg: 0, rejectReason: reason });
            events.push({ status: 'REJECTED', note: `Receiver did not accept the food: ${reason}`, actorId: receiver.users[0].id, createdAt: confirmAt });
          }
        }
      }
      if (outcome === 'EXPIRED') events.push({ status: 'EXPIRED', note: 'Safe time window closed before collection. Food should be disposed of safely, not served.', createdAt: consumeBy });
      if (outcome === 'CANCELLED') events.push({ status: 'CANCELLED', note: pick(cancelReasons), actorId: staff.id, createdAt: new Date(createdAt.getTime() + min(between(10, 30))) });

      const deliveryFee = suggestFee({ kmEstimate: between(1.5, 8), quantityKg });
      const earned = claim?.volunteerId && claim.deliveredAt;
      await prisma.listing.create({
        data: {
          deliveryFee,
          earning: earned ? { create: { volunteerId: claim.volunteerId, amount: deliveryFee, createdAt: claim.deliveredAt } } : undefined,
          donorOrgId: d.org.id, createdById: staff.id, title: item.title, category: item.category, dietType: item.diet,
          quantity, unit: item.unit, quantityKg, estimatedMeals, allergens: item.allergens, storage: item.storage,
          preparedAt, pickupBy, consumeBy, declarationAccepted: true, postDurationSec: Math.round(between(22, 58)),
          pickupInstructions: 'Use the service entrance; ask for the kitchen supervisor.',
          status: outcome, broadcastLevel: expiredUnclaimed ? 3 : 1, createdAt, updatedAt: events[events.length - 1].createdAt,
          claim: claim ? { create: claim } : undefined,
          events: { create: events },
        },
      });
      historyCount++;
    }
  }

  // ---------- Live listings (relative to now) — one at every stage of the flow ----------
  const L = donors.lakeview, O = donors.orbit, G = donors.greenfield, S = donors.sunrise;
  const H = receivers.hope, A = receivers.annapurna, C = receivers.littlesteps, SV = receivers.seva;
  const [arjun, meera] = volunteers;
  const ago = (m) => new Date(now.getTime() - min(m));

  async function live({ donor, staffIdx = 0, title, category, diet, quantity, unit, storage, allergens, preparedAgo, createdAgo, pickupIn, status, notes, claim, events = [], km = 4 }) {
    const preparedAt = ago(preparedAgo);
    const consumeBy = computeConsumeBy(category, storage, preparedAt);
    const createdAt = ago(createdAgo);
    const pickupBy = new Date(Math.min(now.getTime() + min(pickupIn), consumeBy.getTime() - min(30)));
    const quantityKg = toKg(category, quantity, unit);
    const staff = donor.users[staffIdx];
    const deliveryFee = suggestFee({ kmEstimate: km, quantityKg });
    const earned = claim?.volunteerId && claim.deliveredAt && !claim.selfPickup;
    return prisma.listing.create({
      data: {
        deliveryFee,
        earning: earned ? { create: { volunteerId: claim.volunteerId, amount: deliveryFee, createdAt: claim.deliveredAt } } : undefined,
        donorOrgId: donor.org.id, createdById: staff.id, title, category, dietType: diet, quantity, unit, quantityKg,
        estimatedMeals: Math.max(1, Math.round(quantityKg / 0.4)), allergens, storage, preparedAt, pickupBy, consumeBy,
        declarationAccepted: true, postDurationSec: Math.round(between(25, 50)), notes,
        pickupInstructions: 'Service entrance at the back. Call the shift supervisor on arrival.',
        status, createdAt,
        claim: claim ? { create: { pickupOtp: otp(), deliveryOtp: otp(), ...claim } } : undefined,
        events: { create: [{ status: 'POSTED', note: 'Listing posted', actorId: staff.id, createdAt }, ...events] },
      },
    });
  }

  // POSTED — appear in receiver feeds
  await live({ donor: L, title: 'Veg Pulao & Raita', category: 'RICE_DISH', diet: 'VEG', quantity: 12, unit: 'KG', storage: 'HOT_HELD', allergens: ['Dairy'], preparedAgo: 25, createdAgo: 2, pickupIn: 75, status: 'POSTED', notes: 'Packed in 3 steel containers.' });
  await live({ donor: O, staffIdx: 1, title: 'Chapati & Mixed Veg Curry', category: 'CURRY', diet: 'VEG', quantity: 60, unit: 'SERVINGS', storage: 'HOT_HELD', allergens: ['Gluten'], preparedAgo: 15, createdAgo: 1, pickupIn: 90, status: 'POSTED' });
  await live({ donor: S, title: 'Egg Fried Rice', category: 'RICE_DISH', diet: 'EGG', quantity: 8, unit: 'KG', storage: 'HOT_HELD', allergens: ['Egg', 'Soy'], preparedAgo: 30, createdAgo: 6, pickupIn: 60, status: 'POSTED' });
  await live({ donor: G, staffIdx: 1, title: 'Assorted Sandwiches', category: 'BREAD', diet: 'VEG', quantity: 2, unit: 'TRAYS', storage: 'REFRIGERATED', allergens: ['Gluten', 'Dairy'], preparedAgo: 60, createdAgo: 3, pickupIn: 120, status: 'POSTED' });
  await live({ donor: L, staffIdx: 1, title: 'Chicken Curry', category: 'CURRY', diet: 'NON_VEG', quantity: 6, unit: 'KG', storage: 'HOT_HELD', allergens: [], preparedAgo: 35, createdAgo: 4, pickupIn: 60, status: 'POSTED', notes: 'Non-veg — only shown to receivers who accept non-veg.' });

  // CLAIMED, waiting for a volunteer — appears in volunteer task feed
  await live({
    donor: L, title: 'Paneer Butter Masala & Rice', category: 'CURRY', diet: 'VEG', quantity: 3, unit: 'TRAYS', storage: 'HOT_HELD', allergens: ['Dairy', 'Nuts'], preparedAgo: 40, createdAgo: 18, pickupIn: 45, status: 'CLAIMED',
    claim: { receiverOrgId: H.org.id, claimedById: H.users[0].id, selfPickup: false, matchScore: 0.86, claimedAt: ago(12) },
    events: [{ status: 'CLAIMED', note: `Claimed by ${H.org.name} — volunteer needed`, actorId: H.users[0].id, createdAt: ago(12) }],
  });
  await live({
    donor: G, title: 'Fruit Salad Cups', category: 'SALAD', diet: 'VEGAN', quantity: 35, unit: 'SERVINGS', storage: 'REFRIGERATED', allergens: [], preparedAgo: 50, createdAgo: 14, pickupIn: 60, status: 'CLAIMED',
    claim: { receiverOrgId: C.org.id, claimedById: C.users[0].id, selfPickup: false, matchScore: 0.79, claimedAt: ago(9) },
    events: [{ status: 'CLAIMED', note: `Claimed by ${C.org.name} — volunteer needed`, actorId: C.users[0].id, createdAt: ago(9) }],
  });

  // ASSIGNED to the demo volunteer
  await live({
    donor: O, title: 'Dal Tadka & Jeera Rice', category: 'RICE_DISH', diet: 'VEG', quantity: 10, unit: 'KG', storage: 'HOT_HELD', allergens: ['Mustard'], preparedAgo: 45, createdAgo: 25, pickupIn: 30, status: 'ASSIGNED',
    claim: { receiverOrgId: A.org.id, claimedById: A.users[0].id, selfPickup: false, matchScore: 0.81, claimedAt: ago(20), volunteerId: arjun.id, assignedAt: ago(5) },
    events: [
      { status: 'CLAIMED', note: `Claimed by ${A.org.name} — volunteer needed`, actorId: A.users[0].id, createdAt: ago(20) },
      { status: 'ASSIGNED', note: `${arjun.name} (bike) is on the way to pick up`, actorId: arjun.id, createdAt: ago(5) },
    ],
  });

  // COLLECTED — in transit
  await live({
    donor: L, staffIdx: 2, title: 'Veg Biryani', category: 'RICE_DISH', diet: 'VEG', quantity: 14, unit: 'KG', storage: 'HOT_HELD', allergens: ['Dairy', 'Nuts'], preparedAgo: 70, createdAgo: 50, pickupIn: 10, status: 'COLLECTED',
    claim: { receiverOrgId: SV.org.id, claimedById: SV.users[0].id, selfPickup: false, matchScore: 0.88, claimedAt: ago(44), volunteerId: meera.id, assignedAt: ago(38), collectedAt: ago(10) },
    events: [
      { status: 'CLAIMED', note: `Claimed by ${SV.org.name} — volunteer needed`, actorId: SV.users[0].id, createdAt: ago(44) },
      { status: 'ASSIGNED', note: `${meera.name} (car) is on the way to pick up`, actorId: meera.id, createdAt: ago(38) },
      { status: 'COLLECTED', note: 'Pickup code verified at donor', actorId: meera.id, createdAt: ago(10) },
    ],
  });

  // DELIVERED — awaiting receiver quality confirmation (demo receiver)
  await live({
    donor: S, title: 'Idli & Sambar', category: 'CURRY', diet: 'VEG', quantity: 50, unit: 'SERVINGS', storage: 'HOT_HELD', allergens: [], preparedAgo: 95, createdAgo: 80, pickupIn: 5, status: 'DELIVERED',
    claim: { receiverOrgId: H.org.id, claimedById: H.users[0].id, selfPickup: false, matchScore: 0.83, claimedAt: ago(74), volunteerId: arjun.id, assignedAt: ago(68), collectedAt: ago(45), deliveredAt: ago(8) },
    events: [
      { status: 'CLAIMED', note: `Claimed by ${H.org.name} — volunteer needed`, actorId: H.users[0].id, createdAt: ago(74) },
      { status: 'ASSIGNED', note: `${arjun.name} (bike) is on the way to pick up`, actorId: arjun.id, createdAt: ago(68) },
      { status: 'COLLECTED', note: 'Pickup code verified at donor', actorId: arjun.id, createdAt: ago(45) },
      { status: 'DELIVERED', note: 'Delivery code verified at receiver', actorId: arjun.id, createdAt: ago(8) },
    ],
  });

  // CLAIMED with self pickup by the demo receiver
  await live({
    donor: L, title: 'Packaged Snack Boxes', category: 'PACKAGED', diet: 'VEG', quantity: 40, unit: 'SERVINGS', storage: 'ROOM_TEMP', allergens: ['Gluten', 'Peanuts'], preparedAgo: 120, createdAgo: 30, pickupIn: 120, status: 'CLAIMED',
    claim: { receiverOrgId: H.org.id, claimedById: H.users[0].id, selfPickup: true, matchScore: 0.9, claimedAt: ago(22) },
    events: [{ status: 'CLAIMED', note: `Claimed by ${H.org.name} (self pickup)`, actorId: H.users[0].id, createdAt: ago(22) }],
  });

  // ---------- Earnings: settle older earnings of the demo volunteer as one paid payout ----------
  const demoVol = await prisma.user.findUnique({ where: { email: 'volunteer@demo.rescue' } });
  if (demoVol) {
    const upiId = 'demo.volunteer@okbank'; // synthetic
    await prisma.volunteerProfile.update({ where: { userId: demoVol.id }, data: { upiId } });
    const old = await prisma.earning.findMany({ where: { volunteerId: demoVol.id, createdAt: { lt: ago(60 * 24 * 7) } } });
    if (old.length) {
      const paidAt = ago(60 * 24 * 6);
      const payout = await prisma.payout.create({ data: { volunteerId: demoVol.id, amount: old.reduce((t, e) => t + e.amount, 0), upiId, status: 'PAID', requestedAt: paidAt, paidAt } });
      await prisma.earning.updateMany({ where: { id: { in: old.map((e) => e.id) } }, data: { payoutId: payout.id } });
    }
  }

  // ---------- Notifications & emails for demo users ----------
  const demo = Object.fromEntries((await prisma.user.findMany({ where: { email: { in: ['donor@demo.rescue', 'receiver@demo.rescue', 'volunteer@demo.rescue'] } } })).map((u) => [u.role, u]));
  const notes = [
    [demo.DONOR, 'Hope Night Shelter claimed "Paneer Butter Masala & Rice"', 12],
    [demo.DONOR, 'Volunteer Meera Joshi collected "Veg Biryani" — on its way to Seva Sahayog NGO', 10],
    [demo.DONOR, 'Weekly summary: your kitchen saved 214 meals last week', 60 * 20],
    [demo.RECEIVER, 'New surplus matched to you: Veg Pulao & Raita (30 meals)', 2],
    [demo.RECEIVER, '"Idli & Sambar" delivered — please confirm quality', 8],
    [demo.RECEIVER, 'Volunteer Arjun Reddy is collecting "Idli & Sambar"', 68],
    [demo.VOLUNTEER, 'Pickup needed: Fruit Salad Cups from Greenfield Campus Canteen', 9],
  ];
  for (const [u, message, m] of notes) await prisma.notification.create({ data: { userId: u.id, message, createdAt: ago(m), read: m > 120 } });

  const mails = [
    [demo.DONOR.email, 'Claimed: Paneer Butter Masala & Rice', '<p><b>Hope Night Shelter</b> claimed your listing. We are finding a volunteer now. Give the pickup code shown in the app to whoever collects it.</p>', 12],
    [demo.DONOR.email, 'Impact: 26 meals saved', '<p>Your surplus <b>Lemon Rice</b> reached <b>Little Steps Children’s Home</b>.</p><ul><li>10.4 kg ≈ <b>26 meals</b> (assumes 0.4 kg/meal)</li><li>≈ <b>26 kg CO₂e</b> avoided (assumes 2.5 kg CO₂e per kg)</li></ul><p style="color:#6b7280">This is an impact record, not a tax or legal document.</p>', 60 * 24],
    [demo.RECEIVER.email, 'New surplus matched to you: Veg Pulao & Raita', '<p><b>Veg Pulao & Raita</b> — about 30 meals (12 kg). Allergens: Dairy. Open the app to claim it.</p>', 2],
    [demo.VOLUNTEER.email, 'Volunteer pickup needed: Fruit Salad Cups', '<p>8.8 kg from <b>Marathahalli</b> to <b>HSR Layout</b>. Keep chilled — bring your insulated bag.</p>', 9],
  ];
  for (const [to, subject, html, m] of mails) await prisma.emailLog.create({ data: { to, subject, html: emailLayout(subject, html), status: 'logged', createdAt: ago(m) } });

  const counts = {
    organizations: await prisma.organization.count(),
    users: await prisma.user.count(),
    listings: await prisma.listing.count(),
    historicalListings: historyCount,
    claims: await prisma.claim.count(),
    events: await prisma.statusEvent.count(),
    earnings: await prisma.earning.count(),
    payouts: await prisma.payout.count(),
  };
  console.log('Seed complete:', counts);
  console.log('\nDemo logins (password: Password@123)');
  console.log('  Donor      donor@demo.rescue');
  console.log('  Receiver   receiver@demo.rescue');
  console.log('  Volunteer  volunteer@demo.rescue');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
