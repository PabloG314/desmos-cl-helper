import type { Activity, Id } from '../model/types';
import { generateAllScripts, type ComponentScript } from '../codegen/generate';
import { markCopied } from '../model/activity';
import { exportActivity } from '../persistence/file';
import { buildShareUrl } from '../persistence/share';

export function renderCodePanel(
  container: HTMLElement,
  initial: Activity,
  onUpdate: (a: Activity) => void,
  onBack: () => void,
): void {
  let current = initial;

  function update(a: Activity): void {
    current = a;
    onUpdate(a);
    render();
  }

  function render(): void {
    container.innerHTML = '';
    const wrap = el('div', 'code-panel');

    // Top bar
    const topBar = el('div', 'code-panel__topbar');
    const backBtn = button('← Back to map', onBack);
    const title = el('h2', 'code-panel__title');
    title.textContent = current.title;
    const exportBtn = button('Export file', () => exportActivity(current));
    const shareBtn = button('Copy share link', () => {
      try {
        const url = buildShareUrl(current);
        navigator.clipboard.writeText(url).then(() => alert('Share link copied to clipboard!'));
      } catch {
        alert('Share link could not be built in this browser.');
      }
    });
    topBar.appendChild(backBtn);
    topBar.appendChild(title);
    topBar.appendChild(exportBtn);
    topBar.appendChild(shareBtn);
    wrap.appendChild(topBar);

    const result = generateAllScripts(current);

    // "To do" summary
    const pending = current.pendingRenames.filter(r => !r.doneInDesmos);
    const stale = result.scripts.filter(s => {
      const cs = current.copyState[s.componentId];
      return cs?.lastCopiedHash && cs.lastCopiedHash !== s.hash;
    });
    if (pending.length > 0 || stale.length > 0) {
      const todo = el('div', 'code-panel__todo');
      const strong = document.createElement('strong');
      strong.textContent = 'To do in Desmos: ';
      todo.appendChild(strong);
      const items: string[] = [];
      if (pending.length > 0) items.push(`${pending.length} rename${pending.length > 1 ? 's' : ''}`);
      if (stale.length > 0) items.push(`${stale.length} script${stale.length > 1 ? 's' : ''} need re-copying`);
      todo.append(items.join(' · '));
      wrap.appendChild(todo);
    }

    // Conflict warnings
    if (result.conflicts.size > 0) {
      const conflictWarn = el('div', 'code-panel__conflict-banner');
      conflictWarn.innerHTML = `<strong>⚠ ${result.conflicts.size} conflict${result.conflicts.size > 1 ? 's' : ''}</strong> — some scripts could not be generated. Open those components in the behaviour panel to fix.`;
      wrap.appendChild(conflictWarn);
    }

    if (result.scripts.length === 0) {
      const empty = el('p', 'code-panel__empty');
      empty.textContent = 'No behaviours configured yet. Go back to the map and click a component to add behaviours.';
      wrap.appendChild(empty);
    }

    // Scripts grouped by screen
    current.screens.forEach((screen, si) => {
      const screenScripts = result.scripts.filter(s =>
        screen.components.some(c => c.id === s.componentId)
      );
      if (screenScripts.length === 0) return;

      const screenHeader = el('h3', 'code-panel__screen-header');
      screenHeader.textContent = `Screen ${si + 1}`;
      wrap.appendChild(screenHeader);

      for (const script of screenScripts) {
        wrap.appendChild(buildScriptCard(script));
      }
    });

    container.appendChild(wrap);
  }

  function buildScriptCard(script: ComponentScript): HTMLElement {
    const card = el('div', 'cp-script');

    // Location + status
    const topRow = el('div', 'cp-script__top');
    const loc = el('span', 'cp-script__location');
    loc.textContent = script.location;
    const badge = buildStatusBadge(script.componentId, script.hash);
    topRow.appendChild(loc);
    topRow.appendChild(badge);
    card.appendChild(topRow);

    // Setup reminders
    if (script.setupReminders.length > 0) {
      const reminders = el('ul', 'cp-script__reminders');
      for (const r of script.setupReminders) {
        const li = document.createElement('li');
        li.textContent = r;
        reminders.appendChild(li);
      }
      card.appendChild(reminders);
    }

    // Code block
    const pre = document.createElement('pre');
    pre.className = 'cp-script__code';
    pre.textContent = script.script;
    card.appendChild(pre);

    // Copy button
    const copyBtn = button('Copy', () => {
      navigator.clipboard.writeText(script.script).then(() => {
        update(markCopied(current, script.componentId, script.hash));
      }).catch(() => {
        // Fallback for browsers without clipboard API
        const ta = document.createElement('textarea');
        ta.value = script.script;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        update(markCopied(current, script.componentId, script.hash));
      });
    });
    copyBtn.className = 'btn-primary cp-script__copy';
    card.appendChild(copyBtn);

    return card;
  }

  function buildStatusBadge(componentId: Id, currentHash: string): HTMLElement {
    const cs = current.copyState[componentId];
    const badge = el('span', 'badge');
    if (!cs?.lastCopiedHash) {
      badge.textContent = 'New';
      badge.classList.add('badge--new');
    } else if (cs.lastCopiedHash === currentHash) {
      badge.textContent = 'Up to date';
      badge.classList.add('badge--ok');
    } else {
      badge.textContent = 'Needs re-copying';
      badge.classList.add('badge--stale');
    }
    return badge;
  }

  render();
}

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
