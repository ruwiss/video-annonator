import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ToolType, ToolConfig, DEFAULT_TOOL_CONFIG } from '../shared/types';

export type TextToolState = 'idle' | 'placing' | 'editing';

// Panel position stored separately in localStorage
const PANEL_POSITION_KEY = 'video-annotator-panel-position';

export const getPanelPosition = (): { x: number; y: number } | null => {
  try {
    const saved = localStorage.getItem(PANEL_POSITION_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

export const savePanelPosition = (pos: { x: number; y: number }) => {
  try {
    localStorage.setItem(PANEL_POSITION_KEY, JSON.stringify(pos));
  } catch {}
};

interface ToolState {
  activeTool: ToolType;
  previousTool: ToolType;
  config: ToolConfig;
  numberingCounter: number;
  activePresets: Record<string, string>;
  textToolState: TextToolState;

  setActiveTool: (tool: ToolType) => void;
  setConfig: (config: Partial<ToolConfig>) => void;
  incrementNumbering: () => void;
  resetNumbering: (start?: number) => void;
  setActivePreset: (tool: string, presetId: string) => void;
  setTextToolState: (state: TextToolState) => void;
  switchToPreviousTool: () => void;
}

export const useToolStore = create<ToolState>((set, get) => ({
  activeTool: 'select', // Default to Select
  previousTool: 'select',
  config: DEFAULT_TOOL_CONFIG,
  numberingCounter: 1,
  activePresets: {
    arrow: 'arrow-simple',
    line: 'line-solid',
    marker: 'marker-medium',
    text: 'clean',
  },
  textToolState: 'idle',

  setActiveTool: (tool) => {
    const current = get().activeTool;
    set({
      activeTool: tool,
      previousTool: current,
      textToolState: tool === 'text' ? 'placing' : 'idle',
    });
  },

  setConfig: (config) =>
    set((state) => ({
      config: { ...state.config, ...config },
    })),

  incrementNumbering: () =>
    set((state) => ({
      numberingCounter: state.numberingCounter + 1,
    })),

  resetNumbering: (start = 1) => set({ numberingCounter: start }),

  setActivePreset: (tool, presetId) =>
    set((state) => ({
      activePresets: { ...state.activePresets, [tool]: presetId },
    })),

  setTextToolState: (textToolState) => set({ textToolState }),

  switchToPreviousTool: () => {
    const { previousTool } = get();
    set({ activeTool: previousTool, textToolState: 'idle' });
  },
}));
