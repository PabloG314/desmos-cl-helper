import Sortable from 'sortablejs';
import type { Activity, Component, Id } from '../model/types';
import { renameComponent, moveComponent, reorderScreens, removeHighestIndexedAutoComponent } from '../model/activity';
import { getAllDisplayNames, validateComponentName } from '../model/naming';
import { renderBehaviourPanel } from './behaviourPanel';
import { renderIdeasPanel } from './ideasPanel';
import { showMoveModal, showReorderWarning, showDeleteConfirm } from './dialogs';
import { previewReorder } from '../model/ordering';
import type { Idea } from '../ideas/rules';

export function renderMapView(
  container: HTMLElement,
  initial: Activity,
  onUpdate: (a: Activity) => void,
  onEditMapping: () => void,
  onGenerateCode: (a: Activity) => void,
): void {
  let current = initial;
  let selectedComponentId: Id | null = null;

  function update(a: Activity): void {
    current = a;
    onUpdate(a);
    render();
  }

  function render(): void {
    container.innerHTML = '';
    const wrap = el('div', 'map-view');

    // Top bar
    const topBar = el('div', 'map-view__topbar');
    const editBtn = button('← Edit mapping', onEditMapping);
    const titleEl = document.createElement('h2');
    titleEl.className = 'map-view__title';
    titleEl.textContent = current.title;
    const codeBtn = button('Generate code →', () => onGenerateCode(current));
    codeBtn.className = 'btn-primary';
    topBar.appendChild(editBtn);
    topBar.appendChild(titleEl);
    topBar.appendChild(codeBtn);
    wrap.appendChild(topBar);

    // Pending renames banner
    const pending = current.pendingRenames.filter(r => !r.doneInDesmos);
    if (pending.length > 0) {
      const banner = el('div', 'banner banner--warn');
      const strong = document.createElement('strong');
      strong.textContent = 'To do in Desmos: ';
      banner.appendChild(strong);
      banner.append(
        `${pending.length} pending rename${pending.length > 1 ? 's' : ''} — ` +
        pending.map(r => `${r.oldName} → ${r.newName}`).join(', '),
      );
      wrap.appendChild(banner);
    }

    // Main content area: board + side panel
    const contentArea = el('div', 'map-view__content');

    // Board
    const board = el('div', 'map-board');
    board.id = 'map-board';
    if (current.screens.length === 0) {
      const empty = el('p', 'map-board__empty');
      empty.textContent = 'No screens yet. Go back to Edit mapping to add screens.';
      board.appendChild(empty);
    } else {
      current.screens.forEach((screen, si) => {
        board.appendChild(buildScreenCard(screen.id, screen.components, si + 1));
      });
      // Enable SortableJS on the board for reordering screen cards
      Sortable.create(board, {
        animation: 150,
        handle: '.map-screen-card__drag-handle',
        onEnd: evt => {
          const from = evt.oldIndex;
          const to = evt.newIndex;
          if (from === undefined || to === undefined || from === to) return;
          const preview = previewReorder(current, from, to);
          if (preview.renameCount > 0) {
            showReorderWarning(
              preview.renameCount,
              () => update(reorderScreens(current, from, to)),
              () => { /* restore sort order by re-rendering */ render(); },
            );
          } else {
            update(reorderScreens(current, from, to));
          }
        },
      });
    }
    contentArea.appendChild(board);

    // Behaviour panel (side panel) if a component is selected
    if (selectedComponentId) {
      const panelContainer = el('div', 'map-view__side-panel');
      renderBehaviourPanel(
        panelContainer,
        selectedComponentId,
        current,
        a => { current = a; onUpdate(a); renderPanel(panelContainer); },
        () => { selectedComponentId = null; render(); },
      );
      contentArea.appendChild(panelContainer);
    }

    wrap.appendChild(contentArea);

    // Ideas panel at the bottom
    const ideasContainer = el('div', 'map-view__ideas');
    renderIdeasPanel(
      ideasContainer,
      current,
      a => { update(a); },
      (idea: Idea, a: Activity) => {
        // Pre-select the component and open in behaviour panel
        selectedComponentId = idea.componentId;
        update(a);
      },
    );
    wrap.appendChild(ideasContainer);

    container.appendChild(wrap);
  }

  function renderPanel(panelContainer: HTMLElement): void {
    if (!selectedComponentId) return;
    panelContainer.innerHTML = '';
    renderBehaviourPanel(
      panelContainer,
      selectedComponentId,
      current,
      a => { current = a; onUpdate(a); renderPanel(panelContainer); },
      () => { selectedComponentId = null; render(); },
    );
  }

  function buildScreenCard(
    screenId: string,
    components: Component[],
    screenNumber: number,
  ): HTMLElement {
    const card = el('div', 'map-screen-card');
    card.dataset['screenId'] = screenId;

    // Drag handle + title row
    const titleRow = el('div', 'map-screen-card__title-row');
    const handle = el('span', 'map-screen-card__drag-handle');
    handle.textContent = '⠿';
    handle.title = 'Drag to reorder screen';
    const h3 = document.createElement('h3');
    h3.className = 'map-screen-card__title';
    h3.textContent = `Screen ${screenNumber}`;
    titleRow.appendChild(handle);
    titleRow.appendChild(h3);
    card.appendChild(titleRow);

    if (components.length === 0) {
      const empty = el('p', 'map-screen-card__empty');
      empty.textContent = 'No components';
      card.appendChild(empty);
    } else {
      const displayNames = getAllDisplayNames(current);
      const list = el('ul', 'map-comp-list');
      list.dataset['screenId'] = screenId;

      components.forEach(comp => {
        list.appendChild(buildCompItem(comp, displayNames.get(comp.id) ?? comp.id));
      });
      card.appendChild(list);

      // SortableJS for dragging components between screens
      Sortable.create(list, {
        group: 'components',
        animation: 150,
        onEnd: async evt => {
          const compId = (evt.item as HTMLElement).dataset['compId'];
          const toScreenId = (evt.to as HTMLElement).dataset['screenId'];
          const fromScreenId = (evt.from as HTMLElement).dataset['screenId'];
          if (!compId || !toScreenId || !fromScreenId || fromScreenId === toScreenId) return;

          const comp = current.screens.flatMap(s => s.components).find(c => c.id === compId);
          if (!comp) return;

          if (comp.name.kind === 'auto') {
            const chosenName = await showMoveModal(current, compId, toScreenId);
            if (chosenName === null) { render(); return; } // cancelled
            update(moveComponent(current, compId, toScreenId, chosenName));
          } else {
            update(moveComponent(current, compId, toScreenId));
          }
        },
      });
    }

    return card;
  }

  function buildCompItem(comp: Component, displayName: string): HTMLElement {
    const li = el('li', 'map-comp-item');
    li.dataset['compId'] = comp.id;

    // Selected highlight
    if (comp.id === selectedComponentId) {
      li.classList.add('map-comp-item--selected');
    }

    const nameWrap = el('span', 'map-comp-name-wrap');

    const nameSpan = document.createElement('span');
    nameSpan.className = 'map-comp-name';
    nameSpan.textContent = displayName;
    nameSpan.title = 'Click to open behavior panel (double-click to rename)';
    nameSpan.tabIndex = 0;

    const errorSpan = el('span', 'map-comp-name-error');

    // Single click → open behaviour panel
    nameSpan.addEventListener('click', () => {
      selectedComponentId = comp.id === selectedComponentId ? null : comp.id;
      render();
    });
    // Double click → inline rename
    nameSpan.addEventListener('dblclick', e => {
      e.stopPropagation();
      startInlineEdit(nameSpan, errorSpan, comp, displayName);
    });
    nameSpan.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectedComponentId = comp.id === selectedComponentId ? null : comp.id;
        render();
      }
    });

    nameWrap.appendChild(nameSpan);
    nameWrap.appendChild(errorSpan);

    const typeTag = el('span', 'map-comp-type');
    typeTag.textContent = comp.type;

    li.appendChild(nameWrap);
    li.appendChild(typeTag);

    // Link badge
    const isLinked = current.behaviours.some(b => {
      if (b.kind === 'feedback') return b.source === comp.id || (b.mode === 'input' && b.target === comp.id);
      if (b.kind === 'carry') return b.source === comp.id || b.destination === comp.id;
      if (b.kind === 'showHide') return b.target === comp.id || b.trigger.input === comp.id;
      return false;
    });
    if (isLinked) {
      const badge = el('span', 'badge badge--linked');
      badge.textContent = '⟷';
      badge.title = 'Has a behavior';
      li.appendChild(badge);
    }

    // Stale badge
    const result = current.copyState[comp.id];
    if (result?.lastCopiedHash) {
      // Check if hash changed — we'd need to regenerate; for a quick check just show a dot
      // We'll use the stale detection from generate in the code panel; here just show if ever copied
    }

    return li;
  }

  function startInlineEdit(
    nameSpan: HTMLElement,
    errorSpan: HTMLElement,
    comp: Component,
    currentName: string,
  ): void {
    const input = document.createElement('input');
    input.className = 'map-comp-name-input';
    input.value = currentName;
    input.size = Math.max(currentName.length + 2, 10);

    nameSpan.replaceWith(input);
    input.focus();
    input.select();

    let committed = false;

    function finish(save: boolean): void {
      if (committed) return;
      committed = true;

      const newName = input.value.trim();
      if (save && newName && newName !== currentName) {
        const error = validateComponentName(newName, current, comp.id);
        if (error) {
          committed = false;
          errorSpan.textContent = error;
          input.focus();
          return;
        }
        errorSpan.textContent = '';
        input.replaceWith(nameSpan);
        nameSpan.textContent = newName;
        update(renameComponent(current, comp.id, newName));
      } else {
        errorSpan.textContent = '';
        input.replaceWith(nameSpan);
      }
    }

    input.addEventListener('blur', () => finish(true));
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    });
  }

  render();
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
