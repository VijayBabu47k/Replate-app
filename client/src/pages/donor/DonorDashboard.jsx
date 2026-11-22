import { Link } from 'react-router-dom';
import { Box, Button, Typography, Card, CardContent } from '@mui/material';
import { LuPlus, LuCookingPot, LuArrowUpRight, LuBike, LuHouse, LuLoader } from 'react-icons/lu';
import { useFetch } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { Loading, Empty } from '../../components/Feedback';
import { PageHeader, SectionTitle } from '../../components/Layout';
import { ListingCard } from '../../components/ListingBits';
import { ImpactStats, TrendChart } from '../../components/Impact';
import ListingActions from '../../components/Actions';
import { fromNow } from '../../lib/format';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

function ClaimLine({ claim }) {
  const [Icon, text] = claim.volunteer ? [LuBike, claim.volunteer.name] : claim.selfPickup ? [LuHouse, 'Self pickup'] : [LuLoader, 'Finding a volunteer'];
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs">
      <span className="min-w-0 truncate text-gray-700">To <b className="font-semibold text-gray-900">{claim.receiverOrg.name}</b></span>
      <span className="inline-flex shrink-0 items-center gap-1 text-gray-500"><Icon size={13} /> {text}</span>
    </div>
  );
}

export default function DonorDashboard() {
  const { user } = useAuth();
  const listings = useFetch('/listings?status=POSTED,CLAIMED,ASSIGNED,COLLECTED,DELIVERED', { poll: 10000 });
  const impact = useFetch('/impact?scope=mine');

  if (!listings.data || !impact.data) return <Loading />;
  const active = listings.data.items.filter((l) => ['POSTED', 'CLAIMED', 'ASSIGNED', 'COLLECTED'].includes(l.status));
  const recent = listings.data.items.filter((l) => l.status === 'DELIVERED').slice(0, 4);

  return (
    <Box>
      <PageHeader
        eyebrow={greeting()}
        title={user.name.split(' ')[0]}
        action={<Button variant="contained" size="large" startIcon={<LuPlus />} component={Link} to="/donor/post">Post surplus</Button>}
      />
      <ImpactStats impact={impact.data} />


      <SectionTitle count={active.length}>Live rescues</SectionTitle>
      {!active.length ? (
        <Empty icon={LuCookingPot} title="No active listings" text="Post surplus in under a minute and we'll find a receiver and a volunteer."
          action={<Button variant="contained" startIcon={<LuPlus />} component={Link} to="/donor/post">Post surplus</Button>} />
      ) : (
        <Box className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {active.map((l) => (
            <ListingCard key={l.id} l={l} extra={l.claim && <ClaimLine claim={l.claim} />}>
              {l.claim?.pickupOtp && <span className="inline-flex items-center gap-2 text-xs text-gray-500">Pickup code <span className="otp text-sm">{l.claim.pickupOtp}</span></span>}
              <Box className="ml-auto flex gap-2">
                <ListingActions listing={l} compact onChange={listings.reload} />
                <Button size="small" variant="outlined" component={Link} to={`/listings/${l.id}`}>Track</Button>
              </Box>
            </ListingCard>
          ))}
        </Box>
      )}

      <Box className="mt-9 grid gap-5 lg:grid-cols-3">
        <Box className="lg:col-span-2"><TrendChart trend={impact.data.trend} /></Box>
        <Card>
          <CardContent className="flex h-full flex-col">
            <Box className="mb-3 flex items-center justify-between">
              <Typography className="!font-semibold">Recently delivered</Typography>
              <Link to="/donor/listings" className="text-xs font-medium text-brand-700 no-underline hover:underline">View all</Link>
            </Box>
            {!recent.length && <span className="text-sm text-gray-500">No deliveries yet.</span>}
            <Box className="flex flex-col">
              {recent.map((l) => (
                <Link key={l.id} to={`/listings/${l.id}`} className="group -mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 no-underline transition-colors hover:bg-gray-50">
                  <span className="tabular grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-green-50 text-sm font-semibold text-green-700">{l.estimatedMeals}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-gray-900">{l.title}</span>
                    <span className="block truncate text-xs text-gray-500">{l.claim?.receiverOrg?.name} · {fromNow(l.claim?.deliveredAt || l.updatedAt)}</span>
                  </span>
                  <LuArrowUpRight size={15} className="text-gray-400 opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              ))}
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
