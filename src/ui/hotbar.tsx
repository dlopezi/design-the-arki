import { catalog } from '../catalog/catalog';
import { t } from '../i18n';
import { artStyle, ComponentGlyph } from './componentArt';

export const DRAG_TYPE = 'application/x-archi-component';

/**
 * Components the level allows, in order, as colour cards: click or tap, drag onto the canvas, or press 1–n
 * (key numbers are hidden on touch screens).
 */
export function Hotbar({ types, onAdd }: { types: string[]; onAdd: (type: string) => void }) {
  return (
    <div className="hotbar" role="toolbar" aria-label={t.components}>
      {types.map((type, i) => {
        const label = t.componentTypes[type] ?? type;
        const cost = catalog[type]!.monthlyCost;
        return (
          <button key={type} className="hot-tile" style={artStyle(type)} aria-label={t.hotbarItem(i + 1, label, cost)} draggable
            onClick={() => onAdd(type)} onDragStart={e => { e.dataTransfer.setData(DRAG_TYPE, type); e.dataTransfer.effectAllowed = 'copy'; }}>
            <kbd aria-hidden="true">{i + 1}</kbd>
            <span className="hot-art"><ComponentGlyph type={type} size={28} /></span>
            <span className="hot-name">{label}</span>
            <small className="hot-cost" aria-hidden="true">${cost}</small>
          </button>
        );
      })}
    </div>
  );
}
