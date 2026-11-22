import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Box, Card, CardContent, Typography, TextField, Button, InputAdornment, CircularProgress } from '@mui/material';
import { LuWallet, LuTrendingUp, LuBanknote, LuCalendarDays, LuArrowDownToLine, LuReceiptText, LuCircleCheck, LuClock, LuArrowUpRight, LuAtSign } from 'react-icons/lu';
import { useFetch } from '../../lib/hooks';
import { api, errMsg } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { Loading, Empty } from '../../components/Feedback';
import { PageHeader, SectionTitle } from '../../components/Layout';
import { StatCard } from '../../components/Impact';
import { validateUpi } from '../../lib/validation';
import { fmtDateTime, fromNow } from '../../lib/format';

const rupees = (n) => `₹${(n || 0).toLocaleString('en-IN')}`;

export default function VolunteerEarnings() {
  const { data, reload } = useFetch('/volunteer/earnings');
  const toast = useToast();
  const [upi, setUpi] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [all, setAll] = useState(false);
  useEffect(() => { if (data) setUpi(data.upiId || ''); }, [data?.upiId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!data) return <Loading />;

  const t = data.totals;
  const upiErr = validateUpi(upi);
  const enough = t.available >= data.minPayout;
  const showUpiErr = touched && upiErr;

  const requestPayout = async () => {
    setTouched(true);
    if (upiErr) { toast.warning(upiErr); return; }
    if (!enough) { toast.warning(`You need at least ${rupees(data.minPayout)} to request a payout.`); return; }
    setBusy(true);
    try {
      const r = await api.post('/volunteer/payouts', { upiId: upi.trim() });
      toast.success(r.data.status === 'PAID' ? `${rupees(r.data.amount)} sent to ${r.data.upiId}` : `Payout of ${rupees(r.data.amount)} requested`);
      setTouched(false);
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      <PageHeader eyebrow="Paid on every delivery" title="Earnings" />

      <Card className="glow-border">
        <CardContent className="grid items-center gap-6 !p-6 md:grid-cols-[1fr_minmax(300px,420px)]">
          <Box className="flex items-center gap-4">
            <span className="icon-tile solid h-14 w-14 !rounded-2xl"><LuWallet size={26} /></span>
            <Box>
              <div className="text-sm text-gray-600">Available balance</div>
              <div className="tabular text-[40px] font-semibold leading-tight tracking-tight text-gray-900">{rupees(t.available)}</div>
              {t.pending > 0 && <div className="mt-0.5 text-xs text-amber-700">{rupees(t.pending)} payout in progress</div>}
            </Box>
          </Box>
          <Box className="flex flex-col gap-2">
            <TextField
              fullWidth size="small" label="UPI ID" value={upi} name="upiId" placeholder="name@okbank"
              onChange={(e) => setUpi(e.target.value.trim().slice(0, 60))} onBlur={() => setTouched(true)}
              error={!!showUpiErr} helperText={showUpiErr || ' '}
              InputProps={{ startAdornment: <InputAdornment position="start"><LuAtSign /></InputAdornment> }}
            />
            <Button variant="contained" size="large" onClick={requestPayout} disabled={busy || !enough}
              startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <LuArrowDownToLine size={17} />}>
              {enough ? `Withdraw ${rupees(t.available)}` : `Withdraw from ${rupees(data.minPayout)}`}
            </Button>
            {!enough && (
              <div className="text-center text-xs text-gray-500">
                {rupees(data.minPayout - t.available)} more to unlock a payout
              </div>
            )}
          </Box>
        </CardContent>
      </Card>

      <Box className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="Total earned" value={rupees(t.earned)} icon={LuTrendingUp} sub={`${t.deliveries} paid deliveries`} />
        <StatCard label="Paid out" value={rupees(t.paidOut)} icon={LuBanknote} tone="teal" />
        <StatCard label="This week" value={rupees(t.thisWeek)} icon={LuCalendarDays} tone="lime" />
      </Box>

      <Box className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Box>
          <SectionTitle count={data.earnings.length}>Deliveries</SectionTitle>
          {!data.earnings.length ? (
            <Empty icon={LuReceiptText} title="No earnings yet" text="Deliveries with a fee add to your balance."
              action={<Button variant="contained" component={Link} to="/volunteer">Find a pickup</Button>} />
          ) : (
            <Card className="!p-2">
              {(all ? data.earnings : data.earnings.slice(0, 8)).map((e) => (
                <Link key={e.id} to={`/listings/${e.listingId}`} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 no-underline transition-colors hover:bg-gray-50">
                  <span className="icon-tile h-9 w-9"><LuReceiptText size={16} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 truncate text-sm font-medium text-gray-900">{e.title}<LuArrowUpRight size={13} className="text-gray-400 opacity-0 transition-opacity group-hover:opacity-100" /></span>
                    <span className="block truncate text-xs text-gray-500">{[e.receiver, fromNow(e.createdAt)].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className="text-right">
                    <span className="tabular block text-sm font-semibold text-gray-900">+{rupees(e.amount)}</span>
                    <span className={`block text-[11px] ${e.paidOut ? 'text-gray-500' : 'text-brand-700'}`}>{e.paidOut ? 'Paid out' : 'Available'}</span>
                  </span>
                </Link>
              ))}
              {data.earnings.length > 8 && (
                <button type="button" onClick={() => setAll((v) => !v)} className="mt-1 w-full cursor-pointer rounded-xl border-0 bg-transparent py-2.5 text-sm font-semibold text-brand-700 hover:bg-gray-50">
                  {all ? 'Show less' : `Show all ${data.earnings.length}`}
                </button>
              )}
            </Card>
          )}
        </Box>
        <Box>
          <SectionTitle count={data.payouts.length}>Payouts</SectionTitle>
          {!data.payouts.length ? (
            <Empty icon={LuBanknote} title="No payouts yet" text={`Withdraw once you have ${rupees(data.minPayout)}.`} />
          ) : (
            <Card className="!p-2">
              {data.payouts.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${p.status === 'PAID' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                    {p.status === 'PAID' ? <LuCircleCheck size={17} /> : <LuClock size={17} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="tabular block text-sm font-semibold text-gray-900">{rupees(p.amount)}</span>
                    <span className="block truncate text-xs text-gray-500">{p.upiId} · {fmtDateTime(p.paidAt || p.requestedAt)}</span>
                  </span>
                  <span className={`pill ${p.status === 'PAID' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>{p.status === 'PAID' ? 'Paid' : 'Processing'}</span>
                </div>
              ))}
            </Card>
          )}
          <Typography variant="caption" color="text.secondary" className="!mt-3 !block">Payouts are sent to your UPI ID.</Typography>
        </Box>
      </Box>
    </Box>
  );
}
