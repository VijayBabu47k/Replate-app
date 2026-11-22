// Delivery fee rules: suggested from distance and load, editable by the donor within MIN..MAX.
export const FEE = {
  BASE: 30, // ₹ per trip
  PER_KM: 8, // ₹ per km driven
  APPROACH_KM: 2, // typical distance from the volunteer to the pickup point
  HEAVY_KG: 20, // above this the volunteer usually needs a bigger vehicle
  HEAVY_EXTRA: 20,
  MIN: 0, // 0 = unpaid volunteering
  MAX: 500,
  MIN_PAYOUT: 100,
  DEFAULT_KM: 5, // used when no receiver can be matched yet
};

export const autoSettle = () => !/^(0|false|no|off)$/i.test(String(process.env.PAYOUT_AUTO_SETTLE ?? 'true').trim());

/** Suggested fee in whole rupees, rounded to ₹5 and clamped to the allowed range. */
export function suggestFee({ kmEstimate = FEE.DEFAULT_KM, quantityKg = 0 }) {
  const raw = FEE.BASE + FEE.PER_KM * (kmEstimate + FEE.APPROACH_KM) + (quantityKg > FEE.HEAVY_KG ? FEE.HEAVY_EXTRA : 0);
  return Math.min(FEE.MAX, Math.max(FEE.MIN, Math.round(raw / 5) * 5));
}

export const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export const UPI_RE = /^[\w.-]{2,}@[A-Za-z]{2,}$/;
