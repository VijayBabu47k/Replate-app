// Country → State → City → Pincode reference data used by registration and matching.
// Coordinates are approximate area centroids (used for distance-based matching only).
export const LOCATIONS = [
  {
    name: 'India',
    states: [
      {
        name: 'Karnataka',
        cities: [
          {
            name: 'Bengaluru',
            pincodes: [
              { code: '560103', area: 'Bellandur', lat: 12.935, lng: 77.69 },
              { code: '560037', area: 'Marathahalli', lat: 12.958, lng: 77.701 },
              { code: '560102', area: 'HSR Layout', lat: 12.915, lng: 77.665 },
              { code: '560038', area: 'Indiranagar', lat: 12.972, lng: 77.66 },
              { code: '560066', area: 'Whitefield', lat: 12.9698, lng: 77.75 },
              { code: '560034', area: 'Koramangala', lat: 12.9352, lng: 77.6245 },
              { code: '560001', area: 'MG Road', lat: 12.9756, lng: 77.605 },
            ],
          },
          {
            name: 'Mysuru',
            pincodes: [
              { code: '570001', area: 'Mysuru City', lat: 12.3052, lng: 76.6552 },
              { code: '570009', area: 'Kuvempunagar', lat: 12.286, lng: 76.626 },
              { code: '570017', area: 'Vijayanagar', lat: 12.32, lng: 76.615 },
            ],
          },
          {
            name: 'Mangaluru',
            pincodes: [
              { code: '575001', area: 'Hampankatta', lat: 12.8698, lng: 74.843 },
              { code: '575003', area: 'Kadri', lat: 12.885, lng: 74.856 },
            ],
          },
        ],
      },
      {
        name: 'Maharashtra',
        cities: [
          {
            name: 'Mumbai',
            pincodes: [
              { code: '400001', area: 'Fort', lat: 18.9338, lng: 72.8356 },
              { code: '400050', area: 'Bandra West', lat: 19.0596, lng: 72.8295 },
              { code: '400076', area: 'Powai', lat: 19.1176, lng: 72.906 },
              { code: '400093', area: 'Andheri East', lat: 19.1136, lng: 72.8697 },
            ],
          },
          {
            name: 'Pune',
            pincodes: [
              { code: '411001', area: 'Camp', lat: 18.5167, lng: 73.8777 },
              { code: '411057', area: 'Hinjewadi', lat: 18.5912, lng: 73.7389 },
              { code: '411014', area: 'Viman Nagar', lat: 18.5679, lng: 73.9143 },
            ],
          },
        ],
      },
      {
        name: 'Tamil Nadu',
        cities: [
          {
            name: 'Chennai',
            pincodes: [
              { code: '600001', area: 'Parrys', lat: 13.09, lng: 80.288 },
              { code: '600017', area: 'T. Nagar', lat: 13.0418, lng: 80.2341 },
              { code: '600096', area: 'Perungudi', lat: 12.9654, lng: 80.2461 },
              { code: '600113', area: 'Taramani', lat: 12.9863, lng: 80.2432 },
            ],
          },
          {
            name: 'Coimbatore',
            pincodes: [
              { code: '641001', area: 'Town Hall', lat: 10.9925, lng: 76.9614 },
              { code: '641004', area: 'Peelamedu', lat: 11.027, lng: 77.008 },
            ],
          },
        ],
      },
      {
        name: 'Telangana',
        cities: [
          {
            name: 'Hyderabad',
            pincodes: [
              { code: '500081', area: 'Madhapur', lat: 17.4483, lng: 78.3915 },
              { code: '500032', area: 'Gachibowli', lat: 17.4401, lng: 78.3489 },
              { code: '500034', area: 'Banjara Hills', lat: 17.4126, lng: 78.4482 },
              { code: '500003', area: 'Secunderabad', lat: 17.4399, lng: 78.4983 },
            ],
          },
        ],
      },
      {
        name: 'Delhi',
        cities: [
          {
            name: 'New Delhi',
            pincodes: [
              { code: '110001', area: 'Connaught Place', lat: 28.6315, lng: 77.2167 },
              { code: '110016', area: 'Hauz Khas', lat: 28.5494, lng: 77.2001 },
              { code: '110019', area: 'Kalkaji', lat: 28.5494, lng: 77.2588 },
            ],
          },
        ],
      },
    ],
  },
];

/** Resolve a full location; returns null if any level doesn't match. */
export function findLocation({ country, state, city, pincode } = {}) {
  const c = LOCATIONS.find((x) => x.name === country);
  const s = c?.states.find((x) => x.name === state);
  const ci = s?.cities.find((x) => x.name === city);
  const p = ci?.pincodes.find((x) => x.code === String(pincode));
  return p ? { country: c.name, state: s.name, city: ci.name, pincode: p.code, area: p.area, lat: p.lat, lng: p.lng } : null;
}

/** A random point within ~1 km of the pincode centroid, so organisations in the same pincode don't overlap. */
export function pointNear({ lat, lng }, spread = 0.008) {
  return {
    lat: +(lat + (Math.random() - 0.5) * spread * 2).toFixed(5),
    lng: +(lng + (Math.random() - 0.5) * spread * 2).toFixed(5),
  };
}
