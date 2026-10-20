# Cutshop Mons : application des tablettes

Application web installée sur les 4 tablettes Android de l'espace d'attente du Cutshop (barbershop, bar à bières belges et lieu de vie au coeur de Mons). Elle divertit les clients qui attendent, fait découvrir le concept, inscrit aux événements, augmente le panier moyen et fait grandir la communauté.

**Technique** : React, Vite, TypeScript, Tailwind CSS, HashRouter, i18next (FR et EN), Supabase (Postgres, Auth, Realtime, Storage), PWA hors ligne, déploiement GitHub Pages par GitHub Actions.

## Sommaire

1. Ce que fait l'application
2. Créer le projet Supabase
3. Relier l'application au projet Supabase et activer GitHub Pages
4. Premier déploiement
5. Créer le compte admin
6. Configurer les 4 tablettes (Fully Kiosk Browser)
6 bis. Le Chromebook de l'équipe (admin)
7. Modifier les contenus
8. Développement local et tests
9. Sécurité, RGPD et fonctionnement hors ligne
10. Structure du dépôt
11. Cutshop Arcade et Cutshop Challenge

## 1. Ce que fait l'application

L'accueil présente quatre grands menus (Le concept Cutshop, Boissons et produits, Nos services, Les jeux), puis un bandeau « Suis nous sur nos réseaux sociaux » avec Instagram, Facebook et TikTok.

| Module | Contenu |
| --- | --- |
| Le concept | Texte éditorial, 3 blocs visuels, infos pratiques (modifiables) |
| Nos prestations | Coupes, coupe et barbe, soins et services, enfants : durée, description, prix classique et prix étudiant côte à côte, bouton « Réserver » qui affiche le QR code Salonkee |
| Prendre rendez vous | Grand QR code vers Salonkee, aucune donnée saisie sur la tablette |
| Les événements | Cartes triées par date, places restantes, inscription avec consentement RGPD, newsletter facultative, blocage quand c'est complet |
| Cutshop Arcade | 4 mini jeux exclusifs (Barber Rush, Perfect Pour, Beat Drop, Find It Cutshop) en solo, en duel ou en battle entre tables, avec la plateforme Cutshop Challenge : classements, revanches et challenge de la semaine (voir la partie 11) |
| Le Quiz Cutshop | Quiz multijoueur en temps réel entre les 4 tablettes (2 à 4 joueurs), 10 questions de 15 secondes, classement animé, podium, solo contre le chrono si personne ne rejoint |
| Stop à 10 secondes | Chrono au centième, caché après 3 secondes, classement du jour remis à zéro chaque nuit |
| La roue de la fortune | Visible seulement si l'équipe l'active, tirage pondéré côté serveur, code gagnant unique de 6 caractères |
| Le coin des kids | Le Petit Barbier (tondeuse, ciseaux, peigne, couleurs, repousse) et Memory sur 3 niveaux |
| Bières et softs | Carte par catégories et « Ta coupe, ta bière » |
| Les produits faits pour toi | Questionnaire en 4 questions, 2 à 4 produits proposés, envoi de la sélection au coiffeur |
| Chèques cadeaux | Page informative et bouton « Je demande à l'accueil » |
| Factures pros | Formulaire avec validation du numéro de TVA (belge avec clé de contrôle, et formats européens) |
| Nos réseaux | QR codes Instagram, Facebook et TikTok |

Fonctionnement commun : bouton FR / EN et bouton grand texte toujours visibles, retour accueil en un geste, écran de veille animé après 60 secondes d'inactivité avec effacement de toutes les saisies, invitation à le Quiz Cutshop affichée sur toutes les tablettes, appui long de 5 secondes sur le logo pour ouvrir l'admin.

**Mode démonstration** : sans clés Supabase, l'application démarre avec les données d'exemple stockées dans le navigateur (mot de passe admin « demo »). Le Quiz Cutshop fonctionne alors entre plusieurs onglets d'un même navigateur. C'est pratique pour découvrir l'application avant de brancher Supabase.

## 2. Créer le projet Supabase

1. Crée un compte sur [supabase.com](https://supabase.com) puis un nouveau projet. Choisis une région européenne (par exemple Frankfurt ou Paris) et note bien le mot de passe de la base.
2. Ouvre **SQL Editor**, clique sur **New query**, colle **tout** le contenu du fichier `supabase/installation_complete.sql` et clique sur **Run**. Ce fichier unique contient, dans l'ordre, toutes les migrations (schéma, politiques RLS, fonctions serveur, bucket de photos `media`, prestations, serveur de Cutshop Arcade) puis les données d'exemple (réglages, événements, boissons, prestations, 32 produits, gains de la roue et 690 questions de quiz en FR et EN, 115 par thème). Il ne doit être exécuté qu'**une seule fois**, sur un projet neuf. Il se régénère avec `npm run sql:setup`.
3. Vérifie dans **Table Editor** que les tables `settings`, `events`, `drinks`, `products` et `arcade_rooms` existent.
4. Dans **Authentication**, section des fournisseurs de connexion, garde le fournisseur **Email** actif mais **désactive l'inscription libre** (option « Allow new users to sign up »). Seule l'équipe aura un compte.
5. Dans les réglages **Realtime**, laisse l'accès aux canaux publics autorisé (l'option « canaux privés uniquement » doit rester désactivée) : le Quiz Cutshop utilise un canal public de présence et de diffusion, sans aucune donnée personnelle.
6. Dans **Project Settings**, rubrique **API** (ou **Data API**), copie :
   * l'URL du projet (`https://xxxx.supabase.co`) ;
   * la clé publique **anon** (ou la clé « publishable » sur les projets récents).

   Ne copie jamais la clé `service_role` dans l'application.

Avec la ligne de commande Supabase, les étapes 2 et 3 se font aussi par `supabase link` puis `supabase db push` et l'exécution de `supabase/seed.sql`.

**Base déjà installée et nouvelles questions de quiz** : colle le contenu de `supabase/ajout_questions_quiz.sql` dans **SQL Editor** et clique sur **Run**. Seules les questions absentes sont ajoutées, tes modifications faites dans l'admin sont conservées, et le fichier peut être relancé sans risque. Le tableau affiché à la fin donne le nombre de questions par thème.

## 3. Relier l'application au projet Supabase et activer GitHub Pages

1. L'URL du projet et sa clé publique sont dans le fichier `.env.supabase` (projet `qttnbbkagzmmafrifmgp`). Ces deux valeurs sont publiques par nature : aucun secret GitHub n'est nécessaire. Si le projet change, il suffit de modifier ce fichier.
2. Pousse ce dépôt sur GitHub (branche `main`). Le dépôt doit être **public** pour bénéficier de GitHub Pages gratuitement ; aucune donnée sensible n'y figure.
3. Dans **Settings**, puis **Pages**, choisis **Source : GitHub Actions**.
4. Facultatif : si tu publies sur un domaine personnalisé ou sur `ton-compte.github.io` directement, crée une variable de dépôt (onglet **Variables**) nommée `BASE_PATH` avec la valeur `/`. Sinon, l'application est publiée sous `/nom-du-depot/` automatiquement.

## 4. Premier déploiement

1. Fais un push sur `main` (ou lance le workflow « Deploiement GitHub Pages » à la main dans l'onglet **Actions**).
2. Le workflow installe les dépendances, lance les tests unitaires, construit l'application reliée à Supabase (`npm run build:prod`) et la publie.
3. L'adresse s'affiche à la fin du job `deploy`, par exemple `https://ton-compte.github.io/cutshop-tablettes/`.

## 5. Créer le compte admin

1. Dans Supabase : **Authentication**, puis **Users**, bouton **Add user**, puis **Create new user**. Saisis l'adresse mail et un mot de passe solide, coche la confirmation automatique.
2. Dans **SQL Editor**, donne les droits admin à ce compte :

   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'ton.adresse@exemple.be';
   ```

3. Ouvre l'application sur le Chromebook de l'équipe (voir la partie 6 bis) ou sur une tablette (**appui long de 5 secondes sur le logo**, ou `#/admin` à la fin de l'adresse) et connecte toi.
4. **Première chose à faire** : dans **Réglages**, change le code PIN staff de la roue (par défaut `2468`).

Tu peux répéter les étapes 1 et 2 pour chaque membre de l'équipe. Sur une tablette cliente, l'admin se ferme tout seul après 3 minutes d'inactivité et rend l'écran aux clients. Sur le Chromebook de l'équipe, il n'y a ni veille ni déconnexion automatique : la session reste ouverte, même après la mise en veille du Chromebook, jusqu'au bouton Déconnexion.

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

1. L'écran d'accueil affiche les 4 menus (Le concept Cutshop, Boissons et produits, Nos services, Les jeux) et le bandeau des réseaux sociaux.
2. Lance un Quiz Cutshop sur la Tablette 1 : l'invitation doit apparaître sur les trois autres tablettes en moins d'une seconde.
3. Inscris toi à un événement de test puis vérifie l'inscription dans l'admin, rubrique Événements, bouton Inscrits.
4. Depuis la Tablette 1, ouvre Les jeux, Cutshop Arcade, Cutshop Challenge et défie la table 2 : l'invitation doit apparaître sur la Tablette 2 en quelques secondes.

### Associer chaque tablette à sa table (Cutshop Arcade)

Pour les défis entre tables, chaque tablette doit être associée une fois à sa table. Sur la tablette elle même : appui long de 5 secondes sur le logo, connexion admin, rubrique **Arcade**, carte **Tables**, bouton **Associer à la table 1** (2, 3 ou 4 selon la tablette), puis **Déconnexion**. L'association est enregistrée côté serveur avec un jeton propre à l'appareil : un client ne peut pas changer de table.

## 6 bis. Le Chromebook de l'équipe (admin)

L'admin ne s'installe pas sur les tablettes clientes : il s'utilise depuis le Chromebook du comptoir.

1. Ouvre Chrome et va sur l'adresse de l'application suivie de `#/admin`, par exemple `https://ton-compte.github.io/cutshop-tablettes/#/admin`.
2. Menu de Chrome (trois points), **Caster, enregistrer et partager**, **Créer un raccourci**, coche **Ouvrir dans une fenêtre**, nomme le « Admin Cutshop ». Le raccourci apparaît dans le lanceur et peut être épinglé à l'étagère.
3. Connecte toi avec le compte créé à l'étape 5. La session reste ouverte en permanence sur le Chromebook (pas de veille, pas de déconnexion automatique). Utilise le bouton **Déconnexion** si quelqu'un d'extérieur à l'équipe doit utiliser le Chromebook, et verrouille la session Chromebook elle-même avec ton mot de passe Google.
4. Ne donne jamais de nom de tablette au Chromebook : il ne fait pas partie des 4 tablettes clientes.

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
| Prestations | Services du salon : catégorie, durée, prix, prix étudiant, shampoing inclus ou non, descriptions FR et EN |
| Boissons | Carte du bar et accords « Ta coupe, ta bière » |
| Produits | Catalogue et étiquettes de correspondance (types de cheveux, cuir chevelu, barbe, effets) |
| Arcade | Jeux actifs, expiration et limite des invitations, délai de mise en veille, association des tablettes aux tables, challenge de la semaine, modération des scores et des pseudos, remise à zéro, parties récentes, statistiques anonymisées |
| Modules | Afficher ou masquer chaque tuile, dont la roue de la fortune |
| Réglages | Nom de la tablette, code PIN staff, lien Salonkee, adresse, horaires, contact, textes du concept, chèques cadeaux, factures pros, politique de confidentialité, photos, nettoyage RGPD |
| Statistiques | Parties jouées, inscriptions par événement, tours de roue et demandes produits, par jour et par tablette |

**Règle de rédaction** : aucun tiret isolé dans les textes affichés. Le trait d'union reste de mise dans les mots composés et les inversions (rendez-vous, as-tu, suis-nous, demande-nous). L'admin le rappelle quand un tiret isolé est détecté. Pour une valeur approximative, écris `+/` (exemple : `+/ 30 minutes`).

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
| `npm test` | Tests unitaires : tirage pondéré de la roue, score du Quiz Cutshop, chrono Stop à 10 secondes, remise à zéro après inactivité, moteur multijoueur simulé à 4 joueurs avec déconnexion, TVA, sélection produits, absence de tirets isolés dans tous les textes |
| `npm run test:db` | Lance un Postgres temporaire, applique la migration et les données d'exemple, puis vérifie les politiques RLS, les inscriptions avec capacité, le PIN, le tirage de la roue sur 3000 tours, les stocks, la validation des codes et la purge RGPD |
| `npm run test:e2e` | Tests de bout en bout dans Chromium sur le build : chaque module en FR et EN, formulaires, veille, admin, roue, kids et Quiz Cutshop à 4 onglets (lancer `npm run build` avant) |
| `npm run seed` | Régénère `supabase/seed.sql` depuis `src/data/seed.ts` |
| `npm run sql:setup` | Régénère `supabase/installation_complete.sql` (migrations et données d'exemple en un seul fichier) |
| `npm run build:prod` | Construit la version reliée au projet Supabase (`.env.supabase`) ; `npm run build` reste en mode démonstration pour les tests |

## 9. Sécurité, RGPD et fonctionnement hors ligne

* **Clé anon uniquement sur les tablettes** : elles lisent les contenus publics et insèrent inscriptions et demandes. Les politiques RLS empêchent toute lecture des données personnelles. Seuls les comptes listés dans la table `admins` les lisent.
* **Inscriptions** : fonction serveur `register_event` qui contrôle le consentement, le format du mail et la capacité (verrou sur l'événement : deux tablettes ne peuvent pas prendre la dernière place en même temps).
* **Roue** : tirage pondéré et génération du code dans la fonction Postgres `spin_wheel`. Le PIN staff n'est jamais lisible par les tablettes, 8 essais ratés en 10 minutes bloquent la roue, les tours offerts (Quiz Cutshop, 10,00 s pile) sont limités à un toutes les 2 minutes par tablette. Un code validé au comptoir devient inutilisable.
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
src/context/                   État de l'application (veille, langue, contenus) et Quiz Cutshop
src/data/seed.ts               Données d'exemple (source unique, quiz dans src/data/quiz)
src/i18n/                      Traductions fr.json et en.json
src/lib/                       Logique métier testée (roue, Quiz Cutshop, chrono, veille, TVA, produits)
src/lib/api/                   Accès aux données : Supabase ou mode démonstration
src/lib/realtime/              Canal temps réel et moteur multijoueur de le Quiz Cutshop
src/pages/                     Écrans clients
supabase/migrations/           Schéma complet, RLS et fonctions serveur
supabase/seed.sql              Données d'exemple
supabase/tests/                Tests SQL
tests/e2e/                     Tests de bout en bout Playwright
```

## 11. Cutshop Arcade et Cutshop Challenge

### Les jeux

| Jeu | Durée | Principe | Barème |
| --- | --- | --- | --- |
| Barber Rush | 90 s | Choisir le bon outil et réaliser le geste demandé sur chaque client | 100 par client, bonus de précision et de vitesse jusqu'à +50 chacun, x2 après 3 réussites, mauvais outil ou client parti : points en moins |
| Perfect Pour | 60 s | Maintenir pour tirer la bière, relâcher juste au dessus de la zone parfaite (la mousse retombe) | Parfait 200, très bien 150, pas mal 75, bonus de série jusqu'à +100 |
| Beat Drop | 72 s | 4 couloirs, notes simples et longues sur 3 musiques originales générées dans le code (EASY, MEDIUM, HARD) | PERFECT ±60 ms, GOOD ±120 ms, multiplicateur de combo jusqu'à x4 |
| Find It Cutshop | 90 s | Retrouver 5 objets par scène dans 4 décors du Cutshop. Mode course au score ou chasse compétitive (objets partagés) | 100 par objet, bonus de vitesse jusqu'à +50, scène sans erreur +200, erreur −10 |

Toutes les tablettes d'une même partie reçoivent la même graine : mêmes verres, mêmes clients, mêmes notes, mêmes objets.

### Architecture

* `src/arcade/registry.ts` décrit chaque jeu (durée, variantes, score maximal, score de référence). Ajouter un jeu revient à ajouter une entrée, un moteur et un composant dans `src/arcade/games/<jeu>/`.
* Chaque jeu sépare un **moteur pur** (`engine.ts`, sans affichage, testé) et un **composant** qui reçoit le contrat commun `GameProps` (`src/arcade/games/types.ts`) : graine, variante, horloge du serveur, heure de départ, durée, son, langue, score en direct et fin de partie.
* `src/arcade/server/logic.ts` contient les **règles officielles** sous forme de fonctions pures. Le serveur de démonstration les exécute dans le navigateur (plusieurs onglets, verrou Web Locks). Le serveur Supabase applique exactement les mêmes règles en SQL (`supabase/migrations/20261018000002_arcade.sql`, fonctions `arcade_*` en SECURITY DEFINER, tables fermées aux tablettes). Toute évolution des règles se fait des deux côtés.
* `src/arcade/ArcadeContext.tsx` gère l'identité de la table, l'horloge synchronisée sur le serveur (décalage mesuré à chaque échange), l'état partagé (tables, invitations, partie), le pseudo et le son de la session.

### Protocole (version 1, constante `ARCADE_PROTOCOL`)

La tablette envoie toutes les 2 secondes un signe de vie (`arcade_snapshot`) et reçoit l'état complet : tables (disponible, invitée, en attente, prête, en partie, hors ligne), invitations reçues et partie en cours. Un signal Realtime (`cutshop-arcade`) déclenche une mise à jour immédiate quand une autre table agit. Les scores en direct des adversaires passent par un second canal (`cutshop-arcade-live`) et ne servent qu'à l'affichage.

| Action | Fonction | Règles appliquées par le serveur |
| --- | --- | --- |
| Défier | `arcade_create_room` | 1 table : duel, 2 ou 3 tables : battle. Tables invitées en ligne et libres, une seule partie par tablette, limite d'invitations sur 2 minutes |
| Répondre | `arcade_respond` | Invitation encore valable (expiration réglable), accepter refuse automatiquement les autres invitations |
| Prêt | `arcade_set_ready` | Seulement dans un lobby |
| Lancer | `arcade_start` | Hôte uniquement, au moins 2 joueurs prêts, départ commun fixé par le serveur 4 secondes plus tard |
| Quitter | `arcade_leave` | Hôte qui quitte le lobby : partie annulée. Joueur qui quitte une partie : classé en abandon |
| Résultat | `arcade_submit_result` | Un seul envoi, pas avant la fin officielle (2,5 s de tolérance), au plus 20 s après (reconnexion), contrôle de cohérence |
| Objet trouvé (chasse) | `arcade_claim` | Le premier arrivé l'emporte, 300 ms minimum entre deux réclamations d'une table |
| Revanche | `arcade_rematch` | Nouvelle salle, mêmes adversaires, qui acceptent à nouveau |
| Solo | `arcade_start_solo`, `arcade_submit_solo` | Session ouverte par le serveur, durée minimale respectée, contrôle de cohérence |

Une tablette déconnectée pendant le lobby le quitte au bout de 15 secondes. Pendant une partie, elle peut revenir et finir le temps restant : son résultat est renvoyé automatiquement tant que le délai de grâce n'est pas écoulé, sinon elle est classée en abandon. Hors ligne, le solo reste jouable mais le score n'est pas enregistré.

**Limites anti triche** : le serveur ne rejoue pas les parties. Il vérifie l'horloge (départ, fin, délai), le plafond théorique de chaque jeu et la cohérence entre le score et les statistiques envoyées (verres, clients, objets, notes). En chasse compétitive, le score officiel est recalculé à partir des objets attribués par le serveur. Une tablette modifiée pourrait encore envoyer un score faux mais plausible : l'admin peut supprimer tout score suspect.

### Classements

* **Points Challenge** : chaque score solo est ramené sur 1 000 points pour une très bonne partie (1 500 au maximum). Le classement général additionne le meilleur résultat de chaque jeu : rejouer cent fois ne rapporte rien de plus.
* **Par jeu** : meilleur score de chaque joueur sur la période (aujourd'hui, semaine, mois, depuis toujours, heure de Bruxelles).
* **Duels** : 3 points par victoire. **Battles** : 5, 3 et 1 point pour les trois premiers.
* **Égalités dans une partie** : score le plus élevé, puis résultat validé en premier, puis plus petit numéro de table. Dans les classements : valeur la plus haute, puis performance atteinte en premier, puis ordre alphabétique.
* **Challenge de la semaine** : créé dans l'admin (jeu, dates, titre, description et récompense en FR et EN), classé sur les meilleurs scores solo de la période.

### Tables et tablettes

En production, chaque tablette crée un jeton secret aléatoire. Dans l'admin, rubrique Arcade, l'équipe associe la tablette à sa table (1 à 4) : l'interface client ne peut pas choisir ni changer de table. En démonstration, la table est le numéro du nom de la tablette (Tablette 1 à 4).

### Tester 4 tables sur un ordinateur

Lance `npm run dev`, puis ouvre 4 onglets du même navigateur avec `?tablet=Tablette%201` à `?tablet=Tablette%204`. Depuis l'onglet 1, ouvre Les jeux, Cutshop Arcade, Cutshop Challenge, choisis une ou plusieurs tables et envoie le défi : l'invitation apparaît dans les autres onglets.

