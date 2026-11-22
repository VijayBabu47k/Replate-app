import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Box, TextField, Button, Typography, Alert, MenuItem, InputAdornment, FormControlLabel, Switch, Slider, CircularProgress, IconButton,
} from '@mui/material';
import { LuChefHat, LuHouse, LuBike, LuCheck, LuEye, LuEyeOff, LuUser, LuBuilding2, LuHeartHandshake, LuMapPin, LuCar, LuArrowRight } from 'react-icons/lu';
import { useAuth, HOME } from '../lib/auth';
import { errMsg } from '../lib/api';
import { useMeta } from '../lib/hooks';
import { IS_DEMO } from '../lib/config';
import { VEHICLE } from '../lib/format';
import { validateRegister } from '../lib/validation';
import { Ambient } from '../components/Motion';
import Brand from '../components/Brand';
import { useToast } from '../lib/toast';

const ROLES = [
  { v: 'DONOR', label: 'Donor', sub: 'Kitchens with surplus', icon: LuChefHat },
  { v: 'RECEIVER', label: 'Receiver', sub: 'NGOs and shelters', icon: LuHouse },
  { v: 'VOLUNTEER', label: 'Volunteer', sub: 'Pick up and deliver', icon: LuBike },
];
const SUBTYPES = {
  DONOR: ['Corporate Cafeteria', 'Contract Caterer', 'Hostel Mess', 'Restaurant', 'Event Organiser'],
  RECEIVER: ['NGO', 'Shelter', 'Community Kitchen', "Children's Home", 'Old Age Home'],
};
const TITLES = {
  DONOR: ['Kitchen Manager', 'Shift Supervisor', 'Facility Ops Lead', 'Owner'],
  RECEIVER: ['Coordinator', 'Kitchen Lead', 'Director', 'Volunteer Lead'],
};

const blank = {
  role: 'DONOR', name: '', email: '', phone: '', password: '', title: 'Kitchen Manager',
  orgName: '', orgSubType: 'Corporate Cafeteria', address: '', fssaiNumber: '', registrationNumber: '',
  capacityMealsPerDay: '', beneficiariesCount: '', beneficiaryType: '', hasFridge: false, canSelfPickup: false,
  vehicle: 'BIKE', vehicleModel: '', vehicleNumber: '', hasInsulatedBag: false, maxRadiusKm: 8,
  country: 'India', state: '', city: '', pincode: '',
};

// Order used to focus the first invalid field on submit
const FIELD_ORDER = [
  'name', 'phone', 'email', 'password', 'orgName', 'orgSubType', 'title', 'fssaiNumber', 'registrationNumber',
  'capacityMealsPerDay', 'beneficiariesCount', 'beneficiaryType', 'vehicleModel', 'vehicleNumber', 'maxRadiusKm',
  'country', 'state', 'city', 'pincode', 'address',
];

function Section({ title, icon: Icon, children }) {
  return (
    <Box className="flex flex-col gap-3">
      <Box className="flex items-center gap-2.5">
        <span className="icon-tile h-8 w-8 !rounded-[10px]"><Icon size={16} /></span>
        <Typography className="!font-semibold">{title}</Typography>
      </Box>
      {children}
    </Box>
  );
}

export default function Register() {
  const { register } = useAuth();
  const meta = useMeta();
  const nav = useNavigate();
  const formRef = useRef(null);
  const [f, setF] = useState(blank);
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState(false);

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const setBool = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.checked }));
  const touch = (k) => () => setTouched((t) => ({ ...t, [k]: true }));

  const errors = useMemo(() => validateRegister(f), [f]);
  const show = (k) => (submitted || touched[k]) && errors[k];
  const errorCount = Object.keys(errors).length;
  /** Props wiring a field to validation: inline error, helper text, mark touched on blur. */
  const v = (k, hint = ' ') => ({ name: k, error: !!show(k), helperText: show(k) || hint, onBlur: touch(k) });

  // Cascading location lists: country → state → city → pincode
  const countries = meta?.locations || [];
  const states = useMemo(() => countries.find((c) => c.name === f.country)?.states || [], [countries, f.country]);
  const cities = useMemo(() => states.find((s) => s.name === f.state)?.cities || [], [states, f.state]);
  const pincodes = useMemo(() => cities.find((c) => c.name === f.city)?.pincodes || [], [cities, f.city]);

  const isOrg = f.role !== 'VOLUNTEER';
  const motorised = f.vehicle !== 'BICYCLE';

  const pickRole = (val) => {
    if (!val || val === f.role) return;
    setF((p) => ({ ...p, role: val, orgSubType: SUBTYPES[val]?.[0] || '', title: TITLES[val]?.[0] || '' }));
    setTouched({});
    setSubmitted(false);
  };

  const focusFirstError = () => {
    const first = FIELD_ORDER.find((k) => errors[k]);
    const input = first && formRef.current?.querySelector(`[name="${first}"]`);
    if (!input) return;
    const box = input.closest('.MuiFormControl-root') || input;
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    (box.querySelector('[role="combobox"]') || input).focus?.({ preventScroll: true });
  };

  const submit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length) {
      toast.warning(errorCount === 1 ? 'Please fix the highlighted field.' : `Please fix the ${errorCount} highlighted fields.`);
      focusFirstError();
      return;
    }
    setBusy(true);
    try {
      const u = await register({ ...f, name: f.name.trim(), email: f.email.trim(), vehicleNumber: f.vehicleNumber.trim().toUpperCase().replace(/\s+/g, ' ') });
      nav(HOME[u.role]);
    } catch (e2) {
      toast.error(errMsg(e2));
      setBusy(false);
    }
  };

  return (
    <Box className="relative flex min-h-screen flex-col">
      <Ambient />
      <Box className="relative z-[1] mx-auto flex w-full max-w-2xl items-center justify-between px-5 pt-6">
        <Link to="/login" className="no-underline"><Brand /></Link>
        <Link to="/login" className="text-sm font-medium text-gray-600 no-underline hover:text-gray-900">Sign in</Link>
      </Box>
      <Box className="glass glow-border page-enter relative z-[1] mx-auto my-8 w-[calc(100%-32px)] max-w-2xl rounded-[28px] p-6 sm:p-9">
          <h1 className="font-display text-gradient m-0 text-[40px] leading-none sm:text-[46px]">Join the rescue</h1>
          <Typography color="text.secondary" className="!mt-2">How will you use RePlate?</Typography>

          <form ref={formRef} onSubmit={submit} noValidate className="mt-6 flex flex-col gap-8">
            <Box role="radiogroup" aria-label="Account type" className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {ROLES.map((r) => {
                const on = f.role === r.v;
                const Icon = r.icon;
                return (
                  <button key={r.v} type="button" role="radio" aria-checked={on} onClick={() => pickRole(r.v)}
                    className={`relative flex cursor-pointer items-center gap-3 rounded-2xl border border-solid p-3.5 text-left transition-all duration-300 sm:flex-col sm:items-start ${on ? 'border-brand-500 bg-brand-50 shadow-[0_0_0_3px_var(--c-brand-100)]' : 'border-gray-200 bg-transparent hover:border-gray-300 hover:bg-gray-50'}`}>
                    <span className={`icon-tile h-10 w-10 ${on ? 'solid' : ''}`}><Icon size={19} /></span>
                    <span>
                      <span className="block text-sm font-semibold text-gray-900">{r.label}</span>
                      <span className="block text-xs text-gray-500">{r.sub}</span>
                    </span>
                    {on && <LuCheck size={16} className="absolute right-3 top-3 text-brand-700" />}
                  </button>
                );
              })}
            </Box>

            <Section title="About you" icon={LuUser}>
              <Box className="grid gap-x-3 gap-y-1 sm:grid-cols-2">
                <TextField label="Full name" placeholder="e.g. Priya Sharma" value={f.name} onChange={set('name')} required autoComplete="name" inputProps={{ maxLength: 80 }} {...v('name')} />
                <TextField
                  label="Mobile number" placeholder="98765 43210" value={f.phone} required autoComplete="tel-national"
                  onChange={(e) => setF((p) => ({ ...p, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                  inputProps={{ inputMode: 'numeric', maxLength: 10 }}
                  InputProps={{ startAdornment: <InputAdornment position="start">+91</InputAdornment> }}
                  {...v('phone')}
                />
                <TextField label="Email" type="email" placeholder="you@example.com" value={f.email} onChange={set('email')} required autoComplete="email" inputProps={{ maxLength: 120 }} {...v('email')} />
                <TextField label="Password" type={reveal ? 'text' : 'password'} placeholder="Create a password" value={f.password} onChange={set('password')} required autoComplete="new-password"
                  inputProps={{ maxLength: 64 }} {...v('password', '8+ characters, a letter and a number')}
                  InputProps={{ endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" edge="end" aria-label={reveal ? 'Hide password' : 'Show password'} onClick={() => setReveal((x) => !x)}>
                        {reveal ? <LuEyeOff size={17} /> : <LuEye size={17} />}
                      </IconButton>
                    </InputAdornment>
                  ) }} />
              </Box>
            </Section>

            {isOrg && (
              <Section title="Your organisation" icon={LuBuilding2}>
                <Box className="grid gap-x-3 gap-y-1 sm:grid-cols-2">
                  <TextField label="Organisation name" placeholder="e.g. Lakeview Cafeteria" value={f.orgName} onChange={set('orgName')} required inputProps={{ maxLength: 100 }} {...v('orgName')} />
                  <TextField select label="Type" value={f.orgSubType} onChange={set('orgSubType')} required {...v('orgSubType')}>
                    {SUBTYPES[f.role].map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </TextField>
                  <TextField select label="Your role there" value={f.title} onChange={set('title')} required {...v('title')}>
                    {TITLES[f.role].map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                  </TextField>
                  {f.role === 'DONOR' ? (
                    <TextField label="FSSAI licence number (optional)" placeholder="14-digit licence number" value={f.fssaiNumber}
                      onChange={(e) => setF((p) => ({ ...p, fssaiNumber: e.target.value.replace(/\D/g, '').slice(0, 14) }))}
                      inputProps={{ inputMode: 'numeric', maxLength: 14 }}
                      {...v('fssaiNumber', '14 digits. Shown to receivers as a trust signal.')} />
                  ) : (
                    <TextField label="Registration number (optional)" value={f.registrationNumber} onChange={set('registrationNumber')}
                      placeholder="e.g. NGO Darpan ID" inputProps={{ maxLength: 30 }} {...v('registrationNumber')} />
                  )}
                </Box>
              </Section>
            )}

            {f.role === 'RECEIVER' && (
              <Section title="Needs & capacity" icon={LuHeartHandshake}>
                <Box className="grid gap-x-3 gap-y-1 sm:grid-cols-2">
                  <TextField type="number" label="Capacity (meals per day)" placeholder="e.g. 150" value={f.capacityMealsPerDay} onChange={set('capacityMealsPerDay')} required
                    inputProps={{ min: 1, max: 10000, step: 1 }} {...v('capacityMealsPerDay')} />
                  <TextField type="number" label="People served (optional)" placeholder="e.g. 80" value={f.beneficiariesCount} onChange={set('beneficiariesCount')}
                    inputProps={{ min: 0, max: 100000, step: 1 }} {...v('beneficiariesCount')} />
                  <TextField label="Who you serve (optional)" value={f.beneficiaryType} onChange={set('beneficiaryType')} placeholder="e.g. Senior citizens, children, families"
                    className="sm:col-span-2" inputProps={{ maxLength: 80 }} {...v('beneficiaryType')} />
                </Box>
                <Box className="flex flex-wrap gap-x-6">
                  <FormControlLabel control={<Switch checked={f.hasFridge} onChange={setBool('hasFridge')} />} label="We have a fridge" />
                  <FormControlLabel control={<Switch checked={f.canSelfPickup} onChange={setBool('canSelfPickup')} />} label="We can collect food ourselves" />
                </Box>
              </Section>
            )}

            {f.role === 'VOLUNTEER' && (
              <Section title="Your vehicle" icon={LuCar}>
                <Box className="grid gap-x-3 gap-y-1 sm:grid-cols-2">
                  <TextField select label="Vehicle type" value={f.vehicle} onChange={set('vehicle')} required {...v('vehicle')}>
                    {Object.entries(VEHICLE).map(([k, label]) => <MenuItem key={k} value={k}>{label}</MenuItem>)}
                  </TextField>
                  <TextField label={motorised ? 'Make & model' : 'Make & model (optional)'} value={f.vehicleModel} onChange={set('vehicleModel')} required={motorised}
                    placeholder={motorised ? 'e.g. Honda Activa 6G' : 'e.g. Hero Sprint'} inputProps={{ maxLength: 40 }} {...v('vehicleModel')} />
                  {motorised && (
                    <TextField label="Registration number" value={f.vehicleNumber} required className="sm:col-span-2"
                      onChange={(e) => setF((p) => ({ ...p, vehicleNumber: e.target.value.toUpperCase().slice(0, 13) }))}
                      placeholder="KA 01 AB 1234"
                      {...v('vehicleNumber', 'Shared with the donor and receiver so they can recognise you at handover.')} />
                  )}
                </Box>
                <Box>
                  <Box className="flex justify-between text-sm"><span className="text-gray-600">Max pickup distance</span><b className="tabular">{f.maxRadiusKm} km</b></Box>
                  <Slider value={f.maxRadiusKm} min={1} max={30} onChange={(_, val) => setF((p) => ({ ...p, maxRadiusKm: val }))} aria-label="Max pickup distance" />
                </Box>
                <FormControlLabel control={<Switch checked={f.hasInsulatedBag} onChange={setBool('hasInsulatedBag')} />} label="I have an insulated food bag" />
              </Section>
            )}

            <Section title="Location" icon={LuMapPin}>
              <Box className="grid gap-x-3 gap-y-1 sm:grid-cols-2">
                <TextField select label="Country" value={f.country} required
                  onChange={(e) => setF((p) => ({ ...p, country: e.target.value, state: '', city: '', pincode: '' }))} {...v('country')}>
                  {countries.map((c) => <MenuItem key={c.name} value={c.name}>{c.name}</MenuItem>)}
                </TextField>
                <TextField select label="State" value={f.state} required disabled={!states.length}
                  onChange={(e) => setF((p) => ({ ...p, state: e.target.value, city: '', pincode: '' }))} {...v('state')}>
                  {states.map((s) => <MenuItem key={s.name} value={s.name}>{s.name}</MenuItem>)}
                </TextField>
                <TextField select label="City" value={f.city} required disabled={!f.state}
                  onChange={(e) => setF((p) => ({ ...p, city: e.target.value, pincode: '' }))}
                  {...v('city', !f.state ? 'Choose a state first' : ' ')}>
                  {cities.map((c) => <MenuItem key={c.name} value={c.name}>{c.name}</MenuItem>)}
                </TextField>
                <TextField select label="Pincode" value={f.pincode} required disabled={!f.city}
                  onChange={set('pincode')} {...v('pincode', !f.city ? 'Choose a city first' : ' ')}>
                  {pincodes.map((p) => <MenuItem key={p.code} value={p.code}>{p.code} — {p.area}</MenuItem>)}
                </TextField>
              </Box>
              {isOrg && (
                <TextField label="Street address" placeholder="Building, street, landmark" value={f.address} onChange={set('address')} required autoComplete="street-address"
                  multiline minRows={2} inputProps={{ maxLength: 200 }} {...v('address', `${f.address.length}/200`)} />
              )}
            </Section>

            <Box className="flex flex-col gap-3">
              <Button type="submit" variant="contained" size="large" disabled={busy || !meta}
                endIcon={busy ? <CircularProgress size={18} color="inherit" /> : <LuArrowRight />}>
                {busy ? 'Creating account…' : 'Create account'}
              </Button>
              <Typography variant="body2" color="text.secondary" className="text-center">Already have an account? <Link to="/login" className="font-semibold text-brand-700 no-underline hover:underline">Sign in</Link></Typography>
            </Box>
          </form>
      </Box>
      {IS_DEMO && <p className="relative z-[1] m-0 px-5 pb-6 text-center text-xs text-gray-500">Demo environment: please use made-up details only.</p>}
    </Box>
  );
}
