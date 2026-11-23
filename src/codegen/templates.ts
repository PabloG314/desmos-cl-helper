export interface Template {
  id: string;
  description: string;
  sinkKeys: string[];
  tested: boolean;
  body: string; // {{placeholder}} style
}

/** Fill a template body with a string-replacement map. */
export function fillTemplate(body: string, params: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (key in params) return params[key];
    throw new Error(`Missing template param: ${key}`);
  });
}

export const TEMPLATES: Record<string, Template> = {
  inputDashboardCorrect: {
    id: 'inputDashboardCorrect',
    description: 'Mark a math response correct on the dashboard',
    sinkKeys: ['correct'],
    tested: true,
    body: 'correct: {{correctExpr}}',
  },

  inputFeedbackNote: {
    id: 'inputFeedbackNote',
    description: 'Show feedback in a note after a math response is submitted',
    sinkKeys: ['hidden', 'content'],
    tested: true,
    body: [
      '{{variables}}',
      '',
      'hidden: not({{inputName}}.submitted)',
      'content:',
      '{{whenChain}}',
    ].join('\n'),
  },

  showHideOnSubmit: {
    id: 'showHideOnSubmit',
    description: 'Reveal a component once the student has submitted (stays visible)',
    sinkKeys: ['hidden'],
    tested: true,
    body: 'hidden: {{inputName}}.submitCount < 1',
  },

  tableCellFeedback: {
    id: 'tableCellFeedback',
    description: 'Per-cell suffix feedback in a table (exact value, tolerance = 0)',
    sinkKeys: [], // dynamic: cellSuffix(r,c)
    tested: true,
    body: [
      'cellSuffix({{row}},{{col}}):',
      '  when isBlank(this.cellContent({{row}},{{col}})) or this.cellHasFocus({{row}},{{col}}) ""',
      '  when this.cellNumericValue({{row}},{{col}}) = {{value}} "{{correctSuffix}}"',
      '  otherwise "{{fallbackSuffix}}"',
    ].join('\n'),
  },

  carryMathToGraphFunction: {
    id: 'carryMathToGraphFunction',
    description: 'Carry a math response expression into a graph as a function',
    sinkKeys: [], // dynamic: function("name")
    tested: true,
    body: 'function("{{funcName}}"): simpleFunction({{sourceName}}.latex, "x")',
  },

  carryMathToGraphNumber: {
    id: 'carryMathToGraphNumber',
    description: 'Carry a math response numeric value into a graph as a number variable',
    sinkKeys: [], // dynamic: number("name")
    tested: true,
    body: 'number("{{varName}}"): {{sourceName}}.numericValue',
  },
};
