import { useState } from 'react';
import { Box, Card, CardContent, Typography, Stepper, Step, StepLabel, Tooltip } from '@mui/material';
import { Link } from 'react-router-dom';
import {
  LuTimer, LuTriangleAlert, LuScale, LuUtensils, LuMapPin, LuArrowUpRight, LuShieldCheck, LuCircleCheck,
  LuClipboardList, LuClockAlert, LuChevronDown, LuIndianRupee, LuCookingPot, LuSalad, LuCroissant, LuSandwich, LuSoup, LuCakeSlice, LuApple, LuMilk, LuDrumstick,
} from 'react-icons/lu';
import { STATUS, DIET, STORAGE, UNIT, FLOW, fmtTime, fmtDateTime } from '../lib/format';
import { useNow } from '../lib/hooks';

// Status pill colours (tailwind tint scales defined in tailwind.config.js)
const STATUS_TONE = {
  POSTED: 'bg-blue-50 text-blue-700 ring-blue-200',
  CLAIMED: 'bg-teal-50 text-teal-700 ring-teal-200',
  ASSIGNED: 'bg-teal-50 text-teal-700 ring-teal-200',
  COLLECTED: 'bg-amber-50 text-amber-700 ring-amber-200',
  DELIVERED: 'bg-green-50 text-green-700 ring-green-200',
  REJECTED: 'bg-red-50 text-red-700 ring-red-200',
  EXPIRED: 'bg-gray-100 text-gray-600 ring-gray-200',
  CANCELLED: 'bg-gray-100 text-gray-600 ring-gray-200',
};
const LIVE = ['POSTED', 'CLAIMED', 'ASSIGNED', 'COLLECTED'];

export function StatusChip({ status, size = 'small' }) {
  const s = STATUS[status] || { label: status };
  return (
    <span className={`pill ring-1 ring-inset ${STATUS_TONE[status] || STATUS_TONE.EXPIRED} ${size === 'medium' ? '!px-3 !py-1 !text-[13px]' : ''}`}>
      {LIVE.includes(status) ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : status === 'DELIVERED' ? <LuCircleCheck /> : null}
      {s.label}
    </span>
  );
}

const DIET_TONE = { VEG: 'green', JAIN: 'lime', VEGAN: 'emerald', EGG: 'amber', NON_VEG: 'red' };
export function DietBadge({ diet }) {
  const d = DIET[diet] || { label: diet };
  const t = DIET_TONE[diet] || 'green';
  return (
    <span className={`pill bg-${t}-50 text-${t}-700 ring-1 ring-inset ring-${t}-200`}>
      <span className={`inline-grid h-3 w-3 place-items-center rounded-[3px] border border-solid border-current`}><span className="h-1.5 w-1.5 rounded-full bg-current" /></span>
      {d.label}
    </span>
  );
}

export function AllergenChips({ allergens, quiet }) {
  if (!allergens?.length) return quiet ? null : <span className="pill bg-gray-50 text-gray-500 ring-1 ring-inset ring-gray-200"><LuShieldCheck /> No allergens</span>;
  return (
    <>
      {allergens.map((a) => (
        <span key={a} className="pill bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200"><LuTriangleAlert /> {a}</span>
      ))}
    </>
  );
}

const windowTone = (expired, mins) =>
  expired ? { cls: 'text-gray-500', bar: 'var(--c-gray-300)' }
    : mins > 90 ? { cls: 'text-green-700', bar: 'linear-gradient(90deg,#22c55e,#0d9488)' }
      : mins > 30 ? { cls: 'text-amber-700', bar: 'linear-gradient(90deg,#f59e0b,#f97316)' }
        : { cls: 'text-red-700', bar: 'linear-gradient(90deg,#f43f5e,#ef4444)' };

const leftText = (ms) => {
  if (ms <= 0) return 'Window closed';
  const mins = Math.floor(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const s = Math.floor(ms / 1000) % 60;
  return h ? `${h}h ${m}m left` : `${m}m ${String(s).padStart(2, '0')}s left`;
};

/** Spoilage countdown pill: green > 90 min, amber > 30 min, red below. */
export function Countdown({ to, label = 'Consume by', compact }) {
  const now = useNow(1000);
  const ms = new Date(to) - now;
  const mins = Math.floor(ms / 60000);
  const expired = ms <= 0;
  const cls = expired ? 'bg-gray-100 text-gray-600 ring-gray-200'
    : mins > 90 ? 'bg-green-50 text-green-700 ring-green-200'
      : mins > 30 ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-red-50 text-red-700 ring-red-200 animate-pulse';
  return (
    <Tooltip title={`${label}: ${fmtDateTime(to)}`}>
      <span className={`pill tabular ring-1 ring-inset ${cls}`}>
        <LuTimer /> {compact ? leftText(ms) : `${leftText(ms)} · ${label.toLowerCase()} ${fmtTime(to)}`}
      </span>
    </Tooltip>
  );
}

/** Safe-window progress strip used at the bottom of listing cards. */
function SafeWindow({ l }) {
  const now = useNow(1000);
  const end = new Date(l.consumeBy).getTime();
  const start = new Date(l.preparedAt || l.createdAt).getTime();
  const ms = end - now;
  const pct = Math.max(0, Math.min(100, (ms / Math.max(1, end - start)) * 100));
  const t = windowTone(ms <= 0, Math.floor(ms / 60000));
  const overdueMin = Math.floor((now - new Date(l.pickupBy)) / 60000);
  const overdue = overdueMin >= 1 && ['POSTED', 'CLAIMED', 'ASSIGNED'].includes(l.status);
  return (
    <Box>
      <Box className="mb-1.5 flex items-center justify-between gap-2 text-xs">
        <Tooltip title={`Consume by ${fmtDateTime(l.consumeBy)}`}>
          <span className={`tabular inline-flex items-center gap-1 font-semibold ${t.cls}`}><LuTimer size={13} /> {leftText(ms)}</span>
        </Tooltip>
        {overdue ? (
          <Tooltip title="Pickup time has passed but the food is still inside its safe window.">
            <span className="tabular inline-flex items-center gap-1 font-semibold text-red-700"><LuClockAlert size={13} /> Pickup overdue {overdueMin >= 60 ? `${Math.floor(overdueMin / 60)}h ${overdueMin % 60}m` : `${overdueMin}m`}</span>
          </Tooltip>
        ) : (
          <span className="tabular text-gray-500">Pickup by {fmtTime(l.pickupBy)}</span>
        )}
      </Box>
      <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full transition-[width] duration-1000" style={{ width: `${pct}%`, background: t.bar }} />
      </div>
    </Box>
  );
}

/** Pickup-by line, with an overdue badge (used on the detail page). */
export function PickupBy({ l }) {
  const now = useNow(1000);
  const overdueMin = Math.floor((now - new Date(l.pickupBy)) / 60000);
  const overdue = overdueMin >= 1 && ['POSTED', 'CLAIMED', 'ASSIGNED'].includes(l.status);
  return (
    <>
      <span className="text-xs text-gray-600">Pickup by {fmtDateTime(l.pickupBy)}</span>
      {overdue && <span className="pill tabular bg-red-50 text-red-700 ring-1 ring-inset ring-red-200"><LuClockAlert /> Overdue {overdueMin}m</span>}
    </>
  );
}

export function QuantityLine({ l }) {
  return (
    <span className="tabular inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-700">
      <span className="inline-flex items-center gap-1.5"><LuScale size={15} className="text-gray-400" /> {l.quantity} {UNIT[l.unit]}{l.unit !== 'KG' && <span className="text-gray-500">({l.quantityKg} kg)</span>}</span>
      <span className="inline-flex items-center gap-1.5"><LuUtensils size={15} className="text-gray-400" /> <b className="font-semibold text-gray-900">{l.estimatedMeals}</b> meals</span>
    </span>
  );
}

export function StorageTag({ storage, pill }) {
  const s = STORAGE[storage];
  if (!s) return null;
  const Icon = s.Icon;
  if (pill) return <span className={`pill bg-${s.tone}-50 text-${s.tone}-700 ring-1 ring-inset ring-${s.tone}-200`}><Icon /> {s.short}</span>;
  return <span className="inline-flex items-center gap-1.5 text-sm text-gray-700"><Icon size={15} className={`text-${s.tone}-700`} /> {s.label}</span>;
}

// Pick a food icon from the category/title, so every card has a recognisable visual
const FOOD_ICONS = [
  [/salad|raita|fruit|veg(etable)?s?\b|sprout/i, LuSalad],
  [/bread|roti|chapati|paratha|bakery|bun|puff|croissant/i, LuCroissant],
  [/sandwich|snack|box|packaged|samosa/i, LuSandwich],
  [/soup|dal|sambar|rasam|curry|gravy|tadka/i, LuSoup],
  [/sweet|dessert|cake|halwa|kheer/i, LuCakeSlice],
  [/fruit|apple|banana/i, LuApple],
  [/milk|dairy|curd|lassi|buttermilk/i, LuMilk],
  [/chicken|mutton|fish|meat|kebab/i, LuDrumstick],
];
export function foodIcon(l) {
  const text = `${l.categoryLabel || ''} ${l.category || ''} ${l.title || ''}`;
  return FOOD_ICONS.find(([re]) => re.test(text))?.[1] || LuCookingPot;
}

/** Delivery fee pill for cards; hidden for ₹0 and self-pickup claims. */
export function FeePill({ l }) {
  if (!l.deliveryFee || l.claim?.selfPickup) return null;
  const paid = l.fee?.state === 'paid';
  return (
    <span className={`pill ring-1 ring-inset ${paid ? 'bg-green-50 text-green-700 ring-green-200' : 'bg-teal-50 text-teal-700 ring-teal-200'}`}>
      <LuIndianRupee /> {l.deliveryFee} {paid ? 'paid' : 'delivery'}
    </span>
  );
}

export function HandlingCard({ handling, storage }) {
  const [all, setAll] = useState(false);
  const steps = all ? handling.steps : handling.steps.slice(0, 3);
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <Box className="flex items-center gap-2.5">
          <span className="icon-tile h-9 w-9"><LuClipboardList size={18} /></span>
          <Typography className="!font-semibold">Handling</Typography>
          <Box className="ml-auto"><StorageTag storage={storage} pill /></Box>
        </Box>
        <div className="flex gap-2.5 rounded-xl bg-amber-50 p-3 text-[13px] leading-relaxed text-amber-800 ring-1 ring-inset ring-amber-200">
          <LuTriangleAlert size={16} className="mt-0.5 shrink-0" /> <span>{handling.allergenWarning}</span>
        </div>
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {steps.map((s, i) => (
            <li key={s} className="flex gap-3 text-sm leading-relaxed text-gray-700">
              <span className="tabular grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
        {handling.steps.length > 3 && (
          <button type="button" onClick={() => setAll((v) => !v)} className="inline-flex w-fit cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-sm font-semibold text-brand-700">
            {all ? 'Show less' : `Show all ${handling.steps.length} steps`} <LuChevronDown size={15} className={`transition-transform ${all ? 'rotate-180' : ''}`} />
          </button>
        )}
      </CardContent>
    </Card>
  );
}

export function FlowStepper({ status }) {
  const failed = STATUS[status]?.step === -1;
  const active = failed ? -1 : STATUS[status]?.step ?? 0;
  return (
    <Stepper activeStep={status === 'DELIVERED' ? 5 : active} alternativeLabel>
      {FLOW.map((s) => (
        <Step key={s} completed={(!failed && STATUS[s].step < active) || status === 'DELIVERED'}>
          <StepLabel>{STATUS[s].label}</StepLabel>
        </Step>
      ))}
    </Stepper>
  );
}

/** Status history, newest event first; the latest one is highlighted. */
export function Timeline({ events }) {
  const list = [...events].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return (
    <ol className="relative m-0 list-none p-0">
      {list.map((e, i) => (
        <li key={e.id} className="relative flex gap-3.5 pb-5 last:pb-0">
          {i < list.length - 1 && <span className="absolute bottom-0 left-[7px] top-5 w-px bg-gray-200" />}
          <span className={`relative mt-1 h-[15px] w-[15px] shrink-0 rounded-full ring-4 ring-[color:var(--bg-0)] ${i === 0 ? 'bg-grad-glow' : 'bg-gray-300'}`} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip status={e.status} />
              <span className="tabular text-xs text-gray-500">{fmtDateTime(e.createdAt)}</span>
            </div>
            <div className="mt-1.5 text-sm text-gray-800">{e.note}</div>
            {e.actor?.name && <div className="text-xs text-gray-500">{e.actor.name}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * Listing card: food icon + title header, status, quick facts, tags, a safe-window progress strip,
 * then role-specific content (`extra`) and actions (`children`) in a footer.
 */
export function ListingCard({ l, children, extra, dim }) {
  const Icon = foodIcon(l);
  const live = LIVE.includes(l.status);
  return (
    <Card className={`card-hover h-full ${dim ? 'opacity-60' : ''}`}>
      <CardContent className="flex h-full flex-col gap-3.5">
        <Box className="flex items-start gap-3">
          <span className="icon-tile h-11 w-11 !rounded-[14px]"><Icon size={21} /></span>
          <Box className="min-w-0 flex-1">
            <Link to={`/listings/${l.id}`} className="group flex items-start gap-1 text-[15.5px] font-semibold leading-snug tracking-tight text-gray-900 no-underline">
              <span className="line-clamp-2">{l.title}</span>
              <LuArrowUpRight size={15} className="mt-1 shrink-0 text-gray-400 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
            </Link>
            {!l.viewer?.isDonor && (
              <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-gray-500">
                <LuMapPin size={12} className="shrink-0" />
                <span className="truncate">{l.donorOrg?.name}{l.donorOrg?.zone ? ` · ${l.donorOrg.zone}` : ''}</span>
              </div>
            )}
          </Box>
          <StatusChip status={l.status} />
        </Box>

        <QuantityLine l={l} />

        <Box className="flex flex-wrap gap-1.5">
          <DietBadge diet={l.dietType} />
          <StorageTag storage={l.storage} pill />
          <AllergenChips allergens={l.allergens} quiet />
          <FeePill l={l} />
        </Box>

        {extra}

        {live && <Box className="mt-auto pt-1"><SafeWindow l={l} /></Box>}

        {children && (
          <Box className={`${live ? '' : 'mt-auto'} -mx-5 -mb-5 flex flex-wrap items-center gap-2 border-0 border-t border-solid border-gray-100 bg-gray-50 px-5 py-3`}>
            {children}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
