// Indian states + UTs and shared onboarding option sets.
// Used by the role-specific onboarding forms (Select + multi-Select).

export const INDIAN_STATES = [
  // States
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  // Union Territories
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
];

export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'हिन्दी (Hindi)' },
  { code: 'bn', name: 'বাংলা (Bengali)' },
  { code: 'ta', name: 'தமிழ் (Tamil)' },
  { code: 'te', name: 'తెలుగు (Telugu)' },
  { code: 'mr', name: 'मराठी (Marathi)' },
  { code: 'gu', name: 'ગુજરાતી (Gujarati)' },
  { code: 'kn', name: 'ಕನ್ನಡ (Kannada)' },
];

export const PROJECT_TYPES = [
  'Residential',
  'Commercial',
  'Mixed-use',
  'Affordable Housing',
  'Luxury Villas',
  'Plotted Development',
  'Township',
  'Industrial',
];

export const TEAM_SIZES = ['1-10', '11-50', '51-200', '201-500', '500+'];

export const PLOT_OWNERSHIP_OPTIONS = [
  { value: 'owned', label: 'Own' },
  { value: 'rented', label: 'Rented' },
  { value: 'prospective', label: 'Prospective Buyer' },
];

// 15-char GSTIN format
export const GSTIN_RE =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

// CoA: e.g. "CA12345/2024" — 4-6 alphanumeric, slash, 4-digit year
export const COA_RE = /^[A-Z0-9]{4,6}\/[0-9]{4}$/i;

export const PHONE_RE = /^\+?[0-9]{10,15}$/;
