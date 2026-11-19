import { describe, it, expect } from 'vitest';
import { compactify, expand } from '../src/persistence/share';
import { createActivity, addScreen, addComponent } from '../src/model/activity';
import { addBehaviour } from '../src/model/behaviours';
import type { Activity, InputFeedback, TableFeedback, CarryForwardBehaviour, ShowHideBehaviour } from '../src/model/types';

function buildRichActivity(): Activity {
  let a = createActivity('Round-trip test');
  a = addScreen(a);
  a = addComponent(a, a.screens[0].id, 'math');   // s1_math1
  a = addComponent(a, a.screens[0].id, 'note');   // s1_note1

  a = addScreen(a);
  a = addComponent(a, a.screens[1].id, 'table', { rows: 3, columns: 2, editableColumns: [2] }); // s2_table1

  a = addScreen(a);
  a = addComponent(a, a.screens[2].id, 'math');   // s3_math1
  a = addScreen(a);
  a = addComponent(a, a.screens[3].id, 'graph');  // s4_graph1

  const math1Id = a.screens[0].components[0].id;
  const note1Id = a.screens[0].components[1].id;
  const tableId = a.screens[1].components[0].id;
  const math2Id = a.screens[2].components[0].id;
  const graphId = a.screens[3].components[0].id;

  const fb: InputFeedback = {
    kind: 'feedback', mode: 'input',
    id: 'fb001',
    source: math1Id, target: note1Id,
    correct: 12, tolerance: 0.001,
    correctMessage: 'Correct!',
    rules: [
      { id: 'r1', type: 'signError', message: 'Check your sign.' },
      { id: 'r2', type: 'placeValue', message: 'Place value?', factors: [0.1, 10] },
      { id: 'r3', type: 'specificValue', message: 'You added.', value: 7 },
    ],
    fallbackMessage: 'Try again.',
    setDashboardCorrect: true,
  };

  const tf: TableFeedback = {
    kind: 'feedback', mode: 'table',
    id: 'tf001',
    source: tableId,
    cells: [{ row: 1, column: 2 }, { row: 2, column: 2 }],
    expectation: { mode: 'perCell', values: { '1,2': 3, '2,2': 5 } },
    tolerance: 0,
    correctSuffix: '✅',
    rules: [],
    fallbackSuffix: '❌',
  };

  const cf: CarryForwardBehaviour = {
    kind: 'carry', id: 'cf001',
    source: math2Id, destination: graphId,
    mapping: { type: 'mathToGraphExpression', functionName: 'f' },
    fallback: { enabled: false, message: '' },
  };

  const sh: ShowHideBehaviour = {
    kind: 'showHide', id: 'sh001',
    target: note1Id,
    trigger: { type: 'submitted', input: math1Id },
  };

  a = addBehaviour(a, fb);
  a = addBehaviour(a, tf);
  a = addBehaviour(a, cf);
  a = addBehaviour(a, sh);

  return a;
}

describe('share link round-trip', () => {
  it('compactify produces a non-empty string', () => {
    const a = buildRichActivity();
    const encoded = compactify(a);
    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(10);
  });

  it('expand(compactify(a)) reproduces the activity faithfully', () => {
    const original = buildRichActivity();
    const encoded = compactify(original);
    const restored = expand(encoded);

    expect(restored.id).toBe(original.id);
    expect(restored.title).toBe(original.title);
    expect(restored.screens.length).toBe(original.screens.length);

    // Same component IDs in same order
    for (let si = 0; si < original.screens.length; si++) {
      const os = original.screens[si];
      const rs = restored.screens[si];
      expect(rs.id).toBe(os.id);
      expect(rs.components.length).toBe(os.components.length);
      for (let ci = 0; ci < os.components.length; ci++) {
        const oc = os.components[ci];
        const rc = rs.components[ci];
        expect(rc.id).toBe(oc.id);
        expect(rc.type).toBe(oc.type);
        expect(rc.name).toEqual(oc.name);
        if (oc.table) {
          expect(rc.table).toEqual(oc.table);
        }
      }
    }

    // Same behaviours
    expect(restored.behaviours.length).toBe(original.behaviours.length);
    for (let i = 0; i < original.behaviours.length; i++) {
      const ob = original.behaviours[i];
      const rb = restored.behaviours[i];
      expect(rb.id).toBe(ob.id);
      expect(rb.kind).toBe(ob.kind);
    }

    // InputFeedback rules survived
    const obFb = original.behaviours.find(b => b.id === 'fb001') as InputFeedback;
    const rsFb = restored.behaviours.find(b => b.id === 'fb001') as InputFeedback;
    expect(rsFb.rules.length).toBe(obFb.rules.length);
    expect(rsFb.rules[0].type).toBe('signError');
    expect(rsFb.rules[1].type).toBe('placeValue');
    expect(rsFb.correct).toBe(12);
    expect(rsFb.tolerance).toBeCloseTo(0.001);

    // TableFeedback cells survived
    const obTf = original.behaviours.find(b => b.id === 'tf001') as TableFeedback;
    const rsTf = restored.behaviours.find(b => b.id === 'tf001') as TableFeedback;
    expect(rsTf.cells.length).toBe(obTf.cells.length);
    expect(rsTf.expectation.mode).toBe('perCell');
    if (rsTf.expectation.mode === 'perCell') {
      expect(rsTf.expectation.values['1,2']).toBe(3);
    }
  });

  it('throws on invalid encoded string', () => {
    expect(() => expand('not-valid-lzstring')).toThrow();
  });
});
