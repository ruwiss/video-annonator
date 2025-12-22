import React, { useState } from "react";
import { CloseIcon } from "./icons";

interface SaveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (options: SaveOptions) => void;
}

export interface SaveOptions {
  includeBackground: boolean;
  format: "png";
  quality: number;
}

export const SaveDialog: React.FC<SaveDialogProps> = ({ isOpen, onClose, onSave }) => {
  const [includeBackground, setIncludeBackground] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({
      includeBackground,
      format: "png",
      quality: 1,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-800 w-[380px] animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-white">Save Annotation</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
            <CloseIcon size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Background Option */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-zinc-300">Background</label>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setIncludeBackground(false)} className={`p-4 rounded-xl border-2 transition-all ${!includeBackground ? "border-blue-500 bg-blue-500/10" : "border-zinc-700 hover:border-zinc-600"}`}>
                <div className="w-full h-16 rounded-lg mb-2 bg-[repeating-conic-gradient(#333_0%_25%,#444_0%_50%)] bg-[length:16px_16px]" />
                <span className={`text-sm ${!includeBackground ? "text-blue-400" : "text-zinc-400"}`}>Transparent</span>
              </button>
              <button onClick={() => setIncludeBackground(true)} className={`p-4 rounded-xl border-2 transition-all ${includeBackground ? "border-blue-500 bg-blue-500/10" : "border-zinc-700 hover:border-zinc-600"}`}>
                <div className="w-full h-16 rounded-lg mb-2 bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center">
                  <span className="text-xs text-zinc-500">Screenshot</span>
                </div>
                <span className={`text-sm ${includeBackground ? "text-blue-400" : "text-zinc-400"}`}>With Background</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-zinc-800">
          <button onClick={onClose} className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors">
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
