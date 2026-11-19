import LZString from 'lz-string';
import type {
  Activity, Screen, Component, ComponentType, ComponentName,
  TableConfig, Behaviour, FeedbackRule, CarryMapping, CarryTarget,
  InputFeedback, TableFeedback, CarryForwardBehaviour, ShowHideBehaviour,
} from '../model/types';

// ── Compact types (short keys, arrays for tuples) ────────────────────────────

interface CA {
  v: 1;
  i: string; t: string; u?: string; ca: string; ua: string;
  ss: CS[];
  bs: CB[];
  pr: CPR[];
  cs: [string, string][];
  di: string[];
}
interface CS { i: string; cs: CC[]; }
interface CC {
  i: string; tp: string;
  n: [0, number] | [1, string];
  tb?: { r: number; c: number; ec: number[]; h?: string[]; xc?: number };
}
type CB = CIF | CTF | CCF | CSH;
interface CIF { k: 'fi'; i: string; src: string; tgt: string; c: number; tol: number; cm: string; rs: CR[]; fb: string; dc: boolean; }
interface CTF { k: 'ft'; i: string; src: string; cs: [number, number][]; ex: CEX; tol: number; csx: string; rs: CR[]; fsx: string; }
type CEX = [0, [string, number][]] | [1, string];
interface CCF { k: 'cf'; i: string; src: string; dst: string; m: CM; fe: boolean; fni?: string; fm: string; }
type CM =
  | [0, string]       // mathToGraphExpression: functionName
  | [1, string]       // mathToGraphNumber: variable
  | [2, number]       // mathToNote: 0=number 1=latex
  | [3, number, number, string, string] // tableToGraphPoints
  | [4, [number, number][]]            // tableToTable
  | [5, string, CT];                   // graphToAny
type CT = [0] | [1, string] | [2, number, number];
interface CSH { k: 'sh'; i: string; tgt: string; tr: CTR; }
type CTR = [0, string] | [1, string] | [2, string, string, string];
interface CPR { ci: string; o: string; n: string; d: boolean; }

// Rules use type code abbreviations
type CR =
  | [string, 'se', string]
  | [string, 'pv', string, number[]]
  | [string, 'rn', string, number]
  | [string, 'sv', string, number]
  | [string, 'rc', string]
  | [string, 'sq', string]
  | [string, 'sqr', string]
  | [string, 'cf', string, number]
  | [string, 'cb', string, number]
  | [string, 'bt', string, number, number]
  | [string, 'gt', string, number]
  | [string, 'lt', string, number];

// ── Compress / decompress ─────────────────────────────────────────────────────

export function compactify(activity: Activity): string {
  const ca = toCompact(activity);
  return LZString.compressToEncodedURIComponent(JSON.stringify(ca));
}

export function expand(encoded: string): Activity {
  const json = LZString.decompressFromEncodedURIComponent(encoded);
  if (!json) throw new Error('Invalid or corrupted share link.');
  return fromCompact(JSON.parse(json) as CA);
}

export function buildShareUrl(activity: Activity): string {
  const encoded = compactify(activity);
  const url = new URL(window.location.href);
  url.hash = `m=${encoded}`;
  return url.toString();
}

export function parseShareUrl(href: string): Activity | null {
  try {
    const hash = new URL(href).hash;
    if (!hash.startsWith('#m=')) return null;
    return expand(hash.slice(3));
  } catch {
    return null;
  }
}

// ── Serialization ─────────────────────────────────────────────────────────────

function toCompact(a: Activity): CA {
  return {
    v: 1,
    i: a.id, t: a.title,
    ...(a.desmosUrl ? { u: a.desmosUrl } : {}),
    ca: a.createdAt, ua: a.updatedAt,
    ss: a.screens.map(compactScreen),
    bs: a.behaviours.map(compactBehaviour),
    pr: a.pendingRenames.map(r => ({ ci: r.componentId, o: r.oldName, n: r.newName, d: r.doneInDesmos })),
    cs: Object.entries(a.copyState)
      .filter(([, v]) => v.lastCopiedHash)
      .map(([id, v]) => [id, v.lastCopiedHash!]),
    di: a.dismissedIdeas,
  };
}

function compactScreen(s: Screen): CS {
  return { i: s.id, cs: s.components.map(compactComponent) };
}

function compactComponent(c: Component): CC {
  const n: CC['n'] = c.name.kind === 'auto'
    ? [0, c.name.index]
    : [1, c.name.value];
  const cc: CC = { i: c.id, tp: c.type, n };
  if (c.table) {
    cc.tb = {
      r: c.table.rows, c: c.table.columns,
      ec: c.table.editableColumns,
      ...(c.table.headers ? { h: c.table.headers } : {}),
      ...(c.table.xColumn != null ? { xc: c.table.xColumn } : {}),
    };
  }
  return cc;
}

function compactBehaviour(b: Behaviour): CB {
  if (b.kind === 'feedback' && b.mode === 'input') {
    const bf = b as InputFeedback;
    return { k: 'fi', i: bf.id, src: bf.source, tgt: bf.target, c: bf.correct, tol: bf.tolerance, cm: bf.correctMessage, rs: bf.rules.map(compactRule), fb: bf.fallbackMessage, dc: bf.setDashboardCorrect };
  }
  if (b.kind === 'feedback' && b.mode === 'table') {
    const bf = b as TableFeedback;
    const ex: CEX = bf.expectation.mode === 'perCell'
      ? [0, Object.entries(bf.expectation.values)]
      : [1, bf.expectation.formula];
    return { k: 'ft', i: bf.id, src: bf.source, cs: bf.cells.map(c => [c.row, c.column]), ex, tol: bf.tolerance, csx: bf.correctSuffix, rs: bf.rules.map(compactRule), fsx: bf.fallbackSuffix };
  }
  if (b.kind === 'carry') {
    const bc = b as CarryForwardBehaviour;
    return { k: 'cf', i: bc.id, src: bc.source, dst: bc.destination, m: compactMapping(bc.mapping), fe: bc.fallback.enabled, ...(bc.fallback.noteId ? { fni: bc.fallback.noteId } : {}), fm: bc.fallback.message };
  }
  // showHide
  const bs = b as ShowHideBehaviour;
  const tr: CTR = bs.trigger.type === 'submitted'
    ? [0, bs.trigger.input]
    : bs.trigger.type === 'correct'
    ? [1, bs.trigger.input]
    : [2, bs.trigger.input, bs.trigger.feedbackId, bs.trigger.ruleId];
  return { k: 'sh', i: bs.id, tgt: bs.target, tr };
}

function compactMapping(m: CarryMapping): CM {
  if (m.type === 'mathToGraphExpression') return [0, m.functionName];
  if (m.type === 'mathToGraphNumber') return [1, m.variable];
  if (m.type === 'mathToNote') return [2, m.as === 'number' ? 0 : 1];
  if (m.type === 'tableToGraphPoints') return [3, m.xColumn, m.yColumn, m.xVar, m.yVar];
  if (m.type === 'tableToTable') return [4, m.columnMap];
  // graphToAny
  const tgt = compactTarget(m.into);
  return [5, m.variable, tgt];
}

function compactTarget(t: CarryTarget): CT {
  if (t.kind === 'note') return [0];
  if (t.kind === 'graphNumber') return [1, t.variable];
  return [2, t.row, t.column];
}

function compactRule(r: FeedbackRule): CR {
  switch (r.type) {
    case 'signError':    return [r.id, 'se', r.message];
    case 'placeValue':   return [r.id, 'pv', r.message, r.factors];
    case 'rounding':     return [r.id, 'rn', r.message, r.tolerance];
    case 'specificValue': return [r.id, 'sv', r.message, r.value];
    case 'reciprocal':   return [r.id, 'rc', r.message];
    case 'squared':      return [r.id, 'sq', r.message];
    case 'squareRoot':   return [r.id, 'sqr', r.message];
    case 'customFactor': return [r.id, 'cf', r.message, r.factor];
    case 'closeBand':    return [r.id, 'cb', r.message, r.tolerance];
    case 'between':      return [r.id, 'bt', r.message, r.min, r.max];
    case 'greaterThan':  return [r.id, 'gt', r.message, r.value];
    case 'lessThan':     return [r.id, 'lt', r.message, r.value];
  }
}

// ── Deserialization ───────────────────────────────────────────────────────────

function fromCompact(ca: CA): Activity {
  const copyState: Activity['copyState'] = {};
  for (const [id, hash] of ca.cs) copyState[id] = { lastCopiedHash: hash };

  return {
    schemaVersion: 1,
    id: ca.i, title: ca.t,
    ...(ca.u ? { desmosUrl: ca.u } : {}),
    createdAt: ca.ca, updatedAt: ca.ua,
    screens: ca.ss.map(expandScreen),
    behaviours: ca.bs.map(expandBehaviour),
    pendingRenames: ca.pr.map(r => ({ componentId: r.ci, oldName: r.o, newName: r.n, doneInDesmos: r.d })),
    copyState,
    dismissedIdeas: ca.di,
  };
}

function expandScreen(cs: CS): Screen {
  return { id: cs.i, components: cs.cs.map(expandComponent) };
}

function expandComponent(cc: CC): Component {
  const name: ComponentName = cc.n[0] === 0
    ? { kind: 'auto', index: cc.n[1] as number }
    : { kind: 'custom', value: cc.n[1] as string };
  const c: Component = { id: cc.i, type: cc.tp as ComponentType, name };
  if (cc.tb) {
    c.table = {
      rows: cc.tb.r, columns: cc.tb.c,
      editableColumns: cc.tb.ec,
      ...(cc.tb.h ? { headers: cc.tb.h } : {}),
      ...(cc.tb.xc != null ? { xColumn: cc.tb.xc } : {}),
    };
  }
  return c;
}

function expandBehaviour(cb: CB): Behaviour {
  if (cb.k === 'fi') {
    return { kind: 'feedback', mode: 'input', id: cb.i, source: cb.src, target: cb.tgt, correct: cb.c, tolerance: cb.tol, correctMessage: cb.cm, rules: cb.rs.map(expandRule), fallbackMessage: cb.fb, setDashboardCorrect: cb.dc };
  }
  if (cb.k === 'ft') {
    const expectation: TableFeedback['expectation'] = cb.ex[0] === 0
      ? { mode: 'perCell', values: Object.fromEntries(cb.ex[1] as [string, number][]) }
      : { mode: 'formula', formula: cb.ex[1] as string };
    return { kind: 'feedback', mode: 'table', id: cb.i, source: cb.src, cells: (cb.cs as [number, number][]).map(([row, column]) => ({ row, column })), expectation, tolerance: cb.tol, correctSuffix: cb.csx, rules: cb.rs.map(expandRule), fallbackSuffix: cb.fsx };
  }
  if (cb.k === 'cf') {
    return { kind: 'carry', id: cb.i, source: cb.src, destination: cb.dst, mapping: expandMapping(cb.m), fallback: { enabled: cb.fe, ...(cb.fni ? { noteId: cb.fni } : {}), message: cb.fm } };
  }
  // showHide
  const tr = cb.tr;
  const trigger: ShowHideBehaviour['trigger'] = tr[0] === 0
    ? { type: 'submitted', input: tr[1] as string }
    : tr[0] === 1
    ? { type: 'correct', input: tr[1] as string }
    : { type: 'ruleMatched', input: tr[1] as string, feedbackId: tr[2] as string, ruleId: tr[3] as string };
  return { kind: 'showHide', id: cb.i, target: cb.tgt, trigger };
}

function expandMapping(cm: CM): CarryMapping {
  if (cm[0] === 0) return { type: 'mathToGraphExpression', functionName: cm[1] as string };
  if (cm[0] === 1) return { type: 'mathToGraphNumber', variable: cm[1] as string };
  if (cm[0] === 2) return { type: 'mathToNote', as: cm[1] === 0 ? 'number' : 'latex' };
  if (cm[0] === 3) return { type: 'tableToGraphPoints', xColumn: cm[1] as number, yColumn: cm[2] as number, xVar: cm[3] as string, yVar: cm[4] as string };
  if (cm[0] === 4) return { type: 'tableToTable', columnMap: cm[1] as [number, number][] };
  // graphToAny
  return { type: 'graphToAny', variable: cm[1] as string, into: expandTarget(cm[2] as CT) };
}

function expandTarget(ct: CT): CarryTarget {
  if (ct[0] === 0) return { kind: 'note' };
  if (ct[0] === 1) return { kind: 'graphNumber', variable: ct[1] as string };
  return { kind: 'tableCell', row: ct[1] as number, column: ct[2] as number };
}

function expandRule(cr: CR): FeedbackRule {
  const [id, type, message, ...rest] = cr;
  switch (type) {
    case 'se':  return { id, type: 'signError', message };
    case 'pv':  return { id, type: 'placeValue', message, factors: rest[0] as number[] };
    case 'rn':  return { id, type: 'rounding', message, tolerance: rest[0] as number };
    case 'sv':  return { id, type: 'specificValue', message, value: rest[0] as number };
    case 'rc':  return { id, type: 'reciprocal', message };
    case 'sq':  return { id, type: 'squared', message };
    case 'sqr': return { id, type: 'squareRoot', message };
    case 'cf':  return { id, type: 'customFactor', message, factor: rest[0] as number };
    case 'cb':  return { id, type: 'closeBand', message, tolerance: rest[0] as number };
    case 'bt':  return { id, type: 'between', message, min: rest[0] as number, max: rest[1] as number };
    case 'gt':  return { id, type: 'greaterThan', message, value: rest[0] as number };
    case 'lt':  return { id, type: 'lessThan', message, value: rest[0] as number };
    default: throw new Error(`Unknown compact rule type: ${type}`);
  }
}
