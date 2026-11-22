// Food handling guidance. The platform does NOT certify food safety — these are
// conservative default time limits used to stop listings from being claimed too late.

export const CATEGORY_INFO = {
  RICE_DISH: { label: 'Rice dish (biryani, pulao, rice)', kgPerServing: 0.35, kgPerTray: 5, kgPerVessel: 12, highRisk: true },
  CURRY: { label: 'Curry / dal / gravy', kgPerServing: 0.25, kgPerTray: 4, kgPerVessel: 10, highRisk: true },
  BREAD: { label: 'Breads (roti, naan, buns)', kgPerServing: 0.12, kgPerTray: 3, kgPerVessel: 6, highRisk: false },
  DRY_SNACK: { label: 'Dry snacks', kgPerServing: 0.1, kgPerTray: 2.5, kgPerVessel: 6, highRisk: false },
  SWEETS: { label: 'Sweets / desserts', kgPerServing: 0.12, kgPerTray: 3, kgPerVessel: 8, highRisk: true },
  SALAD: { label: 'Salads / cut fruit', kgPerServing: 0.15, kgPerTray: 3, kgPerVessel: 6, highRisk: true },
  RAW_PRODUCE: { label: 'Raw fruit & vegetables', kgPerServing: 0.3, kgPerTray: 6, kgPerVessel: 12, highRisk: false },
  PACKAGED: { label: 'Sealed packaged food', kgPerServing: 0.2, kgPerTray: 4, kgPerVessel: 8, highRisk: false },
};

// Max hours from preparation until it should be consumed, by storage type.
const SAFE_HOURS = {
  RICE_DISH: { ROOM_TEMP: 2, HOT_HELD: 4, REFRIGERATED: 24 },
  CURRY: { ROOM_TEMP: 2, HOT_HELD: 4, REFRIGERATED: 24 },
  BREAD: { ROOM_TEMP: 6, HOT_HELD: 6, REFRIGERATED: 24 },
  DRY_SNACK: { ROOM_TEMP: 12, HOT_HELD: 12, REFRIGERATED: 24 },
  SWEETS: { ROOM_TEMP: 4, HOT_HELD: 4, REFRIGERATED: 24 },
  SALAD: { ROOM_TEMP: 2, HOT_HELD: 2, REFRIGERATED: 12 },
  RAW_PRODUCE: { ROOM_TEMP: 24, HOT_HELD: 24, REFRIGERATED: 48 },
  PACKAGED: { ROOM_TEMP: 48, HOT_HELD: 48, REFRIGERATED: 72 },
};

export const DELIVERY_BUFFER_MIN = 30;

export function safeHours(category, storage) {
  return SAFE_HOURS[category]?.[storage] ?? 2;
}

export function computeConsumeBy(category, storage, preparedAt) {
  return new Date(new Date(preparedAt).getTime() + safeHours(category, storage) * 3600_000);
}

export function toKg(category, quantity, unit) {
  const info = CATEGORY_INFO[category] || CATEGORY_INFO.CURRY;
  const q = Number(quantity) || 0;
  switch (unit) {
    case 'KG': return q;
    case 'SERVINGS': return +(q * info.kgPerServing).toFixed(2);
    case 'TRAYS': return +(q * info.kgPerTray).toFixed(2);
    case 'VESSELS': return +(q * info.kgPerVessel).toFixed(2);
    default: return q;
  }
}

export function handlingCard({ category, storage, allergens = [], consumeBy }) {
  const info = CATEGORY_INFO[category];
  const steps = [];
  if (storage === 'HOT_HELD') steps.push('Keep hot (above 60°C) in closed, insulated containers until delivery.');
  if (storage === 'REFRIGERATED') steps.push('Keep chilled (below 5°C). Use a cool box or insulated bag with ice packs.');
  if (storage === 'ROOM_TEMP') steps.push('Keep covered and out of direct sun. Move quickly. Do not leave in a parked vehicle.');
  steps.push('Use clean, food-grade, covered containers. Do not mix batches from different donors.');
  if (info?.highRisk) steps.push('High-risk cooked food: reheat until steaming hot throughout before serving.');
  steps.push('Receivers: check look, smell and temperature at handover. Reject if in doubt.');
  steps.push(`Do not serve after ${new Date(consumeBy).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}. Dispose safely if past this time.`);
  return {
    steps,
    allergenWarning: allergens.length
      ? `Contains / may contain: ${allergens.join(', ')}. Tell people who will eat it.`
      : 'No allergens declared by donor. Ask if unsure.',
    disclaimer:
      'RePlate connects donors and receivers. It does not inspect, test or certify food safety. Time limits shown are conservative guidance only. Receivers make the final decision to accept food.',
  };
}
