import type { Activity } from '../model/types';

export function migrate(data: unknown): Activity {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Invalid activity data');
  }
  const obj = data as Record<string, unknown>;
  if (obj['schemaVersion'] !== 1) {
    throw new Error(`Unsupported schema version: ${obj['schemaVersion']}`);
  }
  return obj as unknown as Activity;
}
