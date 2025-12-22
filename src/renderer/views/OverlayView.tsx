import React, { useEffect, useState, useCallback, useRef } from "react";
import { fabric } from "fabric";
import { ToolPanel } from "../components/ToolPanel";
import { OptionsPanel } from "../components/OptionsPanel";
import { AnnotationCanvas, resetOverlayState, getOverlayState, syncSpotlightFromHistory, syncCropStateFromCanvas } from "../components/AnnotationCanvas";
import { SaveDialog, SaveOptions } from "../components/SaveDialog";
import { useCanvasStore } from "../stores/useCanvasStore";
import { useToolStore } from "../stores/useToolStore";
import { ImageModeState, ScreenCaptureState } from "../../shared/types";

export const OverlayView: React.FC = () => {
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [isReady, setIsReady] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Image mode - when opened via right-click on image file
  const [imageMode, setImageMode] = useState<ImageModeState>({
    isImageMode: false,
    imagePath: null,
    imageDataUrl: null,
    imageWidth: 0,
    imageHeight: 0,
  });

  // Screen capture mode - pre-captured background for normal overlay
  const [screenCapture, setScreenCapture] = useState<ScreenCaptureState>({
    hasCapture: false,
    captureDataUrl: null,
    captureWidth: 0,
    captureHeight: 0,
    bounds: null,
  });

  const mountedRef = useRef(false);

  const { canvas, clearHistory } = useCanvasStore();
  const { resetNumbering, setActiveTool } = useToolStore();

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    // Listen for image mode updates (right-click open)
    const unsubscribeImage = window.electronAPI?.onImageModeUpdate?.((state) => {
      console.log("[OverlayView] Received image-mode-update:", state.isImageMode, state.imageWidth, state.imageHeight);
      if (state.isImageMode) {
        setImageMode(state);
        setScreenCapture({ hasCapture: false, captureDataUrl: null, captureWidth: 0, captureHeight: 0, bounds: null });
      }
      setIsReady(true);
    });

    // Listen for screen capture updates (normal overlay with pre-capture)
    const unsubscribeCapture = window.electronAPI?.onScreenCaptureUpdate?.((state) => {
      console.log("[OverlayView] Received screen-capture-update:", state.hasCapture, state.captureWidth, state.captureHeight);
      if (state.hasCapture && !imageMode.isImageMode) {
        setScreenCapture(state);
      }
      setIsReady(true);
    });

    // Check for image mode on mount
    const checkImageMode = async () => {
      if (window.electronAPI?.getImageModeState) {
        const state = await window.electronAPI.getImageModeState();
        console.log("[OverlayView] getImageModeState result:", state.isImageMode, state.imageWidth, state.imageHeight);
        if (state.isImageMode) {
          setImageMode(state);
        }
      }
      setIsReady(true);
    };
    checkImageMode();

    return () => {
      unsubscribeImage?.();
      unsubscribeCapture?.();
    };
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

  // Get the active background data URL (either image mode or screen capture)
  const getBackgroundDataUrl = useCallback(() => {
    if (imageMode.isImageMode && imageMode.imageDataUrl) {
      return imageMode.imageDataUrl;
    }
    if (screenCapture.hasCapture && screenCapture.captureDataUrl) {
      return screenCapture.captureDataUrl;
    }
    return null;
  }, [imageMode, screenCapture]);

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

        // IMAGE MODE: Always use the background image, skip dialog options
        // CRITICAL: Preserve original image aspect ratio and dimensions
        if (imageMode.isImageMode && imageMode.imageDataUrl) {
          console.log("[SAVE] Image mode - preserving original dimensions:", imageMode.imageWidth, "x", imageMode.imageHeight);

          const origW = imageMode.imageWidth;
          const origH = imageMode.imageHeight;
          const screenW = dimensions.width;
          const screenH = dimensions.height;

          // Calculate how the image is displayed with "contain" (same as CSS background-size: contain)
          const scaleToFit = Math.min(screenW / origW, screenH / origH);
          const displayW = origW * scaleToFit;
          const displayH = origH * scaleToFit;
          const offsetX = (screenW - displayW) / 2;
          const offsetY = (screenH - displayH) / 2;

          console.log(`[SAVE] Display: ${displayW.toFixed(0)}x${displayH.toFixed(0)} at offset (${offsetX.toFixed(0)}, ${offsetY.toFixed(0)}), scale: ${scaleToFit.toFixed(3)}`);

          // Create a temporary canvas at ORIGINAL image dimensions
          const tempCanvas = new fabric.StaticCanvas(null, {
            width: origW,
            height: origH,
            backgroundColor: "transparent",
          });

          // Add background image at original size
          await new Promise<void>((resolve, reject) => {
            fabric.Image.fromURL(
              imageMode.imageDataUrl!,
              (img) => {
                if (!img) {
                  reject(new Error("Failed to create background image"));
                  return;
                }
                img.set({ left: 0, top: 0, scaleX: 1, scaleY: 1, selectable: false, evented: false });
                tempCanvas.add(img);
                tempCanvas.sendToBack(img);
                resolve();
              },
              { crossOrigin: "anonymous" }
            );
          });

          // Clone and transform each annotation object from main canvas to temp canvas
          // Objects are in screen coordinates, need to transform to original image coordinates
          const mainObjects = canvas.getObjects().filter((obj: fabric.Object) => !obj.data?.type?.includes("crop"));

          for (const obj of mainObjects) {
            const cloned = await new Promise<fabric.Object>((resolve) => {
              obj.clone((c: fabric.Object) => resolve(c));
            });

            // Transform from screen coordinates to original image coordinates
            // Screen position relative to image display area, then scale to original size
            const objLeft = (cloned.left || 0) - offsetX;
            const objTop = (cloned.top || 0) - offsetY;

            cloned.set({
              left: objLeft / scaleToFit,
              top: objTop / scaleToFit,
              scaleX: (cloned.scaleX || 1) / scaleToFit,
              scaleY: (cloned.scaleY || 1) / scaleToFit,
            });

            // Handle stroke width scaling for shapes
            if (cloned.strokeWidth) {
              cloned.set({ strokeWidth: cloned.strokeWidth / scaleToFit });
            }

            tempCanvas.add(cloned);
          }

          tempCanvas.renderAll();

          // Export at original dimensions
          const dataUrl = tempCanvas.toDataURL({
            format: options.format as "png" | "jpeg",
            quality: options.quality,
            multiplier: 1,
          });

          // Cleanup temp canvas
          tempCanvas.dispose();

          // Restore states on main canvas
          objectsToRestore.forEach(({ obj, visible }) => {
            obj.visible = visible;
          });
          canvas.renderAll();

          // Save file - overwrite original image in image mode
          const filePath = await window.electronAPI.saveAnnotation(dataUrl, imageMode.imagePath || undefined);
          if (filePath) {
            showNotification("Saved!");
            // Don't show drag widget in image mode - file is saved in place

            setTimeout(() => {
              if (canvas) {
                canvas.clear();
                canvas.backgroundColor = "transparent";
                canvas.renderAll();
              }
              clearHistory();
              resetNumbering();
              resetOverlayState();
              // Clear image mode state
              window.electronAPI?.clearImageMode?.();
              window.electronAPI?.closeOverlay();
            }, 500);
          }
          return;
        }

        // NORMAL MODE WITH PRE-CAPTURED BACKGROUND
        if (options.includeBackground && screenCapture.hasCapture && screenCapture.captureDataUrl) {
          console.log("[SAVE] Using pre-captured background");

          // Create background image from pre-captured screen
          const bgImg = await new Promise<fabric.Image>((resolve, reject) => {
            fabric.Image.fromURL(
              screenCapture.captureDataUrl!,
              (img) => {
                if (!img) {
                  reject(new Error("Failed to create image from data URL"));
                  return;
                }

                // Scale to match canvas dimensions
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

                console.log(`[SAVE] Pre-captured background: ${img.width}x${img.height}, scaled to ${scaleX.toFixed(2)}x${scaleY.toFixed(2)}`);
                resolve(img);
              },
              { crossOrigin: "anonymous" }
            );
          });

          // Add to back of canvas temporarily
          canvas.add(bgImg);
          canvas.sendToBack(bgImg);
          canvas.renderAll();

          // Export
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
    [canvas, showNotification, clearHistory, resetNumbering, dimensions, imageMode, screenCapture]
  );

  const handleQuickSave = useCallback(() => {
    // In image mode, skip dialog and save directly with background
    if (imageMode.isImageMode) {
      handleSaveWithOptions({
        includeBackground: true,
        format: "png",
        quality: 1,
      });
    } else {
      setShowSaveDialog(true);
    }
  }, [imageMode.isImageMode, handleSaveWithOptions]);

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
    // Save canvas state before closing
    if (canvas) {
      const json = canvas.toJSON(["selectable", "evented", "data"]);
      const state = JSON.stringify(json);
      // Ensure state is saved to storage
      localStorage.setItem("video-annotator-canvas-state", state);
    }

    // Clear image mode state when closing
    if (imageMode.isImageMode) {
      window.electronAPI?.clearImageMode?.();
    }
    if (window.electronAPI) window.electronAPI.closeOverlay();
  }, [imageMode.isImageMode, canvas]);

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
            syncCropStateFromCanvas(canvas);
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
            syncCropStateFromCanvas(canvas);
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

  // Determine background style based on mode
  // Image mode: contain (preserve aspect ratio)
  // Screen capture mode: cover (fill entire overlay)
  const containerStyle: React.CSSProperties =
    imageMode.isImageMode && imageMode.imageDataUrl
      ? {
          backgroundImage: `url(${imageMode.imageDataUrl})`,
          backgroundSize: "contain",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundColor: "#1a1a1a",
        }
      : screenCapture.hasCapture && screenCapture.captureDataUrl
      ? {
          backgroundImage: `url(${screenCapture.captureDataUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }
      : { background: "transparent" };

  return (
    <div className="relative w-full h-full overflow-hidden" style={containerStyle}>
      <AnnotationCanvas width={dimensions.width} height={dimensions.height} imageMode={imageMode} screenCapture={screenCapture} />
      <ToolPanel />
      <OptionsPanel onSave={handleQuickSave} onClear={handleClear} onClose={handleClose} onOpenSettings={handleOpenSettings} imageMode={imageMode} screenCapture={screenCapture} />
      <SaveDialog isOpen={showSaveDialog && !imageMode.isImageMode} onClose={() => setShowSaveDialog(false)} onSave={handleSaveWithOptions} />
      {notification && <div className="fixed top-4 right-4 px-4 py-2 bg-green-500 text-white rounded-lg shadow-lg z-50">{notification}</div>}
    </div>
  );
};
