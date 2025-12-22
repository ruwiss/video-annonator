// ============================================
// SHAPE PRESETS - Simplified, no duplicates
// ============================================

export interface ShapePreset {
  id: string;
  name: string;
  icon: string;
  style: {
    strokeWidth?: number;
    strokeDashArray?: number[];
  };
}

export const ARROW_PRESETS: ShapePreset[] = [
  { id: 'arrow-simple', name: 'Solid', icon: '→', style: {} },
  { id: 'arrow-dashed', name: 'Dashed', icon: '⇢', style: { strokeDashArray: [8, 4] } },
  { id: 'arrow-dotted', name: 'Dotted', icon: '·→', style: { strokeDashArray: [3, 3] } },
  { id: 'arrow-double', name: 'Double', icon: '↔', style: {} },
  { id: 'arrow-curved', name: 'Curved', icon: '↪', style: {} },
];

export const LINE_PRESETS: ShapePreset[] = [
  { id: 'line-solid', name: 'Solid', icon: '—', style: { strokeWidth: 3 } },
  { id: 'line-thick', name: 'Thick', icon: '━', style: { strokeWidth: 6 } },
  { id: 'line-dashed', name: 'Dashed', icon: '┄', style: { strokeWidth: 3, strokeDashArray: [10, 5] } },
  { id: 'line-dotted', name: 'Dotted', icon: '┈', style: { strokeWidth: 3, strokeDashArray: [3, 3] } },
];

// ============================================
// FONT PRESETS (fallback when system fonts unavailable)
// ============================================

export interface FontPreset {
  id: string;
  name: string;
  fontFamily: string;
}

export const FONT_PRESETS: FontPreset[] = [
  { id: 'arial', name: 'Arial', fontFamily: 'Arial' },
  { id: 'helvetica', name: 'Helvetica', fontFamily: 'Helvetica' },
  { id: 'times', name: 'Times New Roman', fontFamily: 'Times New Roman' },
  { id: 'georgia', name: 'Georgia', fontFamily: 'Georgia' },
  { id: 'verdana', name: 'Verdana', fontFamily: 'Verdana' },
];

// ============================================
// MARKER STYLES - Width/opacity only, color from user
// ============================================

export interface MarkerPreset {
  id: string;
  name: string;
  width: number;
  opacity: number;
}

export const MARKER_PRESETS: MarkerPreset[] = [
  { id: 'marker-thin', name: 'Thin', width: 8, opacity: 0.5 },
  { id: 'marker-medium', name: 'Medium', width: 16, opacity: 0.4 },
  { id: 'marker-thick', name: 'Thick', width: 24, opacity: 0.35 },
  { id: 'marker-extra', name: 'Extra', width: 32, opacity: 0.3 },
];

// ============================================
// BLUR STYLES
// ============================================

export interface BlurPreset {
  id: string;
  name: string;
  type: 'blur' | 'pixelate' | 'mosaic';
  intensity: number;
}

export const BLUR_PRESETS: BlurPreset[] = [
  { id: 'blur-light', name: 'Light Blur', type: 'blur', intensity: 5 },
  { id: 'blur-heavy', name: 'Heavy Blur', type: 'blur', intensity: 15 },
  { id: 'pixelate-small', name: 'Pixelate S', type: 'pixelate', intensity: 8 },
  { id: 'pixelate-large', name: 'Pixelate L', type: 'pixelate', intensity: 16 },
  { id: 'mosaic', name: 'Mosaic', type: 'mosaic', intensity: 12 },
];
