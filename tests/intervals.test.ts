import { describe, it, expect } from 'vitest';
import { intervalExpr, computeRuleIntervals, detectCollision, placeValueExpr } from '../src/codegen/intervals';
import type { FeedbackRule } from '../src/model/types';

describe('intervalExpr', () => {
  it('low < high order', () => {
    expect(intervalExpr('x', 5, 10)).toBe('x > 5 and x < 10');
  });

  it('swaps when lo > hi', () => {
    expect(intervalExpr('x', 10, 5)).toBe('x > 5 and x < 10');
  });

  it('negative values', () => {
    expect(intervalExpr('x', -12.001, -11.999)).toBe('x > -12.001 and x < -11.999');
  });
});

describe('computeRuleIntervals', () => {
  const t = 12;
  const tol = 0.001;

  it('signError interval is around -t', () => {
    const rules: FeedbackRule[] = [{ id: 'r1', type: 'signError', message: '' }];
    const [ri] = computeRuleIntervals(rules, t, tol, 'ans');
    expect(ri.interval).not.toBeNull();
    expect(ri.interval!.lo).toBeCloseTo(-12.001);
    expect(ri.interval!.hi).toBeCloseTo(-11.999);
  });

  it('signError not applicable for t=0', () => {
    const rules: FeedbackRule[] = [{ id: 'r1', type: 'signError', message: '' }];
    const [ri] = computeRuleIntervals(rules, 0, tol, 'ans');
    expect(ri.interval).toBeNull();
    expect(ri.expr).toBeNull();
  });

  it('reciprocal not applicable for t=0', () => {
    const rules: FeedbackRule[] = [{ id: 'r1', type: 'reciprocal', message: '' }];
    const [ri] = computeRuleIntervals(rules, 0, tol, 'ans');
    expect(ri.interval).toBeNull();
  });

  it('squareRoot not applicable for t<=0', () => {
    const rules: FeedbackRule[] = [{ id: 'r1', type: 'squareRoot', message: '' }];
    const [ri] = computeRuleIntervals(rules, -4, tol, 'ans');
    expect(ri.interval).toBeNull();
  });

  it('squareRoot interval for t=4 is around 2', () => {
    const rules: FeedbackRule[] = [{ id: 'r1', type: 'squareRoot', message: '' }];
    const [ri] = computeRuleIntervals(rules, 4, tol, 'ans');
    expect(ri.interval!.lo).toBeCloseTo(2 - tol);
    expect(ri.interval!.hi).toBeCloseTo(2 + tol);
  });

  it('specificValue interval around the value', () => {
    const rules: FeedbackRule[] = [{ id: 'r1', type: 'specificValue', value: 7, message: '' }];
    const [ri] = computeRuleIntervals(rules, t, tol, 'ans');
    expect(ri.interval!.lo).toBeCloseTo(6.999);
    expect(ri.interval!.hi).toBeCloseTo(7.001);
  });
});

describe('placeValueExpr', () => {
  it('generates OR expression for two factors', () => {
    const rule: FeedbackRule = { id: 'r', type: 'placeValue', factors: [0.1, 10], message: '' };
    const expr = placeValueExpr(rule as Extract<typeof rule, { type: 'placeValue' }>, 12, 0.001, 'ans');
    // 0.1×12 = 1.2 ± 0.0001, 10×12 = 120 ± 0.01
    expect(expr).toContain('1.1999');
    expect(expr).toContain('1.2001');
    expect(expr).toContain('119.99');
    expect(expr).toContain('120.01');
    expect(expr).toContain(' or ');
  });
});

describe('detectCollision', () => {
  const correctInterval = { lo: 11.999, hi: 12.001 };

  it('flags a rule that overlaps the correct interval', () => {
    const ruleIntervals = [{
      ruleId: 'r1',
      ruleType: 'closeBand' as const,
      interval: { lo: 11.5, hi: 12.5 },
      expr: null,
    }];
    const warnings = detectCollision(ruleIntervals, correctInterval);
    expect(warnings.has('r1')).toBe(true);
  });

  it('no warning for a rule that is clearly distinct', () => {
    const ruleIntervals = [{
      ruleId: 'r1',
      ruleType: 'signError' as const,
      interval: { lo: -12.001, hi: -11.999 },
      expr: null,
    }];
    const warnings = detectCollision(ruleIntervals, correctInterval);
    expect(warnings.has('r1')).toBe(false);
  });

  it('flags a later rule that overlaps an earlier rule', () => {
    const ruleIntervals = [
      { ruleId: 'r1', ruleType: 'rounding' as const, interval: { lo: 10, hi: 14 }, expr: null },
      { ruleId: 'r2', ruleType: 'closeBand' as const, interval: { lo: 11, hi: 13 }, expr: null },
    ];
    const warnings = detectCollision(ruleIntervals, { lo: 11.999, hi: 12.001 });
    // r1 overlaps correct → flagged; r2 overlaps r1 → flagged
    expect(warnings.has('r1')).toBe(true);
    expect(warnings.has('r2')).toBe(true);
  });
});
