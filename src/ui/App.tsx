import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addEdge, Background, BackgroundVariant, ReactFlow, ReactFlowProvider, useEdgesState, useNodesState, useReactFlow,
  type Connection, type Edge, type Node, type XYPosition,
} from '@xyflow/react';
import { DesignError, designCost, simulate } from '../engine/simulate';
import type { Design, DesignProblem, Result } from '../engine/types';
import { en as t } from '../i18n/en';
import { allLevels, type LevelDefinition } from '../levels/levels';
import { CostMeter } from './costMeter';
import { DRAG_TYPE, Hotbar } from './hotbar';
import { Objectives } from './objectives';
import { ReportCard } from './reportCard';

type ComponentNode = Node<{ label: string; type: string | null }>;
const GAP = 220;

const labelOf = (type: string) => t.componentTypes[type] ?? type;
const clientNode: ComponentNode = {
  id: 'client', type: 'input', position: { x: 0, y: 0 }, deletable: false, className: 'node',
  data: { label: t.clients, type: null }, sourcePosition: 'right' as ComponentNode['sourcePosition'],
};

function toDesign(nodes: ComponentNode[], edges: Edge[]): Design {
  return {
    components: nodes.filter(n => n.data.type).map(n => ({ id: n.id, type: n.data.type! })),
    connections: edges.map(e => [e.source, e.target] as [string, string]),
  };
}

function describeProblem(problem: DesignProblem, nodes: ComponentNode[]): string {
  const label = (id: string) => nodes.find(n => n.id === id)?.data.label ?? id;
  switch (problem.kind) {
    case 'noEntry': return t.problems.noEntry;
    case 'deadEnd': return t.problems.deadEnd(label(problem.componentId));
    case 'loop': return t.problems.loop(problem.componentIds.map(label));
  }
}

function Game({ level }: { level: LevelDefinition }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<ComponentNode>([clientNode]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [problem, setProblem] = useState<{ message: string; componentIds: string[] } | null>(null);
  const counter = useRef(0);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const nodeCount = nodes.length;
  // Keep every component in view as the design grows. Instant, so the view never slides under a drag.
  useEffect(() => { const timer = setTimeout(() => fitView({ maxZoom: 1.2 }), 30); return () => clearTimeout(timer); }, [nodeCount, fitView]);

  const design = useMemo(() => toDesign(nodes, edges), [nodes, edges]);
  const designKey = JSON.stringify(design);
  const cost = designCost(design);
  // Any change to the design invalidates the last run.
  useEffect(() => { setResult(null); setShowReport(false); setProblem(null); }, [designKey]);

  const addComponent = useCallback((type: string, position?: XYPosition) => {
    setNodes(current => {
      const id = `${type}-${++counter.current}`;
      const x = Math.max(...current.map(n => n.position.x)) + GAP;
      return [...current, {
        id, position: position ?? { x, y: 0 }, className: 'node', data: { label: labelOf(type), type },
        sourcePosition: 'right' as ComponentNode['sourcePosition'], targetPosition: 'left' as ComponentNode['targetPosition'],
      }];
    });
  }, [setNodes]);

  const onConnect = useCallback((c: Connection) => {
    if (c.target === 'client' || c.source === c.target) return;
    // A component forwards to one place: a new connection replaces the old one.
    setEdges(current => addEdge({ ...c, id: `${c.source}-${c.target}` }, current.filter(e => e.source !== c.source)));
  }, [setEdges]);

  const play = useCallback(() => {
    try {
      setResult(simulate(level, design, 1));
      setShowReport(true);
      setProblem(null);
    } catch (e) {
      if (!(e instanceof DesignError)) throw e;
      const p = e.problem;
      setProblem({ message: describeProblem(p, nodes), componentIds: p.kind === 'deadEnd' ? [p.componentId] : p.kind === 'loop' ? p.componentIds : ['client'] });
    }
  }, [level, design, nodes]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showReport || (e.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]')) return;
      const index = Number(e.key) - 1;
      if (Number.isInteger(index) && level.allowedComponents[index]) {
        addComponent(level.allowedComponents[index]!);
        e.preventDefault();
      } else if (e.code === 'Space' && !(e.target as HTMLElement).closest('button')) {
        play();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [addComponent, play, level.allowedComponents, showReport]);

  return (
    <div className="game">
      <ReactFlow nodes={problem ? nodes.map(n => (problem.componentIds.includes(n.id) ? { ...n, className: 'node problem-node' } : n)) : nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
        deleteKeyCode={['Backspace', 'Delete']} panActivationKeyCode={null} colorMode="dark"
        fitView fitViewOptions={{ maxZoom: 1.2 }} proOptions={{ hideAttribution: true }}
        onDragOver={e => { if (e.dataTransfer.types.includes(DRAG_TYPE)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } }}
        onDrop={e => {
          const type = e.dataTransfer.getData(DRAG_TYPE);
          if (!type) return;
          e.preventDefault();
          addComponent(type, screenToFlowPosition({ x: e.clientX, y: e.clientY }));
        }}>
        <Background variant={BackgroundVariant.Dots} gap={26} size={1.5} />
      </ReactFlow>

      <section className="hud mission">
        <h1>{level.title}</h1>
        <p>{level.brief}</p>
        <Objectives level={level} cost={cost} result={result} />
        <ul className="traffic">{level.traffic.map(s => <li key={s.fromS}>{t.traffic(s.rps, s.fromS, s.toS)}</li>)}</ul>
        <p className="hint">{t.canvasHint}</p>
      </section>

      <section className="hud cost-hud">
        <CostMeter cost={cost} budget={level.budget} thresholds={level.starCostThresholds} />
      </section>

      <div className="hud controls">
        <Hotbar types={level.allowedComponents} onAdd={type => addComponent(type)} />
        <button className="play" onClick={play}>{t.play}</button>
      </div>
      {problem && <div className="hud problem" role="alert">{problem.message}</div>}

      {result && showReport && <ReportCard result={result} maxStars={1 + level.starCostThresholds.length} onClose={() => setShowReport(false)} />}
    </div>
  );
}

export function App() {
  const level = allLevels()[0]!;
  return <ReactFlowProvider><Game level={level} /></ReactFlowProvider>;
}
