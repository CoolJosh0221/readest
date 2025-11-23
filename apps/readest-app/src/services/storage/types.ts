export type StorageProviderType = 'readest' | 'webdav' | 'googledrive' | 'mega';

export interface StorageProvider {
  name: StorageProviderType;
  label: string;
  authRequired: boolean;

  // Authentication
  connect(credentials: StorageCredentials): Promise<ConnectionResult>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // File operations
  uploadFile(
    file: File | ArrayBuffer | Blob,
    remotePath: string,
    onProgress?: ProgressHandler,
  ): Promise<void>;
  downloadFile(
    remotePath: string,
    onProgress?: ProgressHandler,
  ): Promise<ArrayBuffer>;
  deleteFile(remotePath: string): Promise<void>;
  listFiles(remotePath: string): Promise<FileInfo[]>;

  // Metadata
  getFileInfo(remotePath: string): Promise<FileInfo | null>;
  fileExists(remotePath: string): Promise<boolean>;
}

export interface StorageCredentials {
  // For WebDAV
  webdav?: {
    url: string;
    username: string;
    password: string;
    basePath?: string;
  };

  // For Google Drive
  googledrive?: {
    accessToken: string;
    refreshToken: string;
    folderId?: string;
  };

  // For MEGA
  mega?: {
    email: string;
    password: string;
    folderPath?: string;
  };

  // For Readest Cloud (existing)
  readest?: {
    enabled: boolean;
  };
}

export interface ConnectionResult {
  success: boolean;
  message?: string;
  error?: string;
}

export interface FileInfo {
  name: string;
  path: string;
  size: number;
  modifiedAt: Date;
  isDirectory: boolean;
  id?: string;
}

export interface FileTransfer {
  localPath: string;
  remotePath: string;
  bookHash?: string;
}

export type ProgressHandler = (progress: ProgressInfo) => void;

export interface ProgressInfo {
  loaded: number;
  total: number;
  percentage: number;
}

export interface WebDAVSettings {
  enabled: boolean;
  serverUrl: string;
  username: string;
  password: string;
  basePath: string;
}

export interface StorageProviderSettings {
  activeProvider: StorageProviderType;
  readest: {
    enabled: boolean;
  };
  webdav: WebDAVSettings;
}
