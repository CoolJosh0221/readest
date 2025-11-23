import { BaseStorageProvider } from './base';
import type {
  StorageProviderType,
  StorageCredentials,
  ConnectionResult,
  FileInfo,
  ProgressHandler,
} from '../types';

/**
 * Google Drive Storage Provider
 * Uses Google Drive REST API v3 directly via fetch
 */
export class GoogleDriveStorageProvider extends BaseStorageProvider {
  name: StorageProviderType = 'googledrive';
  label = 'Google Drive';
  authRequired = true;

  private accessToken: string | null = null;
  // @ts-expect-error - Reserved for future token refresh functionality
  private _refreshToken: string | null = null;
  private folderId: string = 'root';

  async connect(credentials: StorageCredentials): Promise<ConnectionResult> {
    try {
      if (!credentials.googledrive) {
        return {
          success: false,
          error: 'Google Drive credentials not provided',
        };
      }

      const { accessToken, refreshToken, folderId = 'root' } = credentials.googledrive;

      if (!accessToken || !refreshToken) {
        return {
          success: false,
          error: 'Google Drive access token and refresh token are required',
        };
      }

      this.accessToken = accessToken;
      this._refreshToken = refreshToken;
      this.folderId = folderId;

      // Test connection by fetching folder info
      try {
        const response = await fetch(
          `https://www.googleapis.com/drive/v3/files/${folderId}`,
          {
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
            },
          }
        );

        if (!response.ok) {
          return {
            success: false,
            error: `Connection failed: ${response.statusText}`,
          };
        }

        this.connected = true;
        return {
          success: true,
          message: 'Successfully connected to Google Drive',
        };
      } catch (error) {
        return {
          success: false,
          error: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    } catch (error) {
      this.connected = false;
      return {
        success: false,
        error: `Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async disconnect(): Promise<void> {
    this.accessToken = null;
    this._refreshToken = null;
    this.connected = false;
  }

  private ensureConnected(): void {
    if (!this.accessToken || !this.connected) {
      throw new Error('Not connected to Google Drive');
    }
  }

  async uploadFile(
    file: File | ArrayBuffer | Blob,
    remotePath: string,
    onProgress?: ProgressHandler,
  ): Promise<void> {
    this.ensureConnected();

    try {
      // Convert file to Blob
      let blob: Blob;
      if (file instanceof ArrayBuffer) {
        blob = new Blob([file]);
      } else if (file instanceof Blob) {
        blob = file;
      } else {
        throw new Error('Invalid file type');
      }

      // Extract filename from remotePath
      const filename = remotePath.split('/').pop() || 'file';

      // Create file metadata
      const metadata = {
        name: filename,
        parents: [this.folderId],
      };

      // Create multipart upload
      const boundary = '-------314159265358979323846';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelim = `\r\n--${boundary}--`;

      const metadataBlob = new Blob([
        delimiter,
        'Content-Type: application/json; charset=UTF-8\r\n\r\n',
        JSON.stringify(metadata),
        delimiter,
        `Content-Type: application/octet-stream\r\n\r\n`,
      ]);

      const requestBody = new Blob([metadataBlob, blob, closeDelim]);

      // Upload
      const response = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: requestBody,
        }
      );

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      // Call progress handler with completion
      this.handleProgress(blob.size, blob.size, onProgress);
    } catch (error) {
      throw new Error(
        `Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async downloadFile(
    remotePath: string,
    onProgress?: ProgressHandler,
  ): Promise<ArrayBuffer> {
    this.ensureConnected();

    try {
      // Extract filename from remotePath
      const filename = remotePath.split('/').pop() || '';

      // Find file by name
      const searchResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(filename)}' and '${this.folderId}' in parents and trashed=false`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!searchResponse.ok) {
        throw new Error(`Search failed: ${searchResponse.statusText}`);
      }

      const searchData = await searchResponse.json();
      if (!searchData.files || searchData.files.length === 0) {
        throw new Error('File not found');
      }

      const fileId = searchData.files[0].id;

      // Download file
      const downloadResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!downloadResponse.ok) {
        throw new Error(`Download failed: ${downloadResponse.statusText}`);
      }

      const arrayBuffer = await downloadResponse.arrayBuffer();

      // Call progress handler with completion
      this.handleProgress(arrayBuffer.byteLength, arrayBuffer.byteLength, onProgress);

      return arrayBuffer;
    } catch (error) {
      throw new Error(
        `Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async deleteFile(remotePath: string): Promise<void> {
    this.ensureConnected();

    try {
      // Extract filename from remotePath
      const filename = remotePath.split('/').pop() || '';

      // Find file by name
      const searchResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(filename)}' and '${this.folderId}' in parents and trashed=false`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!searchResponse.ok) {
        throw new Error(`Search failed: ${searchResponse.statusText}`);
      }

      const searchData = await searchResponse.json();
      if (!searchData.files || searchData.files.length === 0) {
        throw new Error('File not found');
      }

      const fileId = searchData.files[0].id;

      // Delete file
      const deleteResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!deleteResponse.ok) {
        throw new Error(`Delete failed: ${deleteResponse.statusText}`);
      }
    } catch (error) {
      throw new Error(
        `Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async listFiles(_remotePath: string): Promise<FileInfo[]> {
    this.ensureConnected();

    try {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q='${this.folderId}' in parents and trashed=false&fields=files(id,name,size,modifiedTime,mimeType)`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`List files failed: ${response.statusText}`);
      }

      const data = await response.json();

      return data.files.map((file: any) => ({
        name: file.name,
        path: file.name,
        size: parseInt(file.size || '0', 10),
        modifiedAt: new Date(file.modifiedTime),
        isDirectory: file.mimeType === 'application/vnd.google-apps.folder',
        id: file.id,
      }));
    } catch (error) {
      throw new Error(
        `Failed to list files: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async getFileInfo(remotePath: string): Promise<FileInfo | null> {
    this.ensureConnected();

    try {
      // Extract filename from remotePath
      const filename = remotePath.split('/').pop() || '';

      // Find file by name
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(filename)}' and '${this.folderId}' in parents and trashed=false&fields=files(id,name,size,modifiedTime,mimeType)`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      if (!data.files || data.files.length === 0) {
        return null;
      }

      const file = data.files[0];
      return {
        name: file.name,
        path: file.name,
        size: parseInt(file.size || '0', 10),
        modifiedAt: new Date(file.modifiedTime),
        isDirectory: file.mimeType === 'application/vnd.google-apps.folder',
        id: file.id,
      };
    } catch (error) {
      return null;
    }
  }
}
