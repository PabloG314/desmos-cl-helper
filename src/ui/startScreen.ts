import type { Activity } from '../model/types';
import { createActivity } from '../model/activity';
import {
  loadIndex,
  loadActivity,
  saveActivity,
  deleteActivity,
  storageAvailable,
  type ActivitySummary,
} from '../persistence/storage';
import { importActivityFromJson } from '../persistence/file';
import { parseShareUrl } from '../persistence/share';

export interface StartScreenCallbacks {
  onOpen: (activity: Activity) => void;
  onNew: (activity: Activity) => void;
  onImport?: (activity: Activity) => void;
}

export function renderStartScreen(
  container: HTMLElement,
  callbacks: StartScreenCallbacks,
): void {
  const noStorage = !storageAvailable();

  // Check for a share link in the URL hash on first load
  const shareActivity = (() => {
    try {
      const hash = window.location.hash;
      if (hash.startsWith('#m=')) {
        const a = parseShareUrl(window.location.href);
        if (a) {
          history.replaceState(null, '', window.location.pathname + window.location.search);
          return a;
        }
      }
    } catch { /* ignore */ }
    return null;
  })();

  if (shareActivity) {
    // Show import prompt for the share link
    setTimeout(() => {
      const replace = loadActivity(shareActivity.id)
        ? confirm(`Open shared activity "${shareActivity.title}"? OK = open, Cancel = discard.`)
        : true;
      if (replace) {
        saveActivity(shareActivity);
        callbacks.onOpen(shareActivity);
      }
    }, 0);
  }

  function render(): void {
    container.innerHTML = '';
    const wrap = el('div', 'start-screen');

    const homeLink = document.createElement('a');
    homeLink.className = 'start-screen__home';
    homeLink.href = 'https://mathedpotatoes.com';
    homeLink.textContent = '← Back to MathEdPotatoes.com';
    wrap.appendChild(homeLink);

    wrap.appendChild(heading('h1', 'Desmos CL Helper'));

    const intro = el('p', 'start-screen__tutorial');
    intro.append('New here? ');
    const tutorialLink = document.createElement('a');
    tutorialLink.href = `${import.meta.env.BASE_URL}tutorial.html`;
    tutorialLink.textContent = 'Follow the tutorial';
    intro.appendChild(tutorialLink);
    intro.append(' to build a small practice activity and see how the helper works.');
    wrap.appendChild(intro);

    if (noStorage) {
      const banner = el('p', 'banner banner--warn');
      banner.textContent =
        'Local storage is unavailable. Changes will not be saved. Consider exporting your work.';
      wrap.appendChild(banner);
    }

    const actions = el('div', 'start-screen__actions');

    const newBtn = button('New activity', () => {
      const title = prompt('Activity title:');
      if (!title?.trim()) return;
      const activity = createActivity(title.trim());
      callbacks.onNew(activity);
    });
    actions.appendChild(newBtn);

    const importBtn = button('Import file', handleImport);
    actions.appendChild(importBtn);

    wrap.appendChild(actions);

    const activities = loadIndex();
    if (activities.length === 0) {
      const empty = el('p', 'start-screen__empty');
      empty.textContent = 'No saved activities yet.';
      wrap.appendChild(empty);
    } else {
      const list = el('ul', 'start-screen__list');
      activities.forEach(summary => list.appendChild(buildItem(summary)));
      wrap.appendChild(list);
    }

    container.appendChild(wrap);
  }

  function buildItem(summary: ActivitySummary): HTMLElement {
    const li = el('li', 'activity-item');

    const info = el('div', 'activity-item__info');

    const titleBtn = button(summary.title, () => {
      const activity = loadActivity(summary.id);
      if (activity) callbacks.onOpen(activity);
    });
    titleBtn.className = 'activity-item__title';
    info.appendChild(titleBtn);

    const meta = el('span', 'activity-item__meta');
    meta.textContent = `Updated ${formatDate(summary.updatedAt)}`;
    if (summary.desmosUrl) {
      const link = document.createElement('a');
      link.href = summary.desmosUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = ' (Desmos)';
      meta.appendChild(link);
    }
    info.appendChild(meta);
    li.appendChild(info);

    const deleteBtn = button('Delete', () => {
      if (!confirm(`Delete "${summary.title}"? This cannot be undone.`)) return;
      deleteActivity(summary.id);
      render();
    });
    deleteBtn.className = 'activity-item__delete';
    li.appendChild(deleteBtn);

    return li;
  }

  function handleImport(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.clhelper.json';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          let activity = importActivityFromJson(reader.result as string);
          const existing = loadActivity(activity.id);
          if (existing) {
            const replace = confirm(
              `An activity named "${activity.title}" already exists. OK = replace, Cancel = import as a copy.`
            );
            if (!replace) activity = { ...activity, id: crypto.randomUUID() };
          }
          saveActivity(activity);
          render();
          if (callbacks.onImport) callbacks.onImport(activity);
        } catch (e) {
          alert(`Could not import: ${(e as Error).message}`);
        }
      };
      reader.readAsText(file);
    });
    input.click();
  }

  render();
}

function el(tag: string, className?: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

function heading(tag: 'h1' | 'h2' | 'h3', text: string): HTMLElement {
  const h = document.createElement(tag);
  h.textContent = text;
  return h;
}

function button(text: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.textContent = text;
  btn.addEventListener('click', onClick);
  return btn;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}
