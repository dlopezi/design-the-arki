import { describe, expect, it } from 'vitest';
import type { Design } from '../engine/types';
import { layoutDiagram } from './diagram';

const design: Design = {
  components: [
    { id: 'lb', type: 'loadBalancer' },
    { id: 'api', type: 'appServer', params: { instances: 3 } },
    { id: 'db', type: 'database' },
  ],
  connections: [['client', 'lb'], ['lb', 'api'], ['api', 'db']],
};
const state = { selected: null, problemIds: [] };
const kinds = (layer: 1 | 2 | 3) => layoutDiagram(design, { ...state, c4Layer: layer }).nodes.map(n => `${n.type}:${n.id}`);

describe('C4 layers of the diagram', () => {
  it('layer 3 (components) shows every instance inside its container', () => {
    expect(kinds(3)).toEqual(expect.arrayContaining(['component:api', 'instance:api#0', 'instance:api#1', 'instance:api#2']));
  });

  it('layer 2 (containers) keeps the zones and components but folds the instances away', () => {
    const nodes = kinds(2);
    expect(nodes).toEqual(expect.arrayContaining(['boundary:zone-edge', 'boundary:zone-application', 'component:lb', 'component:api', 'component:db']));
    expect(nodes.filter(n => n.startsWith('instance:'))).toEqual([]);
  });

  it('layer 1 (context) shows only the users and the system, joined by one connection', () => {
    const diagram = layoutDiagram(design, { ...state, c4Layer: 1 });
    expect(diagram.nodes.map(n => `${n.type}:${n.id}`)).toEqual(['person:client', 'context:system']);
    expect(diagram.edges.map(e => `${e.source}->${e.target}`)).toEqual(['client->system']);
  });
});
