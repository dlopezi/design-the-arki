// PROTOTYPE: shared game state + diagram pieces used by every variant.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BaseEdge, Handle, applyNodeChanges, type NodeChange, Position, getBezierPath, type Edge, type EdgeProps, type Node, type NodeProps } from '@xyflow/react';
import { Database, Monitor, Server, Split, Zap, type LucideIcon } from 'lucide-react';
import Engine from './engine.js';

export const LEVEL = {
  chapter: 'Capítulo 1 · Núcleo',
  name: 'Rebajas en la tienda online',
  brief: 'Una tienda online lanza unas rebajas relámpago. El tráfico base es de 200 peticiones/s y durante 10 s se dispara a 500.',
  durationS: 60,
  traffic: [{ fromS: 0, toS: 30, rps: 200 }, { fromS: 30, toS: 40, rps: 500 }, { fromS: 40, toS: 60, rps: 200 }],
  requirements: { p95Ms: 200, maxErrorRate: 0.01 },
  budget: 400,
  starCostThresholds: [300, 230],
};

export type Tier = 'small' | 'medium' | 'large';
export type DesignState = { servers: number; dbTier: Tier; cacheOn: boolean; ttlS: number; failure: boolean };
export type CompType = 'client' | 'lb' | 'server' | 'cache' | 'db';

export const META: Record<CompType, { label: string; icon: LucideIcon; blurb: string }> = {
  client: { label: 'Clientes', icon: Monitor, blurb: 'Origen del tráfico' },
  lb: { label: 'Balanceador', icon: Split, blurb: 'Reparte peticiones entre servidores' },
  server: { label: 'Servidor de app', icon: Server, blurb: '≈200 pet/s por instancia' },
  cache: { label: 'Caché', icon: Zap, blurb: 'Responde lecturas repetidas' },
  db: { label: 'Base de datos', icon: Database, blurb: 'Fuente de verdad' },
};
export const TIER_LABEL: Record<Tier, string> = { small: 'Pequeña', medium: 'Mediana', large: 'Grande' };
export const PALETTE: { type: CompType; cost: string }[] = [
  { type: 'lb', cost: '$20' }, { type: 'server', cost: '$40/inst.' }, { type: 'cache', cost: '$30' }, { type: 'db', cost: '$50–400' },
];

function buildDesign(s: DesignState) {
  const components: any[] = [{ id: 'lb', type: 'lb' }, { id: 'app', type: 'server', params: { instances: s.servers } }, { id: 'db', type: 'db', params: { tier: s.dbTier } }];
  const connections: [string, string][] = [['client', 'lb'], ['lb', 'app']];
  if (s.cacheOn) { components.push({ id: 'cache', type: 'cache', params: { ttlS: s.ttlS } }); connections.push(['app', 'cache'], ['cache', 'db']); }
  else connections.push(['app', 'db']);
  return { components, connections };
}

export type Result = ReturnType<typeof Engine.simulate>;
const PLAY_MS = 6000;

export function useGame() {
  const [design, setDesign] = useState<DesignState>({ servers: 3, dbTier: 'small', cacheOn: true, ttlS: 60, failure: false });
  const [selected, setSelected] = useState<string | null>('app');
  const [result, setResult] = useState<Result | null>(null);
  const [playT, setPlayT] = useState<number | null>(null); // simulated seconds while animating
  const raf = useRef(0);

  const engineDesign = useMemo(() => buildDesign(design), [design]);
  const cost = Engine.designCost(engineDesign);

  const update = (patch: Partial<DesignState>) => { setDesign(d => ({ ...d, ...patch })); setResult(null); };
  const actions = {
    addServer: () => update({ servers: Math.min(8, design.servers + 1) }),
    removeServer: () => update({ servers: Math.max(1, design.servers - 1) }),
    setTier: (dbTier: Tier) => update({ dbTier }),
    addCache: () => update({ cacheOn: true }),
    removeCache: () => { update({ cacheOn: false }); setSelected(null); },
    ttl: (delta: number) => update({ ttlS: Math.max(0, Math.min(600, design.ttlS + delta)) }),
    setFailure: (failure: boolean) => update({ failure }),
    addFromPalette: (t: CompType) => { if (t === 'server') actions.addServer(); if (t === 'cache') actions.addCache(); setSelected(t === 'server' ? 'app' : t); },
  };

  const run = () => {
    const level = { ...LEVEL, failureEvents: design.failure ? [{ atS: 20, componentId: 'app', instance: 0 }] : [] };
    const r = Engine.simulate(level, engineDesign, 42);
    setResult(r);
    setPlayT(0);
    cancelAnimationFrame(raf.current);
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = (now - t0) / PLAY_MS;
      if (k >= 1) { setPlayT(null); return; }
      setPlayT(k * LEVEL.durationS); raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const running = playT !== null;
  const done = !!result && !running;
  const bucket = result && running ? result.buckets[Math.min(result.buckets.length - 1, Math.floor(playT! / 5))] : null;
  const bottleneckType = result?.bottleneck ? result.components.find((c: any) => c.id === result.bottleneck)?.type as CompType : null;

  return { design, engineDesign, cost, selected, setSelected, actions, run, result, running, done, playT, bucket, bottleneckType };
}
export type Game = ReturnType<typeof useGame>;

// ---------- Diagram ----------
export type ArchNodeData = { type: CompType; title: string; sub: string; load: number | null; hot: boolean; skin: 'tool' | 'tile' | 'card'; selected: boolean };

export function loadColor(u: number | null) {
  if (u == null) return 'var(--line-strong)';
  return u >= 0.9 ? 'var(--bad)' : u >= 0.7 ? 'var(--warn)' : 'var(--ok)';
}

export function ArchNode({ data }: NodeProps<Node<ArchNodeData>>) {
  const Icon = META[data.type].icon;
  const color = loadColor(data.load);
  return (
    <div className={`arch-node skin-${data.skin} ${data.hot ? 'hot' : ''} ${data.selected ? 'sel' : ''}`} style={{ ['--load' as any]: color }}>
      {data.type !== 'client' && <Handle type="target" position={Position.Left} />}
      <div className="arch-icon"><Icon size={data.skin === 'tile' ? 26 : 18} /></div>
      <div className="arch-text">
        <div className="arch-title">{data.title}</div>
        <div className="arch-sub">{data.sub}</div>
      </div>
      {data.load != null && data.skin !== 'tile' && (
        <div className="arch-load"><span style={{ width: `${Math.min(100, data.load * 100)}%`, background: color }} /></div>
      )}
      {data.load != null && data.skin === 'tile' && <div className="arch-ring" />}
      {data.type !== 'db' && <Handle type="source" position={Position.Right} />}
    </div>
  );
}

export function FlowEdge(props: EdgeProps<Edge<{ running: boolean; hot: boolean; rate: number }>>) {
  const [path] = getBezierPath(props);
  const d = props.data!;
  const dots = d.running ? Math.max(2, Math.round(d.rate / 70)) : 0;
  const color = d.hot ? 'var(--bad)' : 'var(--accent)';
  return (
    <>
      <BaseEdge id={props.id} path={path} style={{ stroke: d.hot ? 'var(--bad)' : 'var(--line-strong)', strokeWidth: 2 }} />
      {Array.from({ length: dots }, (_, i) => (
        <circle key={i} r={3.5} fill={color}>
          <animateMotion dur="1.2s" repeatCount="indefinite" begin={`${(i * 1.2) / dots}s`} path={path} />
        </circle>
      ))}
    </>
  );
}
export const nodeTypes = { arch: ArchNode };
export const edgeTypes = { flow: FlowEdge };

export function buildFlow(g: Game, skin: ArchNodeData['skin'], gap = 230) {
  const { design, result, running, bucket, selected } = g;
  const comp = (id: string) => result?.components.find((c: any) => c.id === id);
  const live = running || g.done;
  const util = (id: string) => {
    const c = comp(id); if (!c || !live) return null;
    if (running) return c.bucketUtilization[Math.min(c.bucketUtilization.length - 1, Math.floor(g.playT! / 5))];
    return c.peakUtilization;
  };
  const hot = (id: string) => g.done && !result!.passed && result!.bottleneck === id;
  const ids = ['client', 'lb', 'app', ...(design.cacheOn ? ['cache'] : []), 'db'];
  const sub: Record<string, string> = {
    client: `${LEVEL.traffic[1].rps} pet/s en pico`,
    lb: 'round-robin',
    app: `×${design.servers} instancias${design.failure ? ' · ⚠ caída t=20s' : ''}`,
    cache: `TTL ${design.ttlS}s · ${Math.round(Engine.cacheHitRate(design.ttlS) * 100)}% aciertos`,
    db: `Tier ${TIER_LABEL[design.dbTier].toLowerCase()}`,
  };
  const typeOf: Record<string, CompType> = { client: 'client', lb: 'lb', app: 'server', cache: 'cache', db: 'db' };
  const nodes: Node<ArchNodeData>[] = ids.map((id, i) => ({
    id, type: 'arch', position: { x: i * gap, y: 0 },
    data: { type: typeOf[id], title: META[typeOf[id]].label, sub: sub[id], load: id === 'client' ? null : util(id), hot: hot(id), skin, selected: selected === id },
  }));
  const rate = bucket ? bucket.rps : 200;
  const edges: Edge[] = ids.slice(1).map((id, i) => ({
    id: `${ids[i]}-${id}`, source: ids[i], target: id, type: 'flow',
    data: { running, hot: hot(id), rate: id === 'db' && design.cacheOn ? rate * (1 - Engine.cacheHitRate(design.ttlS)) : rate },
  }));
  return { nodes, edges };
}

// ---------- Small charts ----------
export function Spark({ values, max, threshold, cursor, w = 220, h = 44, color = 'var(--accent)' }:
  { values: number[]; max: number; threshold?: number; cursor?: number | null; w?: number; h?: number; color?: string }) {
  const n = values.length, x = (i: number) => (i / Math.max(1, n - 1)) * w, y = (v: number) => h - (Math.min(v, max) / max) * (h - 4) - 2;
  return (
    <svg width={w} height={h} className="spark">
      {threshold != null && <line x1={0} x2={w} y1={y(threshold)} y2={y(threshold)} className="spark-th" />}
      <polyline points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke={color} strokeWidth={2} />
      {cursor != null && <line x1={cursor * w} x2={cursor * w} y1={0} y2={h} className="spark-cursor" />}
    </svg>
  );
}

export const fmtPct = (x: number) => `${(x * 100).toFixed(1)}%`;
export const fmtMs = (x: number) => `${Math.round(x)} ms`;

export function Stars({ n, size = 18 }: { n: number; size?: number }) {
  return <span className="stars" style={{ fontSize: size }}>{'★'.repeat(n)}<span className="stars-off">{'★'.repeat(3 - n)}</span></span>;
}

// Keep React Flow's measured sizes across our per-frame data updates (otherwise nodes stay hidden).
export function useFlowNodes(built: Node<ArchNodeData>[]) {
  const [nodes, setNodes] = useState(built);
  const key = JSON.stringify(built.map(n => [n.id, n.data, n.position]));
  useEffect(() => {
    setNodes(prev => built.map(n => { const p = prev.find(x => x.id === n.id); return p ? { ...p, data: n.data, position: n.position } : n; }));
  }, [key]); // eslint-disable-line
  const onNodesChange = useCallback((ch: NodeChange<Node<ArchNodeData>>[]) => setNodes(ns => applyNodeChanges(ch, ns)), []);
  return { nodes, onNodesChange };
}
