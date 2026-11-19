import type { Activity, Behaviour, Component, ComponentType, Id, PendingRename, Screen, TableConfig } from './types';
import { getAllDisplayNames, autoName, nextFreeIndex } from './naming';

function newId(): Id {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

function touch(activity: Activity): Activity {
  return { ...activity, updatedAt: now() };
}

export function createActivity(title: string): Activity {
  const t = now();
  return {
    schemaVersion: 1,
    id: newId(),
    title,
    createdAt: t,
    updatedAt: t,
    screens: [],
    behaviours: [],
    pendingRenames: [],
    copyState: {},
    dismissedIdeas: [],
  };
}

export function addScreen(activity: Activity): Activity {
  const screen: Screen = { id: newId(), components: [] };
  return touch({ ...activity, screens: [...activity.screens, screen] });
}

export function setScreenCount(activity: Activity, count: number): Activity {
  const current = activity.screens.length;
  if (count === current) return activity;
  if (count > current) {
    let a = activity;
    for (let i = current; i < count; i++) a = addScreen(a);
    return a;
  }
  const removedIds = new Set(
    activity.screens.slice(count).flatMap(s => s.components.map(c => c.id)),
  );
  const screens = activity.screens.slice(0, count);
  const behaviours = pruneBehaviours(activity.behaviours, removedIds);
  const copyState = omitKeys(activity.copyState, removedIds);
  return touch({ ...activity, screens, behaviours, copyState });
}

export function addComponent(
  activity: Activity,
  screenId: Id,
  type: ComponentType,
  tableConfig?: TableConfig,
): Activity {
  const index = nextFreeIndex(activity, screenId, type);
  const component: Component = {
    id: newId(),
    type,
    name: { kind: 'auto', index },
    ...(tableConfig ? { table: tableConfig } : {}),
  };
  const screens = activity.screens.map(s =>
    s.id === screenId ? { ...s, components: [...s.components, component] } : s,
  );
  return touch({ ...activity, screens });
}

export function removeComponent(activity: Activity, componentId: Id): Activity {
  const screens = activity.screens.map(s => ({
    ...s,
    components: s.components.filter(c => c.id !== componentId),
  }));
  const behaviours = pruneBehaviours(activity.behaviours, new Set([componentId]));
  const copyState = omitKeys(activity.copyState, new Set([componentId]));
  return touch({ ...activity, screens, behaviours, copyState });
}

export function removeHighestIndexedAutoComponent(
  activity: Activity,
  screenId: Id,
  type: ComponentType,
): Activity {
  const screen = activity.screens.find(s => s.id === screenId);
  if (!screen) return activity;
  const candidates = screen.components.filter(c => c.type === type && c.name.kind === 'auto');
  if (candidates.length === 0) return activity;
  const highest = candidates.reduce((a, b) =>
    (b.name as Extract<Component['name'], { kind: 'auto' }>).index >
    (a.name as Extract<Component['name'], { kind: 'auto' }>).index
      ? b
      : a,
  );
  return removeComponent(activity, highest.id);
}

export function setActivityTitle(activity: Activity, title: string): Activity {
  return touch({ ...activity, title });
}

export function renameComponent(
  activity: Activity,
  componentId: Id,
  newName: string,
): Activity {
  const oldName = getAllDisplayNames(activity).get(componentId);
  if (!oldName || oldName === newName) return activity;

  const screens = activity.screens.map(s => ({
    ...s,
    components: s.components.map(c =>
      c.id === componentId ? { ...c, name: { kind: 'custom' as const, value: newName } } : c,
    ),
  }));

  const rename: PendingRename = { componentId, oldName, newName, doneInDesmos: false };
  return touch({ ...activity, screens, pendingRenames: [...activity.pendingRenames, rename] });
}

function pruneBehaviours(behaviours: Behaviour[], removedIds: Set<Id>): Behaviour[] {
  return behaviours.filter(b => {
    if (b.kind === 'feedback') {
      if (removedIds.has(b.source)) return false;
      if (b.mode === 'input' && removedIds.has(b.target)) return false;
      return true;
    }
    if (b.kind === 'carry') {
      return !removedIds.has(b.source) && !removedIds.has(b.destination);
    }
    if (b.kind === 'showHide') {
      return !removedIds.has(b.target) && !removedIds.has(b.trigger.input);
    }
    return true;
  });
}

function omitKeys<T>(record: Record<Id, T>, ids: Set<Id>): Record<Id, T> {
  const result = { ...record };
  for (const id of ids) delete result[id];
  return result;
}

export function markCopied(activity: Activity, componentId: Id, hash: string): Activity {
  return {
    ...activity,
    copyState: { ...activity.copyState, [componentId]: { lastCopiedHash: hash } },
    updatedAt: now(),
  };
}

export function moveComponent(
  activity: Activity,
  componentId: Id,
  targetScreenId: Id,
  newName?: string,
): Activity {
  let comp: Component | undefined;
  let sourceScreenId: Id | undefined;
  for (const screen of activity.screens) {
    const c = screen.components.find(c => c.id === componentId);
    if (c) { comp = c; sourceScreenId = screen.id; break; }
  }
  if (!comp || !sourceScreenId || sourceScreenId === targetScreenId) return activity;

  const displayNames = getAllDisplayNames(activity);
  const oldName = displayNames.get(componentId) ?? componentId;

  // Remove from old screen first
  let screens = activity.screens.map(s => ({
    ...s,
    components: s.components.filter(c => c.id !== componentId),
  }));

  let updatedComp: Component = comp;
  let resolvedNewName = oldName;

  if (newName !== undefined) {
    updatedComp = { ...comp, name: { kind: 'custom', value: newName } };
    resolvedNewName = newName;
  } else if (comp.name.kind === 'auto') {
    const tempActivity = { ...activity, screens };
    const newIndex = nextFreeIndex(tempActivity, targetScreenId, comp.type);
    const targetScreenNum = screens.findIndex(s => s.id === targetScreenId) + 1;
    updatedComp = { ...comp, name: { kind: 'auto', index: newIndex } };
    resolvedNewName = autoName(comp.type, targetScreenNum, newIndex);
  }

  screens = screens.map(s =>
    s.id === targetScreenId
      ? { ...s, components: [...s.components, updatedComp] }
      : s,
  );

  const pendingRenames: PendingRename[] = resolvedNewName !== oldName
    ? [...activity.pendingRenames, { componentId, oldName, newName: resolvedNewName, doneInDesmos: false }]
    : activity.pendingRenames;

  return touch({ ...activity, screens, pendingRenames });
}

export function reorderScreens(activity: Activity, fromIndex: number, toIndex: number): Activity {
  if (fromIndex === toIndex) return activity;
  const screens = [...activity.screens];
  const [moved] = screens.splice(fromIndex, 1);
  screens.splice(toIndex, 0, moved);

  const oldNumbers = new Map<Id, number>();
  activity.screens.forEach((s, i) => oldNumbers.set(s.id, i + 1));
  const newNumbers = new Map<Id, number>();
  screens.forEach((s, i) => newNumbers.set(s.id, i + 1));

  const displayNames = getAllDisplayNames(activity);
  const newPendingRenames: PendingRename[] = [];

  screens.forEach(screen => {
    const oldNum = oldNumbers.get(screen.id)!;
    const newNum = newNumbers.get(screen.id)!;
    if (oldNum === newNum) return;
    screen.components.forEach(comp => {
      if (comp.name.kind !== 'auto') return;
      const oldN = displayNames.get(comp.id) ?? comp.id;
      const newN = autoName(comp.type, newNum, comp.name.index);
      if (oldN !== newN) {
        newPendingRenames.push({ componentId: comp.id, oldName: oldN, newName: newN, doneInDesmos: false });
      }
    });
  });

  // Clear all copy hashes since names in generated code may have changed
  const clearedCopyState: Activity['copyState'] = {};
  for (const id of Object.keys(activity.copyState)) {
    clearedCopyState[id] = {};
  }

  return touch({
    ...activity,
    screens,
    pendingRenames: [...activity.pendingRenames, ...newPendingRenames],
    copyState: clearedCopyState,
  });
}
