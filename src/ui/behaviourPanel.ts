import type {
  Activity, Id, Component,
  InputFeedback, TableFeedback, CarryForwardBehaviour, ShowHideBehaviour,
  FeedbackRule,
} from '../model/types';
import { getAllDisplayNames } from '../model/naming';
import { addBehaviour, removeBehaviour, updateBehaviour } from '../model/behaviours';
import { generateAllScripts } from '../codegen/generate';

type PanelMode =
  | { kind: 'list' }
  | { kind: 'edit'; behaviour: InputFeedback | TableFeedback | CarryForwardBehaviour | ShowHideBehaviour | null; behaviourKind: 'inputFeedback' | 'tableFeedback' | 'carryForward' | 'showHide' };

export function renderBehaviourPanel(
  container: HTMLElement,
  componentId: Id,
  activity: Activity,
  onUpdate: (a: Activity) => void,
  onClose: () => void,
): void {
  let current = activity;
  let mode: PanelMode = { kind: 'list' };

  function update(a: Activity): void {
    current = a;
    onUpdate(a);
    render();
  }

  function render(): void {
    container.innerHTML = '';
    const panel = el('div', 'bp');
    const names = getAllDisplayNames(current);
    const comp = findComponent(current, componentId);
    if (!comp) { onClose(); return; }

    const compName = names.get(componentId) ?? componentId;

    // Header
    const header = el('div', 'bp__header');
    const title = el('div', 'bp__title');
    title.innerHTML = `<strong>${compName}</strong> <span class="bp__type">${comp.type}</span>`;
    const closeBtn = button('×', onClose);
    closeBtn.className = 'bp__close';
    closeBtn.title = 'Close panel';
    header.appendChild(title);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    if (mode.kind === 'list') {
      renderList(panel, comp, compName);
    } else {
      renderForm(panel, comp, compName, mode);
    }

    container.appendChild(panel);
  }

  function renderList(panel: HTMLElement, comp: Component, compName: string): void {
    const names = getAllDisplayNames(current);

    // Existing behaviours involving this component
    const related = current.behaviours.filter(b => behaviourInvolvesComponent(b, componentId));
    if (related.length > 0) {
      const section = el('div', 'bp__section');
      const h = el('h4', 'bp__section-title'); h.textContent = 'Behaviors'; section.appendChild(h);
      for (const b of related) {
        const card = el('div', 'bp__behaviour-card');
        const desc = el('div', 'bp__behaviour-desc');
        desc.textContent = describeBehaviour(b, names);
        card.appendChild(desc);
        const actions = el('div', 'bp__behaviour-actions');
        const editBtn = button('Edit', () => {
          mode = { kind: 'edit', behaviour: b as InputFeedback | TableFeedback | CarryForwardBehaviour | ShowHideBehaviour, behaviourKind: inferKind(b) };
          render();
        });
        const delBtn = button('Remove', () => {
          if (confirm(`Remove this behavior?`)) update(removeBehaviour(current, b.id));
        });
        delBtn.style.cssText = 'color:#c00;border-color:#fcc;';
        actions.appendChild(editBtn);
        actions.appendChild(delBtn);
        card.appendChild(actions);
        section.appendChild(card);
      }
      panel.appendChild(section);
    }

    // Available actions based on component type
    const addSection = el('div', 'bp__section');
    const h2 = el('h4', 'bp__section-title'); h2.textContent = 'Add behavior'; addSection.appendChild(h2);
    const addBtns = availableActions(comp);
    if (addBtns.length === 0) {
      const p = el('p', 'bp__empty'); p.textContent = 'No behaviors available for this component type in v1.';
      addSection.appendChild(p);
    }
    for (const { label, kind } of addBtns) {
      const btn = button(label, () => {
        mode = { kind: 'edit', behaviour: null, behaviourKind: kind };
        render();
      });
      btn.className = 'btn-primary';
      btn.style.marginBottom = '0.4rem';
      addSection.appendChild(btn);
    }
    panel.appendChild(addSection);

    // "Show me the code" section: live preview of generated code for this component
    const result = generateAllScripts(current);
    const script = result.scripts.find(s => s.componentId === componentId);
    if (script) {
      const codeSection = el('div', 'bp__section');
      const h3 = el('h4', 'bp__section-title'); h3.textContent = 'Generated code'; codeSection.appendChild(h3);
      const pre = document.createElement('pre');
      pre.className = 'bp__code-preview';
      pre.textContent = script.script;
      codeSection.appendChild(pre);
      panel.appendChild(codeSection);
    }
    const conflict = result.conflicts.get(componentId);
    if (conflict) {
      const warn = el('div', 'bp__conflict-warn');
      warn.textContent = `⚠ ${conflict}`;
      panel.appendChild(warn);
    }
  }

  function renderForm(panel: HTMLElement, comp: Component, _compName: string, m: Extract<PanelMode, { kind: 'edit' }>): void {
    const backBtn = button('← Back', () => { mode = { kind: 'list' }; render(); });
    panel.appendChild(backBtn);

    const formArea = el('div', 'bp__form');
    panel.appendChild(formArea);

    switch (m.behaviourKind) {
      case 'inputFeedback': renderInputFeedbackForm(formArea, comp, m.behaviour as InputFeedback | null); break;
      case 'tableFeedback': renderTableFeedbackForm(formArea, comp, m.behaviour as TableFeedback | null); break;
      case 'carryForward': renderCarryForwardForm(formArea, comp, m.behaviour as CarryForwardBehaviour | null); break;
      case 'showHide': renderShowHideForm(formArea, comp, m.behaviour as ShowHideBehaviour | null); break;
    }
  }

  function renderInputFeedbackForm(form: HTMLElement, comp: Component, existing: InputFeedback | null): void {
    const names = getAllDisplayNames(current);
    const notes = current.screens.flatMap(s => s.components.filter(c => c.type === 'note'));

    form.appendChild(formRow('Source (math response)', text(names.get(comp.id) ?? comp.id, true)));

    // Target note selector
    const noteSelect = select(
      notes.map(n => ({ value: n.id, label: names.get(n.id) ?? n.id })),
      existing?.target,
    );
    form.appendChild(formRow('Target note', noteSelect));

    const correctInput = numberInput(existing?.correct ?? '', 'e.g. 12');
    form.appendChild(formRow('Correct answer', correctInput));

    const tolInput = numberInput(existing?.tolerance ?? 0.001, 'default 0.001');
    form.appendChild(formRow('Tolerance', tolInput));

    const correctMsgInput = textInput(existing?.correctMessage ?? '', 'e.g. Nice work!');
    form.appendChild(formRow('Correct message', correctMsgInput));

    const fallbackInput = textInput(existing?.fallbackMessage ?? '', 'e.g. Not quite. Try again.');
    form.appendChild(formRow('Fallback message', fallbackInput));

    const dcCheck = checkbox('Set dashboard correct (green checkmark)', existing?.setDashboardCorrect ?? true);
    form.appendChild(dcCheck);

    // Rules section
    const rulesSection = el('div', 'bp__rules-section');
    const rulesTitle = el('h4', 'bp__section-title'); rulesTitle.textContent = 'Rules (optional, in order)'; rulesSection.appendChild(rulesTitle);
    const rulesList = el('div', 'bp__rules-list');
    let rules: FeedbackRule[] = existing?.rules ? [...existing.rules] : [];
    renderRulesList(rulesList, rules, () => rerenderRules());
    rulesSection.appendChild(rulesList);

    // Add rule buttons
    const addRuleRow = el('div', 'bp__add-rule-row');
    const ruleTypes: Array<{ label: string; type: FeedbackRule['type'] }> = [
      { label: 'Sign error', type: 'signError' },
      { label: 'Place value', type: 'placeValue' },
      { label: 'Rounding', type: 'rounding' },
      { label: 'Specific value', type: 'specificValue' },
      { label: 'Reciprocal', type: 'reciprocal' },
      { label: 'Squared', type: 'squared' },
      { label: 'Square root', type: 'squareRoot' },
      { label: 'Custom factor', type: 'customFactor' },
      { label: 'Close band', type: 'closeBand' },
      { label: 'Greater than', type: 'greaterThan' },
      { label: 'Less than', type: 'lessThan' },
    ];
    const ruleTypeSelect = select(ruleTypes.map(r => ({ value: r.type, label: r.label })));
    const addRuleBtn = button('+ Add rule', () => {
      const type = ruleTypeSelect.value as FeedbackRule['type'];
      const newRule = defaultRule(type);
      rules.push(newRule);
      rerenderRules();
    });
    addRuleRow.appendChild(ruleTypeSelect);
    addRuleRow.appendChild(addRuleBtn);
    rulesSection.appendChild(addRuleRow);
    form.appendChild(rulesSection);

    function rerenderRules(): void {
      rulesList.innerHTML = '';
      renderRulesList(rulesList, rules, () => rerenderRules());
    }

    // Save button
    const saveBtn = button('Save', () => {
      const targetId = noteSelect.value;
      const c = parseFloat((correctInput as HTMLInputElement).value);
      const tol = parseFloat((tolInput as HTMLInputElement).value);
      const cm = (correctMsgInput as HTMLInputElement).value.trim();
      const fb = (fallbackInput as HTMLInputElement).value.trim();
      const dc = (dcCheck.querySelector('input') as HTMLInputElement).checked;

      if (!targetId) { alert('Please select a target note.'); return; }
      if (isNaN(c)) { alert('Please enter a valid correct answer.'); return; }
      if (!cm) { alert('Please enter a correct message.'); return; }
      if (!fb) { alert('Please enter a fallback message.'); return; }

      const behaviour: InputFeedback = {
        kind: 'feedback', mode: 'input',
        id: existing?.id ?? crypto.randomUUID(),
        source: comp.id, target: targetId,
        correct: c, tolerance: isNaN(tol) ? 0.001 : tol,
        correctMessage: cm, rules: [...rules],
        fallbackMessage: fb, setDashboardCorrect: dc,
      };
      // Switch back to the list before update(), which re-renders the panel.
      mode = { kind: 'list' };
      update(existing ? updateBehaviour(current, behaviour) : addBehaviour(current, behaviour));
    });
    saveBtn.className = 'btn-primary';
    form.appendChild(saveBtn);
  }

  function renderRulesList(container: HTMLElement, rules: FeedbackRule[], onChange: () => void): void {
    if (rules.length === 0) {
      const p = el('p', 'bp__empty'); p.textContent = 'No rules yet.'; container.appendChild(p); return;
    }
    rules.forEach((rule, idx) => {
      const row = el('div', 'bp__rule-row');
      const label = el('span', 'bp__rule-label'); label.textContent = ruleLabel(rule);
      const msgInput = textInput(rule.message, 'Message for this rule');
      msgInput.addEventListener('input', () => {
        rules[idx] = { ...rules[idx], message: (msgInput as HTMLInputElement).value };
      });
      const removeBtn = button('×', () => { rules.splice(idx, 1); onChange(); });
      removeBtn.className = 'bp__rule-remove';
      row.appendChild(label);
      row.appendChild(msgInput);
      row.appendChild(removeBtn);
      container.appendChild(row);
    });
  }

  function renderTableFeedbackForm(form: HTMLElement, comp: Component, existing: TableFeedback | null): void {
    const names = getAllDisplayNames(current);
    form.appendChild(formRow('Source (table)', text(names.get(comp.id) ?? comp.id, true)));

    const tableConfig = comp.table;
    if (!tableConfig) {
      const warn = el('p', 'bp__warn'); warn.textContent = 'This table has no config. Go back to Edit Mapping to set rows, columns, and editable columns.';
      form.appendChild(warn); return;
    }

    const correctSuffixInput = textInput(existing?.correctSuffix ?? '✅', '✅');
    form.appendChild(formRow('Correct suffix', correctSuffixInput));

    const fallbackSuffixInput = textInput(existing?.fallbackSuffix ?? '❌', '❌');
    form.appendChild(formRow('Fallback suffix', fallbackSuffixInput));

    // Per-cell value inputs
    const cellsSection = el('div', 'bp__section');
    const cellsTitle = el('h4', 'bp__section-title'); cellsTitle.textContent = 'Correct values per cell'; cellsSection.appendChild(cellsTitle);
    const cellNote = el('p', 'bp__note'); cellNote.textContent = `Enter correct value for each student cell (tolerance = 0, exact match).`; cellsSection.appendChild(cellNote);

    const cellInputs = new Map<string, HTMLInputElement>();
    const existingValues = existing?.expectation.mode === 'perCell' ? existing.expectation.values : {};

    for (let r = 1; r <= tableConfig.rows; r++) {
      for (const col of tableConfig.editableColumns) {
        const key = `${r},${col}`;
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.className = 'form-input';
        inp.style.width = '7rem';
        inp.value = existingValues[key] != null ? String(existingValues[key]) : '';
        inp.placeholder = `Row ${r}, Col ${col}`;
        cellInputs.set(key, inp);
        cellsSection.appendChild(formRow(`Row ${r}, Col ${col}`, inp));
      }
    }
    form.appendChild(cellsSection);

    const saveBtn = button('Save', () => {
      const values: Record<string, number> = {};
      const cells: TableFeedback['cells'] = [];
      for (const [key, inp] of cellInputs) {
        const v = parseFloat(inp.value);
        if (!isNaN(v)) {
          values[key] = v;
          const [r, c] = key.split(',').map(Number);
          cells.push({ row: r, column: c });
        }
      }
      if (cells.length === 0) { alert('Please enter at least one correct value.'); return; }

      const behaviour: TableFeedback = {
        kind: 'feedback', mode: 'table',
        id: existing?.id ?? crypto.randomUUID(),
        source: comp.id,
        cells,
        expectation: { mode: 'perCell', values },
        tolerance: 0,
        correctSuffix: (correctSuffixInput as HTMLInputElement).value || '✅',
        rules: [],
        fallbackSuffix: (fallbackSuffixInput as HTMLInputElement).value || '❌',
      };
      // Switch back to the list before update(), which re-renders the panel.
      mode = { kind: 'list' };
      update(existing ? updateBehaviour(current, behaviour) : addBehaviour(current, behaviour));
    });
    saveBtn.className = 'btn-primary';
    form.appendChild(saveBtn);
  }

  function renderCarryForwardForm(form: HTMLElement, comp: Component, existing: CarryForwardBehaviour | null): void {
    const names = getAllDisplayNames(current);
    form.appendChild(formRow('Source (math response)', text(names.get(comp.id) ?? comp.id, true)));

    // Find graphs on later screens
    const srcScreenIdx = current.screens.findIndex(s => s.components.some(c => c.id === componentId));
    const graphs = current.screens
      .filter((_, si) => si > srcScreenIdx)
      .flatMap(s => s.components.filter(c => c.type === 'graph'));

    if (graphs.length === 0) {
      const warn = el('p', 'bp__warn'); warn.textContent = 'No graphs found on later screens. Add a graph to a later screen first.';
      form.appendChild(warn); return;
    }

    const destSelect = select(graphs.map(g => ({ value: g.id, label: names.get(g.id) ?? g.id })), existing?.destination);
    form.appendChild(formRow('Destination (graph)', destSelect));

    const mapTypeSelect = select([
      { value: 'mathToGraphExpression', label: 'Expression → graph function (plot the equation)' },
      { value: 'mathToGraphNumber', label: 'Number → graph variable (e.g. carry a slope value)' },
    ], existing?.mapping.type);
    form.appendChild(formRow('Carry type', mapTypeSelect));

    const varInput = textInput(
      existing?.mapping.type === 'mathToGraphExpression' ? existing.mapping.functionName
        : existing?.mapping.type === 'mathToGraphNumber' ? existing.mapping.variable
        : '',
      'e.g. f or a',
    );
    form.appendChild(formRow('Function / variable name', varInput));

    const saveBtn = button('Save', () => {
      const destId = destSelect.value;
      const mapType = mapTypeSelect.value as 'mathToGraphExpression' | 'mathToGraphNumber';
      const varName = (varInput as HTMLInputElement).value.trim();
      if (!destId) { alert('Please select a destination graph.'); return; }
      if (!varName) { alert('Please enter a function or variable name.'); return; }

      const mapping = mapType === 'mathToGraphExpression'
        ? { type: 'mathToGraphExpression' as const, functionName: varName }
        : { type: 'mathToGraphNumber' as const, variable: varName };

      const behaviour: CarryForwardBehaviour = {
        kind: 'carry',
        id: existing?.id ?? crypto.randomUUID(),
        source: comp.id,
        destination: destId,
        mapping,
        fallback: { enabled: false, message: '' },
      };
      // Switch back to the list before update(), which re-renders the panel.
      mode = { kind: 'list' };
      update(existing ? updateBehaviour(current, behaviour) : addBehaviour(current, behaviour));
    });
    saveBtn.className = 'btn-primary';
    form.appendChild(saveBtn);
  }

  function renderShowHideForm(form: HTMLElement, comp: Component, existing: ShowHideBehaviour | null): void {
    const names = getAllDisplayNames(current);
    form.appendChild(formRow('Target (component to hide)', text(names.get(comp.id) ?? comp.id, true)));

    // Find math inputs
    const mathInputs = current.screens.flatMap(s => s.components.filter(c => c.type === 'math'));
    if (mathInputs.length === 0) {
      const warn = el('p', 'bp__warn'); warn.textContent = 'No math responses found in this activity.';
      form.appendChild(warn); return;
    }

    const triggerSelect = select(
      mathInputs.map(m => ({ value: m.id, label: names.get(m.id) ?? m.id })),
      existing?.trigger.type === 'submitted' ? existing.trigger.input : undefined,
    );
    form.appendChild(formRow('Reveal when this input is submitted', triggerSelect));

    const saveBtn = button('Save', () => {
      const inputId = triggerSelect.value;
      if (!inputId) { alert('Please select a math response.'); return; }
      const behaviour: ShowHideBehaviour = {
        kind: 'showHide',
        id: existing?.id ?? crypto.randomUUID(),
        target: comp.id,
        trigger: { type: 'submitted', input: inputId },
      };
      // Switch back to the list before update(), which re-renders the panel.
      mode = { kind: 'list' };
      update(existing ? updateBehaviour(current, behaviour) : addBehaviour(current, behaviour));
    });
    saveBtn.className = 'btn-primary';
    form.appendChild(saveBtn);
  }

  render();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function findComponent(activity: Activity, componentId: Id): Component | undefined {
  for (const screen of activity.screens) {
    const comp = screen.components.find(c => c.id === componentId);
    if (comp) return comp;
  }
  return undefined;
}

function behaviourInvolvesComponent(b: Activity['behaviours'][0], compId: Id): boolean {
  if (b.kind === 'feedback') return b.source === compId || (b.mode === 'input' && b.target === compId);
  if (b.kind === 'carry') return b.source === compId || b.destination === compId;
  if (b.kind === 'showHide') return b.target === compId || b.trigger.input === compId;
  return false;
}

function inferKind(b: Activity['behaviours'][0]): 'inputFeedback' | 'tableFeedback' | 'carryForward' | 'showHide' {
  if (b.kind === 'feedback' && b.mode === 'input') return 'inputFeedback';
  if (b.kind === 'feedback' && b.mode === 'table') return 'tableFeedback';
  if (b.kind === 'carry') return 'carryForward';
  return 'showHide';
}

function availableActions(comp: Component): Array<{ label: string; kind: 'inputFeedback' | 'tableFeedback' | 'carryForward' | 'showHide' }> {
  const actions: Array<{ label: string; kind: 'inputFeedback' | 'tableFeedback' | 'carryForward' | 'showHide' }> = [];
  if (comp.type === 'math') {
    actions.push({ label: 'Add input feedback', kind: 'inputFeedback' });
    actions.push({ label: 'Carry value to a graph', kind: 'carryForward' });
  }
  if (comp.type === 'table') {
    actions.push({ label: 'Add table feedback', kind: 'tableFeedback' });
  }
  if (['note', 'text', 'mc', 'check', 'table', 'graph', 'sketch', 'button', 'image'].includes(comp.type as string)) {
    actions.push({ label: 'Show/hide on submit', kind: 'showHide' });
  }
  return actions;
}

function describeBehaviour(b: Activity['behaviours'][0], names: Map<Id, string>): string {
  if (b.kind === 'feedback' && b.mode === 'input') {
    const src = names.get(b.source) ?? b.source;
    const tgt = names.get(b.target) ?? b.target;
    return `Input feedback: ${src} → ${tgt} (correct: ${b.correct})`;
  }
  if (b.kind === 'feedback' && b.mode === 'table') {
    const src = names.get(b.source) ?? b.source;
    return `Table feedback: ${src} (${b.cells.length} cell${b.cells.length !== 1 ? 's' : ''})`;
  }
  if (b.kind === 'carry') {
    const src = names.get(b.source) ?? b.source;
    const dst = names.get(b.destination) ?? b.destination;
    return `Carry: ${src} → ${dst} (${b.mapping.type})`;
  }
  // showHide
  const tgt = names.get(b.target) ?? b.target;
  const inp = names.get(b.trigger.input) ?? b.trigger.input;
  return `Show/hide: ${tgt} when ${inp} ${b.trigger.type}`;
}

function ruleLabel(rule: FeedbackRule): string {
  switch (rule.type) {
    case 'signError': return 'Sign error';
    case 'placeValue': return `Place value [${rule.factors.join(', ')}]`;
    case 'rounding': return `Rounding (±${rule.tolerance})`;
    case 'specificValue': return `Specific value ${rule.value}`;
    case 'reciprocal': return 'Reciprocal';
    case 'squared': return 'Squared';
    case 'squareRoot': return 'Square root';
    case 'customFactor': return `×${rule.factor}`;
    case 'closeBand': return `Close (±${rule.tolerance})`;
    case 'between': return `Between ${rule.min} and ${rule.max}`;
    case 'greaterThan': return `Greater than ${rule.value}`;
    case 'lessThan': return `Less than ${rule.value}`;
  }
}

function defaultRule(type: FeedbackRule['type']): FeedbackRule {
  const id = crypto.randomUUID();
  switch (type) {
    case 'placeValue': return { id, type, message: '', factors: [0.1, 10] };
    case 'rounding': return { id, type, message: '', tolerance: 1 };
    case 'specificValue': return { id, type, message: '', value: 0 };
    case 'customFactor': return { id, type, message: '', factor: 2 };
    case 'closeBand': return { id, type, message: '', tolerance: 1 };
    case 'between': return { id, type, message: '', min: 0, max: 10 };
    case 'greaterThan': return { id, type, message: '', value: 0 };
    case 'lessThan': return { id, type, message: '', value: 0 };
    default: return { id, type, message: '' } as FeedbackRule;
  }
}

// ── DOM helpers ───────────────────────────────────────────────────────────────

function el(tag: string, className?: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

function formRow(labelText: string, input: HTMLElement): HTMLElement {
  const row = el('div', 'bp__form-row');
  const lbl = document.createElement('label');
  lbl.className = 'bp__form-label';
  lbl.textContent = labelText;
  row.appendChild(lbl);
  row.appendChild(input);
  return row;
}

function text(value: string, _readonly = false): HTMLElement {
  const span = el('span', 'bp__static-value');
  span.textContent = value;
  return span;
}

function textInput(value: string | number, placeholder = ''): HTMLElement {
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.className = 'form-input';
  inp.value = String(value);
  inp.placeholder = placeholder;
  return inp;
}

function numberInput(value: string | number, placeholder = ''): HTMLElement {
  const inp = document.createElement('input');
  inp.type = 'number';
  inp.className = 'form-input';
  inp.value = String(value);
  inp.placeholder = placeholder;
  return inp;
}

function select(options: Array<{ value: string; label: string }>, selected?: string): HTMLSelectElement {
  const sel = document.createElement('select');
  sel.className = 'form-select';
  for (const opt of options) {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.label;
    if (opt.value === selected) o.selected = true;
    sel.appendChild(o);
  }
  return sel;
}

function checkbox(labelText: string, checked: boolean): HTMLElement {
  const wrap = el('label', 'bp__checkbox-row');
  const inp = document.createElement('input');
  inp.type = 'checkbox';
  inp.checked = checked;
  wrap.appendChild(inp);
  wrap.append(` ${labelText}`);
  return wrap;
}
