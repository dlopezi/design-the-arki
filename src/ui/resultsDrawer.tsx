import type { Design, Result } from '../engine/types';
import { en as t, percent } from '../i18n/en';
import type { LevelDefinition } from '../levels/levels';
import { instanceNames, loadLevel } from './diagram';
import { Stars } from './reportCard';

type ChartProps = { title: string; values: number[]; max: number; limit?: number; format: (v: number) => string; tone: 'accent' | 'warn' | 'bad'; cursor: number | null };

const W = 240, H = 92, PAD = 4;

/** A small line chart over the run's 5-second buckets, with the level's limit as a dashed line. */
function Chart({ title, values, max, limit, format, tone, cursor }: ChartProps) {
  const top = Math.max(max, ...values, limit ?? 0) || 1;
  const x = (i: number) => PAD + (i / Math.max(1, values.length - 1)) * (W - 2 * PAD);
  const y = (v: number) => H - PAD - (v / top) * (H - 2 * PAD);
  const peak = Math.max(0, ...values);
  const points = values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  return (
    <figure className="chart">
      <figcaption>{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t.results.chartLabel(title, format(peak), limit !== undefined ? format(limit) : undefined)}>
        <line x1={PAD} x2={W - PAD} y1={H - PAD} y2={H - PAD} className="axis" />
        {limit !== undefined && <line x1={PAD} x2={W - PAD} y1={y(limit)} y2={y(limit)} className="limit" />}
        {values.length > 1 && <polygon points={`${x(0)},${H - PAD} ${points} ${x(values.length - 1)},${H - PAD}`} className={`area ${tone}`} />}
        <polyline points={points} className={`line ${tone}`} />
        {cursor !== null && <line x1={cursor * (W - 2 * PAD) + PAD} x2={cursor * (W - 2 * PAD) + PAD} y1={0} y2={H} className="cursor" />}
      </svg>
      <span className="peak">{format(peak)}</span>
    </figure>
  );
}

type Props = { level: LevelDefinition; design: Design; result: Result | null; running: boolean; bucket: number; hint: string | null };

/** Bottom drawer: verdict, hint, charts over time and peak load of every resource. */
export function ResultsDrawer({ level, design, result, running, bucket, hint }: Props) {
  if (!result) {
    return <section className="hud results" aria-label={t.results.title}><h2 className="eyebrow">{t.results.title}</h2><p className="muted">{t.results.empty}</p></section>;
  }
  // While the run replays, charts grow bucket by bucket.
  const shown = running ? result.buckets.slice(0, bucket + 1) : result.buckets;
  const cursor = running ? (bucket + 0.5) / result.buckets.length : null;
  const names = instanceNames(design);
  const loads = result.components.flatMap(c => {
    const component = design.components.find(d => d.id === c.id);
    if (!component) return [];
    const at = (series: number[], peak: number) => (running ? (series[bucket] ?? 0) : peak);
    const instanceNamesFor = names.get(c.id);
    if (instanceNamesFor) return c.instances.map((i, k) => ({ key: `${c.id}#${k}`, label: instanceNamesFor[k]!, load: at(i.bucketUtilization, i.peakUtilization) }));
    return [{ key: c.id, label: t.componentTypes[component.type] ?? component.type, load: at(c.bucketUtilization, c.peakUtilization) }];
  });

  return (
    <section className="hud results" aria-label={t.results.title}>
      <div className="verdict">
        <h2 className="eyebrow">{t.results.title}</h2>
        {running ? <p className="muted">…</p> : <>
          <strong className={result.passed ? 'ok' : 'bad'}>{result.passed ? t.passed : t.failed}</strong>
          <Stars earned={result.stars} max={1 + level.starCostThresholds.length} />
          {hint && !result.passed && <p className="hint-text">{hint}</p>}
        </>}
      </div>
      <Chart title={t.results.rps} values={shown.map(b => b.rps)} max={0} format={v => `${Math.round(v)}`} tone="accent" cursor={cursor} />
      <Chart title={t.results.p95} values={shown.map(b => b.p95)} max={0} limit={level.requirements.p95Ms} format={v => `${Math.round(v)} ms`} tone="warn" cursor={cursor} />
      <Chart title={t.results.errorRate} values={shown.map(b => b.errorRate)} max={0} limit={level.requirements.maxErrorRate} format={percent} tone="bad" cursor={cursor} />
      <div className="loads">
        <h3 className="eyebrow">{t.results.loadPerResource}</h3>
        <ul>
          {loads.map(l => (
            <li key={l.key} className={loadLevel(l.load)}>
              <span>{l.label}</span>
              <span className="load-bar"><span style={{ width: `${Math.round(l.load * 100)}%` }} /></span>
              <span className="value">{Math.round(l.load * 100)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
