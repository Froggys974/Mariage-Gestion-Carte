/** Les 4 indicateurs : Envoyés, Confirmés, Déclinés, Couverts. */
import { useEffect, useState } from 'preact/hooks';
import { admin as t } from '~/content/fr';
import type { Kpis as KpiData } from '../invitations.service';

export function Kpis({ kpis }: { kpis: KpiData }) {
  const items = [
    [kpis.sent, t.kpi.sent, ''],
    [kpis.yes, t.kpi.yes, 'a-kpi__value--yes'],
    [kpis.no, t.kpi.no, 'a-kpi__value--no'],
    [kpis.seats, t.kpi.seats, 'a-kpi__value--seats'],
  ] as const;
  return (
    <div class="a-kpis">
      {items.map(([value, label, cls]) => (
        <div class="a-kpi" key={label}>
          <div class={`a-kpi__value ${cls}`}>{value}</div>
          <div class="a-kpi__label">{label}</div>
        </div>
      ))}
    </div>
  );
}

export const KPIS_EVENT = 'admin:kpis';

/** Indicateurs au-dessus des onglets, mis à jour par l'onglet Invitations (événement admin:kpis). */
export default function KpisLive({ kpis }: { kpis: KpiData }) {
  const [k, setK] = useState(kpis);
  useEffect(() => {
    const on = (e: Event) => setK((e as CustomEvent<KpiData>).detail);
    window.addEventListener(KPIS_EVENT, on);
    return () => window.removeEventListener(KPIS_EVENT, on);
  }, []);
  return <Kpis kpis={k} />;
}
