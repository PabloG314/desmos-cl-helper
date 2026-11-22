/**
 * Snapshot tests for the section-11 tested templates.
 * These verify that the generator produces code that is functionally
 * equivalent to the hand-tested CL from DESIGN.md §11.
 */
import { describe, it, expect } from 'vitest';
import {
  createActivity,
  addScreen,
  addComponent,
} from '../src/model/activity';
import type { Activity, InputFeedback, ShowHideBehaviour, TableFeedback, CarryForwardBehaviour } from '../src/model/types';
import { generateInputFeedback } from '../src/codegen/feedback';
import { generateShowHide } from '../src/codegen/showHide';
import { generateTableFeedback } from '../src/codegen/tableFeedback';
import { generateCarryForward } from '../src/codegen/carryForward';
import { intervalExpr } from '../src/codegen/intervals';
import { generateAllScripts } from '../src/codegen/generate';

// ── Test activity layout from DESIGN.md §11 ──────────────────────────────────
// Screen 1: s1_math1 (math, submit on), s1_note1 (note), s1_hint (custom note)
// Screen 2: s2_table1 (table: x=1,2,3; y blank)
// Screen 3: s3_math1 (math equation), s3_math2 (math slope)
// Screen 4: s4_graph1 (graph)

function buildTestActivity(): Activity {
  let a = createActivity('Test Activity');

  // Screen 1
  a = addScreen(a);
  a = addComponent(a, a.screens[0].id, 'math');   // s1_math1
  a = addComponent(a, a.screens[0].id, 'note');   // s1_note1
  a = addComponent(a, a.screens[0].id, 'note');   // s1_note2 (will be renamed to s1_hint)

  // Screen 2
  a = addScreen(a);
  a = addComponent(a, a.screens[1].id, 'table', {  // s2_table1
    rows: 3, columns: 2, editableColumns: [2],
  });

  // Screen 3
  a = addScreen(a);
  a = addComponent(a, a.screens[2].id, 'math');   // s3_math1
  a = addComponent(a, a.screens[2].id, 'math');   // s3_math2

  // Screen 4
  a = addScreen(a);
  a = addComponent(a, a.screens[3].id, 'graph');  // s4_graph1

  return a;
}

describe('intervalExpr', () => {
  it('produces the tested correct-answer expression for t=12, tol=0.001', () => {
    // DESIGN.md §11: "correct: this.numericValue > 11.999 and this.numericValue < 12.001"
    expect(intervalExpr('this.numericValue', 11.999, 12.001))
      .toBe('this.numericValue > 11.999 and this.numericValue < 12.001');
  });

  it('handles negative target symmetrically', () => {
    const expr = intervalExpr('ans', -12.001, -11.999);
    expect(expr).toBe('ans > -12.001 and ans < -11.999');
  });
});

describe('generateInputFeedback', () => {
  it('dashboard correct sink matches tested template', () => {
    const a = buildTestActivity();
    const math1Id = a.screens[0].components[0].id;
    const note1Id = a.screens[0].components[1].id;

    const behaviour: InputFeedback = {
      kind: 'feedback',
      mode: 'input',
      id: 'aabbcc112233',
      source: math1Id,
      target: note1Id,
      correct: 12,
      tolerance: 0.001,
      correctMessage: 'Nice, 3 × 4 = 12.',
      rules: [],
      fallbackMessage: 'Not quite. Try again.',
      setDashboardCorrect: true,
    };

    const result = generateInputFeedback(behaviour, a);

    expect(result.inputSection).not.toBeNull();
    // The inner expression should match the tested template
    expect(result.inputSection!.code).toContain(
      'correct: this.numericValue > 11.999 and this.numericValue < 12.001',
    );
  });

  it('note feedback section contains all expected elements for tested config', () => {
    const a = buildTestActivity();
    const math1Id = a.screens[0].components[0].id;
    const note1Id = a.screens[0].components[1].id;

    // DESIGN.md §11: correct=12, tol=0.001, rules: signError, placeValue [0.1,10], specificValue 7
    const behaviour: InputFeedback = {
      kind: 'feedback',
      mode: 'input',
      id: 'aabbcc112233',
      source: math1Id,
      target: note1Id,
      correct: 12,
      tolerance: 0.001,
      correctMessage: 'Nice, 3 × 4 = 12.',
      rules: [
        { id: 'r1', type: 'signError', message: 'Check your sign. Can multiplying two positive numbers give a negative?' },
        { id: 'r2', type: 'placeValue', factors: [0.1, 10], message: 'Close! Check your place value.' },
        { id: 'r3', type: 'specificValue', value: 7, message: 'It looks like you added. This question asks for a product.' },
      ],
      fallbackMessage: 'Not quite. Try again.',
      setDashboardCorrect: true,
    };

    const result = generateInputFeedback(behaviour, a);
    const code = result.noteSection.code;

    // Must reference s1_math1
    expect(code).toContain('s1_math1');

    // Must contain hidden: sink
    expect(code).toContain('hidden: not(s1_math1.submitted)');

    // Must contain content: sink
    expect(code).toContain('content:');

    // Correct message
    expect(code).toContain('Nice, 3 × 4 = 12.');

    // Sign error range: around -12 with tol 0.001
    expect(code).toContain('-12.001');
    expect(code).toContain('-11.999');

    // Place value: 0.1×12 = 1.2, 10×12 = 120
    expect(code).toContain('1.1999');
    expect(code).toContain('1.2001');
    expect(code).toContain('119.99');
    expect(code).toContain('120.01');

    // Specific value 7
    expect(code).toContain('6.999');
    expect(code).toContain('7.001');

    // Fallback
    expect(code).toContain('Not quite. Try again.');

    // Section markers
    expect(code).toContain('# >>> cl-helper feedback');
    expect(code).toContain('# <<< cl-helper feedback');
  });

  it('no rules produces minimal correct/fallback note', () => {
    const a = buildTestActivity();
    const math1Id = a.screens[0].components[0].id;
    const note1Id = a.screens[0].components[1].id;

    const behaviour: InputFeedback = {
      kind: 'feedback',
      mode: 'input',
      id: 'zzzzzz',
      source: math1Id,
      target: note1Id,
      correct: 5,
      tolerance: 0.001,
      correctMessage: 'Correct!',
      rules: [],
      fallbackMessage: 'Try again.',
      setDashboardCorrect: false,
    };

    const result = generateInputFeedback(behaviour, a);
    expect(result.inputSection).toBeNull();
    const code = result.noteSection.code;
    expect(code).toContain('when');
    expect(code).toContain('Correct!');
    expect(code).toContain('otherwise');
    expect(code).toContain('Try again.');
  });
});

describe('generateShowHide', () => {
  it('submitted trigger matches tested template', () => {
    // DESIGN.md §11: "hidden: s1_math1.submitCount < 1"
    const a = buildTestActivity();
    const math1Id = a.screens[0].components[0].id;
    const hintId  = a.screens[0].components[2].id; // s1_hint (s1_note2 in test)

    const behaviour: ShowHideBehaviour = {
      kind: 'showHide',
      id: 'sh1234',
      target: hintId,
      trigger: { type: 'submitted', input: math1Id },
    };

    const section = generateShowHide(behaviour, a);
    expect(section.componentId).toBe(hintId);
    expect(section.sinkKey).toBe('hidden');
    expect(section.code).toContain('hidden: s1_math1.submitCount < 1');
    expect(section.code).toContain('# >>> cl-helper showHide');
  });

  it('throws for unimplemented trigger types', () => {
    const a = buildTestActivity();
    const math1Id = a.screens[0].components[0].id;
    const hintId  = a.screens[0].components[2].id;

    const behaviour: ShowHideBehaviour = {
      kind: 'showHide',
      id: 'sh9999',
      target: hintId,
      trigger: { type: 'correct', input: math1Id },
    };

    expect(() => generateShowHide(behaviour, a)).toThrow();
  });
});

describe('generateTableFeedback', () => {
  it('produces the tested template for s2_table1 (y = 2x+1, x=1,2,3)', () => {
    const a = buildTestActivity();
    const tableId = a.screens[1].components[0].id; // s2_table1

    const behaviour: TableFeedback = {
      kind: 'feedback',
      mode: 'table',
      id: 'aabbcc112233',
      source: tableId,
      cells: [{ row: 1, column: 2 }, { row: 2, column: 2 }, { row: 3, column: 2 }],
      expectation: { mode: 'perCell', values: { '1,2': 3, '2,2': 5, '3,2': 7 } },
      tolerance: 0,
      correctSuffix: '✅',
      rules: [],
      fallbackSuffix: '❌',
    };

    const result = generateTableFeedback(behaviour, a);
    const code = result.section.code;

    // Section markers
    expect(code).toContain('# >>> cl-helper feedback aabbcc');
    expect(code).toContain('# <<< cl-helper feedback aabbcc');

    // All three cell blocks
    expect(code).toContain('cellSuffix(1,2):');
    expect(code).toContain('cellSuffix(2,2):');
    expect(code).toContain('cellSuffix(3,2):');

    // Blank/focus guard
    expect(code).toContain('when isBlank(this.cellContent(1,2)) or this.cellHasFocus(1,2) ""');

    // Correct value checks
    expect(code).toContain('when this.cellNumericValue(1,2) = 3 "✅"');
    expect(code).toContain('when this.cellNumericValue(2,2) = 5 "✅"');
    expect(code).toContain('when this.cellNumericValue(3,2) = 7 "✅"');

    // Fallback
    expect(code).toContain('otherwise "❌"');

    // Sink keys
    expect(result.section.sinkKeys).toEqual([
      'cellSuffix(1,2)', 'cellSuffix(2,2)', 'cellSuffix(3,2)',
    ]);
  });

  it('throws for formula mode (UNTESTED)', () => {
    const a = buildTestActivity();
    const tableId = a.screens[1].components[0].id;
    const behaviour: TableFeedback = {
      kind: 'feedback',
      mode: 'table',
      id: 'zzz',
      source: tableId,
      cells: [],
      expectation: { mode: 'formula', formula: '2x+1' },
      tolerance: 0,
      correctSuffix: '✅',
      rules: [],
      fallbackSuffix: '❌',
    };
    expect(() => generateTableFeedback(behaviour, a)).toThrow(/UNTESTED/);
  });

  it('throws for tolerance > 0 (UNTESTED)', () => {
    const a = buildTestActivity();
    const tableId = a.screens[1].components[0].id;
    const behaviour: TableFeedback = {
      kind: 'feedback',
      mode: 'table',
      id: 'zzz2',
      source: tableId,
      cells: [{ row: 1, column: 2 }],
      expectation: { mode: 'perCell', values: { '1,2': 3 } },
      tolerance: 0.1,
      correctSuffix: '✅',
      rules: [],
      fallbackSuffix: '❌',
    };
    expect(() => generateTableFeedback(behaviour, a)).toThrow(/UNTESTED/);
  });
});

describe('generateCarryForward', () => {
  it('mathToGraphExpression matches tested template for s3_math1 → s4_graph1', () => {
    const a = buildTestActivity();
    const math1Id = a.screens[2].components[0].id; // s3_math1
    const graphId = a.screens[3].components[0].id; // s4_graph1

    const behaviour: CarryForwardBehaviour = {
      kind: 'carry',
      id: 'ccddee112233',
      source: math1Id,
      destination: graphId,
      mapping: { type: 'mathToGraphExpression', functionName: 'f' },
      fallback: { enabled: false, message: '' },
    };

    const result = generateCarryForward(behaviour, a);
    const code = result.section.code;

    // Section markers
    expect(code).toContain('# >>> cl-helper carry ccddee');
    expect(code).toContain('# <<< cl-helper carry ccddee');

    // Tested template §11
    expect(code).toContain('function("f"): simpleFunction(s3_math1.latex, "x")');

    // Setup reminders
    expect(result.section.setupReminders.some(r => r.includes('y = f(x)'))).toBe(true);
    expect(result.section.sinkKeys).toEqual(['function("f")']);
  });

  it('mathToGraphNumber matches tested template for s3_math2 → s4_graph1', () => {
    const a = buildTestActivity();
    const math2Id = a.screens[2].components[1].id; // s3_math2
    const graphId = a.screens[3].components[0].id; // s4_graph1

    const behaviour: CarryForwardBehaviour = {
      kind: 'carry',
      id: 'eeffgg112233',
      source: math2Id,
      destination: graphId,
      mapping: { type: 'mathToGraphNumber', variable: 'a' },
      fallback: { enabled: false, message: '' },
    };

    const result = generateCarryForward(behaviour, a);
    const code = result.section.code;

    expect(code).toContain('# >>> cl-helper carry eeffgg');
    expect(code).toContain('number("a"): s3_math2.numericValue');
    expect(result.section.sinkKeys).toEqual(['number("a")']);
  });

  it('throws for unimplemented mapping types', () => {
    const a = buildTestActivity();
    const math1Id = a.screens[2].components[0].id;
    const graphId = a.screens[3].components[0].id;
    const behaviour: CarryForwardBehaviour = {
      kind: 'carry',
      id: 'zzz',
      source: math1Id,
      destination: graphId,
      mapping: { type: 'mathToNote', as: 'number' },
      fallback: { enabled: false, message: '' },
    };
    expect(() => generateCarryForward(behaviour, a)).toThrow(/UNTESTED/);
  });
});

describe('setup reminders', () => {
  it('never asks the teacher to turn on a submit button (it is on by default)', () => {
    let a = buildTestActivity();
    const math1Id = a.screens[0].components[0].id;
    const note1Id = a.screens[0].components[1].id;
    const hintId  = a.screens[0].components[2].id;
    const feedback: InputFeedback = {
      kind: 'feedback', mode: 'input', id: 'fb0001',
      source: math1Id, target: note1Id,
      correct: 12, tolerance: 0.001,
      correctMessage: 'Yes', rules: [], fallbackMessage: 'No',
      setDashboardCorrect: true,
    };
    const showHide: ShowHideBehaviour = {
      kind: 'showHide', id: 'sh0001',
      target: hintId, trigger: { type: 'submitted', input: math1Id },
    };
    a = { ...a, behaviours: [feedback, showHide] };

    const result = generateAllScripts(a);
    expect(result.scripts.length).toBe(3);
    for (const script of result.scripts) {
      expect(script.setupReminders.join(' ')).not.toMatch(/submit button/i);
    }
  });
});
