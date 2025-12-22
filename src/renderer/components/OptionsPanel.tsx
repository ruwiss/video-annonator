import React, { useCallback, useState } from "react";
import { fabric } from "fabric";
import { useCanvasStore } from "../stores/useCanvasStore";
import { useToolStore } from "../stores/useToolStore";
import { resetOverlayState, getOverlayState } from "./AnnotationCanvas";
import { UndoIcon, RedoIcon, SaveIcon, TrashIcon, SettingsIcon, CloseIcon, CropIcon, UploadIcon } from "./icons";

interface OptionsPanelProps {
  onSave: () => void;
  onClear: () => void;
  onClose: () => void;
  onOpenSettings: () => void;
}

export const OptionsPanel: React.FC<OptionsPanelProps> = ({ onSave, onClear, onClose, onOpenSettings }) => {
  const { canvas, undo, redo, canUndo, canRedo } = useCanvasStore();
  const { activeTool, setActiveTool } = useToolStore();
  const [isUploading, setIsUploading] = useState(false);

  const handleUndo = useCallback(() => {
    resetOverlayState();
    const state = undo();
    if (state && canvas) {
      canvas.loadFromJSON(JSON.parse(state), () => canvas.renderAll());
    }
  }, [undo, canvas]);

  const handleRedo = useCallback(() => {
    resetOverlayState();
    const state = redo();
    if (state && canvas) {
      canvas.loadFromJSON(JSON.parse(state), () => canvas.renderAll());
    }
  }, [redo, canvas]);

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    },
    [onClose]
  );

  const handleSettings = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onOpenSettings();
    },
    [onOpenSettings]
  );

  // Upload handler - now delegates to main process which handles widget
  const handleUpload = useCallback(async () => {
    if (!canvas || !window.electronAPI?.uploadImage || isUploading) return;

    setIsUploading(true);

    try {
      const overlayStateData = getOverlayState();
      const bounds = overlayStateData.cropBounds || (canvas as any).cropBounds;

      // Store original states
      const objectsToRestore: { obj: fabric.Object; visible: boolean }[] = [];

      // Hide crop overlay visual
      canvas.forEachObject((obj: fabric.Object) => {
        if (obj.data?.type === "crop-overlay") {
          objectsToRestore.push({ obj, visible: obj.visible !== false });
          obj.visible = false;
        }
      });

      // Capture screen background
      let dataUrl: string;
      let imgWidth: number;
      let imgHeight: number;

      if (window.electronAPI?.captureScreen) {
        const screenDataUrl = await window.electronAPI.captureScreen();

        if (screenDataUrl) {
          const dimensions = { width: window.innerWidth, height: window.innerHeight };

          // Create background image from screen capture
          const bgImg = await new Promise<fabric.Image>((resolve, reject) => {
            fabric.Image.fromURL(
              screenDataUrl,
              (img) => {
                if (!img) {
                  reject(new Error("Failed to create image"));
                  return;
                }
                const scaleX = dimensions.width / (img.width || dimensions.width);
                const scaleY = dimensions.height / (img.height || dimensions.height);
                img.set({
                  left: 0,
                  top: 0,
                  scaleX,
                  scaleY,
                  selectable: false,
                  evented: false,
                });
                resolve(img);
              },
              { crossOrigin: "anonymous" }
            );
          });

          canvas.add(bgImg);
          canvas.sendToBack(bgImg);
          canvas.renderAll();

          // Export
          const exportOptions: any = { format: "png", quality: 1, multiplier: 1 };
          if (bounds && bounds.width > 0 && bounds.height > 0) {
            exportOptions.left = bounds.left;
            exportOptions.top = bounds.top;
            exportOptions.width = bounds.width;
            exportOptions.height = bounds.height;
            imgWidth = bounds.width;
            imgHeight = bounds.height;
          } else {
            imgWidth = dimensions.width;
            imgHeight = dimensions.height;
          }

          dataUrl = canvas.toDataURL(exportOptions);

          // Remove background
          canvas.remove(bgImg);
          canvas.renderAll();
        } else {
          throw new Error("Screen capture failed");
        }
      } else {
        // Fallback without background
        const exportOptions: any = { format: "png", quality: 1, multiplier: window.devicePixelRatio || 1 };
        if (bounds && bounds.width > 0 && bounds.height > 0) {
          exportOptions.left = bounds.left;
          exportOptions.top = bounds.top;
          exportOptions.width = bounds.width;
          exportOptions.height = bounds.height;
          imgWidth = bounds.width;
          imgHeight = bounds.height;
        } else {
          imgWidth = canvas.getWidth();
          imgHeight = canvas.getHeight();
        }
        dataUrl = canvas.toDataURL(exportOptions);
      }

      // Restore states
      objectsToRestore.forEach(({ obj, visible }) => {
        obj.visible = visible;
      });
      canvas.renderAll();

      // Upload - main process will close overlay and show widget
      await window.electronAPI.uploadImage(dataUrl, imgWidth, imgHeight);
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setIsUploading(false);
    }
  }, [canvas, isUploading]);

  return (
    <div className="options-panel" style={{ pointerEvents: "auto" }}>
      {/* Undo/Redo */}
      <div className="flex items-center gap-1">
        <button className={`action-btn ${!canUndo() ? "opacity-30 cursor-not-allowed" : ""}`} onClick={handleUndo} disabled={!canUndo()} title="Undo (Ctrl+Z)">
          <UndoIcon size={18} />
        </button>
        <button className={`action-btn ${!canRedo() ? "opacity-30 cursor-not-allowed" : ""}`} onClick={handleRedo} disabled={!canRedo()} title="Redo (Ctrl+Shift+Z)">
          <RedoIcon size={18} />
        </button>
      </div>

      <div className="w-px h-5 bg-zinc-700" />

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button className="action-btn hover:text-red-400" onClick={onClear} title="Clear All (Ctrl+Del)">
          <TrashIcon size={18} />
        </button>
        <button className={`action-btn ${activeTool === "crop" ? "text-blue-400" : ""}`} onClick={() => setActiveTool("crop")} title="Crop (C)">
          <CropIcon size={18} />
        </button>
        <button className="action-btn text-green-400 hover:text-green-300" onClick={onSave} title="Save (Ctrl+S)">
          <SaveIcon size={18} />
        </button>
        <button className={`action-btn text-purple-400 hover:text-purple-300 ${isUploading ? "opacity-50 cursor-not-allowed" : ""}`} onClick={handleUpload} disabled={isUploading} title="Upload to Web">
          <UploadIcon size={18} />
        </button>
      </div>

      <div className="w-px h-5 bg-zinc-700" />

      {/* Settings & Close */}
      <div className="flex items-center gap-1">
        <button className="action-btn hover:text-blue-400" onClick={handleSettings} title="Settings">
          <SettingsIcon size={18} />
        </button>
        <button className="action-btn text-red-400 hover:text-red-300 hover:bg-red-500/20" onClick={handleClose} title="Close (Esc)">
          <CloseIcon size={18} />
        </button>
      </div>
    </div>
  );
};
