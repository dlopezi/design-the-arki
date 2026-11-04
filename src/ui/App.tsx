import { useMemo, useState } from 'react';
import { Background, BackgroundVariant, ReactFlow, type Edge, type Node } from '@xyflow/react';
import { designCost, simulate } from '../engine/simulate';
import type { Design, Result } from '../engine/types';
import { en as t } from '../i18n/en';
import { allLevels } from '../levels/levels';
import { CostMeter } from './costMeter';
import { Objectives } from './objectives';
import { ReportCard } from './reportCard';

/** Lays the design out left to right, following connections from the client. */
function toFlow(design: Design): { nodes: Node[]; edges: Edge[] } {
  const order = ['client'];
  for (let i = 0; i < order.length; i++) {
    for (const [from, to] of design.connections) if (from === order[i] && !order.includes(to)) order.push(to);
  }
  const typeOf = new Map(design.components.map(c => [c.id, c.type]));
  const nodes: Node[] = order.map((id, i) => ({
    id, position: { x: i * 220, y: 0 }, className: 'node',
    data: { label: id === 'client' ? t.clients : (t.componentTypes[typeOf.get(id)!] ?? typeOf.get(id)) },
    sourcePosition: 'right' as Node['sourcePosition'], targetPosition: 'left' as Node['targetPosition'],
    ...(id === 'client' ? { type: 'input' } : {}),
  }));
  const edges: Edge[] = design.connections.map(([from, to]) => ({ id: `${from}-${to}`, source: from, target: to }));
  return { nodes, edges };
}

export function App() {
  const level = allLevels()[0]!;
  const [design] = useState<Design>(level.referenceDesign);
  const flow = useMemo(() => toFlow(design), [design]);
  const cost = designCost(design);
  const [result, setResult] = useState<Result | null>(null);
  const [showReport, setShowReport] = useState(false);

  const play = () => { setResult(simulate(level, design, 1)); setShowReport(true); };

  return (
    <div className="game">
      <ReactFlow nodes={flow.nodes} edges={flow.edges} colorMode="dark" fitView fitViewOptions={{ maxZoom: 1.2 }} proOptions={{ hideAttribution: true }}>
        <Background variant={BackgroundVariant.Dots} gap={26} size={1.5} />
      </ReactFlow>

      <section className="hud mission">
        <h1>{level.title}</h1>
        <p>{level.brief}</p>
        <Objectives level={level} cost={cost} result={result} />
        <ul className="traffic">{level.traffic.map(s => <li key={s.fromS}>{t.traffic(s.rps, s.fromS, s.toS)}</li>)}</ul>
      </section>

      <section className="hud cost-hud">
        <CostMeter cost={cost} budget={level.budget} thresholds={level.starCostThresholds} />
      </section>

      <div className="hud controls">
        <button className="play" onClick={play}>{t.play}</button>
      </div>

      {result && showReport && <ReportCard result={result} maxStars={1 + level.starCostThresholds.length} onClose={() => setShowReport(false)} />}
    </div>
  );
}
