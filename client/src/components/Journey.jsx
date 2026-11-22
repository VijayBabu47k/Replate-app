import { LuStore, LuHouse, LuNavigation, LuInfo } from 'react-icons/lu';

export const directionsUrl = (p) => (p?.lat ? `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}` : null);

function Stop({ icon: Icon, label, org, note, meta, active, last, compact, pin }) {
  const url = org.exact !== false ? directionsUrl(org) : null;
  return (
    <div className="relative flex gap-3.5">
      {!last && <span className="absolute bottom-[-6px] left-[17px] top-10 w-0.5 rounded-full bg-gray-200" />}
      <span className={`map-pin !h-9 !w-9 shrink-0 !border-2 ${pin} ${active ? '' : 'opacity-45 saturate-50'}`}><Icon size={16} /></span>
      <div className={`min-w-0 flex-1 ${last ? '' : compact ? 'pb-3' : 'pb-6'}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{label}</div>
            <div className="truncate text-[15px] font-semibold text-gray-900">{org.name}</div>
          </div>
          {url && !compact && (
            <a href={url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 no-underline transition-colors hover:bg-brand-100">
              <LuNavigation size={13} /> Directions
            </a>
          )}
        </div>
        {!compact && org.street && <div className="mt-1 text-sm leading-relaxed text-gray-700">{org.street}</div>}
        <div className="text-sm text-gray-500">{org.locality || org.address}</div>
        {!compact && org.exact === false && <div className="mt-1 text-xs text-gray-500">Exact address shared after claim</div>}
        {!compact && meta?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">{meta.map((m) => <span key={m} className="pill bg-gray-100 font-medium text-gray-600">{m}</span>)}</div>
        )}
        {note && (
          <div className="mt-2.5 flex gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs leading-relaxed text-gray-700">
            <LuInfo size={14} className="mt-0.5 shrink-0 text-gray-400" /> {note}
          </div>
        )}
      </div>
    </div>
  );
}

/** Pickup → delivery stops, like a ride app. `compact` hides street, meta and directions. */
export default function Journey({ listing: l, compact }) {
  const c = l.claim;
  const atPickup = !c || ['POSTED', 'CLAIMED', 'ASSIGNED'].includes(l.status);
  return (
    <div>
      <Stop icon={LuStore} pin="pin-donor" label="Pickup" org={l.donorOrg} active={atPickup} last={!c} compact={compact}
        note={!compact || atPickup ? l.pickupInstructions : null}
        meta={[l.donorOrg.fssaiNumber && `FSSAI ${l.donorOrg.fssaiNumber}`].filter(Boolean)} />
      {c && (
        <Stop icon={LuHouse} pin="pin-receiver" label="Deliver" org={c.receiverOrg} active={!atPickup} last compact={compact}
          meta={[c.receiverProfile?.beneficiaryType, c.selfPickup && 'Collecting themselves', c.receiverOrg.registrationNumber && `Reg. ${c.receiverOrg.registrationNumber}`].filter(Boolean)} />
      )}
    </div>
  );
}
