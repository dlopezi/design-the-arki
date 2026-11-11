import { describe, expect, it } from 'vitest';
import { catalog } from '../catalog/catalog';
import { buildings, componentArt, shade } from './componentArt';

describe('component art', () => {
  it('gives every catalog type a glyph and a colour', () => {
    for (const type of Object.keys(catalog)) {
      expect(componentArt[type], type).toBeDefined();
      expect(componentArt[type]!.color, type).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('draws every catalog type as a building', () => {
    for (const type of Object.keys(catalog)) expect(buildings[type], type).toBeTypeOf('function');
  });

  it('shades a colour lighter or darker for the faces of a building', () => {
    expect(shade('#808080', 0.5)).toBe('#c0c0c0');
    expect(shade('#808080', -0.5)).toBe('#404040');
  });
});
