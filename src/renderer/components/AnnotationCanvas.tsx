import React, { useEffect, useRef, useCallback } from "react";
import { fabric } from "fabric";
import { useToolStore } from "../stores/useToolStore";
import { useCanvasStore } from "../stores/useCanvasStore";
import { MARKER_PRESETS, ARROW_PRESETS, LINE_PRESETS } from "../shared/presets";

interface AnnotationCanvasProps {
  width: number;
  height: number;
}

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
export const resetOverlayState = () => {
  overlayState.spotlightHoles = [];
  overlayState.spotlightOverlay = null;
  overlayState.cropOverlay = null;
  overlayState.hasCrop = false;
  overlayState.cropBounds = null;
};

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

export const AnnotationCanvas: React.FC<AnnotationCanvasProps> = ({ width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const isDrawingRef = useRef(false);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const endPointRef = useRef<{ x: number; y: number } | null>(null);
  const currentObjectRef = useRef<fabric.Object | null>(null);

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
      isDrawingRef.current = true;
      startPointRef.current = { x: pointer.x, y: pointer.y };

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
      const start = startPointRef.current;
      const obj = currentObjectRef.current;

      switch (activeTool) {
        case "arrow":
          // Remove old preview and create new one with updated end point
          canvas.remove(obj);
          endPointRef.current = { x: pointer.x, y: pointer.y };
          const arrowPreset = ARROW_PRESETS.find((p) => p.id === activePresets.arrow);
          const newPreview = createArrowPreview(start.x, start.y, pointer.x, pointer.y, config.strokeWidth, config.strokeColor, activePresets.arrow === "arrow-curved", arrowPreset?.style.strokeDashArray);
          currentObjectRef.current = newPreview;
          canvas.add(newPreview);
          break;

        case "line":
          (obj as fabric.Line).set({ x2: pointer.x, y2: pointer.y });
          break;

        case "rectangle":
        case "blur":
        case "crop":
          const left = Math.min(start.x, pointer.x);
          const top = Math.min(start.y, pointer.y);
          const w = Math.abs(pointer.x - start.x);
          const h = Math.abs(pointer.y - start.y);
          (obj as fabric.Rect).set({ left, top, width: w, height: h });
          break;

        case "ellipse":
          const rx = Math.abs(pointer.x - start.x) / 2;
          const ry = Math.abs(pointer.y - start.y) / 2;
          const cx = (start.x + pointer.x) / 2;
          const cy = (start.y + pointer.y) / 2;
          (obj as fabric.Ellipse).set({ left: cx, top: cy, rx, ry });
          break;

        case "spotlight":
          if (config.spotlightShape === "circle") {
            const radius = Math.max(Math.abs(pointer.x - start.x), Math.abs(pointer.y - start.y)) / 2;
            const ccx = (start.x + pointer.x) / 2;
            const ccy = (start.y + pointer.y) / 2;
            (obj as fabric.Circle).set({ left: ccx, top: ccy, radius });
          } else {
            const sleft = Math.min(start.x, pointer.x);
            const stop = Math.min(start.y, pointer.y);
            const sw = Math.abs(pointer.x - start.x);
            const sh = Math.abs(pointer.y - start.y);
            (obj as fabric.Rect).set({ left: sleft, top: stop, width: sw, height: sh });
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
          const blurRect = await createBlurRect(rect.left || 0, rect.top || 0, rect.width || 0, rect.height || 0, config.blurStyle, config.blurIntensity);
          canvas.add(blurRect);
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

    canvas.on("mouse:down", handleMouseDown);
    canvas.on("mouse:move", handleMouseMove);
    canvas.on("mouse:up", handleMouseUp);
    canvas.on("path:created", handlePathCreated);
    canvas.on("object:modified", handleObjectModified);
    canvas.on("text:editing:exited", handleTextEditingExited);

    return () => {
      canvas.off("mouse:down", handleMouseDown);
      canvas.off("mouse:move", handleMouseMove);
      canvas.off("mouse:up", handleMouseUp);
      canvas.off("path:created", handlePathCreated);
      canvas.off("object:modified", handleObjectModified);
      canvas.off("text:editing:exited", handleTextEditingExited);
    };
  }, [activeTool, config, numberingCounter, incrementNumbering, saveHistory, width, height, activePresets, textToolState, setTextToolState, setActiveTool]);

  return <canvas ref={canvasRef} style={{ position: "absolute", top: 0, left: 0, cursor: activeTool === "select" ? "default" : "crosshair" }} />;
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
async function createBlurRect(x: number, y: number, w: number, h: number, style: string, intensity: number): Promise<fabric.Object> {
  // Always try to capture the region for real effect
  if (window.electronAPI?.captureRegion) {
    try {
      const regionDataUrl = await window.electronAPI.captureRegion(x, y, w, h);
      if (regionDataUrl) {
        let processedDataUrl: string;

        if (style === "blur") {
          // Apply gaussian blur
          processedDataUrl = await applyCanvasBlur(regionDataUrl, intensity);
        } else if (style === "pixelate") {
          // Apply pixelation
          processedDataUrl = await applyPixelation(regionDataUrl, intensity);
        } else {
          // Mosaic - pixelate with color variation
          processedDataUrl = await applyMosaic(regionDataUrl, intensity);
        }

        return new Promise((resolve) => {
          fabric.Image.fromURL(processedDataUrl, (img) => {
            img.set({
              left: x,
              top: y,
              selectable: true,
              evented: true,
              data: { type: "blur", style },
            });
            img.scaleToWidth(w);
            resolve(img);
          });
        });
      }
    } catch (error) {
      console.error("Blur capture failed:", error);
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
    data: { type: "blur", style },
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

// Apply pixelation effect
async function applyPixelation(dataUrl: string, blockSize: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;

      // Draw small then scale up for pixelation
      const smallW = Math.ceil(img.width / blockSize);
      const smallH = Math.ceil(img.height / blockSize);

      // Create small canvas
      const smallCanvas = document.createElement("canvas");
      smallCanvas.width = smallW;
      smallCanvas.height = smallH;
      const smallCtx = smallCanvas.getContext("2d")!;

      // Draw image small
      smallCtx.drawImage(img, 0, 0, smallW, smallH);

      // Scale up with nearest neighbor (pixelated)
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(smallCanvas, 0, 0, smallW, smallH, 0, 0, img.width, img.height);

      resolve(canvas.toDataURL());
    };
    img.src = dataUrl;
  });
}

// Apply mosaic effect (pixelate with slight color shift)
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
