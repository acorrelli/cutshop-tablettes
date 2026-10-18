// Gestion générique des listes de l'admin : tableau, formulaire d'édition, suppression.

import { Copy, ImageUp, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, type AdminTable, type AdminTableRow } from '../lib/api';
import { resolvePhoto } from '../lib/photos';

export type FieldDef =
  | { key: string; label: string; type: 'text' | 'textarea' | 'color'; required?: boolean; help?: string; half?: boolean }
  | { key: string; label: string; type: 'number'; step?: number; min?: number; nullable?: boolean; help?: string; half?: boolean }
  | { key: string; label: string; type: 'bool'; help?: string; half?: boolean }
  | { key: string; label: string; type: 'select'; options: { value: string; label: string }[]; help?: string; half?: boolean }
  | { key: string; label: string; type: 'multi'; options: { value: string; label: string }[]; help?: string; half?: boolean }
  | { key: string; label: string; type: 'datetime'; required?: boolean; nullable?: boolean; half?: boolean; help?: string }
  | { key: string; label: string; type: 'image'; help?: string }
  | { key: string; label: string; type: 'answers'; help?: string; half?: boolean }
  | { key: string; label: string; type: 'correct'; help?: string; half?: boolean };

export interface Column<T> {
  label: string;
  render: (row: T) => ReactNode;
  className?: string;
}

export function AdminCard({ title, actions, children }: { title?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-cream/10 bg-bottle-800/60 p-5">
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {title && <h2 className="mr-auto text-xl font-black uppercase tracking-wide">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const run = useCallback(fn, deps);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await run());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [run]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { data, error, loading, reload, setData };
}

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function FieldInput({ def, value, onChange, row }: { def: FieldDef; value: unknown; onChange: (v: unknown) => void; row: Record<string, unknown> }) {
  const input = 'w-full rounded-xl border-2 border-cream/15 bg-bottle-950/60 px-4 py-3 text-base text-cream outline-none focus:border-gold';
  const [uploading, setUploading] = useState(false);
  switch (def.type) {
    case 'text':
      return <input className={input} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} required={def.required} />;
    case 'color':
      return (
        <div className="flex items-center gap-3">
          <input type="color" className="h-12 w-16 cursor-pointer rounded-lg bg-transparent" value={String(value ?? '#D4A84B')} onChange={(e) => onChange(e.target.value.toUpperCase())} />
          <input className={input} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
        </div>
      );
    case 'textarea':
      return <textarea className={`${input} min-h-[110px]`} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
    case 'number':
      return (
        <input
          type="number"
          className={input}
          step={def.step ?? 1}
          min={def.min}
          value={value === null || value === undefined ? '' : String(value)}
          onChange={(e) => onChange(e.target.value === '' ? (def.nullable ? null : 0) : Number(e.target.value))}
        />
      );
    case 'bool':
      return (
        <button type="button" onClick={() => onChange(!value)} className={`min-h-[48px] rounded-xl px-5 font-bold ${value ? 'bg-gold text-bottle-950' : 'bg-white/10 text-cream'}`}>
          {value ? 'Oui' : 'Non'}
        </button>
      );
    case 'select':
      return (
        <select className={input} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
          {def.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case 'multi': {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="flex flex-wrap gap-2">
          {def.options.map((o) => {
            const on = arr.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                className={`min-h-[44px] rounded-xl px-4 font-bold ${on ? 'bg-gold text-bottle-950' : 'bg-white/10 text-cream'}`}
                onClick={() => onChange(on ? arr.filter((x) => x !== o.value) : [...arr, o.value])}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      );
    }
    case 'datetime':
      return (
        <input
          type="datetime-local"
          className={input}
          value={toLocalInput(value as string | null)}
          onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : def.nullable ? null : '')}
        />
      );
    case 'image':
      return (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input className={input} placeholder="https://..." value={String(value ?? '')} onChange={(e) => onChange(e.target.value || null)} />
            <label className="flex min-h-[48px] cursor-pointer items-center gap-2 rounded-xl bg-white/10 px-4 font-bold">
              <ImageUp size={20} /> {uploading ? '...' : 'Envoyer'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setUploading(true);
                  try {
                    onChange(await api.uploadImage(f));
                  } catch (err) {
                    alert(`Envoi impossible : ${err instanceof Error ? err.message : String(err)}`);
                  } finally {
                    setUploading(false);
                  }
                }}
              />
            </label>
          </div>
          {typeof value === 'string' && resolvePhoto(value) && <img src={resolvePhoto(value)!} alt="" className="h-28 rounded-xl object-cover" />}
          {typeof value === 'string' && value.startsWith('photo:') && !resolvePhoto(value) && <span className="block text-xs text-cream/50">Photo « {value.slice(6)} » pas encore déposée dans src/assets/photos.</span>}
        </div>
      );
    case 'answers': {
      const arr = Array.isArray(value) ? (value as string[]) : ['', '', '', ''];
      return (
        <div className="grid gap-2">
          {[0, 1, 2, 3].map((i) => (
            <input
              key={i}
              className={`${input} ${Number(row.correct_index) === i ? 'border-gold' : ''}`}
              placeholder={`Réponse ${i + 1}`}
              value={arr[i] ?? ''}
              onChange={(e) => {
                const next = [...arr];
                while (next.length < 4) next.push('');
                next[i] = e.target.value;
                onChange(next);
              }}
            />
          ))}
        </div>
      );
    }
    case 'correct':
      return (
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <button key={i} type="button" onClick={() => onChange(i)} className={`min-h-[48px] min-w-[56px] rounded-xl font-black ${Number(value) === i ? 'bg-gold text-bottle-950' : 'bg-white/10'}`}>
              {i + 1}
            </button>
          ))}
        </div>
      );
  }
}

/** Vérifie la règle de rédaction : aucun tiret isolé dans les textes affichés (le trait d'union dans un mot est permis). */
export function findDashes(row: Record<string, unknown>, fields: FieldDef[]): string[] {
  const bad: string[] = [];
  for (const f of fields) {
    if (f.type === 'image' || f.type === 'color') continue;
    const v = row[f.key];
    const values = Array.isArray(v) ? v : [v];
    if (values.some((x) => typeof x === 'string' && /[‐‒–—―−]|(^|[^\p{L}\p{N}}])-|-([^\p{L}\p{N}]|$)/u.test(x))) bad.push(f.label);
  }
  return bad;
}

export function EditDrawer({
  title,
  fields,
  row,
  onCancel,
  onSave,
}: {
  title: string;
  fields: FieldDef[];
  row: Record<string, unknown>;
  onCancel: () => void;
  onSave: (row: Record<string, unknown>) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Record<string, unknown>>(row);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dashes = findDashes(draft, fields);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" role="dialog" aria-modal="true">
      <div className="flex h-full w-full max-w-2xl flex-col bg-bottle-900 shadow-2xl animate-fade-up">
        <div className="flex items-center gap-3 border-b border-cream/10 p-5">
          <h3 className="mr-auto text-xl font-black uppercase">{title}</h3>
          <button type="button" className="grid h-12 w-12 place-items-center rounded-xl bg-white/10" onClick={onCancel} aria-label="Fermer">
            <X />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((f) => (
              <label key={f.key} className={`block ${'half' in f && f.half ? '' : 'sm:col-span-2'}`}>
                <span className="mb-1 block text-sm font-bold text-cream/80">{f.label}</span>
                <FieldInput def={f} value={draft[f.key]} row={draft} onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))} />
                {'help' in f && f.help && <span className="mt-1 block text-xs text-cream/50">{f.help}</span>}
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-3 border-t border-cream/10 p-5">
          {dashes.length > 0 && (
            <p className="rounded-xl bg-gold/15 p-3 text-sm font-bold text-gold-300">
              Rappel de la charte : pas de tiret isolé dans les textes affichés ({dashes.join(', ')}). Le trait d’union reste permis dans les mots (rendez-vous, as-tu). Pour une valeur approximative, utilise +/.
            </p>
          )}
          {error && <p className="rounded-xl bg-red-900/50 p-3 text-sm font-bold">{error}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" className="min-h-[52px] rounded-xl bg-white/10 px-5 font-bold" onClick={onCancel}>
              Annuler
            </button>
            <button type="button" className="flex min-h-[52px] items-center gap-2 rounded-xl bg-gold px-6 font-black text-bottle-950 disabled:opacity-50" onClick={save} disabled={saving} data-testid="crud-save">
              <Save size={20} /> Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CrudSection<T extends AdminTable>({
  table,
  title,
  fields,
  columns,
  defaults,
  filter,
  toolbar,
  rowActions,
  normalize,
  sort,
  duplicate,
}: {
  table: T;
  title: string;
  fields: FieldDef[];
  columns: Column<AdminTableRow[T]>[];
  defaults: () => Partial<AdminTableRow[T]>;
  filter?: (row: AdminTableRow[T]) => boolean;
  toolbar?: ReactNode;
  rowActions?: (row: AdminTableRow[T]) => ReactNode;
  normalize?: (row: Record<string, unknown>) => Record<string, unknown>;
  sort?: (a: AdminTableRow[T], b: AdminTableRow[T]) => number;
  duplicate?: (row: AdminTableRow[T]) => Partial<AdminTableRow[T]>;
}) {
  const { data, error, loading, reload } = useAsync(() => api.adminList(table), [table]);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const rows = useMemo(() => {
    const list = (data ?? []).filter((r) => (filter ? filter(r) : true));
    return sort ? list.slice().sort(sort) : list;
  }, [data, filter, sort]);

  const save = async (row: Record<string, unknown>) => {
    const clean = normalize ? normalize(row) : row;
    if (!clean.id) delete clean.id;
    await api.adminUpsert(table, clean as Partial<AdminTableRow[T]>);
    setEditing(null);
    await reload();
  };

  const remove = async (row: AdminTableRow[T]) => {
    if (!confirm('Supprimer définitivement cet élément ?')) return;
    try {
      await api.adminDelete(table, (row as { id: string }).id);
      await reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <AdminCard
      title={`${title} (${rows.length})`}
      actions={
        <>
          {toolbar}
          <button type="button" className="flex min-h-[48px] items-center gap-2 rounded-xl bg-gold px-5 font-black text-bottle-950" onClick={() => setEditing({ ...defaults() })} data-testid="crud-add">
            <Plus size={20} /> Ajouter
          </button>
        </>
      }
    >
      {error && <p className="mb-3 rounded-xl bg-red-900/50 p-3 font-bold">{error}</p>}
      {loading && !data ? (
        <p className="text-cream/60">Chargement...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-cream/10 text-xs uppercase tracking-wider text-cream/50">
                {columns.map((c) => (
                  <th key={c.label} className={`px-3 py-2 ${c.className ?? ''}`}>
                    {c.label}
                  </th>
                ))}
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={(r as { id: string }).id} className="border-b border-cream/5 align-top hover:bg-white/[0.03]">
                  {columns.map((c) => (
                    <td key={c.label} className={`px-3 py-3 ${c.className ?? ''}`}>
                      {c.render(r)}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {rowActions?.(r)}
                    {duplicate && (
                      <button type="button" className="ml-1 inline-grid h-11 w-11 place-items-center rounded-xl bg-white/10" title="Dupliquer" onClick={() => setEditing({ ...(duplicate(r) as unknown as Record<string, unknown>), id: undefined })}>
                        <Copy size={18} />
                      </button>
                    )}
                    <button type="button" className="ml-1 inline-grid h-11 w-11 place-items-center rounded-xl bg-white/10" title="Modifier" onClick={() => setEditing({ ...(r as unknown as Record<string, unknown>) })} data-testid="crud-edit">
                      <Pencil size={18} />
                    </button>
                    <button type="button" className="ml-1 inline-grid h-11 w-11 place-items-center rounded-xl bg-red-900/60" title="Supprimer" onClick={() => remove(r)}>
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <EditDrawer title={editing.id ? `Modifier : ${title}` : `Ajouter : ${title}`} fields={fields} row={editing} onCancel={() => setEditing(null)} onSave={save} />}
    </AdminCard>
  );
}

export function StatusPill({ on, onLabel, offLabel }: { on: boolean; onLabel: string; offLabel: string }) {
  return <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${on ? 'bg-gold/20 text-gold-300' : 'bg-white/10 text-cream/60'}`}>{on ? onLabel : offLabel}</span>;
}

export const fmtDateTime = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat('fr-BE', { timeZone: 'Europe/Brussels', dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso)) : '';
