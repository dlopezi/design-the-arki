// PROTOTYPE Variant B: "Misión" — full-bleed canvas with floating game HUD, hotbar and end-of-level report card.
import { useEffect, useState } from 'react';
import { Background, BackgroundVariant, ReactFlow, ViewportPortal } from '@xyflow/react';
import { LEVEL, META, PALETTE, Stars, TIER_LABEL, buildFlow, edgeTypes, fmtMs, fmtPct, nodeTypes, useFlowNodes, type Game, type Tier } from '../game';

export function VariantB({ g }: { g: Game }) {
  const flow = buildFlow(g, 'tile', 210);
  const { nodes, onNodesChange } = useFlowNodes(flow.nodes);
  const edges = flow.edges;
  const [report, setReport] = useState(false);
  const r = g.result;
  useEffect(() => { if (g.done) setReport(true); }, [g.done]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { const i = Number(e.key) - 1; if (PALETTE[i]) g.actions.addFromPalette(PALETTE[i].type); if (e.key === ' ') { e.preventDefault(); g.run(); } };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  });
  const status = (ok: boolean | undefined) => (ok == null ? '' : ok ? 'ok' : 'bad');
  const sel = nodes.find(n => n.id === g.selected);

  return (
    <div className="b-root">
      <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} nodeTypes={nodeTypes} edgeTypes={edgeTypes} colorMode="dark" fitView fitViewOptions={{ padding: 0.45 }}
        onNodeClick={(_, n) => g.setSelected(n.id)} onPaneClick={() => g.setSelected(null)} proOptions={{ hideAttribution: true }}>
        <Background variant={BackgroundVariant.Dots} gap={26} size={1.5} color="#2a3142" />
        {sel && ['app', 'db', 'cache'].includes(sel.id) && (
          <ViewportPortal>
            <div className="hud b-pop" style={{ position: 'absolute', transform: `translate(${sel.position.x - 45}px, ${sel.position.y + 120}px)`, pointerEvents: 'all' }}>
              <Popover g={g} id={sel.id} />
            </div>
          </ViewportPortal>
        )}
      </ReactFlow>

      <div className="hud b-obj">
        <div className="lvl">Misión 3 · {LEVEL.chapter.split('·')[1]}</div>
        <h2>{LEVEL.name}</h2>
        <div className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>{LEVEL.brief}</div>
        {[[`p95 por debajo de ${LEVEL.requirements.p95Ms} ms`, g.done ? r!.checks[0].ok : undefined],
          [`Menos de ${fmtPct(LEVEL.requirements.maxErrorRate)} de errores`, g.done ? r!.checks[1].ok : undefined],
          [`No superar $${LEVEL.budget}/mes`, g.cost <= LEVEL.budget]].map(([t, ok]) => (
          <div className="obj" key={t as string}><span className={`box ${status(ok as boolean | undefined)}`}>{ok == null ? '' : ok ? '✓' : '✕'}</span>{t as string}</div>))}
      </div>

      <div className="hud b-cost">
        <div className="muted" style={{ fontSize: 12 }}>COSTE MENSUAL</div>
        <div className="big mono">${g.cost}<span className="muted" style={{ fontSize: 14 }}> / ${LEVEL.budget}</span></div>
        <div className="meter"><span style={{ width: `${Math.min(100, (g.cost / LEVEL.budget) * 100)}%`, background: g.cost <= LEVEL.starCostThresholds[1] ? 'var(--ok)' : g.cost <= LEVEL.starCostThresholds[0] ? 'var(--warn)' : 'var(--bad)' }} />
          {LEVEL.starCostThresholds.map(t => <i key={t} style={{ left: `${(t / LEVEL.budget) * 100}%` }} />)}</div>
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Estrellas posibles: <Stars n={g.cost <= LEVEL.starCostThresholds[1] ? 3 : g.cost <= LEVEL.starCostThresholds[0] ? 2 : 1} size={13} /></div>
      </div>

      {g.running && g.bucket && (
        <div className="hud b-clock">
          <span className="t mono">t = {Math.floor(g.playT!)}s</span>
          <span className="mono">{Math.round(g.bucket.rps)} pet/s</span>
          <span className={`mono ${g.bucket.p95 > LEVEL.requirements.p95Ms ? 'bad' : 'ok'}`}>p95 {fmtMs(g.bucket.p95)}</span>
          <span className={`mono ${g.bucket.errorRate > LEVEL.requirements.maxErrorRate ? 'bad' : 'muted'}`}>{fmtPct(g.bucket.errorRate)} err</span>
        </div>
      )}

      <div className="hud b-hotbar">
        {PALETTE.map((p, i) => { const Icon = META[p.type].icon; return (
          <button key={p.type} className="hot-tile" onClick={() => g.actions.addFromPalette(p.type)} title={META[p.type].blurb}>
            <kbd>{i + 1}</kbd><Icon size={22} color="var(--accent)" /><span>{META[p.type].label.split(' ')[0]}</span>
          </button>); })}
        <button className="hot-tile" onClick={() => g.actions.setFailure(!g.design.failure)} title="Incidente: cae un servidor en t=20 s" style={{ borderColor: g.design.failure ? 'var(--warn)' : undefined }}>
          <span style={{ fontSize: 20 }}>⚡</span><span>{g.design.failure ? 'Caída ON' : 'Caída'}</span>
        </button>
        <button className="b-play" onClick={g.run} disabled={g.running}>{g.running ? '…' : '▶ JUGAR'}</button>
      </div>

      {report && r && (
        <div className="b-modal-bg" onClick={() => setReport(false)}>
          <div className="b-modal" onClick={e => e.stopPropagation()}>
            <Stars n={r.stars} size={40} />
            <h2 className={r.passed ? 'ok' : 'bad'}>{r.passed ? '¡Misión cumplida!' : 'El sistema se cayó'}</h2>
            <div className="muted">{r.totalRequests.toLocaleString('es')} peticiones simuladas</div>
            <div className="stats">
              <div className="stat"><span className="muted">p95</span><b className={r.checks[0].ok ? 'ok' : 'bad'}>{fmtMs(r.p95)}</b></div>
              <div className="stat"><span className="muted">Errores</span><b className={r.checks[1].ok ? 'ok' : 'bad'}>{fmtPct(r.errorRate)}</b></div>
              <div className="stat"><span className="muted">Coste</span><b className={r.checks[2].ok ? 'ok' : 'bad'}>${r.cost}</b></div>
            </div>
            {!r.passed && r.hint && <div className="tip"><b>Pista:</b> {r.hint}</div>}
            {r.passed && r.stars < 3 && <div className="tip">Consigue ★★★ bajando el coste a ${LEVEL.starCostThresholds[1]} o menos.</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 18 }}>
              <button className="btn" onClick={() => setReport(false)}>Volver al diseño</button>
              <button className="btn primary" disabled={!r.passed}>Siguiente misión →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Popover({ g, id }: { g: Game; id: string }) {
  const d = g.design;
  if (id === 'app') return <><b>Servidores</b><div className="row"><span className="muted">Instancias</span><span><button className="btn icon" onClick={g.actions.removeServer}>−</button> <b>{d.servers}</b> <button className="btn icon" onClick={g.actions.addServer}>+</button></span></div></>;
  if (id === 'cache') return <><b>Caché</b><div className="row"><span className="muted">TTL</span><span><button className="btn icon" onClick={() => g.actions.ttl(-30)}>−</button> <b>{d.ttlS}s</b> <button className="btn icon" onClick={() => g.actions.ttl(30)}>+</button></span></div>
    <div className="row"><span /><button className="btn" onClick={g.actions.removeCache}>Quitar</button></div></>;
  return <><b>Base de datos</b><div className="row"><span className="seg">{(['small', 'medium', 'large'] as Tier[]).map(t => <button key={t} className={d.dbTier === t ? 'on' : ''} onClick={() => g.actions.setTier(t)}>{TIER_LABEL[t]}</button>)}</span></div></>;
}
