/**
 * Hook for loading and saving the layout from/to the Config Service.
 */

import { useState, useEffect, useCallback } from 'react';
import { fetchLayout, saveLayout, setActiveProfile } from '../api/config';
import { useAppStore } from '../store/appStore';
import type { LayoutData } from '../types';

interface UseLayoutResult {
  layout: LayoutData | null;
  isLoading: boolean;
  error: Error | null;
  persistLayout: (layout: LayoutData) => Promise<void>;
  switchProfile: (name: string) => Promise<void>;
  refreshLayout: () => Promise<void>;
}

export function useLayout(): UseLayoutResult {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { layout, setLayout } = useAppStore();

  useEffect(() => {
    fetchLayout()
      .then((data) => {
        setLayout(data);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
      });
  }, [setLayout]);

  const persistLayout = useCallback(async (updatedLayout: LayoutData) => {
    setLayout(updatedLayout);
    try {
      await saveLayout(updatedLayout);
    } catch (err) {
      console.error('[useLayout] Failed to save layout:', err);
    }
  }, [setLayout]);

  const switchProfile = useCallback(async (name: string) => {
    if (!layout) return;
    if (!(name in layout.layouts)) {
      console.error('[useLayout] Cannot switch to profile "%s": not found in layouts', name);
      return;
    }
    try {
      await setActiveProfile(name);
      const updated: LayoutData = { ...layout, activeProfile: name };
      setLayout(updated);
    } catch (err) {
      console.error('[useLayout] Failed to persist active profile:', err);
    }
  }, [layout, setLayout]);

  const refreshLayout = useCallback(async () => {
    try {
      const data = await fetchLayout();
      setLayout(data);
    } catch (err) {
      console.error('[useLayout] Failed to refresh layout:', err);
    }
  }, [setLayout]);

  return { layout, isLoading, error, persistLayout, switchProfile, refreshLayout };
}
