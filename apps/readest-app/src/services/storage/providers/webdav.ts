import { BaseStorageProvider } from './base';
import type {
  StorageProviderType,
  StorageCredentials,
  ConnectionResult,
  FileInfo,
  ProgressHandler,
} from '../types';
import { createClient, type WebDAVClient, type FileStat } from 'webdav';

/**
 * WebDAV Storage Provider
 * Supports any WebDAV-compatible server (Nextcloud, ownCloud, etc.)
 */
export class WebDAVStorageProvider extends BaseStorageProvider {
  name: StorageProviderType = 'webdav';
  label = 'WebDAV';
  authRequired = true;

  private client: WebDAVClient | null = null;
  private credentials: StorageCredentials['webdav'] | null = null;

  async connect(credentials: StorageCredentials): Promise<ConnectionResult> {
    try {
      if (!credentials.webdav) {
        return {
          success: false,
          error: 'WebDAV credentials not provided',
        };
      }

      const { url, username, password, basePath = '/Readest' } =
        credentials.webdav;

      if (!url || !username || !password) {
        return {
          success: false,
          error: 'WebDAV URL, username, and password are required',
        };
      }

      // Create WebDAV client
      this.client = createClient(url, {
        username,
        password,
      });

      this.credentials = credentials.webdav;

      // Test connection by checking if we can access the server
      try {
        await this.client.getDirectoryContents('/');
      } catch (error) {
        return {
          success: false,
          error: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }

      // Create base directory if it doesn't exist
      try {
        const exists = await this.client.exists(basePath);
        if (!exists) {
          await this.client.createDirectory(basePath, { recursive: true });
        }
      } catch (error) {
        console.warn('Failed to create base directory:', error);
      }

      this.connected = true;
      return {
        success: true,
        message: 'Successfully connected to WebDAV server',
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
    this.client = null;
    this.credentials = null;
    this.connected = false;
  }

  private ensureConnected(): void {
    if (!this.client || !this.connected) {
      throw new Error('Not connected to WebDAV server');
    }
  }

  private getFullPath(remotePath: string): string {
    const basePath = this.credentials?.basePath || '/Readest';
    // Normalize paths
    const normalizedBase = basePath.replace(/\/+$/, '');
    const normalizedRemote = remotePath.replace(/^\/+/, '');
    return `${normalizedBase}/${normalizedRemote}`;
  }

  async uploadFile(
    localPath: string,
    remotePath: string,
    onProgress?: ProgressHandler,
  ): Promise<void> {
    this.ensureConnected();

    try {
      // Read the file from localPath
      const response = await fetch(localPath);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const fullPath = this.getFullPath(remotePath);

      // Ensure directory exists
      const dirPath = fullPath.substring(0, fullPath.lastIndexOf('/'));
      try {
        const exists = await this.client!.exists(dirPath);
        if (!exists) {
          await this.client!.createDirectory(dirPath, { recursive: true });
        }
      } catch (error) {
        console.warn('Failed to create directory:', error);
      }

      // Upload the file
      await this.client!.putFileContents(fullPath, buffer, {
        overwrite: true,
      });

      // Call progress handler with completion
      this.handleProgress(buffer.length, buffer.length, onProgress);
    } catch (error) {
      throw new Error(
        `Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async downloadFile(
    remotePath: string,
    localPath: string,
    onProgress?: ProgressHandler,
  ): Promise<void> {
    this.ensureConnected();

    try {
      const fullPath = this.getFullPath(remotePath);

      // Download the file
      const contents = await this.client!.getFileContents(fullPath);

      // Convert to Blob and save
      const buffer = contents as Buffer;
      const blob = new Blob([buffer]);

      // In a browser environment, we'd use the File System Access API
      // For now, we'll create a download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = localPath.split('/').pop() || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Call progress handler with completion
      this.handleProgress(buffer.length, buffer.length, onProgress);
    } catch (error) {
      throw new Error(
        `Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async deleteFile(remotePath: string): Promise<void> {
    this.ensureConnected();

    try {
      const fullPath = this.getFullPath(remotePath);
      await this.client!.deleteFile(fullPath);
    } catch (error) {
      throw new Error(
        `Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async listFiles(remotePath: string): Promise<FileInfo[]> {
    this.ensureConnected();

    try {
      const fullPath = this.getFullPath(remotePath);
      const contents = await this.client!.getDirectoryContents(fullPath);

      return (contents as FileStat[]).map((item) => ({
        name: item.basename,
        path: item.filename,
        size: item.size,
        modifiedAt: new Date(item.lastmod),
        isDirectory: item.type === 'directory',
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
      const fullPath = this.getFullPath(remotePath);
      const stat = (await this.client!.stat(fullPath)) as FileStat;

      return {
        name: stat.basename,
        path: stat.filename,
        size: stat.size,
        modifiedAt: new Date(stat.lastmod),
        isDirectory: stat.type === 'directory',
      };
    } catch (error) {
      return null;
    }
  }
}
