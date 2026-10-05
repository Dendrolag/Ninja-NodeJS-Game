# Mise en ligne et exploitation

Mis en place à l'étape 5.3, le 14 septembre 2026, et revu à l'étape 5.13, le 5 octobre 2026, quand la production est passée sur la machine Oracle. Ce document dit ce qui tourne où, comment une version part en ligne, comment passer d'un serveur de jeu à l'autre, comment revenir en arrière et quoi surveiller. Les raisons des choix sont au journal de conception (`docs/design/README.md`, décisions du 14 septembre 2026).

## Ce qui tourne où

| Rôle                       | Hébergement                                                            | Adresse                              |
| -------------------------- | ---------------------------------------------------------------------- | ------------------------------------ |
| Page du jeu                | Vercel, projet `neon-ninja-jeu` (`prj_x2NAYxrQy1D88sjkjGRewy96hbua`)   | https://ninja.dendrolag.fr           |
| Serveur de jeu, production | Machine Oracle gratuite, Francfort (étapes 5.9 et 5.13)                | https://serveur.ninja.dendrolag.fr   |
| Serveur de jeu, secours    | Render, service « Neon Ninja » (`srv-csrnm30gph6c73b9jmt0`), Francfort | https://neon-ninja.onrender.com      |
| Base                       | Neon, projet `neon-ninja`, branche `production` (principale), pooler   | Dans `DATABASE_URL`, jamais en clair |

**En une phrase : la page publique ne joint qu'un des deux serveurs de jeu, et c'est lui la production.** Les deux tournent toujours au même commit, sur la même base. Celui que la page ne joint pas attend, en secours. Passer de l'un à l'autre, c'est changer la page, en une commande (« Basculer d'un serveur à l'autre », plus bas). Le pied de l'écran d'accueil ne dit pas quel serveur sert : pour le savoir, voir la même section.

- **Vercel** : équipe `team_v9SkLK1zKjpRjtkmzq8Q9TM7` (« dendrolag's projects »). Le projet n'est relié à aucun dépôt : seule la mise en ligne ci-dessous y envoie une page.
- **Domaine** : `ninja.dendrolag.fr`, rattaché au projet Vercel le 15 septembre 2026. La zone DNS de `dendrolag.fr` est chez Hostinger (hPanel, serveurs `ns1` et `ns2.dns-parking.com`) : une seule entrée pour ce nom, un CNAME `ninja` vers `a3d44510bf05d743.vercel-dns-017.com`, la cible que Vercel recommande pour ce projet. Aucune entrée A ne doit coexister avec lui. Vercel émet et renouvelle le certificat. L'adresse https://neon-ninja-jeu.vercel.app reste en service, mais renvoie depuis l'étape 5.6 à `ninja.dendrolag.fr` par une redirection permanente (308), chemin compris, pour que les moteurs de recherche ne retiennent qu'une adresse. La règle est écrite dans la configuration que la mise en ligne envoie à Vercel (`packages/client/scripts/sortieVercel.ts`). Les adresses propres à chaque déploiement ne sont pas redirigées.
- **Oracle** : la machine, ses réglages et son administration sont dans « La machine Oracle », plus bas.
- **Render** : espace de travail `tea-csp5tt3gbbvc73fph8v0`, offre gratuite, branche `master` (depuis l'étape 6.1), déploiement automatique coupé. Le service a été repris de l'ancien service « Neon Ninja » de la version d'origine, suspendu depuis 2025, sur décision du porteur du projet. Il a été la production du 14 septembre au 5 octobre 2026, et reste en secours.
- **Base** : une seule, la branche `production`, pour les deux serveurs. Pour Render, `DATABASE_URL` vit dans le groupe d'environnement Render `neon-ninja-production` (`evg-dak0g56q1p3s739qm7b0`), lié au service ; pour Oracle, dans `/etc/neon-ninja/environnement` sur la machine. Les branches de test de la CI sont créées sans les données de la branche principale.

## Réglages du serveur sur Render

Commande de construction :

```bash
corepack pnpm install --frozen-lockfile && corepack pnpm exec tsc --build
```

Commande de démarrage :

```bash
node packages/server/dist/base/migrer.js && VERSION_DU_JEU=$RENDER_GIT_COMMIT exec node packages/server/dist/principal.js
```

Route de santé surveillée par Render : `/sante`.

| Variable                          | Valeur                                                         | Pourquoi                                                                           |
| --------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `NODE_VERSION`                    | `24`                                                           | La version de Node du projet, sans suivre la dernière parue.                       |
| `COREPACK_ENABLE_DOWNLOAD_PROMPT` | `0`                                                            | corepack installe pnpm (champ `packageManager`) sans poser de question.            |
| `SERVIR_LA_PAGE`                  | `non`                                                          | La page est servie par Vercel.                                                     |
| `ORIGINES_AUTORISEES`             | `https://neon-ninja-jeu.vercel.app,https://ninja.dendrolag.fr` | La page, sous ses deux adresses, peut joindre Socket.IO et les routes des comptes. |
| `MANDATAIRES_DE_CONFIANCE`        | `3`                                                            | Mesuré, voir « Mandataires » ci-dessous.                                           |
| `DATABASE_URL`                    | groupe `neon-ninja-production`                                 | La base, par le pooler. Un secret.                                                 |
| `VERSION_DU_JEU`                  | posée par la commande de démarrage                             | Le commit en ligne, lu par le contrôle de version et la route de santé.            |
| `PORT`                            | posée par Render                                               | Le port d'écoute.                                                                  |

**Une variable modifiée ne s'applique qu'au déploiement suivant.** Redémarrer le service garde les anciennes valeurs (constaté le 14 septembre 2026). Après un changement, redéployer le commit en ligne, ou pousser.

## Mise en ligne

### Automatique

Le job « Mise en ligne » de la CI (`.github/workflows/ci.yml`) part après les deux autres jobs verts, pour une poussée sur `master`, et seulement si le commit est encore le dernier de la branche. Il lance `deploiement/deployer.ts`, dont l'enchaînement est dans `deploiement/miseEnLigne.ts`, et qui :

0. lit la page publique pour savoir quel serveur de jeu est la production : celui auquel sa politique de sécurité l'ouvre, Oracle ou Render. L'autre est le secours. Une page qui n'ouvre à aucun des deux arrête tout ;
1. lit la version de la production sur `/sante`, et ne met rien en ligne si ce commit y est déjà, ou si rien de ce qui compose le jeu n'a changé depuis : documentation (`docs/`, fichiers `.md`), tests (`tests/`, fichiers `.test.ts` et `.spec.ts`), `legacy/`, `.claude/`, et l'outillage posé à la racine qui ne sert qu'aux tests, au linter ou au formateur (`playwright.config.ts`, `vitest.config.ts`, `vitest.workspace.ts`, `tsconfig.tests.json`, `tsconfig.e2e.json`, `eslint.config.js`, `.prettierrc.json`, `.prettierignore`) ne partent jamais en ligne. `tsconfig.base.json` et `tsconfig.json`, qui construisent les paquets, en font partie. Une mise en ligne coupe les parties en cours : un commit de documentation n'en coupe plus aucune (étape 5.4). Tout autre fichier, même inconnu, déclenche la mise en ligne, comme un serveur qui ne dit pas sa version ou un historique qui ne permet pas de comparer. La production est donc celle du dernier commit qui touche le jeu, pas forcément du dernier commit ;
2. empaquette la page pour ce commit et pour la production (adresse du serveur et version écrites dans `app.js`) et l'envoie à Vercel **sans la promouvoir** ;
3. met ce commit en ligne sur le serveur de la production, et vérifie que `/sante` rend sa version : sur Oracle en bleu et vert (« La machine Oracle »), sur Render par son API ;
4. promeut la page, qui devient celle de l'adresse publique, et la vérifie : réponse, politique de sécurité ouverte au seul serveur de la production, `app.js` du commit ;
5. met le secours au même commit, s'il n'y est pas déjà, et le vérifie de même. Ce pas est fait même quand rien n'a été mis en ligne en 1 : relancer une mise en ligne remet un secours en retard à jour.

Une mise en ligne ne s'interrompt pas pour la suivante, ni pour une bascule. Si elle échoue avant la promotion, rien n'a changé pour les joueurs : le serveur de la production garde l'ancienne version tant que la nouvelle n'a pas répondu, et l'ancienne page reste publique. **Si seul le secours échoue, la mise en ligne réussit quand même** : l'exécution reste verte, et une annotation « Secours en retard » s'affiche en tête de l'exécution sur GitHub. Tant qu'il est en retard, on ne peut pas basculer vers lui.

Secrets du dépôt GitHub : `RENDER_API_KEY`, `VERCEL_TOKEN` et `ORACLE_SSH_KEY`. Les identifiants et adresses sont écrits en clair dans le job : ils ne sont pas secrets.

### À la main

Depuis la racine du dépôt extrait au commit à mettre en ligne et compilé (`pnpm exec tsc --build`), avec dans l'environnement `VERSION_DU_JEU` (ce commit, déjà poussé), `PAGE_DU_JEU`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `ORACLE_HOTE`, `ORACLE_CLE` (le fichier de la clé SSH de la CI), `SERVEUR_RENDER`, `RENDER_SERVICE_ID` et `RENDER_API_KEY`, aux valeurs du job :

```bash
node --disable-warning=ExperimentalWarning deploiement/deployer.ts
```

### Pendant la mise en ligne

Entre la mise en ligne du serveur et la promotion de la page, quelques secondes, une page de l'ancienne version est refusée par le nouveau serveur avec « Une nouvelle version du jeu est en ligne. Rechargez la page. ». Les parties en cours sur l'ancien serveur s'arrêtent quand il s'éteint, sur Oracle juste après la bascule de Caddy, sur Render quand le nouveau a démarré : chaque mise en ligne coupe les parties en cours. Hors partie, une page ouverte rétablit son lien d'elle-même pendant une minute et demie (étape 2.6) ; une page de l'ancienne version se voit alors refuser, et propose de se recharger.

## Migrations de la base

Elles s'appliquent au démarrage du serveur, avant qu'il n'écoute (la commande préalable au déploiement de Render est réservée aux offres payantes). Cela vaut sur Oracle comme sur Render. Pendant ce temps, l'ancien serveur tourne encore, sur la base déjà migrée, et le secours, une version derrière, la partage jusqu'à sa propre mise à jour : **une migration doit rester compatible avec la version précédente du serveur**. Ajouter une colonne ou une table se fait en un commit ; en retirer ou en renommer une se fait en deux, le code qui ne s'en sert plus d'abord, la migration ensuite. Une migration ne se défait pas par un retour arrière.

## Commandes ponctuelles sur la base

Elles se lancent à la main, depuis un poste qui a `DATABASE_URL` de la production (l'adresse par le pooler).

- **`pnpm base:rattraper`** (étape 3.7) : attribue leurs succès aux comptes qui ont joué avant que les succès existent, datés de leur partie d'origine. À lancer une fois après la mise en ligne de l'étape 3.7, quand le serveur a migré la base (la table `succes_debloques` existe). La relancer n'inscrit rien. L'oublier ne retarde que les comptes qui ne rejouent pas : chaque fin de partie rattrape déjà ceux de ses joueurs. Un succès ajouté plus tard au code se rattrape de la même façon.
- **`pnpm base:mesurer`** (étape 3.7) : en lecture seule, la rétention (comptes actifs par semaine, retour sept jours ou plus après la première partie) et la calibration des seuils des succès. La procédure et les relevés sont dans `docs/mesures/retention.md`.

## Basculer d'un serveur à l'autre

La bascule (étape 5.13) fait joindre à la page publique l'autre serveur de jeu. Elle ne touche à aucun serveur : elle remplace la page par celle du même commit, empaquetée pour l'autre, puis la vérifie. Quelques minutes en tout. **La mise en ligne suivante suit la bascule** : elle met d'abord en ligne le serveur que la page joint, puis l'autre en secours. Aucun autre réglage n'est à changer.

### Quand basculer vers Render

- **Oracle ne répond plus** : https://serveur.ninja.dendrolag.fr/sante ne répond pas, ou les joueurs restent sur « le serveur démarre ».
- **Oracle a repris la machine** : un courriel d'Oracle, ou l'instance arrêtée dans la console (« Ce qu'Oracle peut reprendre », plus bas).
- **Une maintenance de la machine** qui l'arrêterait plus de quelques minutes.

Sur Render gratuit, le serveur s'endort après quinze minutes sans visite : le premier joueur attend alors 15 à 60 secondes que la page le réveille. C'est le prix du secours.

### Quand revenir vers Oracle

Quand https://serveur.ninja.dendrolag.fr/sante répond de nouveau, au même commit que Render. Si la machine a été recréée, voir d'abord « Administrer la machine ».

### Comment

**Depuis GitHub, téléphone compris** : dépôt, onglet _Actions_, workflow « Bascule », bouton _Run workflow_, choisir `render` ou `oracle`, puis _Run workflow_. Le job se suit sur la même page ; vert, c'est fait. Les joueurs déjà sur la page restent sur l'ancien serveur jusqu'à ce qu'ils la rechargent ; les nouveaux arrivent sur le nouveau.

**À la main**, depuis un poste qui a `VERCEL_TOKEN` : lire le commit du serveur choisi sur son `/sante`, extraire ce commit (`git checkout <commit>`), compiler (`pnpm install --frozen-lockfile`, puis `pnpm exec tsc --build`), puis, avec `CIBLE` (`oracle` ou `render`) et les autres variables du workflow `.github/workflows/bascule.yml` :

```bash
node --disable-warning=ExperimentalWarning deploiement/basculer.ts
```

### Ce que la bascule vérifie, et ses refus

Avant de rien changer, elle refuse, en le disant :

- **un serveur qui ne répond pas** sur `/sante` : basculer vers lui laisserait les joueurs sans serveur ;
- **un serveur qui n'est pas au commit de la page en ligne** : il refuserait les joueurs (« Rechargez la page », sans fin). C'est le cas d'un secours resté en retard après une mise en ligne qui l'a signalé. Le remède : relancer la dernière mise en ligne, qui le remet à jour. Si c'est justement la production qui ne répond plus, la mise en ligne s'arrête sur elle avant d'arriver au secours : mettre alors le secours au commit de la page par son tableau de bord (Render : _Manual Deploy_, _Deploy a specific commit_, le commit étant celui du pied de l'accueil), puis basculer ;
- **des sources d'un autre commit** que celui du serveur, à la main seulement : le workflow extrait le bon de lui-même.

Après la promotion, elle vérifie que l'adresse publique sert la nouvelle page : politique de sécurité ouverte au seul serveur choisi, `app.js` du commit.

### Quel serveur sert, en ce moment

L'en-tête `Content-Security-Policy` de la page publique nomme le serveur, après `connect-src` :

```bash
curl -sI https://ninja.dendrolag.fr/ | grep -i content-security-policy
```

Dans un navigateur : outils de développement, onglet Réseau, la page, ses en-têtes.

## Retour arrière

Les serveurs et la page doivent toujours être du même commit, sans quoi le serveur refuse la page.

- **Le plus sûr** : annuler le commit fautif sur `master` (`git revert`), et pousser. La CI met en ligne l'ensemble, vérifié, production et secours.
- **En urgence**, sans attendre la CI : relancer la mise en ligne à la main avec `VERSION_DU_JEU` égal au dernier commit sain, depuis ce commit extrait.
- **Depuis les tableaux de bord**, quand Render est la production : Render, liste des déploiements, « Rollback » sur le déploiement sain ; puis Vercel, projet `neon-ninja-jeu`, liste des déploiements, « Promote » sur la page du même commit et du même serveur. Les deux, dans cet ordre.

## Surveillance

- **Le pied de l'écran d'accueil** (étape 8.4) : la façon la plus simple de savoir sur quelle version on est. Il dit « Version du 20 septembre 2026, 20h17 · 0e0cdc6 », c'est-à-dire la date du commit servi et les sept premiers caractères de son empreinte, l'empreinte complète étant dans l'infobulle. C'est la **version de la page**, celle que Vercel sert ; celle de chaque serveur de jeu se lit sur son `/sante`. Les trois doivent être la même : un serveur refuse une page d'un autre commit, avec un message qui dit de recharger. Quel serveur la page joint : « Quel serveur sert, en ce moment », plus haut.
- **`/sante`** de chaque serveur : version en ligne, nombre de parties, de joueurs et de connexions, et adresse sous laquelle le serveur voit le demandeur. https://serveur.ninja.dendrolag.fr/sante pour Oracle, https://neon-ninja.onrender.com/sante pour Render.
- **La régularité du serveur, sur `/sante`** (étape 8.6) : le champ `battement` résume les cinq dernières minutes de toutes les parties. `ecart` est l'écart réel entre deux battements d'une même partie, qui doit rester à 50 ms ; `enRetard` compte ceux d'au moins 100 ms ; `duree` est le temps d'un battement, calcul et envoi compris, qui doit rester loin sous 50 ms. `null` quand aucune partie n'a tourné pendant ces cinq minutes. **Comment le lire** : si l'écart reste à 50 ms alors qu'un joueur ressent des à-coups, le serveur n'y est pour rien, le retard naît sur le chemin ; si l'écart monte, c'est le serveur qui peine, et une offre qui garantit sa puissance le corrigerait. Le relevé `?diagnostic=1` de la page recopie ces chiffres à côté des siens.
- **Journaux** : sur la machine Oracle, `sudo -u deploiement neon-ninja journal <emplacement>` (« Administrer la machine ») ; tableau de bord Render, onglet Logs du service ; la CI, jobs « Mise en ligne » et « Bascule ».
- **Mise en veille, sur Render seulement** : la machine Oracle ne dort jamais. En offre gratuite, le serveur Render s'endort après quinze minutes sans trafic, et se réveille à la visite suivante : quinze secondes mesurées le 14 septembre 2026, jusqu'à une minute selon Render. Pendant ce temps, la page dit que le serveur démarre et réessaie d'elle-même, toutes les trois secondes pendant une minute et demie. Une partie en cours le garde éveillé. Depuis l'étape 5.5, une page ouverte et visible le garde éveillé aussi : elle demande `/sante` toutes les dix minutes (`packages/client/src/eveil.ts`), faute de quoi le serveur s'endormait sous un joueur resté sur les menus, le WebSocket du jeu ne comptant pas comme du trafic entrant. Un onglet caché se tait. Au pire, le service tourne tout le mois : 744 heures au plus, dans les 750 heures gratuites de l'espace Render, qui n'a plus d'autre service depuis l'étape 6.1. En secours, personne ne le joint : il dort, et chaque mise en ligne le réveille une fois. Depuis l'étape 8.10, le serveur décode les murs de toutes les cartes avant d'ouvrir son port, ce qui ajoute deux secondes environ au démarrage et au réveil.
- **Heures gratuites** : 750 heures par mois pour tout l'espace de travail Render, dont le serveur de jeu est le seul service depuis l'étape 6.1.
- **Une mise en ligne peut être sautée sans que rien ne le signale.** Chaque exécution vérifie que son commit est encore le dernier de `master` avant de mettre en ligne, pour ne jamais écraser du neuf par du vieux. Trois poussées en vingt minutes, le 20 septembre 2026, ont donc sauté deux mises en ligne de suite, chaque exécution restant verte, et la production est restée trois commits en arrière. **Le réflexe** : après une série de poussées rapprochées, comparer le pied de l'accueil à la tête de `master`. Si la production est en retard et que rien n'est en cours, relancer la dernière exécution suffit. Rien ne surveille cela automatiquement à ce jour.
- **Un démarrage retenu par la base** (2 octobre 2026, étape 8.8) : une mise en ligne est restée quinze minutes dans `migrer.js`, sans un mot, jusqu'à ce que Render l'abandonne (`update_failed`, « Port scan timeout »), puis redémarre l'ancienne version. La connexion à la base n'avait pas de délai. Depuis, une connexion qui ne s'ouvre pas en vingt secondes échoue, et les migrations se reprennent trois fois en le disant dans les journaux. Les journaux de Render se lisent aussi par son API avec `RENDER_API_KEY` (`GET /v1/logs`, propriétaire et service du tableau ci-dessus). Si cela recommence, relancer l'exécution suffit tant que la base répond.
- **Échéances** : le jeton Vercel expire le 14 septembre 2027. Le renouveler avant : nouveau jeton, puis variable `VERCEL_TOKEN` de la machine de développement et secret GitHub du même nom.

## Mandataires

Entre le joueur et le serveur, Render place trois mandataires : deux relais qui inscrivent chacun une adresse dans l'en-tête `X-Forwarded-For` (des adresses internes en `10.`), et un dernier sur la machine même, d'où le serveur voit toutes les connexions venir de `::1`. `MANDATAIRES_DE_CONFIANCE` dit combien de mandataires croire : il vaut **3**.

Mesuré le 14 septembre 2026 : avec 10 mandataires de confiance et un en-tête inventé de neuf adresses numérotées, le serveur a rendu la troisième, et sans en-tête l'adresse publique de la machine de mesure. Avec 0, le serveur voyait `::1` ; avec 1, une adresse interne de Render : tous les joueurs auraient partagé la même limite de tentatives de connexion. Avec plus de 3, un joueur pourrait s'inventer une adresse.

Sur Render, en secours, rien n'a changé. Pour le vérifier après un changement d'hébergement : interroger `/sante` depuis une machine dont on connaît l'adresse publique, avec et sans en-tête `X-Forwarded-For` inventé. L'adresse rendue doit être l'adresse publique dans les deux cas : jamais celle d'un mandataire, jamais l'adresse inventée.

Sur la machine Oracle (étape 5.9), un seul mandataire, Caddy, qui remplace l'en-tête par l'adresse de celui qui se connecte : `MANDATAIRES_DE_CONFIANCE` y vaut **1**. Mesuré le 4 octobre 2026 par la même procédure : l'adresse publique du poste de mesure, avec et sans en-tête inventé.

## La machine Oracle

Mise en place le 4 octobre 2026 pour un essai (étape 5.9, `docs/plan/etape-5-9.md`), à côté de la production, sur une copie de sa base. **Production depuis le 5 octobre 2026** (étape 5.13, `docs/plan/etape-5-13.md`), sur décision du porteur du projet après les mesures de l'essai (`docs/mesures/charge-serveur.md`, section 26) : aucun battement en retard là où Render en avait, 24 parties pleines tenues, et pas de mise en veille. Render reste en secours.

### Ce qui tourne où, sur Oracle

- **La machine** : Oracle Cloud, offre gratuite (« Always Free »), région Francfort, location `Dendrolag`. Une `VM.Standard.A1.Flex` (processeur Arm, 4 cœurs, 24 Go), Ubuntu 24.04 Minimal pour Arm, disque de 47 Go, adresse publique `92.5.46.188`. L'adresse est « éphémère » : gratuite, elle se garde tant que la machine existe, mais une machine supprimée et recréée en reçoit une autre ; il faut alors corriger le DNS et `deploiement/oracle/hote-connu`.
- **Le nom** : `serveur.ninja.dendrolag.fr`, une entrée A chez Hostinger vers l'adresse de la machine. Caddy, sur la machine, obtient et renouvelle seul son certificat.
- **La page** : la machine n'en sert plus depuis l'étape 5.13. Pendant l'essai, elle servait la sienne ; la seule page publique est désormais celle de Vercel, qui joint la machine.
- **La base** : la branche `production`, comme Render. La branche d'essai `essai-oracle`, copiée de la production le 4 octobre 2026, est supprimée après la bascule : un compte créé pendant l'essai n'existe pas en production.

Sur la machine :

| Quoi                           | Où                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| Le serveur de jeu              | Un conteneur Docker, `neon-ninja-bleu` ou `neon-ninja-vert`, port local 3001 ou 3002 |
| Caddy                          | Service du système, `/etc/caddy/Caddyfile`, qui importe `/etc/caddy/amont.caddy`     |
| Les variables du serveur       | `/etc/neon-ninja/environnement`, lisible du seul compte de mise en ligne             |
| Les commandes de mise en ligne | `/usr/local/bin/neon-ninja`, copie de `deploiement/oracle/neon-ninja.sh`             |
| L'emplacement en service       | `/var/lib/neon-ninja/actif`                                                          |

Variables du serveur : `DATABASE_URL` (la branche `production`, par le pooler, un secret), `ORIGINES_AUTORISEES=https://neon-ninja-jeu.vercel.app,https://ninja.dendrolag.fr`, `MANDATAIRES_DE_CONFIANCE=1`, `SERVIR_LA_PAGE=non`. `PORT` et `VERSION_DU_JEU` sont posées au démarrage du conteneur.

### Le garde-fou contre les factures

Posé le 4 octobre 2026, avant la machine, en trois couches :

1. **Aucune facturation ouverte.** Le compte reste en offre gratuite : Oracle refuse ce qui dépasse, il ne le facture pas. **Ne jamais cliquer sur « Upgrade »** dans la console : ce bouton ouvre la facturation (« Pay As You Go »).
2. **Une politique de quotas**, `garde-fou-gratuit`, sur toute la location (_Governance & Administration_, _Quota Policies_) :

   ```
   zero compute-core quotas in tenancy
   zero compute-memory quotas in tenancy
   zero block-storage quotas in tenancy
   set compute-core quota /*standard-a1*/ to 4 in tenancy
   set compute-memory quota /*standard-a1*/ to 24 in tenancy
   set block-storage quota total-storage-gb to 200 in tenancy
   ```

   Seule une machine A1 dans les limites gratuites peut se créer. Les noms génériques (`/*standard-a1*/`) sont nécessaires : une première version qui ne rouvrait que `standard-a1-core-count` a fait refuser la machine, la mise à zéro couvrant aussi des quotas « régionaux » (`standard-a1-core-regional-count`) que la documentation d'Oracle ne cite pas. Le refus prouve que les quotas sont actifs.

3. **Un budget d'un euro par mois**, avec deux alertes par courriel : dépense réelle au premier centime, dépense prévue au-delà d'un euro.

Ce qui resterait payant une fois la facturation ouverte : un trafic sortant au-delà de 10 To par mois.

### Mise en ligne sur la machine

Lancée par la mise en ligne (« Mise en ligne », plus haut), que la machine soit la production ou le secours, par `deploiement/oracle.ts`, qui :

1. envoie à la machine les sources du commit (paquets, ressources, fichier de construction), qui en construit l'image Docker du serveur : deux minutes environ ;
2. démarre le nouveau serveur dans l'emplacement libre, bleu ou vert, pendant que l'ancien sert toujours, et attend qu'il rende sa version sur `/sante`, jusqu'à trois minutes ;
3. fait basculer Caddy vers lui ;
4. vérifie que l'adresse publique rend la version sur `/sante` ;
5. arrête l'ancien serveur, et retire les images qui ne servent plus.

Si le nouveau serveur ne répond pas en 2, il est arrêté, et l'ancien n'a jamais cessé de servir. Si l'adresse publique ne suit pas en 4, Caddy revient à l'ancien.

**La CI n'a sur la machine que les commandes de `neon-ninja`.** Sa clé SSH, le secret `ORACLE_SSH_KEY` du dépôt, y est enregistrée avec cette commande imposée : ni terminal, ni autre programme. L'identité de la machine est épinglée dans `deploiement/oracle/hote-connu` : une machine qui en changerait est refusée.

### Administrer la machine

Par SSH, avec la clé d'administration du poste du porteur du projet (`~/.ssh/neon_ninja_oracle`, créée le 4 octobre 2026) :

```bash
ssh -i ~/.ssh/neon_ninja_oracle ubuntu@serveur.ninja.dendrolag.fr
```

- **Journaux du serveur** : `sudo -u deploiement neon-ninja journal bleu`, ou `vert`, selon `cat /var/lib/neon-ninja/actif`.
- **Mises à jour du système** : automatiques pour la sécurité, avec un redémarrage à 4h30 (heure de la machine, UTC) quand une mise à jour l'exige. Le serveur repart seul, Docker relançant le conteneur.
- **Changer l'installation** (pare-feu, Caddy, commandes) : modifier `deploiement/oracle/`, recopier le dossier sur la machine, puis relancer `sudo bash installer.sh <fichier de la clé publique de la CI>`, sans effet de bord à la relance. La clé publique se relit dans `/home/deploiement/.ssh/authorized_keys`, après `restrict`. Pour les seules commandes : `sudo install -m 755 neon-ninja.sh /usr/local/bin/neon-ninja`.
- **Changer une variable du serveur** : modifier `/etc/neon-ninja/environnement`, puis relancer une mise en ligne. Comme sur Render, une variable ne s'applique qu'au démarrage suivant. Une mise en ligne qui ne trouve rien à mettre en ligne ne redémarre rien : redémarrer alors le serveur sur la machine (`sudo -u deploiement neon-ninja demarrer <emplacement libre> <commit en ligne>`, attendre son `sante`, puis `basculer` vers lui et `arreter` l'ancien), ce qui coupe les parties en cours.

### Ce qu'Oracle peut reprendre

Une machine gratuite jugée inactive sur sept jours est récupérée par Oracle : moins de 20 pour cent de processeur au 95e centile, de réseau et de mémoire. On ne saura qu'après la fin de l'essai gratuit de 30 jours du compte, vers le 3 novembre 2026, si cela vise la nôtre : la récupération concerne les comptes gratuits. À surveiller : l'état de l'instance dans la console, et les courriels d'Oracle. À la fin de l'essai, Oracle proposera de passer en « Pay As You Go » : ne pas le faire sans décision du porteur du projet.

**Si la machine est reprise** : basculer vers Render (« Basculer d'un serveur à l'autre »), qui est au même commit. Le jeu continue, avec la mise en veille de Render. Les mises en ligne suivantes partent alors sur Render, et signalent le secours Oracle en retard sans échouer. Puis décider : recréer une machine (nouvelle adresse : DNS, `hote-connu`, `installer.sh`, variables), ou passer le compte en « Pay As You Go », sur décision du porteur du projet.

### Arrêter la machine

Basculer d'abord vers Render. Puis, dans la console Oracle, arrêter l'instance (_Stop_), ou la supprimer (_Terminate_), ce qui libère tout. Les mises en ligne suivantes signaleront le secours Oracle en retard : pour qu'elles ne le tentent plus, retirer Oracle de `deploiement/`, dans une étape à part. Retirer ensuite l'entrée DNS `serveur.ninja` et le secret `ORACLE_SSH_KEY`.

## Ressources de la version d'origine

Retirées à l'étape 6.1, le 15 septembre 2026, sur décision du porteur du projet : le service Render « To The Point » (`https://to-the-point.onrender.com`), suspendu puis supprimé, et les projets Vercel `ttp` et `neon-ninja` (`ttp-eight.vercel.app`, `neon-ninja-gules.vercel.app`), supprimés. Aucune ne portait de données. Plus rien en ligne ne sert la version d'origine : elle reste archivée sous l'étiquette git `v0.8.6`, et copiée en lecture seule dans `legacy/`.
