import { contextBridge, ipcRenderer } from 'electron';

// ============================================
// IPC CHANNELS (inline to avoid import issues)
// ============================================

const IPC_CHANNELS = {
  TOGGLE_OVERLAY: 'toggle-overlay',
  CLOSE_OVERLAY: 'close-overlay',
  SELECT_REGION: 'select-region',
  REGION_SELECTED: 'region-selected',
  GET_SETTINGS: 'get-settings',
  SET_SETTINGS: 'set-settings',
  SELECT_EXPORT_PATH: 'select-export-path',
  SAVE_ANNOTATION: 'save-annotation',
  ANNOTATION_SAVED: 'annotation-saved',
  START_DRAG: 'start-drag',
  SHOW_DRAG_WIDGET: 'show-drag-widget',
  HIDE_DRAG_WIDGET: 'hide-drag-widget',
  GET_DISPLAYS: 'get-displays',
  CAPTURE_SCREEN: 'capture-screen',
  OPEN_SETTINGS: 'open-settings',
  MINIMIZE_TO_TRAY: 'minimize-to-tray',
} as const;

// ============================================
// EXPOSED API
// ============================================

const api = {
  // Settings
  getSettings: (): Promise<any> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS),

  setSettings: (settings: any): Promise<any> =>
    ipcRenderer.invoke(IPC_CHANNELS.SET_SETTINGS, settings),

  selectExportPath: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.SELECT_EXPORT_PATH),

  // Display
  getDisplays: () =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_DISPLAYS),

  // Screen capture - delegates to main process (Electron 17+)
  captureScreen: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.CAPTURE_SCREEN),

  // Capture specific region for blur effect
  captureRegion: (x: number, y: number, width: number, height: number): Promise<string | null> => {
    return ipcRenderer.invoke('capture-region', { x, y, width, height });
  },

  // Get system fonts
  getSystemFonts: (): Promise<string[]> => {
    return ipcRenderer.invoke('get-system-fonts');
  },

  // Upload image to prntscr
  uploadImage: (dataUrl: string, width: number, height: number): Promise<{ success: boolean; url?: string; shareUrl?: string; error?: string }> => {
    return ipcRenderer.invoke('upload-image', dataUrl, width, height);
  },

  // Upload progress listener
  onUploadProgress: (callback: (data: { stage: string; progress: number }) => void) => {
    const handler = (_: unknown, data: { stage: string; progress: number }) => callback(data);
    ipcRenderer.on('upload-progress', handler);
    return () => ipcRenderer.removeListener('upload-progress', handler);
  },

  // Upload widget controls
  showUploadWidget: () =>
    ipcRenderer.send('show-upload-widget'),

  closeUploadWidget: () =>
    ipcRenderer.send('close-upload-widget'),

  retryUpload: () =>
    ipcRenderer.send('retry-upload'),

  // Upload widget state listener
  onUploadWidgetUpdate: (callback: (data: { state: string; progress: number; stage: string; url?: string; error?: string }) => void) => {
    const handler = (_: unknown, data: { state: string; progress: number; stage: string; url?: string; error?: string }) => callback(data);
    ipcRenderer.on('upload-widget-update', handler);
    return () => ipcRenderer.removeListener('upload-widget-update', handler);
  },

  // Copy to clipboard
  copyToClipboard: (text: string): Promise<boolean> => {
    return ipcRenderer.invoke('copy-to-clipboard', text);
  },

  // Open external link in browser
  openExternalLink: (url: string): Promise<boolean> => {
    return ipcRenderer.invoke('open-external-link', url);
  },

  // Region
  selectRegion: () =>
    ipcRenderer.invoke(IPC_CHANNELS.SELECT_REGION),

  onRegionSelected: (callback: (region: any) => void) => {
    const handler = (_: unknown, region: any) => callback(region);
    ipcRenderer.on(IPC_CHANNELS.REGION_SELECTED, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.REGION_SELECTED, handler);
  },

  sendRegionSelected: (region: any) =>
    ipcRenderer.send(IPC_CHANNELS.REGION_SELECTED, region),

  // Export
  saveAnnotation: (dataUrl: string, overwritePath?: string): Promise<string> =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_ANNOTATION, dataUrl, overwritePath),

  onAnnotationSaved: (callback: (filePath: string) => void) => {
    const handler = (_: unknown, filePath: string) => callback(filePath);
    ipcRenderer.on(IPC_CHANNELS.ANNOTATION_SAVED, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.ANNOTATION_SAVED, handler);
  },

  // Drag
  startDrag: (filePath: string) =>
    ipcRenderer.send(IPC_CHANNELS.START_DRAG, filePath),

  showDragWidget: (filePath: string) =>
    ipcRenderer.send(IPC_CHANNELS.SHOW_DRAG_WIDGET, filePath),

  hideDragWidget: () =>
    ipcRenderer.send(IPC_CHANNELS.HIDE_DRAG_WIDGET),

  // Window controls
  closeOverlay: () =>
    ipcRenderer.send(IPC_CHANNELS.CLOSE_OVERLAY),

  openSettings: () =>
    ipcRenderer.send(IPC_CHANNELS.OPEN_SETTINGS),

  minimizeToTray: () =>
    ipcRenderer.send(IPC_CHANNELS.MINIMIZE_TO_TRAY),

  // Overlay toggle listener
  onToggleOverlay: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(IPC_CHANNELS.TOGGLE_OVERLAY, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.TOGGLE_OVERLAY, handler);
  },

  // Check if this is a fresh app start
  checkFreshStart: (): Promise<boolean> => ipcRenderer.invoke('check-fresh-start'),

  // Image mode - when opened with an image file
  getImageModeState: (): Promise<{ isImageMode: boolean; imagePath: string | null; imageDataUrl: string | null; imageWidth: number; imageHeight: number }> =>
    ipcRenderer.invoke('get-image-mode-state'),

  clearImageMode: () => ipcRenderer.send('clear-image-mode'),

  // Listen for image mode updates (when second instance opens with image)
  onImageModeUpdate: (callback: (data: { isImageMode: boolean; imagePath: string | null; imageDataUrl: string | null; imageWidth: number; imageHeight: number }) => void) => {
    const handler = (_: unknown, data: { isImageMode: boolean; imagePath: string | null; imageDataUrl: string | null; imageWidth: number; imageHeight: number }) => callback(data);
    ipcRenderer.on('image-mode-update', handler);
    return () => ipcRenderer.removeListener('image-mode-update', handler);
  },

  // Listen for pre-captured screen data (normal mode)
  onScreenCaptureUpdate: (callback: (data: { hasCapture: boolean; captureDataUrl: string | null; captureWidth: number; captureHeight: number; bounds: { x: number; y: number; width: number; height: number } | null }) => void) => {
    const handler = (_: unknown, data: { hasCapture: boolean; captureDataUrl: string | null; captureWidth: number; captureHeight: number; bounds: { x: number; y: number; width: number; height: number } | null }) => callback(data);
    ipcRenderer.on('screen-capture-update', handler);
    return () => ipcRenderer.removeListener('screen-capture-update', handler);
  },

  // Context menu registration
  checkContextMenuRegistered: (): Promise<boolean> =>
    ipcRenderer.invoke('check-context-menu-registered'),

  registerContextMenu: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('register-context-menu'),

  unregisterContextMenu: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('unregister-context-menu'),
};

// ============================================
// EXPOSE TO RENDERER
// ============================================

contextBridge.exposeInMainWorld('electronAPI', api);

// Type declaration for renderer
export type ElectronAPI = typeof api;
