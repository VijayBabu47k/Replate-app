import { Link } from 'react-router-dom';
import { Box, Card, CardContent, Switch, Tooltip, Button, Alert } from '@mui/material';
import { LuSlidersHorizontal, LuSoup, LuSparkles, LuNavigation, LuClock } from 'react-icons/lu';
import { useFetch } from '../../lib/hooks';
import { api, errMsg } from '../../lib/api';
import { Loading, Empty } from '../../components/Feedback';
import { PageHeader, SectionTitle } from '../../components/Layout';
import { ListingCard } from '../../components/ListingBits';
import ListingActions from '../../components/Actions';
import { DIET } from '../../lib/format';
import { useToast } from '../../lib/toast';

function MatchBadge({ m }) {
  if (!m) return null;
  if (!m.eligible) return <div className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-500">Not a match: {m.excluded[0]}</div>;
  return (
    <Tooltip title={<ul className="m-0 pl-4">{m.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}>
      <Box className="cursor-help rounded-xl bg-brand-50 p-3 ring-1 ring-inset ring-brand-100">
        <Box className="flex items-center justify-between gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 font-semibold text-brand-800"><LuSparkles size={13} /> {Math.round(m.score * 100)}% match</span>
          <span className="tabular inline-flex items-center gap-2 text-gray-600"><span className="inline-flex items-center gap-1"><LuNavigation size={12} />{m.distanceKm} km</span><span className="inline-flex items-center gap-1"><LuClock size={12} />{m.etaMinutes} min</span></span>
        </Box>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-gray-100"><div className="bg-grad-glow h-full rounded-full" style={{ width: `${m.score * 100}%` }} /></div>
      </Box>
    </Tooltip>
  );
}

export default function ReceiverFeed() {
  const toast = useToast();
  const feed = useFetch('/listings?scope=feed', { poll: 10000 });
  const prof = useFetch('/receiver/profile');
  if (!feed.data || !prof.data) return <Loading />;
  const p = prof.data.profile;
  const eligible = feed.data.items.filter((l) => l.match?.eligible);
  const others = feed.data.items.filter((l) => !l.match?.eligible);
  const pct = Math.min(100, (prof.data.mealsToday / p.capacityMealsPerDay) * 100);

  const toggle = async (v) => {
    try {
      await api.patch('/receiver/profile', { acceptingToday: v });
      toast.success(v ? "You're accepting food today" : 'Paused. Donors won\'t be matched to you.');
      prof.reload(); feed.reload();
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <Box>
      <PageHeader eyebrow={<span className="inline-flex items-center gap-2"><span className="live-dot" /> Live</span>} title="Available food" />
      <Card className="!mb-2">
        <CardContent className="grid items-center gap-5 md:grid-cols-[1.4fr_1fr_auto]">
          <Box>
            <Box className="mb-2 flex items-baseline justify-between gap-2">
              <span className="text-sm text-gray-600">Today's intake</span>
              <span className="tabular text-sm"><b className="text-lg text-gray-900">{prof.data.mealsToday}</b> <span className="text-gray-500">/ {p.capacityMealsPerDay} meals</span></span>
            </Box>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct > 90 ? 'linear-gradient(90deg,#f59e0b,#f97316)' : 'var(--grad-glow)' }} /></div>
          </Box>
          <Box className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-600">
            <span className="inline-flex items-center gap-1.5"><LuClock size={14} /> {p.intakeStart}–{p.intakeEnd}</span>
            <span>{p.dietAccepted.map((d) => DIET[d]?.label || d).join(', ')}</span>
          </Box>
          <Box className="flex items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1 text-sm font-medium">
              <Switch checked={p.acceptingToday} onChange={(e) => toggle(e.target.checked)} inputProps={{ 'aria-label': 'Accepting food today' }} />
              {p.acceptingToday ? 'Accepting' : 'Paused'}
            </label>
            <Tooltip title="Edit needs"><Button component={Link} to="/receiver/profile" size="small" variant="outlined" sx={{ minWidth: 0, px: 1.25 }} aria-label="Edit needs"><LuSlidersHorizontal size={16} /></Button></Tooltip>
          </Box>
        </CardContent>
      </Card>
      {!p.acceptingToday && <Alert severity="warning" className="!mt-3">You're paused, so donors won't be matched to you.</Alert>}

      <SectionTitle count={eligible.length}>Matched for you</SectionTitle>
      {!eligible.length ? <Empty icon={LuSoup} title="No matching food right now" text="We'll notify you as soon as something nearby fits." /> : (
        <Box className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {eligible.map((l) => (
            <ListingCard key={l.id} l={l} extra={<MatchBadge m={l.match} />}>
              <ListingActions listing={l} compact onChange={() => feed.reload()} />
            </ListingCard>
          ))}
        </Box>
      )}

      {others.length > 0 && (
        <>
          <SectionTitle count={others.length}>Not available to you</SectionTitle>
          <Box className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {others.map((l) => <ListingCard key={l.id} l={l} dim extra={<MatchBadge m={l.match} />} />)}
          </Box>
        </>
      )}
    </Box>
  );
}
