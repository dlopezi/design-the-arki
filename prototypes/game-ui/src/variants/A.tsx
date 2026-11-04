// PROTOTYPE Variant A: "Estudio" — IDE-like architecture tool (palette · canvas · inspector · results drawer).
import { Background, ReactFlow } from '@xyflow/react';
import { Play } from 'lucide-react';
import { LEVEL, META, PALETTE, Spark, Stars, TIER_LABEL, buildFlow, edgeTypes, fmtMs, fmtPct, nodeTypes, useFlowNodes, type Game, type Tier } from '../game';

export function VariantA({ g }: { g: Game }) {
  const flow = buildFlow(g, 'tool', 240);
  const { nodes, onNodesChange } = useFlowNodes(flow.nodes);
  const edges = flow.edges;
  const r = g.result;
  const idx = g.running ? Math.floor(g.playT! / 5) : null;
  const cursor = g.running ? g.playT! / LEVEL.durationS : null;
  const slice = <T,>(xs: T[]) => (idx == null ? xs : xs.slice(0, idx + 1));

  return (
    <div className="a-root">
      <header className="a-top">
        <div><div className="crumb">{LEVEL.chapter} · Nivel 3</div><div className="title">{LEVEL.name}</div></div>
        <div className="a-budget">
          <span className="muted">Coste</span>
          <span className="mono"><b>${g.cost}</b> / ${LEVEL.budget}</span>
          <div className="meter"><span style={{ width: `${Math.min(100, (g.cost / LEVEL.budget) * 100)}%` }} />
            {LEVEL.starCostThresholds.map(t => <i key={t} style={{ left: `${(t / LEVEL.budget) * 100}%` }} title={`★ ≤ $${t}`} />)}</div>
        </div>
        <button className="btn primary" onClick={g.run} disabled={g.running}><Play size={14} style={{ verticalAlign: -2 }} /> {g.running ? `Simulando… ${Math.floor(g.playT!)} s` : 'Simular'}</button>
      </header>

      <aside className="a-side">
        <h4>Componentes</h4>
        {PALETTE.map(p => { const Icon = META[p.type].icon; return (
          <button key={p.type} className="pal-item" onClick={() => g.actions.addFromPalette(p.type)}>
            <Icon size={18} color="var(--accent)" />
            <div>{META[p.type].label}<small>{META[p.type].blurb}</small></div>
            <span className="price">{p.cost}</span>
          </button>); })}
        <h4 style={{ marginTop: 20 }}>Incidentes</h4>
        <label className="muted" style={{ fontSize: 13 }}><input type="checkbox" checked={g.design.failure} onChange={e => g.actions.setFailure(e.target.checked)} /> Caída de un servidor (t=20 s)</label>
      </aside>

      <main className="a-canvas">
        <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} nodeTypes={nodeTypes} edgeTypes={edgeTypes} colorMode="dark" fitView fitViewOptions={{ padding: 0.12, maxZoom: 1.4 }}
          onNodeClick={(_, n) => g.setSelected(n.id)} proOptions={{ hideAttribution: true }}>
          <Background gap={20} size={1} color="#262b36" />
        </ReactFlow>
      </main>

      <aside className="a-insp">
        <h4>Inspector</h4>
        <Inspector g={g} />
        <h4 style={{ marginTop: 24 }}>Requisitos</h4>
        {[
          ['Latencia p95', `≤ ${LEVEL.requirements.p95Ms} ms`, r && g.done ? r.checks[0].ok : null],
          ['Errores', `≤ ${fmtPct(LEVEL.requirements.maxErrorRate)}`, r && g.done ? r.checks[1].ok : null],
          ['Presupuesto', `≤ $${LEVEL.budget}`, g.cost <= LEVEL.budget],
        ].map(([k, v, ok]) => <div className="req" key={k as string}><span>{k}</span><span className={ok == null ? 'muted' : ok ? 'ok' : 'bad'}>{v as string} {ok == null ? '' : ok ? '✓' : '✗'}</span></div>)}
      </aside>

      <section className="a-bottom">
        <div>
          <h4>Resultado</h4>
          {!r ? <div className="muted">Pulsa <b>Simular</b> para ejecutar 60 s de tráfico.</div> : g.running ? <div className="muted">Simulando…</div> : <>
            <div style={{ fontSize: 20, fontWeight: 700 }} className={r.passed ? 'ok' : 'bad'}>{r.passed ? 'Superado' : 'No superado'}</div>
            <Stars n={r.stars} />
            {r.hint && !r.passed && <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>{r.hint}</p>}
          </>}
        </div>
        {[['Peticiones/s', 'rps', 600, undefined], ['Latencia p95 (ms)', 'p95', 700, LEVEL.requirements.p95Ms], ['Errores (%)', 'errorRate', 0.3, LEVEL.requirements.maxErrorRate]].map(([label, key, max, th]) => (
          <div key={key as string}>
            <h4>{label as string}</h4>
            {r ? <Spark values={slice(r.buckets.map((b: any) => b[key as string]))} max={max as number} threshold={th as number | undefined} cursor={cursor} w={240} h={110}
              color={key === 'rps' ? 'var(--accent)' : key === 'p95' ? 'var(--warn)' : 'var(--bad)'} /> : <div className="muted">—</div>}
          </div>))}
        <div>
          <h4>Carga por componente</h4>
          {r && r.components.map((c: any) => { const u = idx == null ? c.peakUtilization : c.bucketUtilization[idx]; return (
            <div className="util-row" key={c.id}><span>{c.label}</span>
              <div className="meter"><span style={{ width: `${u * 100}%`, background: u >= .9 ? 'var(--bad)' : u >= .7 ? 'var(--warn)' : 'var(--ok)' }} /></div>
              <span className="mono muted">{Math.round(u * 100)}%</span></div>); })}
          {r && g.done && <div className="muted" style={{ fontSize: 12 }}>p50 {fmtMs(r.p50)} · p99 {fmtMs(r.p99)}</div>}
        </div>
      </section>
    </div>
  );
}

function Inspector({ g }: { g: Game }) {
  const s = g.selected, d = g.design;
  if (!s) return <div className="muted">Selecciona un componente del diagrama.</div>;
  if (s === 'app') return <>
    <div className="field"><b>Servidor de app</b><span className="muted">$40/inst.</span></div>
    <div className="field"><span>Instancias</span><span><button className="btn icon" onClick={g.actions.removeServer}>−</button> <b className="mono">{d.servers}</b> <button className="btn icon" onClick={g.actions.addServer}>+</button></span></div>
    <div className="muted">Capacidad ≈ {d.servers * 200} pet/s</div></>;
  if (s === 'db') return <>
    <div className="field"><b>Base de datos</b></div>
    <div className="field"><span>Tier</span><span className="seg">{(['small', 'medium', 'large'] as Tier[]).map(t => <button key={t} className={d.dbTier === t ? 'on' : ''} onClick={() => g.actions.setTier(t)}>{TIER_LABEL[t]}</button>)}</span></div>
    <div className="muted">Capacidad ≈ {{ small: 400, medium: 800, large: 1600 }[d.dbTier]} pet/s · ${{ small: 50, medium: 150, large: 400 }[d.dbTier]}/mes</div></>;
  if (s === 'cache') return <>
    <div className="field"><b>Caché</b><span className="muted">$30</span></div>
    <div className="field"><span>TTL</span><span><button className="btn icon" onClick={() => g.actions.ttl(-30)}>−</button> <b className="mono">{d.ttlS}s</b> <button className="btn icon" onClick={() => g.actions.ttl(30)}>+</button></span></div>
    <button className="btn" onClick={g.actions.removeCache}>Quitar caché</button></>;
  return <div className="muted">{META[s === 'lb' ? 'lb' : 'client'].label}: sin parámetros.</div>;
}
