// PROTOTYPE Variant D: "Misión + C4" — B's HUD and hotbar, A's results drawer and inspector,
// diagram grouped as C4-style boundaries (system → containers) with every server instance drawn as its own node.
import { useEffect, useState } from 'react';
import { Background, BackgroundVariant, Handle, Position, ReactFlow, useReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react';
import { User } from 'lucide-react';
import { Engine, LEVEL, META, PALETTE, Spark, Stars, TIER_LABEL, edgeTypes, fmtMs, fmtPct, loadColor, useFlowNodes, type CompType, type Game, type Size, type Tier } from '../game';

// ---------- C4 nodes ----------
type GroupData = { title: string; kind: string; desc?: string; hot?: boolean; system?: boolean; selected?: boolean };
type ItemData = { comp: string; type: CompType; title: string; tech: string; desc: string; load: number | null; dead: boolean; hot: boolean; selected: boolean };

function C4Group({ data }: NodeProps<Node<GroupData>>) {
  return (
    <div className={`c4-group ${data.system ? 'system' : ''} ${data.hot ? 'hot' : ''} ${data.selected ? 'sel' : ''}`}>
      <div className="c4-group-label"><b>{data.title}</b> <span>[{data.kind}]</span>{data.desc && <div>{data.desc}</div>}</div>
    </div>
  );
}
function C4Item({ data }: NodeProps<Node<ItemData>>) {
  const Icon = META[data.type].icon;
  const color = data.dead ? 'var(--muted)' : loadColor(data.load);
  return (
    <div className={`c4-item ${data.dead ? 'dead' : ''} ${data.hot ? 'hot' : ''} ${data.selected ? 'sel' : ''}`} style={{ ['--load' as any]: color }}>
      <Handle type="target" position={Position.Left} />
      <div className="c4-item-head"><Icon size={15} /><b>{data.title}</b>{data.dead && <span className="dead-tag">caída</span>}</div>
      <div className="c4-tech">[{data.tech}]</div>
      <div className="c4-desc">{data.desc}</div>
      <div className="c4-load"><span style={{ width: `${data.dead ? 0 : Math.min(100, (data.load ?? 0) * 100)}%`, background: color }} /></div>
      {data.load != null && !data.dead && <div className="c4-pct mono">{Math.round(data.load * 100)}%</div>}
      {data.type !== 'db' && <Handle type="source" position={Position.Right} />}
    </div>
  );
}
function C4Person({ data }: NodeProps<Node<{ title: string; desc: string }>>) {
  return (
    <div className="c4-person">
      <div className="head"><User size={22} /></div>
      <b>{data.title}</b><span className="c4-tech">[Persona]</span><div className="c4-desc">{data.desc}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
const nodeTypesD = { group4: C4Group, item4: C4Item, person4: C4Person };

const SIZE_INFO: Record<Size, { label: string; vcpu: number; workers: number; cost: number }> = {
  small: { label: 'Pequeña', vcpu: 1, workers: 2, cost: 20 }, medium: { label: 'Mediana', vcpu: 2, workers: 4, cost: 40 }, large: { label: 'Grande', vcpu: 4, workers: 8, cost: 80 },
};
const DB_INFO: Record<Tier, { workers: number; cost: number }> = { small: { workers: 8, cost: 50 }, medium: { workers: 16, cost: 150 }, large: { workers: 32, cost: 400 } };

// ---------- layout ----------
const IW = 170, IH = 86, PAD = 20, HEAD = 58;
function buildC4(g: Game) {
  const { design, result, running, done, playT, selected } = g;
  const live = running || done;
  const bIdx = running ? Math.min(11, Math.floor(playT! / 5)) : null;
  const comp = (id: string) => result?.components.find((c: any) => c.id === id);
  const utilOf = (series: number[], peak: number) => (!live ? null : bIdx != null ? series[bIdx] : peak);
  const failedRun = done && result && !result.passed;
  const hot = (id: string) => !!failedRun && result!.bottleneck === id;

  const n = design.servers;
  const appH = HEAD + n * (IH + 14) + PAD - 14;
  const edgeH = HEAD + IH + PAD, dataH = HEAD + IH + PAD;
  const innerH = Math.max(appH, edgeH, dataH);
  const dataW = PAD + (design.cacheOn ? 2 : 1) * (IW + 30) - 30 + PAD;
  const gx = { edge: 30, app: 30 + IW + 2 * PAD + 50, data: 30 + 2 * (IW + 2 * PAD + 50) };
  const sysW = gx.data + dataW + 30, sysH = innerH + 100;
  const sysX = 260, sysY = 0;
  const cy = (h: number) => 70 + (innerH - h) / 2;

  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const bucket = g.bucket;
  const rate = bucket ? bucket.rps : 200;

  nodes.push({ id: 'client', type: 'person4', position: { x: 0, y: sysY + sysH / 2 - 60 }, data: { title: 'Compradores', desc: `${LEVEL.traffic[1].rps} pet/s en pico` } });
  nodes.push({ id: 'sys', type: 'group4', position: { x: sysX, y: sysY }, style: { width: sysW, height: sysH }, data: { title: 'Tienda online', kind: 'Sistema de software', desc: 'Backend de las rebajas relámpago', system: true }, selectable: false });

  // Edge container: load balancer
  nodes.push({ id: 'g-edge', type: 'group4', parentId: 'sys', extent: 'parent', position: { x: gx.edge, y: cy(edgeH) }, style: { width: IW + 2 * PAD, height: edgeH },
    data: { title: 'Borde', kind: 'Red' }, selectable: false });
  const lb = comp('lb');
  nodes.push({ id: 'lb', type: 'item4', parentId: 'g-edge', extent: 'parent', position: { x: PAD, y: HEAD }, style: { width: IW },
    data: { comp: 'lb', type: 'lb', title: 'Balanceador', tech: 'L7 · round-robin', desc: 'Reparte entre instancias vivas', load: lb ? utilOf(lb.bucketUtilization, lb.peakUtilization) : null, dead: false, hot: hot('lb'), selected: selected === 'lb' } });

  // App container: one node per instance
  const app = comp('app');
  const sz = SIZE_INFO[design.serverSize];
  nodes.push({ id: 'g-app', type: 'group4', parentId: 'sys', extent: 'parent', position: { x: gx.app, y: cy(appH) }, style: { width: IW + 2 * PAD, height: appH },
    data: { title: 'API de la tienda', kind: `Contenedor · ${n} instancia${n > 1 ? 's' : ''}`, hot: hot('app'), selected: selected === 'app' }, selectable: false });
  const aliveCount = Array.from({ length: n }, (_, k) => { const ki = app?.instances[k]?.killedAtS; return !(ki != null && live && (done || playT! >= ki)); }).filter(Boolean).length || 1;
  for (let k = 0; k < n; k++) {
    const inst = app?.instances[k];
    const dead = !!inst && inst.killedAtS != null && live && (done || playT! >= inst.killedAtS);
    nodes.push({ id: `app-${k}`, type: 'item4', parentId: 'g-app', extent: 'parent', position: { x: PAD, y: HEAD + k * (IH + 14) }, style: { width: IW },
      data: { comp: 'app', type: 'server', title: `api-${k + 1}`, tech: `Node.js · ${sz.vcpu} vCPU`, desc: `${sz.workers} workers · ${sz.workers * 50} pet/s`,
        load: inst ? utilOf(inst.bucketUtilization, inst.peakUtilization) : null, dead, hot: hot('app') && !dead, selected: selected === 'app' } });
    edges.push({ id: `lb-app-${k}`, source: 'lb', target: `app-${k}`, type: 'flow', data: { running: running && !dead, hot: hot('app'), rate: rate / aliveCount } });
  }

  // Data container
  nodes.push({ id: 'g-data', type: 'group4', parentId: 'sys', extent: 'parent', position: { x: gx.data, y: cy(dataH) }, style: { width: dataW, height: dataH },
    data: { title: 'Datos', kind: 'Persistencia' }, selectable: false });
  const db = comp('db'), cache = comp('cache');
  let x = PAD;
  if (design.cacheOn) {
    nodes.push({ id: 'cache', type: 'item4', parentId: 'g-data', extent: 'parent', position: { x, y: HEAD }, style: { width: IW },
      data: { comp: 'cache', type: 'cache', title: 'Caché', tech: 'Redis', desc: `TTL ${design.ttlS}s · ~${Math.round(Engine.cacheHitRate(design.ttlS) * 100)}% aciertos`,
        load: cache ? utilOf(cache.bucketUtilization, cache.peakUtilization) : null, dead: false, hot: hot('cache'), selected: selected === 'cache' } });
    x += IW + 30;
  }
  const dbi = DB_INFO[design.dbTier];
  nodes.push({ id: 'db', type: 'item4', parentId: 'g-data', extent: 'parent', position: { x, y: HEAD }, style: { width: IW },
    data: { comp: 'db', type: 'db', title: 'Base de datos', tech: `PostgreSQL · ${TIER_LABEL[design.dbTier].toLowerCase()}`, desc: `${dbi.workers} conexiones · ${dbi.workers * 50} pet/s`,
      load: db ? utilOf(db.bucketUtilization, db.peakUtilization) : null, dead: false, hot: hot('db'), selected: selected === 'db' } });

  const next = design.cacheOn ? 'cache' : 'db';
  const toData = design.cacheOn ? rate : rate;
  edges.push({ id: 'client-lb', source: 'client', target: 'lb', type: 'flow', data: { running, hot: hot('lb'), rate } });
  for (let k = 0; k < n; k++) edges.push({ id: `app-${k}-${next}`, source: `app-${k}`, target: next, type: 'flow', data: { running, hot: hot(next), rate: toData / n } });
  if (design.cacheOn) edges.push({ id: 'cache-db', source: 'cache', target: 'db', type: 'flow', data: { running, hot: hot('db'), rate: rate * (1 - Engine.cacheHitRate(design.ttlS)) } });
  return { nodes, edges };
}

// ---------- variant ----------
export function VariantD({ g }: { g: Game }) {
  const flow = buildC4(g);
  const { nodes, onNodesChange } = useFlowNodes(flow.nodes as any);
  const rf = useReactFlow();
  const [report, setReport] = useState(false);
  const r = g.result;
  useEffect(() => { if (g.done) setReport(true); }, [g.done]);
  useEffect(() => { const t = setTimeout(() => rf.fitView({ padding: 0.12, duration: 250 }), 60); return () => clearTimeout(t); }, [g.design.servers, g.design.cacheOn]); // eslint-disable-line
  const idx = g.running ? Math.min(11, Math.floor(g.playT! / 5)) : null;
  const cursor = g.running ? g.playT! / LEVEL.durationS : null;
  const slice = <T,>(xs: T[]) => (idx == null ? xs : xs.slice(0, idx + 1));
  const status = (ok: boolean | undefined) => (ok == null ? '' : ok ? 'ok' : 'bad');
  const pick = (n: Node) => { const d: any = n.data; if (d.comp) g.setSelected(d.comp); else if (n.id === 'g-app') g.setSelected('app'); else if (n.id === 'client') g.setSelected('client'); };

  return (
    <div className="d-root">
      <div className="d-canvas">
        <ReactFlow nodes={nodes} edges={flow.edges} onNodesChange={onNodesChange} nodeTypes={nodeTypesD as any} edgeTypes={edgeTypes} colorMode="dark"
          fitView fitViewOptions={{ padding: 0.12 }} onNodeClick={(_, n) => pick(n)} onPaneClick={() => g.setSelected(null)} proOptions={{ hideAttribution: true }}>
          <Background variant={BackgroundVariant.Dots} gap={26} size={1.5} color="#2a3142" />
        </ReactFlow>

        <div className="hud b-obj d-obj">
          <div className="lvl">Misión 3 · Núcleo</div>
          <h2>{LEVEL.name}</h2>
          {[[`p95 por debajo de ${LEVEL.requirements.p95Ms} ms`, g.done ? r!.checks[0].ok : undefined],
            [`Menos de ${fmtPct(LEVEL.requirements.maxErrorRate)} de errores`, g.done ? r!.checks[1].ok : undefined],
            [`No superar $${LEVEL.budget}/mes`, g.cost <= LEVEL.budget]].map(([t, ok]) => (
            <div className="obj" key={t as string}><span className={`box ${status(ok as boolean | undefined)}`}>{ok == null ? '' : ok ? '✓' : '✕'}</span>{t as string}</div>))}
        </div>

        <div className="hud d-cost">
          <div className="muted" style={{ fontSize: 11 }}>COSTE MENSUAL</div>
          <div className="big mono">${g.cost}<span className="muted" style={{ fontSize: 13 }}> / ${LEVEL.budget}</span></div>
          <div className="meter"><span style={{ width: `${Math.min(100, (g.cost / LEVEL.budget) * 100)}%`, background: g.cost <= LEVEL.starCostThresholds[1] ? 'var(--ok)' : g.cost <= LEVEL.starCostThresholds[0] ? 'var(--warn)' : 'var(--bad)' }} />
            {LEVEL.starCostThresholds.map(t => <i key={t} style={{ left: `${(t / LEVEL.budget) * 100}%` }} />)}</div>
        </div>

        {g.running && g.bucket && (
          <div className="hud b-clock">
            <span className="t mono">t = {Math.floor(g.playT!)}s</span>
            <span className="mono">{Math.round(g.bucket.rps)} pet/s</span>
            <span className={`mono ${g.bucket.p95 > LEVEL.requirements.p95Ms ? 'bad' : 'ok'}`}>p95 {fmtMs(g.bucket.p95)}</span>
            <span className={`mono ${g.bucket.errorRate > LEVEL.requirements.maxErrorRate ? 'bad' : 'muted'}`}>{fmtPct(g.bucket.errorRate)} err</span>
          </div>
        )}

        <div className="hud d-hotbar">
          {PALETTE.map((p, i) => { const Icon = META[p.type].icon; return (
            <button key={p.type} className="hot-tile" onClick={() => g.actions.addFromPalette(p.type)} title={META[p.type].blurb}>
              <kbd>{i + 1}</kbd><Icon size={20} color="var(--accent)" /><span>{META[p.type].label.split(' ')[0]}</span>
            </button>); })}
          <button className="hot-tile" onClick={() => g.actions.setFailure(!g.design.failure)} style={{ borderColor: g.design.failure ? 'var(--warn)' : undefined }}>
            <span style={{ fontSize: 18 }}>⚡</span><span>{g.design.failure ? 'Caída ON' : 'Caída'}</span>
          </button>
          <button className="b-play" onClick={g.run} disabled={g.running}>{g.running ? '…' : '▶ JUGAR'}</button>
        </div>
      </div>

      <aside className="a-insp d-insp"><Inspector g={g} /></aside>

      <section className="a-bottom d-bottom">
        <div>
          <h4>Resultado</h4>
          {!r ? <div className="muted">Pulsa <b>▶ Jugar</b> para lanzar 60 s de tráfico.</div> : g.running ? <div className="muted">Simulando…</div> : <>
            <div style={{ fontSize: 20, fontWeight: 700 }} className={r.passed ? 'ok' : 'bad'}>{r.passed ? 'Superado' : 'No superado'}</div>
            <Stars n={r.stars} />
            {r.hint && !r.passed && <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>{r.hint}</p>}
          </>}
        </div>
        {[['Peticiones/s', 'rps', 600, undefined], ['Latencia p95 (ms)', 'p95', 700, LEVEL.requirements.p95Ms], ['Errores (%)', 'errorRate', 0.3, LEVEL.requirements.maxErrorRate]].map(([label, key, max, th]) => (
          <div key={key as string}>
            <h4>{label as string}</h4>
            {r ? <Spark values={slice(r.buckets.map((b: any) => b[key as string]))} max={max as number} threshold={th as number | undefined} cursor={cursor} w={220} h={100}
              color={key === 'rps' ? 'var(--accent)' : key === 'p95' ? 'var(--warn)' : 'var(--bad)'} /> : <div className="muted">—</div>}
          </div>))}
        <div style={{ overflow: 'auto' }}>
          <h4>Carga por recurso</h4>
          {r && r.components.filter((c: any) => c.type !== 'lb').flatMap((c: any) => (c.type === 'server'
            ? c.instances.map((i: any) => ({ key: `api-${i.index + 1}`, u: idx == null ? i.peakUtilization : i.bucketUtilization[idx], dead: i.killedAtS != null && (idx == null || idx * 5 >= i.killedAtS) }))
            : [{ key: c.label, u: idx == null ? c.peakUtilization : c.bucketUtilization[idx], dead: false }])).map((row: any) => (
            <div className="util-row" key={row.key}><span>{row.key}</span>
              <div className="meter"><span style={{ width: `${row.dead ? 0 : row.u * 100}%`, background: loadColor(row.u) }} /></div>
              <span className="mono muted">{row.dead ? 'caída' : `${Math.round(row.u * 100)}%`}</span></div>))}
        </div>
      </section>

      {report && r && (
        <div className="b-modal-bg" onClick={() => setReport(false)}>
          <div className="b-modal" onClick={e => e.stopPropagation()}>
            <Stars n={r.stars} size={40} />
            <h2 className={r.passed ? 'ok' : 'bad'}>{r.passed ? '¡Misión cumplida!' : 'El sistema se cayó'}</h2>
            <div className="stats">
              <div className="stat"><span className="muted">p95</span><b className={r.checks[0].ok ? 'ok' : 'bad'}>{fmtMs(r.p95)}</b></div>
              <div className="stat"><span className="muted">Errores</span><b className={r.checks[1].ok ? 'ok' : 'bad'}>{fmtPct(r.errorRate)}</b></div>
              <div className="stat"><span className="muted">Coste</span><b className={r.checks[2].ok ? 'ok' : 'bad'}>${r.cost}</b></div>
            </div>
            {!r.passed && r.hint && <div className="tip"><b>Pista:</b> {r.hint}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 18 }}>
              <button className="btn" onClick={() => { setReport(false); if (r.bottleneck) g.setSelected(r.bottleneck); }}>Ver detalles</button>
              <button className="btn primary" disabled={!r.passed}>Siguiente misión →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- inspector ----------
function Row({ k, children }: { k: string; children: React.ReactNode }) { return <div className="field"><span className="muted">{k}</span><span>{children}</span></div>; }
function Stepper({ v, on }: { v: React.ReactNode; on: (d: number) => void }) {
  return <span className="stepper"><button className="btn icon" onClick={() => on(-1)}>−</button><b className="mono">{v}</b><button className="btn icon" onClick={() => on(1)}>+</button></span>;
}

function Inspector({ g }: { g: Game }) {
  const s = g.selected, d = g.design, r = g.done ? g.result : null;
  const c = r?.components.find((x: any) => x.id === s);
  if (!s) return <><h4>Inspector</h4><div className="muted">Selecciona un componente del diagrama para ver y cambiar su configuración.</div></>;

  const stats = c && (
    <><h4 className="sec">Última simulación</h4>
      <Row k="Utilización media / pico">{fmtPct(c.utilization)} / {fmtPct(c.peakUtilization)}</Row>
      <Row k="Espera media en cola">{fmtMs(c.avgWaitMs)}</Row>
      <Row k="Cola máxima">{c.maxQueue}</Row>
      <Row k="Rechazadas · timeouts"><span className={c.rejected + c.timedOut ? 'bad' : ''}>{c.rejected} · {c.timedOut}</span></Row></>);

  if (s === 'app') {
    const sz = SIZE_INFO[d.serverSize];
    return <>
      <h4>Inspector</h4>
      <div className="insp-title"><b>API de la tienda</b><span className="muted">[Contenedor: Node.js]</span></div>
      <h4 className="sec">Despliegue</h4>
      <Row k="Instancias"><Stepper v={d.servers} on={x => (x > 0 ? g.actions.addServer() : g.actions.removeServer())} /></Row>
      <Row k="Tamaño de instancia"><span className="seg">{(['small', 'medium', 'large'] as Size[]).map(t => <button key={t} className={d.serverSize === t ? 'on' : ''} onClick={() => g.actions.setServerSize(t)}>{SIZE_INFO[t].label}</button>)}</span></Row>
      <Row k="Por instancia">{sz.vcpu} vCPU · {sz.workers} workers · ${sz.cost}/mes</Row>
      <h4 className="sec">Avanzado</h4>
      <Row k="Cola máx. por instancia"><Stepper v={d.serverQueueCap} on={x => g.actions.queueCap(x * 50)} /></Row>
      <Row k="Tiempo de servicio">20 ms (media, exponencial)</Row>
      <Row k="Timeout de petición">1 000 ms <span className="muted">(regla del nivel)</span></Row>
      <Row k="Health check">instantáneo</Row>
      <h4 className="sec">Capacidad y coste</h4>
      <Row k="Capacidad total"><b>{d.servers * sz.workers * 50} pet/s</b></Row>
      <Row k="Coste">{d.servers} × ${sz.cost} = <b>${d.servers * sz.cost}/mes</b></Row>
      {c && <><h4 className="sec">Instancias (última simulación)</h4>
        <table className="insp-table"><thead><tr><th>Instancia</th><th>Pico</th><th>Servidas</th><th>Rechaz.</th><th>Cola</th></tr></thead><tbody>
          {c.instances.map((i: any) => <tr key={i.index}><td>api-{i.index + 1}{i.killedAtS != null && <span className="bad"> ✕ {i.killedAtS}s</span>}</td>
            <td style={{ color: loadColor(i.peakUtilization) }}>{Math.round(i.peakUtilization * 100)}%</td><td>{i.served}</td><td className={i.rejected ? 'bad' : ''}>{i.rejected}</td><td>{i.maxQueue}</td></tr>)}
        </tbody></table></>}
      {stats}
    </>;
  }
  if (s === 'db') {
    const t = DB_INFO[d.dbTier];
    return <>
      <h4>Inspector</h4>
      <div className="insp-title"><b>Base de datos</b><span className="muted">[Contenedor: PostgreSQL]</span></div>
      <h4 className="sec">Configuración</h4>
      <Row k="Tier"><span className="seg">{(['small', 'medium', 'large'] as Tier[]).map(x => <button key={x} className={d.dbTier === x ? 'on' : ''} onClick={() => g.actions.setTier(x)}>{TIER_LABEL[x]}</button>)}</span></Row>
      <Row k="Conexiones concurrentes">{t.workers}</Row>
      <Row k="Tiempo de consulta">20 ms (media)</Row>
      <Row k="Réplicas de lectura"><span className="muted">capítulo 3</span></Row>
      <h4 className="sec">Capacidad y coste</h4>
      <Row k="Capacidad"><b>{t.workers * 50} pet/s</b></Row>
      <Row k="Coste"><b>${t.cost}/mes</b></Row>
      {stats}
    </>;
  }
  if (s === 'cache') {
    const hr = Engine.cacheHitRate(d.ttlS);
    return <>
      <h4>Inspector</h4>
      <div className="insp-title"><b>Caché</b><span className="muted">[Contenedor: Redis]</span></div>
      <h4 className="sec">Configuración</h4>
      <Row k="TTL"><Stepper v={`${d.ttlS}s`} on={x => g.actions.ttl(x * 30)} /></Row>
      <Row k="Aciertos esperados">{fmtPct(hr)}</Row>
      {c && <Row k="Aciertos observados">{fmtPct(c.hitRate)}</Row>}
      <Row k="Política de expulsión"><span className="muted">LRU (avanzado)</span></Row>
      <h4 className="sec">Capacidad y coste</h4>
      <Row k="Capacidad">25 000 pet/s</Row>
      <Row k="Coste"><b>$30/mes</b></Row>
      {stats}
      <button className="btn" style={{ marginTop: 12 }} onClick={g.actions.removeCache}>Quitar caché</button>
    </>;
  }
  if (s === 'lb') return <>
    <h4>Inspector</h4>
    <div className="insp-title"><b>Balanceador</b><span className="muted">[Contenedor: L7]</span></div>
    <Row k="Algoritmo">round-robin</Row><Row k="Destinos">{d.servers} instancias</Row><Row k="Coste"><b>$20/mes</b></Row>{stats}
  </>;
  return <><h4>Inspector</h4><div className="insp-title"><b>Compradores</b><span className="muted">[Persona]</span></div>
    {LEVEL.traffic.map(t => <Row key={t.fromS} k={`${t.fromS}–${t.toS} s`}>{t.rps} pet/s</Row>)}</>;
}
