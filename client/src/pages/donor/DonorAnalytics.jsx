import { useState } from 'react';
import { Box, Card, CardContent, Typography, Button, CircularProgress } from '@mui/material';
import { LuDownload, LuPackage, LuPiggyBank, LuTrash2, LuTimer, LuLightbulb, LuTrendingDown, LuBike } from 'react-icons/lu';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useFetch } from '../../lib/hooks';
import { api, errMsg } from '../../lib/api';
import { Loading, Empty } from '../../components/Feedback';
import { PageHeader, SectionTitle } from '../../components/Layout';
import { StatCard, BarList } from '../../components/Impact';
import { inr } from '../../lib/format';
import { useToast } from '../../lib/toast';

async function downloadCsv() {
  const r = await api.get('/impact/report.csv', { responseType: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(r.data);
  a.download = 'impact-report.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function DonorAnalytics() {
  const { data } = useFetch('/donor/analytics');
  const impact = useFetch('/impact?scope=mine');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  if (!data || !impact.data) return <Loading />;
  const savings = data.insights.reduce((s, i) => s + i.monthlyFoodCostInr, 0);
  const download = async () => {
    setBusy(true);
    try { await downloadCsv(); toast.success('Impact report downloaded'); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <Box>
      <PageHeader eyebrow="Last 8 weeks" title="Surplus insights"
        action={<Button variant="outlined" startIcon={busy ? <CircularProgress size={15} color="inherit" /> : <LuDownload size={16} />} disabled={busy} onClick={download}>Impact report</Button>} />

      <Box className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Surplus posted" value={`${data.totalKg} kg`} icon={LuPackage} sub={`${data.totalPosts} posts`} />
        <StatCard label="Possible monthly saving" value={inr(savings)} icon={LuPiggyBank} tone="lime" formula={`Avg weekly peak-day surplus × 4.3 weeks × ₹${data.foodCostPerKg}/kg food cost (assumption). Not financial advice.`} />
        <StatCard label="Disposal cost avoided" value={inr(impact.data.totals.disposalSavingsInr)} icon={LuTrash2} tone="teal" formula={impact.data.formulas.disposalSavingsInr} />
        <StatCard label="Delivery fees paid" value={inr(data.deliveryFeesPaid)} icon={LuBike} tone="teal" sub={`${data.paidDeliveries} deliveries`} formula="Total paid to volunteers for deliveries they completed. Not charged for self pickup." />
        <StatCard label="Avg. time to post" value={data.avgPostSeconds ? `${data.avgPostSeconds}s` : '—'} icon={LuTimer} tone="blue" sub="target 60s" />
      </Box>

      <Box className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardContent>
            <Box className="mb-4 flex items-baseline justify-between"><Typography className="!font-semibold">Surplus by weekday</Typography><span className="text-xs text-gray-500">kg / week</span></Box>
            <Box sx={{ height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={data.byDay} margin={{ left: -18, right: 6 }}>
                  <defs><linearGradient id="dayBar" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4ade80" /><stop offset="100%" stopColor="#0d9488" /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 6" vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} /><YAxis tickLine={false} axisLine={false} />
                  <Tooltip formatter={(v) => `${v} kg`} />
                  <Bar dataKey="kg" fill="url(#dayBar)" radius={[8, 8, 0, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>
        <BarList title="Surplus by category" hint="kg" rows={data.byCategory} />
      </Box>

      <SectionTitle count={data.insights.length}>Where you over-produce</SectionTitle>
      {!data.insights.length ? <Empty icon={LuTrendingDown} title="Not enough data yet" text="Insights appear after a few weeks of posts." /> : (
        <Box className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.insights.map((i) => (
            <Card key={i.title} className="card-hover">
              <CardContent className="flex h-full flex-col gap-3">
                <Box className="flex items-start justify-between gap-3">
                  <Box>
                    <Typography className="!font-semibold">{i.title}</Typography>
                    <div className="mt-0.5 text-xs text-gray-500">{i.occurrences}× in 8 weeks · peaks on {i.peakDay} (~{i.avgKgOnPeakDay} kg)</div>
                  </Box>
                </Box>
                <div className="tabular text-[26px] font-semibold tracking-tight text-gray-900">{inr(i.monthlyFoodCostInr)}<span className="text-sm font-normal text-gray-500"> / month</span></div>
                <div className="mt-auto flex gap-2 rounded-xl bg-brand-50 p-3 text-[13px] leading-relaxed text-brand-800"><LuLightbulb size={16} className="mt-0.5 shrink-0" /> {i.suggestion}</div>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
}
