import { describe, expect, it } from 'vitest';
import type { Design } from '../engine/types';
import { withPass, type Progress } from './progress';

const empty: Progress = { version: 1, levels: {} };
const small: Design = { components: [{ id: 'api', type: 'appServer' }], connections: [['client', 'api']] };
const big: Design = { components: [{ id: 'api', type: 'appServer', params: { instances: 3 } }], connections: [['client', 'api']] };

describe('recording a pass', () => {
  it('keeps the design that passed, for the Base', () => {
    expect(withPass(empty, 'l1', 2, 'normal', small).levels.l1!.passedDesign).toEqual(small);
  });

  it('keeps the latest passing design even when the stars do not improve', () => {
    const once = withPass(empty, 'l1', 3, 'hard', small);
    const again = withPass(once, 'l1', 1, 'guided', big).levels.l1!;
    expect(again).toMatchObject({ bestStars: 3, bestMode: 'hard', passedDesign: big });
  });
});
