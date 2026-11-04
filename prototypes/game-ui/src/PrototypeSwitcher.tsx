// PROTOTYPE: floating variant switcher (dev only).
import { useEffect } from 'react';
export function PrototypeSwitcher({ variants, current, onChange }: { variants: { key: string; name: string }[]; current: string; onChange: (k: string) => void }) {
  const i = Math.max(0, variants.findIndex(v => v.key === current));
  const go = (d: number) => onChange(variants[(i + d + variants.length) % variants.length].key);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, [contenteditable="true"]')) return;
      if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  });
  if (!import.meta.env.DEV) return null;
  return (
    <div className="proto-switcher">
      <button onClick={() => go(-1)} aria-label="Variante anterior">‹</button>
      <span><b>{variants[i].key}</b> · {variants[i].name}</span>
      <button onClick={() => go(1)} aria-label="Variante siguiente">›</button>
    </div>
  );
}
