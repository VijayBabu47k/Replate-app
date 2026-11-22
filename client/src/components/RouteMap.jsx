import { useEffect, useMemo } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MapContainer, TileLayer, Marker, Polyline, Circle, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card, CardContent, Typography, Box } from '@mui/material';
import { LuRoute, LuStore, LuHouse, LuBike } from 'react-icons/lu';
import { useThemeMode } from '../lib/themeMode';

// OpenStreetMap tiles (no API key). Dark mode re-tints them with a CSS filter (see .map-dark in index.css).
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const pinIcon = (Icon, cls) => L.divIcon({
  className: 'map-pin-wrap',
  html: `<div class="map-pin ${cls}">${renderToStaticMarkup(<Icon size={16} />)}</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});
const ICONS = { donor: pinIcon(LuStore, 'pin-donor'), receiver: pinIcon(LuHouse, 'pin-receiver'), volunteer: pinIcon(LuBike, 'pin-volunteer') };

function FitBounds({ points }) {
  const map = useMap();
  const key = points.map((p) => p.join(',')).join('|');
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 14);
    else map.fitBounds(points, { padding: [48, 48], maxZoom: 15 });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** Live map of the rescue: donor, receiver and the volunteer's (simulated) position. */
export default function RouteMap({ listing, children }) {
  const { mode } = useThemeMode();
  const donor = listing.donorOrg;
  const recv = listing.claim?.receiverOrg;
  const vol = listing.claim?.volunteer;
  const s = listing.status;

  const geo = useMemo(() => {
    const d = donor?.lat ? [donor.lat, donor.lng] : null;
    const r = recv?.lat ? [recv.lat, recv.lng] : null;
    let v = null;
    if (vol?.lat && d && r) {
      const home = [vol.lat, vol.lng];
      if (s === 'ASSIGNED') v = lerp(home, d, 0.55);
      else if (s === 'COLLECTED') v = lerp(d, r, 0.5);
      else if (['DELIVERED', 'REJECTED'].includes(s)) v = r;
    }
    return { d, r, v };
  }, [donor, recv, vol, s]);

  if (!geo.d) return null;
  const pts = [geo.d, geo.r, geo.v].filter(Boolean);
  const moving = ['ASSIGNED', 'COLLECTED'].includes(s);

  return (
    <Card>
      <CardContent>
        <Box className="mb-4 flex items-center gap-2.5">
          <span className="icon-tile h-9 w-9"><LuRoute size={18} /></span>
          <Typography className="!font-semibold">Route</Typography>
          {moving && <span className="pill ml-auto bg-green-50 text-green-700"><span className="live-dot" /> Live</span>}
        </Box>
        <div className={`map-frame ${mode === 'dark' ? 'map-dark' : ''}`}>
          <MapContainer center={geo.d} zoom={13} scrollWheelZoom={false} style={{ height: 300, width: '100%' }} attributionControl>
            <TileLayer url={TILES} attribution={ATTRIBUTION} maxZoom={19} />
            <FitBounds points={pts} />
            {geo.r && <Polyline positions={[geo.d, geo.r]} pathOptions={{ color: '#10b981', weight: 4, opacity: 0.85, dashArray: '2 10', lineCap: 'round' }} />}
            {geo.v && s === 'ASSIGNED' && <Polyline positions={[geo.v, geo.d]} pathOptions={{ color: '#14b8a6', weight: 3, opacity: 0.6 }} />}
            {!donor.exact && <Circle center={geo.d} radius={900} pathOptions={{ color: '#f59e0b', weight: 1, fillOpacity: 0.08 }} />}
            <Marker position={geo.d} icon={ICONS.donor}><Tooltip direction="top" offset={[0, -16]}>{donor.exact ? donor.name : `${donor.name} (approx.)`}</Tooltip></Marker>
            {geo.r && <Marker position={geo.r} icon={ICONS.receiver}><Tooltip direction="top" offset={[0, -16]}>{recv.name}</Tooltip></Marker>}
            {geo.v && <Marker position={geo.v} icon={ICONS.volunteer} zIndexOffset={500}><Tooltip direction="top" offset={[0, -16]}>{vol.name}</Tooltip></Marker>}
          </MapContainer>
        </div>
        {children && <Box className="mt-6">{children}</Box>}
      </CardContent>
    </Card>
  );
}
