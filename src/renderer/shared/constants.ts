// ============================================
// COLOR PALETTES
// ============================================

// 15 preset colors + 1 slot for custom color picker in UI
export const ANNOTATION_COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#eab308', // Yellow
  '#84cc16', // Lime
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#a855f7', // Purple
  '#ec4899', // Pink
  '#ffffff', // White
  '#000000', // Black
] as const;

export const STROKE_WIDTHS = [1, 2, 3, 4, 6, 8, 12, 16] as const;

export const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64, 72] as const;

export const FONT_FAMILIES = [
  { name: 'Inter', value: 'Inter, system-ui, sans-serif' },
  { name: 'Roboto', value: 'Roboto, sans-serif' },
  { name: 'Poppins', value: 'Poppins, sans-serif' },
  { name: 'Fira Code', value: 'Fira Code, monospace' },
  { name: 'Comic Neue', value: 'Comic Neue, cursive' },
  { name: 'Permanent Marker', value: 'Permanent Marker, cursive' },
] as const;

// ============================================
// TOOL METADATA
// ============================================

export const TOOL_INFO: Record<string, { label: string; description: string; icon: string }> = {
  select: {
    label: 'Select',
    description: 'Select and move objects',
    icon: 'cursor',
  },
  arrow: {
    label: 'Arrow',
    description: 'Draw arrows to point at things',
    icon: 'arrow-up-right',
  },
  rectangle: {
    label: 'Rectangle',
    description: 'Draw rectangles and squares',
    icon: 'square',
  },
  ellipse: {
    label: 'Ellipse',
    description: 'Draw circles and ellipses',
    icon: 'circle',
  },
  line: {
    label: 'Line',
    description: 'Draw straight lines',
    icon: 'minus',
  },
  freehand: {
    label: 'Freehand',
    description: 'Draw freely with pen',
    icon: 'pencil',
  },
  text: {
    label: 'Text',
    description: 'Add text annotations',
    icon: 'type',
  },
  spotlight: {
    label: 'Spotlight',
    description: 'Highlight area with spotlight effect',
    icon: 'sun',
  },
  blur: {
    label: 'Blur',
    description: 'Blur sensitive areas',
    icon: 'eye-off',
  },
  marker: {
    label: 'Marker',
    description: 'Highlight with semi-transparent marker',
    icon: 'highlighter',
  },
  numbering: {
    label: 'Numbering',
    description: 'Add numbered markers',
    icon: 'hash',
  },
  magnifier: {
    label: 'Magnifier',
    description: 'Zoom into specific areas',
    icon: 'zoom-in',
  },
};

// ============================================
// KEYBOARD SHORTCUTS DISPLAY
// ============================================

export const MODIFIER_DISPLAY: Record<string, string> = {
  CommandOrControl: 'Ctrl',
  Control: 'Ctrl',
  Command: 'Cmd',
  Alt: 'Alt',
  Shift: 'Shift',
  Meta: 'Win',
};

// ============================================
// FILE NAMING
// ============================================

export const FILE_NAME_TOKENS = {
  PREFIX: '{prefix}',
  DATE: '{date}',
  TIME: '{time}',
  NUMBER: '{number}',
  TIMESTAMP: '{timestamp}',
} as const;

export const DEFAULT_FILE_PATTERN = '{prefix}_{date}_{time}_{number}';
