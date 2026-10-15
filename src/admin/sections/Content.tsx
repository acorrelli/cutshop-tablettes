// Sections de contenus : événements, boissons, accords, produits, quiz.

import { Download, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { downloadCsv, toCsv } from '../../lib/csv';
import type { CutEvent, Registration } from '../../lib/types';
import { QUIZ_THEMES } from '../../lib/types';
import { AdminCard, CrudSection, fmtDateTime, StatusPill, type FieldDef } from '../Crud';

const KINDS = [
  { value: 'dj', label: 'DJ / soirée' },
  { value: 'talk', label: 'Discussion' },
  { value: 'read', label: 'Lecture' },
  { value: 'mic', label: 'Scène ouverte' },
  { value: 'run', label: 'Course' },
  { value: 'other', label: 'Autre' },
];

const EVENT_FIELDS: FieldDef[] = [
  { key: 'title_fr', label: 'Nom (FR)', type: 'text', required: true, half: true },
  { key: 'title_en', label: 'Nom (EN)', type: 'text', half: true },
  { key: 'kind', label: 'Type (visuel par défaut)', type: 'select', options: KINDS, half: true },
  { key: 'capacity', label: 'Capacité (places)', type: 'number', min: 0, half: true },
  { key: 'starts_at', label: 'Début', type: 'datetime', required: true, half: true },
  { key: 'ends_at', label: 'Fin', type: 'datetime', nullable: true, half: true },
  { key: 'description_fr', label: 'Description courte (FR)', type: 'textarea' },
  { key: 'description_en', label: 'Description courte (EN)', type: 'textarea' },
  { key: 'recurrence_fr', label: 'Récurrence affichée (FR)', type: 'text', half: true, help: 'Ex : Un samedi sur deux' },
  { key: 'recurrence_en', label: 'Récurrence affichée (EN)', type: 'text', half: true },
  { key: 'image_url', label: 'Image', type: 'image' },
  { key: 'published', label: 'Publié sur les tablettes', type: 'bool' },
];

const REG_COLUMNS = [
  { key: 'created_at', label: 'Date' },
  { key: 'first_name', label: 'Prénom' },
  { key: 'last_name', label: 'Nom' },
  { key: 'email', label: 'Adresse mail' },
  { key: 'seats', label: 'Places' },
  { key: 'newsletter', label: 'Newsletter' },
  { key: 'tablet', label: 'Tablette' },
];

function exportRegistrations(event: CutEvent | null, regs: Registration[]) {
  const rows = regs.map((r) => ({ ...r, created_at: fmtDateTime(r.created_at), newsletter: r.newsletter ? 'oui' : 'non' }));
  const name = event ? `inscrits_${event.title_fr.replace(/\W+/g, '_')}_${event.starts_at.slice(0, 10)}.csv` : 'inscrits_tous.csv';
  downloadCsv(name, toCsv(rows, REG_COLUMNS));
}

function Registrations({ event, onClose }: { event: CutEvent; onClose: () => void }) {
  const [regs, setRegs] = useState<Registration[] | null>(null);
  useEffect(() => {
    void api.listRegistrations(event.id).then(setRegs);
  }, [event.id]);
  const seats = (regs ?? []).reduce((s, r) => s + r.seats, 0);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="dialog">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-bottle-900 shadow-2xl">
        <div className="flex flex-wrap items-center gap-3 border-b border-cream/10 p-5">
          <div className="mr-auto">
            <h3 className="text-xl font-black uppercase">{event.title_fr}</h3>
            <p className="text-sm text-cream/60">
              {fmtDateTime(event.starts_at)} · {seats} / {event.capacity} places réservées
            </p>
          </div>
          <button type="button" className="flex min-h-[48px] items-center gap-2 rounded-xl bg-gold px-4 font-black text-bottle-950" onClick={() => exportRegistrations(event, regs ?? [])} disabled={!regs?.length}>
            <Download size={18} /> Export CSV
          </button>
          <button type="button" className="min-h-[48px] rounded-xl bg-white/10 px-4 font-bold" onClick={onClose}>
            Fermer
          </button>
        </div>
        <div className="max-h-[65vh] overflow-auto p-5">
          {!regs ? (
            <p>Chargement...</p>
          ) : regs.length === 0 ? (
            <p className="text-cream/60">Aucun inscrit pour le moment.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-cream/50">
                  {REG_COLUMNS.map((c) => (
                    <th key={c.key} className="px-2 py-2">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {regs.map((r) => (
                  <tr key={r.id} className="border-t border-cream/5">
                    <td className="px-2 py-2">{fmtDateTime(r.created_at)}</td>
                    <td className="px-2 py-2">{r.first_name}</td>
                    <td className="px-2 py-2">{r.last_name}</td>
                    <td className="px-2 py-2">{r.email}</td>
                    <td className="px-2 py-2">{r.seats}</td>
                    <td className="px-2 py-2">{r.newsletter ? 'oui' : 'non'}</td>
                    <td className="px-2 py-2">{r.tablet}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export function EventsSection() {
  const [showPast, setShowPast] = useState(false);
  const [regsFor, setRegsFor] = useState<CutEvent | null>(null);
  const now = Date.now();
  return (
    <>
      <CrudSection
        table="events"
        title="Événements"
        fields={EVENT_FIELDS}
        filter={(e) => showPast || new Date(e.ends_at ?? e.starts_at).getTime() > now - 86400000}
        sort={(a, b) => a.starts_at.localeCompare(b.starts_at)}
        toolbar={
          <>
            <button type="button" className="min-h-[48px] rounded-xl bg-white/10 px-4 font-bold" onClick={() => setShowPast((v) => !v)}>
              {showPast ? 'Masquer les passés' : 'Afficher les passés'}
            </button>
            <button
              type="button"
              className="flex min-h-[48px] items-center gap-2 rounded-xl bg-white/10 px-4 font-bold"
              onClick={async () => exportRegistrations(null, await api.listRegistrations())}
            >
              <Download size={18} /> Tous les inscrits
            </button>
          </>
        }
        defaults={() => ({
          kind: 'other' as const,
          title_fr: '',
          title_en: '',
          description_fr: '',
          description_en: '',
          recurrence_fr: '',
          recurrence_en: '',
          starts_at: new Date(Date.now() + 7 * 86400000).toISOString(),
          ends_at: null,
          image_url: null,
          capacity: 30,
          published: true,
        })}
        duplicate={(e) => {
          // Copie la soirée une semaine plus tard (pratique pour les récurrences).
          const shift = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 7 * 86400000).toISOString() : null);
          return { ...e, starts_at: shift(e.starts_at)!, ends_at: shift(e.ends_at) };
        }}
        columns={[
          { label: 'Date', render: (e) => <span className="whitespace-nowrap">{fmtDateTime(e.starts_at)}</span> },
          { label: 'Nom', render: (e) => <strong>{e.title_fr}</strong> },
          { label: 'Capacité', render: (e) => e.capacity },
          { label: 'Statut', render: (e) => <StatusPill on={e.published} onLabel="Publié" offLabel="Masqué" /> },
        ]}
        rowActions={(e) => (
          <button type="button" className="inline-flex h-11 items-center gap-2 rounded-xl bg-white/10 px-3 font-bold" onClick={() => setRegsFor(e)} data-testid="show-registrations">
            <Users size={18} /> Inscrits
          </button>
        )}
      />
      {regsFor && <Registrations event={regsFor} onClose={() => setRegsFor(null)} />}
    </>
  );
}

export function DrinksSection() {
  return (
    <div className="space-y-6">
      <CrudSection
        table="drinks"
        title="Boissons"
        sort={(a, b) => a.category.localeCompare(b.category) || a.sort - b.sort}
        fields={[
          { key: 'name', label: 'Nom', type: 'text', required: true, half: true },
          { key: 'brand', label: 'Brasserie ou marque', type: 'text', half: true },
          {
            key: 'category',
            label: 'Catégorie',
            type: 'select',
            half: true,
            options: [
              { value: 'beer', label: 'Bière du terroir belge' },
              { value: 'soft', label: 'Soft' },
              { value: 'other', label: 'Autre boisson' },
            ],
          },
          { key: 'price', label: 'Prix (€)', type: 'number', step: 0.1, min: 0, half: true },
          { key: 'style_fr', label: 'Style (FR)', type: 'text', half: true },
          { key: 'style_en', label: 'Style (EN)', type: 'text', half: true },
          { key: 'abv', label: 'Degré (% vol., vide pour un soft)', type: 'number', step: 0.1, min: 0, nullable: true, half: true },
          { key: 'sort', label: 'Ordre d’affichage', type: 'number', half: true },
          { key: 'description_fr', label: 'Description courte (FR)', type: 'textarea' },
          { key: 'description_en', label: 'Description courte (EN)', type: 'textarea' },
          { key: 'image_url', label: 'Photo', type: 'image' },
          { key: 'active', label: 'Visible sur la carte', type: 'bool' },
        ]}
        defaults={() => ({ category: 'beer' as const, name: '', brand: '', style_fr: '', style_en: '', abv: null, description_fr: '', description_en: '', price: 0, image_url: null, sort: 50, active: true })}
        normalize={(r) => ({ ...r, price: Number(r.price), abv: r.abv === null || r.abv === '' ? null : Number(r.abv) })}
        columns={[
          { label: 'Catégorie', render: (d) => ({ beer: 'Bière', soft: 'Soft', other: 'Autre' })[d.category] },
          { label: 'Nom', render: (d) => <strong>{d.name}</strong> },
          { label: 'Marque', render: (d) => d.brand },
          { label: 'Prix', render: (d) => `${Number(d.price).toFixed(2).replace('.', ',')} €` },
          { label: 'Statut', render: (d) => <StatusPill on={d.active} onLabel="Visible" offLabel="Masquée" /> },
        ]}
      />
      <CrudSection
        table="drink_pairings"
        title="Ta coupe, ta bière"
        sort={(a, b) => a.sort - b.sort}
        fields={[
          { key: 'cut_fr', label: 'Coupe (FR)', type: 'text', required: true, half: true },
          { key: 'cut_en', label: 'Coupe (EN)', type: 'text', half: true },
          { key: 'drink_fr', label: 'Boisson conseillée (FR)', type: 'text', half: true },
          { key: 'drink_en', label: 'Boisson conseillée (EN)', type: 'text', half: true },
          { key: 'line_fr', label: 'Phrase humoristique (FR)', type: 'textarea' },
          { key: 'line_en', label: 'Phrase humoristique (EN)', type: 'textarea' },
          { key: 'sort', label: 'Ordre', type: 'number', half: true },
          { key: 'active', label: 'Visible', type: 'bool', half: true },
        ]}
        defaults={() => ({ cut_fr: '', cut_en: '', drink_fr: '', drink_en: '', line_fr: '', line_en: '', sort: 50, active: true })}
        columns={[
          { label: 'Coupe', render: (p) => <strong>{p.cut_fr}</strong> },
          { label: 'Boisson', render: (p) => p.drink_fr },
          { label: 'Phrase', render: (p) => <span className="text-cream/70">{p.line_fr}</span> },
        ]}
      />
    </div>
  );
}

const HAIR = [
  { value: 'fine', label: 'Fins' },
  { value: 'thick', label: 'Épais' },
  { value: 'curly', label: 'Bouclés' },
  { value: 'coily', label: 'Crépus' },
];
const SCALP = [
  { value: 'normal', label: 'Normal' },
  { value: 'dry', label: 'Sec' },
  { value: 'oily', label: 'Gras' },
];
const EFFECTS = [
  { value: 'volume', label: 'Volume' },
  { value: 'hold', label: 'Tenue' },
  { value: 'shine', label: 'Brillance' },
  { value: 'natural', label: 'Naturel' },
  { value: 'care', label: 'Soin' },
];

export function ProductsSection() {
  return (
    <CrudSection
      table="products"
      title="Produits"
      sort={(a, b) => a.sort - b.sort}
      fields={[
        { key: 'name', label: 'Nom', type: 'text', required: true, half: true },
        { key: 'brand', label: 'Marque', type: 'text', half: true },
        { key: 'price', label: 'Prix (€)', type: 'number', step: 0.1, min: 0, half: true },
        { key: 'sort', label: 'Ordre', type: 'number', half: true },
        { key: 'benefit_fr', label: 'Bénéfice (FR)', type: 'textarea' },
        { key: 'benefit_en', label: 'Bénéfice (EN)', type: 'textarea' },
        { key: 'usage_fr', label: 'Mode d’utilisation (FR)', type: 'textarea' },
        { key: 'usage_en', label: 'Mode d’utilisation (EN)', type: 'textarea' },
        { key: 'hair_types', label: 'Types de cheveux (aucun = tous)', type: 'multi', options: HAIR },
        { key: 'scalp_types', label: 'Cuir chevelu (aucun = tous)', type: 'multi', options: SCALP },
        { key: 'effects', label: 'Effets', type: 'multi', options: EFFECTS },
        { key: 'for_beard', label: 'Produit barbe', type: 'bool', half: true, help: 'Proposé uniquement aux clients barbus' },
        { key: 'active', label: 'Visible', type: 'bool', half: true },
        { key: 'image_url', label: 'Photo', type: 'image' },
      ]}
      defaults={() => ({ name: '', brand: '', benefit_fr: '', benefit_en: '', usage_fr: '', usage_en: '', price: 0, image_url: null, hair_types: [], scalp_types: [], for_beard: false, effects: [], sort: 50, active: true })}
      normalize={(r) => ({ ...r, price: Number(r.price) })}
      columns={[
        { label: 'Nom', render: (p) => <strong>{p.name}</strong> },
        { label: 'Prix', render: (p) => `${Number(p.price).toFixed(2).replace('.', ',')} €` },
        {
          label: 'Étiquettes',
          render: (p) => (
            <span className="text-xs text-cream/70">
              {[...p.hair_types.map((h) => HAIR.find((x) => x.value === h)?.label), ...p.scalp_types.map((h) => SCALP.find((x) => x.value === h)?.label), ...p.effects.map((h) => EFFECTS.find((x) => x.value === h)?.label), p.for_beard ? 'Barbe' : null]
                .filter(Boolean)
                .join(', ')}
            </span>
          ),
        },
        { label: 'Statut', render: (p) => <StatusPill on={p.active} onLabel="Visible" offLabel="Masqué" /> },
      ]}
    />
  );
}

const THEME_LABELS: Record<string, string> = {
  mons: 'Mons et folklore',
  beer: 'Bières belges',
  barber: 'Culture barber',
  music: 'Musique',
  general: 'Culture générale',
  kids: 'Enfants',
};

export function QuizSection() {
  const [theme, setTheme] = useState<string>('all');
  return (
    <CrudSection
      table="quiz_questions"
      title="Questions du quiz"
      filter={(q) => theme === 'all' || q.theme === theme}
      toolbar={
        <select className="min-h-[48px] rounded-xl bg-white/10 px-3 font-bold" value={theme} onChange={(e) => setTheme(e.target.value)}>
          <option value="all">Tous les thèmes</option>
          {QUIZ_THEMES.map((t) => (
            <option key={t} value={t}>
              {THEME_LABELS[t]}
            </option>
          ))}
        </select>
      }
      fields={[
        { key: 'theme', label: 'Thème', type: 'select', options: QUIZ_THEMES.map((t) => ({ value: t, label: THEME_LABELS[t] })), half: true },
        { key: 'active', label: 'Active', type: 'bool', half: true },
        { key: 'question_fr', label: 'Question (FR)', type: 'textarea' },
        { key: 'answers_fr', label: 'Réponses (FR)', type: 'answers', half: true },
        { key: 'answers_en', label: 'Réponses (EN), même ordre', type: 'answers', half: true },
        { key: 'question_en', label: 'Question (EN)', type: 'textarea' },
        { key: 'correct_index', label: 'Numéro de la bonne réponse', type: 'correct', help: 'Les réponses sont mélangées automatiquement pendant le jeu.' },
      ]}
      defaults={() => ({ theme: 'general' as const, question_fr: '', question_en: '', answers_fr: ['', '', '', ''], answers_en: ['', '', '', ''], correct_index: 0, active: true })}
      normalize={(r) => ({
        ...r,
        answers_fr: (r.answers_fr as string[]).map((a) => a.trim()).filter(Boolean),
        answers_en: (r.answers_en as string[]).map((a) => a.trim()).filter(Boolean),
      })}
      columns={[
        { label: 'Thème', render: (q) => THEME_LABELS[q.theme] },
        { label: 'Question', render: (q) => <span>{q.question_fr}</span> },
        { label: 'Bonne réponse', render: (q) => <strong className="text-gold-300">{q.answers_fr[q.correct_index]}</strong> },
        { label: 'Statut', render: (q) => <StatusPill on={q.active} onLabel="Active" offLabel="Inactive" /> },
      ]}
    />
  );
}

export function NewsletterSection() {
  const [list, setList] = useState<Awaited<ReturnType<typeof api.listNewsletter>> | null>(null);
  const load = useCallback(() => void api.listNewsletter().then(setList), []);
  useEffect(() => load(), [load]);
  return (
    <AdminCard
      title={`Newsletter (${list?.length ?? 0})`}
      actions={
        <button
          type="button"
          className="flex min-h-[48px] items-center gap-2 rounded-xl bg-gold px-5 font-black text-bottle-950"
          disabled={!list?.length}
          onClick={() =>
            downloadCsv(
              'newsletter_cutshop.csv',
              toCsv(
                (list ?? []).map((n) => ({ ...n, created_at: fmtDateTime(n.created_at) })),
                [
                  { key: 'email', label: 'Adresse mail' },
                  { key: 'first_name', label: 'Prénom' },
                  { key: 'last_name', label: 'Nom' },
                  { key: 'source', label: 'Origine' },
                  { key: 'created_at', label: 'Date du consentement' },
                ],
              ),
            )
          }
        >
          <Download size={18} /> Export CSV
        </button>
      }
    >
      <p className="mb-4 text-sm text-cream/60">Uniquement les personnes ayant coché la case newsletter. Supprime une adresse dès qu’une désinscription est demandée.</p>
      {!list ? (
        <p>Chargement...</p>
      ) : list.length === 0 ? (
        <p className="text-cream/60">Aucune adresse pour le moment.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <tbody>
            {list.map((n) => (
              <tr key={n.email} className="border-b border-cream/5">
                <td className="px-2 py-2 font-bold">{n.email}</td>
                <td className="px-2 py-2">
                  {n.first_name} {n.last_name}
                </td>
                <td className="px-2 py-2 text-cream/60">{n.source}</td>
                <td className="px-2 py-2 text-cream/60">{fmtDateTime(n.created_at)}</td>
                <td className="px-2 py-2 text-right">
                  <button
                    type="button"
                    className="min-h-[40px] rounded-xl bg-red-900/60 px-3 text-xs font-bold"
                    onClick={async () => {
                      if (!confirm(`Supprimer ${n.email} ?`)) return;
                      await api.deleteNewsletter(n.email);
                      load();
                    }}
                  >
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AdminCard>
  );
}
