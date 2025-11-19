'use client';

import clsx from 'clsx';
import React, { useState, useEffect, useCallback } from 'react';
import { useEnv } from '@/context/EnvContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useSettingsStore } from '@/store/settingsStore';
import { StorageProviderType } from '@/types/settings';
import { debounce } from '@/utils/debounce';
import Dialog from '@/components/Dialog';

type Option = {
  value: string;
  label: string;
  disabled?: boolean;
};

type SelectProps = {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: Option[];
  disabled?: boolean;
  className?: string;
};

const StyledSelect: React.FC<SelectProps> = ({
  value,
  onChange,
  options,
  className,
  disabled = false,
}) => {
  return (
    <select
      value={value}
      onChange={onChange}
      className={clsx(
        'select select-bordered h-12 w-full text-sm focus:outline-none focus:ring-0',
        className,
      )}
      disabled={disabled}
    >
      {options.map(({ value, label, disabled = false }) => (
        <option key={value} value={value} disabled={disabled}>
          {label}
        </option>
      ))}
    </select>
  );
};

export const setStorageProviderSettingsWindowVisible = (visible: boolean) => {
  const dialog = document.getElementById('storage_provider_settings_window');
  if (dialog) {
    const event = new CustomEvent('setStorageProviderSettingsVisibility', {
      detail: { visible },
    });
    dialog.dispatchEvent(event);
  }
};

export const StorageProviderSettingsWindow: React.FC = () => {
  const _ = useTranslation();
  const { settings, setSettings, saveSettings } = useSettingsStore();
  const { envConfig } = useEnv();

  const [isOpen, setIsOpen] = useState(false);
  const [activeProvider, setActiveProvider] = useState<StorageProviderType>(
    settings.storageProvider?.activeProvider || 'readest',
  );

  // WebDAV state
  const [webdavEnabled, setWebdavEnabled] = useState(
    settings.storageProvider?.webdav?.enabled || false,
  );
  const [webdavUrl, setWebdavUrl] = useState(
    settings.storageProvider?.webdav?.serverUrl || '',
  );
  const [webdavUsername, setWebdavUsername] = useState(
    settings.storageProvider?.webdav?.username || '',
  );
  const [webdavPassword, setWebdavPassword] = useState('');
  const [webdavBasePath, setWebdavBasePath] = useState(
    settings.storageProvider?.webdav?.basePath || '/Readest',
  );

  // Connection state
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('');

  useEffect(() => {
    const handleCustomEvent = (event: CustomEvent) => {
      setIsOpen(event.detail.visible);
      if (event.detail.visible) {
        // Reset form when opening
        setActiveProvider(settings.storageProvider?.activeProvider || 'readest');
        setWebdavEnabled(settings.storageProvider?.webdav?.enabled || false);
        setWebdavUrl(settings.storageProvider?.webdav?.serverUrl || '');
        setWebdavUsername(settings.storageProvider?.webdav?.username || '');
        setWebdavPassword('');
        setWebdavBasePath(settings.storageProvider?.webdav?.basePath || '/Readest');
        setConnectionStatus('');
      }
    };
    const el = document.getElementById('storage_provider_settings_window');
    el?.addEventListener(
      'setStorageProviderSettingsVisibility',
      handleCustomEvent as EventListener,
    );
    return () => {
      el?.removeEventListener(
        'setStorageProviderSettingsVisibility',
        handleCustomEvent as EventListener,
      );
    };
  }, [settings.storageProvider]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSaveSettings = useCallback(
    debounce((newSettings) => {
      setSettings(newSettings);
      saveSettings(envConfig, newSettings);
    }, 500),
    [setSettings, saveSettings, envConfig],
  );

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProvider = e.target.value as StorageProviderType;
    setActiveProvider(newProvider);

    const newSettings = {
      ...settings,
      storageProvider: {
        ...settings.storageProvider,
        activeProvider: newProvider,
      },
    };
    debouncedSaveSettings(newSettings);
  };

  const handleWebDAVConnect = async () => {
    if (!webdavUrl || !webdavUsername || !webdavPassword) {
      setConnectionStatus('error:Please fill in all WebDAV fields');
      return;
    }

    setIsConnecting(true);
    setConnectionStatus('connecting');

    try {
      // Dynamically import storage service to avoid SSR issues
      const { storageService } = await import('@/services/storage');

      const result = await storageService.setActiveProvider('webdav', {
        webdav: {
          url: webdavUrl,
          username: webdavUsername,
          password: webdavPassword,
          basePath: webdavBasePath,
        },
      });

      if (result.success) {
        setConnectionStatus('success:Connected to WebDAV server');

        // Save settings
        const newSettings = {
          ...settings,
          storageProvider: {
            ...settings.storageProvider,
            activeProvider: 'webdav' as StorageProviderType,
            webdav: {
              enabled: true,
              serverUrl: webdavUrl,
              username: webdavUsername,
              password: webdavPassword,
              basePath: webdavBasePath,
            },
          },
        };
        setSettings(newSettings);
        saveSettings(envConfig, newSettings);
        setWebdavEnabled(true);
        setActiveProvider('webdav');
      } else {
        setConnectionStatus(`error:${result.error || 'Connection failed'}`);
      }
    } catch (error) {
      setConnectionStatus(
        `error:${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisableWebDAV = () => {
    const newSettings = {
      ...settings,
      storageProvider: {
        ...settings.storageProvider,
        activeProvider: 'readest' as StorageProviderType,
        webdav: {
          ...settings.storageProvider.webdav,
          enabled: false,
        },
      },
    };
    setSettings(newSettings);
    saveSettings(envConfig, newSettings);
    setWebdavEnabled(false);
    setActiveProvider('readest');
    setConnectionStatus('');
  };

  const providerOptions: Option[] = [
    { value: 'readest', label: 'Readest Cloud' },
    { value: 'webdav', label: 'WebDAV', disabled: !webdavEnabled },
  ];

  const renderConnectionStatus = () => {
    if (!connectionStatus) return null;

    const [type, message] = connectionStatus.split(':');
    const statusClasses = {
      connecting: 'bg-blue-100 text-blue-800',
      success: 'bg-green-100 text-green-800',
      error: 'bg-red-100 text-red-800',
      info: 'bg-yellow-100 text-yellow-800',
    };

    return (
      <div className={clsx('rounded-md p-3 text-sm', statusClasses[type as keyof typeof statusClasses])}>
        {message || connectionStatus}
      </div>
    );
  };

  return (
    <Dialog
      id='storage_provider_settings_window'
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      title={_('Storage Provider Settings')}
      className='max-w-2xl'
    >
      <div className='space-y-6'>
        {/* Active Provider Selection */}
        <div>
          <label className='mb-2 block text-sm font-medium'>
            {_('Active Storage Provider')}
          </label>
          <StyledSelect
            value={activeProvider}
            onChange={handleProviderChange}
            options={providerOptions}
          />
          <p className='mt-2 text-xs text-gray-500'>
            {_('Select the storage provider for your books and data')}
          </p>
        </div>

        {renderConnectionStatus()}

        {/* WebDAV Settings */}
        <div className='border-t pt-4'>
          <div className='mb-4 flex items-center justify-between'>
            <h3 className='text-lg font-medium'>{_('WebDAV')}</h3>
            {webdavEnabled && (
              <button
                onClick={handleDisableWebDAV}
                className='btn btn-error btn-sm'
              >
                {_('Disable')}
              </button>
            )}
          </div>

          {!webdavEnabled ? (
            <div className='space-y-4'>
              <div>
                <label className='mb-2 block text-sm font-medium'>
                  {_('Server URL')}
                </label>
                <input
                  type='text'
                  value={webdavUrl}
                  onChange={(e) => setWebdavUrl(e.target.value)}
                  placeholder='https://cloud.example.com/remote.php/dav/files/username'
                  className='input input-bordered w-full'
                />
              </div>

              <div>
                <label className='mb-2 block text-sm font-medium'>
                  {_('Username')}
                </label>
                <input
                  type='text'
                  value={webdavUsername}
                  onChange={(e) => setWebdavUsername(e.target.value)}
                  className='input input-bordered w-full'
                />
              </div>

              <div>
                <label className='mb-2 block text-sm font-medium'>
                  {_('Password')}
                </label>
                <input
                  type='password'
                  value={webdavPassword}
                  onChange={(e) => setWebdavPassword(e.target.value)}
                  className='input input-bordered w-full'
                />
              </div>

              <div>
                <label className='mb-2 block text-sm font-medium'>
                  {_('Base Path')}
                </label>
                <input
                  type='text'
                  value={webdavBasePath}
                  onChange={(e) => setWebdavBasePath(e.target.value)}
                  placeholder='/Readest'
                  className='input input-bordered w-full'
                />
              </div>

              <button
                onClick={handleWebDAVConnect}
                disabled={isConnecting}
                className='btn btn-primary w-full'
              >
                {isConnecting ? _('Connecting...') : _('Connect WebDAV')}
              </button>
            </div>
          ) : (
            <div className='rounded-md bg-green-50 p-4'>
              <p className='text-sm text-green-800'>
                {_('WebDAV is connected and active')}
              </p>
              <p className='mt-1 text-xs text-green-600'>
                {_('Server')}: {webdavUrl}
              </p>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
};
