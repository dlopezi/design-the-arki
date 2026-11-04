import { catalog } from '../catalog/catalog';
import { DEFAULT_QUEUE_SIZE, hitRateOf, TIMEOUT_MS } from '../engine/simulate';
import type { ComponentResult, DesignComponent } from '../engine/types';
import { en as t, percent } from '../i18n/en';
import type { ComponentOptions } from '../levels/levels';
import { instanceCountOf, loadLevel, sizeOf } from './diagram';

const MAX_INSTANCES = 8;
const QUEUE_STEP = 10;
const TTL_STEP = 10;
const MAX_TTL = 600;

type Props = {
  component: DesignComponent | null;
  options: ComponentOptions | undefined;
  onChange: (params: Record<string, unknown>) => void;
  onRemove: () => void;
  /** This component's stats from the last finished run, if any. */
  lastRun: ComponentResult | null;
  instanceNames: string[] | undefined;
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="row"><span className="muted">{label}</span><span>{children}</span></div>;
}

function Stepper({ label, value, min, max, step, onChange, lessLabel, moreLabel }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; lessLabel: string; moreLabel: string;
}) {
  const clamp = (v: number) => onChange(Math.max(min, Math.min(max, v)));
  return (
    <span className="stepper">
      <button aria-label={lessLabel} disabled={value <= min} onClick={() => clamp(value - step)}>−</button>
      <input type="number" aria-label={label} min={min} max={max} step={step} value={value} onChange={e => clamp(Number(e.target.value) || min)} />
      <button aria-label={moreLabel} disabled={value >= max} onClick={() => clamp(value + step)}>+</button>
    </span>
  );
}

function SizePicker({ label, sizes, value, name, onChange }: { label: string; sizes: string[]; value: string | undefined; name: string; onChange: (s: string) => void }) {
  return (
    <fieldset className="segmented" aria-label={label}>
      <legend className="muted">{label}</legend>
      {sizes.map(s => (
        <label key={s} className={s === value ? 'on' : ''}>
          <input type="radio" name={name} value={s} checked={s === value} onChange={() => onChange(s)} />
          {t.inspector.sizes[s] ?? s}
        </label>
      ))}
    </fieldset>
  );
}

/** Configuration of the selected component: deployment, advanced settings, capacity and cost, and the last run. */
export function Inspector({ component, options, onChange, onRemove, lastRun, instanceNames }: Props) {
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
  const shortcut = spec.shortcut;
  const shortcutValue = shortcut ? Number(params[shortcut.param] ?? shortcut.defaultValue) : 0;
  const shortcutMax = shortcut ? (options?.limits?.[shortcut.param] ?? MAX_TTL) : 0;

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
            <Stepper label={t.inspector.instances} value={instances} min={1} max={maxInstances} step={1} onChange={v => set({ instances: v })}
              lessLabel={t.inspector.removeInstance} moreLabel={t.inspector.addInstance} />
          </Row>
          {sizes.length > 1 && <SizePicker label={t.inspector.instanceSize} sizes={sizes} value={size} name={`size-${component.id}`} onChange={s => set({ size: s })} />}
          <Row label={t.inspector.perInstance}>{t.inspector.perInstanceValue(each.vcpu, each.workers, each.monthlyCost)}</Row>
        </section>
      )}

      {!spec.scalesOut && (spec.sizes || shortcut) && (
        <section>
          <h4>{t.inspector.configuration}</h4>
          {spec.sizes && sizes.length > 1 && <SizePicker label={t.inspector.tier} sizes={sizes} value={size} name={`tier-${component.id}`} onChange={s => set({ size: s })} />}
          {spec.sizes && <Row label={t.inspector.tier}>{t.inspector.sizes[size!] ?? size} · {t.inspector.connections(each.workers)}</Row>}
          {shortcut && (
            <>
              <Row label={t.inspector.ttl}>
                <Stepper label={t.inspector.ttl} value={shortcutValue} min={0} max={shortcutMax} step={TTL_STEP} onChange={v => set({ [shortcut.param]: v })}
                  lessLabel={t.inspector.shorterTtl} moreLabel={t.inspector.longerTtl} />
              </Row>
              <p>{t.inspector.expectedHitRate(`${Math.round(hitRateOf(component) * 100)}%`)}</p>
            </>
          )}
        </section>
      )}

      <section>
        <h4>{t.inspector.advanced}</h4>
        {spec.scalesOut && (
          <Row label={t.inspector.queueSize}>
            <Stepper label={t.inspector.queueSize} value={queueSize} min={QUEUE_STEP} max={500} step={QUEUE_STEP} onChange={v => set({ queueSize: v })}
              lessLabel={t.inspector.shorterQueue} moreLabel={t.inspector.longerQueue} />
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

      {lastRun && (
        <section>
          <h4>{t.lastRun.title}</h4>
          <Row label={t.lastRun.peak}>{percent(lastRun.peakUtilization)}</Row>
          <Row label={t.lastRun.avgWait}>{Math.round(lastRun.avgWaitMs)} ms</Row>
          <Row label={t.lastRun.rejectedTimedOut}>{lastRun.rejected} · {lastRun.timedOut}</Row>
          {lastRun.hitRate !== null && <Row label={t.inspector.observedHitRate}>{percent(lastRun.hitRate)}</Row>}
          {instanceNames && (
            <table className="instances">
              <caption className="visually-hidden">{t.lastRun.instances}</caption>
              <thead><tr>{t.lastRun.columns.map(c => <th key={c} scope="col">{c}</th>)}</tr></thead>
              <tbody>
                {lastRun.instances.map((i, k) => (
                  <tr key={k}>
                    <td>{instanceNames[k]}</td>
                    <td className={loadLevel(i.peakUtilization)}>{Math.round(i.peakUtilization * 100)}%</td>
                    <td>{i.served}</td>
                    <td className={i.rejected ? 'bad' : ''}>{i.rejected}</td>
                    <td>{i.maxQueue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      <button className="danger" onClick={onRemove}>{t.inspector.remove}</button>
    </aside>
  );
}
