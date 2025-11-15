import { BaseStorageProvider } from './base';
import type {
  StorageProviderType,
  StorageCredentials,
  ConnectionResult,
  FileInfo,
  ProgressHandler,
} from '../types';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
}

interface DriveFilesResponse {
  files: DriveFile[];
}

/**
 * Google Drive Storage Provider
 * Supports storing and syncing books via Google Drive using REST API
 */
export class GoogleDriveStorageProvider extends BaseStorageProvider {
  name: StorageProviderType = 'googledrive';
  label = 'Google Drive';
  authRequired = true;

  private accessToken: string = '';
  private refreshToken: string = '';
  private folderId: string = '';
  private readonly baseUrl = 'https://www.googleapis.com/drive/v3';
  private readonly uploadUrl = 'https://www.googleapis.com/upload/drive/v3';

  async connect(credentials: StorageCredentials): Promise<ConnectionResult> {
    try {
      if (!credentials.googleDrive) {
        return {
          success: false,
          error: 'Google Drive credentials not provided',
        };
      }

      const { accessToken, refreshToken, folderId = 'root' } =
        credentials.googleDrive;

      if (!accessToken) {
        return {
          success: false,
          error: 'Google Drive access token is required',
        };
      }

      this.accessToken = accessToken;
      this.refreshToken = refreshToken || '';
      this.folderId = folderId;

      // Test connection by getting user info
      try {
        const response = await fetch(`${this.baseUrl}/about?fields=user`, {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        });

        if (!response.ok) {
          return {
            success: false,
            error: `Connection failed: ${response.statusText}`,
          };
        }
      } catch (error) {
        return {
          success: false,
          error: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }

      // Create Readest folder if folderId is 'root'
      if (folderId === 'root') {
        try {
          const folderName = 'Readest';
          const searchResponse = await fetch(
            `${this.baseUrl}/files?q=${encodeURIComponent(
              `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            )}&fields=files(id,name)&spaces=drive`,
            {
              headers: {
                Authorization: `Bearer ${this.accessToken}`,
              },
            },
          );

          if (searchResponse.ok) {
            const data: DriveFilesResponse = await searchResponse.json();
            if (data.files && data.files.length > 0) {
              this.folderId = data.files[0].id;
            } else {
              // Create folder
              const createResponse = await fetch(`${this.baseUrl}/files`, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${this.accessToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  name: folderName,
                  mimeType: 'application/vnd.google-apps.folder',
                }),
              });

              if (createResponse.ok) {
                const folder: DriveFile = await createResponse.json();
                this.folderId = folder.id;
              }
            }
          }
        } catch (error) {
          console.warn('Failed to create Readest folder:', error);
        }
      }

      this.connected = true;
      return {
        success: true,
        message: 'Successfully connected to Google Drive',
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
    this.accessToken = '';
    this.refreshToken = '';
    this.connected = false;
  }

  private ensureConnected(): void {
    if (!this.accessToken || !this.connected) {
      throw new Error('Not connected to Google Drive');
    }
  }

  private async getOrCreateFolder(
    folderName: string,
    parentId: string,
  ): Promise<string> {
    this.ensureConnected();

    // Search for existing folder
    const searchResponse = await fetch(
      `${this.baseUrl}/files?q=${encodeURIComponent(
        `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      )}&fields=files(id,name)&spaces=drive`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      },
    );

    if (searchResponse.ok) {
      const data: DriveFilesResponse = await searchResponse.json();
      if (data.files && data.files.length > 0) {
        return data.files[0].id;
      }
    }

    // Create folder
    const createResponse = await fetch(`${this.baseUrl}/files`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      }),
    });

    if (!createResponse.ok) {
      throw new Error(`Failed to create folder: ${createResponse.statusText}`);
    }

    const folder: DriveFile = await createResponse.json();
    return folder.id;
  }

  private async ensureDirectoryPath(remotePath: string): Promise<string> {
    const parts = remotePath.split('/').filter((p) => p);
    let currentFolderId = this.folderId;

    // Create each directory in the path (except the last part which is the file)
    for (let i = 0; i < parts.length - 1; i++) {
      currentFolderId = await this.getOrCreateFolder(parts[i], currentFolderId);
    }

    return currentFolderId;
  }

  private async findFileByPath(
    remotePath: string,
  ): Promise<{ id: string; name: string } | null> {
    this.ensureConnected();

    const parts = remotePath.split('/').filter((p) => p);
    let currentFolderId = this.folderId;

    // Navigate through folders
    for (let i = 0; i < parts.length - 1; i++) {
      const response = await fetch(
        `${this.baseUrl}/files?q=${encodeURIComponent(
          `name='${parts[i]}' and '${currentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        )}&fields=files(id,name)&spaces=drive`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        },
      );

      if (!response.ok) {
        return null;
      }

      const data: DriveFilesResponse = await response.json();
      if (!data.files || data.files.length === 0) {
        return null;
      }

      currentFolderId = data.files[0].id;
    }

    // Find the file
    const fileName = parts[parts.length - 1];
    const response = await fetch(
      `${this.baseUrl}/files?q=${encodeURIComponent(
        `name='${fileName}' and '${currentFolderId}' in parents and trashed=false`,
      )}&fields=files(id,name)&spaces=drive`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      },
    );

    if (!response.ok) {
      return null;
    }

    const data: DriveFilesResponse = await response.json();
    if (!data.files || data.files.length === 0) {
      return null;
    }

    return {
      id: data.files[0].id,
      name: data.files[0].name,
    };
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

      const fileName = remotePath.split('/').pop() || 'file';
      const parentFolderId = await this.ensureDirectoryPath(remotePath);

      // Check if file already exists
      const existingFile = await this.findFileByPath(remotePath);

      if (existingFile) {
        // Update existing file using multipart upload
        const metadata = {
          name: fileName,
        };

        const form = new FormData();
        form.append(
          'metadata',
          new Blob([JSON.stringify(metadata)], { type: 'application/json' }),
        );
        form.append('file', blob);

        const updateResponse = await fetch(
          `${this.uploadUrl}/files/${existingFile.id}?uploadType=multipart`,
          {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
            },
            body: form,
          },
        );

        if (!updateResponse.ok) {
          throw new Error(`Failed to update file: ${updateResponse.statusText}`);
        }
      } else {
        // Create new file using multipart upload
        const metadata = {
          name: fileName,
          parents: [parentFolderId],
        };

        const form = new FormData();
        form.append(
          'metadata',
          new Blob([JSON.stringify(metadata)], { type: 'application/json' }),
        );
        form.append('file', blob);

        const createResponse = await fetch(
          `${this.uploadUrl}/files?uploadType=multipart`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
            },
            body: form,
          },
        );

        if (!createResponse.ok) {
          throw new Error(`Failed to create file: ${createResponse.statusText}`);
        }
      }

      // Call progress handler with completion
      this.handleProgress(blob.size, blob.size, onProgress);
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
      const file = await this.findFileByPath(remotePath);

      if (!file) {
        throw new Error('File not found');
      }

      // Download the file
      const response = await fetch(
        `${this.baseUrl}/files/${file.id}?alt=media`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }

      // Convert to Blob and save
      const blob = await response.blob();

      // In a browser environment, we'd use the File System Access API
      // For now, we'll create a download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = localPath.split('/').pop() || file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Call progress handler with completion
      this.handleProgress(blob.size, blob.size, onProgress);
    } catch (error) {
      throw new Error(
        `Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async deleteFile(remotePath: string): Promise<void> {
    this.ensureConnected();

    try {
      const file = await this.findFileByPath(remotePath);

      if (!file) {
        throw new Error('File not found');
      }

      const response = await fetch(`${this.baseUrl}/files/${file.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to delete file: ${response.statusText}`);
      }
    } catch (error) {
      throw new Error(
        `Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async listFiles(remotePath: string): Promise<FileInfo[]> {
    this.ensureConnected();

    try {
      let folderId = this.folderId;

      // Navigate to the folder
      if (remotePath && remotePath !== '/') {
        const parts = remotePath.split('/').filter((p) => p);
        for (const part of parts) {
          const response = await fetch(
            `${this.baseUrl}/files?q=${encodeURIComponent(
              `name='${part}' and '${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            )}&fields=files(id,name)&spaces=drive`,
            {
              headers: {
                Authorization: `Bearer ${this.accessToken}`,
              },
            },
          );

          if (!response.ok) {
            return [];
          }

          const data: DriveFilesResponse = await response.json();
          if (!data.files || data.files.length === 0) {
            return [];
          }

          folderId = data.files[0].id;
        }
      }

      // List files in the folder
      const response = await fetch(
        `${this.baseUrl}/files?q=${encodeURIComponent(
          `'${folderId}' in parents and trashed=false`,
        )}&fields=files(id,name,size,modifiedTime,mimeType)&spaces=drive`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to list files: ${response.statusText}`);
      }

      const data: DriveFilesResponse = await response.json();

      if (!data.files) {
        return [];
      }

      return data.files.map((file) => ({
        name: file.name || '',
        path: remotePath + '/' + file.name,
        size: parseInt(file.size || '0', 10),
        modifiedAt: new Date(file.modifiedTime || Date.now()),
        isDirectory: file.mimeType === 'application/vnd.google-apps.folder',
        id: file.id || undefined,
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
      const file = await this.findFileByPath(remotePath);

      if (!file) {
        return null;
      }

      // Get file metadata
      const response = await fetch(
        `${this.baseUrl}/files/${file.id}?fields=id,name,size,modifiedTime,mimeType`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        },
      );

      if (!response.ok) {
        return null;
      }

      const data: DriveFile = await response.json();

      return {
        name: data.name || '',
        path: remotePath,
        size: parseInt(data.size || '0', 10),
        modifiedAt: new Date(data.modifiedTime || Date.now()),
        isDirectory: data.mimeType === 'application/vnd.google-apps.folder',
        id: data.id || undefined,
      };
    } catch (error) {
      return null;
    }
  }
}
