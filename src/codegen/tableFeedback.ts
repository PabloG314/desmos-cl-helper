import type { TableFeedback, Activity, Id } from '../model/types';
import { TEMPLATES, fillTemplate } from './templates';
import { sectionBlock } from './feedback';

export interface TableFeedbackResult {
  section: {
    componentId: Id;
    sinkKeys: string[];
    code: string;
  };
}

export function generateTableFeedback(
  behaviour: TableFeedback,
  _activity: Activity,
): TableFeedbackResult {
  if (behaviour.expectation.mode === 'formula') {
    throw new Error('Formula mode is not yet implemented (UNTESTED — see DESIGN §9.1.3).');
  }
  if (behaviour.tolerance > 0) {
    throw new Error('Tolerance > 0 for table feedback is not yet implemented (UNTESTED — see DESIGN §9.1.3).');
  }

  const values = behaviour.expectation.values;
  const tag = behaviour.id.slice(0, 6);
  const sinkKeys: string[] = [];
  const cellBlocks: string[] = [];

  for (const cell of behaviour.cells) {
    const { row, column } = cell;
    const key = `${row},${column}`;
    const value = values[key];
    if (value === undefined) continue;

    const sinkKey = `cellSuffix(${row},${column})`;
    sinkKeys.push(sinkKey);

    cellBlocks.push(fillTemplate(TEMPLATES.tableCellFeedback.body, {
      row: String(row),
      col: String(column),
      value: String(value),
      correctSuffix: sanitizeSuffix(behaviour.correctSuffix),
      fallbackSuffix: sanitizeSuffix(behaviour.fallbackSuffix),
    }));
  }

  const body = cellBlocks.join('\n\n');
  return {
    section: {
      componentId: behaviour.source,
      sinkKeys,
      code: sectionBlock(tag, 'feedback', body),
    },
  };
}

function sanitizeSuffix(s: string): string {
  return s.replace(/"/g, '“').replace(/\${/g, '\\${');
}
