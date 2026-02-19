/**
 * Hook for reading and updating global settings from the Config Service.
 */

import { useState, useEffect } from 'react';
import { fetchSettings, saveSettings } from '../api/config';
import { useAppStore } from '../store/appStore';
import type { GlobalSettings } from '../types';

interface UseConfigResult {
  settings: GlobalSettings | null;
  isLoading: boolean;
  updateSettings: (settings: GlobalSettings) => Promise<void>;
}

export function useConfig(): UseConfigResult {
  const [isLoading, setIsLoading] = useState(true);
  const { settings, setSettings } = useAppStore();

  useEffect(() => {
    fetchSettings()
      .then((data) => {
        setSettings(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('[useConfig] Failed to fetch settings:', err);
        setIsLoading(false);
      });
  }, [setSettings]);

  const updateSettings = async (updated: GlobalSettings) => {
    setSettings(updated);
    await saveSettings(updated);
  };

  return { settings, isLoading, updateSettings };
}
