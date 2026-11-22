import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Box, Card, Table, TableHead, TableRow, TableCell, TableBody, ToggleButtonGroup, ToggleButton, TablePagination } from '@mui/material';
import { LuList } from 'react-icons/lu';
import { useFetch } from '../../lib/hooks';
import { Loading, Empty } from '../../components/Feedback';
import { PageHeader } from '../../components/Layout';
import { StatusChip, DietBadge, foodIcon } from '../../components/ListingBits';
import { fmtDateTime, UNIT } from '../../lib/format';

const FILTERS = { all: '', active: 'POSTED,CLAIMED,ASSIGNED,COLLECTED', delivered: 'DELIVERED', lost: 'EXPIRED,CANCELLED,REJECTED' };
const PER_PAGE = 15;

export default function DonorListings() {
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);
  const { data } = useFetch(`/listings${FILTERS[filter] ? `?status=${FILTERS[filter]}` : ''}`);
  return (
    <Box>
      <PageHeader title="My listings"
        action={
          <ToggleButtonGroup size="small" exclusive value={filter} onChange={(_, v) => { if (v) { setFilter(v); setPage(0); } }}>
            <ToggleButton value="all">All</ToggleButton><ToggleButton value="active">Active</ToggleButton>
            <ToggleButton value="delivered">Delivered</ToggleButton><ToggleButton value="lost">Not rescued</ToggleButton>
          </ToggleButtonGroup>
        } />
      {!data ? <Loading /> : !data.items.length ? <Empty icon={LuList} title="Nothing here yet" /> : (
        <Card>
          <Box className="overflow-x-auto">
            <Table size="small">
              <TableHead>
                <TableRow><TableCell sx={{ pl: 2.5 }}>Food</TableCell><TableCell>Quantity</TableCell><TableCell>Posted</TableCell><TableCell>Receiver</TableCell><TableCell>Status</TableCell></TableRow>
              </TableHead>
              <TableBody>
                {data.items.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE).map((l) => {
                  const Icon = foodIcon(l);
                  return (
                    <TableRow key={l.id} hover>
                      <TableCell sx={{ pl: 2.5 }}>
                        <Link to={`/listings/${l.id}`} className="flex items-center gap-3 no-underline">
                          <span className="icon-tile h-9 w-9"><Icon size={17} /></span>
                          <span>
                            <span className="block font-medium text-gray-900">{l.title}</span>
                            <span className="mt-0.5 block"><DietBadge diet={l.dietType} /></span>
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell className="tabular whitespace-nowrap">{l.quantity} {UNIT[l.unit]}<div className="text-xs text-gray-500">{l.quantityKg} kg · {l.estimatedMeals} meals</div></TableCell>
                      <TableCell className="whitespace-nowrap">{fmtDateTime(l.createdAt)}<div className="text-xs text-gray-500">{l.postedBy?.name}</div></TableCell>
                      <TableCell>{l.claim?.receiverOrg?.name || <span className="text-gray-400">—</span>}</TableCell>
                      <TableCell><StatusChip status={l.status} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
          <TablePagination component="div" count={data.items.length} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={PER_PAGE} rowsPerPageOptions={[PER_PAGE]} />
        </Card>
      )}
    </Box>
  );
}
