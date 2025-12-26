import React, { useCallback, useState, useRef, useEffect } from "react";
import { fabric } from "fabric";
import { useCanvasStore } from "../stores/useCanvasStore";
import { useToolStore } from "../stores/useToolStore";
import { resetOverlayState, getOverlayState, syncCropStateFromCanvas } from "./AnnotationCanvas";
import { UndoIcon, RedoIcon, SaveIcon, TrashIcon, SettingsIcon, CloseIcon, CropIcon, UploadIcon } from "./icons";

// OptionsPanel position storage
const OPTIONS_PANEL_POSITION_KEY = "video-annotator-options-panel-position";

const getOptionsPanelPosition = (): { x: number; y: number } | null => {
  try {
    const saved = localStorage.getItem(OPTIONS_PANEL_POSITION_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

const saveOptionsPanelPosition = (pos: { x: number; y: number }) => {
  try {
    localStorage.setItem(OPTIONS_PANEL_POSITION_KEY, JSON.stringify(pos));
  } catch {}
};

// Keyboard shortcuts help content
const SHORTCUTS_HELP = [
  {
    category: "Drawing",
    shortcuts: [
      { keys: "Shift", desc: "Perfect shapes / 45° lines" },
      { keys: "Alt", desc: "Draw from center" },
    ],
  },
  {
    category: "Edit",
    shortcuts: [
      { keys: "Ctrl+C", desc: "Copy" },
      { keys: "Ctrl+V", desc: "Paste" },
      { keys: "Ctrl+X", desc: "Cut" },
      { keys: "Ctrl+D", desc: "Duplicate" },
      { keys: "Delete", desc: "Delete object" },
    ],
  },
  {
    category: "Transform",
    shortcuts: [
      { keys: "Ctrl+H", desc: "Flip horizontal" },
      { keys: "Ctrl+J", desc: "Flip vertical" },
      { keys: "Ctrl+[/]", desc: "Rotate 15°" },
      { keys: "Arrows", desc: "Nudge 1px" },
      { keys: "Shift+Arrows", desc: "Nudge 10px" },
    ],
  },
  {
    category: "General",
    shortcuts: [
      { keys: "Ctrl+Z", desc: "Undo" },
      { keys: "Ctrl+Shift+Z", desc: "Redo" },
      { keys: "Ctrl+S", desc: "Save" },
    ],
  },
];

interface OptionsPanelProps {
  onSave: () => void;
  onClear: () => void;
  onClose: () => void;
  onOpenSettings: () => void;
  imageMode?: {
    isImageMode: boolean;
    imageDataUrl: string | null;
  };
  screenCapture?: {
    hasCapture: boolean;
    captureDataUrl: string | null;
  };
}

export const OptionsPanel: React.FC<OptionsPanelProps> = ({ onSave, onClear, onClose, onOpenSettings, imageMode, screenCapture }) => {
  const { canvas, undo, redo, canUndo, canRedo, clearHistory } = useCanvasStore();
  const { activeTool, setActiveTool, resetNumbering } = useToolStore();
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(() => getOptionsPanelPosition());
  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);

  // Show panel after mount to prevent position jump
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const handleUndo = useCallback(() => {
    resetOverlayState(canvas || undefined);
    const state = undo();
    if (state && canvas) {
      canvas.loadFromJSON(JSON.parse(state), () => {
        canvas.renderAll();
        // Sync crop state after restore
        syncCropStateFromCanvas(canvas);
      });
    }
  }, [undo, canvas]);

  const handleRedo = useCallback(() => {
    resetOverlayState(canvas || undefined);
    const state = redo();
    if (state && canvas) {
      canvas.loadFromJSON(JSON.parse(state), () => {
        canvas.renderAll();
        // Sync crop state after restore
        syncCropStateFromCanvas(canvas);
      });
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

  // Upload handler - uses pre-captured background, no new capture needed
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

      let dataUrl: string;
      let imgWidth: number;
      let imgHeight: number;
      const dimensions = { width: window.innerWidth, height: window.innerHeight };

      // Get background from pre-captured data (no new capture needed!)
      const bgDataUrl = imageMode?.isImageMode && imageMode.imageDataUrl ? imageMode.imageDataUrl : screenCapture?.hasCapture && screenCapture.captureDataUrl ? screenCapture.captureDataUrl : null;

      if (bgDataUrl) {
        const bgImg = await new Promise<fabric.Image>((resolve, reject) => {
          fabric.Image.fromURL(
            bgDataUrl,
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
      const result = await window.electronAPI.uploadImage(dataUrl, imgWidth!, imgHeight!);

      // Clear canvas after successful upload
      if (result?.success) {
        canvas.clear();
        canvas.backgroundColor = "transparent";
        canvas.renderAll();
        clearHistory();
        resetNumbering();
        resetOverlayState();
      }
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setIsUploading(false);
    }
  }, [canvas, isUploading, imageMode, screenCapture, clearHistory, resetNumbering]);

  // Draggable handlers
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest("button")) return;
      setIsDragging(true);
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        initialX: position?.x ?? rect.left + rect.width / 2,
        initialY: position?.y ?? rect.top,
      };
    },
    [position]
  );

  const handleDragMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPosition({
        x: dragRef.current.initialX + dx,
        y: dragRef.current.initialY + dy,
      });
    },
    [isDragging]
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    // Save position when drag ends
    if (position) {
      saveOptionsPanelPosition(position);
    }
    dragRef.current = null;
  }, [position]);

  // Add/remove drag listeners
  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleDragMove);
      window.addEventListener("mouseup", handleDragEnd);
    }
    return () => {
      window.removeEventListener("mousemove", handleDragMove);
      window.removeEventListener("mouseup", handleDragEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Panel style with position - always use fixed positioning
  const panelStyle: React.CSSProperties = {
    position: "fixed",
    left: position ? position.x : "50%",
    top: position ? position.y : "auto",
    bottom: position ? "auto" : 16,
    transform: "translateX(-50%)",
    cursor: isDragging ? "grabbing" : "grab",
    opacity: isVisible ? 1 : 0,
    transition: "opacity 0.15s ease-out",
    pointerEvents: "auto",
  };

  return (
    <div className="options-panel" style={panelStyle} onMouseDown={handleDragStart}>
      {/* Shortcuts Help Button */}
      <div className="relative">
        <button className={`action-btn ${showShortcuts ? "text-amber-glow" : "hover:text-amber-warm"}`} onClick={() => setShowShortcuts(!showShortcuts)} title="Keyboard Shortcuts">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <rect x="2" y="5" width="14" height="10" rx="2" />
            <path d="M5 8h1M8 8h2M12 8h1M5 11h8" />
          </svg>
        </button>

        {/* Shortcuts Popup */}
        {showShortcuts && (
          <div className="absolute bottom-full left-0 mb-2 w-56 p-3 rounded-xl bg-cinema-dark/98 border border-cinema-border shadow-cinematic backdrop-blur-md animate-scale-in">
            <div className="text-[10px] font-semibold text-amber-warm uppercase tracking-wider mb-2">Keyboard Shortcuts</div>
            {SHORTCUTS_HELP.map((cat) => (
              <div key={cat.category} className="mb-2.5 last:mb-0">
                <div className="text-[9px] text-silver-muted uppercase tracking-wider mb-1">{cat.category}</div>
                {cat.shortcuts.map((s) => (
                  <div key={s.keys} className="flex justify-between items-center py-0.5">
                    <span className="text-[10px] text-silver">{s.desc}</span>
                    <kbd className="text-[9px] px-1.5 py-0.5 rounded bg-cinema-elevated border border-cinema-border text-amber-muted font-mono">{s.keys}</kbd>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-5 bg-gradient-to-b from-transparent via-cinema-border-strong to-transparent" />

      {/* Undo/Redo */}
      <div className="flex items-center gap-1">
        <button className={`action-btn ${!canUndo() ? "opacity-30 cursor-not-allowed" : "hover:text-amber-warm"}`} onClick={handleUndo} disabled={!canUndo()} title="Undo (Ctrl+Z)">
          <UndoIcon size={18} />
        </button>
        <button className={`action-btn ${!canRedo() ? "opacity-30 cursor-not-allowed" : "hover:text-amber-warm"}`} onClick={handleRedo} disabled={!canRedo()} title="Redo (Ctrl+Shift+Z)">
          <RedoIcon size={18} />
        </button>
      </div>

      <div className="w-px h-5 bg-gradient-to-b from-transparent via-cinema-border-strong to-transparent" />

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button className="action-btn hover:text-accent-danger" onClick={onClear} title="Clear All (Ctrl+Del)">
          <TrashIcon size={18} />
        </button>
        <button className={`action-btn ${activeTool === "crop" ? "text-amber-glow" : "hover:text-amber-warm"}`} onClick={() => setActiveTool("crop")} title="Crop (C)">
          <CropIcon size={18} />
        </button>
        <button className="action-btn text-accent-success hover:text-green-300" onClick={onSave} title="Save (Ctrl+S)">
          <SaveIcon size={18} />
        </button>
        <button className={`action-btn text-accent-secondary hover:text-purple-300 ${isUploading ? "opacity-50 cursor-not-allowed" : ""}`} onClick={handleUpload} disabled={isUploading} title="Upload to Web">
          <UploadIcon size={18} />
        </button>
      </div>

      <div className="w-px h-5 bg-gradient-to-b from-transparent via-cinema-border-strong to-transparent" />

      {/* Settings & Close */}
      <div className="flex items-center gap-1">
        <button className="action-btn hover:text-amber-warm" onClick={handleSettings} title="Settings">
          <SettingsIcon size={18} />
        </button>
        <button className="action-btn text-accent-danger hover:text-red-300 hover:bg-accent-danger/10" onClick={handleClose} title="Close (Esc)">
          <CloseIcon size={18} />
        </button>
      </div>
    </div>
  );
};
