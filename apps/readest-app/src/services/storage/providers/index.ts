import type { StorageProvider, StorageProviderType } from '../types';
import { WebDAVStorageProvider } from './webdav';

export { WebDAVStorageProvider } from './webdav';

// Provider registry with lazy initialization
const providers = new Map<StorageProviderType, StorageProvider>();

function getOrCreateProvider(type: StorageProviderType): StorageProvider | undefined {
  if (!providers.has(type)) {
    switch (type) {
      case 'webdav':
        providers.set(type, new WebDAVStorageProvider());
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
  // Only create WebDAV provider
  getOrCreateProvider('webdav');
  return Array.from(providers.values());
}

export function getProviderTypes(): StorageProviderType[] {
  return ['readest', 'webdav'];
}
