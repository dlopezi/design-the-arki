import { catalog } from '../catalog/catalog';
import type { Design } from '../engine/types';
import { t } from '../i18n';

/** The id of the clients (the C4 person) in a design's connections. */
export const CLIENTS = 'client';

export type ConnectionTarget = { id: string; label: string };

/** Whether the clients or a component pass requests on, so it makes sense to connect them to something. */
export function forwardsRequests(design: Design, fromId: string): boolean {
  if (fromId === CLIENTS) return true;
  const component = design.components.find(c => c.id === fromId);
  return !!component && !catalog[component.type]?.endsRequests;
}

/** Where the clients or a component can send requests: every other component, numbered when a type appears more than once. */
export function connectionTargets(design: Design, fromId: string): ConnectionTarget[] {
  const total = new Map<string, number>();
  for (const c of design.components) total.set(c.type, (total.get(c.type) ?? 0) + 1);
  const seen = new Map<string, number>();
  return design.components.flatMap(c => {
    const n = (seen.get(c.type) ?? 0) + 1;
    seen.set(c.type, n);
    if (c.id === fromId) return [];
    const label = t.componentTypes[c.type] ?? c.type;
    return [{ id: c.id, label: total.get(c.type)! > 1 ? `${label} ${n}` : label }];
  });
}

/** Where the clients or a component send requests now, or null. */
export const targetOf = (design: Design, fromId: string): string | null =>
  design.connections.find(([from]) => from === fromId)?.[1] ?? null;

/** Connects `fromId` to `toId`, replacing its previous connection (a component forwards to one place); null disconnects it. */
export function withConnection(design: Design, fromId: string, toId: string | null): Design {
  if (toId === CLIENTS || toId === fromId) return design;
  const others = design.connections.filter(([from]) => from !== fromId);
  return { ...design, connections: toId === null ? others : [...others, [fromId, toId]] };
}
