/**
 * Image-prompt composer for interior + exterior renders.
 *
 * Each room kind / facade style gets carefully chosen modifier phrases so
 * Pollinations / DALL-E produces a coherent Indian-context render rather
 * than a generic stock image. The prompt is kept under ~700 chars to fit
 * comfortably inside provider rate limits.
 *
 * Public API:
 *   buildInteriorPrompt({ room, style, palette, vastuEnabled, cityState })
 *   buildExteriorPrompt({ side, facadeStyle, roofType, boundaryWall, mainGate,
 *                          driveway, landscaping, vastuEnabled, cityState })
 */

const STYLE_PHRASES = {
  modern:          'modern minimalist Indian interior, clean lines, large windows',
  minimalist:      'minimalist interior with negative space, soft white walls, monochrome accents',
  traditional:     'traditional Indian interior with carved teak wood, brass fittings, jali patterns',
  contemporary:    'contemporary Indian interior, neutral palette, statement lighting',
  industrial:      'industrial Indian loft style, exposed brick, metal beams, concrete floor',
  'indo-colonial': 'Indo-colonial interior, high ceilings, arched doorways, rattan furniture, vintage fans',
};

const ROOM_PHRASES = {
  bedroom:          'master bedroom with king bed, soft natural lighting, side tables, ambient warm light',
  bathroomAttached: 'attached bathroom, walk-in shower, wall-mounted vanity, white marble, brass tapware',
  bathroomCommon:   'common bathroom, ceramic tiles, glass shower partition, well-lit vanity',
  kitchen:          'Indian kitchen with modular cabinets, granite or quartz counters, masala storage, exhaust chimney',
  living:           'Indian living room with sectional sofa, coffee table, brass artefacts, indoor plants',
  dining:           'dining area with 6-seater wooden table, pendant lighting, sideboard',
  pooja:            'Hindu pooja room with carved wooden mandir, brass diyas, mosaic tile floor, soft golden light',
  study:            'home study with built-in bookshelf, ergonomic chair, desk lamp, large window',
  garage:           'private garage with epoxy floor, storage cabinets, single car space',
  servant:          'compact servant quarters with single bed, ventilation, modest furnishing',
  storage:          'storage room with floor-to-ceiling shelving, neatly organised',
  balcony:          'covered balcony overlooking Indian neighbourhood, potted plants, railing',
  staircase:        'wooden staircase with wrought-iron balustrade, wall-mounted lights',
  terrace:          'rooftop terrace with potted plants, evening city view, soft lights',
};

const FACADE_PHRASES = {
  contemporary:    'contemporary Indian house facade, large glass panes, mixed-material cladding',
  colonial:        'Indo-colonial bungalow facade, columns, arched windows, sloping clay-tile roof',
  modern:          'modern minimalist house facade, flat roof, clean horizontal lines, neutral colours',
  minimalist:      'minimalist house exterior, white walls, slender window frames, geometric form',
  traditional:     'traditional Indian house facade, jharokha balcony, ornamental cornice, terracotta tones',
};

const ROOF_PHRASES = {
  flat:             'flat concrete roof with parapet',
  sloped:           'gently sloped sheet roof',
  'mangalore-tile': 'sloped roof finished in Mangalore terracotta tiles',
  metal:            'standing-seam metal roof',
};

const SIDE_PHRASES = {
  front: 'front elevation, viewed straight on, low evening sun, slight 3-point perspective',
  left:  'left-side elevation, three-quarter angle, daylight, showing balcony and side fenestration',
  right: 'right-side elevation, three-quarter angle, soft afternoon light',
};

const DRIVEWAY_MATERIAL = {
  concrete:  'stamped concrete driveway',
  pavers:    'cement-paver block driveway',
  stone:     'natural stone driveway',
  gravel:    'gravel driveway with stone edging',
};

const LANDSCAPING_PHRASES = {
  lawn:           'manicured front lawn',
  garden:         'tropical flowering garden with hibiscus and bougainvillea',
  trees:          'mature shade trees (neem, gulmohar)',
  'water-feature':'compact water feature with stone basin',
};

/* ── Helpers ────────────────────────────────────────────────────────── */

function citySuffix(cityState) {
  if (!cityState) return '';
  const c = cityState.city ? `${cityState.city}, ` : '';
  return ` Setting: ${c}${cityState.state || 'India'}.`;
}

function paletteSuffix(palette) {
  if (!palette || !Array.isArray(palette.colors) || palette.colors.length === 0) return '';
  return ` Colour palette: ${palette.colors.slice(0, 4).join(', ')}.`;
}

function vastuSuffix(vastuEnabled, kind) {
  if (!vastuEnabled) return '';
  if (kind === 'kitchen') return ' Vastu-aligned cooking station facing east.';
  if (kind === 'pooja') return ' Idols facing east, north-east-corner placement.';
  if (kind === 'bedroom') return ' Bed-head facing south as per Vastu.';
  return '';
}

/* ── Interior ───────────────────────────────────────────────────────── */

function buildInteriorPrompt({ room = {}, style = 'modern', palette, vastuEnabled = false, cityState } = {}) {
  const stylePhrase = STYLE_PHRASES[style] || STYLE_PHRASES.modern;
  const roomPhrase  = ROOM_PHRASES[room.kind] || 'interior room with tasteful Indian furnishings';
  const dim = (room.w && room.h) ? ` Approx ${room.w}×${room.h} feet.` : '';

  return [
    'Photorealistic architectural visualisation, 4k, soft natural light, dslr camera, 35mm lens.',
    stylePhrase + '.',
    roomPhrase + '.' + dim,
    paletteSuffix(palette),
    vastuSuffix(vastuEnabled, room.kind),
    citySuffix(cityState),
    'No people, no text overlays, no watermarks.',
  ].join(' ').replace(/\s+/g, ' ').trim();
}

/* ── Exterior ───────────────────────────────────────────────────────── */

function buildExteriorPrompt({
  side = 'front',
  facadeStyle = 'contemporary',
  roofType,
  boundaryWall,
  mainGate,
  driveway,
  landscaping = [],
  vastuEnabled = false,
  cityState,
} = {}) {
  const facade = FACADE_PHRASES[facadeStyle] || FACADE_PHRASES.contemporary;
  const roof = ROOF_PHRASES[roofType] || '';
  const sideClause = SIDE_PHRASES[side] || SIDE_PHRASES.front;

  const features = [];
  if (boundaryWall) features.push(`${boundaryWall} boundary wall`);
  if (mainGate) features.push(`${mainGate} main gate`);
  if (driveway?.enabled) {
    const mat = DRIVEWAY_MATERIAL[driveway.material] || 'paved driveway';
    features.push(mat);
  }
  landscaping.forEach((id) => {
    if (LANDSCAPING_PHRASES[id]) features.push(LANDSCAPING_PHRASES[id]);
  });

  const vastu = vastuEnabled ? ' Auspicious entrance aligned per Vastu.' : '';

  return [
    'Photorealistic architectural rendering, 4k, soft evening light, dslr camera, 24mm lens.',
    facade + '.',
    roof ? roof + '.' : '',
    sideClause + '.',
    features.length ? `Includes ${features.join(', ')}.` : '',
    vastu,
    citySuffix(cityState),
    'No people, no text overlays, no watermarks.',
  ].join(' ').replace(/\s+/g, ' ').trim();
}

/* ── Bird's-eye 3D view ─────────────────────────────────────────────── */

function buildBirdEyePrompt({
  facadeStyle = 'contemporary',
  roofType,
  boundaryWall,
  mainGate,
  driveway,
  landscaping = [],
  plotW,
  plotH,
  floors = 1,
  vastuEnabled = false,
  cityState,
} = {}) {
  const facade = FACADE_PHRASES[facadeStyle] || FACADE_PHRASES.contemporary;
  const roof = ROOF_PHRASES[roofType] || '';
  const dim = (plotW && plotH) ? ` Plot ${plotW}×${plotH} ft, ${floors}-storey.` : '';

  const features = [];
  if (boundaryWall) features.push(`${boundaryWall} boundary wall`);
  if (mainGate)     features.push(`${mainGate} main gate`);
  if (driveway?.enabled) {
    const mat = DRIVEWAY_MATERIAL[driveway.material] || 'paved driveway';
    features.push(mat);
  }
  landscaping.forEach((id) => {
    if (LANDSCAPING_PHRASES[id]) features.push(LANDSCAPING_PHRASES[id]);
  });

  const vastu = vastuEnabled ? ' North arrow visible at top-right.' : '';

  return [
    'Photorealistic bird\'s-eye view, top-down aerial rendering, soft daylight,',
    'tilt-shift composition, drone perspective from ~120 ft altitude, 4k detail.',
    facade + '.',
    roof ? roof + '.' : '',
    dim,
    features.length ? `Plot includes ${features.join(', ')}.` : '',
    vastu,
    citySuffix(cityState),
    'No people, no text overlays, no watermarks.',
  ].join(' ').replace(/\s+/g, ' ').trim();
}

module.exports = {
  buildInteriorPrompt,
  buildExteriorPrompt,
  buildBirdEyePrompt,
  STYLE_PHRASES,
  FACADE_PHRASES,
};