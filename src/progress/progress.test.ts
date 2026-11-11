import { describe, expect, it } from 'vitest';
import type { Design } from '../engine/types';
import { playMode, withMode, withPass, type Progress } from './progress';

const empty: Progress = { version: 1, levels: {} };
const small: Design = { components: [{ id: 'api', type: 'appServer' }], connections: [['client', 'api']] };
const big: Design = { components: [{ id: 'api', type: 'appServer', params: { instances: 3 } }], connections: [['client', 'api']] };

describe('recording a pass', () => {
  it('keeps the design that passed', () => {
    expect(withPass(empty, 'l1', 2, 'normal', small).levels.l1!.passedDesign).toEqual(small);
  });

  it('keeps the latest passing design even when the stars do not improve', () => {
    const once = withPass(empty, 'l1', 3, 'hard', small);
    const again = withPass(once, 'l1', 1, 'guided', big).levels.l1!;
    expect(again).toMatchObject({ bestStars: 3, bestMode: 'hard', passedDesign: big });
  });
});

describe('the chosen difficulty', () => {
  it('is Guided until the tutorial is done, whatever was chosen', () => {
    expect(playMode(empty)).toBe('guided');
    expect(playMode(withMode(empty, 'god'))).toBe('guided');
  });

  it('after the tutorial, is unset until the player chooses, then the same for every mission', () => {
    const done: Progress = { ...empty, tutorialDone: true };
    expect(playMode(done)).toBeNull();
    expect(playMode(withMode(done, 'hard'))).toBe('hard');
  });
});
