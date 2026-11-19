import type { FeedbackRule, Id } from '../model/types';

export interface Interval {
  lo: number;
  hi: number;
}

/** Format a number without floating-point noise. */
function fmt(n: number): string {
  // Round to 10 significant digits, trim trailing zeros.
  const s = parseFloat(n.toPrecision(10)).toString();
  return s;
}

/** Build an open-interval CL expression: `ans > lo and ans < hi` */
export function intervalExpr(varName: string, lo: number, hi: number): string {
  const a = Math.min(lo, hi);
  const b = Math.max(lo, hi);
  return `${varName} > ${fmt(a)} and ${varName} < ${fmt(b)}`;
}

export interface RuleInterval {
  ruleId: Id;
  ruleType: FeedbackRule['type'];
  interval: Interval | null; // null = rule not applicable (e.g., sqrt of negative)
  expr: string | null;       // null = not applicable
}

/**
 * Compute the CL boolean expression for each rule given target `t` and `tol`.
 * Returns expressions suitable for use as CL variable assignments.
 */
export function computeRuleIntervals(
  rules: FeedbackRule[],
  target: number,
  tolerance: number,
  varName: string,
): RuleInterval[] {
  return rules.map(rule => {
    const interval = ruleInterval(rule, target, tolerance);
    const expr = interval ? intervalExpr(varName, interval.lo, interval.hi) : null;
    return { ruleId: rule.id, ruleType: rule.type, interval, expr };
  });
}

function ruleInterval(rule: FeedbackRule, t: number, tol: number): Interval | null {
  switch (rule.type) {
    case 'signError':
      if (t === 0) return null;
      return { lo: -t - tol, hi: -t + tol };

    case 'placeValue': {
      const factors = rule.factors;
      if (t === 0) return null;
      // Union of intervals; for now we just check if each is distinct from correct.
      // We return a combined OR expression for each factor via special handling in feedback.ts.
      // For the interval object we return the first to satisfy the conflict-check signature.
      const first = factors[0];
      return { lo: first * t - Math.abs(first) * tol, hi: first * t + Math.abs(first) * tol };
    }

    case 'rounding':
      return { lo: t - rule.tolerance, hi: t + rule.tolerance };

    case 'closeBand':
      return { lo: t - rule.tolerance, hi: t + rule.tolerance };

    case 'specificValue':
      return { lo: rule.value - tol, hi: rule.value + tol };

    case 'reciprocal':
      if (t === 0) return null;
      return { lo: 1 / t - tol, hi: 1 / t + tol };

    case 'squared':
      return { lo: t * t - tol, hi: t * t + tol };

    case 'squareRoot':
      if (t <= 0) return null;
      return { lo: Math.sqrt(t) - tol, hi: Math.sqrt(t) + tol };

    case 'customFactor': {
      const k = rule.factor;
      if (t === 0) return null;
      return { lo: k * t - Math.abs(k) * tol, hi: k * t + Math.abs(k) * tol };
    }

    case 'between':
      return { lo: rule.min, hi: rule.max };

    case 'greaterThan':
      return { lo: rule.value, hi: Infinity };

    case 'lessThan':
      return { lo: -Infinity, hi: rule.value };
  }
}

/**
 * Build the CL boolean expression for a placeValue rule (may be multiple factors → OR).
 */
export function placeValueExpr(rule: Extract<FeedbackRule, { type: 'placeValue' }>, t: number, tol: number, varName: string): string {
  const parts = rule.factors.map(k => {
    const lo = k * t - Math.abs(k) * tol;
    const hi = k * t + Math.abs(k) * tol;
    return `(${intervalExpr(varName, lo, hi)})`;
  });
  return parts.join(' or ');
}

/**
 * Detect whether a rule's interval overlaps the correct interval or any earlier rule.
 * Returns a warning string or null.
 */
export function detectCollision(
  ruleIntervals: RuleInterval[],
  correctInterval: Interval,
): Map<Id, string> {
  const warnings = new Map<Id, string>();

  ruleIntervals.forEach((ri, idx) => {
    if (!ri.interval) return; // disabled rule, no collision possible

    if (overlaps(ri.interval, correctInterval)) {
      warnings.set(ri.ruleId, `This rule overlaps the "correct" range and can never be reached.`);
      return;
    }

    for (let j = 0; j < idx; j++) {
      const prev = ruleIntervals[j];
      if (!prev.interval) continue;
      if (overlaps(ri.interval, prev.interval)) {
        warnings.set(ri.ruleId, `This rule overlaps rule "${prev.ruleType}" above it and can never be reached.`);
        return;
      }
    }
  });

  return warnings;
}

function overlaps(a: Interval, b: Interval): boolean {
  return a.lo < b.hi && b.lo < a.hi;
}

/** Build greaterThan / lessThan expressions directly (no interval form). */
export function comparisonExpr(rule: FeedbackRule, varName: string): string | null {
  if (rule.type === 'greaterThan') return `${varName} > ${fmt(rule.value)}`;
  if (rule.type === 'lessThan') return `${varName} < ${fmt(rule.value)}`;
  return null;
}
