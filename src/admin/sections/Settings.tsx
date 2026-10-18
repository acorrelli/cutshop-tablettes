import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/api';
import { TABLET_NAMES } from '../../lib/tablet';
import { MODULE_KEYS, type AppSettings, type ModuleKey } from '../../lib/types';
import { AdminCard, EditDrawer, findDashes, type FieldDef } from '../Crud';

const GROUPS: { title: string; fields: FieldDef[] }[] = [
  {
    title: 'Infos pratiques',
    fields: [
      { key: 'salonkee_url', label: 'Lien de réservation Salonkee', type: 'text' },
      { key: 'instagram_url', label: 'Lien Instagram', type: 'text' },
      { key: 'facebook_url', label: 'Lien Facebook', type: 'text' },
      { key: 'tiktok_url', label: 'Lien TikTok', type: 'text' },
      { key: 'website', label: 'Site web', type: 'text' },
      { key: 'address', label: 'Adresse', type: 'text' },
      { key: 'phone', label: 'Téléphone', type: 'text', half: true },
      { key: 'email', label: 'Adresse mail', type: 'text', half: true },
      { key: 'hours_fr', label: 'Horaires (FR), une ligne par jour', type: 'textarea' },
      { key: 'hours_en', label: 'Horaires (EN)', type: 'textarea' },
    ],
  },
  {
    title: 'Le concept',
    fields: [
      { key: 'concept_title_fr', label: 'Titre (FR)', type: 'text', half: true },
      { key: 'concept_title_en', label: 'Titre (EN)', type: 'text', half: true },
      { key: 'concept_body_fr', label: 'Texte (FR), une ligne vide entre les paragraphes', type: 'textarea' },
      { key: 'concept_body_en', label: 'Texte (EN)', type: 'textarea' },
      { key: 'concept_tagline_fr', label: 'Phrase finale (FR)', type: 'text', half: true },
      { key: 'concept_tagline_en', label: 'Phrase finale (EN)', type: 'text', half: true },
      { key: 'block_barber_fr', label: 'Bloc barbershop (FR)', type: 'textarea', half: true },
      { key: 'block_barber_en', label: 'Bloc barbershop (EN)', type: 'textarea', half: true },
      { key: 'block_bar_fr', label: 'Bloc bar (FR)', type: 'textarea', half: true },
      { key: 'block_bar_en', label: 'Bloc bar (EN)', type: 'textarea', half: true },
      { key: 'block_events_fr', label: 'Bloc événements (FR)', type: 'textarea', half: true },
      { key: 'block_events_en', label: 'Bloc événements (EN)', type: 'textarea', half: true },
      { key: 'concept_photo_hero', label: 'Photo principale (vitrine)', type: 'image' },
      { key: 'concept_photo_1', label: 'Photo du barbershop', type: 'image' },
      { key: 'concept_photo_2', label: 'Photo du bar', type: 'image' },
      { key: 'concept_photo_3', label: 'Photo des événements', type: 'image' },
    ],
  },
  {
    title: 'Chèques cadeaux',
    fields: [
      { key: 'gift_title_fr', label: 'Titre (FR)', type: 'text', half: true },
      { key: 'gift_title_en', label: 'Titre (EN)', type: 'text', half: true },
      { key: 'gift_body_fr', label: 'Texte (FR)', type: 'textarea' },
      { key: 'gift_body_en', label: 'Texte (EN)', type: 'textarea' },
      { key: 'gift_amounts', label: 'Montants proposés, séparés par des virgules', type: 'text' },
      { key: 'gift_validity_fr', label: 'Validité (FR)', type: 'text', half: true },
      { key: 'gift_validity_en', label: 'Validité (EN)', type: 'text', half: true },
      { key: 'gift_conditions_fr', label: 'Conditions (FR)', type: 'textarea', half: true },
      { key: 'gift_conditions_en', label: 'Conditions (EN)', type: 'textarea', half: true },
    ],
  },
  {
    title: 'Factures pros',
    fields: [
      { key: 'invoice_title_fr', label: 'Titre (FR)', type: 'text', half: true },
      { key: 'invoice_title_en', label: 'Titre (EN)', type: 'text', half: true },
      { key: 'invoice_body_fr', label: 'Texte (FR)', type: 'textarea' },
      { key: 'invoice_body_en', label: 'Texte (EN)', type: 'textarea' },
    ],
  },
  {
    title: 'Politique de confidentialité',
    fields: [
      { key: 'privacy_fr', label: 'Texte (FR)', type: 'textarea' },
      { key: 'privacy_en', label: 'Texte (EN)', type: 'textarea' },
    ],
  },
];

const MODULE_LABELS: Record<ModuleKey, string> = {
  concept: 'L’histoire',
  booking: 'Prendre rendez vous',
  services: 'Nos prestations',
  events: 'Les événements',
  battle: 'Le Cutshop Challenge',
  stop10: 'Stop à 10 secondes',
  wheel: 'La roue de la fortune',
  kids: 'Le coin des kids',
  drinks: 'La carte du bar',
  products: 'Les produits faits pour toi',
  gift: 'Carte cadeau',
  invoice: 'Factures pros',
  instagram: 'Nos réseaux',
};

function useSettings() {
  const { reloadContent } = useApp();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  useEffect(() => {
    void api.getSettings().then(setSettings);
  }, []);
  const save = async (next: AppSettings) => {
    await api.saveSettings(next);
    setSettings(next);
    await reloadContent();
  };
  return { settings, save };
}

export function SettingsSection() {
  const { settings, save } = useSettings();
  const { tablet, setTablet } = useApp();
  const [editing, setEditing] = useState<number | null>(null);
  const [pin, setPin] = useState('');
  const [pinMsg, setPinMsg] = useState<string | null>(null);

  useEffect(() => {
    void api.getStaffPin().then(setPin).catch(() => setPin(''));
  }, []);

  if (!settings) return <p>Chargement...</p>;
  const group = editing !== null ? GROUPS[editing] : null;

  return (
    <div className="space-y-6">
      <AdminCard title="Cette tablette">
        <p className="mb-3 text-sm text-cream/60">Nom enregistré sur l’appareil (statistiques et Cutshop Challenge). Actuellement : {tablet ?? 'non défini'}.</p>
        <div className="flex flex-wrap gap-2">
          {TABLET_NAMES.map((n) => (
            <button key={n} type="button" onClick={() => setTablet(n)} className={`min-h-[48px] rounded-xl px-5 font-bold ${tablet === n ? 'bg-gold text-bottle-950' : 'bg-white/10'}`}>
              {n}
            </button>
          ))}
        </div>
      </AdminCard>

      <AdminCard title="Code PIN staff de la roue">
        <p className="mb-3 text-sm text-cream/60">4 à 8 chiffres. À saisir sur la tablette pour offrir un tour de roue. Change le code par défaut dès l’installation.</p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            className="w-48 rounded-xl border-2 border-cream/15 bg-bottle-950/60 px-4 py-3 font-mono text-xl tracking-[0.3em] outline-none focus:border-gold"
            value={pin}
            inputMode="numeric"
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, '').slice(0, 8));
              setPinMsg(null);
            }}
          />
          <button
            type="button"
            className="flex min-h-[48px] items-center gap-2 rounded-xl bg-gold px-5 font-black text-bottle-950 disabled:opacity-40"
            disabled={pin.length < 4}
            onClick={async () => {
              try {
                await api.setStaffPin(pin);
                setPinMsg('Code enregistré.');
              } catch (e) {
                setPinMsg(e instanceof Error ? e.message : String(e));
              }
            }}
          >
            <Save size={18} /> Enregistrer
          </button>
          {pinMsg && <span className="text-sm font-bold text-gold-300">{pinMsg}</span>}
        </div>
      </AdminCard>

      <AdminCard title="Données personnelles (RGPD)">
        <p className="mb-3 text-sm text-cream/60">
          Supprime les inscriptions des événements terminés depuis plus de 3 mois, les demandes de facture traitées depuis plus de 3 mois, les demandes produits de plus de 30 jours et les anciens scores.
        </p>
        <button
          type="button"
          className="min-h-[48px] rounded-xl bg-white/10 px-5 font-bold"
          onClick={async () => {
            if (!confirm('Lancer le nettoyage des anciennes données personnelles ?')) return;
            try {
              const r = await api.purgePersonalData();
              alert(`Nettoyage terminé : ${r.registrations ?? 0} inscriptions, ${r.invoices ?? 0} factures, ${r.product_requests ?? 0} demandes produits supprimées.`);
            } catch (e) {
              alert(e instanceof Error ? e.message : String(e));
            }
          }}
        >
          Nettoyer les anciennes données
        </button>
      </AdminCard>

      <AdminCard title="Textes et informations">
        <div className="grid gap-3 sm:grid-cols-2">
          {GROUPS.map((g, i) => {
            const issues = findDashes(settings as unknown as Record<string, unknown>, g.fields);
            return (
              <button key={g.title} type="button" onClick={() => setEditing(i)} className="rounded-2xl bg-white/[0.06] p-4 text-left hover:bg-white/10" data-testid={`settings-group-${i}`}>
                <span className="block text-lg font-black">{g.title}</span>
                <span className="text-sm text-cream/60">{g.fields.length} champs à modifier</span>
                {issues.length > 0 && <span className="mt-1 block text-xs font-bold text-gold-300">Tiret détecté : {issues.join(', ')}</span>}
              </button>
            );
          })}
        </div>
      </AdminCard>

      {group && (
        <EditDrawer
          title={group.title}
          fields={group.fields}
          row={settings as unknown as Record<string, unknown>}
          onCancel={() => setEditing(null)}
          onSave={async (row) => {
            await save({ ...(row as unknown as AppSettings), modules: settings.modules });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

export function ModulesSection() {
  const { settings, save } = useSettings();
  const [saving, setSaving] = useState<ModuleKey | null>(null);
  if (!settings) return <p>Chargement...</p>;
  return (
    <AdminCard title="Tuiles de l’accueil">
      <p className="mb-4 text-sm text-cream/60">Active ou désactive chaque module sur toutes les tablettes. La roue de la fortune n’apparaît que si elle est activée ici.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MODULE_KEYS.map((k) => {
          const on = settings.modules[k];
          return (
            <button
              key={k}
              type="button"
              disabled={saving !== null}
              onClick={async () => {
                setSaving(k);
                try {
                  await save({ ...settings, modules: { ...settings.modules, [k]: !on } });
                } finally {
                  setSaving(null);
                }
              }}
              className={`flex min-h-[64px] items-center justify-between rounded-2xl px-5 text-left font-bold transition ${on ? 'bg-gold/20 ring-2 ring-gold' : 'bg-white/[0.06]'}`}
              data-testid={`module-${k}`}
            >
              <span>{MODULE_LABELS[k]}</span>
              <span className={`relative h-8 w-14 rounded-full transition ${on ? 'bg-gold' : 'bg-white/20'}`}>
                <span className={`absolute top-1 h-6 w-6 rounded-full bg-cream transition-all ${on ? 'left-7' : 'left-1'}`} />
              </span>
            </button>
          );
        })}
      </div>
    </AdminCard>
  );
}
