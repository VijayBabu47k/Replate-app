import { Link } from 'react-router-dom';
import { Box, Card, Table, TableHead, TableRow, TableCell, TableBody, Button } from '@mui/material';
import { LuPackageOpen, LuBike, LuHouse, LuLoader } from 'react-icons/lu';
import { useFetch } from '../../lib/hooks';
import { Loading, Empty } from '../../components/Feedback';
import { PageHeader, SectionTitle } from '../../components/Layout';
import { ListingCard, StatusChip } from '../../components/ListingBits';
import ListingActions from '../../components/Actions';
import { fmtDateTime } from '../../lib/format';

function Courier({ claim }) {
  const [Icon, text] = claim.selfPickup ? [LuHouse, 'You are collecting'] : claim.volunteer ? [LuBike, claim.volunteer.name] : [LuLoader, 'Finding a volunteer'];
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs">
      <span className="inline-flex items-center gap-1.5 text-gray-700"><Icon size={13} /> {text}</span>
      {claim.deliveryOtp && !claim.selfPickup && <span className="inline-flex items-center gap-2 text-gray-500">Code <span className="otp text-sm">{claim.deliveryOtp}</span></span>}
    </div>
  );
}

export default function ReceiverClaims() {
  const { data, reload } = useFetch('/listings', { poll: 10000 });
  if (!data) return <Loading />;
  const needsAction = (l) => ['CLAIMED', 'ASSIGNED', 'COLLECTED'].includes(l.status) || (l.status === 'DELIVERED' && l.claim?.qualityAccepted == null);
  const active = data.items.filter(needsAction);
  const past = data.items.filter((l) => !needsAction(l));

  return (
    <Box>
      <PageHeader title="My claims" />
      {!active.length ? (
        <Empty icon={LuPackageOpen} title="Nothing on the way" action={<Button variant="contained" component={Link} to="/receiver">Browse available food</Button>} />
      ) : (
        <Box className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {active.map((l) => (
            <ListingCard key={l.id} l={l} extra={<Courier claim={l.claim} />}>
              <ListingActions listing={l} compact onChange={reload} />
              <Button size="small" variant="outlined" className="!ml-auto" component={Link} to={`/listings/${l.id}`}>Track</Button>
            </ListingCard>
          ))}
        </Box>
      )}

      {past.length > 0 && (
        <>
          <SectionTitle count={past.length}>History</SectionTitle>
          <Card>
            <Box className="overflow-x-auto">
              <Table size="small">
                <TableHead><TableRow><TableCell sx={{ pl: 2.5 }}>Food</TableCell><TableCell>From</TableCell><TableCell>Claimed</TableCell><TableCell>Received</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
                <TableBody>
                  {past.slice(0, 40).map((l) => (
                    <TableRow key={l.id} hover>
                      <TableCell sx={{ pl: 2.5 }}><Link to={`/listings/${l.id}`} className="font-medium text-gray-900 no-underline hover:underline">{l.title}</Link></TableCell>
                      <TableCell>{l.donorOrg.name}</TableCell>
                      <TableCell className="whitespace-nowrap">{fmtDateTime(l.claim?.claimedAt)}</TableCell>
                      <TableCell className="tabular">{l.claim?.receivedKg != null ? `${l.claim.receivedKg} kg` : <span className="text-gray-400">—</span>}</TableCell>
                      <TableCell><StatusChip status={l.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Card>
        </>
      )}
    </Box>
  );
}
