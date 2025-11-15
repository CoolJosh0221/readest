import type {
  StorageProvider,
  StorageProviderType,
  StorageCredentials,
  ConnectionResult,
  FileInfo,
  ProgressHandler,
} from './types';
import { getProvider } from './providers';

/**
 * Storage Service
 * Central service for managing storage providers
 */
class StorageService {
  private activeProvider: StorageProvider | null = null;
  private activeProviderType: StorageProviderType = 'readest';

  /**
   * Set the active storage provider
   */
  async setActiveProvider(
    type: StorageProviderType,
    credentials: StorageCredentials,
  ): Promise<ConnectionResult> {
    const provider = getProvider(type);

    if (!provider) {
      return {
        success: false,
        error: `Provider ${type} not found`,
      };
    }

    // Disconnect from current provider if any
    if (this.activeProvider) {
      await this.activeProvider.disconnect();
    }

    // Connect to new provider
    const result = await provider.connect(credentials);

    if (result.success) {
      this.activeProvider = provider;
      this.activeProviderType = type;
    }

    return result;
  }

  /**
   * Get the current active provider
   */
  getActiveProvider(): StorageProvider | null {
    return this.activeProvider;
  }

  /**
   * Get the current active provider type
   */
  getActiveProviderType(): StorageProviderType {
    return this.activeProviderType;
  }

  /**
   * Disconnect from the current provider
   */
  async disconnect(): Promise<void> {
    if (this.activeProvider) {
      await this.activeProvider.disconnect();
      this.activeProvider = null;
    }
  }

  /**
   * Upload a file using the active provider
   */
  async uploadFile(
    localPath: string,
    remotePath: string,
    onProgress?: ProgressHandler,
  ): Promise<void> {
    if (!this.activeProvider) {
      throw new Error('No active storage provider');
    }

    await this.activeProvider.uploadFile(localPath, remotePath, onProgress);
  }

  /**
   * Download a file using the active provider
   */
  async downloadFile(
    remotePath: string,
    localPath: string,
    onProgress?: ProgressHandler,
  ): Promise<void> {
    if (!this.activeProvider) {
      throw new Error('No active storage provider');
    }

    await this.activeProvider.downloadFile(remotePath, localPath, onProgress);
  }

  /**
   * Delete a file using the active provider
   */
  async deleteFile(remotePath: string): Promise<void> {
    if (!this.activeProvider) {
      throw new Error('No active storage provider');
    }

    await this.activeProvider.deleteFile(remotePath);
  }

  /**
   * List files using the active provider
   */
  async listFiles(remotePath: string): Promise<FileInfo[]> {
    if (!this.activeProvider) {
      throw new Error('No active storage provider');
    }

    return await this.activeProvider.listFiles(remotePath);
  }

  /**
   * Get file info using the active provider
   */
  async getFileInfo(remotePath: string): Promise<FileInfo | null> {
    if (!this.activeProvider) {
      throw new Error('No active storage provider');
    }

    return await this.activeProvider.getFileInfo(remotePath);
  }

  /**
   * Check if a file exists using the active provider
   */
  async fileExists(remotePath: string): Promise<boolean> {
    if (!this.activeProvider) {
      throw new Error('No active storage provider');
    }

    return await this.activeProvider.fileExists(remotePath);
  }
}

// Export singleton instance
export const storageService = new StorageService();
export default storageService;
