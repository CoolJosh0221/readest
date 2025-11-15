import type { StorageProvider, StorageProviderType } from '../types';
import { ReadestStorageProvider } from './readest';
import { WebDAVStorageProvider } from './webdav';
import { GoogleDriveStorageProvider } from './googledrive';

export { ReadestStorageProvider } from './readest';
export { WebDAVStorageProvider } from './webdav';
export { GoogleDriveStorageProvider } from './googledrive';

// Provider registry
const providers = new Map<StorageProviderType, StorageProvider>([
  ['readest', new ReadestStorageProvider()],
  ['webdav', new WebDAVStorageProvider()],
  ['googledrive', new GoogleDriveStorageProvider()],
]);

export function getProvider(
  type: StorageProviderType,
): StorageProvider | undefined {
  return providers.get(type);
}

export function getAllProviders(): StorageProvider[] {
  return Array.from(providers.values());
}

export function getProviderTypes(): StorageProviderType[] {
  return Array.from(providers.keys());
}
