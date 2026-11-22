import { useEffect, useMemo, useState } from 'react';
import { Box, Card, CardContent, Typography, TextField, MenuItem, Switch, FormControlLabel, Button, Slider, CircularProgress, InputAdornment } from '@mui/material';
import { LuBike, LuPackage, LuUtensils, LuClock, LuCar, LuMapPin, LuSave, LuWallet, LuAtSign } from 'react-icons/lu';
import { useFetch, useMeta } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { api, errMsg } from '../../lib/api';
import { Loading } from '../../components/Feedback';
import { PageHeader } from '../../components/Layout';
import { StatCard } from '../../components/Impact';
import { VEHICLE, VEHICLE_ICON } from '../../lib/format';
import { validateVolunteerProfile, validateUpi, fieldProps } from '../../lib/validation';
import { useToast } from '../../lib/toast';

function Block({ icon: Icon, title, children }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 !p-6">
        <Box className="flex items-center gap-2.5">
          <span className="icon-tile h-9 w-9"><Icon size={18} /></span>
          <Typography className="!font-semibold">{title}</Typography>
        </Box>
        {children}
      </CardContent>
    </Card>
  );
}

export default function VolunteerProfile() {
  const { data, reload } = useFetch('/volunteer/profile');
  const meta = useMeta();
  const { user } = useAuth();
  const [f, setF] = useState(null);
  const toast = useToast();
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setF({ ...data.profile, vehicleModel: data.profile.vehicleModel || '', vehicleNumber: data.profile.vehicleNumber || '', upiId: data.profile.upiId || '' }); }, [data]);
  const errors = useMemo(() => {
    if (!f) return {};
    const e = validateVolunteerProfile(f);
    const u = validateUpi(f.upiId, { required: false });
    if (u) e.upiId = u;
    return e;
  }, [f]);
  if (!data || !f || !meta) return <Loading />;
  const s = data.stats;
  const motorised = f.vehicle !== 'BICYCLE';
  const v = fieldProps(errors, touched, submitted, setTouched);
  const upd = (patch) => { setF((p) => ({ ...p, ...patch })); };

  // Cascading location lists
  const states = meta.locations.find((c) => c.name === f.country)?.states || [];
  const cities = states.find((x) => x.name === f.state)?.cities || [];
  const pincodes = cities.find((x) => x.name === f.city)?.pincodes || [];

  const save = async () => {
    setSubmitted(true);
    if (Object.keys(errors).length) { toast.warning('Please fix the highlighted fields.'); return; }
    setBusy(true);
    try {
      await api.patch('/volunteer/profile', {
        ...f,
        vehicleModel: f.vehicleModel.trim(),
        vehicleNumber: motorised ? f.vehicleNumber.trim().toUpperCase().replace(/\s+/g, ' ') : '',
        upiId: f.upiId.trim(),
      });
      toast.success('Profile saved');
      setSubmitted(false);
      setTouched({});
      reload();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <Box className="mx-auto max-w-5xl">
      <PageHeader eyebrow={[user?.phone, `${data.profile.area}, ${data.profile.city}`].filter(Boolean).join(' · ')} title="My profile" />
      <Box className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Deliveries" value={s.deliveries} icon={LuBike} />
        <StatCard label="Food carried" value={`${s.kg} kg`} icon={LuPackage} tone="teal" />
        <StatCard label="Meals delivered" value={s.meals} icon={LuUtensils} tone="lime" formula="kg delivered ÷ 0.4 kg per meal" />
        <StatCard label="Volunteer hours" value={s.hours} icon={LuClock} tone="blue" formula="Time from accepting each task to delivery (minimum 10 min per task)" />
      </Box>

      <Box className="mt-5 grid gap-5 lg:grid-cols-2">
        <Block icon={LuCar} title="Vehicle">
          <Box className="flex flex-col gap-1">
            <TextField select label="Vehicle type" value={f.vehicle} required onChange={(e) => upd({ vehicle: e.target.value })} {...v('vehicle')}>
              {Object.entries(VEHICLE).map(([k, label]) => { const I = VEHICLE_ICON[k]; return <MenuItem key={k} value={k}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><I size={16} /> {label}</span></MenuItem>; })}
            </TextField>
            <TextField label={motorised ? 'Make & model' : 'Make & model (optional)'} value={f.vehicleModel} required={motorised}
              onChange={(e) => upd({ vehicleModel: e.target.value.slice(0, 40) })} placeholder="e.g. Honda Activa 6G" {...v('vehicleModel')} />
            {motorised && (
              <TextField label="Registration number" value={f.vehicleNumber} required
                onChange={(e) => upd({ vehicleNumber: e.target.value.toUpperCase().slice(0, 13) })}
                placeholder="KA 01 AB 1234" {...v('vehicleNumber', 'Shown to the donor and receiver on your tasks')} />
            )}
            <FormControlLabel control={<Switch checked={f.hasInsulatedBag} onChange={(e) => upd({ hasInsulatedBag: e.target.checked })} />} label="I have an insulated food bag" />
          </Box>
        </Block>

        <Block icon={LuMapPin} title="Area & availability">
          <Box className="grid gap-x-3 gap-y-1 sm:grid-cols-2">
            <TextField select label="State" value={f.state} required onChange={(e) => upd({ state: e.target.value, city: '', pincode: '' })} {...v('state')}>
              {states.map((x) => <MenuItem key={x.name} value={x.name}>{x.name}</MenuItem>)}
            </TextField>
            <TextField select label="City" value={f.city} required disabled={!f.state} onChange={(e) => upd({ city: e.target.value, pincode: '' })} {...v('city')}>
              {cities.map((x) => <MenuItem key={x.name} value={x.name}>{x.name}</MenuItem>)}
            </TextField>
            <TextField select label="Pincode" value={f.pincode} required disabled={!f.city} onChange={(e) => upd({ pincode: e.target.value })} className="sm:col-span-2"
              {...v('pincode', 'Tasks are ranked by distance from here')}>
              {pincodes.map((x) => <MenuItem key={x.code} value={x.code}>{x.code} — {x.area}</MenuItem>)}
            </TextField>
          </Box>
          <Box>
            <Box className="flex justify-between text-sm"><span className="text-gray-600">Max pickup distance</span><b className="tabular">{f.maxRadiusKm} km</b></Box>
            <Slider value={f.maxRadiusKm} min={1} max={30} onChange={(_, val) => upd({ maxRadiusKm: val })} aria-label="Max pickup distance" />
          </Box>
          <FormControlLabel control={<Switch checked={f.available} onChange={(e) => upd({ available: e.target.checked })} />} label="Available for pickups now" />
        </Block>

        <Box className="lg:col-span-2">
          <Block icon={LuWallet} title="Payouts">
            <Box className="grid items-start gap-x-3 sm:grid-cols-2">
              <TextField label="UPI ID" value={f.upiId} placeholder="name@okbank" onChange={(e) => upd({ upiId: e.target.value.trim().slice(0, 60) })}
                InputProps={{ startAdornment: <InputAdornment position="start"><LuAtSign /></InputAdornment> }}
                {...v('upiId', 'Delivery earnings are paid here')} />
              <div className="flex items-center gap-2 pt-3 text-sm text-gray-600">
                <LuWallet size={16} className="text-brand-700" /> Total earned <b className="tabular text-gray-900">₹{(s.earned || 0).toLocaleString('en-IN')}</b>
              </div>
            </Box>
          </Block>
        </Box>
      </Box>

      <Box className="mt-5 flex flex-wrap items-center gap-3">
        <Button variant="contained" size="large" onClick={save} disabled={busy} startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <LuSave size={17} />}>Save changes</Button>
      </Box>
    </Box>
  );
}
