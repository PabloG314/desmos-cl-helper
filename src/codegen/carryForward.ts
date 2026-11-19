import type { CarryForwardBehaviour, Activity, Id } from '../model/types';
import { getAllDisplayNames } from '../model/naming';
import { TEMPLATES, fillTemplate } from './templates';
import { sectionBlock } from './feedback';

export interface CarryForwardResult {
  section: {
    componentId: Id;
    sinkKeys: string[];
    code: string;
    setupReminders: string[];
  };
}

export function generateCarryForward(
  behaviour: CarryForwardBehaviour,
  activity: Activity,
): CarryForwardResult {
  const names = getAllDisplayNames(activity);
  const sourceName = names.get(behaviour.source) ?? behaviour.source;
  const destName = names.get(behaviour.destination) ?? behaviour.destination;
  const tag = behaviour.id.slice(0, 6);
  const { mapping } = behaviour;

  if (mapping.type === 'mathToGraphExpression') {
    const funcName = mapping.functionName;
    const body = fillTemplate(TEMPLATES.carryMathToGraphFunction.body, {
      funcName,
      sourceName,
    });
    return {
      section: {
        componentId: behaviour.destination,
        sinkKeys: [`function("${funcName}")`],
        code: sectionBlock(tag, 'carry', body),
        setupReminders: [
          `Add the expression \`y = ${funcName}(x)\` to \`${destName}\`.`,
          `Don't define \`${funcName}\` inside the graph. If Desmos created a slider, delete it.`,
        ],
      },
    };
  }

  if (mapping.type === 'mathToGraphNumber') {
    const varName = mapping.variable;
    const body = fillTemplate(TEMPLATES.carryMathToGraphNumber.body, {
      varName,
      sourceName,
    });
    return {
      section: {
        componentId: behaviour.destination,
        sinkKeys: [`number("${varName}")`],
        code: sectionBlock(tag, 'carry', body),
        setupReminders: [
          `Don't define \`${varName}\` inside the graph. If Desmos created a slider for \`${varName}\`, delete it.`,
        ],
      },
    };
  }

  throw new Error(
    `Carry forward mapping type "${mapping.type}" is not yet implemented (UNTESTED — see DESIGN §9.2).`,
  );
}
