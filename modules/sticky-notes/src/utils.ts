/**
 * Shared utilities for the Sticky Notes module.
 */

export const INSTANCE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function validateInstanceId(instanceId: unknown): instanceId is string {
  return typeof instanceId === 'string' && INSTANCE_ID_PATTERN.test(instanceId);
}
