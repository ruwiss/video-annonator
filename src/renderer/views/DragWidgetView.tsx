import React, { useEffect, useState } from "react";

export const DragWidgetView: React.FC = () => {
  const [filePath, setFilePath] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split("?")[1]);
    const file = params.get("file");
    if (file) {
      setFilePath(decodeURIComponent(file));
    }

    // ESC to close
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        window.electronAPI?.hideDragWidget();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleDragStart = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
    window.electronAPI?.startDrag(filePath);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  return (
    <div className="w-[120px] h-[120px] relative select-none">
      {/* Hot corner curved shape */}
      <div
        className={`absolute top-0 right-0 w-[100px] h-[100px] cursor-grab active:cursor-grabbing transition-all duration-200 ${isDragging ? "scale-95 opacity-80" : ""} ${isHovered ? "scale-105" : ""}`}
        style={{
          background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
          borderRadius: "0 0 0 100px",
          boxShadow: isHovered ? "0 8px 32px rgba(59, 130, 246, 0.4)" : "0 4px 16px rgba(0, 0, 0, 0.3)",
        }}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Content */}
        <div className="absolute top-3 right-3 flex flex-col items-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" className="mb-1 drop-shadow-lg">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" fill="white" stroke="none" />
            <path d="M21 15l-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[9px] text-white/90 font-medium tracking-wide">DRAG</span>
        </div>

        {/* ESC hint */}
        <div className="absolute bottom-4 left-4 text-[8px] text-white/60 font-medium">ESC</div>
      </div>

      {/* Drag feedback */}
      {isDragging && (
        <div className="absolute top-0 right-0 w-[100px] h-[100px] flex items-center justify-center" style={{ borderRadius: "0 0 0 100px" }}>
          <div className="absolute top-4 right-4 text-white text-xs font-medium animate-pulse">Drop it!</div>
        </div>
      )}
    </div>
  );
};
