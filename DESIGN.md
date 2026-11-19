# Desmos CL Helper: Design Document

Version 1 design. This document is the reference for building the tool. Where something is uncertain or untested, it is marked **UNTESTED** or listed under Open Questions. Do not invent Computation Layer (CL) syntax: if a template is not in the "Tested templates" section, treat it as unverified.

---

## 1. Purpose

A web page that helps a math teacher add Computation Layer (CL) functionality to a Desmos Activity Builder activity they have already built. The teacher describes the activity's screens and components, attaches behaviours (feedback, carrying work forward, show/hide), and the tool generates CL scripts to paste into each component in Desmos.

Primary user for v1: the author (a high school math teacher) building it for his own use. Long-term: share it with other teachers, so code and UI should be written with that in mind, but v1 does not need onboarding, accounts, or polish for beginners.

## 2. Constraints and principles

- **No AI and no network calls at runtime.** All logic is deterministic: templates plus rules. The page must work fully offline once loaded.
- **No server.** A static site (HTML, CSS, JS) hosted on mathedpotatoes.com.
- **Never touches Desmos.** The tool does not read, modify, or automate the Desmos site. Teachers copy code and paste it into the Desmos CL editor themselves. (Amplify's Acceptable Use Policy restricts modifying or automating their products, which is why this is a standalone page and not a browser extension.)
- **The tool owns all CL in v1.** Assume components have no existing CL and that teachers won't hand-edit generated code. Because of this, the tool can regenerate any script from the map at any time.
- **Build for later flexibility.** Keep code generation separate from the UI, store templates as data, and wrap every generated section in comment markers so a future version can coexist with handwritten code.
- **Educational without overwhelming.** Show a few common options with plain-English descriptions; put less common options behind "More ideas."

## 3. Background: Desmos Activity Builder and CL essentials

These facts drive the design.

- An activity is an ordered list of **screens**. Each screen holds **components** (notes, math inputs, tables, graphs, etc.).
- Each component can be given a **name** in the Desmos editor. CL in one component refers to other components by name (for example `s1_math1.numericValue`).
- **Each component has exactly one CL script.** All behaviours that affect a component must be merged into that one script.
- CL scripts set **sinks** (properties of the component, such as `hidden:`, `content:`, `cellSuffix(r,c):`) and read **sources** (values from components, such as `.numericValue`, `.latex`, `.submitted`, `.submitCount`). **A sink can be set only once per script.** Two behaviours that both set the same sink on the same component conflict.
- Graphs receive values from CL through sinks like `number("a"):` and `function("f"):`, which feed variables used in the graph's own expressions.
- Math inputs only have a submit button if it is turned on in the Desmos editor (or via CL).
- Tables have no submit button. Table rows in CL are numbered from 1 for the first data row; columns from 1.

Verified in testing (Nov 2026):
- Component names with underscores (like `s1_math1`) are accepted by Desmos.
- `cellHasFocus(r,c)` works, so table feedback can wait until the student leaves a cell.
- `simpleFunction(latex, "x")` accepts student input with or without a leading `y =`.
- `submitCount` persists after a student edits, so "revealed on submit" can stay revealed.

## 4. User workflow overview

1. **Start screen:** pick a saved activity, create a new one, import a file, or open a share link.
2. **Mapping phase:** enter the number of screens, then on each screen card use +/- counters to add components by type. Names are auto-generated and editable.
3. **Map view:** a visual board of screen cards. Each card lists its components by name. Components can be dragged between screens; screens can be reordered.
4. **Attach behaviours:** click a component on the map to see what it can do (feedback, carry forward, show/hide), configure it, and see the result on the map.
5. **Ideas panel:** rule-based suggestions about links the teacher might want.
6. **Code panel:** generated scripts grouped by screen and component, each with a copy button, setup reminders, and a status (new, up to date, needs re-copying).
7. **Save and share:** autosave to the browser, export/import a file, copy a share link.

---

## 5. Data model

Use strict TypeScript. Every screen, component, and behaviour has a stable hidden `id` (use `crypto.randomUUID()`). Behaviours reference components by `id`, never by name, so renames and moves never break links.

```ts
type Id = string;

type ComponentType =
  | 'note' | 'math' | 'text' | 'mc' | 'check'
  | 'table' | 'graph' | 'sketch' | 'button' | 'image';

interface Activity {
  schemaVersion: 1;
  id: Id;
  title: string;
  desmosUrl?: string;              // optional link to the real activity
  createdAt: string;               // ISO
  updatedAt: string;               // ISO
  screens: Screen[];               // array order = screen order (Screen 1 is index 0)
  behaviours: Behaviour[];
  pendingRenames: PendingRename[]; // Desmos renames the teacher still has to do
  copyState: Record<Id, { lastCopiedHash?: string }>; // keyed by component id
  dismissedIdeas: string[];        // idea keys the teacher dismissed
}

interface Screen {
  id: Id;
  components: Component[];         // order within the screen
}

type ComponentName =
  | { kind: 'auto'; index: number }       // displayed as s{screenNumber}_{typeCode}{index}
  | { kind: 'custom'; value: string };

interface Component {
  id: Id;
  type: ComponentType;
  name: ComponentName;
  table?: TableConfig;             // only for type 'table'
}

interface TableConfig {
  rows: number;                    // data rows, excluding header
  columns: number;
  headers?: string[];
  editableColumns: number[];       // 1-based columns students fill in
  xColumn?: number;                // 1-based, used by formula expectations
}

interface PendingRename {
  componentId: Id;
  oldName: string;
  newName: string;
  doneInDesmos: boolean;
}
```

### 5.1 Component types and name codes

| Type | Code | Label in UI | v1 behaviour roles |
|---|---|---|---|
| note | `note` | Note | feedback target, carry-forward destination, show/hide target |
| math | `math` | Math input | feedback source, carry-forward source, show/hide trigger and target |
| text | `text` | Text input | show/hide target |
| mc | `mc` | Multiple choice | show/hide target |
| check | `check` | Checkboxes | show/hide target |
| table | `table` | Table | feedback source, carry-forward source and destination, show/hide target |
| graph | `graph` | Graph | carry-forward source and destination, show/hide target |
| sketch | `sketch` | Sketch | show/hide target |
| button | `button` | Action button | show/hide target |
| image | `image` | Image | show/hide target |

**Verify** the current list of Activity Builder component types and whether each supports the `hidden` sink before finalizing. Types without v1 behaviours can still be mapped so the map mirrors the real activity.

---

## 6. Naming

### 6.1 Auto-generated names

- Format: `s{screenNumber}_{typeCode}{index}`, for example `s2_math1`, `s4_graph1`.
- `screenNumber` is derived from the screen's current position (1-based).
- `index` is stored on the component. When a component is created or moved to a screen, it gets the lowest free index for that type on that screen.

### 6.2 Custom names

- Any name can be edited inline on the map. Editing converts it to `{ kind: 'custom' }`.
- Custom names never change automatically (no screen number to keep in sync).
- Setting a custom name back to the auto pattern is allowed; store it as custom.

### 6.3 Validation (on every edit)

- Must match `^[A-Za-z][A-Za-z0-9_]*$`. (Letters, digits, underscores, starting with a letter. Underscores are verified to work; other characters are not.)
- Must be unique across the whole activity, case-insensitively.
- Must not collide with a name that would be auto-generated for another existing component.
- Show the error inline and do not accept the edit until it is valid.

### 6.4 Renames create Desmos to-dos

Any time a component's displayed name changes (manual edit, move, screen reorder), add a `PendingRename` with old and new names, and mark every script that mentions that component as needing re-copying. The teacher ticks each pending rename off once done in Desmos.

---

## 7. Mapping phase UI

1. A text input: "How many screens does your activity have?" (integer, 1 to 100).
2. One card per screen, in order. Each card shows "Screen N" and a row of component types with +/- counters.
   - `+` adds a component of that type with an auto name.
   - `-` removes the highest-indexed auto-named component of that type on that screen. If it has behaviours attached, show the delete warning (section 8.4).
3. A "Done mapping" button switches to the map view. The map view also lets the teacher add components and screens later, so mapping can be revisited at any time.

Tables: when a table is added, ask for rows, columns, and which columns students fill in. These can be edited later from the component's settings.

---

## 8. Map view

A horizontal or wrapping board of screen cards. Each card lists its components (name + type icon). Clicking a component opens its behaviour panel (section 9). Visual indicators on components:
- a small link icon if it is the source or destination of a behaviour
- a badge if its script needs re-copying
- a warning icon for conflicts or ordering problems

Use SortableJS for both dragging components between screen cards and reordering screen cards.

### 8.1 Moving a component between screens

When a component is dropped on a different screen:

- **If its name is auto-generated:** open a **blocking modal** that the teacher cannot dismiss without resolving:
  - Explain: "This component moved from Screen 2 to Screen 5, so its name should change from `s2_math1` to `s5_math1`. You'll also need to rename it in Desmos (in the component's name field) so the code still works."
  - Show the suggested new name with an **Accept** button, and an editable field to pick a custom name instead (validated as in 6.3).
  - On confirm: update the name, add a `PendingRename`, mark referencing scripts stale.
- **If its name is custom:** no modal. Still re-check ordering problems (8.3).

### 8.2 Reordering screens

When the teacher drags a screen card to a new position:

1. **Before applying**, compute the effects and show a warning dialog with **Cancel** and **Continue**:
   - "This will rename 4 math inputs, 2 graphs, and 1 table, and 5 CL scripts will need re-copying."
   - Counts are per component type for renames, plus a count of scripts whose generated text would change.
2. **Cancel** restores the original order.
3. **Continue** applies the reorder. All auto-named components on screens whose number changed get their new names automatically. Custom names are untouched.
4. Then show a **review checklist**:
   - Each rename: old name, new name (editable, validated), and a "done in Desmos" tick box.
   - Each script to re-copy, with a tick box (ticking it is the same as copying from the code panel).
   - The checklist stays available from a "To do in Desmos" button until everything is ticked.

### 8.3 Ordering problems

After any change, flag behaviours where data would come from a screen students haven't reached yet:
- carry-forward source on a later screen than its destination
- show/hide trigger input on a later screen than its target

Show a gentle warning icon and an explanation. Do not block.

### 8.4 Deleting a component or screen

If the component (or any component on the screen) is used by a behaviour, show a confirmation listing each affected behaviour in plain English. Deleting removes those behaviours too.

---

## 9. Behaviours

Clicking a component opens a panel with a short list of things it can do. Show the 3 or 4 most common with a one-line plain-English description each, and a **More ideas** button for the rest. Each configured behaviour has a **Show me the code** toggle (off by default) that displays the CL section it generates, live.

```ts
type Behaviour = FeedbackBehaviour | CarryForwardBehaviour | ShowHideBehaviour;
```

### 9.1 Feedback

Flow: teacher picks **Feedback**, then **what's being checked**. The panel then branches: a math input, or a table. v1 is **numeric answers only**.

#### 9.1.1 Rules (shared by both branches)

Feedback is an **ordered list of rules**. "Correct" is always checked first. Then teacher-defined rules in order (drag to reorder). Then a fallback ("none of the above"). First match wins.

```ts
type FeedbackRule = { id: Id; message: string } & (
  | { type: 'signError' }
  | { type: 'placeValue'; factors: number[] }      // default [0.1, 10]; optional 0.01, 100
  | { type: 'rounding'; tolerance: number }        // within this wider band but not correct
  | { type: 'specificValue'; value: number }       // known misconception result
  | { type: 'reciprocal' }
  | { type: 'squared' }
  | { type: 'squareRoot' }
  | { type: 'customFactor'; factor: number }       // e.g. 60, 1000 for unit slips
  | { type: 'closeBand'; tolerance: number }       // "on the right track" nudge
  | { type: 'between'; min: number; max: number }
  | { type: 'greaterThan'; value: number }
  | { type: 'lessThan'; value: number }
);
```

Shown by default: sign error, place-value slip, rounding issue, specific wrong answer. Under "More ideas": reciprocal, squared, square root, custom factor, close but not quite, between / greater than / less than.

**Interval math (generated at build time, not in CL).** The tool knows the correct value `t` and the tolerance `tol` (default `0.001`), so every rule becomes one or more open intervals `(lo, hi)`, emitted as `ans > lo and ans < hi`. This form is tested.

- correct: `(t - tol, t + tol)`
- signError: around `-t` with `tol`
- placeValue factor `k`: around `k*t` with tolerance `tol*|k|` (this matches the tested template: 1.2 uses 0.0001, 120 uses 0.01)
- customFactor `k`: same as placeValue
- reciprocal: around `1/t`, squared: around `t^2`, squareRoot: around `sqrt(t)` (only if `t > 0`)
- specificValue `v`: around `v` with `tol`
- rounding / closeBand: around `t` with the rule's wider tolerance (correct is checked first, so the inner band is excluded automatically)
- between / greaterThan / lessThan: direct comparisons

Always compute `lo = min(a, b)`, `hi = max(a, b)` so negative targets work. Format numbers without floating-point noise (round to 10 significant digits, trim trailing zeros).

**Collision detection.** Disable or warn on rules that can't be told apart from "correct" or from each other for the given target:
- `t = 0`: sign error, place value, custom factor all equal 0; reciprocal undefined. Disable these with an explanation.
- `t = 1`: reciprocal and square root equal the correct answer.
- `t = 2`: squared equals the ×2 custom factor; etc.
- General check: if any rule interval overlaps the correct interval or an earlier rule's interval, show a warning naming both rules. For tables, run this per cell.

**Message text.** CL strings are double-quoted. Until escaping is tested, replace straight double quotes in teacher messages with curly quotes and disallow the sequence `${`.

#### 9.1.2 Math input branch

Config:
```ts
interface InputFeedback {
  kind: 'feedback'; mode: 'input'; id: Id;
  source: Id;                 // math input
  target: Id;                 // a note (v1: pick an existing note, any screen, same screen suggested first)
  correct: number;
  tolerance: number;          // default 0.001
  correctMessage: string;
  rules: FeedbackRule[];
  fallbackMessage: string;
  setDashboardCorrect: boolean; // default true: adds correct: sink to the input
}
```
Generated code:
- On the **input**: `correct:` sink (if enabled).
- On the **note**: variables for each rule, `hidden: not(<input>.submitted)`, and a `content:` with a `when ... otherwise` chain.
- Setup reminder: "Turn on the submit button for `<input>` in Desmos."

#### 9.1.3 Table branch

Config:
```ts
interface TableFeedback {
  kind: 'feedback'; mode: 'table'; id: Id;
  source: Id;                 // the table (feedback appears in its own cells)
  cells: { row: number; column: number }[]; // student-entry cells to check
  expectation:
    | { mode: 'perCell'; values: Record<string, number> }  // key "r,c"; DEFAULT
    | { mode: 'formula'; formula: string };                // e.g. "2x+1", evaluated at the row's xColumn value
  tolerance: number;          // default 0, which generates the tested `= value` form
  correctSuffix: string;      // default "✅"
  rules: FeedbackRule[];      // same engine, per cell; messages must be short (suffix text)
  fallbackSuffix: string;     // default "❌"
}
```
- Feedback goes in each cell's **suffix** via `cellSuffix(r,c):`.
- Suffix is blank while the cell is empty or **has focus**, so feedback appears only after the student clicks out of the cell (tested).
- No "when submitted" for tables.
- Per-cell values: the panel shows a grid matching the table where the teacher types the correct value for each student cell.
- Formula mode is **UNTESTED**: it would use `simpleFunction("<formula>", "x").evaluateAt(this.cellNumericValue(r, xColumn))`. Add a test screen before enabling it.
- Tolerance > 0 uses the range form (same syntax as inputs, but **UNTESTED** in tables).

### 9.2 Carry forward

Flow: teacher picks **Carry forward**, chooses the **from** component, then the **to** component. The tool picks the right mapping and asks only what it can't know.

- The **to** list shows compatible components on later screens. Incompatible components appear grayed out with a short reason (for example "Sketches can't receive values from a math input in v1").
- Questions are asked **each time a link is made** (not stored on the component), since a source is rarely reused.

```ts
interface CarryForwardBehaviour {
  kind: 'carry'; id: Id;
  source: Id;
  destination: Id;
  mapping: CarryMapping;
  fallback: { enabled: boolean; noteId?: Id; message: string }; // default enabled
}

type CarryMapping =
  | { type: 'mathToGraphExpression'; functionName: string }      // TESTED
  | { type: 'mathToGraphNumber'; variable: string }              // TESTED
  | { type: 'mathToNote'; as: 'number' | 'latex' }               // UNTESTED
  | { type: 'tableToGraphPoints'; xColumn: number; yColumn: number; xVar: string; yVar: string } // UNTESTED
  | { type: 'tableToTable'; columnMap: [number, number][] }      // UNTESTED
  | { type: 'graphToAny'; variable: string; into: CarryTarget }; // UNTESTED

type CarryTarget = { kind: 'note' } | { kind: 'graphNumber'; variable: string } | { kind: 'tableCell'; row: number; column: number };
```

Pairing table:

| From → To | What the tool generates | Asks at link time | Status |
|---|---|---|---|
| Math input → graph (expression) | `function("f"): simpleFunction(src.latex, "x")` | function name (default `f`, must not be used elsewhere in that graph) | TESTED |
| Math input → graph (number) | `number("a"): src.numericValue` | "Is this a number or an expression?" then the graph variable name | TESTED |
| Math input → note | note `content:` showing the answer | number or expression | UNTESTED |
| Table → graph | per-row numbers fed to the graph, plus graph expressions for the teacher to add | which columns are x and y | UNTESTED |
| Table → table | `cellContent(r,c): "${src.cellContent(r',c')}"` | which columns map to which | UNTESTED |
| Graph → anything | `src.number("<var>")` | the variable name in the source graph (with an explanation that it must be defined in that graph's expressions) | UNTESTED |

Setup reminders the code panel must show for graph destinations:
- "Add the expression `y = f(x)` to `<graph>`."
- "Don't define `f` (or `a`) inside the graph. If Desmos created a slider for `a`, delete it."

**Blank-source fallback (on by default).** If the student left the source blank, the destination shouldn't break or show nonsense. Default message: "Go back to Screen N to enter your answer." For note destinations, put it in the note's content chain. For graph and table destinations, the message needs a note on the destination screen: offer a dropdown of notes on that screen, or a prompt to add one in the map. Implementation is **UNTESTED**; use `isBlank(src.latex)` (math) or `isBlank(src.cellContent(r,c))` (table) as the condition.

### 9.3 Show/hide

Flow: teacher clicks the component to hide, picks **Show/hide**, then picks the trigger.

```ts
interface ShowHideBehaviour {
  kind: 'showHide'; id: Id;
  target: Id;
  trigger:
    | { type: 'submitted'; input: Id }                     // TESTED
    | { type: 'correct'; input: Id }                       // needs Open Question O1
    | { type: 'ruleMatched'; input: Id; feedbackId: Id; ruleId: Id }; // needs O1; under "More ideas"
}
```

- Triggers come from math inputs only in v1. Tables have no "when submitted" trigger.
- **"When correct" only appears if that input already has a feedback behaviour.** Correctness is taken from that feedback's correct interval, never guessed.
- **"When a specific rule matches"** (for example "show the hint only on a sign error") also requires feedback and lives under More ideas.
- **Once revealed, content stays visible**, even if the student edits their answer.
  - `submitted`: `hidden: <input>.submitCount < 1` (tested, stays visible).
  - `correct` / `ruleMatched`: CL recomputes live, so a plain check would re-hide on edit. Making it stick is Open Question O1. Do not ship a non-sticky version of these without the author's OK.
- Setup reminder: "Turn on the submit button for `<input>` in Desmos."

---

## 10. Code generation

Keep all of this in pure functions with no DOM access, so it can be unit tested.

### 10.1 Per-component scripts

For each component, collect the **sections** that every behaviour contributes to it:

| Behaviour | Writes to |
|---|---|
| Input feedback | input (`correct:`), target note (`hidden:`, `content:`) |
| Table feedback | the table (`cellSuffix(r,c):` per cell) |
| Carry forward | the destination (`number(...)`, `function(...)`, `content:`, `cellContent(...)`), and fallback note if any |
| Show/hide | the target (`hidden:`) |

Concatenate sections in a stable order (by behaviour creation time) into one script.

### 10.2 Sink conflicts

Each sink key (for example `hidden`, `content`, `cellSuffix(2,2)`, `number("a")`) may appear once per component. If two sections set the same sink key, v1 **reports a conflict** instead of generating that component's script: show it on the map and in the panel, naming both behaviours, and suggest a fix (for example "Use a separate note for this feedback"). Merging conflicting sinks is a later feature.

### 10.3 Section markers and variable names

Wrap every section in comment markers so a later version can find the tool's own code:
```
# >>> cl-helper feedback 3f2a9c
...
# <<< cl-helper feedback 3f2a9c
```
(Use the first 6 characters of the behaviour id.)

Prefix variables with a short behaviour tag to avoid collisions when sections are combined, using **camelCase** (for example `fb3f2aAns`, `fb3f2aSignError`). Underscores are verified in component names but **not** in CL variable names, so avoid them in variables.

### 10.4 Templates as data

Store each template as data: an id, a description, its parameters, the sink keys it sets, its tested status, and a body string with `{{placeholders}}`. Fill with a small string-replacement function. No `eval`, no template engine dependency. Rule blocks (the `when` lines) are generated by code from the interval math.

### 10.5 Code panel

- Grouped by screen, then component.
- Each entry shows: where to paste ("Screen 2 → `s2_table1` → CL"), the script in a monospace block, a **Copy** button, setup reminders, and a status badge: **New**, **Up to date**, or **Needs re-copying**.
- Status: store a hash of the script when Copy is pressed (`copyState[componentId].lastCopiedHash`). If the current script's hash differs, the badge is **Needs re-copying**. Use any small, fast string hash (no crypto needed).
- A "To do in Desmos" summary at the top: pending renames + scripts needing re-copying.
- Components with no generated code are not listed.

---

## 11. Tested templates (reference)

This exact code was pasted into a test activity and confirmed working in student preview. Generated output for the same configuration should be functionally equivalent. Snapshot tests should cover these cases.

Test activity layout: Screen 1 has `s1_math1` (math input, submit on), `s1_note1` (feedback note), `s1_hint` (custom-named note, hidden until submit). Screen 2 has `s2_table1` (x = 1, 2, 3 given; y blank; answers from y = 2x + 1). Screen 3 has `s3_math1` (equation) and `s3_math2` (slope number), both with submit on. Screen 4 has `s4_graph1` with expressions `y = a x` and `y = f(x)`.

**Input: dashboard correctness** (`s1_math1`)
```
correct: this.numericValue > 11.999 and this.numericValue < 12.001
```

**Input feedback note** (`s1_note1`), correct value 12, tolerance 0.001, rules: sign error, place value [0.1, 10], specific value 7
```
ans = s1_math1.numericValue

isCorrect = ans > 11.999 and ans < 12.001
signError = ans > -12.001 and ans < -11.999
decimalSlip = (ans > 1.1999 and ans < 1.2001) or (ans > 119.99 and ans < 120.01)
addedInstead = ans > 6.999 and ans < 7.001

hidden: not(s1_math1.submitted)
content:
  when isCorrect "Nice, 3 × 4 = 12."
  when signError "Check your sign. Can multiplying two positive numbers give a negative?"
  when decimalSlip "Close! Check your place value."
  when addedInstead "It looks like you added. This question asks for a product."
  otherwise "Not quite. Try again."
```

**Show/hide on submit, stays visible** (`s1_hint`)
```
hidden: s1_math1.submitCount < 1
```

**Table per-cell feedback after leaving the cell** (`s2_table1`)
```
cellSuffix(1,2):
  when isBlank(this.cellContent(1,2)) or this.cellHasFocus(1,2) ""
  when this.cellNumericValue(1,2) = 3 "✅"
  otherwise "❌"

cellSuffix(2,2):
  when isBlank(this.cellContent(2,2)) or this.cellHasFocus(2,2) ""
  when this.cellNumericValue(2,2) = 5 "✅"
  otherwise "❌"

cellSuffix(3,2):
  when isBlank(this.cellContent(3,2)) or this.cellHasFocus(3,2) ""
  when this.cellNumericValue(3,2) = 7 "✅"
  otherwise "❌"
```

**Carry forward into a graph** (`s4_graph1`)
```
function("f"): simpleFunction(s3_math1.latex, "x")
number("a"): s3_math2.numericValue
```

Note: the tested code did not include comment markers or prefixed variable names (10.3). Those are expected to work (`#` comments appear in common CL examples) but confirm them in the test activity when the generator is first run.

---

## 12. Ideas panel (rule-based suggestions)

No AI. A set of small rule functions run over the activity whenever it changes. Each returns zero or more ideas with a stable key (so dismissals persist).

Example rules:
- A math input on an earlier screen and a graph on a later screen, with no link between them → "Plot `s3_math1` on `s4_graph1`?"
- A table on an earlier screen and a graph on a later screen, no link → "Plot the points from `s2_table1` on `s5_graph1`?"
- A math input with no feedback → "Add feedback to `s1_math1`?"
- A table with student-entry cells and no feedback → "Check answers in `s2_table1` cell by cell?"
- An input with feedback and a note on the same screen with no behaviour → "Reveal `s1_note2` as a hint after a submit?"

Presentation:
- Show at most 2 at a time, ranked by distance between the screens involved (closer first).
- Use real component names and screen numbers.
- Each idea has **Set it up** (opens the behaviour panel prefilled) and **Dismiss** (never shown again for that activity).
- Recompute only when the map changes; label the panel "Ideas," not "Recommendations."

---

## 13. Persistence

### 13.1 Autosave
- Save to `localStorage` on every change (debounced ~500 ms).
- Keys: `clhelper:index` (list of `{ id, title, updatedAt, desmosUrl }`) and `clhelper:activity:<id>` (full JSON).
- Wrap all storage access in try/catch. If storage is unavailable, show a quiet banner suggesting export.

### 13.2 Start screen
- List saved activities (title, last updated, Desmos link if set), newest first.
- Buttons: **New activity**, **Import file**.
- Delete with confirmation.

### 13.3 Export / import file
- Export: download `<title>.clhelper.json` containing the full `Activity`.
- Import: validate `schemaVersion` and shape; show a clear error if invalid. If an activity with the same id exists, ask: replace or keep both (keeping both assigns a new id).

### 13.4 Share link
The map is encoded into the URL fragment (after `#`), which browsers never send to a server.
- Format: `https://<host>/<path>/#m=<data>` where `<data>` is `LZString.compressToEncodedURIComponent(JSON)`.
- Use a **compact serializer** for links: short keys, omit default values, store auto names as index only. Keep it separate from the full JSON format, with round-trip tests.
- On load, if `#m=` is present: decode, validate, and open as an imported activity (same replace / keep both prompt). Then clear the fragment from the address bar.
- If a link exceeds ~8,000 characters, still produce it but suggest exporting a file instead.
- A share link is a snapshot; a "Copy link" button generates a fresh one each time.

### 13.5 Schema versioning
`schemaVersion` on every saved activity. A `migrate()` function upgrades older versions on load. Start at 1.

---

## 14. Tech stack and project structure

- **TypeScript** (strict mode), **Vite** for dev server and build, no UI framework.
- **SortableJS** for drag and drop. **lz-string** for share links. **Vitest** for unit tests.
- Plain JavaScript files are fine where convenient (`allowJs: true`).
- Output is static files in `dist/`, uploaded to mathedpotatoes.com. Set Vite's `base` to the final path (TBD, for example `/cl-helper/`).

Suggested layout:
```
desmos-cl-helper/
  CLAUDE.md
  DESIGN.md
  index.html
  package.json
  tsconfig.json
  vite.config.ts
  src/
    main.ts
    styles.css
    model/
      types.ts          # all interfaces from section 5 and 9
      activity.ts       # create/update functions (pure; return new state)
      naming.ts         # auto names, validation, rename effects
      ordering.ts       # ordering problems, reorder effects/counts
    codegen/
      templates.ts      # template data (section 10.4)
      intervals.ts      # rule interval math + collision detection
      feedback.ts
      carryForward.ts
      showHide.ts
      generate.ts       # per-component scripts, sink conflicts, markers
      hash.ts
    persistence/
      storage.ts        # localStorage
      file.ts           # export/import
      share.ts          # compact serializer + lz-string
      migrate.ts
    ideas/
      rules.ts
    ui/
      startScreen.ts
      mappingPhase.ts
      mapView.ts
      screenCard.ts
      behaviourPanel.ts
      dialogs.ts        # move modal, reorder warning, review checklist, delete confirm
      codePanel.ts
      ideasPanel.ts
  tests/
    intervals.test.ts
    naming.test.ts
    generate.test.ts    # snapshot the tested templates from section 11
    share.test.ts
```

State handling: a single `Activity` object in memory, updated only through functions in `model/`. After every update: re-render the affected views, recompute ideas, autosave. A simple subscribe/notify store is enough.

---

## 15. Build order (milestones)

1. **Project setup:** Vite + TypeScript + Vitest; empty page loads.
2. **Model:** types, ids, auto naming, validation, localStorage autosave, start screen.
3. **Mapping phase and map view:** screen count, +/- counters, inline name editing (no drag yet).
4. **Codegen core + input feedback:** intervals, collision checks, generator, code panel with copy and status. Snapshot tests must reproduce section 11's input feedback and correctness code.
5. **Table feedback** (per-cell values first).
6. **Carry forward:** tested mappings first (math → graph expression, math → graph number), with grayed-out incompatible options and setup reminders.
7. **Show/hide:** "when submitted" trigger.
8. **Moving and reordering:** SortableJS, move modal, reorder warning + review checklist, pending renames, stale detection, ordering warnings, delete warnings.
9. **Export/import and share links.**
10. **Ideas panel and educational polish:** More ideas, Show me the code, explanations.
11. **Extend the test activity** in Desmos for each UNTESTED template before enabling it in the UI (hide untested mappings behind a dev flag until then).

---

## 16. Open questions / things to test

- **O1. Sticky "when correct" reveal.** How to keep content visible once an answer has been correct, even after edits. Candidate: CL's capture/history features on inputs. Needs testing before "when correct" and "when rule matches" triggers ship.
- **O2. Untested templates** (marked UNTESTED above): math → note, table → graph, table → table, graph → anything, table formula expectations, table tolerance ranges, blank-source fallbacks, comment markers and prefixed variable names.
- **O3. Feedback note after editing.** Confirm whether `submitted` turns false when a student edits after submitting (which would hide the feedback note until resubmit). Either behaviour is acceptable, but document it in the UI.
- **O4. Component name rules** beyond `[A-Za-z][A-Za-z0-9_]*`.
- **O5. Current list of component types** and which support `hidden`.
- **O6. String escaping in CL** (double quotes, `${`).
- **O7. Table-based show/hide triggers** (for example "when all cells are filled") are not decided for v1.
- **O8. Feedback shown on the input itself** (instead of a note) was mentioned but not designed; v1 uses notes.
- **O9. Hosting path** on mathedpotatoes.com (sets Vite `base`).

## 17. Out of scope for v1

Tracked in the project's "for later" doc:
- Table feedback where expected values come from a student's earlier input (evaluating the student's function at each row's x).
- Feedback on equations and graphs (v1 is numeric only).
- Coexisting with handwritten CL: a custom code slot per component, and importing existing CL (enabled later by the section markers).
- A direct "Save to Google Drive" button.
- Sharing the tool with other teachers (onboarding, polish).
- A browser extension that works inside the Activity Builder editor (requires written permission from Amplify first).
