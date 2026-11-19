import type { Activity, Id } from '../model/types';
import { getAllDisplayNames } from '../model/naming';
import { generateInputFeedback } from './feedback';
import { generateTableFeedback } from './tableFeedback';
import { generateCarryForward } from './carryForward';
import { generateShowHide } from './showHide';
import { hashString } from './hash';

export interface ComponentScript {
  componentId: Id;
  /** Human-readable paste location, e.g. "Screen 2 → s2_table1 → CL" */
  location: string;
  script: string;
  hash: string;
  setupReminders: string[];
}

export interface GenerateResult {
  scripts: ComponentScript[];
  /** componentId → conflict description */
  conflicts: Map<Id, string>;
}

interface Section {
  sinkKeys: string[];
  code: string;
  setupReminders: string[];
}

export function generateAllScripts(activity: Activity): GenerateResult {
  const names = getAllDisplayNames(activity);
  const conflicts = new Map<Id, string>();

  const sectionsMap = new Map<Id, Section[]>();

  function addSection(componentId: Id, section: Section): void {
    const existing = sectionsMap.get(componentId) ?? [];
    for (const key of section.sinkKeys) {
      const conflicting = existing.find(s => s.sinkKeys.includes(key));
      if (conflicting) {
        conflicts.set(
          componentId,
          `Sink "${key}" is set by more than one behaviour. ` +
            `Use a separate note or resolve the conflict before generating code.`,
        );
        return;
      }
    }
    existing.push(section);
    sectionsMap.set(componentId, existing);
  }

  for (const behaviour of activity.behaviours) {
    if (behaviour.kind === 'feedback' && behaviour.mode === 'input') {
      try {
        const result = generateInputFeedback(behaviour, activity);
        if (result.inputSection) {
          addSection(result.inputSection.componentId, {
            sinkKeys: [result.inputSection.sinkKey],
            code: result.inputSection.code,
            setupReminders: [`Turn on the submit button for \`${names.get(behaviour.source) ?? behaviour.source}\` in Desmos.`],
          });
        }
        addSection(result.noteSection.componentId, {
          sinkKeys: [result.noteSection.sinkKey],
          code: result.noteSection.code,
          setupReminders: [],
        });
      } catch {
        conflicts.set(behaviour.source, `Error generating feedback code.`);
      }
    }

    if (behaviour.kind === 'feedback' && behaviour.mode === 'table') {
      try {
        const result = generateTableFeedback(behaviour, activity);
        addSection(result.section.componentId, {
          sinkKeys: result.section.sinkKeys,
          code: result.section.code,
          setupReminders: [],
        });
      } catch (e) {
        conflicts.set(behaviour.source, (e as Error).message);
      }
    }

    if (behaviour.kind === 'carry') {
      try {
        const result = generateCarryForward(behaviour, activity);
        addSection(result.section.componentId, {
          sinkKeys: result.section.sinkKeys,
          code: result.section.code,
          setupReminders: result.section.setupReminders,
        });
      } catch (e) {
        conflicts.set(behaviour.destination, (e as Error).message);
      }
    }

    if (behaviour.kind === 'showHide') {
      try {
        const section = generateShowHide(behaviour, activity);
        const inputName = names.get(behaviour.trigger.input) ?? behaviour.trigger.input;
        addSection(section.componentId, {
          sinkKeys: [section.sinkKey],
          code: section.code,
          setupReminders: [`Turn on the submit button for \`${inputName}\` in Desmos.`],
        });
      } catch (e) {
        conflicts.set(behaviour.target, (e as Error).message);
      }
    }
  }

  // Assemble scripts in screen/component order
  const scripts: ComponentScript[] = [];

  activity.screens.forEach((screen, si) => {
    screen.components.forEach(comp => {
      const sections = sectionsMap.get(comp.id);
      if (!sections || sections.length === 0) return;
      if (conflicts.has(comp.id)) return;

      const script = sections.map(s => s.code).join('\n\n');
      const reminders = [...new Set(sections.flatMap(s => s.setupReminders))];
      const name = names.get(comp.id) ?? comp.id;

      scripts.push({
        componentId: comp.id,
        location: `Screen ${si + 1} → \`${name}\` → CL`,
        script,
        hash: hashString(script),
        setupReminders: reminders,
      });
    });
  });

  return { scripts, conflicts };
}
