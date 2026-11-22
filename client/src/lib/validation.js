// Client-side form validation. The server enforces the same rules (server/src/routes/auth.js).

export const RULES = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  name: /^[A-Za-z][A-Za-z .'-]{1,79}$/,
  phone: /^[6-9]\d{9}$/,
  plate: /^[A-Z]{2}\s?\d{1,2}\s?[A-Z]{0,3}\s?\d{4}$/,
  fssai: /^\d{14}$/,
  regNo: /^[A-Za-z0-9][A-Za-z0-9 /-]{3,29}$/,
};

const trim = (v) => (typeof v === 'string' ? v.trim() : v);
const isInt = (v) => /^\d+$/.test(String(v ?? '').trim());

export function validateEmail(v) {
  const e = trim(v);
  if (!e) return 'Email is required';
  if (e.length > 120 || !RULES.email.test(e)) return 'Enter a valid email address';
  return '';
}

export function validateLogin({ email, password }) {
  const errors = {};
  const e = validateEmail(email);
  if (e) errors.email = e;
  if (!password) errors.password = 'Password is required';
  return errors;
}

export function validatePassword(p = '') {
  if (!p) return 'Password is required';
  if (p.length < 8) return 'Use at least 8 characters';
  if (p.length > 64) return 'Use at most 64 characters';
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Include at least one letter and one number';
  return '';
}

export function validateRegister(f) {
  const errors = {};
  const req = (k, msg) => { if (!trim(f[k])) errors[k] = msg; };

  // About you
  if (!trim(f.name)) errors.name = 'Full name is required';
  else if (!RULES.name.test(trim(f.name))) errors.name = 'Use 2–80 letters (spaces, . \' - allowed)';
  if (!f.phone) errors.phone = 'Mobile number is required';
  else if (!RULES.phone.test(f.phone)) errors.phone = 'Enter a 10-digit mobile number starting with 6–9';
  const em = validateEmail(f.email);
  if (em) errors.email = em;
  const pw = validatePassword(f.password);
  if (pw) errors.password = pw;

  // Organisation (donor / receiver)
  if (f.role !== 'VOLUNTEER') {
    const org = trim(f.orgName);
    if (!org) errors.orgName = 'Organisation name is required';
    else if (org.length < 2 || org.length > 100) errors.orgName = 'Use 2–100 characters';
    req('orgSubType', 'Choose a type');
    req('title', 'Choose your role');
    const addr = trim(f.address);
    if (!addr) errors.address = 'Address is required';
    else if (addr.length < 5 || addr.length > 200) errors.address = 'Use 5–200 characters';
    if (f.role === 'DONOR' && f.fssaiNumber && !RULES.fssai.test(f.fssaiNumber)) errors.fssaiNumber = 'FSSAI licence number must be exactly 14 digits';
    if (f.role === 'RECEIVER' && trim(f.registrationNumber) && !RULES.regNo.test(trim(f.registrationNumber))) {
      errors.registrationNumber = '4–30 letters, numbers, spaces, / or -';
    }
  }

  // Receiver needs
  if (f.role === 'RECEIVER') {
    if (f.capacityMealsPerDay === '' || f.capacityMealsPerDay == null) errors.capacityMealsPerDay = 'Capacity is required';
    else if (!isInt(f.capacityMealsPerDay) || +f.capacityMealsPerDay < 1 || +f.capacityMealsPerDay > 10000) errors.capacityMealsPerDay = 'Whole number between 1 and 10,000';
    if (f.beneficiariesCount !== '' && f.beneficiariesCount != null && (!isInt(f.beneficiariesCount) || +f.beneficiariesCount > 100000)) {
      errors.beneficiariesCount = 'Whole number between 0 and 100,000';
    }
    if (trim(f.beneficiaryType) && trim(f.beneficiaryType).length > 80) errors.beneficiaryType = 'Use at most 80 characters';
  }

  // Volunteer vehicle
  if (f.role === 'VOLUNTEER') {
    const motorised = f.vehicle !== 'BICYCLE';
    const model = trim(f.vehicleModel);
    if (motorised && !model) errors.vehicleModel = 'Make & model is required';
    else if (model && (model.length < 2 || model.length > 40)) errors.vehicleModel = 'Use 2–40 characters';
    if (motorised) {
      const plate = trim(f.vehicleNumber || '').toUpperCase().replace(/\s+/g, ' ');
      if (!plate) errors.vehicleNumber = 'Registration number is required';
      else if (!RULES.plate.test(plate)) errors.vehicleNumber = 'Use the format KA 01 AB 1234';
    }
    if (!(f.maxRadiusKm >= 1 && f.maxRadiusKm <= 30)) errors.maxRadiusKm = 'Choose 1–30 km';
  }

  // Location
  req('country', 'Choose a country');
  req('state', 'Choose a state');
  req('city', 'Choose a city');
  req('pincode', 'Choose a pincode');
  return errors;
}

// ---------- Quick post (donor) ----------
export const FEE_MAX = 500;
export const QTY_LIMITS = { KG: 500, SERVINGS: 2000, TRAYS: 100, VESSELS: 50 };
const TEXT_RE = /[A-Za-z]/;

export function validateListing(f) {
  const errors = {};
  const title = trim(f.title);
  if (!title) errors.title = 'Dish name is required';
  else if (title.length < 2 || title.length > 80) errors.title = 'Use 2–80 characters';
  else if (!TEXT_RE.test(title)) errors.title = 'Include at least one letter';
  if (!f.category) errors.category = 'Choose a food category';
  if (!f.dietType) errors.dietType = 'Choose a diet type';
  if (!f.allergens?.length && !f.noAllergens) errors.allergens = 'Select the allergens, or choose "No allergens"';

  const q = String(f.quantity ?? '').trim();
  const max = QTY_LIMITS[f.unit] || 500;
  if (!q) errors.quantity = 'Quantity is required';
  else if (!/^\d+(\.\d{1,2})?$/.test(q) || Number(q) <= 0) errors.quantity = 'Enter a number greater than 0';
  else if (f.unit !== 'KG' && !isInt(q)) errors.quantity = 'Use a whole number';
  else if (Number(q) > max) errors.quantity = `Maximum ${max} per post`;

  const fee = String(f.deliveryFee ?? '').trim();
  if (fee === '') errors.deliveryFee = 'Enter a delivery fee (₹0 for unpaid volunteering)';
  else if (!isInt(fee)) errors.deliveryFee = 'Use a whole number of rupees';
  else if (+fee > FEE_MAX) errors.deliveryFee = `Maximum ₹${FEE_MAX}`;
  if (trim(f.notes) && trim(f.notes).length > 300) errors.notes = 'Use at most 300 characters';
  if (trim(f.pickupInstructions) && trim(f.pickupInstructions).length > 200) errors.pickupInstructions = 'Use at most 200 characters';
  return errors;
}

// ---------- Receiver needs & capacity ----------
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
export function validateReceiverProfile(f) {
  const errors = {};
  const cap = String(f.capacityMealsPerDay ?? '').trim();
  if (!cap) errors.capacityMealsPerDay = 'Capacity is required';
  else if (!isInt(cap) || +cap < 1 || +cap > 10000) errors.capacityMealsPerDay = 'Whole number between 1 and 10,000';
  const ben = String(f.beneficiariesCount ?? '').trim();
  if (ben && (!isInt(ben) || +ben > 100000)) errors.beneficiariesCount = 'Whole number between 0 and 100,000';
  if (!HHMM.test(f.intakeStart || '')) errors.intakeStart = 'Choose an opening time';
  if (!HHMM.test(f.intakeEnd || '')) errors.intakeEnd = 'Choose a closing time';
  else if (HHMM.test(f.intakeStart || '') && f.intakeEnd <= f.intakeStart) errors.intakeEnd = 'Must be after the opening time';
  if (trim(f.beneficiaryType) && trim(f.beneficiaryType).length > 80) errors.beneficiaryType = 'Use at most 80 characters';
  if (!f.dietAccepted?.length) errors.dietAccepted = 'Choose at least one';
  return errors;
}

// ---------- Volunteer profile ----------
export function validateVolunteerProfile(f) {
  const errors = {};
  const motorised = f.vehicle !== 'BICYCLE';
  const model = trim(f.vehicleModel || '');
  if (!f.vehicle) errors.vehicle = 'Choose a vehicle';
  if (motorised && !model) errors.vehicleModel = 'Make & model is required';
  else if (model && (model.length < 2 || model.length > 40)) errors.vehicleModel = 'Use 2–40 characters';
  if (motorised) {
    const plate = trim(f.vehicleNumber || '').toUpperCase().replace(/\s+/g, ' ');
    if (!plate) errors.vehicleNumber = 'Registration number is required';
    else if (!RULES.plate.test(plate)) errors.vehicleNumber = 'Use the format KA 01 AB 1234';
  }
  if (!f.state) errors.state = 'Choose a state';
  if (!f.city) errors.city = 'Choose a city';
  if (!f.pincode) errors.pincode = 'Choose a pincode';
  if (!(f.maxRadiusKm >= 1 && f.maxRadiusKm <= 30)) errors.maxRadiusKm = 'Choose 1–30 km';
  return errors;
}

// ---------- Handover dialogs ----------
export function validateOtp(otp) {
  if (!otp) return 'Enter the 4-digit code';
  if (!/^\d{4}$/.test(otp)) return 'The code has exactly 4 digits';
  return '';
}

export function validateReceived({ accepted, kg, maxKg, reason, details }) {
  const errors = {};
  if (accepted) {
    const v = String(kg ?? '').trim();
    if (!v) errors.kg = 'Enter the quantity received';
    else if (!/^\d+(\.\d{1,2})?$/.test(v) || Number(v) <= 0) errors.kg = 'Enter a number greater than 0';
    else if (Number(v) > maxKg) errors.kg = `Cannot be more than the ${maxKg} kg sent`;
  } else {
    if (!reason) errors.reason = 'Choose a reason';
    if (reason === 'Other') {
      const d = trim(details || '');
      if (!d) errors.details = 'Tell the donor what was wrong';
      else if (d.length < 5 || d.length > 200) errors.details = 'Use 5–200 characters';
    }
  }
  return errors;
}

/** Helper for MUI TextFields: wires error + helper text + touched-on-blur. */
export function fieldProps(errors, touched, submitted, setTouched) {
  return (k, hint = ' ') => {
    const show = (submitted || touched[k]) && errors[k];
    return { name: k, error: !!show, helperText: show || hint, onBlur: () => setTouched((t) => ({ ...t, [k]: true })) };
  };
}

// ---------- Volunteer payouts ----------
export const UPI_RE = /^[\w.-]{2,}@[A-Za-z]{2,}$/;
export function validateUpi(v, { required = true } = {}) {
  const u = trim(v || '');
  if (!u) return required ? 'UPI ID is required' : '';
  if (!UPI_RE.test(u)) return 'Enter a valid UPI ID, e.g. name@okbank';
  return '';
}
