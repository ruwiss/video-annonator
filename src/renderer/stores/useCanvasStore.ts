import { create } from 'zustand';
import type { Canvas } from 'fabric';

const CANVAS_STATE_KEY = 'video-annotator-canvas-state';
const CANVAS_HISTORY_KEY = 'video-annotator-canvas-history';

interface HistoryData {
  history: string[];
  historyIndex: number;
}

interface CanvasState {
  canvas: Canvas | null;
  history: string[];
  historyIndex: number;

  // Actions
  setCanvas: (canvas: Canvas | null) => void;
  pushHistory: (state: string) => void;
  undo: () => string | null;
  redo: () => string | null;
  clearHistory: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  saveToStorage: () => void;
  loadFromStorage: () => string | null;
  loadHistoryFromStorage: () => HistoryData | null;
  clearStorage: () => void;
}

const MAX_HISTORY = 50;

export const useCanvasStore = create<CanvasState>((set, get) => ({
  canvas: null,
  history: [],
  historyIndex: -1,

  setCanvas: (canvas) => set({ canvas }),

  pushHistory: (state) => {
    const { history, historyIndex } = get();

    // Don't push if same as current state
    if (history[historyIndex] === state) {
      return;
    }

    // Remove any future history (redo states)
    const newHistory = history.slice(0, historyIndex + 1);

    // Add new state
    newHistory.push(state);

    // Limit history size
    if (newHistory.length > MAX_HISTORY) {
      newHistory.shift();
      set({
        history: newHistory,
        historyIndex: newHistory.length - 1,
      });
    } else {
      set({
        history: newHistory,
        historyIndex: newHistory.length - 1,
      });
    }

    // Auto-save to storage
    get().saveToStorage();
  },

  undo: () => {
    const { history, historyIndex } = get();

    if (historyIndex <= 0) {
      return null;
    }

    const newIndex = historyIndex - 1;
    set({ historyIndex: newIndex });

    // Save updated index
    get().saveToStorage();

    return history[newIndex] ?? null;
  },

  redo: () => {
    const { history, historyIndex } = get();

    if (historyIndex >= history.length - 1) {
      return null;
    }

    const newIndex = historyIndex + 1;
    set({ historyIndex: newIndex });

    // Save updated index
    get().saveToStorage();

    return history[newIndex] ?? null;
  },

  clearHistory: () => {
    set({
      history: [],
      historyIndex: -1,
    });
    get().clearStorage();
  },

  canUndo: () => {
    const { historyIndex } = get();
    return historyIndex > 0;
  },

  canRedo: () => {
    const { history, historyIndex } = get();
    return historyIndex < history.length - 1;
  },

  saveToStorage: () => {
    const { history, historyIndex } = get();
    if (history.length > 0) {
      try {
        // Save current state for quick restore
        if (historyIndex >= 0 && history[historyIndex]) {
          localStorage.setItem(CANVAS_STATE_KEY, history[historyIndex]);
        }
        // Save full history
        localStorage.setItem(CANVAS_HISTORY_KEY, JSON.stringify({ history, historyIndex }));
      } catch {}
    }
  },

  loadFromStorage: () => {
    try {
      return localStorage.getItem(CANVAS_STATE_KEY);
    } catch {
      return null;
    }
  },

  loadHistoryFromStorage: () => {
    try {
      const data = localStorage.getItem(CANVAS_HISTORY_KEY);
      if (data) {
        const parsed = JSON.parse(data) as HistoryData;
        // Restore history to store
        set({ history: parsed.history, historyIndex: parsed.historyIndex });
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  },

  clearStorage: () => {
    try {
      localStorage.removeItem(CANVAS_STATE_KEY);
      localStorage.removeItem(CANVAS_HISTORY_KEY);
    } catch {}
  },
}));
