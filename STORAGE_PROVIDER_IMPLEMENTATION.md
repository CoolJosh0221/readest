# Storage Provider Implementation for Readest

This document describes the WebDAV integration implementation for Readest.

## Overview

Added support for WebDAV as an alternative storage provider alongside the existing Readest Cloud storage. Users can now choose between Readest Cloud or their own WebDAV server (Nextcloud, ownCloud, etc.) for storing and syncing books.

## Implementation Details

### 1. Storage Provider Infrastructure

Created a provider-based architecture in `/apps/readest-app/src/services/storage/`:

- **types.ts**: Core type definitions for storage providers
- **providers/base.ts**: Abstract base class for all providers
- **providers/readest.ts**: Wrapper for existing Readest Cloud storage
- **providers/webdav.ts**: WebDAV provider implementation
- **providers/index.ts**: Provider registry
- **service.ts**: Storage service orchestrator
- **index.ts**: Main export file

### 2. Type Definitions

Added to `/apps/readest-app/src/types/settings.ts`:

- `StorageProviderType`: Type for provider selection ('readest' | 'webdav')
- `WebDAVSettings`: WebDAV configuration interface
- `StorageProviderSettings`: Overall storage provider settings
- Updated `SystemSettings` to include `storageProvider` field

### 3. Default Settings

Updated `/apps/readest-app/src/services/constants.ts`:

- `DEFAULT_WEBDAV_SETTINGS`: Default WebDAV configuration
- `DEFAULT_STORAGE_PROVIDER_SETTINGS`: Default provider settings
- Added to `DEFAULT_SYSTEM_SETTINGS`

### 4. User Interface

Created `/apps/readest-app/src/app/library/components/StorageProviderSettings.tsx`:

- Dialog-based settings interface
- Provider selection dropdown (Readest Cloud / WebDAV)
- WebDAV connection form (URL, username, password, base path)
- Connection testing and status display
- Enable/disable functionality

Updated `/apps/readest-app/src/app/library/components/SettingsMenu.tsx`:

- Added "Storage Provider" menu item
- Integrated with storage provider settings dialog

Updated `/apps/readest-app/src/app/library/page.tsx`:

- Added `StorageProviderSettingsWindow` component to library page

### 5. Dependencies

Added to `/apps/readest-app/package.json`:

- `webdav`: ^5.8.0 - WebDAV client library

## Features

### WebDAV Support

- **Server Configuration**: Connect to any WebDAV-compatible server (Nextcloud, ownCloud, etc.)
- **Authentication**: Username/password authentication
- **Base Path**: Configurable base directory on the server
- **Connection Testing**: Verify server connectivity before enabling
- **File Operations**: Upload, download, delete, list files
- **Directory Management**: Automatic directory creation
- **Client-Side Rendering**: Properly handles SSR with lazy-loaded providers

## Usage

1. **Access Settings**: Click on the settings menu in the library view
2. **Select Storage Provider**: Choose "Storage Provider" from the menu
3. **Configure WebDAV**:
   - Enter server URL (e.g., `https://cloud.example.com/remote.php/dav/files/username`)
   - Enter username and password
   - Set base path (default: `/Readest`)
4. **Test Connection**: Click "Connect WebDAV" to verify settings
5. **Enable Provider**: Once connected, WebDAV becomes the active storage provider

## Technical Implementation

### Provider Pattern

Follows Readest's existing patterns:
- **KOSyncClient**: Similar service class pattern for external sync
- **Translators**: Plain object pattern for stateless providers
- **Storage Providers**: Class-based pattern (appropriate for stateful providers with connection management)

### SSR Compatibility

- Components use `'use client'` directive for client-side rendering
- Storage service is dynamically imported only when needed
- Provider registry uses lazy initialization to avoid SSR issues

### File Operations

The WebDAV provider uses the `webdav` npm package and implements:
- `connect()`: Establishes connection and verifies server accessibility
- `uploadFile()`: Uploads files with automatic directory creation
- `downloadFile()`: Downloads files from WebDAV server
- `deleteFile()`: Removes files from WebDAV server
- `listFiles()`: Lists directory contents
- `getFileInfo()`: Retrieves file metadata

## Completed Integration

### 1. App Service Integration ✓

The storage providers have been successfully integrated with the main app service.

**Modified `/apps/readest-app/src/services/appService.ts`**:

- Updated `uploadBook()` to check activeProvider and use WebDAV or Readest Cloud accordingly
- Updated `downloadBook()` to check activeProvider and use WebDAV or Readest Cloud accordingly
- Updated `deleteBook()` to check activeProvider and use WebDAV or Readest Cloud accordingly

**Implementation Details**:

- When activeProvider is 'webdav', the methods dynamically import and initialize the storage service
- When activeProvider is 'readest' or undefined, the methods use the existing Readest Cloud logic
- WebDAV connection is automatically established if not already connected
- Settings are passed as optional parameters to preserve backward compatibility

**Provider Interface Changes**:

- `uploadFile()` now accepts File/ArrayBuffer/Blob instead of local path for better abstraction
- `downloadFile()` now returns ArrayBuffer instead of writing to path, allowing app service to handle file system operations
- Removed unused ReadestStorageProvider wrapper as Readest Cloud is handled directly in appService

## Future Work

### 1. Settings Migration

When existing users upgrade, ensure:

- Default storage provider is set to 'readest'
- Existing books continue to work without migration
- Clear migration path if users want to switch providers

### 2. Testing

Comprehensive testing needed for:

- WebDAV connection with various servers (Nextcloud, ownCloud, etc.)
- File upload/download with progress tracking
- Error handling and retry logic
- Network failure scenarios
- Large file transfers
- Concurrent operations

### 3. Security Considerations

- **Password Storage**: WebDAV passwords should be encrypted before storage
- **HTTPS**: Enforce HTTPS for WebDAV connections
- **Input Validation**: Validate all user inputs
- **Credential Management**: Secure storage and retrieval of credentials

### 4. Performance Optimizations

- Implement chunked uploads for large files
- Add caching layer for frequently accessed files
- Implement resumable uploads/downloads
- Add bandwidth throttling options

### 5. Additional Features

- **Sync Conflict Resolution**: Handle conflicts when files are modified on multiple devices
- **Selective Sync**: Allow users to choose which books to sync
- **Background Sync**: Implement background synchronization
- **Offline Mode**: Better offline support with queue management
- **Multi-Provider**: Support multiple providers simultaneously (future enhancement)

## File Structure

```
apps/readest-app/src/
├── services/
│   └── storage/
│       ├── types.ts
│       ├── service.ts
│       ├── index.ts
│       └── providers/
│           ├── base.ts
│           ├── index.ts
│           ├── readest.ts
│           └── webdav.ts
├── types/
│   └── settings.ts (updated)
├── app/
│   └── library/
│       ├── page.tsx (updated)
│       └── components/
│           ├── SettingsMenu.tsx (updated)
│           └── StorageProviderSettings.tsx (new)
└── services/
    └── constants.ts (updated)
```

## Testing Instructions

### WebDAV Testing

1. **Set up a local WebDAV server for testing**:
   ```bash
   docker run -d -p 8080:80 bytemark/webdav
   ```

2. **Configure in Readest**:
   - URL: `http://localhost:8080`
   - Username: `user`
   - Password: `password`
   - Base Path: `/Readest`

3. **Test operations**:
   - Connect to server
   - Switch active provider to WebDAV
   - Upload a book (once integrated with app service)
   - Download a book
   - Delete a book

### Production WebDAV Servers

Test with real WebDAV servers:
- **Nextcloud**: `https://your-nextcloud.com/remote.php/dav/files/username`
- **ownCloud**: `https://your-owncloud.com/remote.php/dav/files/username`
- **Apache with mod_dav**: `https://your-server.com/webdav`

## Notes

- The implementation follows Readest's existing patterns (translator providers, metadata providers)
- All providers implement the same interface for consistency
- The UI follows Readest's design system (DaisyUI components)
- Settings are persisted using the existing settings store
- The implementation is extensible - new providers can be added easily by implementing the `StorageProvider` interface

## Commits

- Initial implementation: WebDAV and Google Drive support
- Fixed SSR issues with lazy loading and client-side rendering
- Removed Google Drive to simplify implementation and focus on WebDAV
- Integrated WebDAV storage provider with appService (uploadBook, downloadBook, deleteBook)
- Updated provider interfaces to use File/ArrayBuffer for better abstraction
- Removed unused ReadestStorageProvider wrapper
