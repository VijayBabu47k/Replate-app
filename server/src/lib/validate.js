// Shared request validation. Mirrors client/src/lib/validation.js so the API can't be bypassed.
import { HttpError } from './asyncHandler.js';

export const DIETS = ['VEG', 'JAIN', 'VEGAN', 'EGG', 'NON_VEG'];
export const UNITS = ['KG', 'SERVINGS', 'TRAYS', 'VESSELS'];
export const STORAGES = ['HOT_HELD', 'ROOM_TEMP', 'REFRIGERATED'];
export const QTY_LIMITS = { KG: 500, SERVINGS: 2000, TRAYS: 100, VESSELS: 50 };

export const bad = (msg) => { throw new HttpError(400, msg); };
export const str = (v) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());
export const isWhole = (v) => /^\d+$/.test(String(v ?? '').trim());

/** Optional text with a max length; returns the trimmed value or null. */
export function optText(v, max, label) {
  const s = str(v);
  if (s.length > max) bad(`${label} must be at most ${max} characters`);
  return s || null;
}

/** Whole number in [min, max]. */
export function wholeIn(v, min, max, label) {
  if (!isWhole(v) || Number(v) < min || Number(v) > max) bad(`${label} must be a whole number between ${min} and ${max.toLocaleString('en-IN')}`);
  return Number(v);
}
