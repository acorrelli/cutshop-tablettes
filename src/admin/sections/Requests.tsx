import { CheckCircle2, Circle, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api, type RequestTable } from '../../lib/api';
import { formatVat } from '../../lib/vat';
import type { DeskRequest, InvoiceRequest, ProductRequest, RequestStatus } from '../../lib/types';
import { AdminCard, fmtDateTime } from '../Crud';

const HAIR: Record<string, string> = { fine: 'fins', thick: 'épais', curly: 'bouclés', coily: 'crépus' };
const SCALP: Record<string, string> = { normal: 'normal', dry: 'sec', oily: 'gras' };
const EFFECT: Record<string, string> = { volume: 'volume', hold: 'tenue', shine: 'brillance', natural: 'naturel', care: 'soin' };

function useRequests<T extends { id: string; status: RequestStatus }>(table: RequestTable) {
  const [rows, setRows] = useState<T[] | null>(null);
  const load = useCallback(() => {
    void (api.listRequests as unknown as (t: RequestTable) => Promise<T[]>)(table).then(setRows);
  }, [table]);
  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);
  const toggle = async (row: T) => {
    await api.setRequestStatus(table, row.id, row.status === 'new' ? 'done' : 'new');
    load();
  };
  const remove = async (row: T) => {
    if (!confirm('Supprimer cette demande ?')) return;
    await api.deleteRequest(table, row.id);
    load();
  };
  return { rows, load, toggle, remove };
}

function StatusButton({ status, onClick }: { status: RequestStatus; onClick: () => void }) {
  const done = status === 'done';
  return (
    <button type="button" onClick={onClick} className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 text-sm font-black ${done ? 'bg-white/10 text-cream/60' : 'bg-gold text-bottle-950'}`} data-testid="request-status">
      {done ? <CheckCircle2 size={18} /> : <Circle size={18} />} {done ? 'Traitée' : 'Nouvelle'}
    </button>
  );
}

function Filter({ value, onChange }: { value: 'all' | RequestStatus; onChange: (v: 'all' | RequestStatus) => void }) {
  return (
    <div className="flex gap-2">
      {(['new', 'done', 'all'] as const).map((v) => (
        <button key={v} type="button" onClick={() => onChange(v)} className={`min-h-[44px] rounded-xl px-4 text-sm font-bold ${value === v ? 'bg-cream text-bottle-900' : 'bg-white/10'}`}>
          {v === 'new' ? 'Nouvelles' : v === 'done' ? 'Traitées' : 'Toutes'}
        </button>
      ))}
    </div>
  );
}

export function ProductRequestsSection() {
  const { rows, toggle, remove } = useRequests<ProductRequest>('product_requests');
  const desk = useRequests<DeskRequest>('desk_requests');
  const [filter, setFilter] = useState<'all' | RequestStatus>('new');
  const list = (rows ?? []).filter((r) => filter === 'all' || r.status === filter);
  const deskNew = (desk.rows ?? []).filter((r) => r.status === 'new');
  return (
    <div className="space-y-6">
      {deskNew.length > 0 && (
        <AdminCard title="Appels à l’accueil">
          <ul className="space-y-2">
            {deskNew.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-gold/15 p-3">
                <span className="mr-auto font-bold">
                  {d.tablet} demande des infos sur les chèques cadeaux · {fmtDateTime(d.created_at)}
                </span>
                <StatusButton status={d.status} onClick={() => desk.toggle(d)} />
              </li>
            ))}
          </ul>
        </AdminCard>
      )}
      <AdminCard title={`Demandes produits (${list.length})`} actions={<Filter value={filter} onChange={setFilter} />}>
        {!rows ? (
          <p>Chargement...</p>
        ) : list.length === 0 ? (
          <p className="text-cream/60">Rien à afficher.</p>
        ) : (
          <ul className="space-y-3" data-testid="product-requests">
            {list.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start gap-4 rounded-2xl bg-white/[0.05] p-4">
                <div className="mr-auto min-w-[240px]">
                  <p className="text-lg font-black">
                    {r.first_name} <span className="text-sm font-bold text-cream/50">· {r.tablet} · {fmtDateTime(r.created_at)}</span>
                  </p>
                  <p className="text-sm text-cream/70">
                    Cheveux {HAIR[r.profile.hair] ?? r.profile.hair}, cuir chevelu {SCALP[r.profile.scalp] ?? r.profile.scalp}, {r.profile.beard ? 'avec barbe' : 'sans barbe'}, effet {EFFECT[r.profile.effect] ?? r.profile.effect}
                  </p>
                  <p className="mt-1 font-bold text-gold-300">{r.product_names.join(' · ')}</p>
                </div>
                <StatusButton status={r.status} onClick={() => toggle(r)} />
                <button type="button" className="grid h-11 w-11 place-items-center rounded-xl bg-red-900/60" onClick={() => remove(r)} aria-label="Supprimer">
                  <Trash2 size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>
    </div>
  );
}

export function InvoiceRequestsSection() {
  const { rows, toggle, remove } = useRequests<InvoiceRequest>('invoice_requests');
  const [filter, setFilter] = useState<'all' | RequestStatus>('new');
  const list = (rows ?? []).filter((r) => filter === 'all' || r.status === filter);
  return (
    <AdminCard title={`Demandes de factures (${list.length})`} actions={<Filter value={filter} onChange={setFilter} />}>
      <p className="mb-4 text-sm text-cream/60">Une fois la facture envoyée, passe la demande en « Traitée ». Pense à supprimer les demandes anciennes (RGPD).</p>
      {!rows ? (
        <p>Chargement...</p>
      ) : list.length === 0 ? (
        <p className="text-cream/60">Rien à afficher.</p>
      ) : (
        <ul className="space-y-3" data-testid="invoice-requests">
          {list.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start gap-4 rounded-2xl bg-white/[0.05] p-4">
              <div className="mr-auto min-w-[240px]">
                <p className="text-lg font-black">
                  {r.company} <span className="font-mono text-base text-gold-300">{formatVat(r.vat)}</span>
                </p>
                <p className="text-sm">{r.address}</p>
                <p className="text-sm">
                  {r.first_name} {r.last_name} · <strong>{r.email}</strong>
                </p>
                <p className="text-xs text-cream/50">
                  {r.tablet} · {fmtDateTime(r.created_at)}
                </p>
              </div>
              <StatusButton status={r.status} onClick={() => toggle(r)} />
              <button type="button" className="grid h-11 w-11 place-items-center rounded-xl bg-red-900/60" onClick={() => remove(r)} aria-label="Supprimer">
                <Trash2 size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </AdminCard>
  );
}
