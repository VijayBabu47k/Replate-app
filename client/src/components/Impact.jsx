import { Card, CardContent, Typography, Box, Tooltip } from '@mui/material';
import { LuInfo, LuUtensilsCrossed, LuRecycle, LuWallet, LuTarget, LuClock, LuCircleX, LuBan } from 'react-icons/lu';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid, AreaChart, Area } from 'recharts';
import dayjs from 'dayjs';
import { num, inr } from '../lib/format';

const TONES = {
  brand: 'text-brand-700 bg-brand-50 ring-brand-100',
  teal: 'text-teal-700 bg-teal-50 ring-teal-200',
  lime: 'text-lime-700 bg-lime-50 ring-lime-200',
  amber: 'text-amber-700 bg-amber-50 ring-amber-200',
  blue: 'text-blue-700 bg-blue-50 ring-blue-200',
};

/** KPI card. `icon` is a react-icons component; `formula` shows as an info tooltip. */
export function StatCard({ label, value, sub, icon: Icon, formula, tone = 'brand' }) {
  return (
    <Card className="card-hover h-full">
      <CardContent className="flex h-full flex-col gap-4">
        <Box className="flex items-center justify-between gap-2">
          <span className={`grid h-10 w-10 place-items-center rounded-xl ring-1 ring-inset ${TONES[tone] || TONES.brand}`}>{Icon && <Icon size={19} />}</span>
          {formula && (
            <Tooltip title={formula}>
              <button type="button" aria-label={`How "${label}" is calculated`} className="grid h-7 w-7 cursor-help place-items-center rounded-full border-0 bg-transparent text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700">
                <LuInfo size={15} />
              </button>
            </Tooltip>
          )}
        </Box>
        <Box className="mt-auto">
          <div className="tabular text-[28px] font-semibold leading-none tracking-tight text-gray-900">{value}</div>
          <div className="mt-2 text-[13px] text-gray-600">{label}{sub && <span className="text-gray-400"> · {sub}</span>}</div>
        </Box>
      </CardContent>
    </Card>
  );
}

export function ImpactStats({ impact }) {
  const t = impact.totals;
  const f = impact.formulas;
  return (
    <Box className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <StatCard label="Meals saved" value={num(t.mealsSaved)} icon={LuUtensilsCrossed} formula={f.mealsSaved} sub={`${t.deliveries} deliveries`} />
      <StatCard label="Food waste avoided" value={`${num(t.kgSaved)} kg`} icon={LuRecycle} tone="teal" formula="Sum of kg delivered and accepted by receivers. Rejected or expired food is excluded." />
      <StatCard label="Disposal cost avoided" value={inr(t.disposalSavingsInr)} icon={LuWallet} tone="lime" formula={f.disposalSavingsInr} />
      <StatCard label="Rescue rate" value={`${Math.round(t.rescueRate * 100)}%`} icon={LuTarget} tone="blue" formula={f.rescueRate} />
    </Box>
  );
}

function ChartCard({ title, hint, children }) {
  return (
    <Card className="h-full">
      <CardContent>
        <Box className="mb-4 flex items-baseline justify-between gap-2">
          <Typography className="!font-semibold">{title}</Typography>
          {hint && <span className="text-xs text-gray-500">{hint}</span>}
        </Box>
        {children}
      </CardContent>
    </Card>
  );
}

export function TrendChart({ trend }) {
  const data = trend.map((t) => ({ ...t, label: dayjs(t.week).format('D MMM') }));
  return (
    <ChartCard title="Meals saved" hint="per week">
      <Box sx={{ height: 248 }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22c55e" stopOpacity={0.32} /><stop offset="100%" stopColor="#22c55e" stopOpacity={0} /></linearGradient>
              <linearGradient id="trendStroke" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#a3e635" /><stop offset="50%" stopColor="#22c55e" /><stop offset="100%" stopColor="#14b8a6" /></linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 6" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} />
            <RTooltip />
            <Area type="monotone" dataKey="meals" name="Meals" stroke="url(#trendStroke)" fill="url(#trendFill)" strokeWidth={2.5} activeDot={{ r: 5, fill: '#22c55e', stroke: '#fff', strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </Box>
    </ChartCard>
  );
}

export function BarList({ title, hint, rows, valueKey = 'kg', unit = 'kg', color = 'green' }) {
  const id = `bar-${color}`;
  const stops = color === 'teal' ? ['#2dd4bf', '#0d9488'] : ['#4ade80', '#059669'];
  return (
    <ChartCard title={title} hint={hint}>
      <Box sx={{ height: Math.max(170, rows.length * 38) }}>
        <ResponsiveContainer>
          <BarChart data={rows} layout="vertical" margin={{ left: 0, right: 16 }}>
            <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor={stops[1]} /><stop offset="100%" stopColor={stops[0]} /></linearGradient></defs>
            <XAxis type="number" tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="name" width={140} tickLine={false} axisLine={false} />
            <RTooltip formatter={(v) => `${v} ${unit}`} />
            <Bar dataKey={valueKey} fill={`url(#${id})`} radius={[0, 8, 8, 0]} barSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </ChartCard>
  );
}

export function Funnel({ funnel, losses }) {
  const steps = [
    ['Posted', funnel.posted], ['Claimed', funnel.claimed], ['Collected', funnel.collected], ['Delivered', funnel.delivered], ['Accepted', funnel.accepted],
  ];
  return (
    <ChartCard title="Rescue funnel">
      <Box className="flex flex-col gap-3">
        {steps.map(([label, v]) => {
          const pct = funnel.posted ? (v / funnel.posted) * 100 : 0;
          return (
            <Box key={label}>
              <Box className="mb-1.5 flex justify-between text-sm"><span className="text-gray-700">{label}</span><span className="tabular font-semibold text-gray-900">{v} <span className="text-xs font-normal text-gray-500">{Math.round(pct)}%</span></span></Box>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className="bg-grad-glow h-full rounded-full" style={{ width: `${pct}%` }} /></div>
            </Box>
          );
        })}
      </Box>
      <Box className="mt-5 grid grid-cols-3 gap-2 border-0 border-t border-solid border-gray-100 pt-4 text-center">
        {[[LuClock, 'Expired', losses.expired], [LuCircleX, 'Cancelled', losses.cancelled], [LuBan, 'Rejected', losses.rejected]].map(([Icon, label, v]) => (
          <div key={label}>
            <div className="tabular text-lg font-semibold text-gray-900">{v}</div>
            <div className="inline-flex items-center gap-1 text-xs text-gray-500"><Icon size={12} /> {label}</div>
          </div>
        ))}
      </Box>
    </ChartCard>
  );
}
