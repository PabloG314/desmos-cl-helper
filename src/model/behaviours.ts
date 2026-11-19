import type { Activity, Behaviour, Id } from './types';

function now(): string {
  return new Date().toISOString();
}

export function addBehaviour(activity: Activity, behaviour: Behaviour): Activity {
  return {
    ...activity,
    behaviours: [...activity.behaviours, behaviour],
    updatedAt: now(),
  };
}

export function removeBehaviour(activity: Activity, behaviourId: Id): Activity {
  return {
    ...activity,
    behaviours: activity.behaviours.filter(b => b.id !== behaviourId),
    updatedAt: now(),
  };
}

export function updateBehaviour(activity: Activity, behaviour: Behaviour): Activity {
  return {
    ...activity,
    behaviours: activity.behaviours.map(b => b.id === behaviour.id ? behaviour : b),
    updatedAt: now(),
  };
}
