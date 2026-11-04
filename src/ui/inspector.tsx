import { catalog } from '../catalog/catalog';
import { DEFAULT_QUEUE_SIZE, TIMEOUT_MS } from '../engine/simulate';
import type { DesignComponent } from '../engine/types';
import { en as t } from '../i18n/en';
import type { ComponentOptions } from '../levels/levels';
import { instanceCountOf, sizeOf } from './diagram';

const MAX_INSTANCES = 8;
const QUEUE_STEP = 10;

type Props = {
  component: DesignComponent | null;
  options: ComponentOptions | undefined;
  onChange: (params: Record<string, unknown>) => void;
  onRemove: () => void;
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="row"><span className="muted">{label}</span><span>{children}</span></div>;
}

/** Configuration of the selected component: deployment, advanced settings, capacity and cost. */
export function Inspector({ component, options, onChange, onRemove }: Props) {
  if (!component) {
    return <aside className="hud inspector" aria-label={t.inspector.title}><h2 className="eyebrow">{t.inspector.title}</h2><p className="muted">{t.inspector.empty}</p></aside>;
  }
  const spec = catalog[component.type]!;
  const params = component.params ?? {};
  const set = (patch: Record<string, unknown>) => onChange({ ...params, ...patch });
  const instances = instanceCountOf(params);
  const maxInstances = Math.min(MAX_INSTANCES, options?.maxInstances ?? MAX_INSTANCES);
  const size = sizeOf(component.type, params);
  const sizes = spec.sizes ? (options?.sizes ?? Object.keys(spec.sizes)) : [];
  const each = size && spec.sizes ? spec.sizes[size]! : { workers: spec.workers, monthlyCost: spec.monthlyCost, vcpu: undefined };
  const queueSize = Number(params.queueSize ?? DEFAULT_QUEUE_SIZE);
  const capacity = Math.round((instances * each.workers * 1000) / spec.meanServiceMs);
  const clampInstances = (n: number) => set({ instances: Math.max(1, Math.min(maxInstances, n)) });
  const clampQueue = (n: number) => set({ queueSize: Math.max(QUEUE_STEP, Math.min(500, n)) });

  return (
    <aside className="hud inspector" aria-label={t.inspector.title}>
      <h2 className="eyebrow">{t.inspector.title}</h2>
      <div className="title">
        <h3>{t.componentTypes[component.type] ?? component.type}</h3>
        <span className="muted">[{t.container}: {spec.presentation?.technology}]</span>
      </div>

      {spec.scalesOut && (
        <section>
          <h4>{t.inspector.deployment}</h4>
          <Row label={t.inspector.instances}>
            <span className="stepper">
              <button aria-label={t.inspector.removeInstance} disabled={instances <= 1} onClick={() => clampInstances(instances - 1)}>−</button>
              <input type="number" aria-label={t.inspector.instances} min={1} max={maxInstances} value={instances}
                onChange={e => clampInstances(Number(e.target.value) || 1)} />
              <button aria-label={t.inspector.addInstance} disabled={instances >= maxInstances} onClick={() => clampInstances(instances + 1)}>+</button>
            </span>
          </Row>
          {sizes.length > 1 && (
            <fieldset className="segmented" aria-label={t.inspector.instanceSize}>
              <legend className="muted">{t.inspector.instanceSize}</legend>
              {sizes.map(s => (
                <label key={s} className={s === size ? 'on' : ''}>
                  <input type="radio" name={`size-${component.id}`} value={s} checked={s === size} onChange={() => set({ size: s })} />
                  {t.inspector.sizes[s] ?? s}
                </label>
              ))}
            </fieldset>
          )}
          <Row label={t.inspector.perInstance}>{t.inspector.perInstanceValue(each.vcpu, each.workers, each.monthlyCost)}</Row>
        </section>
      )}

      <section>
        <h4>{t.inspector.advanced}</h4>
        {spec.scalesOut && (
          <Row label={t.inspector.queueSize}>
            <span className="stepper">
              <button aria-label={t.inspector.shorterQueue} onClick={() => clampQueue(queueSize - QUEUE_STEP)}>−</button>
              <input type="number" aria-label={t.inspector.queueSize} min={QUEUE_STEP} max={500} step={QUEUE_STEP} value={queueSize}
                onChange={e => clampQueue(Number(e.target.value) || DEFAULT_QUEUE_SIZE)} />
              <button aria-label={t.inspector.longerQueue} onClick={() => clampQueue(queueSize + QUEUE_STEP)}>+</button>
            </span>
          </Row>
        )}
        <Row label={t.inspector.serviceTime}>{t.inspector.serviceTimeValue(spec.meanServiceMs)}</Row>
        <Row label={t.inspector.timeout}>{t.inspector.timeoutValue(TIMEOUT_MS)}</Row>
        {spec.scalesOut && <Row label={t.inspector.healthCheck}>{t.inspector.healthCheckValue}</Row>}
      </section>

      <section>
        <h4>{t.inspector.capacityAndCost}</h4>
        {!spec.presentation?.hideCapacity && <p>{t.inspector.capacity(capacity)}</p>}
        <p>{t.inspector.cost(instances, each.monthlyCost)}</p>
      </section>

      <button className="danger" onClick={onRemove}>{t.inspector.remove}</button>
    </aside>
  );
}
