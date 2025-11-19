import type { StorageProvider, StorageProviderType } from '../types';
import { WebDAVStorageProvider } from './webdav';
import { GoogleDriveStorageProvider } from './googledrive';

export { WebDAVStorageProvider } from './webdav';
export { GoogleDriveStorageProvider } from './googledrive';

// Provider registry with lazy initialization
const providers = new Map<StorageProviderType, StorageProvider>();

function getOrCreateProvider(type: StorageProviderType): StorageProvider | undefined {
  if (!providers.has(type)) {
    switch (type) {
      case 'webdav':
        providers.set(type, new WebDAVStorageProvider());
        break;
      case 'googledrive':
        providers.set(type, new GoogleDriveStorageProvider());
        break;
      case 'readest':
        // Readest Cloud uses the existing storage system directly in appService
        // No provider wrapper needed
        return undefined;
    }
  }
  return providers.get(type);
}

export function getProvider(
  type: StorageProviderType,
): StorageProvider | undefined {
  return getOrCreateProvider(type);
}

export function getAllProviders(): StorageProvider[] {
  // Create WebDAV and Google Drive providers
  getOrCreateProvider('webdav');
  getOrCreateProvider('googledrive');
  return Array.from(providers.values());
}

export function getProviderTypes(): StorageProviderType[] {
  return ['readest', 'webdav', 'googledrive'];
}
