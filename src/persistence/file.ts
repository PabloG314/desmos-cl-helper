import type { Activity } from '../model/types';
import { migrate } from './migrate';

export function exportActivity(activity: Activity): void {
  const json = JSON.stringify(activity, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slugify(activity.title)}.clhelper.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importActivityFromJson(json: string): Activity {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('File is not valid JSON.');
  }
  if (typeof raw !== 'object' || raw === null || !('schemaVersion' in raw)) {
    throw new Error('File does not look like a CL Helper activity.');
  }
  return migrate(raw as Record<string, unknown>);
}

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'activity';
}
