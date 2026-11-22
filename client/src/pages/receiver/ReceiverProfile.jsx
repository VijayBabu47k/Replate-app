import { useEffect, useMemo, useState } from 'react';
import { Box, Card, CardContent, Typography, TextField, Switch, FormControlLabel, Button, Alert, ToggleButtonGroup, ToggleButton, FormHelperText, CircularProgress } from '@mui/material';
import { LuBadgeCheck, LuClock3, LuSave, LuUtensils, LuSettings2 } from 'react-icons/lu';
import { useFetch } from '../../lib/hooks';
import { api, errMsg } from '../../lib/api';
import { Loading } from '../../components/Feedback';
import { PageHeader } from '../../components/Layout';
import { DIET } from '../../lib/format';
import { validateReceiverProfile, fieldProps } from '../../lib/validation';
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

export default function ReceiverProfile() {
  const { data, reload } = useFetch('/receiver/profile');
  const [f, setF] = useState(null);
  const toast = useToast();
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setF({ ...data.profile, capacityMealsPerDay: String(data.profile.capacityMealsPerDay ?? ''), beneficiariesCount: String(data.profile.beneficiariesCount ?? ''), beneficiaryType: data.profile.beneficiaryType || '' }); }, [data]);
  const errors = useMemo(() => (f ? validateReceiverProfile(f) : {}), [f]);
  if (!data || !f) return <Loading />;
  const org = data.organization;
  const v = fieldProps(errors, touched, submitted, setTouched);
  const upd = (patch) => { setF((p) => ({ ...p, ...patch })); };
  const digits = (k, max) => (e) => upd({ [k]: e.target.value.replace(/\D/g, '').slice(0, max) });

  const save = async () => {
    setSubmitted(true);
    if (Object.keys(errors).length) { toast.warning('Please fix the highlighted fields.'); return; }
    setBusy(true);
    try {
      await api.patch('/receiver/profile', { ...f, capacityMealsPerDay: Number(f.capacityMealsPerDay), beneficiariesCount: f.beneficiariesCount === '' ? 0 : Number(f.beneficiariesCount), beneficiaryType: f.beneficiaryType.trim() });
      toast.success('Saved. Matching uses your new settings right away.');
      setSubmitted(false);
      setTouched({});
      reload();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <Box className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow={[org.subType, `${org.zone}, ${org.city}`].filter(Boolean).join(' · ')}
        title="Needs & capacity"
        action={org.verified
          ? <span className="pill bg-green-50 !px-3 !py-1.5 text-green-700 ring-1 ring-inset ring-green-200"><LuBadgeCheck /> Verified</span>
          : <span className="pill bg-gray-100 !px-3 !py-1.5 text-gray-600">Verification pending</span>}
      />
      <Box className="grid gap-5 lg:grid-cols-2">
        <Block icon={LuUtensils} title="Capacity">
          <Box className="grid gap-x-3 gap-y-1 sm:grid-cols-2">
            <TextField label="Meals per day" placeholder="e.g. 150" value={f.capacityMealsPerDay} required onChange={digits('capacityMealsPerDay', 5)} inputProps={{ inputMode: 'numeric' }} {...v('capacityMealsPerDay')} />
            <TextField label="People served" placeholder="e.g. 80" value={f.beneficiariesCount} onChange={digits('beneficiariesCount', 6)} inputProps={{ inputMode: 'numeric' }} {...v('beneficiariesCount')} />
            <TextField label="Who you serve" value={f.beneficiaryType} onChange={(e) => upd({ beneficiaryType: e.target.value.slice(0, 80) })} placeholder="e.g. Senior citizens" className="sm:col-span-2" {...v('beneficiaryType', `${f.beneficiaryType.length}/80`)} />
          </Box>
        </Block>
        <Block icon={LuClock3} title="Intake hours">
          <Box className="grid gap-x-3 gap-y-1 sm:grid-cols-2">
            <TextField type="time" label="Opens" value={f.intakeStart} required onChange={(e) => upd({ intakeStart: e.target.value })} InputLabelProps={{ shrink: true }} {...v('intakeStart')} />
            <TextField type="time" label="Closes" value={f.intakeEnd} required onChange={(e) => upd({ intakeEnd: e.target.value })} InputLabelProps={{ shrink: true }} {...v('intakeEnd')} />
          </Box>
          <Box>
            <div className="mb-2 text-[13px] font-medium text-gray-600">Food you can accept *</div>
            <ToggleButtonGroup value={f.dietAccepted} onChange={(_, val) => { setTouched((t) => ({ ...t, dietAccepted: true })); upd({ dietAccepted: val }); }} size="small" className="flex-wrap">
              {Object.entries(DIET).map(([k, d]) => <ToggleButton key={k} value={k}>{d.label}</ToggleButton>)}
            </ToggleButtonGroup>
            {(submitted || touched.dietAccepted) && errors.dietAccepted && <FormHelperText error>{errors.dietAccepted}</FormHelperText>}
          </Box>
        </Block>
        <Box className="lg:col-span-2">
          <Block icon={LuSettings2} title="Preferences">
            <Box className="flex flex-wrap gap-x-8 gap-y-1">
              <FormControlLabel control={<Switch checked={f.hasFridge} onChange={(e) => upd({ hasFridge: e.target.checked })} />} label="We have a fridge" />
              <FormControlLabel control={<Switch checked={f.canSelfPickup} onChange={(e) => upd({ canSelfPickup: e.target.checked })} />} label="We can collect ourselves" />
              <FormControlLabel control={<Switch checked={f.acceptingToday} onChange={(e) => upd({ acceptingToday: e.target.checked })} />} label="Accepting food today" />
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
