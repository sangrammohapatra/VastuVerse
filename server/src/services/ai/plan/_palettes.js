/**
 * Curated colour palettes by interior style. Three options per style so the
 * user always sees a meaningful comparison. Each palette is 4 hex codes
 * (primary, secondary, accent, neutral) ordered for swatch display.
 *
 * Real provider calls fall back to this when the LLM doesn't return parseable
 * JSON or when no API key is configured.
 */

const PALETTES_BY_STYLE = {
  modern: [
    { id: 'mod-1', name: 'Coastal Calm',     colors: ['#1A3A5C', '#5B8AB9', '#F0F4F8', '#D4A85C'], description: 'Cool blues with a warm brass accent.' },
    { id: 'mod-2', name: 'Misty Slate',      colors: ['#2F3E46', '#84A98C', '#CAD2C5', '#E9C46A'], description: 'Slate with sage and muted gold.' },
    { id: 'mod-3', name: 'Indigo Whisper',   colors: ['#1F2A44', '#3E5C76', '#E6E2D3', '#C75B12'], description: 'Deep indigo grounded by terracotta.' },
  ],
  minimalist: [
    { id: 'min-1', name: 'Pure White',       colors: ['#FFFFFF', '#F4F4F4', '#222222', '#C2A878'], description: 'White on white, a single oak accent.' },
    { id: 'min-2', name: 'Soft Ash',         colors: ['#F5F1EB', '#D4CFC6', '#2B2B2B', '#9B7B57'], description: 'Warm off-white with leather tone.' },
    { id: 'min-3', name: 'Monochrome Olive', colors: ['#EFEEE8', '#C2C0B2', '#3A3A33', '#7A8552'], description: 'Olive grounding a soft monochrome.' },
  ],
  traditional: [
    { id: 'trad-1', name: 'Royal Maroon',    colors: ['#7B1E1E', '#C49A3F', '#F5E5C1', '#3A2B1F'], description: 'Maroon and gold over warm ivory.' },
    { id: 'trad-2', name: 'Terracotta Earth',colors: ['#A0522D', '#D2B48C', '#FFF8E7', '#4E342E'], description: 'Earthy terracotta on cream.' },
    { id: 'trad-3', name: 'Peacock & Brass', colors: ['#0F4C5C', '#E36414', '#FFF5D6', '#3A2C1A'], description: 'Peacock teal with brass warmth.' },
  ],
  contemporary: [
    { id: 'con-1', name: 'Charcoal Bloom',   colors: ['#1B1B1B', '#6C757D', '#F0EAD6', '#C75B12'], description: 'Charcoal with a saffron pop.' },
    { id: 'con-2', name: 'Powder Bold',      colors: ['#2E3138', '#A8DADC', '#F1FAEE', '#E63946'], description: 'Cool neutrals against bold red.' },
    { id: 'con-3', name: 'Smoked Cream',     colors: ['#3D405B', '#81B29A', '#F2CC8F', '#F4F1DE'], description: 'Cream led with smoky teal.' },
  ],
  industrial: [
    { id: 'ind-1', name: 'Brick & Copper',   colors: ['#3D2B1F', '#B85C38', '#D8D2C2', '#1F1F1F'], description: 'Exposed brick warmed by copper.' },
    { id: 'ind-2', name: 'Concrete Gray',    colors: ['#2F2F2F', '#6B6B6B', '#D9CFC0', '#B85C38'], description: 'Concrete tones with a rust accent.' },
    { id: 'ind-3', name: 'Iron & Olive',     colors: ['#202020', '#4D5D53', '#C8B79A', '#A04E2C'], description: 'Iron grey with olive and rust.' },
  ],
  'indo-colonial': [
    { id: 'col-1', name: 'Navy & Mustard',   colors: ['#1B365D', '#D4A017', '#F5F0E1', '#5C2E1A'], description: 'Navy and mustard on cream.' },
    { id: 'col-2', name: 'Teakwood & Sage',  colors: ['#5C3A21', '#A8B5A0', '#FAF3E0', '#1F3C26'], description: 'Teak browns warmed by sage.' },
    { id: 'col-3', name: 'Ivory & Burgundy', colors: ['#7B1E3A', '#C9A66B', '#FAF5E8', '#2E2E2E'], description: 'Ivory grounded by deep burgundy.' },
  ],
};

function computeColorPalettes({ style = 'modern', vastuEnabled = false } = {}) {
  const base = PALETTES_BY_STYLE[style] || PALETTES_BY_STYLE.modern;
  // For vastu-conscious users, add a small note encouraging east/north-light colours.
  // We don't change palette content here — recommendations layer applies elsewhere.
  const notes = vastuEnabled
    ? ['Lighter accents on north/east walls amplify positive energy (Vastu).']
    : [];

  return {
    style,
    palettes: base,
    notes,
  };
}

module.exports = { computeColorPalettes, PALETTES_BY_STYLE };
