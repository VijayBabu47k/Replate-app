import { useParams } from 'react-router-dom';
import { Box, Card, CardContent, Typography, Table, TableHead, TableRow, TableCell, TableBody, Tooltip } from '@mui/material';
import { LuTarget, LuHistory, LuUser, LuCircleCheck, LuCircleX, LuSparkles, LuChefHat, LuClock, LuTimer, LuNotebookPen } from 'react-icons/lu';
import Journey from '../components/Journey';
import { LuIndianRupee } from 'react-icons/lu';

function FeeLine({ l }) {
  const { amount, state, earnedByMe } = l.fee || {};
  const vol = l.claim?.volunteer?.name;
  const text = {
    none: 'No delivery fee. Delivered by a volunteer for free.',
    pending: `₹${amount} delivery fee, paid to the volunteer when delivered.`,
    paid: earnedByMe ? `You earned ₹${amount} for this delivery.` : `₹${amount} paid${vol ? ` to ${vol}` : ''} for this delivery.`,
    self: `No delivery fee. The receiver collected it.`,
    void: `₹${amount} delivery fee was not charged.`,
  }[state] || null;
  if (!text) return null;
  const tone = state === 'paid' ? 'bg-green-50 text-green-700 ring-green-200' : 'bg-gray-50 text-gray-700 ring-gray-200';
  return (
    <div className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm ring-1 ring-inset ${tone}`}>
      <LuIndianRupee size={16} className="shrink-0" /> {text}
    </div>
  );
}
import { useFetch } from '../lib/hooks';
import { useAuth, HOME } from '../lib/auth';
import { Loading, ErrorBox } from '../components/Feedback';
import { BackLink } from '../components/Layout';
import { StatusChip, DietBadge, AllergenChips, Countdown, QuantityLine, HandlingCard, FlowStepper, Timeline, StorageTag, foodIcon } from '../components/ListingBits';
import RouteMap from '../components/RouteMap';
import ListingActions from '../components/Actions';
import { fmtDateTime, VEHICLE, VEHICLE_ICON } from '../lib/format';

function CardTitle({ icon: Icon, children, aside }) {
  return (
    <Box className="mb-4 flex items-center gap-2.5">
      <span className="icon-tile h-9 w-9"><Icon size={18} /></span>
      <Typography className="!font-semibold">{children}</Typography>
      {aside && <Box className="ml-auto">{aside}</Box>}
    </Box>
  );
}

function ScoreBar({ value }) {
  return (
    <Box className="flex items-center gap-2">
      <span className="tabular w-7 text-sm font-semibold">{Math.round(value * 100)}</span>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-100"><div className="bg-grad-glow h-full rounded-full" style={{ width: `${value * 100}%` }} /></div>
    </Box>
  );
}

function MatchesTable({ id }) {
  const { data } = useFetch(`/listings/${id}/matches`);
  if (!data) return null;
  return (
    <Card>
      <CardContent>
        <CardTitle icon={LuTarget} aside={
          <Tooltip title="25% proximity · 20% time to spare · 15% quantity fit · 20% need · 10% reliability · 10% diet fit. Receivers who can't take the food safely are excluded.">
            <span className="cursor-help text-xs text-gray-500 underline decoration-dotted underline-offset-4">How scoring works</span>
          </Tooltip>
        }>Best-matched receivers</CardTitle>
        <Box className="-mx-5 overflow-x-auto">
          <Table size="small">
            <TableHead><TableRow><TableCell sx={{ pl: 2.5 }}>Receiver</TableCell><TableCell>Score</TableCell><TableCell>Distance</TableCell><TableCell>Why</TableCell></TableRow></TableHead>
            <TableBody>
              {data.matches.map((m) => (
                <TableRow key={m.receiverOrgId} sx={{ opacity: m.eligible ? 1 : 0.5 }}>
                  <TableCell sx={{ pl: 2.5 }}><div className="font-medium">{m.receiverName}</div><div className="text-xs text-gray-500">{m.subType}</div></TableCell>
                  <TableCell sx={{ minWidth: 130 }}>
                    {m.eligible ? (
                      <Tooltip title={Object.entries(m.breakdown).map(([k, v]) => `${k}: ${v}`).join(' · ')}><span><ScoreBar value={m.score} /></span></Tooltip>
                    ) : <span className="pill bg-gray-100 text-gray-500">Excluded</span>}
                  </TableCell>
                  <TableCell className="tabular whitespace-nowrap">{m.distanceKm} km · {m.etaMinutes} min</TableCell>
                  <TableCell className="text-xs text-gray-600">{m.eligible ? m.reasons.slice(1, 3).join(' · ') : <span className="text-red-700">{m.excluded.join('; ')}</span>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </CardContent>
    </Card>
  );
}

function Fact({ icon: Icon, label, value, strong }) {
  return (
    <div className="flex gap-2.5">
      <Icon size={16} className="mt-0.5 shrink-0 text-gray-400" />
      <div className="min-w-0">
        <div className="text-xs text-gray-500">{label}</div>
        <div className={`tabular text-sm ${strong ? 'font-semibold text-gray-900' : 'text-gray-800'}`}>{value}</div>
      </div>
    </div>
  );
}

export default function ListingDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: l, error, setData } = useFetch(`/listings/${id}`, { poll: 10000 });
  if (error) return <ErrorBox error={error} />;
  if (!l) return <Loading />;
  const c = l.claim;
  const live = ['POSTED', 'CLAIMED', 'ASSIGNED', 'COLLECTED'].includes(l.status);
  const Icon = foodIcon(l);
  const VIcon = c?.volunteer?.vehicle ? VEHICLE_ICON[c.volunteer.vehicle] : LuUser;

  return (
    <Box className="mx-auto max-w-6xl">
      <BackLink to={HOME[user.role]}>Back</BackLink>
      <Box className="mb-6 mt-4 flex flex-wrap items-start justify-between gap-4">
        <Box className="flex min-w-0 items-start gap-4">
          <span className="icon-tile solid h-14 w-14 !rounded-2xl"><Icon size={26} /></span>
          <Box className="min-w-0">
            <h1 className="font-display text-gradient m-0 text-[36px] leading-[1.05] sm:text-[42px]">{l.title}</h1>
            <div className="mt-1.5 text-sm text-gray-500">{l.categoryLabel} · by {l.postedBy?.name}{l.postDurationSec ? ` · posted in ${l.postDurationSec}s` : ''}</div>
          </Box>
        </Box>
        <Box className="flex flex-wrap items-center gap-2">
          {live && <Countdown to={l.consumeBy} compact />}
          <StatusChip status={l.status} size="medium" />
        </Box>
      </Box>

      <Card className="!mb-5"><CardContent className="!py-6"><FlowStepper status={l.status} /></CardContent></Card>

      <Box className="grid gap-5 lg:grid-cols-3">
        <Box className="flex flex-col gap-5 lg:col-span-2">
          <Card>
            <CardContent className="flex flex-col gap-5">
              <Box className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <QuantityLine l={l} />
              </Box>
              <Box className="flex flex-wrap gap-1.5">
                <DietBadge diet={l.dietType} /><StorageTag storage={l.storage} pill /><AllergenChips allergens={l.allergens} />
              </Box>
              <Box className="grid gap-4 sm:grid-cols-3">
                <Fact icon={LuChefHat} label="Prepared" value={fmtDateTime(l.preparedAt)} />
                <Fact icon={LuClock} label="Pickup by" value={fmtDateTime(l.pickupBy)} strong />
                <Fact icon={LuTimer} label="Consume by" value={fmtDateTime(l.consumeBy)} strong />
              </Box>
              {l.notes && <Fact icon={LuNotebookPen} label="Donor notes" value={l.notes} />}
              <FeeLine l={l} />
              {c?.volunteer && (
                <Box className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="icon-tile h-9 w-9"><VIcon size={17} /></span>
                  <div>
                    <div className="font-semibold text-gray-900">{c.volunteer.name}</div>
                    <div className="text-xs text-gray-500">{[c.volunteer.vehicle && VEHICLE[c.volunteer.vehicle], c.volunteer.vehicleModel, c.volunteer.phone].filter(Boolean).join(' · ')}</div>
                  </div>
                  {c.volunteer.vehicleNumber && <span className="tabular rounded-md border border-solid border-gray-300 px-2 py-0.5 font-mono text-xs font-semibold tracking-wider text-gray-900">{c.volunteer.vehicleNumber}</span>}
                </Box>
              )}
              {c?.qualityAccepted === true && <div className="pill w-fit bg-green-50 text-green-700 ring-1 ring-inset ring-green-200"><LuCircleCheck /> Receiver accepted {c.receivedKg} kg</div>}
              {c?.qualityAccepted === false && <div className="pill w-fit bg-red-50 text-red-700 ring-1 ring-inset ring-red-200"><LuCircleX /> Rejected: {c.rejectReason}</div>}
              <ListingActions listing={l} onChange={setData} />
            </CardContent>
          </Card>

          <RouteMap listing={l}><Journey listing={l} /></RouteMap>
          {l.viewer?.isDonor && l.status === 'POSTED' && <MatchesTable id={l.id} />}
          {user.role === 'RECEIVER' && l.match && (
            <Card><CardContent>
              <CardTitle icon={LuSparkles} aside={<span className="tabular text-sm font-semibold text-brand-700">{Math.round(l.match.score * 100)}/100</span>}>Why this matches you</CardTitle>
              <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm text-gray-700">
                {l.match.reasons.map((r) => <li key={r} className="flex gap-2"><LuCircleCheck size={16} className="mt-0.5 shrink-0 text-brand-700" /> {r}</li>)}
              </ul>
            </CardContent></Card>
          )}
        </Box>

        <Box className="flex flex-col gap-5">
          <HandlingCard handling={l.handling} storage={l.storage} />
          <Card><CardContent>
            <CardTitle icon={LuHistory}>Status history</CardTitle>
            <Timeline events={l.events} />
          </CardContent></Card>
        </Box>
      </Box>
    </Box>
  );
}
