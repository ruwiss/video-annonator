// ============================================
// CORE TYPES
// ============================================

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DisplayInfo {
  id: number;
  bounds: Bounds;
  scaleFactor: number;
  isPrimary: boolean;
}

export interface RegionConfig {
  displayId: number;
  bounds: Bounds;
  name: string;
  createdAt: number;
}

// ============================================
// TOOL TYPES
// ============================================

export type ToolType =
  | 'select'
  | 'arrow'
  | 'rectangle'
  | 'ellipse'
  | 'line'
  | 'freehand'
  | 'text'
  | 'spotlight'
  | 'blur'
  | 'marker'
  | 'numbering'
  | 'magnifier'
  | 'crop';

export interface ToolConfig {
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  textAlign: 'left' | 'center' | 'right';
  lineHeight: number;
  charSpacing: number;
  opacity: number;
  spotlightRadius: number;
  spotlightDarkness: number;
  spotlightColor: string;
  spotlightShape: 'circle' | 'rounded' | 'rectangle';
  blurIntensity: number;
  blurStyle: 'blur' | 'pixelate' | 'mosaic';
  arrowHeadSize: number;
  arrowStyle: 'simple' | 'filled' | 'double' | 'curved';
  textShadow: boolean;
  textShadowColor: string;
  textShadowBlur: number;
  textShadowOffsetX: number;
  textShadowOffsetY: number;
  textStroke: boolean;
  textStrokeColor: string;
  textStrokeWidth: number;
  filled: boolean;
  cornerRadius: number;
  panelPosition: { x: number; y: number } | null;
}

export const DEFAULT_TOOL_CONFIG: ToolConfig = {
  strokeColor: '#ef4444',
  fillColor: 'transparent',
  strokeWidth: 3,
  fontSize: 24,
  fontFamily: 'Arial',
  fontWeight: 'normal',
  textAlign: 'left',
  lineHeight: 1.2,
  charSpacing: 0,
  opacity: 1,
  spotlightRadius: 100,
  spotlightDarkness: 0.7,
  spotlightColor: '#000000',
  spotlightShape: 'circle',
  blurIntensity: 10,
  blurStyle: 'pixelate',
  arrowHeadSize: 15,
  arrowStyle: 'simple',
  textShadow: false,
  textShadowColor: 'rgba(0,0,0,0.5)',
  textShadowBlur: 4,
  textShadowOffsetX: 2,
  textShadowOffsetY: 2,
  textStroke: false,
  textStrokeColor: '#000000',
  textStrokeWidth: 1,
  filled: false,
  cornerRadius: 0,
  panelPosition: null,
};

// ============================================
// USER TEXT PRESETS
// ============================================

export interface UserTextPreset {
  id: string;
  name: string;
  color: string;
  fontFamily: string;
  fontWeight: string;
  fontSize: number;
  textAlign: 'left' | 'center' | 'right';
  lineHeight: number;
  charSpacing: number;
  textShadow: boolean;
  textShadowColor: string;
  textShadowBlur: number;
  textShadowOffsetX: number;
  textShadowOffsetY: number;
  textStroke: boolean;
  textStrokeColor: string;
  textStrokeWidth: number;
}

// ============================================
// SETTINGS TYPES
// ============================================

export interface AppSettings {
  exportPath: string;
  filePrefix: string;
  imageFormat: 'png' | 'webp';
  imageQuality: number;
  hotkeys: HotkeyConfig;
  savedRegions: RegionConfig[];
  lastUsedRegion: RegionConfig | null;
  theme: 'dark' | 'light';
  showDragWidget: boolean;
  autoNumbering: boolean;
  numberingStart: number;
}

export interface HotkeyConfig {
  toggleOverlay: string;
  selectRegion: string;
  save: string;
  undo: string;
  redo: string;
  clear: string;
  tools: Record<ToolType, string>;
}

export const DEFAULT_HOTKEYS: HotkeyConfig = {
  toggleOverlay: 'CommandOrControl+Shift+A',
  selectRegion: 'CommandOrControl+Shift+R',
  save: 'CommandOrControl+S',
  undo: 'CommandOrControl+Z',
  redo: 'CommandOrControl+Shift+Z',
  clear: 'CommandOrControl+Delete',
  tools: {
    select: 'V',
    arrow: 'A',
    rectangle: 'R',
    ellipse: 'E',
    line: 'L',
    freehand: 'P',
    text: 'T',
    spotlight: 'S',
    blur: 'B',
    marker: 'M',
    numbering: 'N',
    magnifier: 'G',
    crop: 'C',
  },
};

export const DEFAULT_SETTINGS: AppSettings = {
  exportPath: '',
  filePrefix: 'annotation',
  imageFormat: 'png',
  imageQuality: 100,
  hotkeys: DEFAULT_HOTKEYS,
  savedRegions: [],
  lastUsedRegion: null,
  theme: 'dark',
  showDragWidget: true,
  autoNumbering: true,
  numberingStart: 1,
};

// ============================================
// IPC CHANNELS
// ============================================

export const IPC_CHANNELS = {
  TOGGLE_OVERLAY: 'toggle-overlay',
  CLOSE_OVERLAY: 'close-overlay',
  SELECT_REGION: 'select-region',
  REGION_SELECTED: 'region-selected',
  GET_SETTINGS: 'get-settings',
  SET_SETTINGS: 'set-settings',
  SELECT_EXPORT_PATH: 'select-export-path',
  SAVE_ANNOTATION: 'save-annotation',
  ANNOTATION_SAVED: 'annotation-saved',
  START_DRAG: 'start-drag',
  SHOW_DRAG_WIDGET: 'show-drag-widget',
  HIDE_DRAG_WIDGET: 'hide-drag-widget',
  GET_DISPLAYS: 'get-displays',
  CAPTURE_SCREEN: 'capture-screen',
  OPEN_SETTINGS: 'open-settings',
  MINIMIZE_TO_TRAY: 'minimize-to-tray',
} as const;

// ============================================
// CANVAS OBJECT TYPES
// ============================================

export interface CanvasObjectData {
  id: string;
  type: ToolType;
  data: Record<string, unknown>;
  timestamp: number;
}

export interface AnnotationSession {
  id: string;
  objects: CanvasObjectData[];
  regionConfig: RegionConfig;
  createdAt: number;
  exportedFiles: string[];
}
