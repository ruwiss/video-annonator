# Video Annotator

Transparent overlay annotation tool for video editors. Built with Electron, React, TypeScript, Fabric.js, and Tailwind CSS.

## Overview

Video Annotator is a Windows desktop application that provides a transparent overlay for annotating screen content. It's designed for video editors, tutorial creators, and anyone who needs to highlight, mark up, or annotate visual content before capturing screenshots.

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Electron 28 | Desktop application framework |
| React 18 | UI components |
| TypeScript 5 | Type safety |
| Fabric.js 5 | Canvas manipulation |
| Zustand 4 | State management |
| Tailwind CSS 3 | Styling |
| Vite 5 | Build tool |
| electron-store | Persistent settings |

## Project Structure

```
video-annotator/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts             # App entry, IPC handlers, tray
│   │   ├── preload.ts           # Context bridge API
│   │   ├── services/
│   │   │   └── FileService.ts   # File save operations
│   │   ├── utils/
│   │   │   └── createTrayIcon.ts
│   │   └── windows/
│   │       └── WindowManager.ts # Window lifecycle management
│   │
│   ├── renderer/                # React frontend
│   │   ├── components/
│   │   │   ├── AnnotationCanvas.tsx  # Main Fabric.js canvas
│   │   │   ├── ToolPanel.tsx         # Left sidebar tools + options
│   │   │   ├── OptionsPanel.tsx      # Bottom action bar
│   │   │   ├── SaveDialog.tsx        # Export options modal
│   │   │   └── icons/                # SVG icon components
│   │   │
│   │   ├── views/
│   │   │   ├── OverlayView.tsx       # Main annotation overlay
│   │   │   ├── SettingsView.tsx      # Settings window
│   │   │   ├── RegionSelectView.tsx  # Region selection
│   │   │   └── DragWidgetView.tsx    # Post-save drag widget
│   │   │
│   │   ├── stores/
│   │   │   ├── useToolStore.ts       # Tool state, config
│   │   │   └── useCanvasStore.ts     # Canvas ref, history
│   │   │
│   │   ├── shared/
│   │   │   ├── types.ts              # TypeScript interfaces
│   │   │   ├── presets.ts            # Tool presets
│   │   │   └── constants.ts          # Colors, fonts, etc.
│   │   │
│   │   ├── styles/
│   │   │   └── globals.css           # Tailwind + custom CSS
│   │   │
│   │   └── main.tsx                  # React entry point
│   │
│   └── shared/                  # Shared between main/renderer
│       └── types.ts             # IPC channels, settings types
│
├── dist/                        # Build output
├── assets/                      # App icons
└── package.json
```

## Features

### Drawing Tools

| Tool | Shortcut | Location | Description |
|------|----------|----------|-------------|
| Select | V | Left Panel | Select, move, resize objects |
| Arrow | A | Left Panel | Draw arrows with V-shaped heads |
| Rectangle | R | Left Panel | Draw rectangles with optional fill and radius |
| Ellipse | E | Left Panel | Draw circles and ellipses |
| Line | L | Left Panel | Draw straight lines (solid, dashed, dotted) |
| Freehand | P | Left Panel | Calligraphic pen drawing |
| Text | T | Left Panel | Add editable text with font options |
| Marker | M | Left Panel | Semi-transparent highlighter |
| Numbering | N | Left Panel | Sequential numbered markers |
| Spotlight | S | Left Panel | Darken background, highlight area |
| Blur | B | Left Panel | Pixelate/mosaic sensitive areas |
| Crop | C | Bottom Bar | Define export region |

### Arrow System

Modern arrow implementation with:
- **V-shaped arrowheads** - Open style, professional look
- **Live preview** - Arrow head and curve visible while drawing
- **Curved arrows** - Quadratic bezier with direction-aware curve
  - Dragging right → curves upward
  - Dragging left → curves downward
- **Presets**: Solid, Dashed, Dotted, Double, Curved
- **Dynamic sizing** - Head size scales with stroke width

### Tool Options Panel

Side panel appears when tool is active (not when object is selected):
- **Color**: 16-color palette
- **Size**: Stroke width (2, 3, 5, 8)
- **Opacity**: 20-100% for shapes
- **Fill**: Outline or filled mode
- **Radius**: Corner radius for rectangles
- **Presets**: Style variations per tool
- **Fixed width**: 160px for consistent appearance
- **Height**: Dynamically matches main tool panel height

### Spotlight Tool

- **Shapes**: Circle, Rounded Rectangle, Rectangle
- **Darkness**: 30-90% background opacity
- **Additive**: Multiple spotlight holes supported
- **Undo-safe**: Hole geometry stored as `spotlightHolesData` in history
- **Restoration**: `syncSpotlightFromHistory()` rebuilds holes from stored coordinates

### Blur Tool

- **Real Blur**: Captures region, applies CSS `filter: blur()`, renders as image
- Light Blur (5px)
- Heavy Blur (15px)
- Pixelate (Small/Large) - Pattern-based fallback
- Mosaic pattern - Pattern-based fallback

### Export Options

- **Format**: PNG (transparent) or WebP
- **Quality**: Adjustable for WebP
- **With Background**: Captures screen content (overlay hidden during capture)
- **Crop Region**: Export only selected area

### Drag Widget

- Appears after saving annotation
- Drag to any application to insert image
- **Auto-closes** on first drag or when overlay reopens
- 30-second timeout

## Keyboard Shortcuts

### Global
| Shortcut | Action |
|----------|--------|
| Ctrl+Shift+A | Toggle overlay |
| Escape | Close overlay |

### Canvas
| Shortcut | Action |
|----------|--------|
| Ctrl+S | Save dialog |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z | Redo |
| Ctrl+Delete | Clear all |
| Delete | Delete selected |

### Tools
| Key | Tool |
|-----|------|
| V | Select |
| A | Arrow |
| R | Rectangle |
| E | Ellipse |
| L | Line |
| P | Pen/Freehand |
| T | Text |
| M | Marker |
| N | Numbering |
| S | Spotlight |
| B | Blur |
| C | Crop |

## Architecture

### Main Process (`src/main/`)

**index.ts**
- App initialization
- Global shortcut registration (Ctrl+Shift+A only)
- IPC handler setup
- Tray icon creation
- Screen capture via `desktopCapturer` (main process only - Electron 17+)

**WindowManager.ts**
- Creates/manages windows: overlay, settings, drag widget
- Handles window lifecycle
- **Mutual exclusion**: Settings closes overlay, overlay closes settings
- `hideOverlayTemporarily()` / `restoreOverlay()` for screen capture

**preload.ts**
- Exposes `electronAPI` to renderer
- IPC communication bridge
- Delegates capture to main process

### Renderer Process (`src/renderer/`)

**AnnotationCanvas.tsx**
Core canvas component using Fabric.js:
- Tool-specific drawing handlers
- Modern arrow system with live preview
- Spotlight overlay with clip paths
- Crop region management
- History state tracking with spotlight hole data

**ToolPanel.tsx**
Draggable left sidebar:
- Tool buttons with shortcuts
- Contextual options panel (fixed 160px width, height synced with main panel)
- Color picker, size controls
- Preset selectors
- Options only shown for active tool, not selected objects
- Uses `mainPanelRef` to track and sync panel heights

**OptionsPanel.tsx**
Bottom action bar:
- Undo/Redo buttons
- Clear, Crop, Save actions
- Settings, Close buttons

### State Management

**useToolStore** (Zustand)
```typescript
{
  activeTool: ToolType,
  config: ToolConfig,
  activePresets: Record<string, string>,
  numberingCounter: number,
  textToolState: 'idle' | 'placing' | 'editing'
}
```

**useCanvasStore** (Zustand)
```typescript
{
  canvas: fabric.Canvas | null,
  history: string[],
  historyIndex: number,
  undo(), redo(), pushHistory(),
  canUndo(), canRedo()
}
```

### IPC Communication

```
Renderer                    Main
   │                          │
   ├─── closeOverlay ────────►│ WindowManager.hideOverlay()
   ├─── openSettings ────────►│ WindowManager.openSettings()
   ├─── saveAnnotation ──────►│ FileService.saveAnnotation()
   ├─── captureScreen ───────►│ desktopCapturer (main process)
   │                          │
   │◄── annotation-saved ─────┤
   │◄── toggle-overlay ───────┤ (global shortcut)
```

## Configuration

### Tool Config Defaults

```typescript
{
  strokeColor: '#ef4444',      // Red
  strokeWidth: 3,
  fontSize: 24,
  fontFamily: 'Inter',
  opacity: 1,
  spotlightDarkness: 0.7,
  spotlightShape: 'circle',
  blurStyle: 'pixelate',
  filled: false,
  cornerRadius: 0
}
```

### App Settings (electron-store)

```typescript
{
  exportPath: string,          // Default save location
  filePrefix: 'annotation',
  imageFormat: 'png' | 'webp',
  imageQuality: 100,
  showDragWidget: true,
  autoNumbering: true,
  numberingStart: 1
}
```

## Build & Run

```bash
# Install dependencies
npm install

# Development (watch mode)
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Package for distribution
npm run package
```

## Key Implementation Details

### Arrow Drawing
- V-shaped open arrowhead using SVG Path
- Line + arrowhead grouped as single object
- Head tip positioned exactly at line end
- Size scales with strokeWidth: `headLength = max(14, strokeWidth * 4)`
- Supports: Solid, Dashed, Dotted, Double, Curved (Bezier)
- Curved arrows use quadratic bezier with direction-aware control point
- Live preview updates on mouse move

### Spotlight System
- Uses Fabric.js `clipPath` with `inverted: true`
- Multiple holes stored in `overlayState.spotlightHoles`
- Darkness slider updates existing overlay
- **History stores hole geometry data** (`spotlightHolesData`) for accurate undo/redo
- `syncSpotlightFromHistory()` rebuilds holes from stored coordinates
- Each hole stores: type, left, top, radius (circle) or width/height/rx/ry (rect)

### Screen Capture
- Uses Electron's `desktopCapturer` API in **main process only** (Electron 17+ requirement)
- Overlay hidden via `setOpacity(0)` + `setPosition(-10000, -10000)` before capture
- 150ms delay for window compositor
- Captures at native display resolution with scale factor
- Composited as background image on export

### Panel Position Persistence
- Stored in localStorage (not electron-store)
- Survives overlay close/reopen
- Draggable via mouse events

### Window Management
- Settings and Overlay are mutually exclusive
- Drag widget closes on first drag or overlay reopen
- Overlay restores position and focus after capture

## File Naming

Exported files follow pattern:
```
{prefix}_{YYYY-MM-DD}_{HH-mm-ss}_{number}.{format}
```

Example: `annotation_2024-12-21_14-30-45_001.png`

## Dependencies

### Production
- `electron-store` - Persistent settings
- `fabric` - Canvas manipulation
- `react-router-dom` - View routing
- `uuid` - Unique IDs

### Development
- `@vitejs/plugin-react` - React HMR
- `tailwindcss` - Utility CSS
- `zustand` - State management
- `electron-builder` - Packaging

## Known Limitations

1. Text partial styling (per-character) not fully implemented
2. Multi-monitor support may require manual region selection

## Changelog

### v1.2.0 (December 2024)

**Arrow System**
- Modern V-shaped arrowheads (open style, not filled triangles)
- Live preview while drawing - curve and head visible in real-time
- Direction-aware curved arrows (drag right → curve up, drag left → curve down)
- Options panel only shows during drawing, not when arrow is selected

**Spotlight Tool**
- Undo/redo now preserves exact hole positions
- Hole geometry stored separately in history (`spotlightHolesData`)
- `syncSpotlightFromHistory()` rebuilds holes from stored data

**UI/UX Improvements**
- Options panel height synced with main tool panel via `mainPanelRef`
- Fixed panel width (160px) for consistent appearance
- Crop tool moved to bottom action bar (OptionsPanel)
- Drag widget auto-closes on first drag or overlay reopen
- Settings and overlay are mutually exclusive

**Keyboard Shortcuts**
- Removed Ctrl+Shift+R shortcut entirely
- Fixed Ctrl+Shift+Z (redo) - now checks both `e.key === "z"` and `e.key === "Z"`

**Screen Capture**
- Uses `desktopCapturer` in main process only (Electron 17+ requirement)
- Overlay hidden via `setOpacity(0)` + `setPosition(-10000, -10000)`
- 150ms delay for window compositor

**Bug Fixes**
- Fixed spotlight hole positions corrupting on undo/redo
- Fixed dotted preset icon (single line, no overflow)
- Fixed arrow editing mode opening on click (now only during drawing)

### v1.1.0 (Initial Release)
- Core annotation tools: Arrow, Rectangle, Ellipse, Line, Freehand, Text
- Marker and Numbering tools
- Spotlight and Blur effects
- Crop region selection
- PNG/WebP export with background capture
- Drag widget for quick sharing
- Persistent panel positions
- Global shortcut (Ctrl+Shift+A)
