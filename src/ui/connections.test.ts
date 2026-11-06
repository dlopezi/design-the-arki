import { describe, expect, it } from 'vitest';
import type { Design } from '../engine/types';
import { CLIENTS, connectionTargets, forwardsRequests, targetOf, withConnection } from './connections';

const design: Design = {
  components: [
    { id: 'lb', type: 'loadBalancer' },
    { id: 'api', type: 'appServer' },
    { id: 'db', type: 'database' },
  ],
  connections: [[CLIENTS, 'lb'], ['lb', 'api']],
};

describe('connectionTargets', () => {
  it('lists every other component, labelled by type, never the clients or the component itself', () => {
    expect(connectionTargets(design, 'api')).toEqual([
      { id: 'lb', label: 'Load balancer' },
      { id: 'db', label: 'Database' },
    ]);
  });

  it('lists every component for the clients', () => {
    expect(connectionTargets(design, CLIENTS).map(t => t.id)).toEqual(['lb', 'api', 'db']);
  });

  it('numbers components whose type appears more than once', () => {
    const twoServers: Design = { components: [{ id: 'a', type: 'appServer' }, { id: 'b', type: 'appServer' }, { id: 'db', type: 'database' }], connections: [] };
    expect(connectionTargets(twoServers, 'db').map(t => t.label)).toEqual(['App server 1', 'App server 2']);
    expect(connectionTargets(twoServers, 'a').map(t => t.label)).toEqual(['App server 2', 'Database']);
  });
});

describe('targetOf', () => {
  it('gives where a component sends requests, or null', () => {
    expect(targetOf(design, CLIENTS)).toBe('lb');
    expect(targetOf(design, 'api')).toBeNull();
  });
});

describe('withConnection', () => {
  it('adds a connection', () => {
    expect(withConnection(design, 'api', 'db').connections).toEqual([[CLIENTS, 'lb'], ['lb', 'api'], ['api', 'db']]);
  });

  it('replaces the previous connection: a component forwards to one place', () => {
    expect(withConnection(design, 'lb', 'db').connections).toEqual([[CLIENTS, 'lb'], ['lb', 'db']]);
  });

  it('removes the connection when the target is null', () => {
    expect(withConnection(design, 'lb', null).connections).toEqual([[CLIENTS, 'lb']]);
  });

  it('ignores connections to the clients or to the component itself', () => {
    expect(withConnection(design, 'api', CLIENTS)).toBe(design);
    expect(withConnection(design, 'api', 'api')).toBe(design);
  });
});

describe('forwardsRequests', () => {
  it('is true for the clients and components that pass requests on, false for ones that end them', () => {
    expect(forwardsRequests(design, CLIENTS)).toBe(true);
    expect(forwardsRequests(design, 'api')).toBe(true);
    expect(forwardsRequests(design, 'db')).toBe(false);
  });
});
