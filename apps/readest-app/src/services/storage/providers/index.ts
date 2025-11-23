import type { StorageProvider, StorageProviderType } from '../types';
import { WebDAVStorageProvider } from './webdav';
import { GoogleDriveStorageProvider } from './googledrive';
import { MEGAStorageProvider } from './mega';

export { WebDAVStorageProvider } from './webdav';
export { GoogleDriveStorageProvider } from './googledrive';
export { MEGAStorageProvider } from './mega';

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
      case 'mega':
        providers.set(type, new MEGAStorageProvider());
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
  // Create WebDAV, Google Drive, and MEGA providers
  getOrCreateProvider('webdav');
  getOrCreateProvider('googledrive');
  getOrCreateProvider('mega');
  return Array.from(providers.values());
}

export function getProviderTypes(): StorageProviderType[] {
  return ['readest', 'webdav', 'googledrive', 'mega'];
}
