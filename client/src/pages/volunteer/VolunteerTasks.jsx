import { Link } from 'react-router-dom';
import { Box, Card, CardContent, Switch, Button, Alert } from '@mui/material';
import { LuBike, LuCircleCheckBig, LuArrowRight, LuWallet, LuTriangleAlert, LuMedal, LuUtensils, LuPackage, LuCheck } from 'react-icons/lu';
import { useFetch } from '../../lib/hooks';
import { api, errMsg } from '../../lib/api';
import { Loading, Empty } from '../../components/Feedback';
import { PageHeader, SectionTitle } from '../../components/Layout';
import { ListingCard, StatusChip } from '../../components/ListingBits';
import ListingActions from '../../components/Actions';
import Journey from '../../components/Journey';
import { VEHICLE, VEHICLE_ICON, fmtDateTime } from '../../lib/format';
import { useToast } from '../../lib/toast';

export default function VolunteerTasks() {
  const toast = useToast();
  const tasks = useFetch('/volunteer/tasks', { poll: 10000 });
  const prof = useFetch('/volunteer/profile');
  if (!tasks.data || !prof.data) return <Loading />;
  const p = prof.data.profile;
  const s = prof.data.stats;
  const reload = () => tasks.reload();
  const toggle = async (v) => {
    try {
      await api.patch('/volunteer/profile', { available: v });
      toast.success(v ? "You're on duty. You can accept pickups." : "You're off duty. You won't get new pickups.");
      prof.reload();
      tasks.reload();
    } catch (e) { toast.error(errMsg(e)); }
  };
  const VIcon = VEHICLE_ICON[p.vehicle] || LuBike;

  return (
    <Box>
      <PageHeader eyebrow={<span className="inline-flex items-center gap-2"><span className="live-dot" /> Live</span>} title="Pickup tasks" />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <label className="inline-flex cursor-pointer items-center gap-1 text-sm font-semibold">
            <Switch checked={p.available} onChange={(e) => toggle(e.target.checked)} inputProps={{ 'aria-label': 'Available for pickups' }} />
            {p.available ? 'On duty' : 'Off duty'}
          </label>
          <span className="inline-flex items-center gap-2 text-sm text-gray-600">
            <span className="icon-tile h-8 w-8 !rounded-[10px]"><VIcon size={16} /></span>
            {VEHICLE[p.vehicle]}{p.vehicleNumber ? ` · ${p.vehicleNumber}` : ''} · {p.maxRadiusKm} km
            {p.hasInsulatedBag && <span className="pill bg-green-50 text-green-700"><LuCheck /> Insulated bag</span>}
          </span>
          <Box className="ml-auto flex gap-5 text-sm">
            <span className="inline-flex items-center gap-1.5 text-gray-600"><LuMedal size={15} className="text-brand-700" /><b className="tabular text-gray-900">{s.deliveries}</b> deliveries</span>
            <span className="inline-flex items-center gap-1.5 text-gray-600"><LuUtensils size={15} className="text-brand-700" /><b className="tabular text-gray-900">{s.meals}</b> meals</span>
            <Link to="/volunteer/earnings" className="inline-flex items-center gap-1.5 text-gray-600 no-underline hover:text-gray-900"><LuWallet size={15} className="text-brand-700" /><b className="tabular text-gray-900">₹{(s.earned || 0).toLocaleString('en-IN')}</b> earned</Link>
          </Box>
        </CardContent>
      </Card>

      <SectionTitle count={tasks.data.active.length}>My active pickups</SectionTitle>
      {!tasks.data.active.length ? <Empty icon={LuBike} title="No active pickups" text="Accept a task below to get started." /> : (
        <Box className="grid gap-4 md:grid-cols-2">
          {tasks.data.active.map((l) => {
            return (
              <ListingCard key={l.id} l={l} extra={<div className="sunk rounded-2xl p-4"><Journey listing={l} /></div>}>
                <ListingActions listing={l} compact onChange={reload} />
                <Button size="small" color="inherit" className="!ml-auto" component={Link} to={`/listings/${l.id}`} endIcon={<LuArrowRight size={14} />}>Details</Button>
              </ListingCard>
            );
          })}
        </Box>
      )}

      <SectionTitle count={tasks.data.available.length}>Available tasks</SectionTitle>
      {!p.available && (
        <Alert severity="warning" className="!mb-4" action={<Button color="inherit" size="small" onClick={() => toggle(true)}>Go on duty</Button>}>
          You're off duty, so you can't accept new pickups or get pickup alerts. Finish any active pickups as usual.
        </Alert>
      )}
      {!tasks.data.available.length ? <Empty icon={LuCircleCheckBig} title="Every claim has a volunteer" text="We'll notify you when a pickup is needed nearby." /> : (
        <Box className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tasks.data.available.map((l) => (
            <ListingCard key={l.id} l={l} extra={
              <div className={`rounded-xl p-3 ${l.task.eligible ? 'bg-brand-50 ring-1 ring-inset ring-brand-100' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">{l.donorOrg.zone} <LuArrowRight size={13} className="text-gray-400" /> {l.receiverZone}</div>
                <div className="tabular mt-2.5 grid grid-cols-4 gap-1.5 text-center">
                  {[[`${l.task.toDonorKm} km`, 'to pickup'], [`${l.task.donorToReceiverKm} km`, 'to drop'], [`${l.task.tripMinutes} min`, 'trip']].map(([v, k]) => (
                    <div key={k}><div className="text-sm font-semibold text-gray-900">{v}</div><div className="text-[11px] text-gray-500">{k}</div></div>
                  ))}
                  <div className="rounded-lg bg-brand-100 py-0.5">
                    <div className="text-sm font-bold text-brand-700">{l.deliveryFee ? `₹${l.deliveryFee}` : 'Free'}</div>
                    <div className="text-[11px] text-gray-500">you earn</div>
                  </div>
                </div>
                {!l.task.eligible && <div className="mt-2 inline-flex items-start gap-1 text-xs font-medium text-red-700"><LuTriangleAlert size={13} className="mt-0.5 shrink-0" /> {l.task.blockers.join(', ')}</div>}
              </div>
            }>
              <ListingActions listing={l} compact onChange={reload} />
            </ListingCard>
          ))}
        </Box>
      )}

      {tasks.data.history.length > 0 && (
        <>
          <SectionTitle count={tasks.data.history.length}>Past deliveries</SectionTitle>
          <Card className="!p-2">
            {tasks.data.history.slice(0, 15).map((l) => (
              <Link key={l.id} to={`/listings/${l.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 no-underline transition-colors hover:bg-gray-50">
                <span className="icon-tile h-9 w-9"><LuPackage size={16} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-900">{l.title}</span>
                  <span className="block truncate text-xs text-gray-500">{l.claim?.receiverOrg?.name} · {fmtDateTime(l.claim?.deliveredAt || l.updatedAt)}</span>
                </span>
                <StatusChip status={l.status} />
              </Link>
            ))}
          </Card>
        </>
      )}
    </Box>
  );
}
