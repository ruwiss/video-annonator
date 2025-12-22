import * as fs from 'fs';
import * as path from 'path';
import Store from 'electron-store';
import { AppSettings } from '../../shared/types';

export class FileService {
  private store: Store<{ settings: AppSettings }>;
  private sessionCounter: number = 0;

  constructor(store: Store<{ settings: AppSettings }>) {
    this.store = store;
    this.resetSessionCounter();
  }

  resetSessionCounter(): void {
    const settings = this.store.get('settings');
    this.sessionCounter = settings.numberingStart;
  }

  async saveAnnotation(dataUrl: string, overwritePath?: string): Promise<string> {
    // Image mode: overwrite the original file
    if (overwritePath) {
      try {
        const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        await fs.promises.writeFile(overwritePath, buffer);
        return overwritePath;
      } catch (err) {
        console.error('[FileService] Failed to overwrite file:', err);
        // Fallback to normal save if overwrite fails
      }
    }

    // Normal mode: save to export path with generated filename
    const settings = this.store.get('settings');

    // Ensure export directory exists
    if (!fs.existsSync(settings.exportPath)) {
      fs.mkdirSync(settings.exportPath, { recursive: true });
    }

    // Generate filename
    const filename = this.generateFilename(settings);
    const filePath = path.join(settings.exportPath, filename);

    // Convert data URL to buffer
    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Write file
    await fs.promises.writeFile(filePath, buffer);

    // Increment counter
    this.sessionCounter++;

    return filePath;
  }

  private generateFilename(settings: AppSettings): string {
    const now = new Date();

    const date = now.toISOString().split('T')[0].replace(/-/g, '');
    const time = now.toTimeString().split(' ')[0].replace(/:/g, '');
    const number = String(this.sessionCounter).padStart(3, '0');

    const extension = settings.imageFormat;

    return `${settings.filePrefix}_${date}_${time}_${number}.${extension}`;
  }

  getNextNumber(): number {
    return this.sessionCounter;
  }
}
