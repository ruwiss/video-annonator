import React, { useEffect, useState } from "react";
import { AppSettings, DEFAULT_SETTINGS } from "../shared/types";
import { CloseIcon, FolderIcon } from "../components/icons";

export const SettingsView: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [contextMenuRegistered, setContextMenuRegistered] = useState(false);
  const [contextMenuLoading, setContextMenuLoading] = useState(true);

  useEffect(() => {
    window.electronAPI?.getSettings().then(setSettings);

    // Check context menu registration status
    window.electronAPI
      ?.checkContextMenuRegistered?.()
      .then((registered) => {
        setContextMenuRegistered(registered);
        setContextMenuLoading(false);
      })
      .catch(() => setContextMenuLoading(false));
  }, []);

  const handleChange = async (key: keyof AppSettings, value: any) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);

    setIsSaving(true);
    await window.electronAPI?.setSettings({ [key]: value });
    setIsSaving(false);
  };

  const handleSelectExportPath = async () => {
    const path = await window.electronAPI?.selectExportPath();
    if (path) {
      setSettings({ ...settings, exportPath: path });
    }
  };

  const handleContextMenuToggle = async () => {
    setContextMenuLoading(true);
    try {
      if (contextMenuRegistered) {
        const result = await window.electronAPI?.unregisterContextMenu?.();
        if (result?.success) {
          setContextMenuRegistered(false);
        }
      } else {
        const result = await window.electronAPI?.registerContextMenu?.();
        if (result?.success) {
          setContextMenuRegistered(true);
        }
      }
    } catch (err) {
      console.error("Context menu toggle failed:", err);
    }
    setContextMenuLoading(false);
  };

  const handleClose = () => {
    window.close();
  };

  return (
    <div className="w-full h-full bg-cinema-dark rounded-2xl overflow-hidden flex flex-col border border-cinema-border">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-cinema-border draggable">
        <h1 className="font-display text-2xl tracking-wider text-amber-warm">SETTINGS</h1>
        <button className="tool-btn no-drag" onClick={handleClose} aria-label="Close">
          <CloseIcon size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Export Settings */}
        <section className="settings-section">
          <h2>EXPORT</h2>

          <div className="space-y-5">
            {/* Export Path */}
            <div>
              <label className="settings-label">Export Folder</label>
              <div className="flex gap-3">
                <input type="text" value={settings.exportPath} readOnly className="input-field flex-1 text-sm font-mono" />
                <button className="btn btn-secondary flex items-center gap-2" onClick={handleSelectExportPath}>
                  <FolderIcon size={16} />
                  Browse
                </button>
              </div>
            </div>

            {/* File Prefix */}
            <div>
              <label className="settings-label">File Prefix</label>
              <input type="text" value={settings.filePrefix} onChange={(e) => handleChange("filePrefix", e.target.value)} className="input-field w-full" placeholder="annotation" />
              <p className="text-xs text-silver-muted mt-2 font-mono">Files: {settings.filePrefix}_YYYYMMDD_HHmmss_001.png</p>
            </div>
          </div>
        </section>

        {/* Behavior Settings */}
        <section className="settings-section">
          <h2>BEHAVIOR</h2>

          <div className="space-y-1">
            {/* Context Menu Integration */}
            <div className="settings-row">
              <div>
                <p className="text-sm text-silver-light">Right-Click Menu</p>
                <p className="text-xs text-silver-muted">Add "Annotate with Video Annotator" to image context menu</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={contextMenuRegistered} onChange={handleContextMenuToggle} disabled={contextMenuLoading} className="sr-only peer" />
                <div
                  className={`w-11 h-6 bg-cinema-elevated border border-cinema-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-silver-muted after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-amber-glow peer-checked:to-amber-warm peer-checked:after:bg-cinema-black ${
                    contextMenuLoading ? "opacity-50" : ""
                  }`}
                ></div>
              </label>
            </div>

            {/* Show Drag Widget */}
            <div className="settings-row">
              <div>
                <p className="text-sm text-silver-light">Show Drag Widget</p>
                <p className="text-xs text-silver-muted">Display draggable thumbnail after saving</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={settings.showDragWidget} onChange={(e) => handleChange("showDragWidget", e.target.checked)} className="sr-only peer" />
                <div className="w-11 h-6 bg-cinema-elevated border border-cinema-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-silver-muted after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-amber-glow peer-checked:to-amber-warm peer-checked:after:bg-cinema-black"></div>
              </label>
            </div>

            {/* Auto Numbering */}
            <div className="settings-row">
              <div>
                <p className="text-sm text-silver-light">Auto Numbering</p>
                <p className="text-xs text-silver-muted">Automatically increment number markers</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={settings.autoNumbering} onChange={(e) => handleChange("autoNumbering", e.target.checked)} className="sr-only peer" />
                <div className="w-11 h-6 bg-cinema-elevated border border-cinema-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-silver-muted after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-amber-glow peer-checked:to-amber-warm peer-checked:after:bg-cinema-black"></div>
              </label>
            </div>

            {/* Numbering Start */}
            <div className="pt-3">
              <label className="settings-label">Numbering Start</label>
              <input type="number" min="1" value={settings.numberingStart} onChange={(e) => handleChange("numberingStart", parseInt(e.target.value) || 1)} className="input-field w-24 font-mono" />
            </div>
          </div>
        </section>

        {/* Hotkeys */}
        <section className="settings-section">
          <h2>KEYBOARD SHORTCUTS</h2>

          <div className="space-y-0">
            <div className="settings-row">
              <span className="text-silver">Toggle Overlay</span>
              <kbd>{settings.hotkeys.toggleOverlay.replace("CommandOrControl", "Ctrl")}</kbd>
            </div>
            <div className="settings-row">
              <span className="text-silver">Save</span>
              <kbd>{settings.hotkeys.save.replace("CommandOrControl", "Ctrl")}</kbd>
            </div>
            <div className="settings-row">
              <span className="text-silver">Undo</span>
              <kbd>{settings.hotkeys.undo.replace("CommandOrControl", "Ctrl")}</kbd>
            </div>
            <div className="settings-row">
              <span className="text-silver">Redo</span>
              <kbd>{settings.hotkeys.redo.replace("CommandOrControl", "Ctrl")}</kbd>
            </div>
          </div>

          <p className="text-xs text-silver-muted mt-4 leading-relaxed">
            <span className="text-amber-muted">Tool shortcuts:</span> V (Select), A (Arrow), R (Rectangle), E (Ellipse), L (Line), P (Pen), T (Text), S (Spotlight), B (Blur), M (Marker), N (Number), G (Magnifier)
          </p>
        </section>

        {/* Saved Regions */}
        {settings.savedRegions.length > 0 && (
          <section className="settings-section">
            <h2>SAVED REGIONS</h2>

            <div className="space-y-2">
              {settings.savedRegions.map((region, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-cinema-elevated/50 border border-cinema-border rounded-xl">
                  <div>
                    <p className="text-sm text-silver-light">{region.name}</p>
                    <p className="text-xs text-silver-muted font-mono">
                      {region.bounds.width} x {region.bounds.height}
                    </p>
                  </div>
                  <button
                    className="btn btn-ghost text-xs text-accent-danger hover:bg-accent-danger/10"
                    onClick={() => {
                      const updated = settings.savedRegions.filter((_, i) => i !== index);
                      handleChange("savedRegions", updated);
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-cinema-border flex items-center justify-between">
        <p className="text-xs text-silver-muted">{isSaving ? <span className="text-amber-warm">Saving...</span> : "Changes saved automatically"}</p>
        <p className="text-xs text-silver-muted font-mono">Video Annotator v1.0.0</p>
      </div>
    </div>
  );
};
