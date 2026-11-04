import { useMemo, useState } from 'react';
import { Background, ReactFlow, type Edge, type Node } from '@xyflow/react';
import { simulate } from '../engine/simulate';
import type { Design, Result } from '../engine/types';
import { en as t } from '../i18n/en';
import { allLevels } from '../levels/levels';

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
  const design = level.referenceDesign;
  const flow = useMemo(() => toFlow(design), [design]);
  const [result, setResult] = useState<Result | null>(null);

  return (
    <div className="game">
      <header className="brief">
        <h1>{level.title}</h1>
        <p>{level.brief}</p>
        <h2>{t.requirements}</h2>
        <ul>
          <li>{t.p95Requirement(level.requirements.p95Ms)}</li>
          <li>{t.errorRequirement(level.requirements.maxErrorRate)}</li>
          {level.traffic.map(s => <li key={s.fromS}>{t.traffic(s.rps, s.fromS, s.toS)}</li>)}
        </ul>
        <button className="play" onClick={() => setResult(simulate(level, design, 1))}>{t.play}</button>
        <div role="status" className={`result ${result ? (result.passed ? 'ok' : 'bad') : ''}`}>
          {result ? <><strong>{result.passed ? t.passed : t.failed}</strong><span>{t.resultLine(result.p95, result.errorRate)}</span></> : t.pressPlay}
        </div>
      </header>
      <main className="canvas">
        <ReactFlow nodes={flow.nodes} edges={flow.edges} colorMode="dark" fitView fitViewOptions={{ maxZoom: 1.2 }} proOptions={{ hideAttribution: true }}>
          <Background gap={24} />
        </ReactFlow>
      </main>
    </div>
  );
}
