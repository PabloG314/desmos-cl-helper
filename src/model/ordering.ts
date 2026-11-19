import type { Activity, Id } from './types';
import { getAllDisplayNames, autoName } from './naming';

export interface OrderingProblem {
  behaviourId: Id;
  kind: 'carryBackward' | 'showHideBackward';
  message: string;
}

export function detectOrderingProblems(activity: Activity): OrderingProblem[] {
  const screenIndex = new Map<Id, number>();
  activity.screens.forEach((screen, si) => {
    screen.components.forEach(comp => screenIndex.set(comp.id, si));
  });

  const names = getAllDisplayNames(activity);
  const problems: OrderingProblem[] = [];

  for (const b of activity.behaviours) {
    if (b.kind === 'carry') {
      const srcIdx = screenIndex.get(b.source);
      const dstIdx = screenIndex.get(b.destination);
      if (srcIdx !== undefined && dstIdx !== undefined && srcIdx > dstIdx) {
        const srcName = names.get(b.source) ?? b.source;
        const dstName = names.get(b.destination) ?? b.destination;
        problems.push({
          behaviourId: b.id,
          kind: 'carryBackward',
          message: `\`${srcName}\` is on a later screen than \`${dstName}\`. Students won't have entered a value yet.`,
        });
      }
    }
    if (b.kind === 'showHide') {
      const trigIdx = screenIndex.get(b.trigger.input);
      const tgtIdx = screenIndex.get(b.target);
      if (trigIdx !== undefined && tgtIdx !== undefined && trigIdx > tgtIdx) {
        const trigName = names.get(b.trigger.input) ?? b.trigger.input;
        const tgtName = names.get(b.target) ?? b.target;
        problems.push({
          behaviourId: b.id,
          kind: 'showHideBackward',
          message: `The trigger \`${trigName}\` is on a later screen than \`${tgtName}\`.`,
        });
      }
    }
  }

  return problems;
}

export interface ReorderPreview {
  renameCount: number;
  renames: Array<{ componentId: Id; oldName: string; newName: string }>;
}

export function previewReorder(
  activity: Activity,
  fromIndex: number,
  toIndex: number,
): ReorderPreview {
  if (fromIndex === toIndex) return { renameCount: 0, renames: [] };

  const screens = [...activity.screens];
  const [moved] = screens.splice(fromIndex, 1);
  screens.splice(toIndex, 0, moved);

  const oldNumbers = new Map<Id, number>();
  activity.screens.forEach((s, i) => oldNumbers.set(s.id, i + 1));
  const newNumbers = new Map<Id, number>();
  screens.forEach((s, i) => newNumbers.set(s.id, i + 1));

  const displayNames = getAllDisplayNames(activity);
  const renames: ReorderPreview['renames'] = [];

  screens.forEach(screen => {
    const oldNum = oldNumbers.get(screen.id)!;
    const newNum = newNumbers.get(screen.id)!;
    if (oldNum === newNum) return;
    screen.components.forEach(comp => {
      if (comp.name.kind !== 'auto') return;
      const oldName = displayNames.get(comp.id) ?? comp.id;
      const newName = autoName(comp.type, newNum, comp.name.index);
      if (oldName !== newName) renames.push({ componentId: comp.id, oldName, newName });
    });
  });

  return { renameCount: renames.length, renames };
}
