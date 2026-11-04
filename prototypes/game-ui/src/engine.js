// PROTOTYPE: copied from ../simulation-engine.prototype.html
const Engine = (() => {
  const HOP_MS = 1, QUEUE_CAP = 100, TIMEOUT_MS = 1000, BUCKET_S = 5;

  const CATALOG = {
    lb:     { label: 'Balanceador',     serviceMs: 1,  workers: 500, cost: () => 20 },
    server: { label: 'Servidor de app', serviceMs: 20, workers: 4,   cost: p => 40 * p.instances },
    cache:  { label: 'Caché',           serviceMs: 2,  workers: 50,  cost: () => 30 },
    db:     { label: 'Base de datos',   serviceMs: 20,
              tiers: { small: { workers: 8, cost: 50 }, medium: { workers: 16, cost: 150 }, large: { workers: 32, cost: 400 } },
              cost: p => CATALOG.db.tiers[p.tier].cost },
  };
  const cacheHitRate = ttlS => ttlS / (ttlS + 30);

  function mulberry32(a) {
    return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const exp = (rng, mean) => -Math.log(1 - rng()) * mean;

  class Heap {
    constructor() { this.a = []; }
    less(x, y) { return x.t < y.t || (x.t === y.t && x.seq < y.seq); }
    push(x) { const a = this.a; a.push(x); let i = a.length - 1;
      while (i > 0) { const p = (i - 1) >> 1; if (!this.less(a[i], a[p])) break; [a[i], a[p]] = [a[p], a[i]]; i = p; } }
    pop() { const a = this.a, top = a[0], last = a.pop();
      if (a.length) { a[0] = last; let i = 0;
        for (;;) { const l = 2 * i + 1, r = l + 1; let m = i;
          if (l < a.length && this.less(a[l], a[m])) m = l; if (r < a.length && this.less(a[r], a[m])) m = r;
          if (m === i) break; [a[i], a[m]] = [a[m], a[i]]; i = m; } }
      return top; }
    get size() { return this.a.length; }
  }

  function designCost(design) {
    return design.components.reduce((s, c) => s + CATALOG[c.type].cost(c.params || {}), 0);
  }

  function percentile(sorted, p) { return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : 0; }

  function simulate(level, design, seed) {
    const rng = mulberry32(seed);
    const durMs = level.durationS * 1000, nB = Math.ceil(level.durationS / BUCKET_S);
    const comps = {};
    for (const c of design.components) {
      const spec = CATALOG[c.type], p = c.params || {};
      const workers = c.type === 'db' ? spec.tiers[p.tier].workers : spec.workers;
      const n = c.type === 'server' ? p.instances : 1;
      comps[c.id] = { id: c.id, type: c.type, label: spec.label, params: p, workers, serviceMs: spec.serviceMs, rr: 0,
        instances: Array.from({ length: n }, () => ({ busy: 0, queue: [], alive: true })),
        busyBuckets: new Array(nB).fill(0),
        stats: { arrived: 0, served: 0, waitMs: 0, busyMs: 0, maxQueue: 0, rejected: 0, timedOut: 0, lost: 0, hits: 0, misses: 0 } };
    }
    const next = id => design.connections.filter(([f]) => f === id).map(([, t]) => t);
    const buckets = Array.from({ length: nB }, (_, i) => ({ fromS: i * BUCKET_S, requests: 0, ok: 0, errors: 0, lat: [] }));
    const bucketOf = t => buckets[Math.min(nB - 1, Math.floor(t / (BUCKET_S * 1000)))];
    const errors = { rejected: 0, timedOut: 0, lost: 0, unavailable: 0 };
    const latencies = [];
    const heap = new Heap(); let seq = 0;
    const at = (t, type, data) => heap.push({ t, seq: seq++, type, ...data });

    let reqId = 0;
    const entry = next('client')[0];
    for (const seg of level.traffic) {
      let t = seg.fromS * 1000; const end = seg.toS * 1000, mean = 1000 / seg.rps;
      for (;;) { t += exp(rng, mean); if (t >= end) break; at(t, 'arrive', { comp: entry, req: { id: reqId++, created: t, hops: 1 } }); }
    }
    for (const f of level.failureEvents || []) at(f.atS * 1000, 'kill', { comp: f.componentId, inst: f.instance });

    const fail = (req, kind, c) => { errors[kind]++; if (c && kind in c.stats) c.stats[kind]++; const b = bucketOf(req.created); b.requests++; b.errors++; };
    const complete = (req, t) => {
      const lat = t - req.created + req.hops * HOP_MS;
      if (lat > TIMEOUT_MS) return fail(req, 'timedOut', null);
      latencies.push(lat); const b = bucketOf(req.created); b.requests++; b.ok++; b.lat.push(lat);
    };
    const addBusy = (c, t0, d) => {
      c.stats.busyMs += d; let t = t0; const t1 = t0 + d, bMs = BUCKET_S * 1000;
      while (t < t1) { const i = Math.floor(t / bMs); if (i >= nB) break; const e = Math.min(t1, (i + 1) * bMs); c.busyBuckets[i] += e - t; t = e; }
    };
    const start = (c, i, req, t) => {
      if (t - req.created > TIMEOUT_MS) return fail(req, 'timedOut', c);
      c.stats.waitMs += t - req.enq;
      c.instances[i].busy++;
      const svc = exp(rng, c.serviceMs); addBusy(c, t, svc);
      at(t + svc, 'done', { comp: c.id, inst: i, req });
    };
    const route = (c, req, t) => {
      if (c.type === 'cache') {
        if (rng() < cacheHitRate(c.params.ttlS)) { c.stats.hits++; return complete(req, t); }
        c.stats.misses++;
      }
      const targets = next(c.id);
      if (!targets.length) return complete(req, t);
      req.hops++; at(t + HOP_MS, 'arrive', { comp: targets[0], req });
    };

    while (heap.size) {
      const e = heap.pop(), c = comps[e.comp];
      if (e.type === 'arrive') {
        c.stats.arrived++;
        const alive = c.instances.map((x, i) => i).filter(i => c.instances[i].alive);
        if (!alive.length) { fail(e.req, 'unavailable', c); continue; }
        const i = alive[c.rr++ % alive.length], inst = c.instances[i];
        e.req.enq = e.t;
        if (inst.busy < c.workers) start(c, i, e.req, e.t);
        else if (inst.queue.length < QUEUE_CAP) { inst.queue.push(e.req); c.stats.maxQueue = Math.max(c.stats.maxQueue, inst.queue.length); }
        else fail(e.req, 'rejected', c);
      } else if (e.type === 'done') {
        const inst = c.instances[e.inst]; inst.busy--;
        if (!inst.alive) { fail(e.req, 'lost', c); continue; }
        c.stats.served++;
        route(c, e.req, e.t);
        while (inst.busy < c.workers && inst.queue.length) start(c, e.inst, inst.queue.shift(), e.t);
      } else if (e.type === 'kill') {
        const inst = c.instances[e.inst]; if (!inst || !inst.alive) continue;
        inst.alive = false; for (const r of inst.queue) fail(r, 'lost', c); inst.queue = [];
      }
    }

    const total = reqId, errCount = Object.values(errors).reduce((a, b) => a + b, 0);
    const sorted = latencies.slice().sort((a, b) => a - b);
    const p50 = percentile(sorted, 0.5), p95 = percentile(sorted, 0.95), p99 = percentile(sorted, 0.99);
    const errorRate = total ? errCount / total : 0;
    const cost = designCost(design);

    const components = Object.values(comps).map(c => {
      const cap = c.workers * c.instances.length;
      const s = c.stats, overload = s.rejected + s.timedOut;
      return { id: c.id, type: c.type, label: c.label, capacityRps: Math.round(cap * 1000 / c.serviceMs),
        utilization: s.busyMs / (cap * durMs),
        peakUtilization: Math.max(...c.busyBuckets.map(b => b / (cap * BUCKET_S * 1000))),
        bucketUtilization: c.busyBuckets.map(b => Math.min(1, b / (cap * BUCKET_S * 1000))),
        avgWaitMs: s.arrived ? s.waitMs / s.arrived : 0, ...s,
        hitRate: c.type === 'cache' ? s.hits / Math.max(1, s.hits + s.misses) : null,
        pressure: s.waitMs + overload * TIMEOUT_MS };
    });
    const worst = components.reduce((a, b) => (b.pressure > a.pressure ? b : a));
    const bottleneck = worst.pressure / Math.max(1, total) >= 2 ? worst.id : null;

    const checks = [
      { name: 'Latencia p95', target: `≤ ${level.requirements.p95Ms} ms`, actual: `${p95.toFixed(0)} ms`, ok: p95 <= level.requirements.p95Ms },
      { name: 'Tasa de errores', target: `≤ ${(level.requirements.maxErrorRate * 100).toFixed(1)} %`, actual: `${(errorRate * 100).toFixed(2)} %`, ok: errorRate <= level.requirements.maxErrorRate },
      { name: 'Coste mensual', target: `≤ $${level.budget}`, actual: `$${cost}`, ok: cost <= level.budget },
    ];
    const passed = checks.every(c => c.ok);
    const stars = passed ? 1 + level.starCostThresholds.filter(th => cost <= th).length : 0;

    let hint = null;
    if (errors.lost + errors.unavailable > 0 && !passed)
      hint = 'Una instancia se cayó y el resto no absorbió la carga: añade redundancia (N+1 instancias).';
    else if (bottleneck) {
      const type = comps[bottleneck].type;
      hint = { server: 'Los servidores de aplicación están saturados: añade instancias (escalado horizontal).',
               db: 'La base de datos está saturada: reduce lecturas con una caché o sube de tier (escalado vertical).',
               cache: 'La caché está saturada.', lb: 'El balanceador está saturado.' }[type];
    }

    return { seed, totalRequests: total, ok: latencies.length, errors, errorRate, p50, p95, p99, cost, checks, passed, stars,
      components, bottleneck, hint,
      buckets: buckets.map(b => { const s = b.lat.sort((x, y) => x - y);
        return { fromS: b.fromS, rps: b.requests / BUCKET_S, p95: percentile(s, 0.95), errorRate: b.requests ? b.errors / b.requests : 0 }; }) };
  }

  return { CATALOG, cacheHitRate, designCost, simulate };
})();
export default Engine;
