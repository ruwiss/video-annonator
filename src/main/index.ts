import { app, globalShortcut, ipcMain, screen, dialog, Tray, Menu, nativeImage, desktopCapturer, clipboard } from 'electron';
import Store from 'electron-store';
import fontList from 'font-list';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { AppSettings, DEFAULT_SETTINGS, IPC_CHANNELS, RegionConfig, ImageModeState } from '../shared/types';
import { WindowManager } from './windows/WindowManager';
import { FileService } from './services/FileService';
import { createTrayIcon, createAppIcon } from './utils/createTrayIcon';

// Cached system fonts
let cachedFonts: string[] | null = null;

// Fresh app start flag - cleared after first overlay show
let isFreshStart = true;

// Image mode state - when opened with an image file
let imageModeState: ImageModeState = {
  isImageMode: false,
  imagePath: null,
  imageDataUrl: null,
  imageWidth: 0,
  imageHeight: 0,
};

// Supported image extensions
const SUPPORTED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif'];

// Check if a file path is a supported image
function isSupportedImage(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_IMAGE_EXTENSIONS.includes(ext);
}

// Load image and get its dimensions
async function loadImageFile(filePath: string): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    if (!fs.existsSync(filePath)) return null;

    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png'
      : ext === '.webp' ? 'image/webp'
      : ext === '.bmp' ? 'image/bmp'
      : ext === '.gif' ? 'image/gif'
      : 'image/jpeg';

    const dataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;

    // Get image dimensions using nativeImage
    const img = nativeImage.createFromBuffer(buffer);
    const size = img.getSize();

    return {
      dataUrl,
      width: size.width,
      height: size.height,
    };
  } catch (err) {
    console.error('Failed to load image:', err);
    return null;
  }
}

// Process command line arguments for image file
async function processImageFromArgs(args: string[]): Promise<boolean> {
  console.log('[processImageFromArgs] Args:', args);

  // Look through all arguments for an image file
  for (const arg of args) {
    // Skip executable paths and electron internal args
    if (arg.includes('electron') || arg.includes('node_modules')) continue;
    if (arg.startsWith('-') || arg.startsWith('--')) continue;
    if (arg.endsWith('.js') || arg.endsWith('.ts')) continue;
    if (arg.endsWith('.exe')) continue;
    if (arg === '.') continue;

    // Clean the path (remove quotes if present)
    const cleanPath = arg.replace(/^["']|["']$/g, '');

    // Check if it's a valid file path and supported image
    if (isSupportedImage(cleanPath) && fs.existsSync(cleanPath)) {
      console.log('[processImageFromArgs] Found image:', cleanPath);
      const imageData = await loadImageFile(cleanPath);
      if (imageData) {
        imageModeState = {
          isImageMode: true,
          imagePath: cleanPath,
          imageDataUrl: imageData.dataUrl,
          imageWidth: imageData.width,
          imageHeight: imageData.height,
        };
        return true;
      }
    }
  }
  return false;
}

// ============================================
// GLOBAL STATE
// ============================================

let store: Store<{ settings: AppSettings }>;
let windowManager: WindowManager;
let fileService: FileService;
let tray: Tray | null = null;

// ============================================
// APP INITIALIZATION
// ============================================

async function createApp(): Promise<void> {
  // Initialize store (needs app to be ready for getPath)
  store = new Store<{ settings: AppSettings }>({
    defaults: {
      settings: {
        ...DEFAULT_SETTINGS,
        exportPath: app.getPath('pictures'),
      },
    },
  });

  // Initialize services
  fileService = new FileService(store);
  windowManager = new WindowManager(store);

  // Create tray
  createTray();

  // Register global shortcuts
  registerGlobalShortcuts();

  // Setup IPC handlers
  setupIpcHandlers();

  // Check if opened with an image file
  const hasImage = await processImageFromArgs(process.argv);

  // Show main window or start minimized
  windowManager.createMainWindow();

  // Show overlay - with image if provided
  if (hasImage && imageModeState.isImageMode) {
    windowManager.showOverlayWithImage(imageModeState);
  } else {
    windowManager.showOverlay();
  }
}

function createTray(): void {
  const icon = createTrayIcon();
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Annotator',
      click: () => windowManager.showOverlay(),
    },
    {
      label: 'Settings',
      click: () => windowManager.openSettings(),
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit(),
    },
  ]);

  tray.setToolTip('Video Annotator');
  tray.setContextMenu(contextMenu);
  // Single click opens overlay
  tray.on('click', () => windowManager.showOverlay());
}

function registerGlobalShortcuts(): void {
  const settings = store.get('settings');

  globalShortcut.register(settings.hotkeys.toggleOverlay, () => {
    windowManager.toggleOverlay();
  });
}

function setupIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, () => store.get('settings'));

  ipcMain.handle(IPC_CHANNELS.SET_SETTINGS, (_event, settings: Partial<AppSettings>) => {
    const current = store.get('settings');
    const updated = { ...current, ...settings };
    store.set('settings', updated);

    if (settings.hotkeys) {
      globalShortcut.unregisterAll();
      registerGlobalShortcuts();
    }

    return updated;
  });

  ipcMain.handle(IPC_CHANNELS.SELECT_EXPORT_PATH, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Export Folder',
    });

    if (!result.canceled && result.filePaths[0]) {
      const settings = store.get('settings');
      settings.exportPath = result.filePaths[0];
      store.set('settings', settings);
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.handle(IPC_CHANNELS.GET_DISPLAYS, () => {
    return screen.getAllDisplays().map((display) => ({
      id: display.id,
      bounds: display.bounds,
      scaleFactor: display.scaleFactor,
      isPrimary: display.id === screen.getPrimaryDisplay().id,
    }));
  });

  ipcMain.handle(IPC_CHANNELS.SELECT_REGION, () => {
    windowManager.startRegionSelection();
  });

  ipcMain.on(IPC_CHANNELS.REGION_SELECTED, (_event, region: RegionConfig) => {
    const settings = store.get('settings');
    settings.lastUsedRegion = region;

    const exists = settings.savedRegions.some(
      (r) =>
        r.displayId === region.displayId &&
        r.bounds.x === region.bounds.x &&
        r.bounds.y === region.bounds.y &&
        r.bounds.width === region.bounds.width &&
        r.bounds.height === region.bounds.height
    );

    if (!exists) {
      settings.savedRegions.push(region);
    }

    store.set('settings', settings);
    windowManager.applyRegion(region);
  });

  ipcMain.handle(IPC_CHANNELS.SAVE_ANNOTATION, async (_event, dataUrl: string, overwritePath?: string) => {
    return fileService.saveAnnotation(dataUrl, overwritePath);
  });

  ipcMain.on(IPC_CHANNELS.START_DRAG, (event, filePath: string) => {
    // startDrag is synchronous and blocks until drag completes (drop or cancel)
    event.sender.startDrag({
      file: filePath,
      icon: nativeImage.createFromPath(filePath).resize({ width: 64, height: 64 }),
    });

    // Drag completed (either dropped or cancelled) - close widget
    // Small delay to ensure smooth transition
    setTimeout(() => {
      windowManager.hideDragWidget();
    }, 100);
  });

  ipcMain.on(IPC_CHANNELS.SHOW_DRAG_WIDGET, (_event, filePath: string) => {
    windowManager.showDragWidget(filePath);
  });

  ipcMain.on(IPC_CHANNELS.HIDE_DRAG_WIDGET, () => {
    windowManager.hideDragWidget();
  });

  ipcMain.on(IPC_CHANNELS.CLOSE_OVERLAY, () => {
    windowManager.hideOverlay();
  });

  ipcMain.on(IPC_CHANNELS.OPEN_SETTINGS, () => {
    windowManager.openSettings();
  });

  ipcMain.on(IPC_CHANNELS.MINIMIZE_TO_TRAY, () => {
    windowManager.minimizeToTray();
  });

  // Screen capture - main process only (Electron 17+)
  ipcMain.handle(IPC_CHANNELS.CAPTURE_SCREEN, async () => {
    try {
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width, height } = primaryDisplay.size;
      const scaleFactor = primaryDisplay.scaleFactor;

      // Get overlay window bounds for proper cropping
      const overlayBounds = windowManager.getOverlayBounds();

      windowManager.hideOverlayTemporarily();
      await new Promise(resolve => setTimeout(resolve, 150));

      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: {
          width: Math.floor(width * scaleFactor),
          height: Math.floor(height * scaleFactor)
        }
      });

      if (sources.length > 0 && sources[0].thumbnail && !sources[0].thumbnail.isEmpty()) {
        let thumbnail = sources[0].thumbnail;

        // If overlay has specific bounds (not full screen), crop the capture
        if (overlayBounds && (overlayBounds.x !== 0 || overlayBounds.y !== 0 ||
            overlayBounds.width !== width || overlayBounds.height !== height)) {
          thumbnail = thumbnail.crop({
            x: Math.floor(overlayBounds.x * scaleFactor),
            y: Math.floor(overlayBounds.y * scaleFactor),
            width: Math.floor(overlayBounds.width * scaleFactor),
            height: Math.floor(overlayBounds.height * scaleFactor)
          });
        }

        const dataUrl = thumbnail.toDataURL();
        windowManager.restoreOverlay();
        return dataUrl;
      }

      windowManager.restoreOverlay();
      return null;
    } catch {
      windowManager.restoreOverlay();
      return null;
    }
  });

  // Capture specific region for blur effect
  ipcMain.handle('capture-region', async (_event, region: { x: number; y: number; width: number; height: number }) => {
    try {
      windowManager.hideOverlayTemporarily();
      await new Promise(resolve => setTimeout(resolve, 100));

      const primaryDisplay = screen.getPrimaryDisplay();
      const scaleFactor = primaryDisplay.scaleFactor;
      const { width, height } = primaryDisplay.size;

      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: {
          width: Math.floor(width * scaleFactor),
          height: Math.floor(height * scaleFactor)
        }
      });

      windowManager.restoreOverlay();

      if (sources.length > 0 && sources[0].thumbnail && !sources[0].thumbnail.isEmpty()) {
        const cropped = sources[0].thumbnail.crop({
          x: Math.floor(region.x * scaleFactor),
          y: Math.floor(region.y * scaleFactor),
          width: Math.floor(region.width * scaleFactor),
          height: Math.floor(region.height * scaleFactor)
        });
        return cropped.toDataURL();
      }
      return null;
    } catch (err) {
      console.error('capture-region error:', err);
      windowManager.restoreOverlay();
      return null;
    }
  });

  // Get system fonts
  ipcMain.handle('get-system-fonts', async () => {
    if (cachedFonts) return cachedFonts;
    try {
      const fonts = await fontList.getFonts();
      // Clean font names (remove quotes)
      cachedFonts = fonts.map((f: string) => f.replace(/^["']|["']$/g, '')).sort();
      return cachedFonts;
    } catch (err) {
      console.error('Failed to get fonts:', err);
      return ['Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Verdana', 'Georgia', 'Trebuchet MS', 'Comic Sans MS'];
    }
  });

  // Upload image to prntscr with progress
  ipcMain.handle('upload-image', async (event, dataUrl: string, width: number, height: number) => {
    // Close overlay and show upload widget
    windowManager.hideOverlay();
    windowManager.showUploadWidget();

    // Helper to send progress to widget
    const sendProgress = (stage: string, progress: number) => {
      windowManager.sendUploadProgress({ stage, progress });
      windowManager.sendUploadWidgetUpdate({ state: 'uploading', progress, stage });
    };

    try {
      // Extract base64 data and convert to buffer
      const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');

      // Generate timestamp and hash using prntscr algorithm
      const timestamp = Math.floor(Date.now() / 1000);
      const hash = require('crypto').createHash('md5').update('5CE3DF4D45AC*' + timestamp).digest('hex');
      const appId = randomUUID();

      // Create FormData - Node 18+ native support
      const formData = new FormData();
      formData.append('width', width.toString());
      formData.append('height', height.toString());
      formData.append('dpi', '1.000000');
      formData.append('app_id', appId);

      // Create Blob from buffer for proper binary handling
      const imageBlob = new Blob([imageBuffer], { type: 'image/png' });
      formData.append('image', imageBlob, 'screenshot.png');

      // Start progress
      sendProgress('uploading', 10);

      // Simulate progress during upload
      let currentProgress = 10;
      const progressInterval = setInterval(() => {
        if (currentProgress < 45) {
          currentProgress += 5;
          sendProgress('uploading', currentProgress);
        }
      }, 200);

      // Upload with correct endpoint
      const uploadUrl = `https://upload.prntscr.com/upload/${timestamp}/${hash}/`;
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      sendProgress('uploading', 50);

      const responseText = await response.text();
      sendProgress('uploading', 60);

      // Parse XML response
      const statusMatch = responseText.match(/<status>(\w+)<\/status>/);
      const shareMatch = responseText.match(/<share>([^<]+)<\/share>/);

      if (statusMatch && statusMatch[1] === 'success' && shareMatch) {
        const shareUrl = shareMatch[1];

        // Scrape the share page to get actual image URL
        sendProgress('fetching', 70);

        try {
          const pageResponse = await fetch(shareUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
          });

          sendProgress('fetching', 80);
          const html = await pageResponse.text();
          sendProgress('parsing', 90);

          // Find screenshot-image class img src - try multiple patterns
          const imgMatch = html.match(/<img[^>]*class="[^"]*screenshot-image[^"]*"[^>]*src="([^"]+)"/);
          const imgMatchAlt = html.match(/<img[^>]*src="([^"]+)"[^>]*class="[^"]*screenshot-image[^"]*"/);
          const imgMatchData = html.match(/<img[^>]*class="[^"]*screenshot-image[^"]*"[^>]*data-src="([^"]+)"/);

          const imageUrl = imgMatch?.[1] || imgMatchAlt?.[1] || imgMatchData?.[1];
          const finalUrl = imageUrl || shareUrl;

          sendProgress('done', 100);

          // Update widget with success
          windowManager.sendUploadWidgetUpdate({ state: 'success', progress: 100, stage: 'done', url: finalUrl });

          // Auto-copy to clipboard
          clipboard.writeText(finalUrl);

          return { success: true, url: finalUrl, shareUrl };
        } catch (scrapeErr) {
          console.error('Scrape error:', scrapeErr);
          sendProgress('done', 100);

          // Update widget with success (using share URL)
          windowManager.sendUploadWidgetUpdate({ state: 'success', progress: 100, stage: 'done', url: shareUrl });
          clipboard.writeText(shareUrl);

          return { success: true, url: shareUrl, shareUrl };
        }
      }

      // Check for error
      const errorMatch = responseText.match(/<error>([^<]+)<\/error>/);
      const errorMsg = errorMatch ? errorMatch[1] : 'Upload failed';

      // Update widget with error
      windowManager.sendUploadWidgetUpdate({ state: 'error', progress: 0, stage: '', error: errorMsg });

      return { success: false, error: errorMsg };
    } catch (err) {
      console.error('Upload error:', err);
      const errorMsg = String(err);

      // Update widget with error
      windowManager.sendUploadWidgetUpdate({ state: 'error', progress: 0, stage: '', error: errorMsg });

      return { success: false, error: errorMsg };
    }
  });

  // Copy to clipboard
  ipcMain.handle('copy-to-clipboard', (_event, text: string) => {
    clipboard.writeText(text);
    return true;
  });

  // Open external link in default browser
  ipcMain.handle('open-external-link', async (_event, url: string) => {
    try {
      const { shell } = require('electron');
      await shell.openExternal(url);
      return true;
    } catch (err) {
      console.error('Failed to open external link:', err);
      return false;
    }
  });

  // Check if this is a fresh app start (for clearing canvas)
  ipcMain.handle('check-fresh-start', () => {
    const wasFresh = isFreshStart;
    isFreshStart = false; // Clear flag after first check
    return wasFresh;
  });

  // Upload widget controls
  ipcMain.on('show-upload-widget', () => {
    windowManager.showUploadWidget();
  });

  ipcMain.on('close-upload-widget', () => {
    windowManager.hideUploadWidget();
  });

  ipcMain.on('retry-upload', () => {
    // Retry will be handled by renderer storing the last upload data
    windowManager.hideUploadWidget();
    windowManager.showOverlay();
  });

  // Get image mode state
  ipcMain.handle('get-image-mode-state', () => {
    return imageModeState;
  });

  // Clear image mode (when overlay closes)
  ipcMain.on('clear-image-mode', () => {
    imageModeState = {
      isImageMode: false,
      imagePath: null,
      imageDataUrl: null,
      imageWidth: 0,
      imageHeight: 0,
    };
  });

  // Context menu registration - check if registered
  ipcMain.handle('check-context-menu-registered', async () => {
    try {
      const { execSync } = require('child_process');
      execSync('reg query "HKCR\\SystemFileAssociations\\.png\\shell\\VideoAnnotator" 2>nul', { encoding: 'utf8' });
      return true;
    } catch {
      return false;
    }
  });

  // Context menu registration - register using batch file with reg.exe
  ipcMain.handle('register-context-menu', async () => {
    try {
      const exePath = process.execPath;
      const extensions = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'];
      const tempDir = app.getPath('temp');
      const batPath = path.join(tempDir, 'va-register.bat');

      console.log('[register-context-menu] exePath:', exePath);

      // Build batch file content using reg.exe commands
      let batContent = '@echo off\n';

      for (const ext of extensions) {
        const keyPath = `HKCR\\SystemFileAssociations\\.${ext}\\shell\\VideoAnnotator`;
        const cmdKeyPath = `HKCR\\SystemFileAssociations\\.${ext}\\shell\\VideoAnnotator\\command`;

        batContent += `reg add "${keyPath}" /ve /d "Annotate with Video Annotator" /f >nul 2>&1\n`;
        batContent += `reg add "${keyPath}" /v "Icon" /d "\\"${exePath}\\",0" /f >nul 2>&1\n`;
        // Command format: "exePath" "%1" - simple and direct
        batContent += `reg add "${cmdKeyPath}" /ve /d "\\"${exePath}\\" \\"%%1\\"" /f >nul 2>&1\n`;
      }

      batContent += 'exit /b 0\n';

      // Write batch file
      fs.writeFileSync(batPath, batContent, 'utf8');

      // Run batch file as admin using PowerShell
      const { exec } = require('child_process');
      const escapedBatPath = batPath.replace(/\\/g, '\\\\');

      return new Promise((resolve) => {
        const cmd = `powershell -Command "Start-Process cmd -Verb RunAs -Wait -ArgumentList '/c','${escapedBatPath}'"`;

        exec(cmd, { shell: true }, () => {
          // Clean up
          try {
            fs.unlinkSync(batPath);
          } catch {}

          // Check if registration succeeded
          setTimeout(() => {
            try {
              const { execSync } = require('child_process');
              execSync('reg query "HKCR\\SystemFileAssociations\\.png\\shell\\VideoAnnotator" 2>nul', { encoding: 'utf8' });
              resolve({ success: true });
            } catch {
              resolve({ success: false, error: 'Registration failed or was cancelled' });
            }
          }, 1000);
        });
      });
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // Context menu registration - unregister using batch file
  ipcMain.handle('unregister-context-menu', async () => {
    try {
      const extensions = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'];
      const tempDir = app.getPath('temp');
      const batPath = path.join(tempDir, 'va-unregister.bat');

      // Build batch file content
      let batContent = '@echo off\n';

      for (const ext of extensions) {
        const keyPath = `HKCR\\SystemFileAssociations\\.${ext}\\shell\\VideoAnnotator`;
        batContent += `reg delete "${keyPath}" /f >nul 2>&1\n`;
      }

      batContent += 'exit /b 0\n';

      // Write batch file
      fs.writeFileSync(batPath, batContent, 'utf8');

      // Run batch file as admin
      const { exec } = require('child_process');
      const escapedBatPath = batPath.replace(/\\/g, '\\\\');

      return new Promise((resolve) => {
        const cmd = `powershell -Command "Start-Process cmd -Verb RunAs -Wait -ArgumentList '/c','${escapedBatPath}'"`;

        exec(cmd, { shell: true }, () => {
          // Clean up
          try { fs.unlinkSync(batPath); } catch {}

          // Check if unregistration succeeded
          setTimeout(() => {
            try {
              const { execSync } = require('child_process');
              execSync('reg query "HKCR\\SystemFileAssociations\\.png\\shell\\VideoAnnotator" 2>nul', { encoding: 'utf8' });
              resolve({ success: false, error: 'Unregistration failed' });
            } catch {
              resolve({ success: true });
            }
          }, 1000);
        });
      });
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
}

// ============================================
// APP LIFECYCLE
// ============================================

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', async (_event, argv) => {
    // Check if second instance was opened with an image
    const hasImage = await processImageFromArgs(argv);

    if (windowManager) {
      if (hasImage && imageModeState.isImageMode) {
        windowManager.showOverlayWithImage(imageModeState);
      } else {
        windowManager.showOverlay();
      }
    }
  });

  app.whenReady().then(createApp);

  app.on('window-all-closed', () => {
    // Don't quit, stay in tray
  });

  app.on('activate', () => {
    if (windowManager) {
      windowManager.showOverlay();
    }
  });

  app.on('before-quit', () => {
    globalShortcut.unregisterAll();
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    if (tray) {
      tray.destroy();
    }
  });
}
