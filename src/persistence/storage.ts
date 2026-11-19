import type { Activity, Id } from '../model/types';
import { migrate } from './migrate';

export interface ActivitySummary {
  id: Id;
  title: string;
  updatedAt: string;
  desmosUrl?: string;
}

const INDEX_KEY = 'clhelper:index';
const activityKey = (id: Id) => `clhelper:activity:${id}`;

export function storageAvailable(): boolean {
  try {
    localStorage.setItem('__clhelper_test__', '1');
    localStorage.removeItem('__clhelper_test__');
    return true;
  } catch {
    return false;
  }
}

function getIndex(): ActivitySummary[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    return raw ? (JSON.parse(raw) as ActivitySummary[]) : [];
  } catch {
    return [];
  }
}

function setIndex(index: ActivitySummary[]): void {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch {
    // storage full or unavailable
  }
}

export function saveActivity(activity: Activity): void {
  try {
    localStorage.setItem(activityKey(activity.id), JSON.stringify(activity));
    const index = getIndex().filter(s => s.id !== activity.id);
    index.unshift({
      id: activity.id,
      title: activity.title,
      updatedAt: activity.updatedAt,
      desmosUrl: activity.desmosUrl,
    });
    setIndex(index);
  } catch {
    // storage full or unavailable
  }
}

export function loadActivity(id: Id): Activity | null {
  try {
    const raw = localStorage.getItem(activityKey(id));
    if (!raw) return null;
    return migrate(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function loadIndex(): ActivitySummary[] {
  return getIndex().sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function deleteActivity(id: Id): void {
  try {
    localStorage.removeItem(activityKey(id));
    setIndex(getIndex().filter(s => s.id !== id));
  } catch {
    // storage unavailable
  }
}
