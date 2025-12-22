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
      <div ref={mainPanelRef} className="flex flex-col bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 rounded-2xl shadow-2xl overflow-hidden">
        <div className="h-6 flex items-center justify-center cursor-grab active:cursor-grabbing bg-zinc-800/50 border-b border-zinc-700/50" onMouseDown={handleDragStart}>
          <div className="w-8 h-1 rounded-full bg-zinc-600" />
        </div>
        <div className="flex flex-col gap-0.5 p-1.5">
          {TOOLS.map(({ type, icon: Icon, label, shortcut }) => (
            <button key={type} className={`tool-btn group relative ${activeTool === type ? "active" : ""}`} onClick={() => setActiveTool(type)} title={`${label} (${shortcut})`}>
              <Icon size={18} />
              <div className="absolute left-full ml-3 px-2 py-1 bg-zinc-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
                {label} <span className="text-zinc-500">{shortcut}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Options Panel */}
      {showOptions.show && (
        <div className="ml-2 bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 rounded-2xl shadow-2xl w-[170px] overflow-hidden flex flex-col" style={{ height: mainPanelHeight > 0 ? mainPanelHeight : "auto" }}>
          {/* Panel Header for sub-views */}
          {panelView !== "main" && (
            <button onClick={() => setPanelView("main")} className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800/50 border-b border-zinc-700/50 transition-colors">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M7.5 9L4.5 6L7.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="font-medium">{panelView === "shadow" ? "Shadow" : panelView === "stroke" ? "Stroke" : "Presets"}</span>
            </button>
          )}

          <div className="p-3 overflow-y-auto flex-1">
            {/* MAIN VIEW */}
            {panelView === "main" && (
              <>
                {/* Color */}
                {showOptions.color && (
                  <Section title="Color">
                    <div className="grid grid-cols-4 gap-1.5">
                      {ANNOTATION_COLORS.map((c) => (
                        <button
                          key={c}
                          className={`w-6 h-6 rounded-md transition-all ${config.strokeColor === c ? "ring-2 ring-white ring-offset-1 ring-offset-zinc-900 scale-110" : "hover:scale-105"}`}
                          style={{ backgroundColor: c }}
                          onClick={() => {
                            setConfig({ strokeColor: c });
                            if (selectedObjectType === "text") applyToSelected({ fill: c });
                            else if (selectedObjectType) applyToSelected({ stroke: c, fill: config.filled ? c : "transparent" });
                          }}
                        />
                      ))}
                      {/* Custom color picker - always shows rainbow, click to pick any color */}
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
                          className="w-6 h-6 rounded-md border border-zinc-600 flex items-center justify-center transition-all group-hover:scale-105"
                          style={{
                            background: "conic-gradient(from 0deg, #ef4444, #f59e0b, #22c55e, #3b82f6, #8b5cf6, #ec4899, #ef4444)",
                          }}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" className="drop-shadow">
                            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                          </svg>
                        </div>
                        {/* Custom color indicator - small dot when custom color is active */}
                        {!ANNOTATION_COLORS.includes(config.strokeColor as any) && <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-zinc-900 shadow-sm" style={{ backgroundColor: config.strokeColor }} />}
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
                    <div className="flex gap-1">
                      {[2, 3, 5, 8].map((w) => (
                        <button
                          key={w}
                          className={`flex-1 h-7 rounded-lg flex items-center justify-center transition-colors ${config.strokeWidth === w ? "bg-blue-500" : "bg-zinc-800 hover:bg-zinc-700"}`}
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
                      <div className="flex gap-1">
                        {(["circle", "rounded", "rectangle"] as const).map((s) => (
                          <Btn key={s} active={config.spotlightShape === s} onClick={() => setConfig({ spotlightShape: s })}>
                            {s === "circle" ? "○" : s === "rounded" ? "▢" : "□"}
                          </Btn>
                        ))}
                      </div>
                    </Section>
                    <Section title="Color">
                      <input type="color" value={config.spotlightColor} onChange={(e) => setConfig({ spotlightColor: e.target.value })} className="w-full h-7 rounded-lg cursor-pointer bg-zinc-800 border border-zinc-700" />
                    </Section>
                    <Section title={`Opacity ${Math.round(config.spotlightDarkness * 100)}%`}>
                      <input type="range" min="30" max="90" value={config.spotlightDarkness * 100} onChange={(e) => setConfig({ spotlightDarkness: +e.target.value / 100 })} className="w-full accent-blue-500 h-1" />
                    </Section>
                  </>
                )}

                {/* Blur - Simplified: Type + Intensity */}
                {showOptions.blur && (
                  <>
                    <Section title="Type">
                      <div className="flex gap-1">
                        {BLUR_TYPES.map((b) => (
                          <button
                            key={b.id}
                            className={`flex-1 py-1.5 rounded-lg text-[11px] flex items-center justify-center gap-1 transition-colors ${config.blurStyle === b.type ? "bg-blue-500 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
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
                        className="w-full accent-blue-500 h-1"
                      />
                      <div className="flex justify-between text-[9px] text-zinc-500 mt-1">
                        <span>Light</span>
                        <span>Heavy</span>
                      </div>
                    </Section>
                  </>
                )}

                {/* Text Options */}
                {showOptions.text && (
                  <>
                    {/* Quick Presets */}
                    {userTextPresets.length > 0 && (
                      <Section title="Quick">
                        <div className="flex gap-1 flex-wrap">
                          {userTextPresets.slice(0, 3).map((p) => (
                            <button key={p.id} onClick={() => applyPreset(p)} className="px-2 py-1 rounded text-[10px] bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white truncate max-w-[50px]" title={p.name}>
                              {p.name}
                            </button>
                          ))}
                          {userTextPresets.length > 3 && (
                            <button onClick={() => setPanelView("presets")} className="px-2 py-1 rounded text-[10px] bg-zinc-800 text-zinc-500 hover:bg-zinc-700">
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
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-[11px] text-white focus:border-blue-500 focus:outline-none"
                        />
                        {fontDropdownOpen && (
                          <div ref={fontListRef} className="absolute z-50 top-full left-0 right-0 mt-1 max-h-28 overflow-y-auto bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl">
                            {filteredFonts.map((f) => (
                              <button
                                key={f}
                                className="w-full px-2 py-1 text-left text-[11px] text-zinc-300 hover:bg-zinc-700 truncate"
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
                            {!filteredFonts.length && <div className="px-2 py-2 text-[11px] text-zinc-500">No fonts</div>}
                          </div>
                        )}
                      </div>
                    </Section>

                    {/* Size & Weight */}
                    <Section title="Size">
                      <div className="flex gap-1">
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
                      <div className="flex gap-1">
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
                      <div className="flex gap-1">
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
                      <div className="flex gap-2 items-center mb-2">
                        <span className="text-[10px] text-zinc-500 w-8">Line</span>
                        <button
                          onClick={() => {
                            const v = Math.max(0.8, config.lineHeight - 0.1);
                            setConfig({ lineHeight: v });
                            applyToSelected({ lineHeight: v });
                          }}
                          className="w-6 h-6 rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 text-xs"
                        >
                          −
                        </button>
                        <span className="text-[11px] text-zinc-300 w-8 text-center">{config.lineHeight.toFixed(1)}</span>
                        <button
                          onClick={() => {
                            const v = Math.min(3, config.lineHeight + 0.1);
                            setConfig({ lineHeight: v });
                            applyToSelected({ lineHeight: v });
                          }}
                          className="w-6 h-6 rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 text-xs"
                        >
                          +
                        </button>
                      </div>
                      <div className="flex gap-2 items-center">
                        <span className="text-[10px] text-zinc-500 w-8">Char</span>
                        <button
                          onClick={() => {
                            const v = Math.max(-200, config.charSpacing - 50);
                            setConfig({ charSpacing: v });
                            applyToSelected({ charSpacing: v });
                          }}
                          className="w-6 h-6 rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 text-xs"
                        >
                          −
                        </button>
                        <span className="text-[11px] text-zinc-300 w-8 text-center">{config.charSpacing}</span>
                        <button
                          onClick={() => {
                            const v = Math.min(500, config.charSpacing + 50);
                            setConfig({ charSpacing: v });
                            applyToSelected({ charSpacing: v });
                          }}
                          className="w-6 h-6 rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 text-xs"
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
                        Manage Presets →
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
                  <span className="text-[11px] text-zinc-300">Enable Shadow</span>
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
                        className="w-full h-8 rounded-lg cursor-pointer bg-zinc-800 border border-zinc-700"
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
                  <span className="text-[11px] text-zinc-300">Enable Stroke</span>
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
                        className="w-full h-8 rounded-lg cursor-pointer bg-zinc-800 border border-zinc-700"
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
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-[11px] text-white focus:border-blue-500 focus:outline-none mb-2"
                />
                <button onClick={savePreset} disabled={!newPresetName.trim()} className="w-full py-1.5 rounded-lg text-[11px] bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed font-medium mb-3">
                  Save Current Style
                </button>
                <div className="space-y-1">
                  {!userTextPresets.length && (
                    <div className="text-[11px] text-zinc-500 text-center py-6">
                      No presets yet.
                      <br />
                      Configure text style and save.
                    </div>
                  )}
                  {userTextPresets.map((p) => (
                    <div key={p.id} className="group flex items-center gap-1 bg-zinc-800/50 rounded-lg px-2 py-1.5 hover:bg-zinc-800 transition-colors">
                      <button onClick={() => applyPreset(p)} className="flex-1 text-left text-[11px] text-zinc-300 truncate">
                        {p.name}
                      </button>
                      <button onClick={() => deletePreset(p.id)} className="p-1 rounded text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
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
  <div className="mb-3">
    <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">{title}</div>
    {children}
  </div>
);

const Btn: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button className={`flex-1 py-1.5 rounded-lg text-[11px] transition-colors ${active ? "bg-blue-500 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`} onClick={onClick}>
    {children}
  </button>
);

const NavBtn: React.FC<{ onClick: () => void; active: boolean; children: React.ReactNode }> = ({ onClick, active, children }) => (
  <button onClick={onClick} className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-[11px] transition-colors mb-1 ${active ? "bg-blue-500/20 text-blue-400" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
    <span>{children}</span>
    {active && <span className="text-[9px]">✓</span>}
  </button>
);

const Toggle: React.FC<{ active: boolean; onClick: () => void }> = ({ active, onClick }) => (
  <button onClick={onClick} className={`w-10 h-5 rounded-full transition-colors relative ${active ? "bg-blue-500" : "bg-zinc-700"}`}>
    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${active ? "left-5" : "left-0.5"}`} />
  </button>
);

const NumInput: React.FC<{ label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }> = ({ label, value, onChange, min = 0, max = 100, step = 0.5 }) => (
  <div className="mb-2">
    <div className="text-[10px] text-zinc-500 mb-1">{label}</div>
    <input type="number" step={step} min={min} max={max} value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-[11px] text-white focus:border-blue-500 focus:outline-none" />
  </div>
);

const PresetBtn: React.FC<{ p: { id: string; name: string; icon: string }; active: boolean; onClick: () => void }> = ({ p, active, onClick }) => (
  <button className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-[11px] transition-colors ${active ? "bg-blue-500/20 text-blue-400" : "hover:bg-zinc-800 text-zinc-300"}`} onClick={onClick}>
    <span className="w-4 text-center">{p.icon}</span>
    <span>{p.name}</span>
  </button>
);

function getOptionsToShow(tool: ToolType, selectedType: string | null) {
  const base = { show: false, color: false, fill: false, radius: false, strokeWidth: false, arrowPresets: false, linePresets: false, markerPresets: false, spotlight: false, blur: false, text: false, opacity: false };

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
        return base;
      case "line":
        return { ...base, show: true, color: true, linePresets: true, strokeWidth: true };
      case "rectangle":
        return { ...base, show: true, color: true, fill: true, radius: true, strokeWidth: true, opacity: true };
      case "ellipse":
        return { ...base, show: true, color: true, fill: true, strokeWidth: true, opacity: true };
      case "text":
        return { ...base, show: true, color: true, text: true };
      case "freehand":
        return { ...base, show: true, color: true, strokeWidth: true };
      case "blur":
        // Show blur editing options when blur object is selected
        return { ...base, show: true, blur: true };
      case "marker":
      case "numbering":
        return { ...base, show: true, color: true };
    }
  }
  return base;
}
