// PROTOTYPE Variant C: "Entrevista" — the level is a conversation with an interviewer; light whiteboard canvas; metrics strip below.
import { useEffect, useRef, useState } from 'react';
import { Background, ReactFlow } from '@xyflow/react';
import { LEVEL, META, PALETTE, Spark, Stars, TIER_LABEL, buildFlow, edgeTypes, fmtMs, fmtPct, nodeTypes, useFlowNodes, type Game, type Tier } from '../game';

type Msg = { from: 'them' | 'me'; body: React.ReactNode };

export function VariantC({ g }: { g: Game }) {
  const flow = buildFlow(g, 'card', 250);
  const { nodes, onNodesChange } = useFlowNodes(flow.nodes);
  const edges = flow.edges;
  const r = g.result;
  const [log, setLog] = useState<Msg[]>([]);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [log.length]);

  useEffect(() => {
    if (!g.done || !r) return;
    const bn = r.components.find((c: any) => c.id === r.bottleneck);
    setLog(l => [...l,
      { from: 'me', body: <>He probado mi diseño: {g.design.servers} servidores, BD {TIER_LABEL[g.design.dbTier].toLowerCase()}{g.design.cacheOn ? `, caché con TTL ${g.design.ttlS}s` : ', sin caché'}{g.design.failure ? ' y una caída a los 20 s' : ''}.</> },
      r.passed
        ? { from: 'them', body: <>Bien. p95 de <b>{fmtMs(r.p95)}</b>, {fmtPct(r.errorRate)} de errores y <b>${r.cost}/mes</b>. <Stars n={r.stars} size={14} />
            <div style={{ marginTop: 6 }}>{g.design.failure ? 'Y aguanta la caída. ¿Podrías hacerlo más barato?' : 'Ahora dime: ¿qué pasa si se cae uno de tus servidores en mitad del pico?'}</div>
            <div className="chips">{!g.design.failure && <button className="chip" onClick={() => g.actions.setFailure(true)}>Aceptar reto: simular caída</button>}<button className="chip">Siguiente pregunta →</button></div></> }
        : { from: 'them', body: <>Mmm. p95 de <b className="bad">{fmtMs(r.p95)}</b> y <b className="bad">{fmtPct(r.errorRate)}</b> de errores.
            {bn && <> Mira <b>{bn.label.toLowerCase()}</b>: estuvo al {Math.round(bn.peakUtilization * 100)}% en el pico.</>}
            <div style={{ marginTop: 6 }}>{r.hint}</div>
            <div className="chips"><button className="chip" onClick={() => g.setSelected(r.bottleneck)}>Ver {bn?.label.toLowerCase()}</button><button className="chip">Pedir otra pista</button></div></> },
    ]);
  }, [g.done]); // eslint-disable-line

  const intro: Msg[] = [
    { from: 'them', body: <>Hola 👋 Soy Marta, hoy hago yo la entrevista de system design.</> },
    { from: 'them', body: <>{LEVEL.brief} Diséñame el backend.<ul>
      <li>p95 por debajo de <b>{LEVEL.requirements.p95Ms} ms</b></li><li>menos de <b>{fmtPct(LEVEL.requirements.maxErrorRate)}</b> de errores</li><li>presupuesto: <b>${LEVEL.budget}/mes</b></li></ul>
      <div className="chips"><button className="chip">¿Qué es lectura y qué escritura?</button><button className="chip">¿Puedo usar caché?</button></div></> },
  ];
  const idx = g.running ? Math.floor(g.playT! / 5) : null;
  const slice = (xs: number[]) => (idx == null ? xs : xs.slice(0, idx + 1));

  return (
    <div className="c-root">
      <aside className="c-chat">
        <div className="c-head"><div className="avatar">M</div><div><b>Entrevista · {LEVEL.name}</b><div className="muted" style={{ fontSize: 12 }}>{LEVEL.chapter} · pregunta 3 de 8</div></div></div>
        <div className="c-msgs">
          {[...intro, ...log].map((m, i) => <div key={i} className={`msg ${m.from}`}>{m.body}</div>)}
          {g.running && <div className="msg muted">Marta está mirando tus métricas…</div>}
          <div ref={end} />
        </div>
      </aside>

      <main className="c-main">
        <div className="c-toolbar">
          {PALETTE.map(p => { const Icon = META[p.type].icon; return <button key={p.type} className="btn" onClick={() => g.actions.addFromPalette(p.type)}><Icon size={14} style={{ verticalAlign: -2 }} /> {META[p.type].label}</button>; })}
          <span className="sep" />
          <Params g={g} />
          <span style={{ marginLeft: 'auto' }} className="muted mono">${g.cost}/${LEVEL.budget}</span>
          <button className="btn primary" onClick={g.run} disabled={g.running}>{g.running ? `Probando… ${Math.floor(g.playT!)}s` : 'Probar diseño'}</button>
        </div>
        <div className="c-canvas">
          <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} nodeTypes={nodeTypes} edgeTypes={edgeTypes} colorMode="light" fitView fitViewOptions={{ padding: 0.1, maxZoom: 1.4 }}
            onNodeClick={(_, n) => g.setSelected(n.id)} proOptions={{ hideAttribution: true }}>
            <Background gap={22} size={1.2} />
          </ReactFlow>
        </div>
        <div className="c-time">
          {[['Tráfico', 'rps', 600, undefined, (v: number) => `${Math.round(v)} pet/s`], ['Latencia p95', 'p95', 700, LEVEL.requirements.p95Ms, fmtMs], ['Errores', 'errorRate', 0.3, LEVEL.requirements.maxErrorRate, fmtPct]].map(([label, key, max, th, fmt]: any) => {
            const vals: number[] = r ? r.buckets.map((b: any) => b[key]) : [];
            const cur = r ? (idx != null ? vals[idx] : key === 'rps' ? Math.max(...vals) : key === 'p95' ? r.p95 : r.errorRate) : null;
            return <div key={key}><div className="lbl"><span>{label}</span><span className="mono">{cur == null ? '—' : fmt(cur)}</span></div>
              {r ? <Spark values={slice(vals)} max={max} threshold={th} cursor={g.running ? g.playT! / LEVEL.durationS : null} w={300} h={70} color={key === 'rps' ? 'var(--accent)' : key === 'p95' ? 'var(--warn)' : 'var(--bad)'} /> : <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>Prueba tu diseño para ver la línea temporal.</div>}</div>;
          })}
        </div>
      </main>
    </div>
  );
}

function Params({ g }: { g: Game }) {
  const d = g.design, s = g.selected;
  if (s === 'app') return <span>Servidores <button className="btn icon" onClick={g.actions.removeServer}>−</button> <b>{d.servers}</b> <button className="btn icon" onClick={g.actions.addServer}>+</button></span>;
  if (s === 'db') return <span className="seg">{(['small', 'medium', 'large'] as Tier[]).map(t => <button key={t} className={d.dbTier === t ? 'on' : ''} onClick={() => g.actions.setTier(t)}>BD {TIER_LABEL[t].toLowerCase()}</button>)}</span>;
  if (s === 'cache') return <span>TTL <button className="btn icon" onClick={() => g.actions.ttl(-30)}>−</button> <b>{d.ttlS}s</b> <button className="btn icon" onClick={() => g.actions.ttl(30)}>+</button> <button className="btn" onClick={g.actions.removeCache}>Quitar</button></span>;
  return <span className="muted">Selecciona un componente</span>;
}
