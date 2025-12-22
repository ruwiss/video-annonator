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
    // Listen for upload state updates
    const cleanup = window.electronAPI?.onUploadWidgetUpdate?.((update: UploadData) => {
      setData(update);
    });

    // Listen for upload progress
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
    // Close widget after opening link
    window.electronAPI?.closeUploadWidget?.();
  };

  const handleClose = () => {
    window.electronAPI?.closeUploadWidget?.();
  };

  const handleRetry = () => {
    window.electronAPI?.retryUpload?.();
  };

  return (
    <div className="w-[320px] select-none" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      <div
        className="bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300"
        style={{
          boxShadow: isHovered ? "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.05)" : "0 20px 40px -12px rgba(0, 0, 0, 0.4)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50">
          <div className="flex items-center gap-2">
            {data.state === "uploading" && <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />}
            {data.state === "success" && <div className="w-2 h-2 rounded-full bg-green-500" />}
            {data.state === "error" && <div className="w-2 h-2 rounded-full bg-red-500" />}
            <span className="text-xs font-medium text-zinc-300">
              {data.state === "uploading" && "Uploading"}
              {data.state === "success" && "Upload Complete"}
              {data.state === "error" && "Upload Failed"}
            </span>
          </div>
          <button onClick={handleClose} className="w-6 h-6 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {data.state === "uploading" && (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-400">{STAGE_LABELS[data.stage] || "Processing..."}</span>
                <span className="text-xs text-zinc-500">{data.progress}%</span>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-purple-500 to-purple-400 transition-all duration-300 ease-out" style={{ width: `${data.progress}%` }} />
              </div>
            </>
          )}

          {data.state === "success" && data.url && (
            <>
              <div className="flex items-center gap-2 bg-zinc-800/50 rounded-xl p-2 mb-3">
                <input type="text" value={data.url} readOnly className="flex-1 bg-transparent text-xs text-zinc-300 outline-none select-all font-mono truncate" onClick={(e) => (e.target as HTMLInputElement).select()} />
                <button onClick={handleOpenLink} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  Open
                </button>
              </div>
              <p className="text-[10px] text-zinc-500 text-center">Link copied to clipboard automatically</p>
            </>
          )}

          {data.state === "error" && (
            <>
              <p className="text-xs text-zinc-400 mb-3">{data.error || "Upload failed"}</p>
              <button onClick={handleRetry} className="w-full py-2 rounded-xl text-xs font-medium bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors">
                Retry Upload
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
