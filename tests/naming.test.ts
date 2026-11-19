import { describe, it, expect } from 'vitest';
import { autoName, getDisplayName, validateComponentName, nextFreeIndex } from '../src/model/naming';
import { createActivity, addScreen, addComponent, removeComponent } from '../src/model/activity';

describe('autoName', () => {
  it('formats correctly', () => {
    expect(autoName('math', 2, 1)).toBe('s2_math1');
    expect(autoName('graph', 4, 1)).toBe('s4_graph1');
    expect(autoName('note', 1, 3)).toBe('s1_note3');
  });
});

describe('getDisplayName', () => {
  it('returns auto name for auto-named components', () => {
    const comp = { id: 'x', type: 'math' as const, name: { kind: 'auto' as const, index: 1 } };
    expect(getDisplayName(comp, 2)).toBe('s2_math1');
  });

  it('returns custom value for custom-named components', () => {
    const comp = { id: 'x', type: 'math' as const, name: { kind: 'custom' as const, value: 'myInput' } };
    expect(getDisplayName(comp, 2)).toBe('myInput');
  });

  it('custom name ignores screen number', () => {
    const comp = { id: 'x', type: 'note' as const, name: { kind: 'custom' as const, value: 'hint' } };
    expect(getDisplayName(comp, 99)).toBe('hint');
  });
});

describe('validateComponentName', () => {
  it('rejects names starting with a digit', () => {
    expect(validateComponentName('1abc', createActivity('t'))).not.toBeNull();
  });

  it('rejects names with spaces', () => {
    expect(validateComponentName('my input', createActivity('t'))).not.toBeNull();
  });

  it('rejects names with hyphens', () => {
    expect(validateComponentName('my-input', createActivity('t'))).not.toBeNull();
  });

  it('accepts valid names', () => {
    expect(validateComponentName('s1_math1', createActivity('t'))).toBeNull();
    expect(validateComponentName('myInput', createActivity('t'))).toBeNull();
    expect(validateComponentName('A1', createActivity('t'))).toBeNull();
  });

  it('rejects duplicate of an existing auto name', () => {
    let a = createActivity('t');
    a = addScreen(a);
    a = addComponent(a, a.screens[0].id, 'math');
    expect(validateComponentName('s1_math1', a, 'some-other-id')).not.toBeNull();
  });

  it('is case-insensitive for duplicates', () => {
    let a = createActivity('t');
    a = addScreen(a);
    a = addComponent(a, a.screens[0].id, 'math');
    expect(validateComponentName('S1_MATH1', a, 'different-id')).not.toBeNull();
  });

  it('allows the same name when excluding the same component', () => {
    let a = createActivity('t');
    a = addScreen(a);
    a = addComponent(a, a.screens[0].id, 'math');
    const compId = a.screens[0].components[0].id;
    expect(validateComponentName('s1_math1', a, compId)).toBeNull();
  });
});

describe('nextFreeIndex', () => {
  it('returns 1 for the first component of a type', () => {
    let a = createActivity('t');
    a = addScreen(a);
    expect(nextFreeIndex(a, a.screens[0].id, 'math')).toBe(1);
  });

  it('returns 2 after one math is added', () => {
    let a = createActivity('t');
    a = addScreen(a);
    a = addComponent(a, a.screens[0].id, 'math');
    expect(nextFreeIndex(a, a.screens[0].id, 'math')).toBe(2);
  });

  it('fills a gap left by a removed component', () => {
    let a = createActivity('t');
    a = addScreen(a);
    a = addComponent(a, a.screens[0].id, 'math'); // index 1
    a = addComponent(a, a.screens[0].id, 'math'); // index 2
    const id1 = a.screens[0].components[0].id;
    a = removeComponent(a, id1); // gap at index 1
    expect(nextFreeIndex(a, a.screens[0].id, 'math')).toBe(1);
  });

  it('is per-type (note index independent of math index)', () => {
    let a = createActivity('t');
    a = addScreen(a);
    a = addComponent(a, a.screens[0].id, 'math');
    a = addComponent(a, a.screens[0].id, 'math');
    expect(nextFreeIndex(a, a.screens[0].id, 'note')).toBe(1);
  });
});
