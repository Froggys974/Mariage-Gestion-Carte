/** Import d'invitations depuis un fichier CSV : aperçu (lignes valides / en erreur) puis import. */
import { useState } from 'preact/hooks';
import { admin } from '~/content/fr';
import type { ImportReport } from '../invitations.service';
import { api } from './api';

const t = admin.csv;

export function CsvImport({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (msg: string) => void;
}) {
  const [csv, setCsv] = useState('');
  const [report, setReport] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsv(text);
    setBusy(true);
    const r = await api<ImportReport>('POST', '/api/admin/invitations/import', { csv: text, dryRun: true });
    setBusy(false);
    setReport(r.ok ? r.data : null);
  };
  const run = async () => {
    setBusy(true);
    const r = await api<ImportReport>('POST', '/api/admin/invitations/import', { csv, dryRun: false });
    setBusy(false);
    if (r.ok) {
      onImported(t.done(r.data.imported, r.data.duplicates));
      onClose();
    }
  };

  return (
    <div
      class="a-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="csv-title"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div class="a-card a-dialog__panel">
        <h2 class="a-card__title" id="csv-title">
          {t.title}
        </h2>
        <p class="a-hint">{t.help}</p>
        <label class="a-btn a-btn--outline">
          {t.choose}
          <input class="sr-only" type="file" accept=".csv,text/csv,text/plain" onChange={pick} />
        </label>
        {report && (
          <>
            <p class={report.errors.length ? 'a-error' : 'a-ok'}>
              {t.preview(report.valid, report.errors.length)}
            </p>
            {report.errors.length > 0 && (
              <ul class="a-history">
                {report.errors.slice(0, 50).map((er) => (
                  <li key={er.line}>
                    <span>{t.line(er.line)}</span>
                    <span class="a-hint">{er.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        <div class="a-toolbar">
          <button
            class="a-btn a-btn--primary"
            type="button"
            disabled={!report || report.valid === 0 || busy}
            onClick={run}
          >
            {t.confirm(report?.valid ?? 0)}
          </button>
          <div class="a-spacer" />
          <button class="a-btn a-btn--outline" type="button" onClick={onClose}>
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
}
