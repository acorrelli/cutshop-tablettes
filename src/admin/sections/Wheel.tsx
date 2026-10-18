import { CheckCircle2, Ticket } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api, type RedeemResult } from '../../lib/api';
import type { WheelSpin } from '../../lib/types';
import { AdminCard, CrudSection, fmtDateTime, StatusPill } from '../Crud';

const REASONS: Record<string, string> = { staff: 'Code staff', battle: 'Victoire Quiz Cutshop', stop10: '10,00 s pile' };

export function WheelSection() {
  const [code, setCode] = useState('');
  const [res, setRes] = useState<RedeemResult | null>(null);
  const [spins, setSpins] = useState<WheelSpin[] | null>(null);
  const loadSpins = useCallback(() => void api.listSpins(300).then(setSpins), []);
  useEffect(() => loadSpins(), [loadSpins]);

  const redeem = async (c: string) => {
    const r = await api.redeemCode(c);
    setRes(r);
    setCode('');
    loadSpins();
  };

  return (
    <div className="space-y-6">
      <AdminCard title="Valider un code gagnant">
        <form
          className="flex flex-wrap items-center gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim().length === 6) void redeem(code);
          }}
        >
          <input
            className="w-56 rounded-xl border-2 border-cream/15 bg-bottle-950/60 px-4 py-3 font-mono text-2xl uppercase tracking-[0.3em] outline-none focus:border-gold"
            placeholder="ABC234"
            value={code}
            maxLength={6}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
              setRes(null);
            }}
            data-testid="redeem-input"
          />
          <button type="submit" className="flex min-h-[52px] items-center gap-2 rounded-xl bg-gold px-5 font-black text-bottle-950 disabled:opacity-40" disabled={code.length !== 6} data-testid="redeem-submit">
            <CheckCircle2 size={20} /> Valider
          </button>
          {res && (
            <p className={`rounded-xl px-4 py-3 font-bold ${res.ok ? 'bg-gold/20 text-gold-300' : 'bg-red-900/50'}`} data-testid="redeem-result">
              {res.ok
                ? `Code valide : ${res.label_fr}. Il est maintenant utilisé.`
                : res.error === 'used'
                  ? `Déjà utilisé le ${fmtDateTime(res.redeemed_at)} (${res.label_fr}).`
                  : res.error === 'unknown'
                    ? 'Code inconnu.'
                    : 'Action non autorisée.'}
            </p>
          )}
        </form>
      </AdminCard>

      <CrudSection
        table="wheel_prizes"
        title="Gains de la roue"
        sort={(a, b) => a.sort - b.sort}
        fields={[
          { key: 'label_fr', label: 'Libellé (FR)', type: 'text', required: true, half: true },
          { key: 'label_en', label: 'Libellé (EN)', type: 'text', half: true },
          { key: 'weight', label: 'Probabilité (%)', type: 'number', step: 0.5, min: 0, half: true, help: 'Les probabilités sont relatives : elles sont ramenées à 100 % au tirage.' },
          { key: 'stock', label: 'Stock disponible (vide = illimité)', type: 'number', min: 0, nullable: true, half: true },
          { key: 'color', label: 'Couleur de la case', type: 'color', half: true },
          { key: 'sort', label: 'Ordre sur la roue', type: 'number', half: true },
          { key: 'is_losing', label: 'Case « Pas de chance » (aucun code)', type: 'bool', half: true },
          { key: 'active', label: 'Actif', type: 'bool', half: true },
        ]}
        defaults={() => ({ label_fr: '', label_en: '', weight: 10, stock: null, is_losing: false, color: '#D4A84B', sort: 50, active: true })}
        normalize={(r) => ({ ...r, weight: Number(r.weight), stock: r.stock === null || r.stock === '' ? null : Number(r.stock) })}
        columns={[
          { label: 'Libellé', render: (p) => <strong>{p.label_fr}</strong> },
          {
            label: 'Probabilité',
            render: (p) => `${Number(p.weight).toString().replace('.', ',')} %`,
          },
          { label: 'Stock', render: (p) => (p.stock === null ? 'illimité' : p.stock) },
          { label: 'Couleur', render: (p) => <span className="inline-block h-6 w-10 rounded-md ring-1 ring-white/20" style={{ background: p.color }} /> },
          { label: 'Statut', render: (p) => <StatusPill on={p.active} onLabel={p.is_losing ? 'Perdant' : 'Actif'} offLabel="Inactif" /> },
        ]}
      />

      <AdminCard title="Historique des tours" actions={<button type="button" className="min-h-[48px] rounded-xl bg-white/10 px-4 font-bold" onClick={loadSpins}>Actualiser</button>}>
        {!spins ? (
          <p>Chargement...</p>
        ) : spins.length === 0 ? (
          <p className="text-cream/60">Aucun tour pour le moment.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-cream/50">
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2">Gain</th>
                  <th className="px-2 py-2">Code</th>
                  <th className="px-2 py-2">Origine</th>
                  <th className="px-2 py-2">Tablette</th>
                  <th className="px-2 py-2 text-right">Statut</th>
                </tr>
              </thead>
              <tbody>
                {spins.map((s) => (
                  <tr key={s.id} className="border-t border-cream/5">
                    <td className="px-2 py-2 whitespace-nowrap">{fmtDateTime(s.created_at)}</td>
                    <td className="px-2 py-2">{s.label_fr}</td>
                    <td className="px-2 py-2 font-mono font-bold tracking-widest">{s.code ?? ''}</td>
                    <td className="px-2 py-2">{REASONS[s.reason] ?? s.reason}</td>
                    <td className="px-2 py-2">{s.tablet}</td>
                    <td className="px-2 py-2 text-right">
                      {!s.code ? (
                        <span className="text-cream/40">Sans gain</span>
                      ) : s.redeemed_at ? (
                        <StatusPill on={false} onLabel="" offLabel={`Utilisé ${fmtDateTime(s.redeemed_at)}`} />
                      ) : (
                        <button type="button" className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-gold px-3 text-xs font-black text-bottle-950" onClick={() => redeem(s.code!)}>
                          <Ticket size={16} /> Valider
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>
    </div>
  );
}
