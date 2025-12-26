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
    <div className="dialog-overlay animate-fade-in">
      <div className="dialog-content animate-scale-in w-[400px]">
        <div className="dialog-header flex items-center justify-between">
          <h2>SAVE ANNOTATION</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-cinema-elevated text-silver hover:text-amber-warm transition-colors">
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="dialog-body">
          <div className="space-y-4">
            <label className="text-xs font-medium text-silver-muted uppercase tracking-wider">Background</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setIncludeBackground(false)}
                className={`p-5 rounded-xl border-2 transition-all group ${
                  !includeBackground
                    ? "border-amber-glow bg-amber-glow/10 shadow-glow"
                    : "border-cinema-border hover:border-cinema-border-strong"
                }`}
              >
                <div className="w-full h-16 rounded-lg mb-3 bg-[repeating-conic-gradient(#1f1f23_0%_25%,#2a2a2f_0%_50%)] bg-[length:12px_12px]" />
                <span className={`text-sm font-medium ${!includeBackground ? "text-amber-warm" : "text-silver group-hover:text-silver-light"}`}>
                  Transparent
                </span>
              </button>
              <button
                onClick={() => setIncludeBackground(true)}
                className={`p-5 rounded-xl border-2 transition-all group ${
                  includeBackground
                    ? "border-amber-glow bg-amber-glow/10 shadow-glow"
                    : "border-cinema-border hover:border-cinema-border-strong"
                }`}
              >
                <div className="w-full h-16 rounded-lg mb-3 bg-gradient-to-br from-cinema-elevated to-cinema-surface flex items-center justify-center border border-cinema-border">
                  <span className="text-[10px] text-silver-muted uppercase tracking-wider">Screenshot</span>
                </div>
                <span className={`text-sm font-medium ${includeBackground ? "text-amber-warm" : "text-silver group-hover:text-silver-light"}`}>
                  With Background
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="dialog-footer">
          <button onClick={onClose} className="btn btn-secondary flex-1">
            Cancel
          </button>
          <button onClick={handleSave} className="btn btn-primary flex-1">
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
