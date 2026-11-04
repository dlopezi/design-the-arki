import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Background, BackgroundVariant, ReactFlow, ReactFlowProvider, useReactFlow, type Connection, type Edge, type Node } from '@xyflow/react';
import { DesignError, designCost, simulate } from '../engine/simulate';
import type { Design, DesignProblem, Result } from '../engine/types';
import { en as t } from '../i18n/en';
import { allLevels, type LevelDefinition } from '../levels/levels';
import { CostMeter } from './costMeter';
import { layoutDiagram, nodeTypes } from './diagram';
import { DRAG_TYPE, Hotbar } from './hotbar';
import { Inspector } from './inspector';
import { Objectives } from './objectives';
import { ReportCard } from './reportCard';

const EMPTY: Design = { components: [], connections: [] };
// Keep the diagram clear of the floating panels: mission (left), inspector (right), controls (bottom).
const FIT = { maxZoom: 1.1, padding: { top: '40px', left: '340px', right: '340px', bottom: '140px' } } as const;
const labelOf = (design: Design, id: string) => {
  const component = design.components.find(c => c.id === id);
  return component ? (t.componentTypes[component.type] ?? component.type) : t.clients;
};

function describeProblem(problem: DesignProblem, design: Design): string {
  const label = (id: string) => labelOf(design, id);
  switch (problem.kind) {
    case 'noEntry': return t.problems.noEntry;
    case 'deadEnd': return t.problems.deadEnd(label(problem.componentId));
    case 'loop': return t.problems.loop(problem.componentIds.map(label));
    case 'needsBalancer': return t.problems.needsBalancer(label(problem.componentId));
  }
}

const problemComponents = (problem: DesignProblem): string[] =>
  problem.kind === 'noEntry' ? ['client'] : problem.kind === 'loop' ? problem.componentIds : [problem.componentId];

function Game({ level }: { level: LevelDefinition }) {
  const [design, setDesign] = useState<Design>(EMPTY);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [problem, setProblem] = useState<{ message: string; componentIds: string[] } | null>(null);
  const counter = useRef(0);
  const { fitView } = useReactFlow();

  const diagram = useMemo(() => layoutDiagram(design, { selected, problemIds: problem?.componentIds ?? [] }), [design, selected, problem]);
  const cost = designCost(design);
  const designKey = JSON.stringify(design);
  // Any change to the design invalidates the last run.
  useEffect(() => { setResult(null); setShowReport(false); setProblem(null); }, [designKey]);
  // Keep the whole diagram in view as it grows. Instant, so the view never slides under a drag.
  const shapeKey = diagram.nodes.map(n => `${n.id}:${n.width}x${n.height}`).join('|');
  useEffect(() => { const timer = setTimeout(() => fitView(FIT), 30); return () => clearTimeout(timer); }, [shapeKey, fitView]);

  const addComponent = useCallback((type: string) => {
    const id = `${type}-${++counter.current}`;
    setDesign(d => ({ ...d, components: [...d.components, { id, type, params: {} }] }));
    setSelected(id);
  }, []);

  const removeComponent = useCallback((id: string) => {
    setDesign(d => ({ components: d.components.filter(c => c.id !== id), connections: d.connections.filter(([a, b]) => a !== id && b !== id) }));
    setSelected(s => (s === id ? null : s));
  }, []);

  const updateParams = useCallback((id: string, params: Record<string, unknown>) => {
    setDesign(d => ({ ...d, components: d.components.map(c => (c.id === id ? { ...c, params } : c)) }));
  }, []);

  const onConnect = useCallback((c: Connection) => {
    if (c.target === 'client' || c.source === c.target) return;
    // A component forwards to one place: a new connection replaces the old one.
    setDesign(d => ({ ...d, connections: [...d.connections.filter(([from]) => from !== c.source), [c.source, c.target]] }));
  }, []);

  const onNodesDelete = useCallback((nodes: Node[]) => {
    for (const n of nodes) if (n.type === 'component') removeComponent(n.id);
  }, [removeComponent]);

  const onEdgesDelete = useCallback((edges: Edge[]) => {
    const gone = new Set(edges.map(e => `${e.source}->${e.target}`));
    setDesign(d => ({ ...d, connections: d.connections.filter(([a, b]) => !gone.has(`${a}->${b}`)) }));
    setSelected(null);
  }, []);

  const play = useCallback(() => {
    try {
      setResult(simulate(level, design, 1));
      setShowReport(true);
      setProblem(null);
    } catch (e) {
      if (!(e instanceof DesignError)) throw e;
      setProblem({ message: describeProblem(e.problem, design), componentIds: problemComponents(e.problem) });
    }
  }, [level, design]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (showReport || target.closest('input, textarea, select, [contenteditable="true"]')) return;
      const index = Number(e.key) - 1;
      if (Number.isInteger(index) && level.allowedComponents[index]) {
        addComponent(level.allowedComponents[index]!);
        e.preventDefault();
      } else if (e.code === 'Space' && !target.closest('button')) {
        play();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [addComponent, play, level.allowedComponents, showReport]);

  const selectedComponent = design.components.find(c => c.id === selected) ?? null;

  return (
    <div className="game">
      <ReactFlow nodes={diagram.nodes} edges={diagram.edges} nodeTypes={nodeTypes} onConnect={onConnect}
        onNodesDelete={onNodesDelete} onEdgesDelete={onEdgesDelete}
        onNodeClick={(_, n) => setSelected(n.type === 'component' ? n.id : n.type === 'instance' ? n.parentId ?? null : null)}
        onEdgeClick={(_, e) => setSelected(e.id)} onPaneClick={() => setSelected(null)}
        nodesDraggable={false} deleteKeyCode={['Backspace', 'Delete']} panActivationKeyCode={null} colorMode="dark"
        fitView fitViewOptions={FIT} proOptions={{ hideAttribution: true }}
        onDragOver={e => { if (e.dataTransfer.types.includes(DRAG_TYPE)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } }}
        onDrop={e => { const type = e.dataTransfer.getData(DRAG_TYPE); if (type) { e.preventDefault(); addComponent(type); } }}>
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

      <Inspector component={selectedComponent} options={selectedComponent ? level.componentOptions[selectedComponent.type] : undefined}
        onChange={params => selectedComponent && updateParams(selectedComponent.id, params)}
        onRemove={() => selectedComponent && removeComponent(selectedComponent.id)} />

      <div className="hud controls">
        <Hotbar types={level.allowedComponents} onAdd={addComponent} />
        <button className="play" onClick={play}>{t.play}</button>
      </div>
      {problem && <div className="hud problem" role="alert">{problem.message}</div>}

      {result && showReport && <ReportCard result={result} maxStars={1 + level.starCostThresholds.length} onClose={() => setShowReport(false)} />}
    </div>
  );
}

/** Until the level select exists (ticket 09), `#<level id>` picks a level; the default is the first one. */
function levelFromHash(): LevelDefinition {
  const levels = allLevels();
  return levels.find(l => l.id === decodeURIComponent(location.hash.slice(1))) ?? levels[0]!;
}

export function App() {
  const [level, setLevel] = useState(levelFromHash);
  useEffect(() => {
    const onHash = () => setLevel(levelFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return <ReactFlowProvider key={level.id}><Game level={level} /></ReactFlowProvider>;
}
