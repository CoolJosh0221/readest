import type { StorageProvider, StorageProviderType } from '../types';
import { ReadestStorageProvider } from './readest';
import { WebDAVStorageProvider } from './webdav';
import { GoogleDriveStorageProvider } from './googledrive';

export { ReadestStorageProvider } from './readest';
export { WebDAVStorageProvider } from './webdav';
export { GoogleDriveStorageProvider } from './googledrive';

// Provider registry with lazy initialization
const providers = new Map<StorageProviderType, StorageProvider>();

function getOrCreateProvider(type: StorageProviderType): StorageProvider {
  if (!providers.has(type)) {
    switch (type) {
      case 'readest':
        providers.set(type, new ReadestStorageProvider());
        break;
      case 'webdav':
        providers.set(type, new WebDAVStorageProvider());
        break;
      case 'googledrive':
        providers.set(type, new GoogleDriveStorageProvider());
        break;
    }
  }
  return providers.get(type)!;
}

export function getProvider(
  type: StorageProviderType,
): StorageProvider | undefined {
  return getOrCreateProvider(type);
}

export function getAllProviders(): StorageProvider[] {
  // Ensure all providers are created
  getOrCreateProvider('readest');
  getOrCreateProvider('webdav');
  getOrCreateProvider('googledrive');
  return Array.from(providers.values());
}

export function getProviderTypes(): StorageProviderType[] {
  return ['readest', 'webdav', 'googledrive'];
}
