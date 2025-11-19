import type {
  StorageProvider,
  StorageProviderType,
  StorageCredentials,
  ConnectionResult,
  FileInfo,
  ProgressHandler,
} from '../types';

export abstract class BaseStorageProvider implements StorageProvider {
  abstract name: StorageProviderType;
  abstract label: string;
  abstract authRequired: boolean;

  protected connected: boolean = false;

  abstract connect(credentials: StorageCredentials): Promise<ConnectionResult>;
  abstract disconnect(): Promise<void>;

  isConnected(): boolean {
    return this.connected;
  }

  abstract uploadFile(
    file: File | ArrayBuffer | Blob,
    remotePath: string,
    onProgress?: ProgressHandler,
  ): Promise<void>;

  abstract downloadFile(
    remotePath: string,
    onProgress?: ProgressHandler,
  ): Promise<ArrayBuffer>;

  abstract deleteFile(remotePath: string): Promise<void>;

  abstract listFiles(remotePath: string): Promise<FileInfo[]>;

  abstract getFileInfo(remotePath: string): Promise<FileInfo | null>;

  async fileExists(remotePath: string): Promise<boolean> {
    try {
      const info = await this.getFileInfo(remotePath);
      return info !== null;
    } catch {
      return false;
    }
  }

  protected handleProgress(
    loaded: number,
    total: number,
    onProgress?: ProgressHandler,
  ): void {
    if (onProgress) {
      onProgress({
        loaded,
        total,
        percentage: total > 0 ? (loaded / total) * 100 : 0,
      });
    }
  }
}
