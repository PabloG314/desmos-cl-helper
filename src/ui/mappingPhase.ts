import type { Activity, ComponentType, TableConfig } from '../model/types';
import { setScreenCount, addComponent, removeHighestIndexedAutoComponent } from '../model/activity';
import { getAllDisplayNames } from '../model/naming';

const COMPONENT_TYPES: { type: ComponentType; label: string }[] = [
  { type: 'note',   label: 'Note' },
  { type: 'math',   label: 'Math response' },
  { type: 'text',   label: 'Text input' },
  { type: 'mc',     label: 'Multiple choice' },
  { type: 'check',  label: 'Checkboxes' },
  { type: 'table',  label: 'Table' },
  { type: 'graph',  label: 'Graph' },
  { type: 'sketch', label: 'Sketch' },
  { type: 'button', label: 'Button' },
  { type: 'image',  label: 'Image' },
];

export function renderMappingPhase(
  container: HTMLElement,
  initial: Activity,
  onUpdate: (a: Activity) => void,
  onDone: (a: Activity) => void,
): void {
  let current = initial.screens.length === 0 ? setScreenCount(initial, 1) : initial;
  if (current !== initial) onUpdate(current);

  function update(a: Activity): void {
    current = a;
    onUpdate(a);
    renderCards();
  }

  function renderCards(): void {
    const board = container.querySelector<HTMLElement>('.mapping-board');
    if (!board) return;
    board.innerHTML = '';
    current.screens.forEach((screen, si) => {
      board.appendChild(buildCard(screen.id, si + 1));
    });
  }

  // Build the shell once; only re-render the board section on updates.
  container.innerHTML = '';
  const wrap = el('div', 'mapping-phase');

  const hdr = el('div', 'mapping-phase__header');
  const h2 = document.createElement('h2');
  h2.textContent = current.title;
  hdr.appendChild(h2);
  wrap.appendChild(hdr);

  // Screen count row
  const countRow = el('div', 'mapping-phase__count-row');
  const lbl = document.createElement('label');
  lbl.textContent = 'Screens: ';
  const countInput = document.createElement('input');
  countInput.type = 'number';
  countInput.min = '1';
  countInput.max = '100';
  countInput.value = String(current.screens.length);
  countInput.className = 'screen-count-input';
  countInput.addEventListener('change', () => {
    const n = Math.max(1, Math.min(100, parseInt(countInput.value, 10) || 1));
    countInput.value = String(n);
    update(setScreenCount(current, n));
  });
  lbl.appendChild(countInput);
  countRow.appendChild(lbl);
  wrap.appendChild(countRow);

  // Board (re-rendered on each update)
  const board = el('div', 'mapping-board');
  wrap.appendChild(board);

  // Footer
  const footer = el('div', 'mapping-phase__footer');
  const doneBtn = button('Map view →', () => onDone(current));
  doneBtn.className = 'btn-primary';
  footer.appendChild(doneBtn);
  wrap.appendChild(footer);

  container.appendChild(wrap);
  renderCards();

  function buildCard(screenId: string, screenNumber: number): HTMLElement {
    const card = el('div', 'mapping-card');
    const h3 = document.createElement('h3');
    h3.textContent = `Screen ${screenNumber}`;
    card.appendChild(h3);

    const displayNames = getAllDisplayNames(current);
    const screen = current.screens.find(s => s.id === screenId)!;
    const grid = el('ul', 'mapping-card__grid');

    COMPONENT_TYPES.forEach(({ type, label }) => {
      const compsOfType = screen.components.filter(c => c.type === type);
      const count = compsOfType.length;
      const hasAuto = compsOfType.some(c => c.name.kind === 'auto');

      const li = el('li', 'mapping-type-row');

      const typeLbl = el('span', 'mapping-type-label');
      typeLbl.textContent = label;
      li.appendChild(typeLbl);

      const minusBtn = document.createElement('button');
      minusBtn.textContent = '−';
      minusBtn.className = 'counter-btn';
      minusBtn.disabled = !hasAuto;
      minusBtn.setAttribute('aria-label', `Remove ${label}`);
      minusBtn.addEventListener('click', () =>
        update(removeHighestIndexedAutoComponent(current, screenId, type)),
      );
      li.appendChild(minusBtn);

      const countSpan = el('span', 'counter-value');
      countSpan.textContent = String(count);
      li.appendChild(countSpan);

      const plusBtn = document.createElement('button');
      plusBtn.textContent = '+';
      plusBtn.className = 'counter-btn';
      plusBtn.setAttribute('aria-label', `Add ${label}`);
      plusBtn.addEventListener('click', () => {
        if (type === 'table') {
          const cfg = promptTableConfig();
          if (!cfg) return;
          update(addComponent(current, screenId, type, cfg));
        } else {
          update(addComponent(current, screenId, type));
        }
      });
      li.appendChild(plusBtn);

      if (count > 0) {
        const names = el('span', 'mapping-type-names');
        names.textContent = compsOfType.map(c => displayNames.get(c.id) ?? '').join(', ');
        li.appendChild(names);
      }

      grid.appendChild(li);
    });

    card.appendChild(grid);
    return card;
  }
}

function promptTableConfig(): TableConfig | null {
  const rowsStr = prompt('Table: how many data rows? (not counting the header)');
  if (rowsStr === null) return null;
  const rows = parseInt(rowsStr, 10);
  if (!Number.isInteger(rows) || rows < 1) {
    alert('Enter a positive integer for rows.');
    return null;
  }

  const colsStr = prompt('How many columns?');
  if (colsStr === null) return null;
  const columns = parseInt(colsStr, 10);
  if (!Number.isInteger(columns) || columns < 1) {
    alert('Enter a positive integer for columns.');
    return null;
  }

  const editStr = prompt(
    `Which columns do students fill in? Enter column numbers separated by commas (1–${columns}).`,
  );
  if (editStr === null) return null;
  const editableColumns = editStr
    .split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => Number.isInteger(n) && n >= 1 && n <= columns);
  if (editableColumns.length === 0) {
    alert('Enter at least one valid column number.');
    return null;
  }

  return { rows, columns, editableColumns };
}

function el(tag: string, className?: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

function button(text: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.textContent = text;
  btn.addEventListener('click', onClick);
  return btn;
}
