/**
 * Velvet Hearts — Indian States & Union Territories Dataset & Geodesic Distance Engine
 * Contains all 28 States and 8 Union Territories with capital/centroid coordinates (lat/lng)
 */

export interface IndianState {
  code: string;
  name: string;
  region: string;
  lat: number;
  lng: number;
  isUT: boolean;
}

export const INDIAN_STATES: IndianState[] = [
  // Northern States & UTs
  { code: 'DL', name: 'Delhi', region: 'North', lat: 28.6139, lng: 77.2090, isUT: true },
  { code: 'JK', name: 'Jammu & Kashmir', region: 'North', lat: 34.0837, lng: 74.7973, isUT: true },
  { code: 'LA', name: 'Ladakh', region: 'North', lat: 34.1526, lng: 77.5771, isUT: true },
  { code: 'HP', name: 'Himachal Pradesh', region: 'North', lat: 31.1048, lng: 77.1734, isUT: false },
  { code: 'PB', name: 'Punjab', region: 'North', lat: 30.7333, lng: 76.7794, isUT: false },
  { code: 'CH', name: 'Chandigarh', region: 'North', lat: 30.7333, lng: 76.7794, isUT: true },
  { code: 'HR', name: 'Haryana', region: 'North', lat: 30.7333, lng: 76.7794, isUT: false },
  { code: 'UK', name: 'Uttarakhand', region: 'North', lat: 30.3165, lng: 78.0322, isUT: false },
  { code: 'UP', name: 'Uttar Pradesh', region: 'North', lat: 26.8467, lng: 80.9462, isUT: false },
  { code: 'RJ', name: 'Rajasthan', region: 'North', lat: 26.9124, lng: 75.7873, isUT: false },

  // Western States & UTs
  { code: 'MH', name: 'Maharashtra', region: 'West', lat: 18.9220, lng: 72.8347, isUT: false },
  { code: 'GJ', name: 'Gujarat', region: 'West', lat: 23.2156, lng: 72.6369, isUT: false },
  { code: 'GA', name: 'Goa', region: 'West', lat: 15.4909, lng: 73.8278, isUT: false },
  { code: 'DN', name: 'Dadra and Nagar Haveli & Daman and Diu', region: 'West', lat: 20.4283, lng: 72.8397, isUT: true },

  // Southern States & UTs
  { code: 'KA', name: 'Karnataka', region: 'South', lat: 12.9716, lng: 77.5946, isUT: false },
  { code: 'TS', name: 'Telangana', region: 'South', lat: 17.3850, lng: 78.4867, isUT: false },
  { code: 'AP', name: 'Andhra Pradesh', region: 'South', lat: 16.5062, lng: 80.6480, isUT: false },
  { code: 'TN', name: 'Tamil Nadu', region: 'South', lat: 13.0827, lng: 80.2707, isUT: false },
  { code: 'KL', name: 'Kerala', region: 'South', lat: 8.5241, lng: 76.9366, isUT: false },
  { code: 'PY', name: 'Puducherry', region: 'South', lat: 11.9416, lng: 79.8083, isUT: true },
  { code: 'LD', name: 'Lakshadweep', region: 'South', lat: 10.5667, lng: 72.6417, isUT: true },
  { code: 'AN', name: 'Andaman & Nicobar Islands', region: 'South', lat: 11.6234, lng: 92.7265, isUT: true },

  // Central States
  { code: 'MP', name: 'Madhya Pradesh', region: 'Central', lat: 23.2599, lng: 77.4126, isUT: false },
  { code: 'CG', name: 'Chhattisgarh', region: 'Central', lat: 21.2514, lng: 81.6296, isUT: false },

  // Eastern States
  { code: 'WB', name: 'West Bengal', region: 'East', lat: 22.5726, lng: 88.3639, isUT: false },
  { code: 'OD', name: 'Odisha', region: 'East', lat: 20.2961, lng: 85.8245, isUT: false },
  { code: 'BR', name: 'Bihar', region: 'East', lat: 25.5941, lng: 85.1376, isUT: false },
  { code: 'JH', name: 'Jharkhand', region: 'East', lat: 23.3441, lng: 85.3096, isUT: false },

  // North-Eastern States
  { code: 'AS', name: 'Assam', region: 'Northeast', lat: 26.1445, lng: 91.7362, isUT: false },
  { code: 'SK', name: 'Sikkim', region: 'Northeast', lat: 27.3389, lng: 88.6065, isUT: false },
  { code: 'ML', name: 'Meghalaya', region: 'Northeast', lat: 25.5788, lng: 91.8933, isUT: false },
  { code: 'TR', name: 'Tripura', region: 'Northeast', lat: 23.8315, lng: 91.2868, isUT: false },
  { code: 'MZ', name: 'Mizoram', region: 'Northeast', lat: 23.7271, lng: 92.7176, isUT: false },
  { code: 'MN', name: 'Manipur', region: 'Northeast', lat: 24.8170, lng: 93.9368, isUT: false },
  { code: 'NL', name: 'Nagaland', region: 'Northeast', lat: 25.6751, lng: 94.1086, isUT: false },
  { code: 'AR', name: 'Arunachal Pradesh', region: 'Northeast', lat: 27.0844, lng: 93.6053, isUT: false }
];

const CITY_TO_STATE_MAP: Record<string, string> = {
  mumbai: 'Maharashtra',
  pune: 'Maharashtra',
  nagpur: 'Maharashtra',
  nashik: 'Maharashtra',
  bangalore: 'Karnataka',
  bengaluru: 'Karnataka',
  mysore: 'Karnataka',
  delhi: 'Delhi',
  'new delhi': 'Delhi',
  ncr: 'Delhi',
  hyderabad: 'Telangana',
  chennai: 'Tamil Nadu',
  coimbatore: 'Tamil Nadu',
  kolkata: 'West Bengal',
  ahmedabad: 'Gujarat',
  surat: 'Gujarat',
  jaipur: 'Rajasthan',
  udaipur: 'Rajasthan',
  lucknow: 'Uttar Pradesh',
  kanpur: 'Uttar Pradesh',
  noida: 'Uttar Pradesh',
  ghaziabad: 'Uttar Pradesh',
  gurgaon: 'Haryana',
  gurugram: 'Haryana',
  chandigarh: 'Chandigarh',
  kochi: 'Kerala',
  thiruvananthapuram: 'Kerala',
  bhopal: 'Madhya Pradesh',
  indore: 'Madhya Pradesh',
  patna: 'Bihar',
  bhubaneswar: 'Odisha',
  ranchi: 'Jharkhand',
  guwahati: 'Assam',
  panaji: 'Goa',
  dehradun: 'Uttarakhand',
  shimla: 'Himachal Pradesh'
};

export function normalizeStateName(input?: string | null): string {
  if (!input || typeof input !== 'string') return '';
  const clean = input.trim();
  const lower = clean.toLowerCase();

  const exact = INDIAN_STATES.find((s) => s.name.toLowerCase() === lower);
  if (exact) return exact.name;

  const partial = INDIAN_STATES.find((s) => lower.includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(lower));
  if (partial) return partial.name;

  for (const [city, state] of Object.entries(CITY_TO_STATE_MAP)) {
    if (lower.includes(city)) {
      return state;
    }
  }

  return clean;
}

export function getStateInfo(stateName?: string | null): IndianState | null {
  const normalized = normalizeStateName(stateName);
  return INDIAN_STATES.find((s) => s.name.toLowerCase() === normalized.toLowerCase()) || null;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function calculateStateDistance(
  stateA?: string | null,
  stateB?: string | null
): { distanceKm: number; formatted: string; isSameState: boolean } {
  if (!stateA || !stateB) {
    return { distanceKm: 25, formatted: 'Within India', isSameState: false };
  }

  const sA = getStateInfo(stateA);
  const sB = getStateInfo(stateB);

  if (!sA || !sB) {
    return { distanceKm: 50, formatted: 'Nearby', isSameState: false };
  }

  if (sA.name === sB.name) {
    return {
      distanceKm: 25,
      formatted: 'Same State (< 50 km)',
      isSameState: true
    };
  }

  const km = haversineDistance(sA.lat, sA.lng, sB.lat, sB.lng);
  return {
    distanceKm: km,
    formatted: `${km} km away`,
    isSameState: false
  };
}
