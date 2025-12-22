import React, { useState, useCallback, useEffect } from "react";
import { RegionConfig } from "../shared/types";

interface SelectionBox {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export const RegionSelectView: React.FC = () => {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selection, setSelection] = useState<SelectionBox | null>(null);
  const [displayId, setDisplayId] = useState<number>(0);

  useEffect(() => {
    // Get display info
    window.electronAPI?.getDisplays().then((displays) => {
      const primary = displays.find((d: any) => d.isPrimary);
      if (primary) {
        setDisplayId(primary.id);
      }
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsSelecting(true);
    setSelection({
      startX: e.clientX,
      startY: e.clientY,
      endX: e.clientX,
      endY: e.clientY,
    });
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isSelecting || !selection) return;

      setSelection({
        ...selection,
        endX: e.clientX,
        endY: e.clientY,
      });
    },
    [isSelecting, selection]
  );

  const handleMouseUp = useCallback(() => {
    if (!selection) return;

    const x = Math.min(selection.startX, selection.endX);
    const y = Math.min(selection.startY, selection.endY);
    const width = Math.abs(selection.endX - selection.startX);
    const height = Math.abs(selection.endY - selection.startY);

    // Minimum size check
    if (width < 100 || height < 100) {
      setIsSelecting(false);
      setSelection(null);
      return;
    }

    const region: RegionConfig = {
      displayId,
      bounds: { x, y, width, height },
      name: `Region ${Date.now()}`,
      createdAt: Date.now(),
    };

    window.electronAPI?.sendRegionSelected(region);

    // Close this window
    window.close();
  }, [selection, displayId]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      window.close();
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Calculate selection rectangle
  const getSelectionStyle = () => {
    if (!selection) return {};

    const x = Math.min(selection.startX, selection.endX);
    const y = Math.min(selection.startY, selection.endY);
    const width = Math.abs(selection.endX - selection.startX);
    const height = Math.abs(selection.endY - selection.startY);

    return {
      left: x,
      top: y,
      width,
      height,
    };
  };

  return (
    <div className="fixed inset-0 cursor-crosshair" style={{ background: "rgba(0, 0, 0, 0.4)" }} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
      {/* Instructions */}
      <div className="fixed top-8 left-1/2 -translate-x-1/2 px-6 py-3 bg-overlay-panel backdrop-blur-panel rounded-xl border border-overlay-border shadow-2xl">
        <p className="text-white text-sm font-medium">Click and drag to select annotation region</p>
        <p className="text-zinc-400 text-xs mt-1">Press ESC to cancel</p>
      </div>

      {/* Selection rectangle */}
      {selection && (
        <div className="absolute border-2 border-accent-primary bg-accent-primary/10" style={getSelectionStyle()}>
          {/* Corner handles */}
          <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white rounded-full border-2 border-accent-primary" />
          <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white rounded-full border-2 border-accent-primary" />
          <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white rounded-full border-2 border-accent-primary" />
          <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white rounded-full border-2 border-accent-primary" />

          {/* Size indicator */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-900 text-white text-xs rounded">
            {Math.abs(selection.endX - selection.startX)} × {Math.abs(selection.endY - selection.startY)}
          </div>
        </div>
      )}
    </div>
  );
};
