import { BaseStorageProvider } from './base';
import type {
  StorageProviderType,
  StorageCredentials,
  ConnectionResult,
  FileInfo,
  ProgressHandler,
} from '../types';
import { google, type drive_v3 } from 'googleapis';

/**
 * Google Drive Storage Provider
 * Supports storing and syncing books via Google Drive
 */
export class GoogleDriveStorageProvider extends BaseStorageProvider {
  name: StorageProviderType = 'googledrive';
  label = 'Google Drive';
  authRequired = true;

  private drive: drive_v3.Drive | null = null;
  private credentials: StorageCredentials['googleDrive'] | null = null;
  private folderId: string = '';

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

      // Create OAuth2 client
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      // Create Drive client
      this.drive = google.drive({ version: 'v3', auth: oauth2Client });
      this.credentials = credentials.googleDrive;
      this.folderId = folderId;

      // Test connection by getting user info
      try {
        await this.drive.about.get({ fields: 'user' });
      } catch (error) {
        return {
          success: false,
          error: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }

      // Create Readest folder if it doesn't exist and folderId is 'root'
      if (folderId === 'root') {
        try {
          const folderName = 'Readest';
          const response = await this.drive.files.list({
            q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive',
          });

          if (response.data.files && response.data.files.length > 0) {
            this.folderId = response.data.files[0].id!;
          } else {
            // Create folder
            const folder = await this.drive.files.create({
              requestBody: {
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder',
              },
              fields: 'id',
            });
            this.folderId = folder.data.id!;
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
    this.drive = null;
    this.credentials = null;
    this.connected = false;
  }

  private ensureConnected(): void {
    if (!this.drive || !this.connected) {
      throw new Error('Not connected to Google Drive');
    }
  }

  private async getOrCreateFolder(
    folderName: string,
    parentId: string,
  ): Promise<string> {
    this.ensureConnected();

    // Search for existing folder
    const response = await this.drive!.files.list({
      q: `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    if (response.data.files && response.data.files.length > 0) {
      return response.data.files[0].id!;
    }

    // Create folder
    const folder = await this.drive!.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      },
      fields: 'id',
    });

    return folder.data.id!;
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
      const response = await this.drive!.files.list({
        q: `name='${parts[i]}' and '${currentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive',
      });

      if (!response.data.files || response.data.files.length === 0) {
        return null;
      }

      currentFolderId = response.data.files[0].id!;
    }

    // Find the file
    const fileName = parts[parts.length - 1];
    const response = await this.drive!.files.list({
      q: `name='${fileName}' and '${currentFolderId}' in parents and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    if (!response.data.files || response.data.files.length === 0) {
      return null;
    }

    return {
      id: response.data.files[0].id!,
      name: response.data.files[0].name!,
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
      const arrayBuffer = await blob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const fileName = remotePath.split('/').pop() || 'file';
      const parentFolderId = await this.ensureDirectoryPath(remotePath);

      // Check if file already exists
      const existingFile = await this.findFileByPath(remotePath);

      const media = {
        mimeType: blob.type || 'application/octet-stream',
        body: Buffer.from(buffer),
      };

      if (existingFile) {
        // Update existing file
        await this.drive!.files.update({
          fileId: existingFile.id,
          media,
          fields: 'id',
        });
      } else {
        // Create new file
        await this.drive!.files.create({
          requestBody: {
            name: fileName,
            parents: [parentFolderId],
          },
          media,
          fields: 'id',
        });
      }

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
      const file = await this.findFileByPath(remotePath);

      if (!file) {
        throw new Error('File not found');
      }

      // Download the file
      const response = await this.drive!.files.get(
        {
          fileId: file.id,
          alt: 'media',
        },
        { responseType: 'arraybuffer' },
      );

      // Convert to Blob and save
      const buffer = response.data as ArrayBuffer;
      const blob = new Blob([buffer]);

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
      const bufferLength = buffer.byteLength;
      this.handleProgress(bufferLength, bufferLength, onProgress);
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

      await this.drive!.files.delete({
        fileId: file.id,
      });
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
          const response = await this.drive!.files.list({
            q: `name='${part}' and '${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive',
          });

          if (!response.data.files || response.data.files.length === 0) {
            return [];
          }

          folderId = response.data.files[0].id!;
        }
      }

      // List files in the folder
      const response = await this.drive!.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields:
          'files(id, name, size, modifiedTime, mimeType)',
        spaces: 'drive',
      });

      if (!response.data.files) {
        return [];
      }

      return response.data.files.map((file) => ({
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
      const response = await this.drive!.files.get({
        fileId: file.id,
        fields: 'id, name, size, modifiedTime, mimeType',
      });

      return {
        name: response.data.name || '',
        path: remotePath,
        size: parseInt(response.data.size || '0', 10),
        modifiedAt: new Date(response.data.modifiedTime || Date.now()),
        isDirectory:
          response.data.mimeType === 'application/vnd.google-apps.folder',
        id: response.data.id || undefined,
      };
    } catch (error) {
      return null;
    }
  }
}
