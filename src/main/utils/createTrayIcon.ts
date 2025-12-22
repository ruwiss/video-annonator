import { nativeImage, NativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Creates tray icon from assets/icon.png
 * Falls back to programmatic icon if file not found
 */
export function createTrayIcon(): NativeImage {
  // Try to load from assets
  const iconPaths = [
    // Production: relative to dist/main/main/utils
    path.join(__dirname, '../../../../assets/icon.png'),
    // Development: relative to src/main/utils
    path.join(__dirname, '../../../assets/icon.png'),
    // Alternative paths
    path.join(process.cwd(), 'assets/icon.png'),
  ];

  for (const iconPath of iconPaths) {
    if (fs.existsSync(iconPath)) {
      const icon = nativeImage.createFromPath(iconPath);
      if (!icon.isEmpty()) {
        // Resize for tray (16x16 on Windows)
        return icon.resize({ width: 16, height: 16 });
      }
    }
  }

  // Fallback: programmatic icon
  const size = 16;
  const canvas = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="7" fill="#3b82f6"/>
      <path d="M5 11L11 5M11 5H7M11 5V9" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;

  const base64 = Buffer.from(canvas).toString('base64');
  const dataUrl = `data:image/svg+xml;base64,${base64}`;

  return nativeImage.createFromDataURL(dataUrl);
}

/**
 * Creates app icon (larger, for window)
 */
export function createAppIcon(): NativeImage | undefined {
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
