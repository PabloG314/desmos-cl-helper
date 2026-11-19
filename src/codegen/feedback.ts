import type { InputFeedback } from '../model/types';
import { getAllDisplayNames } from '../model/naming';
import type { Activity } from '../model/types';
import {
  intervalExpr,
  placeValueExpr,
  comparisonExpr,
  computeRuleIntervals,
  detectCollision,
  type Interval,
} from './intervals';

export interface FeedbackSection {
  componentId: string;
  sinkKey: string;
  code: string;
}

export interface FeedbackWarning {
  ruleId: string;
  message: string;
}

export interface InputFeedbackResult {
  /** Section written to the source math input (correct: sink) */
  inputSection: FeedbackSection | null;
  /** Section written to the target note (hidden: + content:) */
  noteSection: FeedbackSection;
  warnings: FeedbackWarning[];
}

export function generateInputFeedback(
  behaviour: InputFeedback,
  activity: Activity,
): InputFeedbackResult {
  const names = getAllDisplayNames(activity);
  const inputName = names.get(behaviour.source) ?? behaviour.source;
  const tag = behaviour.id.slice(0, 6);
  const prefix = `fb${tag}`;

  const t = behaviour.correct;
  const tol = behaviour.tolerance;
  const varName = `${prefix}Ans`;

  const correctInterval: Interval = { lo: t - tol, hi: t + tol };
  const correctExpr = intervalExpr(varName, correctInterval.lo, correctInterval.hi);

  // --- input section (correct: sink) ---
  const inputSection: FeedbackSection | null = behaviour.setDashboardCorrect
    ? {
        componentId: behaviour.source,
        sinkKey: 'correct',
        code: sectionBlock(tag, 'feedback', `correct: ${intervalExpr('this.numericValue', t - tol, t + tol)}`),
      }
    : null;

  // --- note section ---
  const ruleIntervals = computeRuleIntervals(behaviour.rules, t, tol, varName);
  const collisions = detectCollision(ruleIntervals, correctInterval);

  const warnings: FeedbackWarning[] = [];

  // Variable declarations
  const varLines: string[] = [`${varName} = ${inputName}.numericValue`, ''];
  varLines.push(`${prefix}IsCorrect = ${correctExpr}`);

  const whenLines: string[] = [];
  whenLines.push(`  when ${prefix}IsCorrect ${clString(behaviour.correctMessage)}`);

  for (let i = 0; i < behaviour.rules.length; i++) {
    const rule = behaviour.rules[i];
    const ri = ruleIntervals[i];

    if (collisions.has(rule.id)) {
      warnings.push({ ruleId: rule.id, message: collisions.get(rule.id)! });
    }

    if (!ri.interval && ri.ruleType !== 'greaterThan' && ri.ruleType !== 'lessThan') {
      warnings.push({ ruleId: rule.id, message: notApplicableReason(ri.ruleType, t) });
      continue;
    }

    const varIdent = `${prefix}${ruleVarSuffix(rule.type)}`;

    let boolExpr: string;
    if (rule.type === 'placeValue') {
      boolExpr = placeValueExpr(rule as Extract<typeof rule, { type: 'placeValue' }>, t, tol, varName);
    } else if (rule.type === 'greaterThan' || rule.type === 'lessThan') {
      boolExpr = comparisonExpr(rule, varName)!;
    } else if (rule.type === 'between') {
      boolExpr = `${varName} > ${rule.min} and ${varName} < ${rule.max}`;
    } else {
      boolExpr = ri.expr!;
    }

    varLines.push(`${varIdent} = ${boolExpr}`);
    whenLines.push(`  when ${varIdent} ${clString(rule.message)}`);
  }

  varLines.push(`  otherwise ${clString(behaviour.fallbackMessage)}`);

  const noteBody = [
    varLines.join('\n'),
    '',
    `hidden: not(${inputName}.submitted)`,
    'content:',
    // The first line of whenLines and the otherwise are indented by the template
    whenLines.join('\n') + '\n' + varLines[varLines.length - 1],
  ].join('\n');

  // Build the note body correctly
  const noteCode = buildNoteCode(inputName, varLines.slice(0, -1), whenLines, behaviour.fallbackMessage);

  const noteSection: FeedbackSection = {
    componentId: behaviour.target,
    sinkKey: 'hidden+content',
    code: sectionBlock(tag, 'feedback', noteCode),
  };

  return { inputSection, noteSection, warnings };
}

function buildNoteCode(
  inputName: string,
  varDeclarations: string[],
  whenLines: string[],
  fallbackMessage: string,
): string {
  const lines: string[] = [
    ...varDeclarations,
    '',
    `hidden: not(${inputName}.submitted)`,
    'content:',
    ...whenLines,
    `  otherwise ${clString(fallbackMessage)}`,
  ];
  return lines.join('\n');
}

export function sectionBlock(behaviourId: string, kind: string, body: string): string {
  const tag = behaviourId.slice(0, 6);
  return [
    `# >>> cl-helper ${kind} ${tag}`,
    body,
    `# <<< cl-helper ${kind} ${tag}`,
  ].join('\n');
}

/** Sanitize a message string for use as a CL double-quoted string. */
export function clString(message: string): string {
  // Replace straight double quotes with curly quotes; reject ${
  const safe = message
    .replace(/"/g, '“')
    .replace(/\${/g, '\\${'); // should not happen but guard anyway
  return `"${safe}"`;
}

function ruleVarSuffix(type: string): string {
  const map: Record<string, string> = {
    signError: 'SignError',
    placeValue: 'PlaceValue',
    rounding: 'Rounding',
    specificValue: 'SpecificVal',
    reciprocal: 'Reciprocal',
    squared: 'Squared',
    squareRoot: 'SqRoot',
    customFactor: 'CustomFactor',
    closeBand: 'CloseBand',
    between: 'Between',
    greaterThan: 'GreaterThan',
    lessThan: 'LessThan',
  };
  return map[type] ?? 'Rule';
}

function notApplicableReason(type: string, t: number): string {
  if (type === 'signError') return `Sign error rule is not applicable when the correct answer is 0.`;
  if (type === 'placeValue') return `Place value rule is not applicable when the correct answer is 0.`;
  if (type === 'customFactor') return `Custom factor rule is not applicable when the correct answer is 0.`;
  if (type === 'reciprocal') return `Reciprocal rule is not applicable when the correct answer is 0.`;
  if (type === 'squareRoot') return `Square root rule is not applicable when the correct answer is ≤ 0 (got ${t}).`;
  return `Rule "${type}" is not applicable for this target.`;
}
