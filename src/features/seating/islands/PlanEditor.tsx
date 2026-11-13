/**
 * Plan de table 2D (prototype « Tableau de bord ») : glisser-déposer au pointeur (souris et tactile),
 * fantôme sous le doigt, chaise visée agrandie, échange, retour dans la liste ; tables déplaçables ;
 * zoom et défilement ; versions multiples, plan actif ; alertes ; impression.
 */
import './plan.css';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { admin } from '~/content/fr';
import { api } from '~/features/admin/islands/api';
import {
  clampSeats,
  clampTablePosition,
  newTablePosition,
  ROOM,
  TABLE_GEOM,
  tableGeometry,
} from '../plan-geometry';
import {
  dropPerson,
  edgeScrollSpeed,
  placedOf,
  removeTable,
  seatInitials,
  seatKey,
  shortName,
  trimTable,
} from '../plan-ops';
import type { PlanData, PlanFamily, PlanSummary, PlanTable } from '../seating.service';

const t = admin.plan;
const ZOOM = { MIN: 0.5, MAX: 1.6, STEP: 0.15 } as const;
const MOVE_THRESHOLD_PX = 3;

type Drag =
  | { kind: 'person'; pid: string; name: string; fromSeat: string | null; x: number; y: number }
  | { kind: 'table'; id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean };

interface Props {
  initial: PlanData;
  plans: PlanSummary[];
  families: PlanFamily[];
}

function uuid(): string {
  return (
    crypto.randomUUID?.() ??
    `${Date.now().toString(16)}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`
  );
}

export default function PlanEditor({ initial, plans: initialPlans, families }: Props) {
  const [plan, setPlan] = useState(initial);
  const [plans, setPlans] = useState(initialPlans);
  const [tables, setTables] = useState<PlanTable[]>(initial.tables);
  const [assign, setAssign] = useState<Record<string, string>>(initial.assign);
  const [sel, setSel] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ name: string; x: number; y: number } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<{ text: string; warn: boolean }>({
    text: initial.tables.length ? initial.savedLabel : t.none,
    warn: false,
  });
  const [zoom, setZoom] = useState(1);
  const drag = useRef<Drag | null>(null);
  const overRef = useRef<string | null>(null);
  const boardWrap = useRef<HTMLDivElement>(null);

  const byId = useMemo(() => {
    const m = new Map<string, { first: string; last: string; note: string }>();
    families.forEach((f) => f.people.forEach((p) => m.set(p.id, p)));
    return m;
  }, [families]);
  const placed = useMemo(() => placedOf(assign), [assign]);
  const total = byId.size;
  const nPlaced = [...placed.keys()].filter((id) => byId.has(id)).length;

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      // les navigateurs affichent leur propre message : preventDefault suffit
      e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const touch = () => {
    setDirty(true);
    setStatus({ text: t.dirty, warn: true });
  };

  useEffect(() => {
    // une personne glissée près du haut/bas de l'écran fait défiler la page (liste longue sur mobile)
    let raf = 0;
    const last = { x: 0, y: 0 };
    const hover = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y);
      const seat = el?.closest<HTMLElement>('[data-seat]');
      const list = el?.closest('[data-drop="list"]');
      overRef.current = seat ? (seat.dataset.seat ?? null) : list ? 'list' : null;
      setOver(overRef.current);
    };
    const autoScroll = () => {
      const v = drag.current?.kind === 'person' ? edgeScrollSpeed(last.y, window.innerHeight) : 0;
      if (!v) {
        raf = 0;
        return;
      }
      window.scrollBy(0, v);
      hover(last.x, last.y);
      raf = requestAnimationFrame(autoScroll);
    };
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      if (d.kind === 'table') {
        const dx = (e.clientX - d.sx) / zoom;
        const dy = (e.clientY - d.sy) / zoom;
        if (Math.abs(dx) + Math.abs(dy) > MOVE_THRESHOLD_PX) d.moved = true;
        if (!d.moved) return;
        const p = clampTablePosition(d.ox + dx, d.oy + dy);
        setTables((ts) => ts.map((x) => (x.id === d.id ? { ...x, ...p } : x)));
        touch();
        return;
      }
      e.preventDefault();
      last.x = e.clientX;
      last.y = e.clientY;
      hover(e.clientX, e.clientY);
      setGhost({ name: d.name, x: e.clientX, y: e.clientY });
      if (!raf) raf = requestAnimationFrame(autoScroll);
    };
    const up = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      const d = drag.current;
      drag.current = null;
      if (!d || d.kind === 'table') return;
      const target = overRef.current;
      overRef.current = null;
      setOver(null);
      setAssign((a) => dropPerson(a, d.pid, d.fromSeat, target && target !== 'list' ? target : null));
      setGhost(null);
      touch();
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [zoom]);

  const grabPerson = (e: PointerEvent, pid: string, fromSeat: string | null) => {
    const p = byId.get(pid);
    if (!p) return;
    e.preventDefault();
    e.stopPropagation();
    const name = `${p.first} ${p.last}`.trim();
    drag.current = { kind: 'person', pid, name, fromSeat, x: e.clientX, y: e.clientY };
    setGhost({ name, x: e.clientX, y: e.clientY });
    overRef.current = null;
    setOver(null);
  };

  const addTable = (shape: 'round' | 'rect') => {
    const pos = newTablePosition(tables.length);
    const x: PlanTable = {
      id: uuid(),
      name: t.tableDefault(tables.length + 1),
      shape,
      n: shape === 'round' ? TABLE_GEOM.DEFAULT_ROUND : TABLE_GEOM.DEFAULT_RECT,
      ...pos,
    };
    setTables([...tables, x]);
    setSel(x.id);
    touch();
  };
  const editSel = (fn: (x: PlanTable) => Partial<PlanTable>) => {
    setTables((ts) =>
      ts.map((x) => {
        if (x.id !== sel) return x;
        const nt = { ...x, ...fn(x) };
        if (nt.n !== x.n) setAssign((a) => trimTable(a, x.id, nt.n));
        return nt;
      }),
    );
    touch();
  };
  const delTable = () => {
    if (!sel) return;
    setAssign((a) => removeTable(a, sel));
    setTables((ts) => ts.filter((x) => x.id !== sel));
    setSel(null);
    touch();
  };

  const save = async () => {
    setStatus({ text: t.saving, warn: false });
    const r = await api<PlanData>('PUT', `/api/admin/plans/${plan.id}`, {
      expectedUpdatedAt: plan.updatedAt,
      tables,
      assign,
    });
    if (r.ok) {
      setPlan(r.data);
      setTables(r.data.tables);
      setAssign(r.data.assign);
      setDirty(false);
      setStatus({ text: r.data.savedLabel, warn: false });
    } else setStatus({ text: r.status === 409 ? t.conflict : admin.list.error, warn: true });
  };

  const openPlan = (id: string) => {
    if (dirty && !window.confirm(t.leaveWarning)) return;
    location.href = `/admin?tab=plan&plan=${id}`;
  };
  const newVersion = async (copy: boolean) => {
    if (dirty && !window.confirm(t.leaveWarning)) return;
    const name = window.prompt(t.versionName, t.versionDefault(plans.length + 1));
    if (!name) return;
    const r = await api<{ plan: PlanData }>('POST', '/api/admin/plans', {
      name,
      copyFrom: copy ? plan.id : null,
    });
    if (r.ok && r.data.plan) location.href = `/admin?tab=plan&plan=${r.data.plan.id}`;
  };
  const rename = async () => {
    const name = window.prompt(t.versionName, plan.name);
    if (!name) return;
    const r = await api<{ plans: PlanSummary[] }>('PATCH', `/api/admin/plans/${plan.id}`, { name });
    if (r.ok) {
      setPlans(r.data.plans);
      setPlan({ ...plan, name });
    }
  };
  const activate = async () => {
    const r = await api<{ plans: PlanSummary[] }>('PATCH', `/api/admin/plans/${plan.id}`, { active: true });
    if (r.ok) {
      setPlans(r.data.plans);
      setPlan({ ...plan, isActive: true });
    }
  };
  const removeVersion = async () => {
    if (!window.confirm(t.confirmDeleteVersion)) return;
    const r = await api('DELETE', `/api/admin/plans/${plan.id}`);
    if (r.ok) location.href = '/admin?tab=plan';
  };
  const fit = () => {
    const w = boardWrap.current?.clientWidth ?? ROOM.W;
    setZoom(Math.max(ZOOM.MIN, Math.min(1, (w - 2) / ROOM.W)));
  };

  const selected = tables.find((x) => x.id === sel);
  const freeFamilies = families
    .map((f) => ({ ...f, people: f.people.filter((p) => !placed.has(p.id)) }))
    .filter((f) => f.people.length);

  return (
    <div class="plan">
      <div class="a-toolbar plan__versions">
        <label class="a-field plan__version-select">
          {t.versions}
          <select
            class="a-input"
            value={plan.id}
            onChange={(e) => openPlan((e.target as HTMLSelectElement).value)}
          >
            {plans.map((p) => (
              <option value={p.id} key={p.id}>
                {p.name}
                {p.isActive ? ` · ${t.active}` : ''}
              </option>
            ))}
          </select>
        </label>
        <button class="a-btn a-btn--outline" type="button" onClick={() => newVersion(false)}>
          {t.newVersion}
        </button>
        <button class="a-btn a-btn--outline" type="button" onClick={() => newVersion(true)}>
          {t.duplicate}
        </button>
        <button class="a-btn a-btn--outline" type="button" onClick={rename}>
          {t.rename}
        </button>
        {plan.isActive ? (
          <span class="a-badge a-badge--submitted">{t.active}</span>
        ) : (
          <button class="a-btn a-btn--outline" type="button" onClick={activate}>
            {t.setActive}
          </button>
        )}
        <a
          class="a-btn a-btn--outline"
          href={`/admin/plan/imprimer?plan=${plan.id}`}
          target="_blank"
          rel="noopener"
        >
          {t.print}
        </a>
        {plans.length > 1 && (
          <button class="a-btn a-btn--danger" type="button" onClick={removeVersion}>
            {t.deleteVersion}
          </button>
        )}
      </div>

      <div class="a-toolbar">
        <button class="a-btn a-btn--outline" type="button" onClick={() => addTable('round')}>
          {t.addRound}
        </button>
        <button class="a-btn a-btn--outline" type="button" onClick={() => addTable('rect')}>
          {t.addRect}
        </button>
        <div class="plan__zoom" role="group" aria-label="Zoom">
          <button
            class="a-round"
            type="button"
            aria-label={t.zoomOut}
            onClick={() => setZoom((z) => Math.max(ZOOM.MIN, z - ZOOM.STEP))}
          >
            −
          </button>
          <button class="a-btn a-btn--outline a-btn--small" type="button" onClick={fit}>
            {t.zoomFit}
          </button>
          <button
            class="a-round"
            type="button"
            aria-label={t.zoomIn}
            onClick={() => setZoom((z) => Math.min(ZOOM.MAX, z + ZOOM.STEP))}
          >
            +
          </button>
        </div>
        <div class="a-spacer" />
        <span class={status.warn ? 'plan__status plan__status--dirty' : 'plan__status'} role="status">
          {status.text}
        </span>
        <button class="a-btn a-btn--primary plan__save" type="button" onClick={save}>
          {t.save}
        </button>
      </div>

      {plan.warnings.length > 0 && (
        <div class="plan__warnings" role="alert">
          <strong>{t.warnTitle}</strong>
          <ul>
            {plan.warnings.map((w) => (
              <li key={w.seat}>{w.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div class="plan__layout">
        <div data-drop="list" class={`plan__panel${over === 'list' ? ' is-over' : ''}`}>
          <div class="plan__panel-head">
            <h2 class="a-card__title">{t.toPlace}</h2>
            <div class="plan__count">{t.placed(nPlaced, total)}</div>
          </div>
          <div class="plan__help">{t.help}</div>
          {freeFamilies.map((f) => (
            <div class="plan__family" key={f.key}>
              <div class="plan__family-name">{f.name}</div>
              <div class="plan__people">
                {f.people.map((p) => (
                  <div
                    class="plan__person"
                    key={p.id}
                    title={p.note}
                    data-person={p.id}
                    onPointerDown={(e) => grabPerson(e as unknown as PointerEvent, p.id, null)}
                  >
                    <span>{`${p.first} ${p.last}`.trim()}</span>
                    {p.note && <span class="plan__dot" aria-label={t.allergyLegend} />}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {freeFamilies.length === 0 && <div class="plan__all">{t.allPlaced}</div>}
          <div class="plan__legend">
            <span class="plan__dot" />
            {t.allergyLegend}
          </div>

          {selected && (
            <div class="plan__sel">
              <label class="a-field">
                {t.tableName}
                <input
                  class="a-input"
                  value={selected.name}
                  maxLength={60}
                  onInput={(e) => {
                    const v = (e.target as HTMLInputElement).value;
                    editSel(() => ({ name: v }));
                  }}
                />
              </label>
              <div class="plan__chairs">
                <span>{t.chairs}</span>
                <button
                  class="a-round"
                  type="button"
                  aria-label="−"
                  onClick={() => editSel((x) => ({ n: clampSeats(x.n - 1) }))}
                >
                  −
                </button>
                <span class="plan__n">{selected.n}</span>
                <button
                  class="a-round"
                  type="button"
                  aria-label="+"
                  onClick={() => editSel((x) => ({ n: clampSeats(x.n + 1) }))}
                >
                  +
                </button>
              </div>
              <button class="a-btn a-btn--danger" type="button" onClick={delTable}>
                {t.deleteTable}
              </button>
            </div>
          )}
        </div>

        <div class="plan__board-wrap" ref={boardWrap}>
          <div class="plan__board-size" style={{ width: `${ROOM.W * zoom}px`, height: `${ROOM.H * zoom}px` }}>
            <div
              class="plan__board"
              style={{ transform: `scale(${zoom})` }}
              onPointerDown={(e) => {
                if (e.target === e.currentTarget) setSel(null);
              }}
            >
              <div class="plan__room-label">{t.room}</div>
              <div class="plan__dance">{t.dance}</div>
              {tables.map((x) => {
                const g = tableGeometry(x);
                const fill = g.seats.filter((_, k) => {
                  const pid = assign[seatKey(x.id, k)];
                  return Boolean(pid && byId.has(pid));
                }).length;
                return (
                  <div class="plan__table-anchor" key={x.id} style={{ left: `${x.x}px`, top: `${x.y}px` }}>
                    <div
                      class={`plan__table${sel === x.id ? ' is-selected' : ''}`}
                      data-table-id={x.id}
                      style={{
                        left: `${-g.w / 2}px`,
                        top: `${-g.h / 2}px`,
                        width: `${g.w}px`,
                        height: `${g.h}px`,
                        borderRadius: g.radius,
                      }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        drag.current = {
                          kind: 'table',
                          id: x.id,
                          sx: e.clientX,
                          sy: e.clientY,
                          ox: x.x,
                          oy: x.y,
                          moved: false,
                        };
                        setSel(x.id);
                      }}
                    >
                      <span class="plan__table-name">{x.name}</span>
                      <span class="plan__table-fill">
                        {fill} / {x.n}
                      </span>
                    </div>
                    {g.seats.map(([sx, sy], k) => {
                      const id = seatKey(x.id, k);
                      const pid = assign[id];
                      const p = pid ? byId.get(pid) : undefined;
                      const hot = over === id;
                      return (
                        <div
                          key={id}
                          data-seat={id}
                          class={`plan__seat${p ? ' is-filled' : ''}${hot ? ' is-hot' : ''}`}
                          style={{ left: `${sx.toFixed(1)}px`, top: `${sy.toFixed(1)}px` }}
                          onPointerDown={(e) => {
                            if (p && pid) grabPerson(e as unknown as PointerEvent, pid, id);
                            else {
                              e.stopPropagation();
                              setSel(x.id);
                            }
                          }}
                        >
                          {p ? seatInitials(p.first, p.last) : ''}
                          {p?.note && <span class="plan__seat-dot" />}
                          {p && <span class="plan__seat-name">{shortName(p.first, p.last)}</span>}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {ghost && (
        <div class="plan__ghost" style={{ left: `${ghost.x}px`, top: `${ghost.y}px` }}>
          {ghost.name}
        </div>
      )}
    </div>
  );
}
