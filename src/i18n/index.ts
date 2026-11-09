/**
 * Game language. English by default; the player's choice is saved in this browser.
 *
 * `t` is a live binding: after `setLang`, every module that reads `t.something` while it
 * renders gets the new table. The root remounts the app on a change (see main.tsx),
 * so nothing keeps the old texts.
 */
import { en, percent, type Strings } from './en';
import { es } from './es';

export type Lang = 'en' | 'es';
export const LANGS: Lang[] = ['en', 'es'];

const KEY = 'design-the-arki:lang';
const TABLES: Record<Lang, Strings> = { en, es };

function load(): Lang {
  try {
    return localStorage.getItem(KEY) === 'es' ? 'es' : 'en';
  } catch {
    return 'en';
  }
}

let current: Lang = load();
export let t: Strings = TABLES[current];
const listeners = new Set<() => void>();

export function lang(): Lang {
  return current;
}

function applyToDocument(): void {
  if (typeof document !== 'undefined') document.documentElement.lang = current;
}
applyToDocument();

export function setLang(next: Lang): void {
  if (next === current) return;
  current = next;
  t = TABLES[next];
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* private mode: the choice lasts until the tab closes */
  }
  applyToDocument();
  listeners.forEach(l => l());
}

export function onLangChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export { percent };
