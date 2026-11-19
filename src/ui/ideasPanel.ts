import type { Activity } from '../model/types';
import { generateIdeas, type Idea } from '../ideas/rules';

export function renderIdeasPanel(
  container: HTMLElement,
  activity: Activity,
  onDismiss: (a: Activity) => void,
  onSetup: (idea: Idea, a: Activity) => void,
): void {
  container.innerHTML = '';
  const ideas = generateIdeas(activity);
  if (ideas.length === 0) return;

  const panel = el('div', 'ideas-panel');
  const title = el('div', 'ideas-panel__title');
  title.textContent = '💡 Ideas';
  panel.appendChild(title);

  for (const idea of ideas) {
    const card = el('div', 'idea-card');
    const desc = el('p', 'idea-card__desc');
    desc.textContent = idea.description;
    const btnRow = el('div', 'idea-card__btns');
    const setupBtn = el('button', 'btn-primary idea-card__setup') as HTMLButtonElement;
    setupBtn.textContent = 'Set it up';
    setupBtn.addEventListener('click', () => onSetup(idea, activity));
    const dismissBtn = el('button', 'idea-card__dismiss') as HTMLButtonElement;
    dismissBtn.textContent = 'Dismiss';
    dismissBtn.addEventListener('click', () => {
      const updated: Activity = {
        ...activity,
        dismissedIdeas: [...activity.dismissedIdeas, idea.key],
        updatedAt: new Date().toISOString(),
      };
      onDismiss(updated);
    });
    btnRow.appendChild(setupBtn);
    btnRow.appendChild(dismissBtn);
    card.appendChild(desc);
    card.appendChild(btnRow);
    panel.appendChild(card);
  }

  container.appendChild(panel);
}

function el(tag: string, className?: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}
