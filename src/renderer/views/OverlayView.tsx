import React, { useEffect, useState, useCallback, useRef } from "react";
import { fabric } from "fabric";
import { ToolPanel } from "../components/ToolPanel";
import { OptionsPanel } from "../components/OptionsPanel";
import { AnnotationCanvas, resetOverlayState, getOverlayState, syncSpotlightFromHistory } from "../components/AnnotationCanvas";
import { SaveDialog, SaveOptions } from "../components/SaveDialog";
import { useCanvasStore } from "../stores/useCanvasStore";
import { useToolStore } from "../stores/useToolStore";

export const OverlayView: React.FC = () => {
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [isReady, setIsReady] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const mountedRef = useRef(false);

  const { canvas, clearHistory } = useCanvasStore();
  const { resetNumbering, setActiveTool } = useToolStore();

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    setIsReady(true);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const showNotification = useCallback((message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 2000);
  }, []);

  const handleSaveWithOptions = useCallback(
    async (options: SaveOptions) => {
      if (!canvas) return;
      try {
        const overlayStateData = getOverlayState();
        const bounds = overlayStateData.cropBounds || (canvas as any).cropBounds;

        // Store original states
        const originalBg = canvas.backgroundColor;
        const objectsToRestore: { obj: fabric.Object; visible: boolean }[] = [];

        // Hide crop overlay visual (we'll apply crop via bounds)
        canvas.forEachObject((obj: fabric.Object) => {
          if (obj.data?.type === "crop-overlay") {
            objectsToRestore.push({ obj, visible: obj.visible !== false });
            obj.visible = false;
          }
        });

        // Capture screen background if requested
        if (options.includeBackground && window.electronAPI?.captureScreen) {
          console.log("[SAVE] Requesting screen capture with background...");
          const screenDataUrl = await window.electronAPI.captureScreen();
          console.log("[SAVE] Screen capture result:", screenDataUrl ? `Got ${screenDataUrl.length} chars` : "null");

          if (screenDataUrl) {
            // Get device pixel ratio for proper scaling
            const dpr = window.devicePixelRatio || 1;

            // Create background image from screen capture
            const bgImg = await new Promise<fabric.Image>((resolve, reject) => {
              fabric.Image.fromURL(
                screenDataUrl,
                (img) => {
                  if (!img) {
                    reject(new Error("Failed to create image from data URL"));
                    return;
                  }

                  // Background image is at physical pixel size (dimensions * dpr)
                  // Canvas objects are at CSS pixel coordinates
                  // We need to scale background down to match CSS coordinates
                  const scaleX = dimensions.width / (img.width || dimensions.width);
                  const scaleY = dimensions.height / (img.height || dimensions.height);

                  img.set({
                    left: 0,
                    top: 0,
                    scaleX: scaleX,
                    scaleY: scaleY,
                    selectable: false,
                    evented: false,
                  });

                  console.log(`[SAVE] Background image: ${img.width}x${img.height}, scaled to ${scaleX.toFixed(2)}x${scaleY.toFixed(2)}, dpr: ${dpr}`);
                  resolve(img);
                },
                { crossOrigin: "anonymous" }
              );
            });

            // Add to back of canvas temporarily
            canvas.add(bgImg);
            canvas.sendToBack(bgImg);
            canvas.renderAll();

            console.log("[SAVE] Background added to canvas");

            // Export at 1x scale - background is already scaled to match canvas coordinates
            const exportOptions: any = {
              format: options.format,
              quality: options.quality,
              multiplier: 1,
            };

            if (bounds && bounds.width > 0 && bounds.height > 0) {
              exportOptions.left = bounds.left;
              exportOptions.top = bounds.top;
              exportOptions.width = bounds.width;
              exportOptions.height = bounds.height;
            }

            const dataUrl = canvas.toDataURL(exportOptions);
            console.log(`[SAVE] Exported with background, data URL length: ${dataUrl.length}`);

            // Remove background image
            canvas.remove(bgImg);
            canvas.renderAll();

            // Restore states
            objectsToRestore.forEach(({ obj, visible }) => {
              obj.visible = visible;
            });
            canvas.renderAll();

            // Save file
            const filePath = await window.electronAPI.saveAnnotation(dataUrl);
            if (filePath) {
              showNotification("Saved with background!");
              window.electronAPI.showDragWidget(filePath);

              setTimeout(() => {
                if (canvas) {
                  canvas.clear();
                  canvas.backgroundColor = "transparent";
                  canvas.renderAll();
                }
                clearHistory();
                resetNumbering();
                resetOverlayState();
                window.electronAPI?.closeOverlay();
              }, 500);
            }
            return;
          } else {
            console.log("[SAVE] Screen capture returned null, falling back to transparent");
          }
        }

        // Standard export without background
        canvas.renderAll();

        const exportOptions: any = {
          format: options.format,
          quality: options.quality,
          multiplier: window.devicePixelRatio || 1,
        };

        if (bounds && bounds.width > 0 && bounds.height > 0) {
          exportOptions.left = bounds.left;
          exportOptions.top = bounds.top;
          exportOptions.width = bounds.width;
          exportOptions.height = bounds.height;
        }

        const dataUrl = canvas.toDataURL(exportOptions);

        // Restore original states
        canvas.backgroundColor = originalBg;
        objectsToRestore.forEach(({ obj, visible }) => {
          obj.visible = visible;
        });
        canvas.renderAll();

        if (window.electronAPI) {
          const filePath = await window.electronAPI.saveAnnotation(dataUrl);
          if (filePath) {
            showNotification("Saved!");
            window.electronAPI.showDragWidget(filePath);

            setTimeout(() => {
              if (canvas) {
                canvas.clear();
                canvas.backgroundColor = "transparent";
                canvas.renderAll();
              }
              clearHistory();
              resetNumbering();
              resetOverlayState();
              window.electronAPI?.closeOverlay();
            }, 500);
          }
        } else {
          const link = document.createElement("a");
          link.download = `annotation_${Date.now()}.${options.format}`;
          link.href = dataUrl;
          link.click();
          showNotification("Downloaded!");
        }
      } catch (error) {
        console.error("Save failed:", error);
        showNotification("Save failed");
      }
    },
    [canvas, showNotification, clearHistory, resetNumbering, dimensions]
  );

  const handleQuickSave = useCallback(() => setShowSaveDialog(true), []);

  const handleClear = useCallback(() => {
    if (!canvas) return;
    canvas.clear();
    canvas.backgroundColor = "transparent";
    canvas.renderAll();
    clearHistory();
    resetNumbering();
    resetOverlayState(); // Clear spotlight/crop state
    showNotification("Cleared");
  }, [canvas, clearHistory, resetNumbering, showNotification]);

  const handleClose = useCallback(() => {
    if (window.electronAPI) window.electronAPI.closeOverlay();
  }, []);

  const handleOpenSettings = useCallback(() => {
    if (window.electronAPI) window.electronAPI.openSettings();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "Escape") {
        showSaveDialog ? setShowSaveDialog(false) : handleClose();
        return;
      }
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        handleQuickSave();
        return;
      }
      if (e.ctrlKey && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        const { undo, canvas } = useCanvasStore.getState();
        const state = undo();
        if (state && canvas) {
          const parsed = JSON.parse(state);
          const holeCount = parsed.spotlightHoleCount || 0;
          const holesData = parsed.spotlightHolesData || [];
          const spotlightColor = parsed.spotlightColor || "#000000";
          const spotlightDarkness = parsed.spotlightDarkness || 0.7;
          canvas.loadFromJSON(parsed, () => {
            syncSpotlightFromHistory(canvas, holeCount, holesData, spotlightColor, spotlightDarkness);
            canvas.renderAll();
          });
        }
        return;
      }
      if (e.ctrlKey && e.shiftKey && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        const { redo, canvas } = useCanvasStore.getState();
        const state = redo();
        if (state && canvas) {
          const parsed = JSON.parse(state);
          const holeCount = parsed.spotlightHoleCount || 0;
          const holesData = parsed.spotlightHolesData || [];
          const spotlightColor = parsed.spotlightColor || "#000000";
          const spotlightDarkness = parsed.spotlightDarkness || 0.7;
          canvas.loadFromJSON(parsed, () => {
            syncSpotlightFromHistory(canvas, holeCount, holesData, spotlightColor, spotlightDarkness);
            canvas.renderAll();
          });
        }
        return;
      }
      if (e.ctrlKey && e.key === "Delete") {
        e.preventDefault();
        handleClear();
        return;
      }
      if (!e.ctrlKey && !e.altKey && !e.metaKey) {
        const toolMap: Record<string, string> = { v: "select", a: "arrow", r: "rectangle", e: "ellipse", l: "line", p: "freehand", t: "text", s: "spotlight", b: "blur", m: "marker", n: "numbering", c: "crop" };
        const tool = toolMap[e.key.toLowerCase()];
        if (tool) setActiveTool(tool as any);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose, handleQuickSave, handleClear, showSaveDialog, setActiveTool]);

  if (!isReady) return null;

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: "transparent" }}>
      <AnnotationCanvas width={dimensions.width} height={dimensions.height} />
      <ToolPanel />
      <OptionsPanel onSave={handleQuickSave} onClear={handleClear} onClose={handleClose} onOpenSettings={handleOpenSettings} />
      <SaveDialog isOpen={showSaveDialog} onClose={() => setShowSaveDialog(false)} onSave={handleSaveWithOptions} />
      {notification && <div className="fixed top-4 right-4 px-4 py-2 bg-green-500 text-white rounded-lg shadow-lg z-50">{notification}</div>}
    </div>
  );
};
