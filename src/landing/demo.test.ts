import { describe, expect, it } from 'vitest';
import { DEMO, demoDesign, runDemo } from './demo';

describe('landing demo', () => {
  it('one app server talks to the database directly', () => {
    expect(demoDesign(1).connections).toEqual([['client', 'api'], ['api', 'db']]);
    expect(demoDesign(1).components.map(c => c.type)).toEqual(['appServer', 'database']);
  });

  it('several app servers get a load balancer in front', () => {
    const design = demoDesign(3);
    expect(design.connections).toEqual([['client', 'lb'], ['lb', 'api'], ['api', 'db']]);
    expect(design.components.find(c => c.id === 'api')?.params).toMatchObject({ instances: 3 });
  });

  it('300 req/s overload one app server, and a second one fixes it', () => {
    const one = runDemo({ rps: 300, instances: 1 });
    expect(one.passed).toBe(false);
    expect(one.bottleneck).toBe('appServer');
    expect(one.instanceLoads).toHaveLength(1);
    expect(one.instanceLoads[0]).toBeGreaterThan(0.95);

    const two = runDemo({ rps: 300, instances: 2 });
    expect(two.passed).toBe(true);
    expect(two.bottleneck).toBeNull();
    expect(two.instanceLoads).toHaveLength(2);
  });

  it('cost counts every instance and the load balancer', () => {
    const one = runDemo({ rps: 100, instances: 1 }).cost;
    const two = runDemo({ rps: 100, instances: 2 }).cost;
    expect(two - one).toBe(40 + 20);
  });

  it('every traffic level can be fixed by adding app servers', () => {
    for (let rps = DEMO.minRps; rps <= DEMO.maxRps; rps += DEMO.stepRps) {
      expect(runDemo({ rps, instances: DEMO.maxInstances }).passed, `${rps} req/s`).toBe(true);
    }
  });

  it('keeps inputs inside the demo limits', () => {
    expect(runDemo({ rps: 5000, instances: 9 })).toEqual(runDemo({ rps: DEMO.maxRps, instances: DEMO.maxInstances }));
    expect(runDemo({ rps: 0, instances: 0 })).toEqual(runDemo({ rps: DEMO.minRps, instances: 1 }));
  });

  it('gives the same numbers every time', () => {
    expect(runDemo({ rps: 350, instances: 2 })).toEqual(runDemo({ rps: 350, instances: 2 }));
  });
});
