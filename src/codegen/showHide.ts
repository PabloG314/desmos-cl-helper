import type { ShowHideBehaviour, Activity } from '../model/types';
import { getAllDisplayNames } from '../model/naming';
import { sectionBlock } from './feedback';

export interface ShowHideSection {
  componentId: string;
  sinkKey: 'hidden';
  code: string;
}

export function generateShowHide(
  behaviour: ShowHideBehaviour,
  activity: Activity,
): ShowHideSection {
  const names = getAllDisplayNames(activity);
  const tag = behaviour.id.slice(0, 6);
  const trigger = behaviour.trigger;

  let body: string;

  if (trigger.type === 'submitted') {
    const inputName = names.get(trigger.input) ?? trigger.input;
    body = `hidden: ${inputName}.submitCount < 1`;
  } else {
    // 'correct' and 'ruleMatched' require Open Question O1 (sticky reveal).
    // Guard with a placeholder that won't generate broken CL.
    throw new Error(
      `ShowHide trigger type "${trigger.type}" is not yet implemented (see Open Question O1).`,
    );
  }

  return {
    componentId: behaviour.target,
    sinkKey: 'hidden',
    code: sectionBlock(tag, 'showHide', body),
  };
}
