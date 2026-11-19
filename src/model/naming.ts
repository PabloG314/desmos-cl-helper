import type { Activity, Component, ComponentType, Id } from './types';

export const TYPE_CODES: Record<ComponentType, string> = {
  note: 'note',
  math: 'math',
  text: 'text',
  mc: 'mc',
  check: 'check',
  table: 'table',
  graph: 'graph',
  sketch: 'sketch',
  button: 'button',
  image: 'image',
};

export function autoName(type: ComponentType, screenNumber: number, index: number): string {
  return `s${screenNumber}_${TYPE_CODES[type]}${index}`;
}

export function getDisplayName(component: Component, screenNumber: number): string {
  if (component.name.kind === 'custom') return component.name.value;
  return autoName(component.type, screenNumber, component.name.index);
}

export function getScreenNumber(activity: Activity, screenId: Id): number {
  return activity.screens.findIndex(s => s.id === screenId) + 1;
}

export function getAllDisplayNames(activity: Activity): Map<Id, string> {
  const map = new Map<Id, string>();
  activity.screens.forEach((screen, si) => {
    screen.components.forEach(comp => {
      map.set(comp.id, getDisplayName(comp, si + 1));
    });
  });
  return map;
}

const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

export function validateComponentName(
  name: string,
  activity: Activity,
  excludeId?: Id,
): string | null {
  if (!NAME_PATTERN.test(name)) {
    return 'Name must start with a letter and contain only letters, digits, and underscores.';
  }
  const lower = name.toLowerCase();
  for (const [id, displayName] of getAllDisplayNames(activity)) {
    if (id !== excludeId && displayName.toLowerCase() === lower) {
      return `"${name}" is already used by another component.`;
    }
  }
  return null;
}

export function nextFreeIndex(activity: Activity, screenId: Id, type: ComponentType): number {
  const screen = activity.screens.find(s => s.id === screenId);
  if (!screen) return 1;
  const usedIndices = new Set(
    screen.components
      .filter(c => c.type === type && c.name.kind === 'auto')
      .map(c => (c.name as Extract<Component['name'], { kind: 'auto' }>).index),
  );
  let i = 1;
  while (usedIndices.has(i)) i++;
  return i;
}
