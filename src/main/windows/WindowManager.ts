import { BrowserWindow, screen, nativeImage, NativeImage, globalShortcut } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import Store from 'electron-store';
import { AppSettings, RegionConfig, Bounds } from '../../shared/types';

const isDev = process.env.NODE_ENV === 'development';

// Get app icon
function getAppIcon(): NativeImage | undefined {
  const iconPaths = [
    path.join(__dirname, '../../../../assets/icon.png'),
    path.join(__dirname, '../../../assets/icon.png'),
    path.join(process.cwd(), 'assets/icon.png'),
  ];

  for (const iconPath of iconPaths) {
    if (fs.existsSync(iconPath)) {
      const icon = nativeImage.createFromPath(iconPath);
      if (!icon.isEmpty()) {
        return icon;
      }
    }
  }
  return undefined;
}

export class WindowManager {
  private store: Store<{ settings: AppSettings }>;
  private escShortcutRegistered = false;

  private mainWindow: BrowserWindow | null = null;
  private overlayWindow: BrowserWindow | null = null;
  private regionSelectWindow: BrowserWindow | null = null;
  private dragWidget: BrowserWindow | null = null;
  private settingsWindow: BrowserWindow | null = null;
  private uploadWidget: BrowserWindow | null = null;

  constructor(store: Store<{ settings: AppSettings }>) {
    this.store = store;
  }

  private getPreloadPath(): string {
    // __dirname is dist/main/main/windows, preload is at dist/main/main/preload.js
    return path.join(__dirname, '../preload.js');
  }

  // ============================================
  // MAIN WINDOW
  // ============================================

  createMainWindow(): void {
    if (this.mainWindow) {
      this.mainWindow.focus();
      return;
    }

    this.mainWindow = new BrowserWindow({
      width: 400,
      height: 500,
      frame: false,
      transparent: true,
      resizable: false,
      show: false,
      skipTaskbar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: this.getPreloadPath(),
      },
    });

    this.loadRenderer(this.mainWindow, 'main');

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  // ============================================
  // OVERLAY WINDOW
  // ============================================

  createOverlayWindow(bounds: Bounds): void {
    if (this.overlayWindow) {
      this.overlayWindow.setBounds(bounds);
      this.overlayWindow.show();
      return;
    }

    this.overlayWindow = new BrowserWindow({
      ...bounds,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      hasShadow: false,
      resizable: false,
      movable: false,
      focusable: true,
      fullscreenable: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: this.getPreloadPath(),
      },
    });

    this.overlayWindow.setIgnoreMouseEvents(false);
    this.loadRenderer(this.overlayWindow, 'overlay');

    this.overlayWindow.on('closed', () => {
      this.overlayWindow = null;
    });

    this.overlayWindow.on('blur', () => {
      if (this.overlayWindow) {
        this.overlayWindow.setAlwaysOnTop(true, 'screen-saver');
      }
    });
  }

  showOverlay(): void {
    // Close settings if open
    if (this.settingsWindow) {
      this.settingsWindow.close();
      this.settingsWindow = null;
    }

    // Hide drag widget when overlay opens
    this.hideDragWidget();

    const settings = this.store.get('settings');

    if (settings.lastUsedRegion) {
      this.createOverlayWindow(settings.lastUsedRegion.bounds);
    } else {
      const primaryDisplay = screen.getPrimaryDisplay();
      this.createOverlayWindow(primaryDisplay.bounds);
    }
  }

  hideOverlay(): void {
    if (this.overlayWindow) {
      this.overlayWindow.close();
      this.overlayWindow = null;
    }
  }

  getOverlayBounds(): Bounds | null {
    if (this.overlayWindow) {
      return this.overlayWindow.getBounds();
    }
    return null;
  }

  toggleOverlay(): void {
    if (this.overlayWindow && this.overlayWindow.isVisible()) {
      this.hideOverlay();
    } else {
      this.showOverlay();
    }
  }

  applyRegion(region: RegionConfig): void {
    if (this.overlayWindow) {
      this.overlayWindow.setBounds(region.bounds);
    } else {
      this.createOverlayWindow(region.bounds);
    }
  }

  // ============================================
  // REGION SELECTION WINDOW
  // ============================================

  startRegionSelection(): void {
    if (this.regionSelectWindow) {
      this.regionSelectWindow.close();
    }

    const primaryDisplay = screen.getPrimaryDisplay();
    const bounds = primaryDisplay.bounds;

    this.regionSelectWindow = new BrowserWindow({
      ...bounds,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      hasShadow: false,
      resizable: false,
      movable: false,
      fullscreen: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: this.getPreloadPath(),
      },
    });

    this.loadRenderer(this.regionSelectWindow, 'region-select');

    this.regionSelectWindow.on('closed', () => {
      this.regionSelectWindow = null;
    });
  }

  closeRegionSelection(): void {
    if (this.regionSelectWindow) {
      this.regionSelectWindow.close();
      this.regionSelectWindow = null;
    }
  }

  // ============================================
  // DRAG WIDGET
  // ============================================

  showDragWidget(filePath: string): void {
    const settings = this.store.get('settings');
    if (!settings.showDragWidget) return;

    if (this.dragWidget) {
      this.dragWidget.close();
    }

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth } = primaryDisplay.workAreaSize;

    // Hot corner style - positioned at exact top-right
    this.dragWidget = new BrowserWindow({
      width: 120,
      height: 120,
      x: screenWidth - 120,
      y: 0,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      hasShadow: false,
      resizable: false,
      focusable: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: this.getPreloadPath(),
      },
    });

    this.loadRenderer(this.dragWidget, `drag-widget?file=${encodeURIComponent(filePath)}`);

    this.dragWidget.on('closed', () => {
      this.dragWidget = null;
      this.unregisterEscShortcut();
    });

    // Register global ESC shortcut to close widget
    this.registerEscShortcut();
  }

  hideDragWidget(): void {
    this.unregisterEscShortcut();
    if (this.dragWidget) {
      this.dragWidget.close();
      this.dragWidget = null;
    }
  }

  private registerEscShortcut(): void {
    if (this.escShortcutRegistered) return;
    try {
      globalShortcut.register('Escape', () => {
        this.hideDragWidget();
      });
      this.escShortcutRegistered = true;
    } catch {}
  }

  private unregisterEscShortcut(): void {
    if (!this.escShortcutRegistered) return;
    try {
      globalShortcut.unregister('Escape');
      this.escShortcutRegistered = false;
    } catch {}
  }

  // ============================================
  // SETTINGS WINDOW
  // ============================================

  openSettings(): void {
    // Close overlay if open
    if (this.overlayWindow) {
      this.overlayWindow.close();
      this.overlayWindow = null;
    }

    if (this.settingsWindow) {
      this.settingsWindow.focus();
      return;
    }

    this.settingsWindow = new BrowserWindow({
      width: 600,
      height: 700,
      frame: false,
      transparent: true,
      resizable: false,
      icon: getAppIcon(),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: this.getPreloadPath(),
      },
    });

    this.loadRenderer(this.settingsWindow, 'settings');

    this.settingsWindow.on('closed', () => {
      this.settingsWindow = null;
    });
  }

  // ============================================
  // UPLOAD WIDGET
  // ============================================

  showUploadWidget(): void {
    if (this.uploadWidget) {
      this.uploadWidget.focus();
      return;
    }

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    // Position: bottom-right, above taskbar
    const widgetWidth = 320;
    const widgetHeight = 140;
    const margin = 16;

    this.uploadWidget = new BrowserWindow({
      width: widgetWidth,
      height: widgetHeight,
      x: screenWidth - widgetWidth - margin,
      y: screenHeight - widgetHeight - margin,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      hasShadow: false,
      resizable: false,
      focusable: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: this.getPreloadPath(),
      },
    });

    this.loadRenderer(this.uploadWidget, 'upload-widget');

    this.uploadWidget.on('closed', () => {
      this.uploadWidget = null;
    });
  }

  hideUploadWidget(): void {
    if (this.uploadWidget) {
      this.uploadWidget.close();
      this.uploadWidget = null;
    }
  }

  sendUploadWidgetUpdate(data: { state: string; progress: number; stage: string; url?: string; error?: string }): void {
    if (this.uploadWidget && !this.uploadWidget.isDestroyed()) {
      this.uploadWidget.webContents.send('upload-widget-update', data);
    }
  }

  sendUploadProgress(data: { stage: string; progress: number }): void {
    // Send to both overlay (if open) and upload widget
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.webContents.send('upload-progress', data);
    }
    if (this.uploadWidget && !this.uploadWidget.isDestroyed()) {
      this.uploadWidget.webContents.send('upload-progress', data);
    }
  }

  // ============================================
  // UTILITIES
  // ============================================

  minimizeToTray(): void {
    if (this.mainWindow) {
      this.mainWindow.hide();
    }
    if (this.overlayWindow) {
      this.overlayWindow.hide();
    }
  }

  // Temporarily hide overlay for screen capture
  hideOverlayTemporarily(): void {
    if (this.overlayWindow) {
      // Use opacity instead of hide for faster response
      this.overlayWindow.setOpacity(0);
      // Also move it off-screen as backup
      this.overlayWindow.setPosition(-10000, -10000);
    }
    // Also hide upload widget if visible
    if (this.uploadWidget) {
      this.uploadWidget.setOpacity(0);
      this.uploadWidget.setPosition(-10000, -10000);
    }
  }

  // Restore overlay after screen capture
  restoreOverlay(): void {
    if (this.overlayWindow) {
      const settings = this.store.get('settings');
      const bounds = settings.lastUsedRegion?.bounds || screen.getPrimaryDisplay().bounds;
      this.overlayWindow.setPosition(bounds.x, bounds.y);
      this.overlayWindow.setOpacity(1);
      this.overlayWindow.setAlwaysOnTop(true, 'screen-saver');
      this.overlayWindow.focus();
    }
    // Restore upload widget position if it exists
    if (this.uploadWidget) {
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
      const widgetWidth = 320;
      const widgetHeight = 140;
      const margin = 16;
      this.uploadWidget.setPosition(screenWidth - widgetWidth - margin, screenHeight - widgetHeight - margin);
      this.uploadWidget.setOpacity(1);
    }
  }

  private loadRenderer(window: BrowserWindow, route: string): void {
    if (isDev) {
      window.loadURL(`http://localhost:5173/#/${route}`);
    } else {
      // __dirname is dist/main/main/windows, renderer is at dist/renderer
      const htmlPath = path.join(__dirname, '../../../renderer/index.html');
      window.loadFile(htmlPath, {
        hash: `/${route}`,
      });
    }
  }
}
