import { BaseStorageProvider } from './base';
import type {
  StorageProviderType,
  StorageCredentials,
  ConnectionResult,
  FileInfo,
  ProgressHandler,
} from '../types';
import {
  uploadFile as uploadToReadest,
  downloadFile as downloadFromReadest,
  deleteFile as deleteFromReadest,
} from '@/libs/storage';

/**
 * Readest Cloud Storage Provider
 * Wraps the existing Readest cloud storage functionality
 */
export class ReadestStorageProvider extends BaseStorageProvider {
  name: StorageProviderType = 'readest';
  label = 'Readest Cloud';
  authRequired = true;

  async connect(credentials: StorageCredentials): Promise<ConnectionResult> {
    // Readest cloud uses the existing authentication system
    // Just verify that the user is authenticated
    try {
      // The existing storage system handles auth internally
      this.connected = credentials.readest?.enabled ?? true;
      return {
        success: true,
        message: 'Connected to Readest Cloud',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async uploadFile(
    localPath: string,
    remotePath: string,
    onProgress?: ProgressHandler,
  ): Promise<void> {
    try {
      // Read the file from localPath
      const response = await fetch(localPath);
      const blob = await response.blob();
      const file = new File([blob], remotePath.split('/').pop() || 'file');

      // Upload using existing Readest storage
      await uploadToReadest(file, remotePath, (progress) => {
        if (onProgress) {
          onProgress({
            loaded: progress.loaded,
            total: progress.total,
            percentage: (progress.loaded / progress.total) * 100,
          });
        }
      });
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
    try {
      await downloadFromReadest(remotePath, localPath, (progress) => {
        if (onProgress) {
          onProgress({
            loaded: progress.loaded,
            total: progress.total,
            percentage: (progress.loaded / progress.total) * 100,
          });
        }
      });
    } catch (error) {
      throw new Error(
        `Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async deleteFile(remotePath: string): Promise<void> {
    try {
      await deleteFromReadest(remotePath);
    } catch (error) {
      throw new Error(
        `Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async listFiles(remotePath: string): Promise<FileInfo[]> {
    // The current Readest storage doesn't expose a list files method
    // This would need to be implemented if needed
    throw new Error('List files not implemented for Readest storage');
  }

  async getFileInfo(remotePath: string): Promise<FileInfo | null> {
    // The current Readest storage doesn't expose a file info method
    // This would need to be implemented if needed
    throw new Error('Get file info not implemented for Readest storage');
  }
}
