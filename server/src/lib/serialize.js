import { fuzz } from './geo.js';
import { maskPhone } from './auth.js';
import { handlingCard, CATEGORY_INFO } from './safety.js';

export const listingInclude = {
  donorOrg: true,
  createdBy: { select: { id: true, name: true, title: true, phone: true } },
  claim: {
    include: {
      receiverOrg: { include: { receiverProfile: true } },
      claimedBy: { select: { id: true, name: true, phone: true } },
      volunteer: { select: { id: true, name: true, email: true, phone: true, volunteerProfile: true } },
    },
  },
  events: { orderBy: { createdAt: 'asc' }, include: { actor: { select: { name: true, role: true } } } },
  earning: { select: { amount: true, volunteerId: true, createdAt: true } },
};

/** Delivery fee state: 'none' (₹0), 'self' (self pickup, not charged), 'paid' (credited), 'pending' (charged on delivery), 'void' (not delivered). */
function feeState(l) {
  if (!l.deliveryFee) return 'none';
  if (l.earning) return 'paid';
  if (l.claim?.selfPickup) return 'self';
  if (['EXPIRED', 'CANCELLED'].includes(l.status) || (l.status === 'REJECTED' && !l.earning)) return 'void';
  return 'pending';
}

function orgView(org, exact) {
  if (!org) return null;
  const base = {
    id: org.id, name: org.name, subType: org.subType, zone: org.zone, city: org.city, state: org.state, verified: org.verified,
    fssaiNumber: org.fssaiNumber, registrationNumber: org.registrationNumber,
  };
  const locality = [org.zone, org.city].filter(Boolean).join(', ');
  if (exact) {
    const street = String(org.address || '').replace(/\s*\(sample address\)/i, '').trim();
    return { ...base, street, locality: org.pincode ? `${locality} ${org.pincode}` : locality, address: `${street}, ${locality} – ${org.pincode}`, pincode: org.pincode, lat: org.lat, lng: org.lng, exact: true };
  }
  return { ...base, street: null, locality, address: locality, ...fuzz(org.lat, org.lng), exact: false };
}

/** Shape a listing for a specific viewer: location fuzzing + OTP visibility rules. */
export function serializeListing(l, viewer) {
  const isDonor = viewer.role === 'DONOR' && viewer.organizationId === l.donorOrgId;
  const isReceiver = viewer.role === 'RECEIVER' && l.claim && viewer.organizationId === l.claim.receiverOrgId;
  const isVolunteer = viewer.role === 'VOLUNTEER' && l.claim?.volunteerId === viewer.id;
  const party = isDonor || isReceiver || isVolunteer;

  const claim = l.claim
    ? {
        id: l.claim.id,
        selfPickup: l.claim.selfPickup,
        matchScore: l.claim.matchScore,
        claimedAt: l.claim.claimedAt,
        assignedAt: l.claim.assignedAt,
        collectedAt: l.claim.collectedAt,
        deliveredAt: l.claim.deliveredAt,
        qualityAccepted: l.claim.qualityAccepted,
        rejectReason: l.claim.rejectReason,
        receivedKg: l.claim.receivedKg,
        receiverOrg: orgView(l.claim.receiverOrg, party),
        receiverProfile: l.claim.receiverOrg?.receiverProfile
          ? { beneficiaryType: l.claim.receiverOrg.receiverProfile.beneficiaryType, hasFridge: l.claim.receiverOrg.receiverProfile.hasFridge }
          : null,
        claimedBy: party && l.claim.claimedBy ? { name: l.claim.claimedBy.name, phone: maskPhone(l.claim.claimedBy.phone) } : null,
        volunteer: l.claim.volunteer
          ? {
              id: l.claim.volunteer.id,
              name: l.claim.volunteer.name,
              phone: party ? maskPhone(l.claim.volunteer.phone) : null,
              vehicle: l.claim.volunteer.volunteerProfile?.vehicle,
              // Make/model and plate let the donor and receiver recognise the volunteer at handover.
              vehicleModel: party ? l.claim.volunteer.volunteerProfile?.vehicleModel : undefined,
              vehicleNumber: party ? l.claim.volunteer.volunteerProfile?.vehicleNumber : undefined,
              lat: party ? l.claim.volunteer.volunteerProfile?.lat : undefined,
              lng: party ? l.claim.volunteer.volunteerProfile?.lng : undefined,
            }
          : null,
        // Donor holds the pickup code (gives it to the collector); receiver holds the delivery code.
        // Each code is only exposed until it has been used.
        pickupOtp: isDonor && ['CLAIMED', 'ASSIGNED'].includes(l.status) ? l.claim.pickupOtp : undefined,
        deliveryOtp: isReceiver && ['CLAIMED', 'ASSIGNED', 'COLLECTED'].includes(l.status) ? l.claim.deliveryOtp : undefined,
      }
    : null;

  return {
    id: l.id,
    title: l.title,
    category: l.category,
    categoryLabel: CATEGORY_INFO[l.category]?.label,
    dietType: l.dietType,
    quantity: l.quantity,
    unit: l.unit,
    quantityKg: l.quantityKg,
    estimatedMeals: l.estimatedMeals,
    allergens: l.allergens,
    storage: l.storage,
    preparedAt: l.preparedAt,
    pickupBy: l.pickupBy,
    consumeBy: l.consumeBy,
    notes: l.notes,
    pickupInstructions: party ? l.pickupInstructions : null,
    declarationAccepted: l.declarationAccepted,
    postDurationSec: l.postDurationSec,
    status: l.status,
    deliveryFee: l.deliveryFee ?? 0,
    fee: { amount: l.deliveryFee ?? 0, state: feeState(l), earnedByMe: !!(l.earning && l.earning.volunteerId === viewer.id) },
    broadcastLevel: l.broadcastLevel,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
    donorOrg: orgView(l.donorOrg, party),
    postedBy: l.createdBy ? { name: l.createdBy.name, title: l.createdBy.title } : null,
    claim,
    events: (l.events || []).map((e) => ({
      id: e.id,
      status: e.status,
      note: e.note,
      createdAt: e.createdAt,
      actor: e.actor ? { name: e.actor.name, role: e.actor.role } : { name: 'System', role: 'SYSTEM' },
    })),
    handling: handlingCard(l),
    viewer: { isDonor, isReceiver, isVolunteer, party, onDuty: viewer.role === 'VOLUNTEER' ? !!viewer.volunteerProfile?.available : undefined },
  };
}
