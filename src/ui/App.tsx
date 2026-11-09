import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Background, BackgroundVariant, MiniMap, ReactFlow, ReactFlowProvider, useReactFlow, useStore, type Connection, type Edge, type Node } from '@xyflow/react';
import { BUCKET_S, DesignError, designCost, simulate } from '../engine/simulate';
import type { Design, DesignProblem, Result } from '../engine/types';
import { t, percent } from '../i18n';
import { allLevels, type LevelDefinition, type TutorialStep } from '../levels/levels';
import { CostMeter } from './costMeter';
import { buildingCount } from '../base/base';
import { newTypesIn } from '../archive/archive';
import { componentArt } from './componentArt';
import { edgeTypes, instanceNames, layoutDiagram, nodeTypes, type C4Layer } from './diagram';
import { DRAG_TYPE, Hotbar } from './hotbar';
import { ClientsInspector, Inspector } from './inspector';
import { CLIENTS, connectionTargets, forwardsRequests, targetOf, withConnection } from './connections';
import { MissionPanel } from './missionPanel';
import { viewportInArea, type Margins } from './fit';
import { COMPACT_QUERY, MEDIUM_QUERY, TALL_QUERY, useMediaQuery } from './useMediaQuery';
import { ReportCard } from './reportCard';
import { ResultsDrawer } from './resultsDrawer';
import { LevelSelect } from './levelSelect';
import { isUnlocked, loadProgress, resetProgress, saveProgress, withDesign, withPass, withTutorialDone, type Progress } from '../progress/progress';
import { hintAllowed, isMode, startingDesign, type Mode } from '../levels/modes';
import { ModePicker } from './modePicker';
import { ARCHIVE_HASH, BASE_HASH, BRIEFING_HASH, LEVELS_HASH, levelsHref } from './routes';
import { Archive } from './archive';
import { BasePage } from './basePage';
import { Landing } from './landing';
import { track } from '../analytics/analytics';
import { FeedbackButton } from './feedbackDialog';

const EMPTY: Design = { components: [], connections: [] };
/** Real seconds the playback of a whole level takes. */
const PLAYBACK_MS = 6000;

const usePrefersReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)');
type Layout = 'compact' | 'medium' | 'wide';
/** Medium layout sizes (px), kept in step with `.game.medium` in styles.css. */
const MEDIUM = { side: 282, resultsTall: 270, resultsShort: 204, controls: 108, top: 170, topWithTutorial: 300 };
const px = (n: number) => `${n}px` as const;
/**
 * Keep the diagram clear of the floating panels.
 * Wide: mission (left), inspector (right), controls and results (bottom).
 * Medium: the side panel (left), cost and tutorial (top), controls and results (bottom).
 * Compact: the diagram has its own area between the bars, so a small margin is enough.
 */
type FitState = { inspector: boolean; results: boolean; tutorial: boolean; tall: boolean; ran: boolean };
const mediumMargins = ({ results, tutorial, tall }: FitState): Margins => ({
  top: tutorial ? MEDIUM.topWithTutorial : MEDIUM.top,
  left: MEDIUM.side + 8,
  right: 24,
  bottom: 16 + (results ? (tall ? MEDIUM.resultsTall : MEDIUM.resultsShort) + 16 : 0) + MEDIUM.controls + 16,
});
const MAX_ZOOM = 1.1;
const fitOptions = (layout: Layout, state: FitState) => {
  const { results, tutorial, ran } = state;
  if (layout === 'compact') return { maxZoom: MAX_ZOOM, minZoom: COMPACT_MIN_ZOOM, padding: px(16) };
  if (layout === 'medium') {
    const m = mediumMargins(state);
    return { maxZoom: MAX_ZOOM, minZoom: COMPACT_MIN_ZOOM, padding: { top: px(m.top), right: px(m.right), bottom: px(m.bottom), left: px(m.left) } };
  }
  // Wide: the inspector lives in the console, so it never covers the diagram.
  // Before the first run the results panel is one line high; the tutorial card sits under the top bar.
  const resultsHeight = results ? (ran ? WIDE.results : WIDE.resultsEmpty) + 12 : 0;
  return { maxZoom: 1.1, padding: { top: px(WIDE.bar + 24 + (tutorial ? WIDE.tutorial : 0)), left: px(WIDE.mission + 40), right: px(32), bottom: px(WIDE.console + 24 + resultsHeight) } };
};
/** Wide layout sizes (px), kept in step with `.game.wide` in styles.css: top bar, mission width, console and results heights. */
const WIDE = { bar: 52, mission: 300, console: 216, results: 196, resultsEmpty: 72, tutorial: 110, map: 220 };
/** A phone is narrower than the diagram at React Flow's default minimum zoom (0.5); the player can pinch to zoom in. */
const COMPACT_MIN_ZOOM = 0.25;
type SheetTab = 'mission' | 'inspector' | 'results';
const SHEET_TABS: SheetTab[] = ['mission', 'inspector', 'results'];
type SideTab = 'mission' | 'inspector';
const SIDE_TABS: SideTab[] = ['mission', 'inspector'];
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
    case 'notPublic': return t.problems.notPublic(label(problem.componentId));
  }
}

const problemComponents = (problem: DesignProblem): string[] =>
  problem.kind === 'noEntry' ? ['client'] : problem.kind === 'loop' ? problem.componentIds : [problem.componentId];

type GameProps = {
  level: LevelDefinition;
  /** Component types this level offers for the first time. */
  newTypes: string[];
  mode: Mode;
  initialDesign: Design | null;
  nextLevelId: string | null;
  onDesignChange: (design: Design) => void;
  /** The level was passed with this many stars, by this design. */
  onPassed: (stars: number, design: Design) => void;
  /** Steps to walk through, or null when there is no tutorial to show. */
  tutorial: TutorialStep[] | null;
  onTutorialDone: () => void;
};

/** Highest numeric suffix among component ids, so new ids never clash with a restored design. */
const lastIdNumber = (design: Design) => Math.max(0, ...design.components.map(c => Number(c.id.split('-').pop()) || 0));

function Game({ level, newTypes, mode, initialDesign, nextLevelId, onDesignChange, onPassed, tutorial: tutorialAtStart, onTutorialDone }: GameProps) {
  // Keep the steps for this session, so the closing message stays after progress records the tutorial as done.
  const [tutorial] = useState(tutorialAtStart);
  const passedOnce = useRef(false);
  useEffect(() => {
    track('Level started', { level: level.id, mode });
    return () => { if (!passedOnce.current) track('Level abandoned', { level: level.id, mode }); };
  }, [level.id, mode]);
  const [design, setDesign] = useState<Design>(initialDesign ?? EMPTY);
  const [selected, setSelected] = useState<string | null>(null);
  const [c4Layer, setC4Layer] = useState<C4Layer>(3);
  const [result, setResult] = useState<Result | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [problem, setProblem] = useState<{ message: string; componentIds: string[] } | null>(null);
  const [playT, setPlayT] = useState<number | null>(null);
  const frame = useRef(0);
  const counter = useRef(lastIdNumber(initialDesign ?? EMPTY));
  const { fitView, setViewport, getNodes, getNodesBounds } = useReactFlow();
  const flowWidth = useStore(s => s.width);
  const flowHeight = useStore(s => s.height);
  const reduceMotion = usePrefersReducedMotion();
  const running = playT !== null;
  const bucket = running && result ? Math.max(0, Math.min(result.buckets.length - 1, Math.floor(playT / BUCKET_S))) : 0;
  const live = running && result ? { result, bucket, animate: !reduceMotion, t: playT } : null;
  const [panels, setPanels] = useState({ inspector: true, results: true });
  const compact = useMediaQuery(COMPACT_QUERY);
  const medium = useMediaQuery(MEDIUM_QUERY);
  const tall = useMediaQuery(TALL_QUERY);
  const layout: Layout = compact ? 'compact' : medium ? 'medium' : 'wide';
  const [sideTab, setSideTab] = useState<SideTab>('mission');
  const [sheet, setSheet] = useState<{ tab: SheetTab; open: boolean }>({ tab: 'mission', open: true });
  const openSheet = useCallback((tab: SheetTab) => setSheet({ tab, open: true }), []);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [tutorialFinished, setTutorialFinished] = useState(false);
  const [tutorialSkipped, setTutorialSkipped] = useState(false);
  const step = tutorial && !tutorialFinished ? tutorial[tutorialStep] : undefined;
  const showTutorial = !!tutorial && (!!step || (tutorialFinished && !tutorialSkipped));
  const typeOf = (id: string) => design.components.find(c => c.id === id)?.type;
  // Advance the tutorial when the player does what the current step asks.
  useEffect(() => {
    if (!tutorial || !step) return;
    const until = step.until;
    const done = 'select' in until ? !!selected && typeOf(selected) === until.select
      : 'connect' in until ? design.connections.some(([a, b]) => typeOf(a) === until.connect[0] && typeOf(b) === until.connect[1])
      : until.event === 'run' ? running || !!result
      : !!result?.passed && !running;
    if (!done) return;
    if (tutorialStep + 1 < tutorial.length) setTutorialStep(tutorialStep + 1);
    else { setTutorialFinished(true); onTutorialDone(); }
  }); // eslint-disable-line react-hooks/exhaustive-deps
  const tutorialTargetType = step?.target && 'component' in step.target ? step.target.component : null;
  const tutorialOnPlay = !!step?.target && 'control' in step.target;
  const togglePanel = useCallback((panel: 'inspector' | 'results') => setPanels(p => ({ ...p, [panel]: !p[panel] })), []);
  const bottleneckId = result && !running && !result.passed ? (result.bottleneck?.componentId ?? null) : null;
  const hintFor = (r: Result | null): string | null => {
    if (!r || !hintAllowed(mode, !r.passed)) return null;
    if (r && !r.passed && (level.failureEvents?.length ?? 0) > 0 && r.errors.lost + r.errors.unavailable > 0) return t.redundancyHint;
    const id = r?.bottleneck?.componentId;
    const component = id ? design.components.find(c => c.id === id) : undefined;
    if (!component) return null;
    return t.hints[component.type] ?? t.genericHint(t.componentTypes[component.type] ?? component.type);
  };
  const hint = hintFor(result);

  const diagram = useMemo(() => layoutDiagram(design, { selected, problemIds: problem?.componentIds ?? [], live, bottleneckId, tutorialTargetType, c4Layer }),
    [design, c4Layer, selected, problem, live?.result, live?.bucket, live?.animate, live && Math.floor(live.t), bottleneckId, tutorialTargetType]); // eslint-disable-line react-hooks/exhaustive-deps
  const fitState: FitState = { inspector: panels.inspector, results: panels.results, tutorial: showTutorial, tall, ran: !!result };
  const FIT = fitOptions(layout, fitState);
  const cost = designCost(design);
  const designKey = JSON.stringify(design);
  // Any change to the design invalidates the last run.
  useEffect(() => { cancelAnimationFrame(frame.current); setPlayT(null); setResult(null); setShowReport(false); setProblem(null); }, [designKey]);
  useEffect(() => { onDesignChange(design); }, [designKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  // Keep the whole diagram in view as it grows. Instant, so the view never slides under a drag.
  const shapeKey = `${c4Layer}|` + diagram.nodes.map(n => `${n.id}:${n.width}x${n.height}`).join('|');
  // The diagram's free area also changes with the layout, the phone sheet and the tutorial card.
  // On a tablet the margins differ a lot (side panel, tall results drawer), so centre the diagram in the free area ourselves.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (layout === 'medium' && flowWidth && flowHeight) {
        setViewport(viewportInArea(getNodesBounds(getNodes()), flowWidth, flowHeight, mediumMargins(fitState), COMPACT_MIN_ZOOM, MAX_ZOOM));
      } else {
        fitView(FIT);
      }
    }, 30);
    return () => clearTimeout(timer);
  }, [shapeKey, fitView, panels.inspector, panels.results, layout, tall, sheet.open, showTutorial, tutorialStep, flowWidth, flowHeight, !!result]); // eslint-disable-line react-hooks/exhaustive-deps
  // On a phone or tablet, selecting a component shows its settings.
  const selectedIsComponent = selected === CLIENTS || design.components.some(c => c.id === selected);
  useEffect(() => {
    if (!selectedIsComponent) return;
    if (compact) openSheet('inspector');
    if (medium) setSideTab('inspector');
  }, [selected, compact, medium]); // eslint-disable-line react-hooks/exhaustive-deps

  const addComponent = useCallback((type: string) => {
    const id = `${type}-${++counter.current}`;
    setDesign(d => ({ ...d, components: [...d.components, { id, type, params: {} }] }));
    setSelected(id);
    // Layer 1 shows no components: building one switches to layer 3, where the player can see and connect it.
    setC4Layer(layer => (layer === 1 ? 3 : layer));
  }, []);

  const removeComponent = useCallback((id: string) => {
    setDesign(d => ({ components: d.components.filter(c => c.id !== id), connections: d.connections.filter(([a, b]) => a !== id && b !== id) }));
    setSelected(s => (s === id ? null : s));
  }, []);

  const updateParams = useCallback((id: string, params: Record<string, unknown>) => {
    setDesign(d => ({ ...d, components: d.components.map(c => (c.id === id ? { ...c, params } : c)) }));
  }, []);

  const onConnect = useCallback((c: Connection) => {
    setDesign(d => withConnection(d, c.source, c.target));
  }, []);

  /** Connects the selected component (or the clients) from the inspector; null disconnects it. */
  const connectTo = useCallback((from: string, to: string | null) => setDesign(d => withConnection(d, from, to)), []);

  const onNodesDelete = useCallback((nodes: Node[]) => {
    for (const n of nodes) if (n.type === 'component') removeComponent(n.id);
  }, [removeComponent]);

  const onEdgesDelete = useCallback((edges: Edge[]) => {
    const gone = new Set(edges.map(e => `${e.source}->${e.target}`));
    setDesign(d => ({ ...d, connections: d.connections.filter(([a, b]) => !gone.has(`${a}->${b}`)) }));
    setSelected(null);
  }, []);

  /** The playback ended or was skipped: show the report, and on a phone the results tab behind it. */
  const finishRun = useCallback(() => {
    setPlayT(null);
    setShowReport(true);
    if (compact) openSheet('results');
  }, [compact, openSheet]);

  const play = useCallback(() => {
    try {
      const run = simulate(level, design, 1);
      setResult(run);
      track('Run', { level: level.id, mode, passed: run.passed ? 'yes' : 'no' });
      if (run.passed) {
        onPassed(run.stars, design);
        if (!passedOnce.current) track('Level passed', { level: level.id, mode, stars: run.stars });
        passedOnce.current = true;
      }
      setShowReport(false);
      setProblem(null);
      // On a phone the sheet would hide most of the diagram: close it to watch the run.
      if (compact) setSheet(s => ({ ...s, open: false }));
      // Replay the run: the whole level in PLAYBACK_MS, then the report.
      const started = performance.now();
      setPlayT(0);
      const tick = (now: number) => {
        // A frame's timestamp can be slightly earlier than `started`.
        const progress = Math.max(0, (now - started) / PLAYBACK_MS);
        if (progress >= 1) { finishRun(); return; }
        setPlayT(progress * level.durationS);
        frame.current = requestAnimationFrame(tick);
      };
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(tick);
    } catch (e) {
      if (!(e instanceof DesignError)) throw e;
      setProblem({ message: describeProblem(e.problem, design), componentIds: problemComponents(e.problem) });
    }
  }, [level, design, onPassed, mode, compact, finishRun]);

  const skip = useCallback(() => { cancelAnimationFrame(frame.current); finishRun(); }, [finishRun]);

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
        if (compact) openSheet('inspector'); else if (medium) setSideTab(tab => (tab === 'inspector' ? 'mission' : 'inspector')); else togglePanel('inspector');
      } else if (e.key === 'r' || e.key === 'R') {
        if (compact) openSheet('results'); else togglePanel('results');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [addComponent, play, level.allowedComponents, showReport, running, togglePanel, compact, medium, openSheet]);

  const selectedComponent = design.components.find(c => c.id === selected) ?? null;

  const c4Switch = (
    <div className="hud c4-switch" role="group" aria-label={t.c4.label} title={t.c4.help}>
      <span className="console-label">{t.c4.label}</span>
      {([1, 2, 3] as const).map(layer => (
        <button key={layer} aria-pressed={c4Layer === layer} onClick={() => setC4Layer(layer)}>{layer} {t.c4.layers[layer]}</button>
      ))}
    </div>
  );
  const canvas = (
    <ReactFlow nodes={diagram.nodes} edges={diagram.edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onConnect={onConnect}
      onNodesDelete={onNodesDelete} onEdgesDelete={onEdgesDelete}
      onNodeClick={(_, n) => setSelected(n.type === 'component' || n.type === 'person' ? n.id : n.type === 'instance' ? n.parentId ?? null : null)}
      onEdgeClick={(_, e) => setSelected(e.id)} onPaneClick={() => setSelected(null)}
      nodesDraggable={false} deleteKeyCode={['Backspace', 'Delete']} panActivationKeyCode={null} colorMode="dark"
      fitView fitViewOptions={FIT} minZoom={compact ? COMPACT_MIN_ZOOM : 0.5} proOptions={{ hideAttribution: true }}
      onDragOver={e => { if (e.dataTransfer.types.includes(DRAG_TYPE)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } }}
      onDrop={e => { const type = e.dataTransfer.getData(DRAG_TYPE); if (type) { e.preventDefault(); addComponent(type); } }}>
      <Background variant={BackgroundVariant.Lines} gap={48} lineWidth={1} color="rgba(62, 224, 200, .07)" />
      {layout === 'wide' && (
        <MiniMap position="bottom-left" pannable zoomable ariaLabel={t.console.minimap} className="rts-minimap"
          style={{ width: WIDE.map, height: WIDE.console - 2 }} bgColor="#060b0d" maskColor="rgba(3, 8, 10, .7)" maskStrokeColor="#3ee0c8" maskStrokeWidth={2}
          nodeColor={n => n.type === 'component' || n.type === 'instance' ? (componentArt[(n.data as { type: string }).type]?.color ?? '#5b6577') : n.type === 'person' ? '#e2e8f0' : 'transparent'}
          nodeStrokeColor={n => (n.type === 'boundary' ? 'rgba(62, 224, 200, .35)' : 'transparent')} nodeBorderRadius={2} />
      )}
    </ReactFlow>
  );
  const mission = <MissionPanel level={level} mode={mode} newTypes={newTypes} cost={cost} result={running ? null : result} compact={compact} />;
  const feedbackLink = <FeedbackButton info={() => ({ level: level.id, mode, result: result ? (result.passed ? `passed ${result.stars}★` : 'failed') : undefined })} />;
  const costMeter = <CostMeter cost={cost} budget={level.budget} thresholds={level.starCostThresholds} />;
  const sendsToFrom = (from: string) => forwardsRequests(design, from)
    ? { from, targets: connectionTargets(design, from), current: targetOf(design, from), onChange: (to: string | null) => connectTo(from, to),
        // On a phone the tutorial's connect step points at this choice instead of a handle.
        tutorialTarget: compact && !!step && 'connect' in step.until && typeOf(from) === step.until.connect[0] }
    : null;
  const inspector = selected === CLIENTS ? <ClientsInspector sendsTo={sendsToFrom(CLIENTS)!} /> : (
    <Inspector component={selectedComponent} options={selectedComponent ? level.componentOptions[selectedComponent.type] : undefined}
      onChange={params => selectedComponent && updateParams(selectedComponent.id, params)}
      onRemove={() => selectedComponent && removeComponent(selectedComponent.id)}
      lastRun={result && !running && selectedComponent ? (result.components.find(c => c.id === selectedComponent.id) ?? null) : null}
      instanceNames={selectedComponent ? instanceNames(design).get(selectedComponent.id) : undefined}
      sendsTo={selectedComponent ? sendsToFrom(selectedComponent.id) : null} />
  );
  const results = <ResultsDrawer level={level} design={design} result={result} running={running} bucket={bucket} hint={hint} />;
  const controls = <>
    {/* On a phone or tablet there is no room for both: while a run plays, Skip takes the components' place. */}
    {!((compact || medium) && running) && <Hotbar types={level.allowedComponents} onAdd={addComponent} />}
    <button className={`play ${tutorialOnPlay ? 'tutorial-target' : ''}`} onClick={play} disabled={running}>{t.play}</button>
    {running && <button className="secondary" onClick={skip}>{t.skip}</button>}
  </>;
  const clock = running && result && (() => {
    const b = result.buckets[bucket]!;
    return (
      <div className="hud clock" role="timer" aria-label={t.clock}>
        <strong>t = {Math.floor(playT)} s</strong>
        <span>{Math.round(b.rps)} req/s</span>
        <span className={b.p95 > level.requirements.p95Ms ? 'bad' : 'ok'}>p95 {Math.round(b.p95)} ms</span>
        <span className={b.errorRate > level.requirements.maxErrorRate ? 'bad' : ''}>{percent(b.errorRate)} {t.errorsWord}</span>
      </div>
    );
  })();
  const problemNote = problem && <div className="hud problem" role="alert">{problem.message}</div>;
  const overlays = <>{clock}{problemNote}</>;
  const tutorialCard = tutorial && showTutorial && (
    <section className="hud tutorial" aria-label={t.tutorial.title} aria-live="polite">
      {step ? <>
        <span className="eyebrow">{t.tutorial.step(tutorialStep + 1, tutorial.length)}</span>
        <p>{compact && step.textCompact ? step.textCompact : step.text}</p>
        <button className="link-button" onClick={() => { setTutorialSkipped(true); setTutorialFinished(true); onTutorialDone(); }}>{t.tutorial.skip}</button>
      </> : <p>{t.tutorial.done}</p>}
    </section>
  );
  const report = result && showReport && (
    <ReportCard result={result} newBuildings={buildingCount(design)} maxStars={1 + level.starCostThresholds.length} hint={hint} nextHref={nextLevelId ? `#${nextLevelId}/${mode}` : null} onClose={() => setShowReport(false)}
      onDetails={() => {
        setShowReport(false);
        setPanels({ inspector: true, results: true });
        setSelected(result.bottleneck?.componentId ?? null);
        if (compact) openSheet('inspector');
        if (medium) setSideTab('inspector');
      }} />
  );

  // Phone: top bar, the diagram in its own area, a bottom sheet with tabs, and the component bar.
  if (compact) {
    return (
      <div className="game compact">
        <header className="top-bar">
          <a className="back" href={levelsHref}>← {t.levels}</a>
          <h1>{level.title}</h1>
          {costMeter}
        </header>
        {tutorialCard}
        <div className="canvas-area">
          {canvas}
          {c4Switch}
          <div className="overlay-stack">{overlays}</div>
        </div>
        <section className="sheet" aria-label={t.panels.title} data-open={sheet.open}>
          <div className="sheet-head">
            <div role="tablist" aria-label={t.panels.title}>
              {SHEET_TABS.map(tab => (
                <button key={tab} role="tab" id={`sheet-tab-${tab}`} aria-selected={sheet.tab === tab} aria-controls="sheet-panel" onClick={() => openSheet(tab)}>
                  {t.panels[tab]}
                </button>
              ))}
            </div>
            <button className="sheet-toggle" aria-expanded={sheet.open} aria-controls="sheet-panel" onClick={() => setSheet(s => ({ ...s, open: !s.open }))}>
              {sheet.open ? t.panels.hide : t.panels.show}
            </button>
          </div>
          <div role="tabpanel" id="sheet-panel" aria-labelledby={`sheet-tab-${sheet.tab}`} className="sheet-body" hidden={!sheet.open}>
            {sheet.tab === 'mission' && <div className="mission">{mission}{feedbackLink}</div>}
            {sheet.tab === 'inspector' && inspector}
            {sheet.tab === 'results' && results}
          </div>
        </section>
        <div className="bottom-bar">{controls}</div>
        {report}
      </div>
    );
  }

  // Tablet: one side panel with Mission and Inspector tabs, the cost top right, results and controls at the bottom.
  if (medium) {
    return (
      <div className="game medium" data-results={panels.results} data-tall={tall}>
        {canvas}
        {c4Switch}
        <section className="hud side-panel" aria-label={level.title}>
          <span className="mission-links"><a className="back" href={levelsHref}>← {t.levels}</a>{feedbackLink}</span>
          <h1>{level.title}</h1>
          <div role="tablist" aria-label={t.panels.title} className="side-tabs">
            {SIDE_TABS.map(tab => (
              <button key={tab} role="tab" id={`side-tab-${tab}`} aria-selected={sideTab === tab} aria-controls="side-panel-body" onClick={() => setSideTab(tab)}>
                {t.panels[tab]}
              </button>
            ))}
          </div>
          <div role="tabpanel" id="side-panel-body" aria-labelledby={`side-tab-${sideTab}`} className="side-body">
            {sideTab === 'mission' ? <div className="mission">{mission}</div> : inspector}
          </div>
        </section>
        <section className="hud cost-hud">{costMeter}</section>
        <div className="hud panel-toggles">
          <button aria-pressed={panels.results} onClick={() => togglePanel('results')} title="R">{t.panels.results}</button>
        </div>
        {panels.results && results}
        <div className={`hud controls ${panels.results ? 'above-results' : ''}`}>{controls}</div>
        <div className="overlay-stack">{tutorialCard}{overlays}</div>
        {report}
      </div>
    );
  }

  // Wide: a resource bar on top, the mission on the left, and a command console at the bottom
  // (minimap, the selected building's details, and the build card with Play), like a strategy game.
  return (
    <div className="game wide" data-results={panels.results}>
      {canvas}
      {c4Switch}

      <header className="hud rts-bar">
        <a className="back" href={levelsHref}>← {t.levels}</a>
        <h1>{level.title}</h1>
        {/* While a run plays, the live clock (rps, p95, errors) joins the resources. */}
        {clock}
        <div className="rts-resources">{costMeter}</div>
        <div className="panel-toggles">
          <button aria-pressed={panels.inspector} onClick={() => togglePanel('inspector')} title="I">{t.panels.inspector}</button>
          <button aria-pressed={panels.results} onClick={() => togglePanel('results')} title="R">{t.panels.results}</button>
        </div>
        {feedbackLink}
      </header>

      <section className="hud mission" aria-label={t.panels.mission}>
        <h2 className="console-label">{t.panels.mission}</h2>
        {mission}
      </section>

      {panels.results && results}

      <div className="console">
        <div className="console-frame console-map"><span className="console-label">{t.console.map}</span></div>
        <div className="console-frame console-unit">
          {panels.inspector ? inspector : <p className="muted console-empty">{t.console.inspectorHidden}</p>}
        </div>
        <div className="console-frame console-command">
          <span className="console-label">{t.console.build}</span>
          <div className="controls">{controls}</div>
        </div>
      </div>
      {problemNote}
      {tutorialCard}
      {report}
    </div>
  );
}

/** `#` is the landing page, `#levels` the level select, `#archive` / `#briefing` the Building Archive, `#base` the player's Base, `#<level>` the mode picker, `#<level>/<mode>` the game. */
const routeFromHash = () => {
  const [levelId = '', mode = ''] = decodeURIComponent(location.hash.slice(1)).split('/');
  return { levelId, mode: isMode(mode) ? mode : null };
};

export function App() {
  const levels = useMemo(() => allLevels(), []);
  const ids = useMemo(() => levels.map(l => l.id), [levels]);
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [storageWorks, setStorageWorks] = useState(true);
  const [route, setRoute] = useState(routeFromHash);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const update = useCallback((next: (p: Progress) => Progress) => {
    setProgress(current => {
      const updated = next(current);
      if (updated !== current) setStorageWorks(saveProgress(updated));
      return updated;
    });
  }, []);

  const level = levels.find(l => l.id === route.levelId);
  const locked = !!level && !isUnlocked(ids, level.id, progress);
  useEffect(() => {
    if (level && locked) {
      setNotice(t.levelSelect.lockedNotice(level.title));
      history.replaceState(null, '', `${location.pathname}${levelsHref}`);
      setRoute({ levelId: LEVELS_HASH, mode: null });
    } else if (level) {
      setNotice(null);
    }
  }, [level, locked]);

  if (!level && route.levelId === '') return <Landing levels={levels} progress={progress} />;
  if (route.levelId === ARCHIVE_HASH || route.levelId === BRIEFING_HASH) {
    return <Archive key={route.levelId} levels={levels} progress={progress} briefing={route.levelId === BRIEFING_HASH} />;
  }
  if (route.levelId === BASE_HASH) return <BasePage levels={levels} progress={progress} />;
  if (!level || locked) {
    return <LevelSelect levels={levels} progress={progress} notice={notice} storageWorks={storageWorks}
      onReset={() => { setProgress(resetProgress()); setNotice(null); }} />;
  }
  const tutorialDone = !!progress.tutorialDone;
  // Until the tutorial is done, only guided mode can be played.
  if (!route.mode || (!tutorialDone && route.mode !== 'guided')) return <ModePicker level={level} tutorialDone={tutorialDone} />;
  const mode = route.mode;
  const next = ids[ids.indexOf(level.id) + 1];
  return (
    <ReactFlowProvider key={`${level.id}/${mode}`}>
      <Game level={level} newTypes={newTypesIn(levels, level.id)} mode={mode} initialDesign={progress.levels[level.id]?.designs?.[mode] ?? startingDesign(level, mode)}
        nextLevelId={next ?? null}
        onDesignChange={design => update(p => withDesign(p, level.id, mode, design))}
        onPassed={(stars, design) => update(p => withPass(p, level.id, stars, mode, design))}
        tutorial={!tutorialDone && mode === 'guided' && level.tutorial ? level.tutorial : null}
        onTutorialDone={() => update(withTutorialDone)} />
    </ReactFlowProvider>
  );
}
