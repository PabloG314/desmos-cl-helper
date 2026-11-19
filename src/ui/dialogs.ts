import type { Activity, Id } from '../model/types';
import { getAllDisplayNames, validateComponentName, autoName, nextFreeIndex } from '../model/naming';

/** Show a blocking modal overlay. Returns a cleanup function. */
function showOverlay(content: HTMLElement): () => void {
  const overlay = document.createElement('div');
  overlay.className = 'dialog-overlay';
  const dialog = document.createElement('div');
  dialog.className = 'dialog';
  dialog.appendChild(content);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  return () => document.body.removeChild(overlay);
}

/**
 * Move modal: shown when dragging an auto-named component to a different screen.
 * Resolves with the chosen name, or null if cancelled.
 */
export function showMoveModal(
  activity: Activity,
  componentId: Id,
  targetScreenId: Id,
): Promise<string | null> {
  return new Promise(resolve => {
    const names = getAllDisplayNames(activity);
    const comp = activity.screens.flatMap(s => s.components).find(c => c.id === componentId);
    if (!comp) { resolve(null); return; }

    const oldName = names.get(componentId) ?? componentId;
    const targetScreenIdx = activity.screens.findIndex(s => s.id === targetScreenId);
    const targetScreenNum = targetScreenIdx + 1;

    // Compute suggested new name
    let suggestedNewName = oldName;
    if (comp.name.kind === 'auto') {
      // Temporarily remove from old screen to find free index on target
      const tempScreens = activity.screens.map(s => ({
        ...s, components: s.components.filter(c => c.id !== componentId),
      }));
      const tempActivity = { ...activity, screens: tempScreens };
      const newIdx = nextFreeIndex(tempActivity, targetScreenId, comp.type);
      suggestedNewName = autoName(comp.type, targetScreenNum, newIdx);
    }

    const content = document.createElement('div');
    content.innerHTML = `<h3 class="dialog__title">Component moved</h3>
      <p>This component moved to Screen ${targetScreenNum}. Its name should change from <strong>${oldName}</strong> to <strong>${suggestedNewName}</strong>.</p>
      <p>You'll also need to rename it in Desmos.</p>`;

    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'form-input';
    inp.value = suggestedNewName;
    inp.style.marginBottom = '0.75rem';

    const errorEl = document.createElement('span');
    errorEl.className = 'dialog__error';

    const btnRow = document.createElement('div');
    btnRow.className = 'dialog__btn-row';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel move';

    const acceptBtn = document.createElement('button');
    acceptBtn.textContent = 'Accept';
    acceptBtn.className = 'btn-primary';

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(acceptBtn);
    content.appendChild(inp);
    content.appendChild(errorEl);
    content.appendChild(btnRow);

    const cleanup = showOverlay(content);

    cancelBtn.addEventListener('click', () => { cleanup(); resolve(null); });
    acceptBtn.addEventListener('click', () => {
      const name = inp.value.trim();
      const err = validateComponentName(name, activity, componentId);
      if (err) { errorEl.textContent = err; return; }
      cleanup();
      resolve(name);
    });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') acceptBtn.click();
      if (e.key === 'Escape') cancelBtn.click();
    });
  });
}

export interface ReorderWarningResult { confirmed: boolean }

/**
 * Reorder warning: shown before screen reorder.
 * Shows counts and asks to confirm or cancel.
 */
export function showReorderWarning(
  renameCount: number,
  onConfirm: () => void,
  onCancel: () => void,
): void {
  const content = document.createElement('div');
  content.innerHTML = `<h3 class="dialog__title">Reorder screens?</h3>
    <p>This will rename <strong>${renameCount} component${renameCount !== 1 ? 's' : ''}</strong>. All affected scripts will need re-copying.</p>
    <p>You'll see a checklist of renames to do in Desmos.</p>`;

  const btnRow = document.createElement('div');
  btnRow.className = 'dialog__btn-row';
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = 'Continue';
  confirmBtn.className = 'btn-primary';
  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(confirmBtn);
  content.appendChild(btnRow);

  const cleanup = showOverlay(content);
  cancelBtn.addEventListener('click', () => { cleanup(); onCancel(); });
  confirmBtn.addEventListener('click', () => { cleanup(); onConfirm(); });
}

/**
 * Delete component confirmation: lists affected behaviours.
 */
export function showDeleteConfirm(
  activity: Activity,
  componentId: Id,
  onConfirm: () => void,
): void {
  const names = getAllDisplayNames(activity);
  const compName = names.get(componentId) ?? componentId;
  const affected = activity.behaviours.filter(b => {
    if (b.kind === 'feedback') return b.source === componentId || (b.mode === 'input' && b.target === componentId);
    if (b.kind === 'carry') return b.source === componentId || b.destination === componentId;
    if (b.kind === 'showHide') return b.target === componentId || b.trigger.input === componentId;
    return false;
  });

  const content = document.createElement('div');
  let html = `<h3 class="dialog__title">Delete ${compName}?</h3>`;
  if (affected.length > 0) {
    html += `<p>This will also remove ${affected.length} behaviour${affected.length > 1 ? 's' : ''}:</p><ul>`;
    for (const b of affected) {
      const desc =
        b.kind === 'feedback' && b.mode === 'input' ? `Feedback on ${names.get(b.source) ?? b.source}`
        : b.kind === 'feedback' ? `Table feedback on ${names.get(b.source) ?? b.source}`
        : b.kind === 'carry' ? `Carry from ${names.get(b.source) ?? b.source}`
        : `Show/hide on ${names.get(b.target) ?? b.target}`;
      html += `<li>${desc}</li>`;
    }
    html += '</ul>';
  }
  content.innerHTML = html;

  const btnRow = document.createElement('div');
  btnRow.className = 'dialog__btn-row';
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = 'Delete';
  confirmBtn.style.cssText = 'color:#c00;border-color:#fcc;';
  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(confirmBtn);
  content.appendChild(btnRow);

  const cleanup = showOverlay(content);
  cancelBtn.addEventListener('click', () => cleanup());
  confirmBtn.addEventListener('click', () => { cleanup(); onConfirm(); });
}
