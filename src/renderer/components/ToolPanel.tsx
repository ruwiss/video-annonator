import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { fabric } from "fabric";
import { useToolStore, getPanelPosition, savePanelPosition } from "../stores/useToolStore";
import { useCanvasStore } from "../stores/useCanvasStore";
import { ToolType, UserTextPreset } from "../shared/types";
import { ARROW_PRESETS, LINE_PRESETS, MARKER_PRESETS, BLUR_TYPES, DEFAULT_BLUR_INTENSITY, MIN_BLUR_INTENSITY, MAX_BLUR_INTENSITY } from "../shared/presets";
import { ANNOTATION_COLORS } from "../shared/constants";
import { resetOverlayState, getOverlayState, updateSelectedBlur } from "./AnnotationCanvas";
import { CursorIcon, ArrowIcon, RectangleIcon, EllipseIcon, LineIcon, PencilIcon, TextIcon, SpotlightIcon, BlurIcon, MarkerIcon, NumberingIcon } from "./icons";

const TEXT_PRESETS_KEY = "video-annotator-text-presets";

const TOOLS: { type: ToolType; icon: React.FC<{ size?: number }>; label: string; shortcut: string }[] = [
  { type: "select", icon: CursorIcon, label: "Select", shortcut: "V" },
  { type: "arrow", icon: ArrowIcon, label: "Arrow", shortcut: "A" },
  { type: "rectangle", icon: RectangleIcon, label: "Rectangle", shortcut: "R" },
  { type: "ellipse", icon: EllipseIcon, label: "Ellipse", shortcut: "E" },
  { type: "line", icon: LineIcon, label: "Line", shortcut: "L" },
  { type: "freehand", icon: PencilIcon, label: "Pen", shortcut: "P" },
  { type: "text", icon: TextIcon, label: "Text", shortcut: "T" },
  { type: "marker", icon: MarkerIcon, label: "Marker", shortcut: "M" },
  { type: "numbering", icon: NumberingIcon, label: "Number", shortcut: "N" },
  { type: "spotlight", icon: SpotlightIcon, label: "Spotlight", shortcut: "S" },
  { type: "blur", icon: BlurIcon, label: "Blur", shortcut: "B" },
];

const loadUserTextPresets = (): UserTextPreset[] => {
  try {
    return JSON.parse(localStorage.getItem(TEXT_PRESETS_KEY) || "[]");
  } catch {
    return [];
  }
};
const saveUserTextPresets = (presets: UserTextPreset[]) => localStorage.setItem(TEXT_PRESETS_KEY, JSON.stringify(presets));

// Panel view types
type PanelView = "main" | "shadow" | "stroke" | "presets";

export const ToolPanel: React.FC<{ className?: string }> = ({ className }) => {
  const { activeTool, setActiveTool, config, setConfig, activePresets, setActivePreset } = useToolStore();
  const { canvas } = useCanvasStore();

  const [selectedObjectType, setSelectedObjectType] = useState<string | null>(null);
  const [mainPanelHeight, setMainPanelHeight] = useState(0);
  const mainPanelRef = useRef<HTMLDivElement>(null);

  // Panel navigation
  const [panelView, setPanelView] = useState<PanelView>("main");

  // User presets
  const [userTextPresets, setUserTextPresets] = useState<UserTextPreset[]>(loadUserTextPresets);
  const [newPresetName, setNewPresetName] = useState("");

  // Font picker
  const [systemFonts, setSystemFonts] = useState<string[]>([]);
  const [fontSearch, setFontSearch] = useState("");
  const [fontDropdownOpen, setFontDropdownOpen] = useState(false);
  const fontInputRef = useRef<HTMLInputElement>(null);
  const fontListRef = useRef<HTMLDivElement>(null);

  // Draggable - initialize with saved position immediately
  const [position, setPosition] = useState(() => getPanelPosition() || { x: 16, y: (typeof window !== "undefined" ? window.innerHeight : 600) / 2 - 250 });
  const [isDragging, setIsDragging] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);

  // Show panel after mount to prevent position jump
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Load fonts
  useEffect(() => {
    window.electronAPI?.getSystemFonts?.().then(setSystemFonts);
  }, []);

  const filteredFonts = useMemo(() => {
    if (!fontSearch) return systemFonts.slice(0, 50);
    return systemFonts.filter((f) => f.toLowerCase().includes(fontSearch.toLowerCase())).slice(0, 50);
  }, [systemFonts, fontSearch]);

  // Close font dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (fontListRef.current && !fontListRef.current.contains(e.target as Node) && fontInputRef.current && !fontInputRef.current.contains(e.target as Node)) setFontDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Selection listener - also load blur settings when blur object is selected
  useEffect(() => {
    if (!canvas) return;
    const onSelect = () => {
      const obj = canvas.getActiveObject();
      const type = obj?.data?.type || null;
      setSelectedObjectType(type);

      // Load blur settings from selected blur object
      if (type === "blur" && obj?.data) {
        const blurStyle = obj.data.blurStyle || config.blurStyle;
        const blurIntensity = obj.data.blurIntensity || config.blurIntensity;
        setConfig({ blurStyle, blurIntensity });
      }
    };
    const onClear = () => setSelectedObjectType(null);
    canvas.on("selection:created", onSelect);
    canvas.on("selection:updated", onSelect);
    canvas.on("selection:cleared", onClear);
    return () => {
      canvas.off("selection:created", onSelect);
      canvas.off("selection:updated", onSelect);
      canvas.off("selection:cleared", onClear);
    };
  }, [canvas, config.blurStyle, config.blurIntensity, setConfig]);

  // Drag handlers
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      dragRef.current = { startX: e.clientX, startY: e.clientY, startPosX: position.x, startPosY: position.y };
    },
    [position]
  );

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - 200, dragRef.current.startPosX + e.clientX - dragRef.current.startX)),
        y: Math.max(0, Math.min(window.innerHeight - 400, dragRef.current.startPosY + e.clientY - dragRef.current.startY)),
      });
    };
    const onUp = () => {
      setIsDragging(false);
      savePanelPosition(position);
      dragRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging, position]);

  useEffect(() => {
    if (mainPanelRef.current) setMainPanelHeight(mainPanelRef.current.offsetHeight);
  }, [activeTool, selectedObjectType]);

  // Reset panel view when tool changes
  useEffect(() => {
    setPanelView("main");
  }, [activeTool, selectedObjectType]);

  const showOptions = getOptionsToShow(activeTool, selectedObjectType);

  const applyToSelected = useCallback(
    (props: Record<string, any>) => {
      if (!canvas) return;
      const obj = canvas.getActiveObject();
      if (obj) {
        obj.set(props);
        canvas.renderAll();
      }
    },
    [canvas]
  );

  // Shadow helper
  const applyShadow = useCallback(() => {
    if (!config.textShadow) return applyToSelected({ shadow: undefined });
    applyToSelected({ shadow: new fabric.Shadow({ color: config.textShadowColor, blur: config.textShadowBlur, offsetX: config.textShadowOffsetX, offsetY: config.textShadowOffsetY }) });
  }, [config.textShadow, config.textShadowColor, config.textShadowBlur, config.textShadowOffsetX, config.textShadowOffsetY, applyToSelected]);

  // Preset handlers
  const savePreset = useCallback(() => {
    if (!newPresetName.trim()) return;
    const preset: UserTextPreset = {
      id: Date.now().toString(),
      name: newPresetName.trim(),
      color: config.strokeColor,
      fontFamily: config.fontFamily,
      fontWeight: config.fontWeight,
      fontSize: config.fontSize,
      textAlign: config.textAlign,
      lineHeight: config.lineHeight,
      charSpacing: config.charSpacing,
      textShadow: config.textShadow,
      textShadowColor: config.textShadowColor,
      textShadowBlur: config.textShadowBlur,
      textShadowOffsetX: config.textShadowOffsetX,
      textShadowOffsetY: config.textShadowOffsetY,
      textStroke: config.textStroke,
      textStrokeColor: config.textStrokeColor,
      textStrokeWidth: config.textStrokeWidth,
    };
    const updated = [...userTextPresets, preset];
    setUserTextPresets(updated);
    saveUserTextPresets(updated);
    setNewPresetName("");
  }, [newPresetName, config, userTextPresets]);

  const applyPreset = useCallback(
    (p: UserTextPreset) => {
      setConfig({
        strokeColor: p.color || config.strokeColor,
        fontFamily: p.fontFamily,
        fontWeight: p.fontWeight,
        fontSize: p.fontSize,
        textAlign: p.textAlign || "left",
        lineHeight: p.lineHeight || 1.2,
        charSpacing: p.charSpacing || 0,
        textShadow: p.textShadow,
        textShadowColor: p.textShadowColor,
        textShadowBlur: p.textShadowBlur,
        textShadowOffsetX: p.textShadowOffsetX,
        textShadowOffsetY: p.textShadowOffsetY,
        textStroke: p.textStroke,
        textStrokeColor: p.textStrokeColor,
        textStrokeWidth: p.textStrokeWidth,
      });
      const shadow = p.textShadow ? new fabric.Shadow({ color: p.textShadowColor, blur: p.textShadowBlur, offsetX: p.textShadowOffsetX, offsetY: p.textShadowOffsetY }) : undefined;
      applyToSelected({
        fill: p.color || config.strokeColor,
        fontFamily: p.fontFamily,
        fontWeight: p.fontWeight,
        fontSize: p.fontSize,
        textAlign: p.textAlign || "left",
        lineHeight: p.lineHeight || 1.2,
        charSpacing: p.charSpacing || 0,
        shadow,
        stroke: p.textStroke ? p.textStrokeColor : undefined,
        strokeWidth: p.textStroke ? p.textStrokeWidth : 0,
      });
      setPanelView("main");
    },
    [setConfig, applyToSelected, config.strokeColor]
  );

  const deletePreset = useCallback(
    (id: string) => {
      const updated = userTextPresets.filter((p) => p.id !== id);
      setUserTextPresets(updated);
      saveUserTextPresets(updated);
    },
    [userTextPresets]
  );

  return (
    <div
      className={`fixed z-40 flex ${className ?? ""}`}
      style={{
        left: position.x,
        top: position.y,
        opacity: isVisible ? 1 : 0,
        transition: "opacity 0.15s ease-out",
      }}
    >
      {/* Main Tool Panel */}
      <div ref={mainPanelRef} className="tool-panel overflow-hidden">
        <div className="h-7 flex items-center justify-center cursor-grab active:cursor-grabbing border-b border-cinema-border" onMouseDown={handleDragStart}>
          <div className="w-10 h-1 rounded-full bg-gradient-to-r from-transparent via-amber-glow/30 to-transparent" />
        </div>
        <div className="flex flex-col gap-0.5 p-1.5">
          {TOOLS.map(({ type, icon: Icon, label, shortcut }) => (
            <button key={type} className={`tool-btn group relative ${activeTool === type ? "active" : ""}`} onClick={() => setActiveTool(type)} title={`${label} (${shortcut})`}>
              <Icon size={18} />
              <div className="absolute left-full ml-3 px-3 py-1.5 bg-cinema-dark/98 border border-cinema-border text-silver-light text-xs font-body rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-cinematic backdrop-blur-md">
                {label} <span className="text-amber-muted font-mono text-[10px]">{shortcut}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Options Panel */}
      {showOptions.show && (
        <div className="ml-2 tool-panel w-[180px] overflow-hidden flex flex-col" style={{ height: mainPanelHeight > 0 ? mainPanelHeight : "auto" }}>
          {/* Panel Header for sub-views */}
          {panelView !== "main" && (
            <button onClick={() => setPanelView("main")} className="flex items-center gap-2 px-3 py-2.5 text-xs text-silver hover:text-amber-warm border-b border-cinema-border transition-colors group">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="group-hover:-translate-x-0.5 transition-transform">
                <path d="M7.5 9L4.5 6L7.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="font-medium font-display tracking-wider text-[11px]">{panelView === "shadow" ? "SHADOW" : panelView === "stroke" ? "STROKE" : "PRESETS"}</span>
            </button>
          )}

          <div className="p-3 overflow-y-auto flex-1">
            {/* MAIN VIEW */}
            {panelView === "main" && (
              <>
                {/* Color */}
                {showOptions.color && (
                  <Section title="Color">
                    <div className="grid grid-cols-4 gap-2">
                      {ANNOTATION_COLORS.map((c) => (
                        <button
                          key={c}
                          className={`color-swatch ${config.strokeColor === c ? "active" : ""}`}
                          style={{ backgroundColor: c }}
                          onClick={() => {
                            setConfig({ strokeColor: c });
                            if (selectedObjectType === "text") applyToSelected({ fill: c });
                            else if (selectedObjectType) applyToSelected({ stroke: c, fill: config.filled ? c : "transparent" });
                          }}
                        />
                      ))}
                      <div className="relative w-6 h-6 group">
                        <input
                          type="color"
                          value={config.strokeColor.startsWith("#") ? config.strokeColor : "#ffffff"}
                          onChange={(e) => {
                            const c = e.target.value;
                            setConfig({ strokeColor: c });
                            if (selectedObjectType === "text") applyToSelected({ fill: c });
                            else if (selectedObjectType) applyToSelected({ stroke: c, fill: config.filled ? c : "transparent" });
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div
                          className="w-6 h-6 rounded-lg border border-cinema-border-strong flex items-center justify-center transition-all group-hover:scale-110 group-hover:border-amber-glow/50"
                          style={{
                            background: "conic-gradient(from 0deg, #e85d5d, #fbbf24, #4ade80, #d4a574, #a78bfa, #ec4899, #e85d5d)",
                          }}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" className="drop-shadow-md">
                            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                          </svg>
                        </div>
                        {!ANNOTATION_COLORS.includes(config.strokeColor as any) && <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-cinema-dark shadow-glow-sm" style={{ backgroundColor: config.strokeColor }} />}
                      </div>
                    </div>
                  </Section>
                )}

                {/* Arrow/Line/Marker Presets */}
                {showOptions.arrowPresets && (
                  <Section title="Style">
                    {ARROW_PRESETS.map((p) => (
                      <PresetBtn key={p.id} p={p} active={activePresets.arrow === p.id} onClick={() => setActivePreset("arrow", p.id)} />
                    ))}
                  </Section>
                )}
                {showOptions.linePresets && (
                  <Section title="Style">
                    {LINE_PRESETS.map((p) => (
                      <PresetBtn
                        key={p.id}
                        p={p}
                        active={activePresets.line === p.id}
                        onClick={() => {
                          setActivePreset("line", p.id);
                          // Apply to selected line object
                          if (selectedObjectType === "line") {
                            applyToSelected({ strokeDashArray: p.style.strokeDashArray || null });
                          }
                        }}
                      />
                    ))}
                  </Section>
                )}
                {showOptions.markerPresets && (
                  <Section title="Size">
                    {MARKER_PRESETS.map((p) => (
                      <PresetBtn key={p.id} p={{ ...p, icon: "━" }} active={activePresets.marker === p.id} onClick={() => setActivePreset("marker", p.id)} />
                    ))}
                  </Section>
                )}

                {/* Fill */}
                {showOptions.fill && (
                  <Section title="Fill">
                    <div className="flex gap-1">
                      <Btn
                        active={!config.filled}
                        onClick={() => {
                          setConfig({ filled: false });
                          applyToSelected({ fill: "transparent", stroke: config.strokeColor, strokeWidth: config.strokeWidth });
                        }}
                      >
                        Outline
                      </Btn>
                      <Btn
                        active={config.filled}
                        onClick={() => {
                          setConfig({ filled: true });
                          applyToSelected({ fill: config.strokeColor, strokeWidth: 0 });
                        }}
                      >
                        Filled
                      </Btn>
                    </div>
                  </Section>
                )}

                {/* Opacity */}
                {showOptions.opacity && (
                  <Section title={`Opacity ${Math.round(config.opacity * 100)}%`}>
                    <input
                      type="range"
                      min="20"
                      max="100"
                      value={config.opacity * 100}
                      onChange={(e) => {
                        const v = +e.target.value / 100;
                        setConfig({ opacity: v });
                        applyToSelected({ opacity: v });
                      }}
                      className="w-full accent-blue-500 h-1"
                    />
                  </Section>
                )}

                {/* Radius */}
                {showOptions.radius && (
                  <Section title={`Radius ${config.cornerRadius}`}>
                    <input
                      type="range"
                      min="0"
                      max="32"
                      value={config.cornerRadius}
                      onChange={(e) => {
                        const v = +e.target.value;
                        setConfig({ cornerRadius: v });
                        applyToSelected({ rx: v, ry: v });
                      }}
                      className="w-full accent-blue-500 h-1"
                    />
                  </Section>
                )}

                {/* Stroke Width */}
                {showOptions.strokeWidth && (
                  <Section title="Size">
                    <div className="flex gap-1.5">
                      {[2, 3, 5, 8].map((w) => (
                        <button
                          key={w}
                          className={`mini-btn h-8 flex items-center justify-center ${config.strokeWidth === w ? "active" : ""}`}
                          onClick={() => {
                            setConfig({ strokeWidth: w });
                            applyToSelected({ strokeWidth: w });
                          }}
                        >
                          <div className="rounded-full bg-current" style={{ width: w + 2, height: w + 2 }} />
                        </button>
                      ))}
                    </div>
                  </Section>
                )}

                {/* Spotlight */}
                {showOptions.spotlight && (
                  <>
                    <Section title="Shape">
                      <div className="flex gap-1.5">
                        {(["circle", "rounded", "rectangle"] as const).map((s) => (
                          <Btn key={s} active={config.spotlightShape === s} onClick={() => setConfig({ spotlightShape: s })}>
                            {s === "circle" ? "○" : s === "rounded" ? "▢" : "□"}
                          </Btn>
                        ))}
                      </div>
                    </Section>
                    <Section title="Color">
                      <input type="color" value={config.spotlightColor} onChange={(e) => setConfig({ spotlightColor: e.target.value })} className="w-full h-8 rounded-lg cursor-pointer bg-cinema-surface border border-cinema-border" />
                    </Section>
                    <Section title={`Opacity ${Math.round(config.spotlightDarkness * 100)}%`}>
                      <input type="range" min="30" max="90" value={config.spotlightDarkness * 100} onChange={(e) => setConfig({ spotlightDarkness: +e.target.value / 100 })} className="w-full h-1" />
                    </Section>
                  </>
                )}

                {/* Blur - Simplified: Type + Intensity */}
                {showOptions.blur && (
                  <>
                    <Section title="Type">
                      <div className="flex gap-1.5">
                        {BLUR_TYPES.map((b) => (
                          <button
                            key={b.id}
                            className={`mini-btn py-2 text-[10px] flex items-center justify-center gap-1 ${config.blurStyle === b.type ? "active" : ""}`}
                            onClick={async () => {
                              setConfig({ blurStyle: b.type });
                              if (selectedObjectType === "blur") {
                                await updateSelectedBlur(b.type, config.blurIntensity);
                              }
                            }}
                          >
                            <span>{b.icon}</span>
                            <span>{b.name}</span>
                          </button>
                        ))}
                      </div>
                    </Section>
                    <Section title={`Intensity ${config.blurIntensity}`}>
                      <input
                        type="range"
                        min={MIN_BLUR_INTENSITY}
                        max={MAX_BLUR_INTENSITY}
                        value={config.blurIntensity}
                        onChange={(e) => setConfig({ blurIntensity: +e.target.value })}
                        onMouseUp={async () => {
                          if (selectedObjectType === "blur") {
                            await updateSelectedBlur(config.blurStyle, config.blurIntensity);
                          }
                        }}
                        className="w-full h-1"
                      />
                      <div className="flex justify-between text-[9px] text-silver-muted mt-1.5 font-medium">
                        <span>Light</span>
                        <span>Heavy</span>
                      </div>
                    </Section>
                  </>
                )}

                {/* Alignment Tools - Show when object is selected */}
                {showOptions.alignment && selectedObjectType && (
                  <>
                    <Section title="Transform">
                      <div className="grid grid-cols-4 gap-1.5 mb-3">
                        {/* Flip Horizontal */}
                        <button
                          className="align-btn"
                          onClick={() => {
                            if (!canvas) return;
                            const obj = canvas.getActiveObject();
                            if (obj) {
                              obj.set({ flipX: !obj.flipX });
                              canvas.renderAll();
                            }
                          }}
                          title="Flip Horizontal (Ctrl+H)"
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M7 2v10M3 4l2 3-2 3M11 4l-2 3 2 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                        {/* Flip Vertical */}
                        <button
                          className="align-btn"
                          onClick={() => {
                            if (!canvas) return;
                            const obj = canvas.getActiveObject();
                            if (obj) {
                              obj.set({ flipY: !obj.flipY });
                              canvas.renderAll();
                            }
                          }}
                          title="Flip Vertical (Ctrl+J)"
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M2 7h10M4 3l3 2-3 2M4 9l3 2-3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" transform="rotate(90 7 7)" />
                          </svg>
                        </button>
                        {/* Rotate Left */}
                        <button
                          className="align-btn"
                          onClick={() => {
                            if (!canvas) return;
                            const obj = canvas.getActiveObject();
                            if (obj) {
                              obj.rotate((obj.angle || 0) - 15);
                              canvas.renderAll();
                            }
                          }}
                          title="Rotate Left 15° (Ctrl+[)"
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M2 7a5 5 0 1 1 1.5 3.5M2 7V4M2 7h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                        {/* Rotate Right */}
                        <button
                          className="align-btn"
                          onClick={() => {
                            if (!canvas) return;
                            const obj = canvas.getActiveObject();
                            if (obj) {
                              obj.rotate((obj.angle || 0) + 15);
                              canvas.renderAll();
                            }
                          }}
                          title="Rotate Right 15° (Ctrl+])"
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M12 7a5 5 0 1 0-1.5 3.5M12 7V4M12 7h-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>
                      {/* Duplicate button */}
                      <button
                        className="w-full py-1.5 rounded-md text-[10px] bg-cinema-elevated/60 text-silver border border-cinema-border hover:border-amber-glow/30 hover:text-amber-warm transition-all flex items-center justify-center gap-1.5"
                        onClick={() => {
                          if (!canvas) return;
                          const obj = canvas.getActiveObject();
                          if (obj) {
                            obj.clone(
                              (cloned: fabric.Object) => {
                                cloned.set({
                                  left: (obj.left || 0) + 20,
                                  top: (obj.top || 0) + 20,
                                  evented: true,
                                  selectable: true,
                                });
                                // For IText objects, ensure editing capability is preserved
                                if (cloned.type === "i-text") {
                                  (cloned as any).set({ editable: true });
                                }
                                canvas.add(cloned);
                                canvas.setActiveObject(cloned);
                                canvas.renderAll();
                              },
                              ["data", "selectable", "evented"]
                            );
                          }
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <rect x="1" y="3" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
                          <rect x="5" y="3" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" fill="rgba(17,17,19,0.8)" />
                        </svg>
                        Duplicate (Ctrl+D)
                      </button>
                    </Section>

                    <Section title="Align to Canvas">
                      <div className="grid grid-cols-3 gap-1.5">
                        {/* Horizontal alignment */}
                        <button
                          className="align-btn"
                          onClick={() => {
                            if (!canvas) return;
                            const obj = canvas.getActiveObject();
                            if (obj) {
                              obj.set({ left: 0 });
                              canvas.renderAll();
                            }
                          }}
                          title="Align Left"
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M2 2v10M5 4h6M5 7h4M5 10h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        </button>
                        <button
                          className="align-btn"
                          onClick={() => {
                            if (!canvas) return;
                            const obj = canvas.getActiveObject();
                            if (obj) {
                              const canvasCenter = canvas.getWidth() / 2;
                              const objWidth = obj.getScaledWidth();
                              obj.set({ left: canvasCenter - objWidth / 2 });
                              canvas.renderAll();
                            }
                          }}
                          title="Align Center Horizontal"
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M7 2v10M4 4h6M5 7h4M4 10h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        </button>
                        <button
                          className="align-btn"
                          onClick={() => {
                            if (!canvas) return;
                            const obj = canvas.getActiveObject();
                            if (obj) {
                              const canvasWidth = canvas.getWidth();
                              const objWidth = obj.getScaledWidth();
                              obj.set({ left: canvasWidth - objWidth });
                              canvas.renderAll();
                            }
                          }}
                          title="Align Right"
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M12 2v10M3 4h6M5 7h4M3 10h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        </button>
                        {/* Vertical alignment */}
                        <button
                          className="align-btn"
                          onClick={() => {
                            if (!canvas) return;
                            const obj = canvas.getActiveObject();
                            if (obj) {
                              obj.set({ top: 0 });
                              canvas.renderAll();
                            }
                          }}
                          title="Align Top"
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M2 2h10M4 5v6M7 5v4M10 5v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        </button>
                        <button
                          className="align-btn"
                          onClick={() => {
                            if (!canvas) return;
                            const obj = canvas.getActiveObject();
                            if (obj) {
                              const canvasCenter = canvas.getHeight() / 2;
                              const objHeight = obj.getScaledHeight();
                              obj.set({ top: canvasCenter - objHeight / 2 });
                              canvas.renderAll();
                            }
                          }}
                          title="Align Center Vertical"
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M2 7h10M4 4v6M7 5v4M10 4v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        </button>
                        <button
                          className="align-btn"
                          onClick={() => {
                            if (!canvas) return;
                            const obj = canvas.getActiveObject();
                            if (obj) {
                              const canvasHeight = canvas.getHeight();
                              const objHeight = obj.getScaledHeight();
                              obj.set({ top: canvasHeight - objHeight });
                              canvas.renderAll();
                            }
                          }}
                          title="Align Bottom"
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M2 12h10M4 3v6M7 5v4M10 3v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                      {/* Center both */}
                      <button
                        className="w-full mt-2 py-1.5 rounded-md text-[10px] bg-cinema-elevated/60 text-silver border border-cinema-border hover:border-amber-glow/30 hover:text-amber-warm transition-all flex items-center justify-center gap-1.5"
                        onClick={() => {
                          if (!canvas) return;
                          const obj = canvas.getActiveObject();
                          if (obj) {
                            const canvasCenterX = canvas.getWidth() / 2;
                            const canvasCenterY = canvas.getHeight() / 2;
                            const objWidth = obj.getScaledWidth();
                            const objHeight = obj.getScaledHeight();
                            obj.set({
                              left: canvasCenterX - objWidth / 2,
                              top: canvasCenterY - objHeight / 2,
                            });
                            canvas.renderAll();
                          }
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <circle cx="6" cy="6" r="2" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M6 1v2M6 9v2M1 6h2M9 6h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                        Center on Canvas
                      </button>
                    </Section>
                  </>
                )}

                {/* Text Options */}
                {showOptions.text && (
                  <>
                    {/* Quick Presets */}
                    {userTextPresets.length > 0 && (
                      <Section title="Quick">
                        <div className="flex gap-1.5 flex-wrap">
                          {userTextPresets.slice(0, 3).map((p) => (
                            <button key={p.id} onClick={() => applyPreset(p)} className="px-2.5 py-1 rounded-md text-[10px] bg-cinema-elevated/80 text-silver border border-cinema-border hover:border-amber-glow/30 hover:text-amber-warm transition-all truncate max-w-[50px]" title={p.name}>
                              {p.name}
                            </button>
                          ))}
                          {userTextPresets.length > 3 && (
                            <button onClick={() => setPanelView("presets")} className="px-2.5 py-1 rounded-md text-[10px] bg-cinema-elevated/50 text-silver-muted hover:text-silver transition-colors">
                              +{userTextPresets.length - 3}
                            </button>
                          )}
                        </div>
                      </Section>
                    )}

                    {/* Font */}
                    <Section title="Font">
                      <div className="relative">
                        <input
                          ref={fontInputRef}
                          type="text"
                          value={fontDropdownOpen ? fontSearch : config.fontFamily}
                          onChange={(e) => setFontSearch(e.target.value)}
                          onFocus={() => {
                            setFontDropdownOpen(true);
                            setFontSearch("");
                          }}
                          placeholder="Search..."
                          className="w-full bg-cinema-black/60 border border-cinema-border rounded-lg px-3 py-2 text-[11px] text-silver-light focus:border-amber-glow/50 focus:outline-none transition-colors"
                        />
                        {fontDropdownOpen && (
                          <div ref={fontListRef} className="font-dropdown">
                            {filteredFonts.map((f) => (
                              <button
                                key={f}
                                className="w-full px-3 py-1.5 text-left text-[11px] text-silver hover:bg-amber-glow/10 hover:text-amber-warm truncate transition-colors"
                                style={{ fontFamily: f }}
                                onClick={() => {
                                  setConfig({ fontFamily: f });
                                  applyToSelected({ fontFamily: f });
                                  setFontDropdownOpen(false);
                                }}
                              >
                                {f}
                              </button>
                            ))}
                            {!filteredFonts.length && <div className="px-3 py-2 text-[11px] text-silver-muted">No fonts</div>}
                          </div>
                        )}
                      </div>
                    </Section>

                    {/* Size & Weight */}
                    <Section title="Size">
                      <div className="flex gap-1.5">
                        {[16, 24, 32, 48].map((s) => (
                          <Btn
                            key={s}
                            active={config.fontSize === s}
                            onClick={() => {
                              setConfig({ fontSize: s });
                              applyToSelected({ fontSize: s });
                            }}
                          >
                            {s}
                          </Btn>
                        ))}
                      </div>
                    </Section>
                    <Section title="Weight">
                      <div className="flex gap-1.5">
                        <Btn
                          active={config.fontWeight === "normal"}
                          onClick={() => {
                            setConfig({ fontWeight: "normal" });
                            applyToSelected({ fontWeight: "normal" });
                          }}
                        >
                          Regular
                        </Btn>
                        <Btn
                          active={config.fontWeight === "bold"}
                          onClick={() => {
                            setConfig({ fontWeight: "bold" });
                            applyToSelected({ fontWeight: "bold" });
                          }}
                        >
                          Bold
                        </Btn>
                      </div>
                    </Section>

                    {/* Alignment */}
                    <Section title="Align">
                      <div className="flex gap-1.5">
                        {(["left", "center", "right"] as const).map((a) => (
                          <Btn
                            key={a}
                            active={config.textAlign === a}
                            onClick={() => {
                              setConfig({ textAlign: a });
                              applyToSelected({ textAlign: a });
                            }}
                          >
                            {a === "left" ? "⫷" : a === "center" ? "☰" : "⫸"}
                          </Btn>
                        ))}
                      </div>
                    </Section>

                    {/* Spacing */}
                    <Section title="Spacing">
                      <div className="flex gap-2 items-center mb-2.5">
                        <span className="text-[10px] text-silver-muted w-8">Line</span>
                        <button
                          onClick={() => {
                            const v = Math.max(0.8, config.lineHeight - 0.1);
                            setConfig({ lineHeight: v });
                            applyToSelected({ lineHeight: v });
                          }}
                          className="w-6 h-6 rounded-md bg-cinema-elevated text-silver hover:bg-cinema-elevated/80 hover:text-amber-warm text-xs transition-colors"
                        >
                          −
                        </button>
                        <span className="text-[11px] text-silver-light w-8 text-center font-mono">{config.lineHeight.toFixed(1)}</span>
                        <button
                          onClick={() => {
                            const v = Math.min(3, config.lineHeight + 0.1);
                            setConfig({ lineHeight: v });
                            applyToSelected({ lineHeight: v });
                          }}
                          className="w-6 h-6 rounded-md bg-cinema-elevated text-silver hover:bg-cinema-elevated/80 hover:text-amber-warm text-xs transition-colors"
                        >
                          +
                        </button>
                      </div>
                      <div className="flex gap-2 items-center">
                        <span className="text-[10px] text-silver-muted w-8">Char</span>
                        <button
                          onClick={() => {
                            const v = Math.max(-200, config.charSpacing - 50);
                            setConfig({ charSpacing: v });
                            applyToSelected({ charSpacing: v });
                          }}
                          className="w-6 h-6 rounded-md bg-cinema-elevated text-silver hover:bg-cinema-elevated/80 hover:text-amber-warm text-xs transition-colors"
                        >
                          −
                        </button>
                        <span className="text-[11px] text-silver-light w-8 text-center font-mono">{config.charSpacing}</span>
                        <button
                          onClick={() => {
                            const v = Math.min(500, config.charSpacing + 50);
                            setConfig({ charSpacing: v });
                            applyToSelected({ charSpacing: v });
                          }}
                          className="w-6 h-6 rounded-md bg-cinema-elevated text-silver hover:bg-cinema-elevated/80 hover:text-amber-warm text-xs transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </Section>

                    {/* Effects - Navigate to sub-views */}
                    <Section title="Effects">
                      <NavBtn onClick={() => setPanelView("shadow")} active={config.textShadow}>
                        Shadow
                      </NavBtn>
                      <NavBtn onClick={() => setPanelView("stroke")} active={config.textStroke}>
                        Stroke
                      </NavBtn>
                    </Section>

                    {/* Presets */}
                    <Section title="Presets">
                      <NavBtn onClick={() => setPanelView("presets")} active={false}>
                        Manage Presets
                      </NavBtn>
                    </Section>
                  </>
                )}
              </>
            )}

            {/* SHADOW VIEW */}
            {panelView === "shadow" && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[11px] text-silver-light">Enable Shadow</span>
                  <Toggle
                    active={config.textShadow}
                    onClick={() => {
                      setConfig({ textShadow: !config.textShadow });
                      setTimeout(applyShadow, 0);
                    }}
                  />
                </div>
                {config.textShadow && (
                  <>
                    <Section title="Color">
                      <input
                        type="color"
                        value={config.textShadowColor.startsWith("rgba") ? "#000000" : config.textShadowColor}
                        onChange={(e) => {
                          setConfig({ textShadowColor: e.target.value });
                          setTimeout(applyShadow, 0);
                        }}
                        className="w-full h-9 rounded-lg cursor-pointer bg-cinema-surface border border-cinema-border"
                      />
                    </Section>
                    <div className="grid grid-cols-2 gap-2">
                      <NumInput
                        label="Blur"
                        value={config.textShadowBlur}
                        onChange={(v) => {
                          setConfig({ textShadowBlur: v });
                          setTimeout(applyShadow, 0);
                        }}
                        min={0}
                        max={30}
                      />
                      <NumInput
                        label="Offset X"
                        value={config.textShadowOffsetX}
                        onChange={(v) => {
                          setConfig({ textShadowOffsetX: v });
                          setTimeout(applyShadow, 0);
                        }}
                        min={-20}
                        max={20}
                      />
                      <NumInput
                        label="Offset Y"
                        value={config.textShadowOffsetY}
                        onChange={(v) => {
                          setConfig({ textShadowOffsetY: v });
                          setTimeout(applyShadow, 0);
                        }}
                        min={-20}
                        max={20}
                      />
                    </div>
                  </>
                )}
              </>
            )}

            {/* STROKE VIEW */}
            {panelView === "stroke" && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[11px] text-silver-light">Enable Stroke</span>
                  <Toggle
                    active={config.textStroke}
                    onClick={() => {
                      const v = !config.textStroke;
                      setConfig({ textStroke: v });
                      applyToSelected({ stroke: v ? config.textStrokeColor : undefined, strokeWidth: v ? config.textStrokeWidth : 0 });
                    }}
                  />
                </div>
                {config.textStroke && (
                  <>
                    <Section title="Color">
                      <input
                        type="color"
                        value={config.textStrokeColor}
                        onChange={(e) => {
                          setConfig({ textStrokeColor: e.target.value });
                          applyToSelected({ stroke: e.target.value });
                        }}
                        className="w-full h-9 rounded-lg cursor-pointer bg-cinema-surface border border-cinema-border"
                      />
                    </Section>
                    <NumInput
                      label="Width"
                      value={config.textStrokeWidth}
                      onChange={(v) => {
                        setConfig({ textStrokeWidth: v });
                        applyToSelected({ strokeWidth: v });
                      }}
                      min={0.5}
                      max={10}
                      step={0.5}
                    />
                  </>
                )}
              </>
            )}

            {/* PRESETS VIEW */}
            {panelView === "presets" && (
              <>
                <input
                  type="text"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && savePreset()}
                  placeholder="Preset name..."
                  className="w-full bg-cinema-black/60 border border-cinema-border rounded-lg px-3 py-2 text-[11px] text-silver-light focus:border-amber-glow/50 focus:outline-none mb-3 transition-colors"
                />
                <button onClick={savePreset} disabled={!newPresetName.trim()} className="btn btn-primary w-full py-2.5 text-[11px] mb-4 disabled:opacity-40 disabled:cursor-not-allowed">
                  Save Current Style
                </button>
                <div className="space-y-1.5">
                  {!userTextPresets.length && (
                    <div className="text-[11px] text-silver-muted text-center py-6">
                      No presets yet.
                      <br />
                      <span className="text-amber-muted">Configure text style and save.</span>
                    </div>
                  )}
                  {userTextPresets.map((p) => (
                    <div key={p.id} className="group flex items-center gap-1.5 bg-cinema-elevated/50 border border-cinema-border rounded-lg px-3 py-2 hover:border-amber-glow/20 transition-colors">
                      <button onClick={() => applyPreset(p)} className="flex-1 text-left text-[11px] text-silver truncate hover:text-amber-warm transition-colors">
                        {p.name}
                      </button>
                      <button onClick={() => deletePreset(p.id)} className="p-1 rounded text-silver-muted hover:text-accent-danger opacity-0 group-hover:opacity-100 transition-all">
                        <svg width="10" height="10" viewBox="0 0 10 10">
                          <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Components
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mb-4">
    <div className="section-title">{title}</div>
    {children}
  </div>
);

const Btn: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button className={`mini-btn ${active ? "active" : ""}`} onClick={onClick}>
    {children}
  </button>
);

const NavBtn: React.FC<{ onClick: () => void; active: boolean; children: React.ReactNode }> = ({ onClick, active, children }) => (
  <button onClick={onClick} className={`nav-btn ${active ? "active" : ""}`}>
    <span>{children}</span>
    {active && <span className="text-[9px] text-amber-glow">ON</span>}
  </button>
);

const Toggle: React.FC<{ active: boolean; onClick: () => void }> = ({ active, onClick }) => <button onClick={onClick} className={`toggle-switch ${active ? "active" : ""}`} />;

const NumInput: React.FC<{ label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }> = ({ label, value, onChange, min = 0, max = 100, step = 0.5 }) => (
  <div className="mb-2">
    <div className="text-[10px] text-silver-muted mb-1.5">{label}</div>
    <input type="number" step={step} min={min} max={max} value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className="num-input" />
  </div>
);

const PresetBtn: React.FC<{ p: { id: string; name: string; icon: string }; active: boolean; onClick: () => void }> = ({ p, active, onClick }) => (
  <button className={`preset-btn ${active ? "active" : ""}`} onClick={onClick}>
    <span className="icon">{p.icon}</span>
    <span>{p.name}</span>
  </button>
);

function getOptionsToShow(tool: ToolType, selectedType: string | null) {
  const base = { show: false, color: false, fill: false, radius: false, strokeWidth: false, arrowPresets: false, linePresets: false, markerPresets: false, spotlight: false, blur: false, text: false, opacity: false, alignment: false };

  switch (tool) {
    case "arrow":
      return { ...base, show: true, color: true, arrowPresets: true, strokeWidth: true };
    case "line":
      return { ...base, show: true, color: true, linePresets: true, strokeWidth: true };
    case "rectangle":
      return { ...base, show: true, color: true, fill: true, radius: true, strokeWidth: true, opacity: true };
    case "ellipse":
      return { ...base, show: true, color: true, fill: true, strokeWidth: true, opacity: true };
    case "freehand":
      return { ...base, show: true, color: true, strokeWidth: true };
    case "marker":
      return { ...base, show: true, color: true, markerPresets: true };
    case "numbering":
      return { ...base, show: true, color: true };
    case "spotlight":
      return { ...base, show: true, spotlight: true };
    case "blur":
      return { ...base, show: true, blur: true };
    case "text":
      return { ...base, show: true, color: true, text: true };
  }

  // Selection mode - show options based on selected object type
  if (tool === "select" && selectedType) {
    switch (selectedType) {
      case "arrow":
        return { ...base, show: true, alignment: true };
      case "line":
        return { ...base, show: true, color: true, linePresets: true, strokeWidth: true, alignment: true };
      case "rectangle":
        return { ...base, show: true, color: true, fill: true, radius: true, strokeWidth: true, opacity: true, alignment: true };
      case "ellipse":
        return { ...base, show: true, color: true, fill: true, strokeWidth: true, opacity: true, alignment: true };
      case "text":
        return { ...base, show: true, color: true, text: true, alignment: true };
      case "freehand":
        return { ...base, show: true, color: true, strokeWidth: true, alignment: true };
      case "blur":
        // Show blur editing options when blur object is selected
        return { ...base, show: true, blur: true, alignment: true };
      case "marker":
      case "numbering":
        return { ...base, show: true, color: true, alignment: true };
    }
  }

  // Select mode without selection - show alignment for canvas
  if (tool === "select" && !selectedType) {
    return { ...base, show: false };
  }

  return base;
}
