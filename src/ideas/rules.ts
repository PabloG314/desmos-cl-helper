import type { Activity, Id } from '../model/types';
import { getAllDisplayNames } from '../model/naming';

export interface Idea {
  key: string;
  description: string;
  screenDistance: number;
  action: 'addInputFeedback' | 'addTableFeedback' | 'addShowHide' | 'addCarryForward';
  componentId: Id;
  relatedComponentId?: Id;
}

export function generateIdeas(activity: Activity): Idea[] {
  const ideas: Idea[] = [];
  const names = getAllDisplayNames(activity);

  const screenOf = new Map<Id, number>();
  activity.screens.forEach((s, si) => s.components.forEach(c => screenOf.set(c.id, si)));

  const hasBehaviour = new Set<Id>();
  for (const b of activity.behaviours) {
    if (b.kind === 'feedback') { hasBehaviour.add(b.source); if (b.mode === 'input') hasBehaviour.add(b.target); }
    if (b.kind === 'carry') { hasBehaviour.add(b.source); hasBehaviour.add(b.destination); }
    if (b.kind === 'showHide') { hasBehaviour.add(b.target); hasBehaviour.add(b.trigger.input); }
  }

  // Math input with no feedback → suggest adding feedback
  for (const screen of activity.screens) {
    for (const comp of screen.components) {
      if (comp.type === 'math' && !hasBehaviour.has(comp.id)) {
        const n = names.get(comp.id) ?? comp.id;
        ideas.push({
          key: `no-feedback:${comp.id}`,
          description: `Add feedback to \`${n}\`?`,
          screenDistance: 0,
          action: 'addInputFeedback',
          componentId: comp.id,
        });
      }
      if (comp.type === 'table' && comp.table && comp.table.editableColumns.length > 0 && !hasBehaviour.has(comp.id)) {
        const n = names.get(comp.id) ?? comp.id;
        ideas.push({
          key: `no-table-feedback:${comp.id}`,
          description: `Check answers in \`${n}\` cell by cell?`,
          screenDistance: 0,
          action: 'addTableFeedback',
          componentId: comp.id,
        });
      }
    }
  }

  // Math input on earlier screen, graph on later screen, no link
  const mathInputs = activity.screens.flatMap((s, si) =>
    s.components.filter(c => c.type === 'math').map(c => ({ comp: c, si }))
  );
  const graphs = activity.screens.flatMap((s, si) =>
    s.components.filter(c => c.type === 'graph').map(c => ({ comp: c, si }))
  );

  for (const { comp: src, si: ssi } of mathInputs) {
    for (const { comp: dst, si: dsi } of graphs) {
      if (ssi >= dsi) continue;
      const alreadyLinked = activity.behaviours.some(
        b => b.kind === 'carry' && b.source === src.id && b.destination === dst.id
      );
      if (!alreadyLinked) {
        const srcN = names.get(src.id) ?? src.id;
        const dstN = names.get(dst.id) ?? dst.id;
        ideas.push({
          key: `carry:${src.id}:${dst.id}`,
          description: `Plot \`${srcN}\` on \`${dstN}\`?`,
          screenDistance: dsi - ssi,
          action: 'addCarryForward',
          componentId: src.id,
          relatedComponentId: dst.id,
        });
      }
    }
  }

  // Math input with feedback + a note on the same screen with no behaviour → suggest show/hide
  for (const screen of activity.screens) {
    const mathsWithFeedback = screen.components.filter(c =>
      c.type === 'math' && activity.behaviours.some(b => b.kind === 'feedback' && b.source === c.id)
    );
    const freeNotes = screen.components.filter(c =>
      c.type === 'note' && !hasBehaviour.has(c.id)
    );
    for (const math of mathsWithFeedback) {
      for (const note of freeNotes) {
        const mathN = names.get(math.id) ?? math.id;
        const noteN = names.get(note.id) ?? note.id;
        ideas.push({
          key: `hint-reveal:${math.id}:${note.id}`,
          description: `Reveal \`${noteN}\` as a hint after a submit on \`${mathN}\`?`,
          screenDistance: 0,
          action: 'addShowHide',
          componentId: note.id,
          relatedComponentId: math.id,
        });
      }
    }
  }

  // Filter dismissed and sort by screen distance (closer first)
  return ideas
    .filter(idea => !activity.dismissedIdeas.includes(idea.key))
    .sort((a, b) => a.screenDistance - b.screenDistance)
    .slice(0, 2); // show at most 2 at a time
}
