/**
 * Hook for loading and saving the layout from/to the Config Service.
 */

import { useState, useEffect } from 'react';
import { fetchLayout, saveLayout } from '../api/config';
import { useAppStore } from '../store/appStore';
import type { LayoutData } from '../types';

interface UseLayoutResult {
  layout: LayoutData | null;
  isLoading: boolean;
  error: Error | null;
  persistLayout: (layout: LayoutData) => Promise<void>;
  switchProfile: (name: string) => Promise<void>;
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

  const persistLayout = async (updatedLayout: LayoutData) => {
    setLayout(updatedLayout);
    try {
      await saveLayout(updatedLayout);
    } catch (err) {
      console.error('[useLayout] Failed to save layout:', err);
    }
  };

  const switchProfile = async (name: string) => {
    if (!layout) return;
    const updated: LayoutData = { ...layout, activeProfile: name };
    await persistLayout(updated);
  };

  return { layout, isLoading, error, persistLayout, switchProfile };
}
