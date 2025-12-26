import React, { useEffect, useState } from "react";

type UploadState = "uploading" | "success" | "error";

interface UploadData {
  state: UploadState;
  progress: number;
  stage: string;
  url?: string;
  error?: string;
}

const STAGE_LABELS: Record<string, string> = {
  uploading: "Uploading...",
  fetching: "Fetching URL...",
  parsing: "Processing...",
  done: "Complete",
};

export const UploadWidgetView: React.FC = () => {
  const [data, setData] = useState<UploadData>({
    state: "uploading",
    progress: 0,
    stage: "uploading",
  });
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const cleanup = window.electronAPI?.onUploadWidgetUpdate?.((update: UploadData) => {
      setData(update);
    });

    const cleanupProgress = window.electronAPI?.onUploadProgress?.((progressData) => {
      setData((prev) => ({
        ...prev,
        progress: progressData.progress,
        stage: progressData.stage,
      }));
    });

    return () => {
      cleanup?.();
      cleanupProgress?.();
    };
  }, []);

  const handleOpenLink = async () => {
    if (!data.url) return;
    await window.electronAPI?.openExternalLink?.(data.url);
    window.electronAPI?.closeUploadWidget?.();
  };

  const handleClose = () => {
    window.electronAPI?.closeUploadWidget?.();
  };

  const handleRetry = () => {
    window.electronAPI?.retryUpload?.();
  };

  return (
    <div className="w-[340px] select-none font-body" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      <div
        className="upload-widget transition-all duration-300"
        style={{
          boxShadow: isHovered
            ? "0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 25px -5px rgba(212, 165, 116, 0.2)"
            : "0 20px 40px -12px rgba(0, 0, 0, 0.5)",
        }}
      >
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-cinema-border">
          <div className="flex items-center gap-2.5">
            {data.state === "uploading" && <div className="w-2 h-2 rounded-full bg-amber-glow animate-pulse" />}
            {data.state === "success" && <div className="w-2 h-2 rounded-full bg-accent-success" />}
            {data.state === "error" && <div className="w-2 h-2 rounded-full bg-accent-danger" />}
            <span className="text-xs font-medium text-silver-light tracking-wide">
              {data.state === "uploading" && "UPLOADING"}
              {data.state === "success" && "COMPLETE"}
              {data.state === "error" && "FAILED"}
            </span>
          </div>
          <button onClick={handleClose} className="w-6 h-6 flex items-center justify-center rounded-lg text-silver-muted hover:text-amber-warm hover:bg-cinema-elevated transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4">
          {data.state === "uploading" && (
            <>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs text-silver">{STAGE_LABELS[data.stage] || "Processing..."}</span>
                <span className="text-xs text-amber-muted font-mono">{data.progress}%</span>
              </div>
              <div className="upload-progress-bar">
                <div className="progress" style={{ width: `${data.progress}%` }} />
              </div>
            </>
          )}

          {data.state === "success" && data.url && (
            <>
              <div className="flex items-center gap-2 bg-cinema-black/60 border border-cinema-border rounded-xl p-2.5 mb-3">
                <input
                  type="text"
                  value={data.url}
                  readOnly
                  className="flex-1 bg-transparent text-xs text-silver-light outline-none select-all font-mono truncate"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={handleOpenLink}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5 bg-amber-glow/15 text-amber-warm hover:bg-amber-glow/25 border border-amber-glow/20"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  Open
                </button>
              </div>
              <p className="text-[10px] text-silver-muted text-center">Link copied to clipboard</p>
            </>
          )}

          {data.state === "error" && (
            <>
              <p className="text-xs text-silver mb-3">{data.error || "Upload failed"}</p>
              <button onClick={handleRetry} className="btn btn-secondary w-full py-2.5 text-xs">
                Retry Upload
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
