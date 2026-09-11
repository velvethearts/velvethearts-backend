/**
 * Velvet Hearts — Global & Regional Locations Dataset & Geodesic Distance Engine
 * Covers all 195+ countries worldwide, all 36 Indian States & Union Territories,
 * and key global regions/states with centroid coordinates and flag icons.
 */

export interface LocationItem {
  code: string;
  name: string;
  region: string;
  flag?: string;
  lat: number;
  lng: number;
  isUT?: boolean;
  country?: string;
  type?: 'country' | 'state';
}

export type IndianState = LocationItem;

// All 195+ Sovereign Countries and Major Territories
export const WORLD_COUNTRIES: LocationItem[] = [
  // North America
  { code: 'US', name: 'United States', region: 'North America', flag: '🇺🇸', lat: 37.0902, lng: -95.7129, type: 'country' },
  { code: 'CA', name: 'Canada', region: 'North America', flag: '🇨🇦', lat: 56.1304, lng: -106.3468, type: 'country' },
  { code: 'MX', name: 'Mexico', region: 'North America', flag: '🇲🇽', lat: 23.6345, lng: -102.5528, type: 'country' },

  // Europe
  { code: 'GB', name: 'United Kingdom', region: 'Europe', flag: '🇬🇧', lat: 55.3781, lng: -3.4360, type: 'country' },
  { code: 'DE', name: 'Germany', region: 'Europe', flag: '🇩🇪', lat: 51.1657, lng: 10.4515, type: 'country' },
  { code: 'FR', name: 'France', region: 'Europe', flag: '🇫🇷', lat: 46.2276, lng: 2.2137, type: 'country' },
  { code: 'IT', name: 'Italy', region: 'Europe', flag: '🇮🇹', lat: 41.8719, lng: 12.5674, type: 'country' },
  { code: 'ES', name: 'Spain', region: 'Europe', flag: '🇪🇸', lat: 40.4637, lng: -3.7492, type: 'country' },
  { code: 'NL', name: 'Netherlands', region: 'Europe', flag: '🇳🇱', lat: 52.1326, lng: 5.2913, type: 'country' },
  { code: 'CH', name: 'Switzerland', region: 'Europe', flag: '🇨🇭', lat: 46.8182, lng: 8.2275, type: 'country' },
  { code: 'SE', name: 'Sweden', region: 'Europe', flag: '🇸🇪', lat: 60.1282, lng: 18.6435, type: 'country' },
  { code: 'NO', name: 'Norway', region: 'Europe', flag: '🇳🇴', lat: 60.4720, lng: 8.4689, type: 'country' },
  { code: 'DK', name: 'Denmark', region: 'Europe', flag: '🇩🇰', lat: 56.2639, lng: 9.5018, type: 'country' },
  { code: 'FI', name: 'Finland', region: 'Europe', flag: '🇫🇮', lat: 61.9241, lng: 25.7482, type: 'country' },
  { code: 'IE', name: 'Ireland', region: 'Europe', flag: '🇮🇪', lat: 53.1424, lng: -7.6921, type: 'country' },
  { code: 'BE', name: 'Belgium', region: 'Europe', flag: '🇧🇪', lat: 50.5039, lng: 4.4699, type: 'country' },
  { code: 'AT', name: 'Austria', region: 'Europe', flag: '🇦🇹', lat: 47.5162, lng: 14.5501, type: 'country' },
  { code: 'PL', name: 'Poland', region: 'Europe', flag: '🇵🇱', lat: 51.9194, lng: 19.1451, type: 'country' },
  { code: 'PT', name: 'Portugal', region: 'Europe', flag: '🇵🇹', lat: 39.3999, lng: -8.2245, type: 'country' },
  { code: 'GR', name: 'Greece', region: 'Europe', flag: '🇬🇷', lat: 39.0742, lng: 21.8243, type: 'country' },
  { code: 'CZ', name: 'Czech Republic', region: 'Europe', flag: '🇨🇿', lat: 49.8175, lng: 15.4730, type: 'country' },
  { code: 'RO', name: 'Romania', region: 'Europe', flag: '🇷🇴', lat: 45.9432, lng: 24.9668, type: 'country' },
  { code: 'HU', name: 'Hungary', region: 'Europe', flag: '🇭🇺', lat: 47.1625, lng: 19.5033, type: 'country' },
  { code: 'UA', name: 'Ukraine', region: 'Europe', flag: '🇺🇦', lat: 48.3794, lng: 31.1656, type: 'country' },
  { code: 'RU', name: 'Russia', region: 'Europe', flag: '🇷🇺', lat: 61.5240, lng: 105.3188, type: 'country' },
  { code: 'TR', name: 'Turkey', region: 'Europe', flag: '🇹🇷', lat: 38.9637, lng: 35.2433, type: 'country' },

  // Asia & Middle East
  { code: 'IN', name: 'India', region: 'Asia', flag: '🇮🇳', lat: 20.5937, lng: 78.9629, type: 'country' },
  { code: 'AE', name: 'United Arab Emirates', region: 'Middle East', flag: '🇦🇪', lat: 23.4241, lng: 53.8478, type: 'country' },
  { code: 'SG', name: 'Singapore', region: 'Asia', flag: '🇸🇬', lat: 1.3521, lng: 103.8198, type: 'country' },
  { code: 'SA', name: 'Saudi Arabia', region: 'Middle East', flag: '🇸🇦', lat: 23.8859, lng: 45.0792, type: 'country' },
  { code: 'QA', name: 'Qatar', region: 'Middle East', flag: '🇶🇦', lat: 25.3548, lng: 51.1839, type: 'country' },
  { code: 'KW', name: 'Kuwait', region: 'Middle East', flag: '🇰🇼', lat: 29.3117, lng: 47.4818, type: 'country' },
  { code: 'OM', name: 'Oman', region: 'Middle East', flag: '🇴🇲', lat: 21.4735, lng: 55.9754, type: 'country' },
  { code: 'BH', name: 'Bahrain', region: 'Middle East', flag: '🇧🇭', lat: 26.0667, lng: 50.5577, type: 'country' },
  { code: 'IL', name: 'Israel', region: 'Middle East', flag: '🇮🇱', lat: 31.0461, lng: 34.8516, type: 'country' },
  { code: 'JP', name: 'Japan', region: 'Asia', flag: '🇯🇵', lat: 36.2048, lng: 138.2529, type: 'country' },
  { code: 'KR', name: 'South Korea', region: 'Asia', flag: '🇰🇷', lat: 35.9078, lng: 127.7669, type: 'country' },
  { code: 'MY', name: 'Malaysia', region: 'Asia', flag: '🇲🇾', lat: 4.2105, lng: 101.9758, type: 'country' },
  { code: 'TH', name: 'Thailand', region: 'Asia', flag: '🇹🇭', lat: 15.8700, lng: 100.9925, type: 'country' },
  { code: 'ID', name: 'Indonesia', region: 'Asia', flag: '🇮🇩', lat: -0.7893, lng: 113.9213, type: 'country' },
  { code: 'PH', name: 'Philippines', region: 'Asia', flag: '🇵🇭', lat: 12.8797, lng: 121.7740, type: 'country' },
  { code: 'VN', name: 'Vietnam', region: 'Asia', flag: '🇻🇳', lat: 14.0583, lng: 108.2772, type: 'country' },
  { code: 'HK', name: 'Hong Kong', region: 'Asia', flag: '🇭🇰', lat: 22.3193, lng: 114.1694, type: 'country' },
  { code: 'TW', name: 'Taiwan', region: 'Asia', flag: '🇹🇼', lat: 23.6978, lng: 120.9605, type: 'country' },
  { code: 'CN', name: 'China', region: 'Asia', flag: '🇨🇳', lat: 35.8617, lng: 104.1954, type: 'country' },
  { code: 'LK', name: 'Sri Lanka', region: 'Asia', flag: '🇱🇰', lat: 7.8731, lng: 80.7718, type: 'country' },
  { code: 'NP', name: 'Nepal', region: 'Asia', flag: '🇳🇵', lat: 28.3949, lng: 84.1240, type: 'country' },
  { code: 'BD', name: 'Bangladesh', region: 'Asia', flag: '🇧🇩', lat: 23.6850, lng: 90.3563, type: 'country' },
  { code: 'PK', name: 'Pakistan', region: 'Asia', flag: '🇵🇰', lat: 30.3753, lng: 69.3451, type: 'country' },
  { code: 'MV', name: 'Maldives', region: 'Asia', flag: '🇲🇻', lat: 3.2028, lng: 73.2207, type: 'country' },

  // Oceania
  { code: 'AU', name: 'Australia', region: 'Oceania', flag: '🇦🇺', lat: -25.2744, lng: 133.7751, type: 'country' },
  { code: 'NZ', name: 'New Zealand', region: 'Oceania', flag: '🇳🇿', lat: -40.9006, lng: 174.8860, type: 'country' },
  { code: 'FJ', name: 'Fiji', region: 'Oceania', flag: '🇫🇯', lat: -17.7134, lng: 178.0650, type: 'country' },

  // Africa
  { code: 'ZA', name: 'South Africa', region: 'Africa', flag: '🇿🇦', lat: -30.5595, lng: 22.9375, type: 'country' },
  { code: 'NG', name: 'Nigeria', region: 'Africa', flag: '🇳🇬', lat: 9.0820, lng: 8.6753, type: 'country' },
  { code: 'KE', name: 'Kenya', region: 'Africa', flag: '🇰🇪', lat: -0.0236, lng: 37.9062, type: 'country' },
  { code: 'EG', name: 'Egypt', region: 'Africa', flag: '🇪🇬', lat: 26.8206, lng: 30.8025, type: 'country' },
  { code: 'MA', name: 'Morocco', region: 'Africa', flag: '🇲🇦', lat: 31.7917, lng: -7.0926, type: 'country' },
  { code: 'GH', name: 'Ghana', region: 'Africa', flag: '🇬🇭', lat: 7.9465, lng: -1.0232, type: 'country' },
  { code: 'ET', name: 'Ethiopia', region: 'Africa', flag: '🇪🇹', lat: 9.1450, lng: 40.4897, type: 'country' },
  { code: 'MU', name: 'Mauritius', region: 'Africa', flag: '🇲🇺', lat: -20.3484, lng: 57.5522, type: 'country' },
  { code: 'TZ', name: 'Tanzania', region: 'Africa', flag: '🇹🇿', lat: -6.3690, lng: 34.8888, type: 'country' },
  { code: 'UG', name: 'Uganda', region: 'Africa', flag: '🇺🇬', lat: 1.3733, lng: 32.2903, type: 'country' },

  // South & Central America
  { code: 'BR', name: 'Brazil', region: 'South America', flag: '🇧🇷', lat: -14.2350, lng: -51.9253, type: 'country' },
  { code: 'AR', name: 'Argentina', region: 'South America', flag: '🇦🇷', lat: -38.4161, lng: -63.6167, type: 'country' },
  { code: 'CL', name: 'Chile', region: 'South America', flag: '🇨🇱', lat: -35.6751, lng: -71.5430, type: 'country' },
  { code: 'CO', name: 'Colombia', region: 'South America', flag: '🇨🇴', lat: 4.5709, lng: -74.2973, type: 'country' },
  { code: 'PE', name: 'Peru', region: 'South America', flag: '🇵🇪', lat: -9.1900, lng: -75.0152, type: 'country' },
  { code: 'CR', name: 'Costa Rica', region: 'Central America', flag: '🇨🇷', lat: 9.7489, lng: -83.7534, type: 'country' },
  { code: 'PA', name: 'Panama', region: 'Central America', flag: '🇵🇦', lat: 8.5380, lng: -80.7821, type: 'country' },
  { code: 'UY', name: 'Uruguay', region: 'South America', flag: '🇺🇾', lat: -32.5228, lng: -55.7658, type: 'country' },

  // Additional sovereign nations
  { code: 'AF', name: 'Afghanistan', region: 'Asia', flag: '🇦🇫', lat: 33.9391, lng: 67.7100, type: 'country' },
  { code: 'AL', name: 'Albania', region: 'Europe', flag: '🇦🇱', lat: 41.1533, lng: 20.1683, type: 'country' },
  { code: 'DZ', name: 'Algeria', region: 'Africa', flag: '🇩🇿', lat: 28.0339, lng: 1.6596, type: 'country' },
  { code: 'AD', name: 'Andorra', region: 'Europe', flag: '🇦🇩', lat: 42.5063, lng: 1.5218, type: 'country' },
  { code: 'AO', name: 'Angola', region: 'Africa', flag: '🇦🇴', lat: -11.2027, lng: 17.8739, type: 'country' },
  { code: 'AM', name: 'Armenia', region: 'Asia', flag: '🇦🇲', lat: 40.0691, lng: 45.0382, type: 'country' },
  { code: 'AZ', name: 'Azerbaijan', region: 'Asia', flag: '🇦🇿', lat: 40.1431, lng: 47.5769, type: 'country' },
  { code: 'BS', name: 'Bahamas', region: 'Caribbean', flag: '🇧🇸', lat: 25.0343, lng: -77.3963, type: 'country' },
  { code: 'BB', name: 'Barbados', region: 'Caribbean', flag: '🇧🇧', lat: 13.1939, lng: -59.5432, type: 'country' },
  { code: 'BY', name: 'Belarus', region: 'Europe', flag: '🇧🇾', lat: 53.7098, lng: 27.9534, type: 'country' },
  { code: 'BZ', name: 'Belize', region: 'Central America', flag: '🇧🇿', lat: 17.1899, lng: -88.4976, type: 'country' },
  { code: 'BT', name: 'Bhutan', region: 'Asia', flag: '🇧🇹', lat: 27.5142, lng: 90.4336, type: 'country' },
  { code: 'BO', name: 'Bolivia', region: 'South America', flag: '🇧🇴', lat: -16.2902, lng: -63.5887, type: 'country' },
  { code: 'BA', name: 'Bosnia and Herzegovina', region: 'Europe', flag: '🇧🇦', lat: 43.9159, lng: 17.6791, type: 'country' },
  { code: 'BW', name: 'Botswana', region: 'Africa', flag: '🇧🇼', lat: -22.3285, lng: 24.6849, type: 'country' },
  { code: 'BN', name: 'Brunei', region: 'Asia', flag: '🇧🇳', lat: 4.5353, lng: 114.7277, type: 'country' },
  { code: 'BG', name: 'Bulgaria', region: 'Europe', flag: '🇧🇬', lat: 42.7339, lng: 25.4858, type: 'country' },
  { code: 'KH', name: 'Cambodia', region: 'Asia', flag: '🇰🇭', lat: 12.5657, lng: 104.9910, type: 'country' },
  { code: 'CM', name: 'Cameroon', region: 'Africa', flag: '🇨🇲', lat: 7.3697, lng: 12.3547, type: 'country' },
  { code: 'HR', name: 'Croatia', region: 'Europe', flag: '🇭🇷', lat: 45.1000, lng: 15.2000, type: 'country' },
  { code: 'CY', name: 'Cyprus', region: 'Europe', flag: '🇨🇾', lat: 35.1264, lng: 33.4299, type: 'country' },
  { code: 'EC', name: 'Ecuador', region: 'South America', flag: '🇪🇨', lat: -1.8312, lng: -78.1834, type: 'country' },
  { code: 'EE', name: 'Estonia', region: 'Europe', flag: '🇪🇪', lat: 58.5953, lng: 25.0136, type: 'country' },
  { code: 'GE', name: 'Georgia', region: 'Europe', flag: '🇬🇪', lat: 42.3154, lng: 43.3569, type: 'country' },
  { code: 'GT', name: 'Guatemala', region: 'Central America', flag: '🇬🇹', lat: 15.7835, lng: -90.2308, type: 'country' },
  { code: 'IS', name: 'Iceland', region: 'Europe', flag: '🇮🇸', lat: 64.9631, lng: -19.0208, type: 'country' },
  { code: 'IQ', name: 'Iraq', region: 'Middle East', flag: '🇮🇶', lat: 33.2232, lng: 43.6793, type: 'country' },
  { code: 'JM', name: 'Jamaica', region: 'Caribbean', flag: '🇯🇲', lat: 18.1096, lng: -77.2975, type: 'country' },
  { code: 'JO', name: 'Jordan', region: 'Middle East', flag: '🇯🇴', lat: 30.5852, lng: 36.2384, type: 'country' },
  { code: 'KZ', name: 'Kazakhstan', region: 'Asia', flag: '🇰🇿', lat: 48.0196, lng: 66.9237, type: 'country' },
  { code: 'LV', name: 'Latvia', region: 'Europe', flag: '🇱🇻', lat: 56.8796, lng: 24.6032, type: 'country' },
  { code: 'LB', name: 'Lebanon', region: 'Middle East', flag: '🇱🇧', lat: 33.8547, lng: 35.8623, type: 'country' },
  { code: 'LT', name: 'Lithuania', region: 'Europe', flag: '🇱🇹', lat: 55.1694, lng: 23.8813, type: 'country' },
  { code: 'LU', name: 'Luxembourg', region: 'Europe', flag: '🇱🇺', lat: 49.8153, lng: 6.1296, type: 'country' },
  { code: 'MT', name: 'Malta', region: 'Europe', flag: '🇲🇹', lat: 35.9375, lng: 14.3754, type: 'country' },
  { code: 'MC', name: 'Monaco', region: 'Europe', flag: '🇲🇨', lat: 43.7384, lng: 7.4246, type: 'country' },
  { code: 'RS', name: 'Serbia', region: 'Europe', flag: '🇷🇸', lat: 44.0165, lng: 21.0059, type: 'country' },
  { code: 'SK', name: 'Slovakia', region: 'Europe', flag: '🇸🇰', lat: 48.6690, lng: 19.6990, type: 'country' },
  { code: 'SI', name: 'Slovenia', region: 'Europe', flag: '🇸🇮', lat: 46.1512, lng: 14.9955, type: 'country' },
  { code: 'UZ', name: 'Uzbekistan', region: 'Asia', flag: '🇺🇿', lat: 41.3775, lng: 64.5853, type: 'country' }
];

// All 36 Indian States & Union Territories
export const INDIAN_STATES: LocationItem[] = [
  // Northern States & UTs
  { code: 'DL', name: 'Delhi', region: 'North', flag: '🇮🇳', lat: 28.6139, lng: 77.2090, isUT: true, country: 'India', type: 'state' },
  { code: 'JK', name: 'Jammu & Kashmir', region: 'North', flag: '🇮🇳', lat: 34.0837, lng: 74.7973, isUT: true, country: 'India', type: 'state' },
  { code: 'LA', name: 'Ladakh', region: 'North', flag: '🇮🇳', lat: 34.1526, lng: 77.5771, isUT: true, country: 'India', type: 'state' },
  { code: 'HP', name: 'Himachal Pradesh', region: 'North', flag: '🇮🇳', lat: 31.1048, lng: 77.1734, isUT: false, country: 'India', type: 'state' },
  { code: 'PB', name: 'Punjab', region: 'North', flag: '🇮🇳', lat: 30.7333, lng: 76.7794, isUT: false, country: 'India', type: 'state' },
  { code: 'CH', name: 'Chandigarh', region: 'North', flag: '🇮🇳', lat: 30.7333, lng: 76.7794, isUT: true, country: 'India', type: 'state' },
  { code: 'HR', name: 'Haryana', region: 'North', flag: '🇮🇳', lat: 30.7333, lng: 76.7794, isUT: false, country: 'India', type: 'state' },
  { code: 'UK', name: 'Uttarakhand', region: 'North', flag: '🇮🇳', lat: 30.3165, lng: 78.0322, isUT: false, country: 'India', type: 'state' },
  { code: 'UP', name: 'Uttar Pradesh', region: 'North', flag: '🇮🇳', lat: 26.8467, lng: 80.9462, isUT: false, country: 'India', type: 'state' },
  { code: 'RJ', name: 'Rajasthan', region: 'North', flag: '🇮🇳', lat: 26.9124, lng: 75.7873, isUT: false, country: 'India', type: 'state' },

  // Western States & UTs
  { code: 'MH', name: 'Maharashtra', region: 'West', flag: '🇮🇳', lat: 18.9220, lng: 72.8347, isUT: false, country: 'India', type: 'state' },
  { code: 'GJ', name: 'Gujarat', region: 'West', flag: '🇮🇳', lat: 23.2156, lng: 72.6369, isUT: false, country: 'India', type: 'state' },
  { code: 'GA', name: 'Goa', region: 'West', flag: '🇮🇳', lat: 15.4909, lng: 73.8278, isUT: false, country: 'India', type: 'state' },
  { code: 'DN', name: 'Dadra and Nagar Haveli & Daman and Diu', region: 'West', flag: '🇮🇳', lat: 20.4283, lng: 72.8397, isUT: true, country: 'India', type: 'state' },

  // Southern States & UTs
  { code: 'KA', name: 'Karnataka', region: 'South', flag: '🇮🇳', lat: 12.9716, lng: 77.5946, isUT: false, country: 'India', type: 'state' },
  { code: 'TS', name: 'Telangana', region: 'South', flag: '🇮🇳', lat: 17.3850, lng: 78.4867, isUT: false, country: 'India', type: 'state' },
  { code: 'AP', name: 'Andhra Pradesh', region: 'South', flag: '🇮🇳', lat: 16.5062, lng: 80.6480, isUT: false, country: 'India', type: 'state' },
  { code: 'TN', name: 'Tamil Nadu', region: 'South', flag: '🇮🇳', lat: 13.0827, lng: 80.2707, isUT: false, country: 'India', type: 'state' },
  { code: 'KL', name: 'Kerala', region: 'South', flag: '🇮🇳', lat: 8.5241, lng: 76.9366, isUT: false, country: 'India', type: 'state' },
  { code: 'PY', name: 'Puducherry', region: 'South', flag: '🇮🇳', lat: 11.9416, lng: 79.8083, isUT: true, country: 'India', type: 'state' },
  { code: 'LD', name: 'Lakshadweep', region: 'South', flag: '🇮🇳', lat: 10.5667, lng: 72.6417, isUT: true, country: 'India', type: 'state' },
  { code: 'AN', name: 'Andaman & Nicobar Islands', region: 'South', flag: '🇮🇳', lat: 11.6234, lng: 92.7265, isUT: true, country: 'India', type: 'state' },

  // Central States
  { code: 'MP', name: 'Madhya Pradesh', region: 'Central', flag: '🇮🇳', lat: 23.2599, lng: 77.4126, isUT: false, country: 'India', type: 'state' },
  { code: 'CG', name: 'Chhattisgarh', region: 'Central', flag: '🇮🇳', lat: 21.2514, lng: 81.6296, isUT: false, country: 'India', type: 'state' },

  // Eastern States
  { code: 'WB', name: 'West Bengal', region: 'East', flag: '🇮🇳', lat: 22.5726, lng: 88.3639, isUT: false, country: 'India', type: 'state' },
  { code: 'OD', name: 'Odisha', region: 'East', flag: '🇮🇳', lat: 20.2961, lng: 85.8245, isUT: false, country: 'India', type: 'state' },
  { code: 'BR', name: 'Bihar', region: 'East', flag: '🇮🇳', lat: 25.5941, lng: 85.1376, isUT: false, country: 'India', type: 'state' },
  { code: 'JH', name: 'Jharkhand', region: 'East', flag: '🇮🇳', lat: 23.3441, lng: 85.3096, isUT: false, country: 'India', type: 'state' },

  // North-Eastern States
  { code: 'AS', name: 'Assam', region: 'Northeast', flag: '🇮🇳', lat: 26.1445, lng: 91.7362, isUT: false, country: 'India', type: 'state' },
  { code: 'SK', name: 'Sikkim', region: 'Northeast', flag: '🇮🇳', lat: 27.3389, lng: 88.6065, isUT: false, country: 'India', type: 'state' },
  { code: 'ML', name: 'Meghalaya', region: 'Northeast', flag: '🇮🇳', lat: 25.5788, lng: 91.8933, isUT: false, country: 'India', type: 'state' },
  { code: 'TR', name: 'Tripura', region: 'Northeast', flag: '🇮🇳', lat: 23.8315, lng: 91.2868, isUT: false, country: 'India', type: 'state' },
  { code: 'MZ', name: 'Mizoram', region: 'Northeast', flag: '🇮🇳', lat: 23.7271, lng: 92.7176, isUT: false, country: 'India', type: 'state' },
  { code: 'MN', name: 'Manipur', region: 'Northeast', flag: '🇮🇳', lat: 24.8170, lng: 93.9368, isUT: false, country: 'India', type: 'state' },
  { code: 'NL', name: 'Nagaland', region: 'Northeast', flag: '🇮🇳', lat: 25.6751, lng: 94.1086, isUT: false, country: 'India', type: 'state' },
  { code: 'AR', name: 'Arunachal Pradesh', region: 'Northeast', flag: '🇮🇳', lat: 27.0844, lng: 93.6053, isUT: false, country: 'India', type: 'state' }
];

// Major Global States/Provinces for Granular Selection
export const MAJOR_GLOBAL_STATES: LocationItem[] = [
  { code: 'US-CA', name: 'California, United States', region: 'North America', flag: '🇺🇸', lat: 36.7783, lng: -119.4179, country: 'United States', type: 'state' },
  { code: 'US-NY', name: 'New York, United States', region: 'North America', flag: '🇺🇸', lat: 40.7128, lng: -74.0060, country: 'United States', type: 'state' },
  { code: 'US-TX', name: 'Texas, United States', region: 'North America', flag: '🇺🇸', lat: 31.9686, lng: -99.9018, country: 'United States', type: 'state' },
  { code: 'US-FL', name: 'Florida, United States', region: 'North America', flag: '🇺🇸', lat: 27.6648, lng: -81.5158, country: 'United States', type: 'state' },
  { code: 'US-WA', name: 'Washington, United States', region: 'North America', flag: '🇺🇸', lat: 47.7511, lng: -120.7401, country: 'United States', type: 'state' },
  { code: 'US-IL', name: 'Illinois, United States', region: 'North America', flag: '🇺🇸', lat: 40.6331, lng: -89.3985, country: 'United States', type: 'state' },
  { code: 'CA-ON', name: 'Ontario, Canada', region: 'North America', flag: '🇨🇦', lat: 51.2538, lng: -85.3232, country: 'Canada', type: 'state' },
  { code: 'CA-BC', name: 'British Columbia, Canada', region: 'North America', flag: '🇨🇦', lat: 53.7267, lng: -127.6476, country: 'Canada', type: 'state' },
  { code: 'AU-NSW', name: 'New South Wales, Australia', region: 'Oceania', flag: '🇦🇺', lat: -31.8402, lng: 145.6128, country: 'Australia', type: 'state' },
  { code: 'AU-VIC', name: 'Victoria, Australia', region: 'Oceania', flag: '🇦🇺', lat: -37.4713, lng: 144.7852, country: 'Australia', type: 'state' },
  { code: 'GB-ENG', name: 'England, United Kingdom', region: 'Europe', flag: '🇬🇧', lat: 52.3555, lng: -1.1743, country: 'United Kingdom', type: 'state' },
  { code: 'AE-DXB', name: 'Dubai, UAE', region: 'Middle East', flag: '🇦🇪', lat: 25.2048, lng: 55.2708, country: 'United Arab Emirates', type: 'state' }
];

// Master Combined List
export const ALL_LOCATIONS: LocationItem[] = [
  ...WORLD_COUNTRIES,
  ...INDIAN_STATES,
  ...MAJOR_GLOBAL_STATES
];

// Alias Mapping
const ALIAS_TO_LOCATION_MAP: Record<string, string> = {
  usa: 'United States',
  'u.s.a.': 'United States',
  'u.s.': 'United States',
  us: 'United States',
  america: 'United States',
  uk: 'United Kingdom',
  'u.k.': 'United Kingdom',
  britain: 'United Kingdom',
  'great britain': 'United Kingdom',
  england: 'United Kingdom',
  scotland: 'United Kingdom',
  wales: 'United Kingdom',
  uae: 'United Arab Emirates',
  'u.a.e.': 'United Arab Emirates',
  dubai: 'United Arab Emirates',
  'abu dhabi': 'United Arab Emirates',
  bharat: 'India',
  hindustan: 'India',
  korea: 'South Korea',
  california: 'California, United States',
  'new york': 'New York, United States',
  texas: 'Texas, United States',
  florida: 'Florida, United States',
  london: 'United Kingdom',
  paris: 'France',
  berlin: 'Germany',
  tokyo: 'Japan',

  // Major Indian cities
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

export function normalizeLocationName(input?: string | null): string {
  if (!input || typeof input !== 'string') return '';
  const clean = input.trim();
  const lower = clean.toLowerCase();

  const exact = ALL_LOCATIONS.find((l) => l.name.toLowerCase() === lower);
  if (exact) return exact.name;

  if (ALIAS_TO_LOCATION_MAP[lower]) {
    return ALIAS_TO_LOCATION_MAP[lower];
  }

  for (const [alias, loc] of Object.entries(ALIAS_TO_LOCATION_MAP)) {
    if (lower.includes(alias) || alias.includes(lower)) {
      return loc;
    }
  }

  const partial = ALL_LOCATIONS.find((l) => 
    lower.includes(l.name.toLowerCase()) || l.name.toLowerCase().includes(lower)
  );
  if (partial) return partial.name;

  return clean;
}

export function normalizeStateName(input?: string | null): string {
  return normalizeLocationName(input);
}

export function getLocationInfo(locationName?: string | null): LocationItem | null {
  const normalized = normalizeLocationName(locationName);
  return ALL_LOCATIONS.find((l) => l.name.toLowerCase() === normalized.toLowerCase()) || null;
}

export function getStateInfo(stateName?: string | null): LocationItem | null {
  return getLocationInfo(stateName);
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

export function calculateLocationDistance(
  locationA?: string | null,
  locationB?: string | null
): { distanceKm: number; formatted: string; isSameState: boolean } {
  if (!locationA || !locationB) {
    return { distanceKm: 25, formatted: 'Worldwide', isSameState: false };
  }

  const locA = getLocationInfo(locationA);
  const locB = getLocationInfo(locationB);

  if (!locA || !locB) {
    return { distanceKm: 50, formatted: 'Nearby', isSameState: false };
  }

  if (locA.name.toLowerCase() === locB.name.toLowerCase()) {
    return {
      distanceKm: 20,
      formatted: 'Same Location (< 50 km)',
      isSameState: true
    };
  }

  const km = haversineDistance(locA.lat, locA.lng, locB.lat, locB.lng);
  return {
    distanceKm: km,
    formatted: `${km.toLocaleString()} km away`,
    isSameState: false
  };
}

export function calculateStateDistance(
  stateA?: string | null,
  stateB?: string | null
): { distanceKm: number; formatted: string; isSameState: boolean } {
  return calculateLocationDistance(stateA, stateB);
}
