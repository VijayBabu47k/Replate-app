import { useState } from 'react';
import { Box, ToggleButtonGroup, ToggleButton, TextField, MenuItem } from '@mui/material';
import { LuBuilding2, LuGlobe } from 'react-icons/lu';
import { useFetch } from '../lib/hooks';
import { useAuth } from '../lib/auth';
import { Loading, ErrorBox } from '../components/Feedback';
import { PageHeader } from '../components/Layout';
import { ImpactStats, TrendChart, BarList, Funnel } from '../components/Impact';

export default function ImpactPage() {
  const { user } = useAuth();
  const [scope, setScope] = useState('mine');
  const [zone, setZone] = useState('');
  const { data, error } = useFetch(`/impact?scope=${scope}${zone ? `&zone=${encodeURIComponent(zone)}` : ''}`);

  return (
    <Box>
      <PageHeader
        eyebrow={data?.city}
        title="Impact"
        action={
          <>
            <ToggleButtonGroup size="small" exclusive value={scope} onChange={(_, v) => v && setScope(v)}>
              <ToggleButton value="mine"><LuBuilding2 size={15} /> {user.role === 'VOLUNTEER' ? 'My deliveries' : 'My organisation'}</ToggleButton>
              <ToggleButton value="city"><LuGlobe size={15} /> Whole city</ToggleButton>
            </ToggleButtonGroup>
            <TextField select size="small" label="Area" value={zone} onChange={(e) => setZone(e.target.value)} sx={{ minWidth: 190 }}>
              <MenuItem value="">All areas</MenuItem>
              {(data?.zones || []).map((z) => <MenuItem key={z.value} value={z.value}>{z.label}</MenuItem>)}
            </TextField>
          </>
        }
      />
      {error && <ErrorBox error={error} />}
      {!data ? <Loading /> : (
        <Box className="flex flex-col gap-5">
          <ImpactStats impact={data} />
          <Box className="grid gap-5 lg:grid-cols-3">
            <Box className="lg:col-span-2"><TrendChart trend={data.trend} /></Box>
            <Funnel funnel={data.funnel} losses={data.losses} />
          </Box>
          <Box className="grid gap-5 lg:grid-cols-2">
            <BarList title="Saved by category" hint="kg" rows={data.byCategory} />
            <BarList title="Received by organisation" hint="kg" rows={data.byReceiver} color="teal" />
          </Box>
        </Box>
      )}
    </Box>
  );
}
