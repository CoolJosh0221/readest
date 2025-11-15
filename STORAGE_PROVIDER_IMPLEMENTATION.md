# Storage Provider Implementation for Readest

This document describes the WebDAV and Google Drive integration implementation for Readest.

## Overview

Added support for alternative storage providers (WebDAV and Google Drive) alongside the existing Readest Cloud storage. Users can now choose their preferred storage backend for storing and syncing books.

## Implementation Details

### 1. Storage Provider Infrastructure

Created a provider-based architecture in `/apps/readest-app/src/services/storage/`:

- **types.ts**: Core type definitions for storage providers
- **providers/base.ts**: Abstract base class for all providers
- **providers/readest.ts**: Wrapper for existing Readest Cloud storage
- **providers/webdav.ts**: WebDAV provider implementation
- **providers/googledrive.ts**: Google Drive provider implementation
- **providers/index.ts**: Provider registry
- **service.ts**: Storage service orchestrator
- **index.ts**: Main export file

### 2. Type Definitions

Added to `/apps/readest-app/src/types/settings.ts`:

- `StorageProviderType`: Type for provider selection ('readest' | 'webdav' | 'googledrive')
- `WebDAVSettings`: WebDAV configuration interface
- `GoogleDriveSettings`: Google Drive configuration interface
- `StorageProviderSettings`: Overall storage provider settings
- Updated `SystemSettings` to include `storageProvider` field

### 3. Default Settings

Updated `/apps/readest-app/src/services/constants.ts`:

- `DEFAULT_WEBDAV_SETTINGS`: Default WebDAV configuration
- `DEFAULT_GOOGLEDRIVE_SETTINGS`: Default Google Drive configuration
- `DEFAULT_STORAGE_PROVIDER_SETTINGS`: Default provider settings
- Added to `DEFAULT_SYSTEM_SETTINGS`

### 4. User Interface

Created `/apps/readest-app/src/app/library/components/StorageProviderSettings.tsx`:

- Dialog-based settings interface
- Provider selection dropdown
- WebDAV connection form (URL, username, password, base path)
- Google Drive connection interface
- Connection testing and status display
- Enable/disable functionality for each provider

Updated `/apps/readest-app/src/app/library/components/SettingsMenu.tsx`:

- Added "Storage Provider" menu item
- Integrated with storage provider settings dialog

Updated `/apps/readest-app/src/app/library/page.tsx`:

- Added `StorageProviderSettingsWindow` component to library page

### 5. Dependencies

Added to `/apps/readest-app/package.json`:

- `webdav`: ^5.8.0 - WebDAV client library
- `googleapis`: Already present in dependencies

## Features

### WebDAV Support

- **Server Configuration**: Connect to any WebDAV-compatible server (Nextcloud, ownCloud, etc.)
- **Authentication**: Username/password authentication
- **Base Path**: Configurable base directory on the server
- **Connection Testing**: Verify server connectivity before enabling
- **File Operations**: Upload, download, delete, list files
- **Directory Management**: Automatic directory creation

### Google Drive Support

- **OAuth2 Authentication**: Secure OAuth2 flow (to be implemented)
- **Folder Selection**: Choose specific folder or use root
- **File Operations**: Upload, download, delete, list files
- **Directory Navigation**: Hierarchical folder support

## Usage

1. **Access Settings**: Click on the settings menu in the library view
2. **Select Storage Provider**: Choose "Storage Provider" from the menu
3. **Configure Provider**:
   - For WebDAV: Enter server URL, username, password, and base path
   - For Google Drive: Complete OAuth flow and select folder
4. **Test Connection**: Click connect button to verify settings
5. **Enable Provider**: Once connected, the provider becomes active

## Known Limitations & Future Work

### 1. Google Drive OAuth Flow

The Google Drive OAuth2 authentication flow is not yet fully implemented. To complete this:

- Create OAuth2 consent screen in Google Cloud Console
- Add API routes in `/apps/readest-app/src/pages/api/storage/googledrive/`:
  - `auth.ts`: Initiate OAuth flow
  - `callback.ts`: Handle OAuth callback
- Implement token refresh mechanism
- Store tokens securely

### 2. App Service Integration

The storage providers are implemented but not yet integrated with the main app service. To complete integration:

**Modify `/apps/readest-app/src/services/appService.ts`**:

- Update `uploadBook()` (lines 463-509) to use active storage provider
- Update `downloadBook()` (lines 553-610) to use active storage provider
- Update `deleteBook()` (lines 417-450) to use active storage provider

Example integration:

```typescript
async uploadBook(book: Book) {
  const activeProvider = storageService.getActiveProviderType();

  if (activeProvider === 'readest') {
    // Use existing Readest cloud logic
    await this.uploadFileToCloud(localPath, remotePath);
  } else {
    // Use storage provider service
    await storageService.uploadFile(localPath, remotePath, onProgress);
  }
}
```

### 3. File System Access API

The download methods in WebDAV and Google Drive providers currently create download links. For better UX, implement:

- File System Access API for browser environments
- Tauri file system API for desktop apps
- Proper file saving with progress tracking

### 4. Settings Migration

When existing users upgrade, ensure:

- Default storage provider is set to 'readest'
- Existing books continue to work without migration
- Clear migration path if users want to switch providers

### 5. Testing

Comprehensive testing needed for:

- WebDAV connection with various servers (Nextcloud, ownCloud, etc.)
- Google Drive OAuth flow
- File upload/download with progress tracking
- Error handling and retry logic
- Network failure scenarios
- Large file transfers
- Concurrent operations

### 6. Security Considerations

- **Password Storage**: WebDAV passwords should be encrypted before storage
- **Token Storage**: Google Drive tokens need secure storage
- **HTTPS**: Enforce HTTPS for WebDAV connections
- **Input Validation**: Validate all user inputs

### 7. Performance Optimizations

- Implement chunked uploads for large files
- Add caching layer for frequently accessed files
- Implement resumable uploads/downloads
- Add bandwidth throttling options

### 8. Additional Features

- **Sync Conflict Resolution**: Handle conflicts when files are modified on multiple devices
- **Selective Sync**: Allow users to choose which books to sync
- **Background Sync**: Implement background synchronization
- **Offline Mode**: Better offline support with queue management
- **Multi-Provider**: Support multiple providers simultaneously

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
│           ├── webdav.ts
│           └── googledrive.ts
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

1. **WebDAV Testing**:
   ```bash
   # Set up a local WebDAV server for testing
   docker run -d -p 8080:80 bytemark/webdav

   # Configure in Readest:
   # - URL: http://localhost:8080
   # - Username: user
   # - Password: password
   ```

2. **Google Drive Testing**:
   - Complete OAuth implementation first
   - Create test Google Cloud project
   - Enable Google Drive API
   - Test with limited scope folder

## Notes

- The implementation follows Readest's existing patterns (translator providers, metadata providers)
- All providers implement the same interface for consistency
- The UI follows Readest's design system (DaisyUI components)
- Settings are persisted using the existing settings store
- The implementation is extensible - new providers can be added easily

## Next Steps

1. Complete Google Drive OAuth implementation
2. Integrate storage providers with app service
3. Implement File System Access API for downloads
4. Add encryption for sensitive credentials
5. Comprehensive testing with real servers
6. Add error recovery and retry logic
7. Implement progress tracking for large transfers
8. Add documentation for users
