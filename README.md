# Cutshop Mons : application des tablettes

Application web installée sur les 4 tablettes Android de l'espace d'attente du Cutshop (barbershop, bar à bières belges et lieu de vie au coeur de Mons). Elle divertit les clients qui attendent, fait découvrir le concept, inscrit aux événements, augmente le panier moyen et fait grandir la communauté.

**Technique** : React, Vite, TypeScript, Tailwind CSS, HashRouter, i18next (FR et EN), Supabase (Postgres, Auth, Realtime, Storage), PWA hors ligne, déploiement GitHub Pages par GitHub Actions.

## Sommaire

1. Ce que fait l'application
2. Créer le projet Supabase
3. Ajouter les secrets GitHub et activer GitHub Pages
4. Premier déploiement
5. Créer le compte admin
6. Configurer les 4 tablettes (Fully Kiosk Browser)
7. Modifier les contenus
8. Développement local et tests
9. Sécurité, RGPD et fonctionnement hors ligne
10. Structure du dépôt

## 1. Ce que fait l'application

L'accueil regroupe les modules en quatre catégories (Les jeux, Boissons et produits, Le concept Cutshop, Nos réseaux) plus deux accès directs (Prendre rendez vous, Factures pros).

| Module | Contenu |
| --- | --- |
| Le concept | Texte éditorial, 3 blocs visuels, infos pratiques (modifiables) |
| Prendre rendez vous | Grand QR code vers Salonkee, aucune donnée saisie sur la tablette |
| Les événements | Cartes triées par date, places restantes, inscription avec consentement RGPD, newsletter facultative, blocage quand c'est complet |
| La Battle | Quiz multijoueur en temps réel entre les 4 tablettes (2 à 4 joueurs), 10 questions de 15 secondes, classement animé, podium, solo contre le chrono si personne ne rejoint |
| Stop à 10 secondes | Chrono au centième, caché après 3 secondes, classement du jour remis à zéro chaque nuit |
| La roue de la fortune | Visible seulement si l'équipe l'active, tirage pondéré côté serveur, code gagnant unique de 6 caractères |
| Le coin des kids | Le Petit Barbier (tondeuse, ciseaux, peigne, couleurs, repousse) et Memory sur 3 niveaux |
| Bières et softs | Carte par catégories et « Ta coupe, ta bière » |
| Les produits faits pour toi | Questionnaire en 4 questions, 2 à 4 produits proposés, envoi de la sélection au coiffeur |
| Chèques cadeaux | Page informative et bouton « Je demande à l'accueil » |
| Factures pros | Formulaire avec validation du numéro de TVA (belge avec clé de contrôle, et formats européens) |
| Nos réseaux | QR codes Instagram, Facebook et TikTok |

Fonctionnement commun : bouton FR / EN et bouton grand texte toujours visibles, retour accueil en un geste, écran de veille animé après 60 secondes d'inactivité avec effacement de toutes les saisies, invitation à la Battle affichée sur toutes les tablettes, appui long de 5 secondes sur le logo pour ouvrir l'admin.

**Mode démonstration** : sans clés Supabase, l'application démarre avec les données d'exemple stockées dans le navigateur (mot de passe admin « demo »). La Battle fonctionne alors entre plusieurs onglets d'un même navigateur. C'est pratique pour découvrir l'application avant de brancher Supabase.

## 2. Créer le projet Supabase

1. Crée un compte sur [supabase.com](https://supabase.com) puis un nouveau projet. Choisis une région européenne (par exemple Frankfurt ou Paris) et note bien le mot de passe de la base.
2. Ouvre **SQL Editor**, clique sur **New query**, colle tout le contenu de `supabase/migrations/20261015000001_init.sql` et clique sur **Run**. Le schéma complet est créé : tables, index, politiques RLS, fonctions serveur (inscriptions, roue, validation des codes, purge RGPD) et le bucket de photos `media`.
3. Nouvelle requête : colle le contenu de `supabase/seed.sql` et clique sur **Run**. Les données d'exemple sont chargées : réglages, événements récurrents (dates calculées à partir du jour d'exécution), boissons, accords « Ta coupe, ta bière », produits, gains de la roue et 90 questions de quiz en FR et EN. Ce fichier ne doit être exécuté qu'une seule fois.
4. Dans **Authentication**, section des fournisseurs de connexion, garde le fournisseur **Email** actif mais **désactive l'inscription libre** (option « Allow new users to sign up »). Seule l'équipe aura un compte.
5. Dans les réglages **Realtime**, laisse l'accès aux canaux publics autorisé (l'option « canaux privés uniquement » doit rester désactivée) : la Battle utilise un canal public de présence et de diffusion, sans aucune donnée personnelle.
6. Dans **Project Settings**, rubrique **API** (ou **Data API**), copie :
   * l'URL du projet (`https://xxxx.supabase.co`) ;
   * la clé publique **anon** (ou la clé « publishable » sur les projets récents).

   Ne copie jamais la clé `service_role` dans l'application.

Avec la ligne de commande Supabase, les étapes 2 et 3 se font aussi par `supabase link` puis `supabase db push` et l'exécution de `supabase/seed.sql`.

## 3. Ajouter les secrets GitHub et activer GitHub Pages

1. Pousse ce dépôt sur GitHub (branche `main`).
2. Dans le dépôt : **Settings**, puis **Secrets and variables**, puis **Actions**, bouton **New repository secret**. Crée deux secrets :
   * `VITE_SUPABASE_URL` : l'URL du projet Supabase ;
   * `VITE_SUPABASE_ANON_KEY` : la clé publique anon.
3. Dans **Settings**, puis **Pages**, choisis **Source : GitHub Actions**.
4. Facultatif : si tu publies sur un domaine personnalisé ou sur `ton-compte.github.io` directement, crée une variable de dépôt (onglet **Variables**) nommée `BASE_PATH` avec la valeur `/`. Sinon, l'application est publiée sous `/nom-du-depot/` automatiquement.

## 4. Premier déploiement

1. Fais un push sur `main` (ou lance le workflow « Deploiement GitHub Pages » à la main dans l'onglet **Actions**).
2. Le workflow installe les dépendances, lance les tests unitaires, construit l'application avec les secrets et la publie. Si les secrets sont absents, il le signale par un avertissement et publie la version de démonstration.
3. L'adresse s'affiche à la fin du job `deploy`, par exemple `https://ton-compte.github.io/cutshop-tablettes/`.

## 5. Créer le compte admin

1. Dans Supabase : **Authentication**, puis **Users**, bouton **Add user**, puis **Create new user**. Saisis l'adresse mail et un mot de passe solide, coche la confirmation automatique.
2. Dans **SQL Editor**, donne les droits admin à ce compte :

   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'ton.adresse@exemple.be';
   ```

3. Sur une tablette ou un ordinateur, ouvre l'application, fais un **appui long de 5 secondes sur le logo** (ou ajoute `#/admin` à l'adresse) et connecte toi.
4. **Première chose à faire** : dans **Réglages**, change le code PIN staff de la roue (par défaut `2468`).

Tu peux répéter les étapes 1 et 2 pour chaque membre de l'équipe. L'admin se déconnecte tout seul après 3 minutes d'inactivité.

## 6. Configurer les 4 tablettes (Fully Kiosk Browser)

Fully Kiosk Browser transforme chaque tablette en borne : plein écran, navigation verrouillée, écran allumé et relance automatique. Le verrouillage complet (mode kiosque) nécessite la licence **Fully Plus**, à acheter une fois par tablette.

### Préparer la tablette Android

1. Connecte la tablette au wifi du salon et fais les mises à jour Android.
2. Dans les paramètres Android, rubrique batterie : désactive l'optimisation de la batterie pour Fully Kiosk Browser.
3. Règle la mise en veille de l'écran Android sur la durée maximale (Fully gardera l'écran allumé).
4. Installe **Fully Kiosk Browser** depuis le Play Store, ouvre le et accepte les autorisations demandées.

### Réglages Fully, tablette par tablette

Ouvre le menu de Fully (glisser depuis le bord gauche de l'écran), puis **Settings**.

1. **Web Content Settings**, **Start URL** : l'adresse de l'application suivie du nom de la tablette, par exemple
   `https://ton-compte.github.io/cutshop-tablettes/?tablet=Tablette%201`
   (remplace `1` par `2`, `3` ou `4` sur les autres tablettes). Le nom est aussi modifiable ensuite dans l'admin.
2. **Web Browsing Settings** : désactive « Enable Pull to Refresh » et « Enable Back Button », active **Enable URL Whitelist** avec ces deux lignes :
   `*ton-compte.github.io*`
   `*supabase.co*`
   Le client ne peut plus quitter l'application.
3. **Fullscreen Mode** : active le plein écran, masque la barre d'état et la barre de navigation, masque la barre d'adresse et la barre d'actions.
4. **Advanced Web Settings** : active « Autoplay Audio » (sons de la roue) et désactive le zoom (« Enable Zoom » à non).
5. **Device Management** : active **Keep Screen On**, **Launch on Boot** et **Unlock Screen**. Choisis l'orientation **Paysage** (Screen Orientation).
6. **Power Settings** (heures d'ouverture) : programme le réveil de l'écran un peu avant l'ouverture et l'extinction après la fermeture (Scheduled Wakeup et Scheduled Sleep). Si l'option n'est pas disponible sur ton modèle, laisse Keep Screen On actif.
7. **Web Auto Reload** : active **Auto Reload after Page Error** et **Auto Reload on Network Reconnect**. Active aussi **Auto Reload on Screen On**.
8. **Other Settings** (ou **Advanced**) : active **Restart on Crash** pour relancer Fully automatiquement en cas de plantage.
9. **Kiosk Mode (Plus)** : active **Enable Kiosk Mode**, définis un **Kiosk Exit PIN** connu de l'équipe uniquement, désactive la barre d'état, le bouton d'alimentation et les boutons de volume si ton modèle le permet. Le geste de sortie (par défaut glisser depuis la gauche puis saisir le PIN) permet à l'équipe de revenir aux réglages.
10. Redémarre la tablette : Fully se lance seul et ouvre l'application.

L'application a sa propre mise en veille (60 secondes) : laisse le « Screensaver » de Fully désactivé.

### Vérifications après installation

1. L'écran d'accueil s'affiche avec 11 tuiles (12 si la roue est activée).
2. Lance une Battle sur la Tablette 1 : l'invitation doit apparaître sur les trois autres tablettes en moins d'une seconde.
3. Inscris toi à un événement de test puis vérifie l'inscription dans l'admin, rubrique Événements, bouton Inscrits.

## 7. Modifier les contenus

Tout se fait dans l'admin (appui long de 5 secondes sur le logo) :

| Rubrique | Ce que tu y fais |
| --- | --- |
| Demandes produits | Sélections envoyées par les clients pour leur coiffeur, appels à l'accueil (chèques cadeaux), statut nouvelle ou traitée |
| Demandes de factures | Coordonnées de facturation, statut nouvelle ou traitée |
| Événements | Créer, modifier, dupliquer une semaine plus tard, supprimer, gérer la capacité, voir et exporter les inscrits en CSV |
| Roue | Valider un code gagnant au comptoir, gérer les gains (libellés FR et EN, probabilité, stock, case « Pas de chance »), historique des tours |
| Newsletter | Adresses ayant consenti, export CSV, suppression sur demande |
| Quiz | Questions FR et EN par thème, bonne réponse, activation |
| Boissons | Carte du bar et accords « Ta coupe, ta bière » |
| Produits | Catalogue et étiquettes de correspondance (types de cheveux, cuir chevelu, barbe, effets) |
| Modules | Afficher ou masquer chaque tuile, dont la roue de la fortune |
| Réglages | Nom de la tablette, code PIN staff, lien Salonkee, adresse, horaires, contact, textes du concept, chèques cadeaux, factures pros, politique de confidentialité, photos, nettoyage RGPD |
| Statistiques | Parties jouées, inscriptions par événement, tours de roue et demandes produits, par jour et par tablette |

**Règle de rédaction** : aucun tiret dans les textes affichés. L'admin le rappelle quand un tiret est détecté. Pour une valeur approximative, écris `+/` (exemple : `+/ 30 minutes`).

**Photos livrées avec l'application** : dépose les photos dans `src/assets/photos/` avec les noms indiqués dans `src/assets/photos/LISEZMOI.md` (vitrine-cutshop, le-barbershop, le-bar, les-events, cut-and-talk-carre-5, open-mic-carre-1, cutsession-carre-5, chut-carre-5), puis relance le build. Elles s'affichent automatiquement aux bons emplacements.

**Photos ajoutées depuis l'admin** : chaque champ image accepte une adresse web ou un envoi direct (bouton Envoyer), stocké dans Supabase Storage. Sans photo, un visuel aux couleurs du Cutshop s'affiche.

**Logo** : dépose ton logo à la place de `public/logo_cutshop.png` (PNG noir sur fond transparent, format carré conseillé). Le fichier fourni est un emplacement provisoire. Pour régénérer les icônes d'installation à partir du nouveau logo : `node scripts/make-assets.mjs --icons-only`.

**Données d'exemple** : les valeurs marquées « exemple » (adresse, horaires, téléphone, montants des chèques, boissons, produits) sont à remplacer dans l'admin.

## 8. Développement local et tests

```bash
npm install
npm run dev            # mode démonstration si aucune clé Supabase
cp .env.example .env.local   # puis renseigne l'URL et la clé anon pour travailler sur Supabase
```

Astuce : pour simuler plusieurs tablettes, ouvre plusieurs onglets avec `?tablet=Tablette%202`, `?tablet=Tablette%203`...

| Commande | Rôle |
| --- | --- |
| `npm test` | Tests unitaires : tirage pondéré de la roue, score de la Battle, chrono Stop à 10 secondes, remise à zéro après inactivité, moteur multijoueur simulé à 4 joueurs avec déconnexion, TVA, sélection produits, absence de tirets dans tous les textes |
| `npm run test:db` | Lance un Postgres temporaire, applique la migration et les données d'exemple, puis vérifie les politiques RLS, les inscriptions avec capacité, le PIN, le tirage de la roue sur 3000 tours, les stocks, la validation des codes et la purge RGPD |
| `npm run test:e2e` | Tests de bout en bout dans Chromium sur le build : chaque module en FR et EN, formulaires, veille, admin, roue, kids et Battle à 4 onglets (lancer `npm run build` avant) |
| `npm run seed` | Régénère `supabase/seed.sql` depuis `src/data/seed.ts` |

## 9. Sécurité, RGPD et fonctionnement hors ligne

* **Clé anon uniquement sur les tablettes** : elles lisent les contenus publics et insèrent inscriptions et demandes. Les politiques RLS empêchent toute lecture des données personnelles. Seuls les comptes listés dans la table `admins` les lisent.
* **Inscriptions** : fonction serveur `register_event` qui contrôle le consentement, le format du mail et la capacité (verrou sur l'événement : deux tablettes ne peuvent pas prendre la dernière place en même temps).
* **Roue** : tirage pondéré et génération du code dans la fonction Postgres `spin_wheel`. Le PIN staff n'est jamais lisible par les tablettes, 8 essais ratés en 10 minutes bloquent la roue, les tours offerts (Battle, 10,00 s pile) sont limités à un toutes les 2 minutes par tablette. Un code validé au comptoir devient inutilisable.
* **Aucune donnée personnelle sur les tablettes** : rien n'est écrit dans le stockage local (seul le nom de la tablette l'est), les formulaires sont vidés après envoi et à chaque mise en veille, la session admin reste en mémoire.
* **Consentements** clairs en FR et EN, lien vers la politique de confidentialité intégrée (modifiable dans Réglages).
* **Durées de conservation** : le bouton « Nettoyer les anciennes données » (Réglages) supprime les inscriptions 3 mois après l'événement, les demandes de facture traitées depuis 3 mois et les demandes produits de plus de 30 jours. Pour l'automatiser chaque nuit, active l'extension `pg_cron` dans Supabase (Database, Extensions) puis exécute :

  ```sql
  select cron.schedule('purge-rgpd', '30 3 * * *', 'select public.purge_personal_data()');
  ```

* **Coupure wifi courte** : l'application et les contenus sont en cache (service worker). Une inscription ou une demande envoyée sans réseau est gardée en mémoire et renvoyée automatiquement au retour du wifi ; un badge « Hors ligne » l'indique.

## 10. Structure du dépôt

```
.github/workflows/deploy.yml   Build et publication GitHub Pages
public/                        Logo (emplacement provisoire), icônes PWA
scripts/                       Génération du seed SQL, des icônes, tests base de données
src/admin/                     Espace admin (CRUD, inscrits, roue, demandes, statistiques)
src/components/                Barre du haut, logo, QR code, roue SVG, éléments d'interface
src/context/                   État de l'application (veille, langue, contenus) et Battle
src/data/seed.ts               Données d'exemple (source unique, 90 questions FR et EN)
src/i18n/                      Traductions fr.json et en.json
src/lib/                       Logique métier testée (roue, Battle, chrono, veille, TVA, produits)
src/lib/api/                   Accès aux données : Supabase ou mode démonstration
src/lib/realtime/              Canal temps réel et moteur multijoueur de la Battle
src/pages/                     Écrans clients
supabase/migrations/           Schéma complet, RLS et fonctions serveur
supabase/seed.sql              Données d'exemple
supabase/tests/                Tests SQL
tests/e2e/                     Tests de bout en bout Playwright
```
