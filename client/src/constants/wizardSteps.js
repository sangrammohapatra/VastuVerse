/**
 * Source of truth for the 10-step plan wizard.
 * Used by the stepper header, the wizard router, and (later) each step page.
 */

export const WIZARD_STEPS = [
  { id: 1,  key: 'step1',  label: 'Land & Structure', icon: '📐' },
  { id: 2,  key: 'step2',  label: 'Room Planning',    icon: '🛏️' },
  { id: 3,  key: 'step3',  label: 'Floor Plan',       icon: '🗺️' },
  { id: 4,  key: 'step4',  label: 'Interior',         icon: '🛋️' },
  { id: 5,  key: 'step5',  label: 'Exterior',         icon: '🏠' },
  { id: 6,  key: 'step6',  label: 'Utilities',        icon: '🔌' },
  { id: 7,  key: 'step7',  label: 'Cost Estimate',    icon: '💰' },
  { id: 8,  key: 'step8',  label: '3D View',          icon: '🎮' },
  { id: 9,  key: 'step9',  label: 'Municipal Docs',   icon: '🏛️' },
  { id: 10, key: 'step10', label: 'Review & Export',  icon: '✅' },
];

export const TOTAL_STEPS = WIZARD_STEPS.length;

export const FACING_DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export const PLOT_SHAPES = [
  { id: 'rectangular', label: 'Rectangular', desc: 'Standard 4-corner plot' },
  { id: 'L-shaped',    label: 'L-shaped',    desc: '6-corner irregular' },
  { id: 'corner',      label: 'Corner',      desc: '2-side road access' },
  { id: 'irregular',   label: 'Irregular',   desc: 'Upload photo or draw' },
];

export const AREA_UNITS = [
  { value: 'sqft', label: 'sq ft' },
  { value: 'sqm',  label: 'sq m' },
];
