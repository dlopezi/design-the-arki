import type { CSSProperties, ReactNode } from 'react';

/**
 * How each component type looks in the hotbar and on the diagram: an outline glyph on a badge in the type's colour,
 * so players can tell components apart at a glance. Every catalog type needs an entry (componentArt.test.ts).
 * Chosen from a three-style prototype (branch prototype/component-icons, colour cards won).
 */
export const componentArt: Record<string, { color: string; glyph: ReactNode }> = {
  loadBalancer: {
    color: '#4f8ef7',
    glyph: <path d="M3 12h6M9 12l5-6h6M9 12h11M9 12l5 6h6M18 4l2 2-2 2M18 10l2 2-2 2M18 16l2 2-2 2" />,
  },
  appServer: {
    color: '#34b97a',
    glyph: <><rect x="4" y="4" width="16" height="7" rx="1.5" /><rect x="4" y="13" width="16" height="7" rx="1.5" /><path d="M7.5 7.5h.01M7.5 16.5h.01M11 7.5h6M11 16.5h6" /></>,
  },
  cache: {
    color: '#f59e0b',
    glyph: <path d="M13 2 5 13h6l-1 9 8-11h-6l1-9z" />,
  },
  database: {
    color: '#9b6bff',
    glyph: <><ellipse cx="12" cy="5" rx="7" ry="2.5" /><path d="M5 5v14c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V5M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5" /></>,
  },
};

/** Grey for a failed instance, and for a type without art. */
const GREY = '#5b6577';

/** Sets `--art` to the type's colour; the hotbar card and the badge read it. */
export const artStyle = (type: string, down = false) => ({ '--art': down ? GREY : componentArt[type]?.color ?? GREY }) as CSSProperties;

export function ComponentGlyph({ type, size }: { type: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {componentArt[type]?.glyph ?? <circle cx="12" cy="12" r="7" />}
    </svg>
  );
}

/** The coloured badge at the left of a component (or, small, an instance) on the diagram. */
export function ComponentBadge({ type, small = false, down = false }: { type: string; small?: boolean; down?: boolean }) {
  return (
    <span className={`art-badge${small ? ' small' : ''}`} style={artStyle(type, down)}>
      <ComponentGlyph type={type} size={small ? 16 : 24} />
    </span>
  );
}
