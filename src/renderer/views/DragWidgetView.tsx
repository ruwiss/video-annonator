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

    // ESC to close (hidden feature, no UI hint needed)
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
      {/* Modern glassmorphism corner widget */}
      <div
        className={`absolute top-0 right-0 w-[90px] h-[90px] cursor-grab active:cursor-grabbing transition-all duration-300 ${isDragging ? "scale-90 opacity-60" : ""} ${isHovered ? "scale-105" : ""}`}
        style={{
          background: isHovered ? "linear-gradient(135deg, rgba(99, 102, 241, 0.95) 0%, rgba(79, 70, 229, 0.95) 100%)" : "linear-gradient(135deg, rgba(99, 102, 241, 0.85) 0%, rgba(79, 70, 229, 0.85) 100%)",
          borderRadius: "0 0 0 90px",
          boxShadow: isHovered ? "0 12px 40px rgba(99, 102, 241, 0.5), inset 0 1px 0 rgba(255,255,255,0.2)" : "0 8px 24px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.1)",
          backdropFilter: "blur(8px)",
        }}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Subtle drag indicator - 6 dots grid */}
        <div className="absolute top-4 right-4 grid grid-cols-2 gap-1 opacity-70">
          <div className="w-1.5 h-1.5 rounded-full bg-white/80" />
          <div className="w-1.5 h-1.5 rounded-full bg-white/80" />
          <div className="w-1.5 h-1.5 rounded-full bg-white/80" />
          <div className="w-1.5 h-1.5 rounded-full bg-white/80" />
          <div className="w-1.5 h-1.5 rounded-full bg-white/80" />
          <div className="w-1.5 h-1.5 rounded-full bg-white/80" />
        </div>
      </div>
    </div>
  );
};
