/**
 * Module Registry — loads available modules from the Config Service
 * and maintains a map from moduleId → React widget component.
 */

import { fetchModules } from '../api/config';
import type { RegisteredModule } from '../types';

class ModuleRegistry {
  private modules: Map<string, RegisteredModule> = new Map();

  async load(): Promise<RegisteredModule[]> {
    const list = await fetchModules();
    this.modules.clear();
    for (const mod of list) {
      this.modules.set(mod.id, mod);
    }
    return list;
  }

  get(id: string): RegisteredModule | undefined {
    return this.modules.get(id);
  }

  all(): RegisteredModule[] {
    return Array.from(this.modules.values());
  }
}

export const moduleRegistry = new ModuleRegistry();
