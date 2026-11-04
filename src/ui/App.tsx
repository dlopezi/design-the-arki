import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Background, BackgroundVariant, ReactFlow, ReactFlowProvider, useReactFlow, type Connection, type Edge, type Node } from '@xyflow/react';
import { BUCKET_S, DesignError, designCost, simulate } from '../engine/simulate';
import type { Design, DesignProblem, Result } from '../engine/types';
import { en as t, percent } from '../i18n/en';
import { allLevels, type LevelDefinition } from '../levels/levels';
import { CostMeter } from './costMeter';
import { edgeTypes, instanceNames, layoutDiagram, nodeTypes } from './diagram';
import { DRAG_TYPE, Hotbar } from './hotbar';
import { Inspector } from './inspector';
import { Objectives } from './objectives';
import { ReportCard } from './reportCard';
import { ResultsDrawer } from './resultsDrawer';

const EMPTY: Design = { components: [], connections: [] };
/** Real seconds the playback of a whole level takes. */
const PLAYBACK_MS = 6000;

function usePrefersReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduce, setReduce] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setReduce(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return reduce;
}
// Keep the diagram clear of the floating panels: mission (left), inspector (right), controls and results (bottom).
const px = (n: number) => `${n}px` as const;
const fitOptions = (inspector: boolean, results: boolean) => ({
  maxZoom: 1.1,
  padding: { top: px(40), left: px(340), right: px(inspector ? 340 : 40), bottom: px(results ? 330 : 140) },
});
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
  const [playT, setPlayT] = useState<number | null>(null);
  const frame = useRef(0);
  const counter = useRef(0);
  const { fitView } = useReactFlow();
  const reduceMotion = usePrefersReducedMotion();
  const running = playT !== null;
  const bucket = running && result ? Math.max(0, Math.min(result.buckets.length - 1, Math.floor(playT / BUCKET_S))) : 0;
  const live = running && result ? { result, bucket, animate: !reduceMotion } : null;
  const [panels, setPanels] = useState({ inspector: true, results: true });
  const togglePanel = useCallback((panel: 'inspector' | 'results') => setPanels(p => ({ ...p, [panel]: !p[panel] })), []);
  const bottleneckId = result && !running && !result.passed ? (result.bottleneck?.componentId ?? null) : null;
  const hintFor = (r: Result | null): string | null => {
    const id = r?.bottleneck?.componentId;
    const component = id ? design.components.find(c => c.id === id) : undefined;
    if (!component) return null;
    return t.hints[component.type] ?? t.genericHint(t.componentTypes[component.type] ?? component.type);
  };
  const hint = hintFor(result);

  const diagram = useMemo(() => layoutDiagram(design, { selected, problemIds: problem?.componentIds ?? [], live, bottleneckId }),
    [design, selected, problem, live?.result, live?.bucket, live?.animate, bottleneckId]); // eslint-disable-line react-hooks/exhaustive-deps
  const FIT = fitOptions(panels.inspector, panels.results);
  const cost = designCost(design);
  const designKey = JSON.stringify(design);
  // Any change to the design invalidates the last run.
  useEffect(() => { cancelAnimationFrame(frame.current); setPlayT(null); setResult(null); setShowReport(false); setProblem(null); }, [designKey]);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  // Keep the whole diagram in view as it grows. Instant, so the view never slides under a drag.
  const shapeKey = diagram.nodes.map(n => `${n.id}:${n.width}x${n.height}`).join('|');
  useEffect(() => { const timer = setTimeout(() => fitView(FIT), 30); return () => clearTimeout(timer); }, [shapeKey, fitView, panels.inspector, panels.results]); // eslint-disable-line react-hooks/exhaustive-deps

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
      setShowReport(false);
      setProblem(null);
      // Replay the run: the whole level in PLAYBACK_MS, then the report.
      const started = performance.now();
      setPlayT(0);
      const tick = (now: number) => {
        // A frame's timestamp can be slightly earlier than `started`.
        const progress = Math.max(0, (now - started) / PLAYBACK_MS);
        if (progress >= 1) { setPlayT(null); setShowReport(true); return; }
        setPlayT(progress * level.durationS);
        frame.current = requestAnimationFrame(tick);
      };
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(tick);
    } catch (e) {
      if (!(e instanceof DesignError)) throw e;
      setProblem({ message: describeProblem(e.problem, design), componentIds: problemComponents(e.problem) });
    }
  }, [level, design]);

  const skip = useCallback(() => { cancelAnimationFrame(frame.current); setPlayT(null); setShowReport(true); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (showReport || running || target.closest('input, textarea, select, [contenteditable="true"]')) return;
      const index = Number(e.key) - 1;
      if (Number.isInteger(index) && level.allowedComponents[index]) {
        addComponent(level.allowedComponents[index]!);
        e.preventDefault();
      } else if (e.code === 'Space' && !target.closest('button')) {
        play();
        e.preventDefault();
      } else if (e.key === 'i' || e.key === 'I') {
        togglePanel('inspector');
      } else if (e.key === 'r' || e.key === 'R') {
        togglePanel('results');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [addComponent, play, level.allowedComponents, showReport, running, togglePanel]);

  const selectedComponent = design.components.find(c => c.id === selected) ?? null;

  return (
    <div className="game" data-results={panels.results}>
      <ReactFlow nodes={diagram.nodes} edges={diagram.edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onConnect={onConnect}
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
        <Objectives level={level} cost={cost} result={running ? null : result} />
        <ul className="traffic">{level.traffic.map(s => <li key={s.fromS}>{t.traffic(s.rps, s.fromS, s.toS)}</li>)}</ul>
        <p className="hint">{t.canvasHint}</p>
      </section>

      <section className="hud cost-hud">
        <CostMeter cost={cost} budget={level.budget} thresholds={level.starCostThresholds} />
      </section>

      <div className="hud panel-toggles">
        <button aria-pressed={panels.inspector} onClick={() => togglePanel('inspector')} title="I">{t.panels.inspector}</button>
        <button aria-pressed={panels.results} onClick={() => togglePanel('results')} title="R">{t.panels.results}</button>
      </div>

      {panels.inspector && (
        <Inspector component={selectedComponent} options={selectedComponent ? level.componentOptions[selectedComponent.type] : undefined}
          onChange={params => selectedComponent && updateParams(selectedComponent.id, params)}
          onRemove={() => selectedComponent && removeComponent(selectedComponent.id)}
          lastRun={result && !running && selectedComponent ? (result.components.find(c => c.id === selectedComponent.id) ?? null) : null}
          instanceNames={selectedComponent ? instanceNames(design).get(selectedComponent.id) : undefined} />
      )}

      {panels.results && <ResultsDrawer level={level} design={design} result={result} running={running} bucket={bucket} hint={hint} />}

      <div className={`hud controls ${panels.results ? 'above-results' : ''}`}>
        <Hotbar types={level.allowedComponents} onAdd={addComponent} />
        <button className="play" onClick={play} disabled={running}>{t.play}</button>
        {running && <button className="secondary" onClick={skip}>{t.skip}</button>}
      </div>
      {running && result && (() => {
        const b = result.buckets[bucket]!;
        return (
          <div className="hud clock" role="timer" aria-label={t.clock}>
            <strong>t = {Math.floor(playT)} s</strong>
            <span>{Math.round(b.rps)} req/s</span>
            <span className={b.p95 > level.requirements.p95Ms ? 'bad' : 'ok'}>p95 {Math.round(b.p95)} ms</span>
            <span className={b.errorRate > level.requirements.maxErrorRate ? 'bad' : ''}>{percent(b.errorRate)} {t.errorsWord}</span>
          </div>
        );
      })()}
      {problem && <div className="hud problem" role="alert">{problem.message}</div>}

      {result && showReport && (
        <ReportCard result={result} maxStars={1 + level.starCostThresholds.length} hint={hint} onClose={() => setShowReport(false)}
          onDetails={() => { setShowReport(false); setPanels({ inspector: true, results: true }); setSelected(result.bottleneck?.componentId ?? null); }} />
      )}
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
