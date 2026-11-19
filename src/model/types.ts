export type Id = string;

export type ComponentType =
  | 'note' | 'math' | 'text' | 'mc' | 'check'
  | 'table' | 'graph' | 'sketch' | 'button' | 'image';

export type ComponentName =
  | { kind: 'auto'; index: number }
  | { kind: 'custom'; value: string };

export interface TableConfig {
  rows: number;
  columns: number;
  headers?: string[];
  editableColumns: number[];
  xColumn?: number;
}

export interface Component {
  id: Id;
  type: ComponentType;
  name: ComponentName;
  table?: TableConfig;
}

export interface Screen {
  id: Id;
  components: Component[];
}

export interface PendingRename {
  componentId: Id;
  oldName: string;
  newName: string;
  doneInDesmos: boolean;
}

export type FeedbackRule = { id: Id; message: string } & (
  | { type: 'signError' }
  | { type: 'placeValue'; factors: number[] }
  | { type: 'rounding'; tolerance: number }
  | { type: 'specificValue'; value: number }
  | { type: 'reciprocal' }
  | { type: 'squared' }
  | { type: 'squareRoot' }
  | { type: 'customFactor'; factor: number }
  | { type: 'closeBand'; tolerance: number }
  | { type: 'between'; min: number; max: number }
  | { type: 'greaterThan'; value: number }
  | { type: 'lessThan'; value: number }
);

export interface InputFeedback {
  kind: 'feedback';
  mode: 'input';
  id: Id;
  source: Id;
  target: Id;
  correct: number;
  tolerance: number;
  correctMessage: string;
  rules: FeedbackRule[];
  fallbackMessage: string;
  setDashboardCorrect: boolean;
}

export interface TableFeedback {
  kind: 'feedback';
  mode: 'table';
  id: Id;
  source: Id;
  cells: { row: number; column: number }[];
  expectation:
    | { mode: 'perCell'; values: Record<string, number> }
    | { mode: 'formula'; formula: string };
  tolerance: number;
  correctSuffix: string;
  rules: FeedbackRule[];
  fallbackSuffix: string;
}

export type FeedbackBehaviour = InputFeedback | TableFeedback;

export type CarryTarget =
  | { kind: 'note' }
  | { kind: 'graphNumber'; variable: string }
  | { kind: 'tableCell'; row: number; column: number };

export type CarryMapping =
  | { type: 'mathToGraphExpression'; functionName: string }
  | { type: 'mathToGraphNumber'; variable: string }
  | { type: 'mathToNote'; as: 'number' | 'latex' }
  | { type: 'tableToGraphPoints'; xColumn: number; yColumn: number; xVar: string; yVar: string }
  | { type: 'tableToTable'; columnMap: [number, number][] }
  | { type: 'graphToAny'; variable: string; into: CarryTarget };

export interface CarryForwardBehaviour {
  kind: 'carry';
  id: Id;
  source: Id;
  destination: Id;
  mapping: CarryMapping;
  fallback: { enabled: boolean; noteId?: Id; message: string };
}

export interface ShowHideBehaviour {
  kind: 'showHide';
  id: Id;
  target: Id;
  trigger:
    | { type: 'submitted'; input: Id }
    | { type: 'correct'; input: Id }
    | { type: 'ruleMatched'; input: Id; feedbackId: Id; ruleId: Id };
}

export type Behaviour = FeedbackBehaviour | CarryForwardBehaviour | ShowHideBehaviour;

export interface Activity {
  schemaVersion: 1;
  id: Id;
  title: string;
  desmosUrl?: string;
  createdAt: string;
  updatedAt: string;
  screens: Screen[];
  behaviours: Behaviour[];
  pendingRenames: PendingRename[];
  copyState: Record<Id, { lastCopiedHash?: string }>;
  dismissedIdeas: string[];
}
