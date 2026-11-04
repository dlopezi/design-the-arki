import { en as t } from '../i18n/en';

/** Live monthly cost against the budget, with a tick for each star threshold. */
export function CostMeter({ cost, budget, thresholds }: { cost: number; budget: number; thresholds: number[] }) {
  const pct = (value: number) => `${Math.min(100, (value / budget) * 100)}%`;
  const tone = cost > budget ? 'bad' : thresholds.length && cost <= thresholds[thresholds.length - 1]! ? 'ok' : 'warn';
  return (
    <div className="cost">
      <div className="cost-label">{t.monthlyCost}</div>
      <div className="cost-value"><strong>${cost}</strong> <span>/ ${budget}</span></div>
      <div className="meter" role="meter" aria-label={t.monthlyCost} aria-valuemin={0} aria-valuemax={budget} aria-valuenow={cost}
        aria-valuetext={t.costMeterText(cost, budget, thresholds)}>
        <span className={`fill ${tone}`} style={{ width: pct(cost) }} />
        {thresholds.map((threshold, i) => <i key={threshold} style={{ left: pct(threshold) }} title={`${'★'.repeat(i + 2)} ≤ $${threshold}`} />)}
      </div>
    </div>
  );
}
