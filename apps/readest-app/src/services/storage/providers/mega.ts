import { BaseStorageProvider } from './base';
import type {
  StorageProviderType,
  StorageCredentials,
  ConnectionResult,
  FileInfo,
  ProgressHandler,
} from '../types';
import { Storage } from 'megajs';

/**
 * MEGA Storage Provider
 * Provides integration with MEGA cloud storage (mega.nz)
 */
export class MEGAStorageProvider extends BaseStorageProvider {
  name: StorageProviderType = 'mega';
  label = 'MEGA';
  authRequired = true;

  private storage: any = null;
  private folder: any = null;
  private credentials: StorageCredentials['mega'] | null = null;

  async connect(credentials: StorageCredentials): Promise<ConnectionResult> {
    try {
      if (!credentials.mega) {
        return {
          success: false,
          error: 'MEGA credentials not provided',
        };
      }

      const { email, password, folderPath = '/Readest' } = credentials.mega;

      if (!email || !password) {
        return {
          success: false,
          error: 'MEGA email and password are required',
        };
      }

      this.credentials = credentials.mega;

      // Initialize MEGA storage
      this.storage = await new Promise<any>((resolve, reject) => {
        const storage = new Storage({
          email,
          password,
        });

        storage.once('ready', () => resolve(storage));
        storage.once('error', (error: Error) => reject(error));
      });

      // Find or create the folder
      try {
        this.folder = await this.findOrCreateFolder(folderPath);
      } catch (error) {
        return {
          success: false,
          error: `Failed to access folder: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }

      this.connected = true;
      return {
        success: true,
        message: 'Successfully connected to MEGA',
      };
    } catch (error) {
      this.connected = false;
      return {
        success: false,
        error: `Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async disconnect(): Promise<void> {
    if (this.storage) {
      try {
        await this.storage.close();
      } catch (error) {
        console.error('Error closing MEGA storage:', error);
      }
    }
    this.storage = null;
    this.folder = null;
    this.credentials = null;
    this.connected = false;
  }

  private ensureConnected(): void {
    if (!this.storage || !this.connected) {
      throw new Error('Not connected to MEGA');
    }
  }

  private async findOrCreateFolder(path: string): Promise<any> {
    const parts = path.split('/').filter(p => p);
    let currentFolder = this.storage.root;

    for (const part of parts) {
      // Try to find existing folder
      const children = await currentFolder.children;
      let found = children.find((child: any) => child.name === part && child.directory);

      if (!found) {
        // Create folder if it doesn't exist
        found = await currentFolder.mkdir(part);
      }

      currentFolder = found;
    }

    return currentFolder;
  }

  async uploadFile(
    file: File | ArrayBuffer | Blob,
    remotePath: string,
    onProgress?: ProgressHandler,
  ): Promise<void> {
    this.ensureConnected();

    try {
      // Convert file to ArrayBuffer
      let arrayBuffer: ArrayBuffer;
      if (file instanceof ArrayBuffer) {
        arrayBuffer = file;
      } else if (typeof Blob !== 'undefined' && file instanceof Blob) {
        arrayBuffer = await file.arrayBuffer();
      } else {
        throw new Error('Invalid file type');
      }

      const buffer = Buffer.from(arrayBuffer);
      const filename = remotePath.split('/').pop() || 'file';

      // Upload to MEGA
      const uploadStream = this.folder.upload({
        name: filename,
        size: buffer.length,
      }, buffer);

      // Handle progress
      if (onProgress) {
        uploadStream.on('progress', (stats: any) => {
          this.handleProgress(stats.bytesUploaded, stats.bytesTotal, onProgress);
        });
      }

      // Wait for upload to complete
      await new Promise<void>((resolve, reject) => {
        uploadStream.on('complete', () => resolve());
        uploadStream.on('error', (error: Error) => reject(error));
      });
    } catch (error) {
      throw new Error(
        `Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async downloadFile(
    remotePath: string,
    onProgress?: ProgressHandler,
  ): Promise<ArrayBuffer> {
    this.ensureConnected();

    try {
      const filename = remotePath.split('/').pop() || '';

      // Find the file
      const children = await this.folder.children;
      const file = children.find((child: any) => child.name === filename && !child.directory);

      if (!file) {
        throw new Error('File not found');
      }

      // Download the file
      const chunks: Buffer[] = [];
      const downloadStream = file.download();

      if (onProgress) {
        downloadStream.on('progress', (stats: any) => {
          this.handleProgress(stats.bytesLoaded, stats.bytesTotal, onProgress);
        });
      }

      await new Promise<void>((resolve, reject) => {
        downloadStream.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        downloadStream.on('end', () => resolve());
        downloadStream.on('error', (error: Error) => reject(error));
      });

      // Combine chunks into ArrayBuffer
      const buffer = Buffer.concat(chunks);
      const arrayBuffer: ArrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      ) as ArrayBuffer;

      return arrayBuffer;
    } catch (error) {
      throw new Error(
        `Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async deleteFile(remotePath: string): Promise<void> {
    this.ensureConnected();

    try {
      const filename = remotePath.split('/').pop() || '';

      // Find the file
      const children = await this.folder.children;
      const file = children.find((child: any) => child.name === filename);

      if (!file) {
        throw new Error('File not found');
      }

      // Delete the file
      await new Promise<void>((resolve, reject) => {
        file.delete((error: Error | null) => {
          if (error) reject(error);
          else resolve();
        });
      });
    } catch (error) {
      throw new Error(
        `Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async listFiles(_remotePath: string): Promise<FileInfo[]> {
    this.ensureConnected();

    try {
      const children = await this.folder.children;

      return children.map((child: any) => ({
        name: child.name,
        path: child.name,
        size: child.size || 0,
        modifiedAt: child.timestamp ? new Date(child.timestamp * 1000) : new Date(),
        isDirectory: child.directory === true,
        id: child.nodeId,
      }));
    } catch (error) {
      throw new Error(
        `Failed to list files: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async getFileInfo(remotePath: string): Promise<FileInfo | null> {
    this.ensureConnected();

    try {
      const filename = remotePath.split('/').pop() || '';
      const children = await this.folder.children;
      const file = children.find((child: any) => child.name === filename);

      if (!file) {
        return null;
      }

      return {
        name: file.name,
        path: file.name,
        size: file.size || 0,
        modifiedAt: file.timestamp ? new Date(file.timestamp * 1000) : new Date(),
        isDirectory: file.directory === true,
        id: file.nodeId,
      };
    } catch (error) {
      return null;
    }
  }
}
