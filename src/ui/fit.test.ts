import { describe, expect, it } from 'vitest';
import { viewportInArea } from './fit';

describe('viewportInArea', () => {
  const padding = { top: 100, right: 20, bottom: 300, left: 280 };

  it('centres the diagram in the free area between the margins, not in the whole screen', () => {
    // Free area: x 280..748 (468 wide), y 100..724 (624 tall); the width limits the zoom.
    const v = viewportInArea({ x: 0, y: 0, width: 936, height: 200 }, 768, 1024, padding, 0.25, 1.1);
    expect(v.zoom).toBeCloseTo(0.5);
    expect(v.x).toBeCloseTo(280);
    // Diagram 100 px tall on screen, centred on y = 412.
    expect(v.y).toBeCloseTo(412 - 50);
  });

  it('keeps the zoom within its limits', () => {
    expect(viewportInArea({ x: 0, y: 0, width: 10, height: 10 }, 768, 1024, padding, 0.25, 1.1).zoom).toBe(1.1);
    expect(viewportInArea({ x: 0, y: 0, width: 10000, height: 10 }, 768, 1024, padding, 0.25, 1.1).zoom).toBe(0.25);
  });

  it('accounts for where the diagram starts', () => {
    const v = viewportInArea({ x: 100, y: 50, width: 468, height: 100 }, 768, 1024, padding, 0.25, 1.1);
    expect(v.zoom).toBe(1);
    expect(v.x).toBeCloseTo(280 - 100);
    expect(v.y).toBeCloseTo(412 - 50 - 50);
  });
});
