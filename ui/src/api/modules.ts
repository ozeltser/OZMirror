/**
 * Axios client for individual module REST APIs.
 * Modules are proxied through Nginx at /api/modules/<moduleId>.
 */

import axios from 'axios';

export interface ModuleHealthResponse {
  status: string;
  uptime: number;
  version: string;
}

export interface ModuleDataResponse<T = unknown> {
  [key: string]: T;
}

export interface ModuleActionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

function moduleClient(moduleId: string) {
  return axios.create({ baseURL: `/api/modules/${moduleId}` });
}

export async function fetchModuleHealth(moduleId: string): Promise<ModuleHealthResponse> {
  const { data } = await moduleClient(moduleId).get<ModuleHealthResponse>('/health');
  return data;
}

export async function fetchModuleData<T = unknown>(
  moduleId: string,
  instanceId: string
): Promise<T> {
  const { data } = await moduleClient(moduleId).get<T>('/data', {
    params: { instanceId },
  });
  return data;
}

export async function postModuleAction<T = unknown>(
  moduleId: string,
  instanceId: string,
  action: string,
  payload?: Record<string, unknown>
): Promise<ModuleActionResponse<T>> {
  const { data } = await moduleClient(moduleId).post<ModuleActionResponse<T>>('/action', {
    instanceId,
    action,
    payload: payload ?? {},
  });
  return data;
}
