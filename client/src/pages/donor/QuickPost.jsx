import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, TextField, ToggleButton, ToggleButtonGroup, Chip, Button, Alert,
  Checkbox, FormControlLabel, Collapse, InputAdornment, CircularProgress, FormHelperText,
} from '@mui/material';
import {
  LuRotateCcw, LuTimer, LuCheck, LuPartyPopper, LuArrowRight, LuPlus, LuChevronDown, LuScale, LuUtensils, LuShieldCheck,
  LuClock, LuCalendarClock, LuMapPin, LuSend, LuBike, LuSparkles,
} from 'react-icons/lu';
import dayjs from 'dayjs';
import { api, errMsg } from '../../lib/api';
import { useMeta, useFetch, useNow } from '../../lib/hooks';
import { PageHeader } from '../../components/Layout';
import { Loading } from '../../components/Feedback';
import { DIET, STORAGE, UNIT, fmtTime } from '../../lib/format';
import { validateListing, QTY_LIMITS } from '../../lib/validation';
import { useToast } from '../../lib/toast';

const blank = { title: '', category: '', dietType: 'VEG', quantity: '', unit: 'SERVINGS', storage: 'HOT_HELD', allergens: [], noAllergens: false, preparedMinsAgo: 30, pickupInMins: 60, notes: '', pickupInstructions: '', deliveryFee: '' };
const FIELD_ORDER = ['title', 'category', 'dietType', 'allergens', 'quantity', 'notes', 'pickupInstructions', 'deliveryFee', 'declared'];

function Section({ n, title, children, done, id }) {
  return (
    <Card id={id}>
      <CardContent className="!p-6">
        <Box className="mb-5 flex items-center gap-3">
          <span className={`grid h-8 w-8 place-items-center rounded-full text-sm font-semibold transition-all duration-300 ${done ? 'bg-grad-glow text-white shadow-[0_6px_16px_-6px_rgba(16,185,129,0.8)]' : 'bg-gray-100 text-gray-600'}`}>{done ? <LuCheck size={16} /> : n}</span>
          <Typography className="!font-semibold">{title}</Typography>
        </Box>
        <Box className="flex flex-col gap-5">{children}</Box>
      </CardContent>
    </Card>
  );
}

function Label({ children, error }) {
  return <div className={`mb-2 text-[13px] font-medium ${error ? 'text-red-700' : 'text-gray-600'}`}>{children}</div>;
}

const fmtWhen = (d) => {
  const days = d.startOf('day').diff(dayjs().startOf('day'), 'day');
  const t = d.format('h:mm A');
  return days === 0 ? t : days === 1 ? `Tomorrow ${t}` : `${d.format('ddd D MMM')} ${t}`;
};
const fmtLeft = (min) => {
  if (min < 60) return `${Math.max(0, min)} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
};

export default function QuickPost() {
  const meta = useMeta();
  const lastPost = useFetch('/donor/last-post');
  const [f, setF] = useState(blank);
  const [declared, setDeclared] = useState(false);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [more, setMore] = useState(false);
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [estimate, setEstimate] = useState(null);
  const feeEdited = useRef(false);
  const startedAt = useRef(null);
  const now = useNow(1000);

  const touch = () => { if (!startedAt.current) startedAt.current = Date.now(); };
  const set = (patch) => { touch(); setF((p) => ({ ...p, ...patch })); };
  const blur = (k) => () => setTouched((t) => ({ ...t, [k]: true }));
  const elapsed = startedAt.current ? Math.round((now - startedAt.current) / 1000) : 0;

  const errors = useMemo(() => {
    const e = validateListing(f);
    if (!declared) e.declared = 'Please confirm the declaration';
    return e;
  }, [f, declared]);
  const show = (k) => (submitted || touched[k]) && errors[k];

  // Suggest a delivery fee from the distance to likely receivers (debounced); never overrides a donor's own edit
  const canEstimate = f.category && f.quantity && !errors.quantity;
  useEffect(() => {
    if (!canEstimate) return undefined;
    const t = setTimeout(() => {
      api.post('/donor/fee-estimate', { category: f.category, quantity: Number(f.quantity), unit: f.unit, storage: f.storage, dietType: f.dietType, preparedMinsAgo: f.preparedMinsAgo })
        .then((r) => {
          setEstimate(r.data);
          if (!feeEdited.current) setF((p) => ({ ...p, deliveryFee: String(r.data.suggested) }));
        })
        .catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [canEstimate, f.category, f.quantity, f.unit, f.storage, f.dietType, f.preparedMinsAgo]);

  const cat = meta?.categories.find((c) => c.value === f.category);
  const preview = useMemo(() => {
    if (!cat || !f.quantity || errors.quantity) return null;
    const per = { KG: 1, SERVINGS: cat.kgPerServing, TRAYS: cat.kgPerTray, VESSELS: cat.kgPerVessel }[f.unit];
    const kg = +(Number(f.quantity) * per).toFixed(1);
    const preparedAt = dayjs().subtract(f.preparedMinsAgo, 'minute');
    const hours = cat.safeHours[f.storage];
    const consumeBy = preparedAt.add(hours, 'hour');
    const latestPickup = consumeBy.subtract(meta.deliveryBufferMin, 'minute');
    let pickupBy = dayjs().add(f.pickupInMins, 'minute');
    const adjusted = pickupBy.isAfter(latestPickup);
    if (adjusted) pickupBy = latestPickup;
    const minutesLeft = consumeBy.diff(dayjs(), 'minute');
    return { kg, meals: Math.max(1, Math.round(kg / meta.kgPerMeal)), consumeBy, pickupBy, adjusted, hours, minutesLeft, tooLate: minutesLeft < 45 };
  }, [cat, f, meta, now, errors.quantity]); // eslint-disable-line react-hooks/exhaustive-deps

  const repeatLast = (t) => {
    touch();
    feeEdited.current = false;
    setF({ ...blank, title: t.title, category: t.category, dietType: t.dietType, quantity: String(t.quantity), unit: t.unit, storage: t.storage, allergens: t.allergens, noAllergens: !t.allergens?.length, pickupInMins: 60 });
  };

  const focusFirstError = () => {
    const first = FIELD_ORDER.find((k) => errors[k]);
    const el = first && document.querySelector(`[data-field="${first}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.querySelector('input')?.focus({ preventScroll: true });
  };

  const submit = async () => {
    setSubmitted(true);
    const n = Object.keys(errors).length;
    if (n) { toast.warning(n === 1 ? 'Please fix 1 field to post.' : `Please fix ${n} fields to post.`); focusFirstError(); return; }
    if (preview?.tooLate) return;
    setBusy(true);
    try {
      const { noAllergens, ...body } = f; // eslint-disable-line no-unused-vars
      const r = await api.post('/listings', {
        ...body,
        title: f.title.trim(),
        notes: f.notes.trim(),
        pickupInstructions: f.pickupInstructions.trim(),
        quantity: Number(f.quantity),
        deliveryFee: Number(f.deliveryFee),
        preparedAt: dayjs().subtract(f.preparedMinsAgo, 'minute').toISOString(),
        pickupBy: dayjs().add(f.pickupInMins, 'minute').toISOString(),
        declarationAccepted: declared,
        postDurationSec: elapsed || null,
      });
      setResult({ ...r.data, seconds: elapsed });
      toast.success('Surplus posted. Matched receivers have been alerted.');
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => { setResult(null); setF(blank); setDeclared(false); setTouched({}); setSubmitted(false); setEstimate(null); feeEdited.current = false; startedAt.current = null; };

  if (!meta || !lastPost.data) return <Loading />;

  if (result) {
    const top = result.matches.filter((m) => m.eligible).slice(0, 3);
    return (
      <Box className="mx-auto max-w-2xl">
        <Card className="glow-border">
          <CardContent className="!p-8 text-center">
            <span className="icon-tile solid mx-auto h-16 w-16 !rounded-[20px]"><LuPartyPopper size={28} /></span>
            <h1 className="font-display text-gradient mb-0 mt-5 text-[40px] leading-none">Posted{result.seconds ? ` in ${result.seconds}s` : ''}</h1>
            <Typography color="text.secondary" className="!mt-3">
              {result.listing.title}, about {result.listing.estimatedMeals} meals. We alerted {result.notified} best-matched receivers.
              {result.listing.deliveryFee > 0 && ` The volunteer earns ₹${result.listing.deliveryFee} on delivery.`}
            </Typography>
            {result.pickupAdjusted && <Alert severity="info" className="!mt-4 text-left">Pickup moved to {fmtTime(result.listing.pickupBy)} so delivery finishes inside the safe window.</Alert>}
            <Box className="mt-6 text-left">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Top matches</div>
              {top.length ? top.map((m, i) => (
                <Box key={m.receiverOrgId} className="sunk mt-2 flex items-center gap-3 rounded-2xl p-3.5">
                  <span className="tabular grid h-8 w-8 place-items-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">{i + 1}</span>
                  <Box className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-gray-900">{m.receiverName}</div>
                    <div className="truncate text-xs text-gray-500">{m.distanceKm} km · {m.reasons.slice(1, 2).join('')}</div>
                  </Box>
                  <span className="tabular text-sm font-semibold text-brand-700">{Math.round(m.score * 100)}</span>
                </Box>
              )) : <Alert severity="warning">No receiver can take this right now. It stays visible until the safe window closes.</Alert>}
            </Box>
            <Box className="mt-7 flex flex-wrap justify-center gap-2">
              <Button variant="contained" endIcon={<LuArrowRight />} component={Link} to={`/listings/${result.listing.id}`}>Track live</Button>
              <Button variant="outlined" startIcon={<LuPlus />} onClick={reset}>Post another</Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    );
  }

  const step1 = !errors.title && !errors.category && !errors.allergens;
  const step2 = !errors.quantity;
  const over = elapsed > 60;

  return (
    <Box className="mx-auto max-w-6xl">
      <PageHeader
        title="Post surplus"
        action={
          <>
            {lastPost.data.last && (
              <Button variant="outlined" startIcon={<LuRotateCcw size={16} />} onClick={() => repeatLast(lastPost.data.last)} sx={{ maxWidth: 280 }}>
                <span className="truncate">Repeat: {lastPost.data.last.title}</span>
              </Button>
            )}
            <span className={`pill tabular !px-3 !py-2 !text-[13px] ring-1 ring-inset ${over ? 'bg-red-50 text-red-700 ring-red-200' : 'bg-brand-50 text-brand-700 ring-brand-100'}`}>
              <LuTimer /> {elapsed}s
            </span>
          </>
        }
      />

      <Box className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Box className="flex flex-col gap-5">
          <Section n={1} title="What food?" done={step1}>
            <Box data-field="title">
              <TextField fullWidth label="Dish name" placeholder="e.g. Veg Biryani" value={f.title} required name="title"
                onChange={(e) => set({ title: e.target.value.slice(0, 80) })} onBlur={blur('title')}
                error={!!show('title')} helperText={show('title') || ' '} inputProps={{ maxLength: 80 }} />
            </Box>
            <Box data-field="category">
              <Label error={!!show('category')}>Category *</Label>
              <Box className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Food category">
                {meta.categories.map((c) => {
                  const on = f.category === c.value;
                  return <Chip key={c.value} label={c.label} clickable role="radio" aria-checked={on} color={on ? 'primary' : 'default'} variant={on ? 'filled' : 'outlined'}
                    icon={on ? <LuCheck size={14} /> : undefined} onClick={() => set({ category: c.value })} />;
                })}
              </Box>
              {show('category') && <FormHelperText error>{errors.category}</FormHelperText>}
            </Box>
            <Box data-field="dietType">
              <Label>Diet *</Label>
              <ToggleButtonGroup exclusive size="small" value={f.dietType} onChange={(_, v) => v && set({ dietType: v })} className="flex-wrap">
                {meta.diets.map((d) => <ToggleButton key={d} value={d}>{DIET[d].label}</ToggleButton>)}
              </ToggleButtonGroup>
            </Box>
            <Box data-field="allergens">
              <Label error={!!show('allergens')}>Allergens *</Label>
              <Box className="flex flex-wrap gap-1.5">
                <Chip size="small" label="No allergens" clickable icon={<LuShieldCheck size={14} />} color={f.noAllergens ? 'success' : 'default'} variant={f.noAllergens ? 'filled' : 'outlined'}
                  onClick={() => set({ noAllergens: !f.noAllergens, allergens: [] })} />
                {meta.allergens.map((a) => {
                  const on = f.allergens.includes(a);
                  return <Chip key={a} size="small" label={a} clickable color={on ? 'warning' : 'default'} variant={on ? 'filled' : 'outlined'}
                    onClick={() => set({ noAllergens: false, allergens: on ? f.allergens.filter((x) => x !== a) : [...f.allergens, a] })} />;
                })}
              </Box>
              {show('allergens') && <FormHelperText error>{errors.allergens}</FormHelperText>}
            </Box>
          </Section>

          <Section n={2} title="How much?" done={step2}>
            <Box className="grid items-start gap-3 sm:grid-cols-[200px_1fr]" data-field="quantity">
              <TextField label="Quantity" placeholder="e.g. 40" value={f.quantity} required name="quantity"
                onChange={(e) => set({ quantity: e.target.value.replace(/[^\d.]/g, '').slice(0, 7) })} onBlur={blur('quantity')}
                error={!!show('quantity')} helperText={show('quantity') || `Max ${QTY_LIMITS[f.unit]}`}
                inputProps={{ inputMode: 'decimal' }}
                InputProps={{ endAdornment: <InputAdornment position="end">{UNIT[f.unit]}</InputAdornment> }} />
              <ToggleButtonGroup exclusive value={f.unit} onChange={(_, v) => v && set({ unit: v })} className="flex-wrap !pt-1.5" aria-label="Unit">
                {meta.units.map((u) => <ToggleButton key={u} value={u} size="small">{UNIT[u]}</ToggleButton>)}
              </ToggleButtonGroup>
            </Box>
            <Box>
              <Label>Storage *</Label>
              <ToggleButtonGroup exclusive value={f.storage} onChange={(_, v) => v && set({ storage: v })} className="flex-wrap" size="small">
                {meta.storages.map((s) => { const I = STORAGE[s].Icon; return <ToggleButton key={s} value={s}><I size={15} /> {STORAGE[s].label}</ToggleButton>; })}
              </ToggleButtonGroup>
            </Box>
          </Section>

          <Section n={3} title="When?" done={step1 && step2}>
            <Box>
              <Label>Cooked about</Label>
              <Box className="flex flex-wrap gap-1.5">
                {[15, 30, 60, 90, 120].map((m) => <Chip key={m} label={m < 60 ? `${m} min ago` : `${m / 60}h ago`} clickable color={f.preparedMinsAgo === m ? 'primary' : 'default'} variant={f.preparedMinsAgo === m ? 'filled' : 'outlined'} onClick={() => set({ preparedMinsAgo: m })} />)}
              </Box>
            </Box>
            <Box>
              <Label>Pickup by</Label>
              <Box className="flex flex-wrap gap-1.5">
                {[30, 60, 90, 120, 180].map((m) => <Chip key={m} label={dayjs().add(m, 'minute').format('h:mm A')} clickable color={f.pickupInMins === m ? 'primary' : 'default'} variant={f.pickupInMins === m ? 'filled' : 'outlined'} onClick={() => set({ pickupInMins: m })} />)}
              </Box>
            </Box>
            <Box>
              <Button size="small" color="inherit" onClick={() => setMore(!more)} endIcon={<LuChevronDown size={15} style={{ transform: more ? 'rotate(180deg)' : 'none', transition: 'transform .25s' }} />}>
                Notes & pickup instructions
              </Button>
              <Collapse in={more || !!show('notes') || !!show('pickupInstructions')}>
                <Box className="mt-3 grid gap-1">
                  <Box data-field="notes">
                    <TextField fullWidth multiline minRows={2} label="Notes for receivers" placeholder="e.g. Packed in 3 steel containers" value={f.notes} name="notes"
                      onChange={(e) => set({ notes: e.target.value.slice(0, 300) })} onBlur={blur('notes')}
                      error={!!show('notes')} helperText={show('notes') || `${f.notes.length}/300`} />
                  </Box>
                  <Box data-field="pickupInstructions">
                    <TextField fullWidth label="Pickup instructions" placeholder="e.g. Gate 2, ask for the kitchen" value={f.pickupInstructions} name="pickupInstructions"
                      onChange={(e) => set({ pickupInstructions: e.target.value.slice(0, 200) })} onBlur={blur('pickupInstructions')}
                      error={!!show('pickupInstructions')} helperText={show('pickupInstructions') || 'Shown only after someone claims it'}
                      InputProps={{ startAdornment: <InputAdornment position="start"><LuMapPin /></InputAdornment> }} />
                  </Box>
                </Box>
              </Collapse>
            </Box>
          </Section>
        </Box>

        <Box>
          <Card className="glow-border lg:sticky lg:top-24">
            <CardContent className="flex flex-col gap-4 !p-6">
              <Typography className="!font-semibold">Summary</Typography>
              {!preview ? (
                <div className="sunk rounded-2xl p-4 text-sm text-gray-500">Pick a category and quantity to see the safe window.</div>
              ) : (
                <>
                  <Box className="grid grid-cols-2 gap-2">
                    <div className="sunk rounded-2xl p-3.5"><LuScale size={16} className="text-gray-400" /><div className="tabular mt-1 text-xl font-semibold text-gray-900">{preview.kg} kg</div></div>
                    <div className="sunk rounded-2xl p-3.5"><LuUtensils size={16} className="text-gray-400" /><div className="tabular mt-1 text-xl font-semibold text-gray-900">{preview.meals} meals</div></div>
                  </Box>
                  <Box className="flex flex-col gap-2.5 text-sm">
                    <div className="flex items-center justify-between gap-2"><span className="inline-flex items-center gap-2 text-gray-600"><LuShieldCheck size={15} /> Safe window</span><b className="tabular">{preview.hours}h from cooking</b></div>
                    <div className="flex items-center justify-between gap-2"><span className="inline-flex items-center gap-2 text-gray-600"><LuClock size={15} /> Consume by</span><b className="tabular">{fmtWhen(preview.consumeBy)} <span className="font-normal text-gray-500">({fmtLeft(preview.minutesLeft)})</span></b></div>
                    <div className="flex items-center justify-between gap-2"><span className="inline-flex items-center gap-2 text-gray-600"><LuCalendarClock size={15} /> Pickup by</span><b className="tabular">{fmtWhen(preview.pickupBy)}</b></div>
                  </Box>
                  {preview.adjusted && <Alert severity="info" className="!text-xs">Pickup moved earlier to leave {meta.deliveryBufferMin} min for delivery.</Alert>}
                  {preview.tooLate && <Alert severity="error" className="!text-xs">Too close to the end of the safe window. Please don't post this food.</Alert>}
                </>
              )}
              <Box data-field="deliveryFee" className="sunk rounded-2xl p-4">
                <Box className="mb-3 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900"><LuBike size={16} className="text-brand-700" /> Delivery fee</span>
                  {estimate && String(estimate.suggested) !== String(f.deliveryFee) && (
                    <button type="button" onClick={() => { feeEdited.current = false; set({ deliveryFee: String(estimate.suggested) }); }}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-full border-0 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100">
                      <LuSparkles size={12} /> Use ₹{estimate.suggested}
                    </button>
                  )}
                </Box>
                <TextField fullWidth size="small" value={f.deliveryFee} name="deliveryFee" required placeholder={canEstimate ? 'Calculating…' : 'Add food details first'}
                  onChange={(e) => { feeEdited.current = true; set({ deliveryFee: e.target.value.replace(/\D/g, '').slice(0, 3) }); }} onBlur={blur('deliveryFee')}
                  error={!!show('deliveryFee')}
                  helperText={show('deliveryFee') || (estimate ? `Suggested for ~${estimate.km} km. Paid to the volunteer on delivery.` : 'Paid to the volunteer on delivery.')}
                  inputProps={{ inputMode: 'numeric', 'aria-label': 'Delivery fee in rupees' }}
                  InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }} />
                <div className="mt-1 text-[11px] text-gray-500">Not charged if the receiver collects it themselves.</div>
              </Box>
              <Box data-field="declared">
                <FormControlLabel
                  className="!mr-0 !items-start"
                  control={<Checkbox checked={declared} onChange={(e) => { touch(); setDeclared(e.target.checked); }} sx={{ pt: 0.25 }} />}
                  label={<span className={`text-xs leading-relaxed ${show('declared') ? 'text-red-700' : 'text-gray-600'}`}>I confirm this food was prepared hygienically, not served from plates, stored as stated, and the allergens are correct.</span>}
                />
              </Box>
              <Button fullWidth variant="contained" size="large" disabled={busy || !!preview?.tooLate} onClick={submit}
                endIcon={busy ? <CircularProgress size={18} color="inherit" /> : <LuSend size={17} />}>
                {busy ? 'Posting…' : 'Post surplus'}
              </Button>
              <p className="m-0 text-center text-[11px] leading-relaxed text-gray-500">The platform connects people. It does not certify food safety.</p>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
}
