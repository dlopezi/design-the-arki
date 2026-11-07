import { describe, expect, it } from 'vitest';
import { catalog } from '../catalog/catalog';
import { componentArt } from './componentArt';

describe('component art', () => {
  it('gives every catalog type a glyph and a colour', () => {
    for (const type of Object.keys(catalog)) {
      expect(componentArt[type], type).toBeDefined();
      expect(componentArt[type]!.color, type).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
