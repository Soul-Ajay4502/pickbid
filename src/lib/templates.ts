export interface CardTemplate {
  id: string;
  name: string;
  /** Card background (dark solid or very subtle gradient) */
  rootBg: string;
  /** Primary accent color – used for border, badges, dividers */
  borderColor: string;
  /** "R,G,B" string for rgba() helper */
  accentRgb: string;
  /** Color for the role / award text line */
  awardColor: string;
  /** Gradient shown in the template picker swatch */
  previewGradient: string;
}

export const CARD_TEMPLATES: CardTemplate[] = [
  {
    id: 'classic-green',
    name: 'Classic Green',
    rootBg: '#0d2218',
    borderColor: '#d4a017',
    accentRgb: '212,160,23',
    awardColor: '#f0c040',
    previewGradient: 'linear-gradient(135deg, #0d2218 0%, #1a3a2a 100%)',
  },
  {
    id: 'fiery-ember',
    name: 'Fiery Ember',
    rootBg: '#1c0500',
    borderColor: '#f97316',
    accentRgb: '249,115,22',
    awardColor: '#fb923c',
    previewGradient: 'linear-gradient(135deg, #1c0500 0%, #7f1d1d 100%)',
  },
  {
    id: 'ocean-deep',
    name: 'Ocean Deep',
    rootBg: '#0a1e38',
    borderColor: '#38bdf8',
    accentRgb: '56,189,248',
    awardColor: '#7dd3fc',
    previewGradient: 'linear-gradient(135deg, #0a1e38 0%, #164e63 100%)',
  },
  {
    id: 'golden-royale',
    name: 'Golden Royale',
    rootBg: '#080808',
    borderColor: '#ffd700',
    accentRgb: '255,215,0',
    awardColor: '#ffe55c',
    previewGradient: 'linear-gradient(135deg, #080808 0%, #1c1800 100%)',
  },
  {
    id: 'sunset-dusk',
    name: 'Sunset Dusk',
    rootBg: '#1a0d3d',
    borderColor: '#f472b6',
    accentRgb: '244,114,182',
    awardColor: '#fb923c',
    previewGradient: 'linear-gradient(135deg, #2d1b69 0%, #c2410c 100%)',
  },
  {
    id: 'steel-pro',
    name: 'Steel Pro',
    rootBg: '#111827',
    borderColor: '#94a3b8',
    accentRgb: '148,163,184',
    awardColor: '#cbd5e1',
    previewGradient: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
  },
  {
    id: 'emerald-lime',
    name: 'Emerald Lime',
    rootBg: '#031a0d',
    borderColor: '#4ade80',
    accentRgb: '74,222,128',
    awardColor: '#a3e635',
    previewGradient: 'linear-gradient(135deg, #052e16 0%, #166534 100%)',
  },
  {
    id: 'royal-violet',
    name: 'Royal Violet',
    rootBg: '#110023',
    borderColor: '#c4b5fd',
    accentRgb: '196,181,253',
    awardColor: '#e9d5ff',
    previewGradient: 'linear-gradient(135deg, #1e0038 0%, #4c1d95 100%)',
  },
  {
    id: 'desert-gold',
    name: 'Desert Gold',
    rootBg: '#1a0e00',
    borderColor: '#fbbf24',
    accentRgb: '251,191,36',
    awardColor: '#fcd34d',
    previewGradient: 'linear-gradient(135deg, #2c1700 0%, #78350f 100%)',
  },
  {
    id: 'night-sky',
    name: 'Night Sky',
    rootBg: '#000814',
    borderColor: '#60a5fa',
    accentRgb: '96,165,250',
    awardColor: '#93c5fd',
    previewGradient: 'linear-gradient(135deg, #000814 0%, #001d3d 100%)',
  },
  {
    id: 'rose-gold',
    name: 'Rose Gold',
    rootBg: '#1a000e',
    borderColor: '#f9a8d4',
    accentRgb: '249,168,212',
    awardColor: '#fda4af',
    previewGradient: 'linear-gradient(135deg, #2d0017 0%, #831843 100%)',
  },
  {
    id: 'arctic-ice',
    name: 'Arctic Ice',
    rootBg: '#08101f',
    borderColor: '#bae6fd',
    accentRgb: '186,230,253',
    awardColor: '#e0f2fe',
    previewGradient: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
  },
];

export const DEFAULT_TEMPLATE_ID = 'classic-green';

export function getTemplate(id: string): CardTemplate {
  return CARD_TEMPLATES.find((t) => t.id === id) ?? CARD_TEMPLATES[0];
}
