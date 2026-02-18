/**
 * Hook for fetching module data via REST.
 * Polls at a configurable interval using a simple setInterval pattern.
 * Mirrors the react-query pattern without adding that dependency.
 */

import { useState, useEffect, useRef } from 'react';
import { fetchModuleData } from '../api/modules';

interface UseModuleDataResult<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
}

export function useModuleData<T = unknown>(
  moduleId: string,
  instanceId: string,
  pollInterval = 30_000
): UseModuleDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    async function load() {
      try {
        const result = await fetchModuleData<T>(moduleId, instanceId);
        if (mountedRef.current) {
          setData(result);
          setError(null);
          setIsLoading(false);
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        }
      }
      if (mountedRef.current && pollInterval > 0) {
        timeoutId = setTimeout(load, pollInterval);
      }
    }

    load();

    return () => {
      mountedRef.current = false;
      clearTimeout(timeoutId);
    };
  }, [moduleId, instanceId, pollInterval]);

  return { data, isLoading, error };
}
