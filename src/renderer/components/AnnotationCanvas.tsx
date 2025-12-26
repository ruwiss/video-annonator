import React, { useEffect, useRef, useCallback, useState } from "react";
import { fabric } from "fabric";
import { useToolStore } from "../stores/useToolStore";
import { useCanvasStore } from "../stores/useCanvasStore";
import { MARKER_PRESETS, ARROW_PRESETS, LINE_PRESETS } from "../shared/presets";
import { ImageModeState, ScreenCaptureState, DrawingModifiers, DrawingInfo } from "../../shared/types";

interface AnnotationCanvasProps {
  width: number;
  height: number;
  imageMode?: ImageModeState;
  screenCapture?: ScreenCaptureState;
}

// ============================================
// SMART GUIDES OVERLAY - For both drawing and moving
// ============================================

interface SmartGuidesProps {
  show: boolean;
  mode: "drawing" | "moving";
  objectBounds: { left: number; top: number; width: number; height: number } | null;
  startPoint: { x: number; y: number } | null;
  currentPoint: { x: number; y: number } | null;
  canvasWidth: number;
  canvasHeight: number;
  modifiers: DrawingModifiers;
  drawingInfo: DrawingInfo | null;
  activeTool: string;
  snapLines: { vertical: number[]; horizontal: number[] };
}

const SmartGuides: React.FC<SmartGuidesProps> = ({ show, mode, objectBounds, startPoint, currentPoint, canvasWidth, canvasHeight, modifiers, drawingInfo, activeTool, snapLines }) => {
  if (!show) return null;

  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  const SNAP_THRESHOLD = 8;

  // For moving mode, calculate object center
  const objCenterX = objectBounds ? objectBounds.left + objectBounds.width / 2 : null;
  const objCenterY = objectBounds ? objectBounds.top + objectBounds.height / 2 : null;

  // Check proximity to guides
  const isNearCenterX = mode === "moving" ? objCenterX && Math.abs(objCenterX - centerX) < SNAP_THRESHOLD : currentPoint && Math.abs(currentPoint.x - centerX) < SNAP_THRESHOLD;

  const isNearCenterY = mode === "moving" ? objCenterY && Math.abs(objCenterY - centerY) < SNAP_THRESHOLD : currentPoint && Math.abs(currentPoint.y - centerY) < SNAP_THRESHOLD;

  // Edge alignment for moving
  const isLeftEdgeCenter = objectBounds && Math.abs(objectBounds.left - centerX) < SNAP_THRESHOLD;
  const isRightEdgeCenter = objectBounds && Math.abs(objectBounds.left + objectBounds.width - centerX) < SNAP_THRESHOLD;
  const isTopEdgeCenter = objectBounds && Math.abs(objectBounds.top - centerY) < SNAP_THRESHOLD;
  const isBottomEdgeCenter = objectBounds && Math.abs(objectBounds.top + objectBounds.height - centerY) < SNAP_THRESHOLD;

  const showVerticalCenter = isNearCenterX || isLeftEdgeCenter || isRightEdgeCenter;
  const showHorizontalCenter = isNearCenterY || isTopEdgeCenter || isBottomEdgeCenter;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      <svg className="absolute inset-0 w-full h-full">
        {/* Canvas center guides */}
        <line x1={centerX} y1={0} x2={centerX} y2={canvasHeight} stroke={showVerticalCenter ? "#3b82f6" : "rgba(59, 130, 246, 0.15)"} strokeWidth={showVerticalCenter ? 2 : 1} strokeDasharray={showVerticalCenter ? "none" : "4 4"} />
        <line x1={0} y1={centerY} x2={canvasWidth} y2={centerY} stroke={showHorizontalCenter ? "#3b82f6" : "rgba(59, 130, 246, 0.15)"} strokeWidth={showHorizontalCenter ? 2 : 1} strokeDasharray={showHorizontalCenter ? "none" : "4 4"} />

        {/* Dynamic snap lines from other objects */}
        {snapLines.vertical.map((x, i) => (
          <line key={`v-${i}`} x1={x} y1={0} x2={x} y2={canvasHeight} stroke="#f59e0b" strokeWidth={1} strokeDasharray="3 3" />
        ))}
        {snapLines.horizontal.map((y, i) => (
          <line key={`h-${i}`} x1={0} y1={y} x2={canvasWidth} y2={y} stroke="#f59e0b" strokeWidth={1} strokeDasharray="3 3" />
        ))}

        {/* Drawing mode: start point guides */}
        {mode === "drawing" && startPoint && (
          <>
            <line x1={startPoint.x} y1={0} x2={startPoint.x} y2={canvasHeight} stroke="rgba(16, 185, 129, 0.25)" strokeWidth={1} strokeDasharray="3 3" />
            <line x1={0} y1={startPoint.y} x2={canvasWidth} y2={startPoint.y} stroke="rgba(16, 185, 129, 0.25)" strokeWidth={1} strokeDasharray="3 3" />
          </>
        )}

        {/* 45° diagonal guides for line/arrow */}
        {mode === "drawing" && modifiers.shift && startPoint && currentPoint && (activeTool === "line" || activeTool === "arrow") && (
          <>
            <line x1={startPoint.x - canvasWidth} y1={startPoint.y - canvasWidth} x2={startPoint.x + canvasWidth} y2={startPoint.y + canvasWidth} stroke="rgba(251, 191, 36, 0.3)" strokeWidth={1} strokeDasharray="4 4" />
            <line x1={startPoint.x - canvasWidth} y1={startPoint.y + canvasWidth} x2={startPoint.x + canvasWidth} y2={startPoint.y - canvasWidth} stroke="rgba(251, 191, 36, 0.3)" strokeWidth={1} strokeDasharray="4 4" />
          </>
        )}
      </svg>

      {/* Drawing info tooltip */}
      {mode === "drawing" && drawingInfo && currentPoint && (
        <div
          className="absolute px-2 py-1 rounded-md text-[10px] font-mono bg-cinema-dark/95 border border-cinema-border text-silver-light shadow-lg backdrop-blur-sm"
          style={{
            left: currentPoint.x + 16,
            top: currentPoint.y + 16,
            transform: currentPoint.x > canvasWidth - 120 ? "translateX(-100%)" : "none",
          }}
        >
          <div className="flex gap-3">
            <span className="text-amber-warm">
              {Math.round(drawingInfo.width)} × {Math.round(drawingInfo.height)}
            </span>
            {drawingInfo.distance !== undefined && <span className="text-blue-400">{Math.round(drawingInfo.distance)}px</span>}
            {drawingInfo.angle !== undefined && <span className="text-emerald-400">{Math.round(drawingInfo.angle)}°</span>}
          </div>
        </div>
      )}

      {/* Moving mode: position info */}
      {mode === "moving" && objectBounds && (
        <div
          className="absolute px-2 py-1 rounded-md text-[10px] font-mono bg-cinema-dark/95 border border-cinema-border text-silver-light shadow-lg backdrop-blur-sm"
          style={{
            left: objectBounds.left + objectBounds.width + 8,
            top: objectBounds.top - 4,
          }}
        >
          <span className="text-emerald-400">
            {Math.round(objectBounds.left)}, {Math.round(objectBounds.top)}
          </span>
        </div>
      )}

      {/* Modifier indicators */}
      {mode === "drawing" && (modifiers.shift || modifiers.alt) && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 flex gap-2">
          {modifiers.shift && <div className="px-2 py-1 rounded text-[10px] font-medium bg-amber-500/20 border border-amber-500/40 text-amber-300">SHIFT: {activeTool === "line" || activeTool === "arrow" ? "45° Snap" : "Perfect Shape"}</div>}
          {modifiers.alt && <div className="px-2 py-1 rounded text-[10px] font-medium bg-purple-500/20 border border-purple-500/40 text-purple-300">ALT: Draw from Center</div>}
        </div>
      )}
    </div>
  );
};

// Module-level state for overlays
interface OverlayState {
  spotlightHoles: fabric.Object[];
  spotlightOverlay: fabric.Rect | null;
  cropOverlay: fabric.Group | null;
  hasCrop: boolean;
  cropBounds: { left: number; top: number; width: number; height: number } | null;
}

const overlayState: OverlayState = {
  spotlightHoles: [],
  spotlightOverlay: null,
  cropOverlay: null,
  hasCrop: false,
  cropBounds: null,
};

// Export for external access (save, etc.)
export const getOverlayState = () => overlayState;
export const resetOverlayState = (canvas?: fabric.Canvas) => {
  // Remove crop overlay from canvas if provided
  if (canvas && overlayState.cropOverlay) {
    canvas.remove(overlayState.cropOverlay);
    canvas.renderAll();
  }
  overlayState.spotlightHoles = [];
  overlayState.spotlightOverlay = null;
  overlayState.cropOverlay = null;
  overlayState.hasCrop = false;
  overlayState.cropBounds = null;
};

// Sync crop state from canvas after undo/redo
export const syncCropStateFromCanvas = (canvas: fabric.Canvas) => {
  // Find crop overlay in canvas objects
  const cropObj = canvas.getObjects().find((obj) => obj.data?.type === "crop-overlay");
  if (cropObj) {
    overlayState.cropOverlay = cropObj as fabric.Group;
    overlayState.hasCrop = true;
    // Extract bounds from the crop overlay
    const bounds = (canvas as any).cropBounds;
    if (bounds) {
      overlayState.cropBounds = bounds;
    }
  } else {
    overlayState.cropOverlay = null;
    overlayState.hasCrop = false;
    overlayState.cropBounds = null;
  }
};

// Store references for blur update functionality
let moduleCanvasRef: fabric.Canvas | null = null;
let imageModeRef: ImageModeState | undefined;
let screenCaptureRef: ScreenCaptureState | undefined;
let saveHistoryRef: (() => void) | null = null;

// Update blur object with new settings (called from ToolPanel)
export const updateSelectedBlur = async (newStyle: string, newIntensity: number): Promise<boolean> => {
  if (!moduleCanvasRef) return false;

  const activeObj = moduleCanvasRef.getActiveObject();
  if (!activeObj || activeObj.data?.type !== "blur") return false;

  // Get current position and size
  const left = activeObj.left || 0;
  const top = activeObj.top || 0;
  const width = (activeObj as any).width * (activeObj.scaleX || 1);
  const height = (activeObj as any).height * (activeObj.scaleY || 1);

  // Remove old blur object
  moduleCanvasRef.remove(activeObj);

  // Create new blur with updated settings
  const newBlur = await createBlurRectExport(left, top, width, height, newStyle, newIntensity, imageModeRef, screenCaptureRef);
  moduleCanvasRef.add(newBlur);
  moduleCanvasRef.setActiveObject(newBlur);
  moduleCanvasRef.renderAll();

  // Save history
  if (saveHistoryRef) saveHistoryRef();

  return true;
};

// Internal blur creation function (exported for updateSelectedBlur)
async function createBlurRectExport(x: number, y: number, w: number, h: number, style: string, intensity: number, imageMode?: ImageModeState, screenCapture?: ScreenCaptureState): Promise<fabric.Object> {
  return createBlurRect(x, y, w, h, style, intensity, imageMode, screenCapture);
}

// Sync spotlight state from history - call after loadFromJSON
export const syncSpotlightFromHistory = (canvas: fabric.Canvas, holeCount: number, holesData?: any[], color: string = "#000000", darkness: number = 0.7) => {
  // Clear current state
  overlayState.spotlightHoles = [];
  if (overlayState.spotlightOverlay) {
    canvas.remove(overlayState.spotlightOverlay);
    overlayState.spotlightOverlay = null;
  }

  // Remove any existing spotlight overlay from canvas
  const existingOverlay = canvas.getObjects().find((obj) => obj.data?.type === "spotlight-overlay");
  if (existingOverlay) {
    canvas.remove(existingOverlay);
  }

  // If history had no holes, we're done
  if (holeCount === 0 || !holesData || holesData.length === 0) return;

  // Rebuild holes from stored data
  holesData.forEach((data) => {
    let hole: fabric.Object;
    if (data.type === "circle") {
      hole = new fabric.Circle({
        left: data.left,
        top: data.top,
        radius: data.radius,
        originX: "center",
        originY: "center",
        absolutePositioned: true,
      });
    } else {
      hole = new fabric.Rect({
        left: data.left,
        top: data.top,
        width: data.width,
        height: data.height,
        rx: data.rx || 0,
        ry: data.ry || 0,
        absolutePositioned: true,
      });
    }
    overlayState.spotlightHoles.push(hole);
  });

  // Recreate the overlay with proper holes using stored color
  const canvasWidth = canvas.getWidth();
  const canvasHeight = canvas.getHeight();

  // Convert hex to rgba
  const hex = color.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  overlayState.spotlightOverlay = new fabric.Rect({
    left: 0,
    top: 0,
    width: canvasWidth,
    height: canvasHeight,
    fill: `rgba(${r}, ${g}, ${b}, ${darkness})`,
    selectable: false,
    evented: false,
    data: { type: "spotlight-overlay" },
  });

  const holesGroup = new fabric.Group(
    overlayState.spotlightHoles.map((hole) => fabric.util.object.clone(hole)),
    { absolutePositioned: true }
  );

  overlayState.spotlightOverlay.clipPath = holesGroup;
  (overlayState.spotlightOverlay.clipPath as any).inverted = true;

  canvas.add(overlayState.spotlightOverlay);
  canvas.sendToBack(overlayState.spotlightOverlay);
  canvas.renderAll();
};

// Update spotlight darkness from outside
export const updateSpotlightDarkness = (canvas: fabric.Canvas | null, canvasWidth: number, canvasHeight: number, darknessLevel: number, color: string = "#000000") => {
  if (!canvas || overlayState.spotlightHoles.length === 0) return;
  updateSpotlightOverlay(canvas, canvasWidth, canvasHeight, darknessLevel, color);
};

export const AnnotationCanvas: React.FC<AnnotationCanvasProps> = ({ width, height, imageMode, screenCapture }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const isDrawingRef = useRef(false);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const endPointRef = useRef<{ x: number; y: number } | null>(null);
  const currentObjectRef = useRef<fabric.Object | null>(null);

  // Clipboard for copy/paste
  const clipboardRef = useRef<fabric.Object | null>(null);

  // Drawing modifiers state (Shift, Alt, Ctrl)
  const [modifiers, setModifiers] = useState<DrawingModifiers>({ shift: false, alt: false, ctrl: false });
  const [showGuides, setShowGuides] = useState(false);
  const [guideMode, setGuideMode] = useState<"drawing" | "moving">("drawing");
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentPoint, setCurrentPoint] = useState<{ x: number; y: number } | null>(null);
  const [drawingInfo, setDrawingInfo] = useState<DrawingInfo | null>(null);
  const [movingObjectBounds, setMovingObjectBounds] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [snapLines, setSnapLines] = useState<{ vertical: number[]; horizontal: number[] }>({ vertical: [], horizontal: [] });
  const modifiersRef = useRef<DrawingModifiers>({ shift: false, alt: false, ctrl: false });

  const { activeTool, config, numberingCounter, incrementNumbering, activePresets, textToolState, setTextToolState, setActiveTool } = useToolStore();

  const { setCanvas, pushHistory, loadFromStorage, loadHistoryFromStorage, clearStorage } = useCanvasStore();

  // Initialize Fabric canvas
  useEffect(() => {
    if (!canvasRef.current || fabricRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width,
      height,
      backgroundColor: "transparent",
      selection: true,
      preserveObjectStacking: true,
    });

    canvas.freeDrawingBrush.decimate = 8;
    fabricRef.current = canvas;
    setCanvas(canvas);

    // Update module-level refs for blur update functionality
    moduleCanvasRef = canvas;

    // Reset overlay state
    resetOverlayState();

    // Check if fresh app start - clear storage if so
    const initCanvas = async () => {
      let shouldRestore = true;

      if (window.electronAPI?.checkFreshStart) {
        const isFresh = await window.electronAPI.checkFreshStart();
        if (isFresh) {
          // Fresh app start - clear all saved state
          clearStorage();
          shouldRestore = false;
        }
      }

      // Try to restore from storage (only if not fresh start)
      if (shouldRestore) {
        const savedState = loadFromStorage();
        if (savedState) {
          try {
            const parsed = JSON.parse(savedState);
            canvas.loadFromJSON(parsed, () => {
              // Restore spotlight if any
              if (parsed.spotlightHoleCount > 0 && parsed.spotlightHolesData) {
                syncSpotlightFromHistory(canvas, parsed.spotlightHoleCount, parsed.spotlightHolesData, parsed.spotlightColor || "#000000", parsed.spotlightDarkness || 0.7);
              }
              canvas.renderAll();
            });
            // Load history for undo/redo
            loadHistoryFromStorage();
            return;
          } catch {}
        }
      }

      // No state to restore, save initial empty state
      pushHistory(JSON.stringify(canvas.toJSON(["selectable", "evented", "data"])));
    };

    initCanvas();

    return () => {
      canvas.dispose();
      fabricRef.current = null;
      setCanvas(null);
    };
  }, []);

  // Update canvas dimensions
  useEffect(() => {
    const canvas = fabricRef.current;
    if (canvas) {
      canvas.setDimensions({ width, height });
      canvas.renderAll();
    }
  }, [width, height]);

  // Save history helper - saves spotlight holes data for proper restoration
  const saveHistory = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    // Serialize spotlight holes separately (they lose absolutePositioned in JSON)
    const holesData = overlayState.spotlightHoles.map((hole) => {
      if (hole.type === "circle") {
        const c = hole as fabric.Circle;
        return { type: "circle", left: c.left, top: c.top, radius: c.radius };
      } else {
        const r = hole as fabric.Rect;
        return { type: "rect", left: r.left, top: r.top, width: r.width, height: r.height, rx: r.rx, ry: r.ry };
      }
    });

    const json = canvas.toJSON(["selectable", "evented", "data"]);
    (json as any).spotlightHoleCount = overlayState.spotlightHoles.length;
    (json as any).spotlightHolesData = holesData;
    (json as any).spotlightColor = config.spotlightColor;
    (json as any).spotlightDarkness = config.spotlightDarkness;
    pushHistory(JSON.stringify(json));
  }, [pushHistory, config.spotlightColor, config.spotlightDarkness]);

  // Update module-level refs for blur update functionality
  useEffect(() => {
    imageModeRef = imageMode;
    screenCaptureRef = screenCapture;
    saveHistoryRef = saveHistory;
  }, [imageMode, screenCapture, saveHistory]);

  // Update tool mode
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    canvas.isDrawingMode = false;
    canvas.selection = activeTool === "select";

    canvas.forEachObject((obj) => {
      const isOverlay = obj.data?.type === "spotlight-overlay" || obj.data?.type === "crop-overlay";
      if (isOverlay) {
        obj.selectable = false;
        obj.evented = false;
      } else {
        obj.selectable = activeTool === "select";
        obj.evented = activeTool === "select";
      }
    });

    if (activeTool === "freehand") {
      canvas.isDrawingMode = true;
      // Calligraphic brush - variable width simulation
      const brush = new fabric.PencilBrush(canvas);
      brush.width = config.strokeWidth;
      brush.color = config.strokeColor;
      brush.strokeLineCap = "round";
      brush.strokeLineJoin = "round";
      (brush as any).decimate = 2; // Smoother curves
      canvas.freeDrawingBrush = brush;
    } else if (activeTool === "marker") {
      canvas.isDrawingMode = true;
      const markerPreset = MARKER_PRESETS.find((p) => p.id === activePresets.marker);
      canvas.freeDrawingBrush.width = markerPreset?.width || 16;
      // Always use user's color, not preset color
      canvas.freeDrawingBrush.color =
        config.strokeColor +
        Math.round((markerPreset?.opacity || 0.4) * 255)
          .toString(16)
          .padStart(2, "0");
      (canvas.freeDrawingBrush as any).decimate = 3;
    }

    canvas.renderAll();
  }, [activeTool, config, activePresets]);

  // Update spotlight when darkness or color changes
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || overlayState.spotlightHoles.length === 0) return;
    updateSpotlightOverlay(canvas, width, height, config.spotlightDarkness, config.spotlightColor);
  }, [config.spotlightDarkness, config.spotlightColor, width, height]);

  // Delete key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete") {
        const canvas = fabricRef.current;
        if (!canvas) return;

        const activeObj = canvas.getActiveObject();
        if (activeObj && activeTool === "select") {
          // Don't delete overlays
          if (activeObj.data?.type === "spotlight-overlay" || activeObj.data?.type === "crop-overlay") return;

          canvas.remove(activeObj);
          canvas.discardActiveObject();
          canvas.renderAll();
          saveHistory();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTool, saveHistory]);

  // Advanced keyboard shortcuts: Duplicate, Copy, Paste, Flip, Nudge, Rotate
  useEffect(() => {
    const handleAdvancedKeys = (e: KeyboardEvent) => {
      const canvas = fabricRef.current;
      if (!canvas) return;

      const activeObj = canvas.getActiveObject();

      // Ctrl+C: Copy (works with selection)
      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        if (!activeObj || activeTool !== "select") return;
        if (activeObj.data?.type === "spotlight-overlay" || activeObj.data?.type === "crop-overlay") return;

        e.preventDefault();
        activeObj.clone(
          (cloned: fabric.Object) => {
            clipboardRef.current = cloned;
          },
          ["data", "selectable", "evented"]
        );
        return;
      }

      // Ctrl+V: Paste
      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        if (!clipboardRef.current) return;

        e.preventDefault();

        // Store original data before cloning (clone may not preserve nested objects properly)
        const originalData = clipboardRef.current.data ? { ...clipboardRef.current.data } : null;

        // Clone with custom properties preserved
        clipboardRef.current.clone(
          (cloned: fabric.Object) => {
            // Manually copy data property to ensure it's preserved
            if (originalData) {
              cloned.data = { ...originalData };
            }

            cloned.set({
              left: (cloned.left || 0) + 20,
              top: (cloned.top || 0) + 20,
              evented: true,
              selectable: true,
            });

            // For IText objects, ensure editing capability is preserved
            if (cloned.type === "i-text") {
              (cloned as fabric.IText).set({
                editable: true,
              });
            }

            canvas.add(cloned);
            canvas.setActiveObject(cloned);
            canvas.renderAll();
            saveHistory();

            // Update clipboard position for next paste
            clipboardRef.current!.set({
              left: (clipboardRef.current!.left || 0) + 20,
              top: (clipboardRef.current!.top || 0) + 20,
            });
          },
          ["data", "selectable", "evented"]
        );
        return;
      }

      // Ctrl+X: Cut
      if ((e.ctrlKey || e.metaKey) && e.key === "x") {
        if (!activeObj || activeTool !== "select") return;
        if (activeObj.data?.type === "spotlight-overlay" || activeObj.data?.type === "crop-overlay") return;

        e.preventDefault();
        activeObj.clone(
          (cloned: fabric.Object) => {
            clipboardRef.current = cloned;
          },
          ["data", "selectable", "evented"]
        );
        canvas.remove(activeObj);
        canvas.discardActiveObject();
        canvas.renderAll();
        saveHistory();
        return;
      }

      // Rest of shortcuts require active selection
      if (!activeObj || activeTool !== "select") return;
      if (activeObj.data?.type === "spotlight-overlay" || activeObj.data?.type === "crop-overlay") return;

      // Ctrl+D: Duplicate
      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();
        activeObj.clone(
          (cloned: fabric.Object) => {
            cloned.set({
              left: (activeObj.left || 0) + 20,
              top: (activeObj.top || 0) + 20,
              evented: true,
              selectable: true,
            });
            // For IText objects, ensure editing capability is preserved
            if (cloned.type === "i-text") {
              (cloned as fabric.IText).set({
                editable: true,
              });
            }
            canvas.add(cloned);
            canvas.setActiveObject(cloned);
            canvas.renderAll();
            saveHistory();
          },
          ["data", "selectable", "evented"]
        );
        return;
      }

      // Ctrl+H: Flip Horizontal
      if ((e.ctrlKey || e.metaKey) && e.key === "h") {
        e.preventDefault();
        activeObj.set({ flipX: !activeObj.flipX });
        canvas.renderAll();
        saveHistory();
        return;
      }

      // Ctrl+J: Flip Vertical (J because V is for paste)
      if ((e.ctrlKey || e.metaKey) && e.key === "j") {
        e.preventDefault();
        activeObj.set({ flipY: !activeObj.flipY });
        canvas.renderAll();
        saveHistory();
        return;
      }

      // Arrow keys: Nudge (1px, or 10px with Shift)
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const left = activeObj.left || 0;
        const top = activeObj.top || 0;

        switch (e.key) {
          case "ArrowUp":
            activeObj.set({ top: top - step });
            break;
          case "ArrowDown":
            activeObj.set({ top: top + step });
            break;
          case "ArrowLeft":
            activeObj.set({ left: left - step });
            break;
          case "ArrowRight":
            activeObj.set({ left: left + step });
            break;
        }
        canvas.renderAll();
        // Only save history on key up to avoid flooding
        return;
      }

      // Ctrl+[ and Ctrl+]: Rotate by 15° (or 1° with Shift)
      if ((e.ctrlKey || e.metaKey) && (e.key === "[" || e.key === "]")) {
        e.preventDefault();
        const rotateStep = e.shiftKey ? 1 : 15;
        const currentAngle = activeObj.angle || 0;
        const newAngle = e.key === "]" ? currentAngle + rotateStep : currentAngle - rotateStep;
        activeObj.rotate(newAngle);
        canvas.renderAll();
        saveHistory();
        return;
      }

      // Ctrl+0: Reset rotation
      if ((e.ctrlKey || e.metaKey) && e.key === "0") {
        e.preventDefault();
        activeObj.rotate(0);
        canvas.renderAll();
        saveHistory();
        return;
      }
    };

    // Save history on arrow key up (for nudge)
    const handleKeyUp = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        const canvas = fabricRef.current;
        if (canvas && activeTool === "select") {
          saveHistory();
        }
      }
    };

    window.addEventListener("keydown", handleAdvancedKeys);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleAdvancedKeys);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [activeTool, saveHistory]);

  // Modifier keys tracking (Shift, Alt, Ctrl) for constraint drawing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const newModifiers = {
        shift: e.shiftKey,
        alt: e.altKey,
        ctrl: e.ctrlKey || e.metaKey,
      };
      modifiersRef.current = newModifiers;
      setModifiers(newModifiers);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const newModifiers = {
        shift: e.shiftKey,
        alt: e.altKey,
        ctrl: e.ctrlKey || e.metaKey,
      };
      modifiersRef.current = newModifiers;
      setModifiers(newModifiers);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Main event handlers
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const handleMouseDown = (opt: fabric.IEvent) => {
      // Text tool
      if (activeTool === "text") {
        if (textToolState === "editing") {
          const target = opt.target;
          if (!target || target.type !== "i-text") {
            canvas.discardActiveObject();
            setTextToolState("idle");
            setActiveTool("select");
            canvas.renderAll();
            return;
          }
          return;
        }

        const pointer = canvas.getPointer(opt.e);
        const text = new fabric.IText("Text", {
          left: pointer.x,
          top: pointer.y,
          fontSize: config.fontSize,
          fontFamily: config.fontFamily,
          fontWeight: config.fontWeight as any,
          fill: config.strokeColor,
          textAlign: config.textAlign,
          lineHeight: config.lineHeight,
          charSpacing: config.charSpacing,
          selectable: true,
          evented: true,
          shadow: config.textShadow ? new fabric.Shadow({ color: config.textShadowColor, blur: config.textShadowBlur, offsetX: config.textShadowOffsetX, offsetY: config.textShadowOffsetY }) : undefined,
          stroke: config.textStroke ? config.textStrokeColor : undefined,
          strokeWidth: config.textStroke ? config.textStrokeWidth : 0,
          data: { type: "text" },
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        text.enterEditing();
        text.selectAll();
        setTextToolState("editing");
        return;
      }

      if (activeTool === "select" || activeTool === "freehand" || activeTool === "marker") return;

      // Crop - only allow one
      if (activeTool === "crop" && overlayState.hasCrop) {
        return;
      }

      const pointer = canvas.getPointer(opt.e);
      const mouseEvent = opt.e as MouseEvent;

      // Update modifiers from actual mouse event
      modifiersRef.current = {
        shift: mouseEvent.shiftKey,
        alt: mouseEvent.altKey,
        ctrl: mouseEvent.ctrlKey || mouseEvent.metaKey,
      };
      setModifiers(modifiersRef.current);

      isDrawingRef.current = true;
      startPointRef.current = { x: pointer.x, y: pointer.y };
      setStartPoint({ x: pointer.x, y: pointer.y });
      setShowGuides(true);
      setGuideMode("drawing");
      setCurrentPoint({ x: pointer.x, y: pointer.y });

      let obj: fabric.Object | null = null;

      // Get line preset for line tool
      const linePreset = LINE_PRESETS.find((p) => p.id === activePresets.line);
      const arrowPreset = ARROW_PRESETS.find((p) => p.id === activePresets.arrow);

      switch (activeTool) {
        case "arrow":
          // Create initial arrow preview group
          obj = createArrowPreview(pointer.x, pointer.y, pointer.x, pointer.y, config.strokeWidth, config.strokeColor, activePresets.arrow === "arrow-curved", arrowPreset?.style.strokeDashArray);
          break;

        case "line":
          obj = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
            stroke: config.strokeColor,
            strokeWidth: config.strokeWidth, // Use config directly, not preset
            strokeDashArray: linePreset?.style.strokeDashArray,
            selectable: false,
            evented: false,
            strokeLineCap: "round",
            data: { type: "line" },
          });
          break;

        case "rectangle":
          obj = new fabric.Rect({
            left: pointer.x,
            top: pointer.y,
            width: 0,
            height: 0,
            stroke: config.strokeColor,
            strokeWidth: config.filled ? 0 : config.strokeWidth,
            fill: config.filled ? (config.fillColor !== "transparent" ? config.fillColor : config.strokeColor) : "transparent",
            rx: config.cornerRadius,
            ry: config.cornerRadius,
            opacity: config.opacity,
            selectable: false,
            evented: false,
            data: { type: "rectangle", filled: config.filled },
          });
          break;

        case "ellipse":
          obj = new fabric.Ellipse({
            left: pointer.x,
            top: pointer.y,
            rx: 0,
            ry: 0,
            stroke: config.strokeColor,
            strokeWidth: config.filled ? 0 : config.strokeWidth,
            fill: config.filled ? (config.fillColor !== "transparent" ? config.fillColor : config.strokeColor) : "transparent",
            originX: "center",
            originY: "center",
            opacity: config.opacity,
            selectable: false,
            evented: false,
            data: { type: "ellipse", filled: config.filled },
          });
          break;

        case "numbering":
          const group = createNumberMarker(pointer.x, pointer.y, numberingCounter, config.strokeColor);
          canvas.add(group);
          incrementNumbering();
          isDrawingRef.current = false;
          setShowGuides(false);
          setStartPoint(null);
          saveHistory();
          return;

        case "spotlight":
          // Preview shape matches selected shape
          if (config.spotlightShape === "circle") {
            obj = new fabric.Circle({
              left: pointer.x,
              top: pointer.y,
              radius: 0,
              stroke: "#3b82f6",
              strokeWidth: 2,
              strokeDashArray: [6, 3],
              fill: "rgba(59, 130, 246, 0.15)",
              originX: "center",
              originY: "center",
              selectable: false,
              evented: false,
              data: { type: "spotlight-preview" },
            });
          } else {
            obj = new fabric.Rect({
              left: pointer.x,
              top: pointer.y,
              width: 0,
              height: 0,
              stroke: "#3b82f6",
              strokeWidth: 2,
              strokeDashArray: [6, 3],
              fill: "rgba(59, 130, 246, 0.15)",
              rx: config.spotlightShape === "rounded" ? 16 : 0,
              ry: config.spotlightShape === "rounded" ? 16 : 0,
              selectable: false,
              evented: false,
              data: { type: "spotlight-preview" },
            });
          }
          break;

        case "blur":
          obj = new fabric.Rect({
            left: pointer.x,
            top: pointer.y,
            width: 0,
            height: 0,
            fill: "transparent",
            stroke: "#8b5cf6",
            strokeWidth: 2,
            strokeDashArray: [4, 4],
            selectable: false,
            evented: false,
            data: { type: "blur-preview" },
          });
          break;

        case "crop":
          obj = new fabric.Rect({
            left: pointer.x,
            top: pointer.y,
            width: 0,
            height: 0,
            stroke: "#3b82f6",
            strokeWidth: 2,
            strokeDashArray: [6, 3],
            fill: "rgba(59, 130, 246, 0.1)",
            selectable: false,
            evented: false,
            data: { type: "crop-preview" },
          });
          break;
      }

      if (obj) {
        currentObjectRef.current = obj;
        canvas.add(obj);
        canvas.renderAll();
      }
    };

    const handleMouseMove = (opt: fabric.IEvent) => {
      if (!isDrawingRef.current || !startPointRef.current || !currentObjectRef.current) return;

      const pointer = canvas.getPointer(opt.e);
      const mouseEvent = opt.e as MouseEvent;
      const start = startPointRef.current;
      const obj = currentObjectRef.current;

      // Update modifiers in real-time
      const currentModifiers = {
        shift: mouseEvent.shiftKey,
        alt: mouseEvent.altKey,
        ctrl: mouseEvent.ctrlKey || mouseEvent.metaKey,
      };
      modifiersRef.current = currentModifiers;
      setModifiers(currentModifiers);
      setCurrentPoint({ x: pointer.x, y: pointer.y });

      // Calculate constrained coordinates
      let targetX = pointer.x;
      let targetY = pointer.y;
      let constrainedWidth = Math.abs(pointer.x - start.x);
      let constrainedHeight = Math.abs(pointer.y - start.y);

      // SHIFT: Constraint to perfect shapes or 45° angles
      if (currentModifiers.shift) {
        if (activeTool === "line" || activeTool === "arrow") {
          // Snap to 0°, 45°, 90°, 135°, 180° etc.
          const dx = pointer.x - start.x;
          const dy = pointer.y - start.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx);
          const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
          targetX = start.x + Math.cos(snappedAngle) * distance;
          targetY = start.y + Math.sin(snappedAngle) * distance;
        } else {
          // Perfect square/circle - use the larger dimension
          const maxDim = Math.max(constrainedWidth, constrainedHeight);
          constrainedWidth = maxDim;
          constrainedHeight = maxDim;
          // Adjust target based on direction
          targetX = start.x + (pointer.x >= start.x ? maxDim : -maxDim);
          targetY = start.y + (pointer.y >= start.y ? maxDim : -maxDim);
        }
      }

      // Calculate drawing info for tooltip
      const dx = targetX - start.x;
      const dy = targetY - start.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      setDrawingInfo({
        width: constrainedWidth,
        height: constrainedHeight,
        distance: activeTool === "line" || activeTool === "arrow" ? distance : undefined,
        angle: activeTool === "line" || activeTool === "arrow" ? (angle + 360) % 360 : undefined,
      });

      switch (activeTool) {
        case "arrow":
          // Remove old preview and create new one with updated end point
          canvas.remove(obj);
          endPointRef.current = { x: targetX, y: targetY };
          const arrowPreset = ARROW_PRESETS.find((p) => p.id === activePresets.arrow);
          const newPreview = createArrowPreview(start.x, start.y, targetX, targetY, config.strokeWidth, config.strokeColor, activePresets.arrow === "arrow-curved", arrowPreset?.style.strokeDashArray);
          currentObjectRef.current = newPreview;
          canvas.add(newPreview);
          break;

        case "line":
          (obj as fabric.Line).set({ x2: targetX, y2: targetY });
          break;

        case "rectangle":
        case "blur":
        case "crop":
          if (currentModifiers.alt) {
            // ALT: Draw from center
            const halfW = constrainedWidth;
            const halfH = constrainedHeight;
            (obj as fabric.Rect).set({
              left: start.x - halfW,
              top: start.y - halfH,
              width: halfW * 2,
              height: halfH * 2,
            });
            setDrawingInfo({ width: halfW * 2, height: halfH * 2 });
          } else {
            // Normal: Draw from corner
            const left = currentModifiers.shift ? (pointer.x >= start.x ? start.x : start.x - constrainedWidth) : Math.min(start.x, pointer.x);
            const top = currentModifiers.shift ? (pointer.y >= start.y ? start.y : start.y - constrainedHeight) : Math.min(start.y, pointer.y);
            (obj as fabric.Rect).set({
              left,
              top,
              width: constrainedWidth,
              height: constrainedHeight,
            });
          }
          break;

        case "ellipse":
          if (currentModifiers.alt) {
            // ALT: Draw from center (ellipse already uses center origin)
            const rx = constrainedWidth;
            const ry = currentModifiers.shift ? constrainedWidth : constrainedHeight;
            (obj as fabric.Ellipse).set({ left: start.x, top: start.y, rx, ry });
            setDrawingInfo({ width: rx * 2, height: ry * 2 });
          } else {
            // Normal: Bounding box style
            const rx = constrainedWidth / 2;
            const ry = currentModifiers.shift ? constrainedWidth / 2 : constrainedHeight / 2;
            const cx = (start.x + (currentModifiers.shift ? (pointer.x >= start.x ? start.x + constrainedWidth : start.x - constrainedWidth) : pointer.x)) / 2;
            const cy = (start.y + (currentModifiers.shift ? (pointer.y >= start.y ? start.y + constrainedHeight : start.y - constrainedHeight) : pointer.y)) / 2;
            (obj as fabric.Ellipse).set({ left: cx, top: cy, rx, ry });
          }
          break;

        case "spotlight":
          if (config.spotlightShape === "circle") {
            if (currentModifiers.alt) {
              // Draw from center
              const radius = Math.max(constrainedWidth, constrainedHeight);
              (obj as fabric.Circle).set({ left: start.x, top: start.y, radius });
              setDrawingInfo({ width: radius * 2, height: radius * 2 });
            } else {
              const radius = Math.max(constrainedWidth, constrainedHeight) / 2;
              const ccx = (start.x + pointer.x) / 2;
              const ccy = (start.y + pointer.y) / 2;
              (obj as fabric.Circle).set({ left: ccx, top: ccy, radius });
            }
          } else {
            if (currentModifiers.alt) {
              // Draw from center
              const w = currentModifiers.shift ? Math.max(constrainedWidth, constrainedHeight) : constrainedWidth;
              const h = currentModifiers.shift ? Math.max(constrainedWidth, constrainedHeight) : constrainedHeight;
              (obj as fabric.Rect).set({
                left: start.x - w,
                top: start.y - h,
                width: w * 2,
                height: h * 2,
              });
              setDrawingInfo({ width: w * 2, height: h * 2 });
            } else {
              const w = currentModifiers.shift ? Math.max(constrainedWidth, constrainedHeight) : constrainedWidth;
              const h = currentModifiers.shift ? Math.max(constrainedWidth, constrainedHeight) : constrainedHeight;
              const sleft = currentModifiers.shift ? (pointer.x >= start.x ? start.x : start.x - w) : Math.min(start.x, pointer.x);
              const stop = currentModifiers.shift ? (pointer.y >= start.y ? start.y : start.y - h) : Math.min(start.y, pointer.y);
              (obj as fabric.Rect).set({ left: sleft, top: stop, width: w, height: h });
            }
          }
          break;
      }

      canvas.renderAll();
    };

    const handleMouseUp = async () => {
      if (!isDrawingRef.current) return;

      const canvas = fabricRef.current;
      if (!canvas || !currentObjectRef.current) return;

      const obj = currentObjectRef.current;

      // Hide guides and reset drawing info
      setShowGuides(false);
      setStartPoint(null);
      setDrawingInfo(null);
      setCurrentPoint(null);

      // Handle spotlight - additive holes
      if (activeTool === "spotlight") {
        canvas.remove(obj);

        let hole: fabric.Object | null = null;
        if (config.spotlightShape === "circle") {
          const circle = obj as fabric.Circle;
          if ((circle.radius || 0) > 10) {
            hole = new fabric.Circle({
              radius: circle.radius,
              left: circle.left,
              top: circle.top,
              originX: "center",
              originY: "center",
              absolutePositioned: true,
            });
          }
        } else {
          const rect = obj as fabric.Rect;
          if ((rect.width || 0) > 10 && (rect.height || 0) > 10) {
            hole = new fabric.Rect({
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
              rx: config.spotlightShape === "rounded" ? 16 : 0,
              ry: config.spotlightShape === "rounded" ? 16 : 0,
              absolutePositioned: true,
            });
          }
        }
        if (hole) {
          overlayState.spotlightHoles.push(hole);
          updateSpotlightOverlay(canvas, width, height, config.spotlightDarkness, config.spotlightColor);
          saveHistory();
        }
      }

      // Handle blur - capture region and apply real blur
      if (activeTool === "blur") {
        const rect = obj as fabric.Rect;
        canvas.remove(obj);

        if ((rect.width || 0) > 10 && (rect.height || 0) > 10) {
          const blurRect = await createBlurRect(rect.left || 0, rect.top || 0, rect.width || 0, rect.height || 0, config.blurStyle, config.blurIntensity, imageMode, screenCapture);
          canvas.add(blurRect);
          canvas.setActiveObject(blurRect); // Auto-select the new blur
          setActiveTool("select"); // Switch to select mode for editing
          saveHistory();
        }
      }

      // Handle crop - only one allowed
      if (activeTool === "crop") {
        const rect = obj as fabric.Rect;
        canvas.remove(obj);

        if ((rect.width || 0) > 10 && (rect.height || 0) > 10) {
          // Remove existing crop
          if (overlayState.cropOverlay) {
            canvas.remove(overlayState.cropOverlay);
          }

          const bounds = {
            left: rect.left || 0,
            top: rect.top || 0,
            width: rect.width || 0,
            height: rect.height || 0,
          };

          overlayState.cropOverlay = createCropOverlay(bounds, width, height);
          overlayState.cropBounds = bounds;
          overlayState.hasCrop = true;
          canvas.add(overlayState.cropOverlay);
          (canvas as any).cropBounds = bounds;
          saveHistory();
        }
      }

      // Handle arrow - create final arrow from preview
      if (activeTool === "arrow") {
        canvas.remove(obj);

        const start = startPointRef.current;
        const end = endPointRef.current;
        if (!start || !end) return;

        const x1 = start.x;
        const y1 = start.y;
        const x2 = end.x;
        const y2 = end.y;

        const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        if (length > 10) {
          const arrowPreset = ARROW_PRESETS.find((p) => p.id === activePresets.arrow);

          const arrowGroup = createArrow(x1, y1, x2, y2, {
            strokeWidth: config.strokeWidth,
            color: config.strokeColor,
            dashArray: arrowPreset?.style.strokeDashArray,
            isDouble: activePresets.arrow === "arrow-double",
            isCurved: activePresets.arrow === "arrow-curved",
          });

          canvas.add(arrowGroup);
          canvas.setActiveObject(arrowGroup);
          setActiveTool("select");
          saveHistory();
        }
      }

      // Make other shapes selectable and auto-select
      if (["line", "rectangle", "ellipse"].includes(activeTool)) {
        obj.set({ selectable: true, evented: true });
        canvas.setActiveObject(obj); // Auto-select
        setActiveTool("select"); // Switch to select mode
        saveHistory();
      }

      isDrawingRef.current = false;
      startPointRef.current = null;
      endPointRef.current = null;
      currentObjectRef.current = null;
      canvas.renderAll();
    };

    const handlePathCreated = () => saveHistory();
    const handleObjectModified = () => saveHistory();

    const handleTextEditingExited = () => {
      setTextToolState("idle");
      setActiveTool("select");
      saveHistory();
    };

    // Object moving handlers for smart guides
    const handleObjectMoving = (e: fabric.IEvent) => {
      const obj = e.target;
      if (!obj || obj.data?.type === "spotlight-overlay" || obj.data?.type === "crop-overlay") return;

      const objLeft = obj.left || 0;
      const objTop = obj.top || 0;
      const objWidth = obj.getScaledWidth();
      const objHeight = obj.getScaledHeight();
      const objCenterX = objLeft + objWidth / 2;
      const objCenterY = objTop + objHeight / 2;
      const objRight = objLeft + objWidth;
      const objBottom = objTop + objHeight;

      const canvasCenterX = width / 2;
      const canvasCenterY = height / 2;
      const SNAP_THRESHOLD = 8;

      // Calculate snap lines from other objects
      const verticalSnaps: number[] = [];
      const horizontalSnaps: number[] = [];

      canvas.getObjects().forEach((other) => {
        if (other === obj || other.data?.type === "spotlight-overlay" || other.data?.type === "crop-overlay") return;

        const otherLeft = other.left || 0;
        const otherTop = other.top || 0;
        const otherWidth = other.getScaledWidth();
        const otherHeight = other.getScaledHeight();
        const otherCenterX = otherLeft + otherWidth / 2;
        const otherCenterY = otherTop + otherHeight / 2;
        const otherRight = otherLeft + otherWidth;
        const otherBottom = otherTop + otherHeight;

        // Vertical alignments (left, center, right edges)
        if (Math.abs(objLeft - otherLeft) < SNAP_THRESHOLD) verticalSnaps.push(otherLeft);
        if (Math.abs(objLeft - otherCenterX) < SNAP_THRESHOLD) verticalSnaps.push(otherCenterX);
        if (Math.abs(objLeft - otherRight) < SNAP_THRESHOLD) verticalSnaps.push(otherRight);
        if (Math.abs(objCenterX - otherLeft) < SNAP_THRESHOLD) verticalSnaps.push(otherLeft);
        if (Math.abs(objCenterX - otherCenterX) < SNAP_THRESHOLD) verticalSnaps.push(otherCenterX);
        if (Math.abs(objCenterX - otherRight) < SNAP_THRESHOLD) verticalSnaps.push(otherRight);
        if (Math.abs(objRight - otherLeft) < SNAP_THRESHOLD) verticalSnaps.push(otherLeft);
        if (Math.abs(objRight - otherCenterX) < SNAP_THRESHOLD) verticalSnaps.push(otherCenterX);
        if (Math.abs(objRight - otherRight) < SNAP_THRESHOLD) verticalSnaps.push(otherRight);

        // Horizontal alignments (top, center, bottom edges)
        if (Math.abs(objTop - otherTop) < SNAP_THRESHOLD) horizontalSnaps.push(otherTop);
        if (Math.abs(objTop - otherCenterY) < SNAP_THRESHOLD) horizontalSnaps.push(otherCenterY);
        if (Math.abs(objTop - otherBottom) < SNAP_THRESHOLD) horizontalSnaps.push(otherBottom);
        if (Math.abs(objCenterY - otherTop) < SNAP_THRESHOLD) horizontalSnaps.push(otherTop);
        if (Math.abs(objCenterY - otherCenterY) < SNAP_THRESHOLD) horizontalSnaps.push(otherCenterY);
        if (Math.abs(objCenterY - otherBottom) < SNAP_THRESHOLD) horizontalSnaps.push(otherBottom);
        if (Math.abs(objBottom - otherTop) < SNAP_THRESHOLD) horizontalSnaps.push(otherTop);
        if (Math.abs(objBottom - otherCenterY) < SNAP_THRESHOLD) horizontalSnaps.push(otherCenterY);
        if (Math.abs(objBottom - otherBottom) < SNAP_THRESHOLD) horizontalSnaps.push(otherBottom);
      });

      // Snap to canvas center
      if (Math.abs(objCenterX - canvasCenterX) < SNAP_THRESHOLD) {
        obj.set({ left: canvasCenterX - objWidth / 2 });
      }
      if (Math.abs(objCenterY - canvasCenterY) < SNAP_THRESHOLD) {
        obj.set({ top: canvasCenterY - objHeight / 2 });
      }

      setSnapLines({ vertical: [...new Set(verticalSnaps)], horizontal: [...new Set(horizontalSnaps)] });
      setMovingObjectBounds({ left: obj.left || 0, top: obj.top || 0, width: objWidth, height: objHeight });
      setShowGuides(true);
      setGuideMode("moving");
    };

    const handleObjectMoved = () => {
      setShowGuides(false);
      setMovingObjectBounds(null);
      setSnapLines({ vertical: [], horizontal: [] });
    };

    // Object rotating with Shift snap to 15° increments
    const handleObjectRotating = (e: fabric.IEvent) => {
      const obj = e.target;
      if (!obj) return;

      // Check if Shift is held for 15° snap
      const event = e.e as MouseEvent;
      if (event?.shiftKey) {
        const currentAngle = obj.angle || 0;
        const snappedAngle = Math.round(currentAngle / 15) * 15;
        obj.rotate(snappedAngle);
      }
    };

    // Clear guides on selection change
    const handleSelectionCleared = () => {
      setShowGuides(false);
      setMovingObjectBounds(null);
      setSnapLines({ vertical: [], horizontal: [] });
    };

    const handleSelectionCreated = () => {
      // Clear any lingering guides when selecting new object
      if (guideMode === "moving") {
        setShowGuides(false);
        setMovingObjectBounds(null);
        setSnapLines({ vertical: [], horizontal: [] });
      }
    };

    canvas.on("mouse:down", handleMouseDown);
    canvas.on("mouse:move", handleMouseMove);
    canvas.on("mouse:up", handleMouseUp);
    canvas.on("path:created", handlePathCreated);
    canvas.on("object:modified", handleObjectModified);
    canvas.on("object:moving", handleObjectMoving);
    canvas.on("object:moved", handleObjectMoved);
    canvas.on("object:rotating", handleObjectRotating);
    canvas.on("selection:cleared", handleSelectionCleared);
    canvas.on("selection:created", handleSelectionCreated);
    canvas.on("selection:updated", handleSelectionCreated);
    canvas.on("text:editing:exited", handleTextEditingExited);

    return () => {
      canvas.off("mouse:down", handleMouseDown);
      canvas.off("mouse:move", handleMouseMove);
      canvas.off("mouse:up", handleMouseUp);
      canvas.off("path:created", handlePathCreated);
      canvas.off("object:modified", handleObjectModified);
      canvas.off("object:moving", handleObjectMoving);
      canvas.off("object:moved", handleObjectMoved);
      canvas.off("object:rotating", handleObjectRotating);
      canvas.off("selection:cleared", handleSelectionCleared);
      canvas.off("selection:created", handleSelectionCreated);
      canvas.off("selection:updated", handleSelectionCreated);
      canvas.off("text:editing:exited", handleTextEditingExited);
    };
  }, [activeTool, config, numberingCounter, incrementNumbering, saveHistory, width, height, activePresets, textToolState, setTextToolState, setActiveTool, guideMode]);

  return (
    <div className="absolute inset-0">
      {/* Canvas container - isolated for Fabric.js DOM manipulation */}
      <div className="absolute inset-0">
        <canvas ref={canvasRef} style={{ position: "absolute", top: 0, left: 0, cursor: activeTool === "select" ? "default" : "crosshair" }} />
      </div>
      {/* Smart guides overlay - for both drawing and moving */}
      {showGuides && <SmartGuides show={showGuides} mode={guideMode} objectBounds={movingObjectBounds} startPoint={startPoint} currentPoint={currentPoint} canvasWidth={width} canvasHeight={height} modifiers={modifiers} drawingInfo={drawingInfo} activeTool={activeTool} snapLines={snapLines} />}
    </div>
  );
};

// ============================================
// MODERN ARROW SYSTEM
// ============================================

interface ArrowConfig {
  strokeWidth: number;
  color: string;
  dashArray?: number[];
  isDouble?: boolean;
  isCurved?: boolean;
}

// Create a complete arrow with V-shaped head
function createArrow(x1: number, y1: number, x2: number, y2: number, cfg: ArrowConfig): fabric.Group {
  const { strokeWidth, color, dashArray, isDouble, isCurved } = cfg;

  // Arrow head size scales with stroke width
  const headLength = Math.max(14, strokeWidth * 4);
  const headWidth = Math.max(8, strokeWidth * 2);

  if (isCurved) {
    return createCurvedArrowPath(x1, y1, x2, y2, strokeWidth, color, headLength, headWidth);
  }

  const angle = Math.atan2(y2 - y1, x2 - x1);

  // Main line (full length - head connects at end)
  const line = new fabric.Line([x1, y1, x2, y2], {
    stroke: color,
    strokeWidth: strokeWidth,
    strokeLineCap: "round",
    strokeDashArray: dashArray,
    selectable: false,
    evented: false,
  });

  // End arrowhead (V-shape)
  const endHead = createVArrowHead(x2, y2, angle, headLength, headWidth, strokeWidth, color);

  const items: fabric.Object[] = [line, endHead];

  // Start arrowhead for double arrow
  if (isDouble) {
    const startHead = createVArrowHead(x1, y1, angle + Math.PI, headLength, headWidth, strokeWidth, color);
    items.push(startHead);
  }

  return new fabric.Group(items, {
    selectable: true,
    evented: true,
    hasControls: true,
    hasBorders: true,
    lockScalingFlip: true,
    data: { type: "arrow" },
  });
}

// V-shaped arrowhead (open, like in the reference image)
function createVArrowHead(tipX: number, tipY: number, angle: number, length: number, width: number, strokeWidth: number, color: string): fabric.Path {
  // Calculate the two back points of the V
  const backAngle1 = angle + Math.PI - 0.5; // ~30 degrees spread
  const backAngle2 = angle + Math.PI + 0.5;

  const p1x = tipX + Math.cos(backAngle1) * length;
  const p1y = tipY + Math.sin(backAngle1) * length;
  const p2x = tipX + Math.cos(backAngle2) * length;
  const p2y = tipY + Math.sin(backAngle2) * length;

  // V-shape path: from one arm to tip to other arm
  const pathData = `M ${p1x} ${p1y} L ${tipX} ${tipY} L ${p2x} ${p2y}`;

  return new fabric.Path(pathData, {
    stroke: color,
    strokeWidth: Math.max(strokeWidth, 2),
    strokeLineCap: "round",
    strokeLineJoin: "round",
    fill: "transparent",
    selectable: false,
    evented: false,
  });
}

// Curved arrow with quadratic bezier and V-head - curves based on drag direction
function createCurvedArrowPath(x1: number, y1: number, x2: number, y2: number, strokeWidth: number, color: string, headLength: number, headWidth: number): fabric.Group {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);

  // Control point perpendicular to midpoint
  // Direction of curve based on whether we're going right or left
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  // Perpendicular direction - flip based on horizontal direction
  // If going right (dx > 0), curve upward (-y direction)
  // If going left (dx < 0), curve downward (+y direction)
  const curveDirection = dx >= 0 ? -1 : 1;
  const perpX = (curveDirection * -dy) / length;
  const perpY = (curveDirection * dx) / length;

  const curveOffset = length * 0.25;
  const cpX = midX + perpX * curveOffset;
  const cpY = midY + perpY * curveOffset;

  // Tangent angle at end point (derivative of quadratic bezier at t=1)
  const endAngle = Math.atan2(y2 - cpY, x2 - cpX);

  // SVG path for quadratic bezier (full length)
  const pathData = `M ${x1} ${y1} Q ${cpX} ${cpY} ${x2} ${y2}`;

  const curvePath = new fabric.Path(pathData, {
    stroke: color,
    strokeWidth: strokeWidth,
    fill: "transparent",
    strokeLineCap: "round",
    selectable: false,
    evented: false,
  });

  const arrowHead = createVArrowHead(x2, y2, endAngle, headLength, headWidth, strokeWidth, color);

  return new fabric.Group([curvePath, arrowHead], {
    selectable: true,
    evented: true,
    hasControls: true,
    hasBorders: true,
    lockScalingFlip: true,
    data: { type: "arrow", preset: "arrow-curved" },
  });
}

// Create arrow preview (for live drawing) - includes curve and head
function createArrowPreview(x1: number, y1: number, x2: number, y2: number, strokeWidth: number, color: string, isCurved: boolean, dashArray?: number[]): fabric.Group {
  const headLength = Math.max(14, strokeWidth * 4);
  const headWidth = Math.max(8, strokeWidth * 2);

  if (isCurved) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length < 10) {
      // Too short, just show a line
      const line = new fabric.Line([x1, y1, x2, y2], {
        stroke: color,
        strokeWidth: strokeWidth,
        strokeLineCap: "round",
        selectable: false,
        evented: false,
      });
      return new fabric.Group([line], { selectable: false, evented: false, data: { type: "arrow-preview" } });
    }

    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    // Curve direction based on horizontal movement
    const curveDirection = dx >= 0 ? -1 : 1;
    const perpX = (curveDirection * -dy) / length;
    const perpY = (curveDirection * dx) / length;

    const curveOffset = length * 0.25;
    const cpX = midX + perpX * curveOffset;
    const cpY = midY + perpY * curveOffset;
    const endAngle = Math.atan2(y2 - cpY, x2 - cpX);

    const pathData = `M ${x1} ${y1} Q ${cpX} ${cpY} ${x2} ${y2}`;
    const curvePath = new fabric.Path(pathData, {
      stroke: color,
      strokeWidth: strokeWidth,
      fill: "transparent",
      strokeLineCap: "round",
      selectable: false,
      evented: false,
    });

    const arrowHead = createVArrowHead(x2, y2, endAngle, headLength, headWidth, strokeWidth, color);

    return new fabric.Group([curvePath, arrowHead], {
      selectable: false,
      evented: false,
      data: { type: "arrow-preview" },
    });
  }

  // Straight arrow preview
  const angle = Math.atan2(y2 - y1, x2 - x1);

  const line = new fabric.Line([x1, y1, x2, y2], {
    stroke: color,
    strokeWidth: strokeWidth,
    strokeLineCap: "round",
    strokeDashArray: dashArray,
    selectable: false,
    evented: false,
  });

  const arrowHead = createVArrowHead(x2, y2, angle, headLength, headWidth, strokeWidth, color);

  return new fabric.Group([line, arrowHead], {
    selectable: false,
    evented: false,
    data: { type: "arrow-preview" },
  });
}

// Update spotlight with multiple holes
function updateSpotlightOverlay(canvas: fabric.Canvas, w: number, h: number, darkness: number, color: string = "#000000") {
  // Remove existing overlay
  if (overlayState.spotlightOverlay) {
    canvas.remove(overlayState.spotlightOverlay);
    overlayState.spotlightOverlay = null;
  }

  if (overlayState.spotlightHoles.length === 0) return;

  // Convert hex to rgba
  const hex = color.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  // Create new overlay
  overlayState.spotlightOverlay = new fabric.Rect({
    left: 0,
    top: 0,
    width: w,
    height: h,
    fill: `rgba(${r}, ${g}, ${b}, ${darkness})`,
    selectable: false,
    evented: false,
    data: { type: "spotlight-overlay" },
  });

  // Create group of holes for clip path
  const holesGroup = new fabric.Group(
    overlayState.spotlightHoles.map((hole) => fabric.util.object.clone(hole)),
    { absolutePositioned: true }
  );

  overlayState.spotlightOverlay.clipPath = holesGroup;
  (overlayState.spotlightOverlay.clipPath as any).inverted = true;

  canvas.add(overlayState.spotlightOverlay);
  canvas.sendToBack(overlayState.spotlightOverlay);
}

// Create blur rectangle with real blur effect
// In image mode or screen capture mode, extract region from the background instead of live capture
async function createBlurRect(x: number, y: number, w: number, h: number, style: string, intensity: number, imageMode?: ImageModeState, screenCapture?: ScreenCaptureState): Promise<fabric.Object> {
  // IMAGE MODE: Extract region from the background image (with contain scaling)
  if (imageMode?.isImageMode && imageMode.imageDataUrl) {
    try {
      const screenW = window.innerWidth;
      const screenH = window.innerHeight;
      const origW = imageMode.imageWidth;
      const origH = imageMode.imageHeight;

      // Calculate contain scale and offset (same as CSS background-size: contain)
      const scaleToFit = Math.min(screenW / origW, screenH / origH);
      const displayW = origW * scaleToFit;
      const displayH = origH * scaleToFit;
      const offsetX = (screenW - displayW) / 2;
      const offsetY = (screenH - displayH) / 2;

      // Convert screen coordinates to image coordinates
      const imgX = (x - offsetX) / scaleToFit;
      const imgY = (y - offsetY) / scaleToFit;
      const imgW = w / scaleToFit;
      const imgH = h / scaleToFit;

      // Extract region from image using canvas
      const regionDataUrl = await extractImageRegion(imageMode.imageDataUrl, imgX, imgY, imgW, imgH);

      if (regionDataUrl) {
        const processedDataUrl = await applyBlurEffect(regionDataUrl, style, intensity);
        return createBlurImage(processedDataUrl, x, y, w, style, intensity);
      }
    } catch (error) {
      console.error("Image mode blur failed:", error);
    }
  }

  // SCREEN CAPTURE MODE: Extract region from pre-captured background (instant, no IPC)
  if (screenCapture?.hasCapture && screenCapture.captureDataUrl) {
    try {
      // Screen capture is at physical pixel size, need to account for DPI
      const dpr = window.devicePixelRatio || 1;

      // Extract region directly from pre-captured image
      const regionDataUrl = await extractImageRegion(screenCapture.captureDataUrl, x * dpr, y * dpr, w * dpr, h * dpr);

      if (regionDataUrl) {
        const processedDataUrl = await applyBlurEffect(regionDataUrl, style, intensity);
        return createBlurImage(processedDataUrl, x, y, w, style, intensity);
      }
    } catch (error) {
      console.error("Screen capture blur failed:", error);
    }
  }

  // Fallback - semi-transparent overlay with pattern
  return new fabric.Rect({
    left: x,
    top: y,
    width: w,
    height: h,
    fill: "rgba(128, 128, 128, 0.7)",
    selectable: true,
    evented: true,
    rx: 4,
    ry: 4,
    data: { type: "blur", blurStyle: style, blurIntensity: intensity },
  });
}

// Helper: Apply blur effect based on style (gaussian or mosaic only)
async function applyBlurEffect(dataUrl: string, style: string, intensity: number): Promise<string> {
  if (style === "gaussian") {
    return applyCanvasBlur(dataUrl, intensity);
  } else {
    // mosaic
    return applyMosaic(dataUrl, intensity);
  }
}

// Helper: Create blur image fabric object with stored settings
function createBlurImage(dataUrl: string, x: number, y: number, w: number, style: string, intensity: number): Promise<fabric.Object> {
  return new Promise((resolve) => {
    fabric.Image.fromURL(dataUrl, (img) => {
      img.set({
        left: x,
        top: y,
        selectable: true,
        evented: true,
        data: { type: "blur", blurStyle: style, blurIntensity: intensity },
      });
      img.scaleToWidth(w);
      resolve(img);
    });
  });
}

// Extract a region from an image data URL
async function extractImageRegion(imageDataUrl: string, x: number, y: number, w: number, h: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Clamp coordinates to image bounds
      const clampedX = Math.max(0, Math.min(x, img.width));
      const clampedY = Math.max(0, Math.min(y, img.height));
      const clampedW = Math.min(w, img.width - clampedX);
      const clampedH = Math.min(h, img.height - clampedY);

      if (clampedW <= 0 || clampedH <= 0) {
        reject(new Error("Region outside image bounds"));
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = clampedW;
      canvas.height = clampedH;
      const ctx = canvas.getContext("2d")!;

      ctx.drawImage(img, clampedX, clampedY, clampedW, clampedH, 0, 0, clampedW, clampedH);

      resolve(canvas.toDataURL());
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = imageDataUrl;
  });
}

// Apply real blur using canvas filter
async function applyCanvasBlur(dataUrl: string, intensity: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;

      // Apply blur filter
      ctx.filter = `blur(${intensity}px)`;

      // Draw with extra margin to avoid edge artifacts
      const margin = intensity * 2;
      ctx.drawImage(img, -margin, -margin, img.width + margin * 2, img.height + margin * 2);

      resolve(canvas.toDataURL());
    };
    img.src = dataUrl;
  });
}

// Apply mosaic effect (pixelate with averaged color blocks)
async function applyMosaic(dataUrl: string, blockSize: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;

      // Draw original
      ctx.drawImage(img, 0, 0);

      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Process in blocks
      for (let y = 0; y < canvas.height; y += blockSize) {
        for (let x = 0; x < canvas.width; x += blockSize) {
          // Get average color of block
          let r = 0,
            g = 0,
            b = 0,
            count = 0;

          for (let by = 0; by < blockSize && y + by < canvas.height; by++) {
            for (let bx = 0; bx < blockSize && x + bx < canvas.width; bx++) {
              const idx = ((y + by) * canvas.width + (x + bx)) * 4;
              r += data[idx];
              g += data[idx + 1];
              b += data[idx + 2];
              count++;
            }
          }

          r = Math.round(r / count);
          g = Math.round(g / count);
          b = Math.round(b / count);

          // Fill block with average color
          for (let by = 0; by < blockSize && y + by < canvas.height; by++) {
            for (let bx = 0; bx < blockSize && x + bx < canvas.width; bx++) {
              const idx = ((y + by) * canvas.width + (x + bx)) * 4;
              data[idx] = r;
              data[idx + 1] = g;
              data[idx + 2] = b;
            }
          }
        }
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL());
    };
    img.src = dataUrl;
  });
}

// Create crop overlay
function createCropOverlay(bounds: { left: number; top: number; width: number; height: number }, w: number, h: number): fabric.Group {
  const color = "rgba(0, 0, 0, 0.6)";

  const top = new fabric.Rect({ left: 0, top: 0, width: w, height: bounds.top, fill: color, selectable: false, evented: false });
  const bottom = new fabric.Rect({ left: 0, top: bounds.top + bounds.height, width: w, height: h - bounds.top - bounds.height, fill: color, selectable: false, evented: false });
  const left = new fabric.Rect({ left: 0, top: bounds.top, width: bounds.left, height: bounds.height, fill: color, selectable: false, evented: false });
  const right = new fabric.Rect({ left: bounds.left + bounds.width, top: bounds.top, width: w - bounds.left - bounds.width, height: bounds.height, fill: color, selectable: false, evented: false });
  const border = new fabric.Rect({ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height, fill: "transparent", stroke: "#3b82f6", strokeWidth: 2, strokeDashArray: [8, 4], selectable: false, evented: false });

  return new fabric.Group([top, bottom, left, right, border], {
    selectable: false,
    evented: false,
    data: { type: "crop-overlay" },
  });
}

// Create numbered marker with contrast text
function createNumberMarker(x: number, y: number, num: number, color: string): fabric.Group {
  // Calculate luminance to determine text color
  const hex = color.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  const textColor = luminance > 0.5 ? "#000000" : "#ffffff";

  const circle = new fabric.Circle({
    radius: 14,
    fill: color,
    originX: "center",
    originY: "center",
    shadow: new fabric.Shadow({ color: "rgba(0,0,0,0.3)", blur: 4, offsetX: 1, offsetY: 1 }),
  });

  const text = new fabric.Text(String(num), {
    fontSize: 14,
    fontFamily: "Inter, system-ui, sans-serif",
    fontWeight: "bold",
    fill: textColor,
    originX: "center",
    originY: "center",
  });

  return new fabric.Group([circle, text], {
    left: x,
    top: y,
    originX: "center",
    originY: "center",
    selectable: true,
    evented: true,
    data: { type: "numbering", bgColor: color },
  });
}
