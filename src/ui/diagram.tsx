import { BaseEdge, getBezierPath, Handle, Position, type Edge, type EdgeProps, type Node, type NodeProps } from '@xyflow/react';
import { catalog } from '../catalog/catalog';
import { hitRateOf } from '../engine/simulate';
import type { Design, Presentation, Result } from '../engine/types';
import { t } from '../i18n';
import { artStyle, ComponentBadge } from './componentArt';

// Layout is automatic: the player decides what exists and how it connects; the game decides where it goes.
const PERSON = { w: 150, h: 112 };
const BOX = { w: 200, h: 90 };
const INSTANCE = { w: 172, h: 64, gap: 10 };
const CONTAINER_HEAD = 78;
const ZONE = { pad: 20, head: 42, gap: 50 };
const SYSTEM = { head: 54, pad: 30, gapFromPerson: 90 };
const COMPONENT_GAP = 20;
const ZONES: Presentation['zone'][] = ['edge', 'application', 'data'];

export type PersonData = { title: string; selected: boolean };
export type BoundaryData = { title: string; kind: string; system: boolean };
export type ComponentData = {
  componentId: string; type: string; title: string; technology: string; detail: string;
  container: boolean; selected: boolean; problem: boolean; bottleneck: boolean; tutorialTarget: boolean;
  /** Share of capacity in use during playback (0–1); null when not playing or hidden. */
  load: number | null;
};
export type InstanceData = { type: string; name: string; detail: string; load: number | null; down: boolean };

export const loadLevel = (load: number) => (load >= 0.9 ? 'high' : load >= 0.7 ? 'medium' : 'low');

function Load({ value }: { value: number | null }) {
  if (value === null) return null;
  return (
    <span className={`load ${loadLevel(value)}`}>
      <span className="load-bar"><span style={{ width: `${Math.round(value * 100)}%` }} /></span>
      <span className="load-value">{Math.round(value * 100)}%</span>
    </span>
  );
}

function PersonNode({ data }: NodeProps<Node<PersonData>>) {
  return (
    <div className={`c4-person ${data.selected ? 'selected' : ''}`}>
      <div className="c4-head" aria-hidden="true" />
      <strong>{data.title}</strong>
      <span className="c4-kind">[{t.person}]</span>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function BoundaryNode({ data }: NodeProps<Node<BoundaryData>>) {
  return (
    <div className={`c4-boundary ${data.system ? 'system' : 'zone'}`}>
      <strong>{data.title}</strong> <span className="c4-kind">[{data.kind}]</span>
    </div>
  );
}

function ComponentNode({ data }: NodeProps<Node<ComponentData>>) {
  return (
    <div className={`c4-component ${data.container ? 'container' : 'box'} ${data.selected ? 'selected' : ''} ${data.problem ? 'problem' : ''} ${data.bottleneck ? 'bottleneck' : ''} ${data.tutorialTarget ? 'tutorial-target' : ''}`} style={artStyle(data.type)}>
      <Handle type="target" position={Position.Left} />
      <div className="c4-main">
        <ComponentBadge type={data.type} />
        <div className="c4-text">
          <strong>{data.title}{data.bottleneck && <span className="badge">{t.bottleneck}</span>}</strong>
          <span className="c4-kind">[{data.technology}]</span>
          <span className="c4-detail">{data.detail}</span>
          {!data.container && <Load value={data.load} />}
        </div>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function InstanceNode({ data }: NodeProps<Node<InstanceData>>) {
  return (
    <div className={`c4-instance ${data.down ? 'down' : data.load === null ? '' : loadLevel(data.load)}`} style={artStyle(data.type, data.down)}>
      <ComponentBadge type={data.type} small down={data.down} />
      <div className="c4-text">
        <strong>{data.name}{data.down && <span className="badge down">{t.down}</span>}</strong>
        <span className="c4-detail">{data.detail}</span>
        {!data.down && <Load value={data.load} />}
      </div>
    </div>
  );
}

export const nodeTypes = { person: PersonNode, boundary: BoundaryNode, component: ComponentNode, instance: InstanceNode };

export type FlowEdgeData = { animate: boolean; rps: number };

/** A connection; while the run plays, dots travel along it, more of them for more traffic. */
function FlowEdge(props: EdgeProps<Edge<FlowEdgeData>>) {
  const [path] = getBezierPath(props);
  const dots = props.data?.animate ? Math.max(2, Math.min(8, Math.round(props.data.rps / 60))) : 0;
  return (
    <>
      <BaseEdge id={props.id} path={path} style={props.style} />
      {Array.from({ length: dots }, (_, i) => (
        <circle key={i} className="flow-dot" r={3.5}>
          <animateMotion dur="1.2s" repeatCount="indefinite" begin={`-${(i * 1.2) / dots}s`} path={path} />
        </circle>
      ))}
    </>
  );
}

export const edgeTypes = { flow: FlowEdge };

export const instanceCountOf = (params?: Record<string, unknown>) => Number(params?.instances ?? 1);
export const sizeOf = (type: string, params?: Record<string, unknown>) => (params?.size as string | undefined) ?? catalog[type]!.defaultSize;

function sized<T extends Record<string, unknown>>(node: Omit<Node<T>, 'width' | 'height'>, w: number, h: number): Node<T> {
  return { ...node, width: w, height: h, style: { width: w, height: h } } as Node<T>;
}

export type DiagramState = {
  selected: string | null;
  problemIds: string[];
  /** During playback: the run and the bucket being shown. */
  live?: { result: Result; bucket: number; animate: boolean; t: number } | null;
  /** After a failed run: the component that held requests back. */
  bottleneckId?: string | null;
  /** Component type the tutorial points at. */
  tutorialTargetType?: string | null;
};

/** Display names of every instance (app-1, app-2…), numbered per prefix across the design. */
export function instanceNames(design: Design): Map<string, string[]> {
  const counters = new Map<string, number>();
  const names = new Map<string, string[]>();
  for (const c of design.components) {
    const spec = catalog[c.type]!;
    if (!spec.scalesOut) continue;
    const prefix = spec.presentation?.instancePrefix ?? c.type;
    names.set(c.id, Array.from({ length: instanceCountOf(c.params) }, () => {
      const n = (counters.get(prefix) ?? 0) + 1;
      counters.set(prefix, n);
      return `${prefix}-${n}`;
    }));
  }
  return names;
}

/** Turns a design into C4-style nodes: a person, the system boundary, zones, components and one node per instance. */
export function layoutDiagram(design: Design, state: DiagramState): { nodes: Node[]; edges: Edge[] } {
  const live = state.live ?? null;
  const liveOf = (id: string) => live?.result.components.find(c => c.id === id) ?? null;
  const names = instanceNames(design);
  type Placed = { id: string; type: string; params?: Record<string, unknown>; height: number; instances: number; container: boolean };
  const zones = ZONES.map(zone => {
    const members: Placed[] = design.components
      .filter(c => catalog[c.type]!.presentation?.zone === zone)
      .map(c => {
        const container = !!catalog[c.type]!.scalesOut;
        const instances = instanceCountOf(c.params);
        const height = container ? CONTAINER_HEAD + instances * (INSTANCE.h + INSTANCE.gap) - INSTANCE.gap + 14 : BOX.h;
        return { id: c.id, type: c.type, params: c.params, height, instances, container };
      });
    const height = ZONE.head + members.reduce((sum, m) => sum + m.height, 0) + COMPONENT_GAP * Math.max(0, members.length - 1) + ZONE.pad;
    return { zone, members, height, width: BOX.w + 2 * ZONE.pad };
  }).filter(z => z.members.length);

  const innerHeight = Math.max(0, ...zones.map(z => z.height));
  const systemW = SYSTEM.pad * 2 + zones.reduce((sum, z) => sum + z.width, 0) + ZONE.gap * Math.max(0, zones.length - 1);
  const systemH = SYSTEM.head + innerHeight + SYSTEM.pad;
  const systemX = PERSON.w + SYSTEM.gapFromPerson;

  const nodes: Node[] = [];
  nodes.push(sized<PersonData>({ id: 'client', type: 'person', position: { x: 0, y: zones.length ? systemH / 2 - PERSON.h / 2 : 0 },
    data: { title: t.clients, selected: state.selected === 'client' }, deletable: false, selectable: false }, PERSON.w, PERSON.h));
  if (!zones.length) return { nodes, edges: edgesOf(design, state) };

  nodes.push(sized<BoundaryData>({ id: 'system', type: 'boundary', position: { x: systemX, y: 0 },
    data: { title: t.systemName, kind: t.softwareSystem, system: true }, deletable: false, selectable: false, draggable: false }, systemW, systemH));

  let zoneX = SYSTEM.pad;
  for (const zone of zones) {
    const zoneId = `zone-${zone.zone}`;
    nodes.push(sized<BoundaryData>({ id: zoneId, type: 'boundary', parentId: 'system', extent: 'parent',
      position: { x: zoneX, y: SYSTEM.head + (innerHeight - zone.height) / 2 },
      data: { title: t.zones[zone.zone], kind: t.container, system: false }, deletable: false, selectable: false }, zone.width, zone.height));
    let y = ZONE.head;
    for (const member of zone.members) {
      const spec = catalog[member.type]!;
      const size = sizeOf(member.type, member.params);
      const workers = size && spec.sizes ? spec.sizes[size]!.workers : spec.workers;
      const component = design.components.find(c => c.id === member.id)!;
      const detail = member.container
        ? `${t.instanceCount(member.instances)}${size ? ` · ${t.inspector.sizes[size]}` : ''}`
        : spec.shortcut
          ? `TTL ${Number(component.params?.[spec.shortcut.param] ?? spec.shortcut.defaultValue)} s · ~${Math.round(hitRateOf(component) * 100)}% hits`
          : spec.presentation?.hideCapacity ? '' : `${size ? `${t.inspector.sizes[size]} · ` : ''}${t.inspector.connections(workers)}`;
      nodes.push(sized<ComponentData>({ id: member.id, type: 'component', parentId: zoneId, extent: 'parent',
        position: { x: ZONE.pad, y }, selected: state.selected === member.id,
        data: { componentId: member.id, type: member.type, title: t.componentTypes[member.type] ?? member.type, technology: spec.presentation?.technology ?? '',
          detail, container: member.container, selected: state.selected === member.id, problem: state.problemIds.includes(member.id),
          bottleneck: state.bottleneckId === member.id, tutorialTarget: state.tutorialTargetType === member.type,
          load: live && !spec.presentation?.hideCapacity ? (liveOf(member.id)?.bucketUtilization[live.bucket] ?? null) : null } }, BOX.w, member.height));
      if (member.container) {
        for (let k = 0; k < member.instances; k++) {
          nodes.push(sized<InstanceData>({ id: `${member.id}#${k}`, type: 'instance', parentId: member.id, extent: 'parent',
            position: { x: (BOX.w - INSTANCE.w) / 2, y: CONTAINER_HEAD + k * (INSTANCE.h + INSTANCE.gap) },
            data: { type: member.type, name: names.get(member.id)![k]!, detail: `${workers} workers`,
              load: live ? (liveOf(member.id)?.instances[k]?.bucketUtilization[live.bucket] ?? null) : null,
              down: !!live && (liveOf(member.id)?.instances[k]?.killedAtS ?? Infinity) <= live.t }, deletable: false, selectable: false, connectable: false }, INSTANCE.w, INSTANCE.h));
        }
      }
      y += member.height + COMPONENT_GAP;
    }
    zoneX += zone.width + ZONE.gap;
  }
  return { nodes, edges: edgesOf(design, state) };
}

export const edgeId = (from: string, to: string) => `${from}->${to}`;

function edgesOf(design: Design, state: DiagramState): Edge[] {
  return design.connections.map(([from, to]) => {
    const id = edgeId(from, to);
    const live = state.live;
    const data: FlowEdgeData = { animate: !!live?.animate, rps: live ? (live.result.buckets[live.bucket]?.rps ?? 0) : 0 };
    return { id, source: from, target: to, type: 'flow', data, selected: state.selected === id };
  });
}
