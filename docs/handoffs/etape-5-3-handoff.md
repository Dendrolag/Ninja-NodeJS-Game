# Handoff - Étape 5.3 Déploiement

Date: 14 septembre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Mettre la réécriture en ligne, la page et le serveur de jeu, sur des offres gratuites, avec un déploiement automatique et vérifié à chaque commit vert de `reecriture`.

## Ce qui a été fait

- **Question posée au porteur du projet avant tout, comme le demandait le handoff 7.1.** Réponse: aucun nouveau mode avant la fin du socle, « d'abord on finalise le socle, ensuite on l'enrichit ». Le jalon 5 passe donc à 5.3, puis 6.1 (ROADMAP sections 3 et 5, cadrage section 1).
- **Quatre décisions de mise en ligne du porteur du projet**: la solution la plus performante, évolutive et durable sur des offres entièrement gratuites; serveur Render gratuit; autonomie de Claude Code par clés d'API; base de production sur la branche principale de Neon. Puis, face aux ressources existantes: reprendre l'ancien service Render « Neon Ninja », créer un projet Vercel neuf, limiter les anciens projets Vercel à `master`.
- **La fiche 5.3 est réécrite** (elle visait encore un déploiement en parallèle de l'ancien, avec drapeaux et bascule progressive), et **la fiche 6.1 réconciliée** de même, avec la liste des ressources de la version d'origine encore en ligne.
- **La page parle à un serveur servi ailleurs**: adresse du serveur et version écrites dans `app.js` à l'empaquetage; politique de sécurité du contenu écrite une fois dans le paquet partagé, posée par le serveur de développement et par Vercel; sortie Vercel au format Build Output API, sans cartes de sources ni images de collision.
- **Une page ne parle qu'au serveur du même commit**: le serveur refuse une autre version avant même la session, et l'accueil ne propose alors que « Recharger la page ».
- **Le serveur de production**: `SERVIR_LA_PAGE=non`, `VERSION_DU_JEU`, migrations au démarrage, route `/sante` en JSON (version, parties, joueurs, connexions, adresse vue du demandeur).
- **La mise en ligne**: `deploiement/deployer.ts` envoie la page à Vercel sans la promouvoir, déploie le serveur sur Render et l'attend, vérifie sa version, promeut la page et la vérifie. Le job « Mise en ligne » de la CI le lance après les deux autres jobs verts, pour le dernier commit de `reecriture`.
- **L'hébergement, créé et réglé par l'API**: projet Vercel `neon-ninja-jeu`; service Render « Neon Ninja » repris (branche, commandes, route de santé, variables, groupe `neon-ninja-production` qui porte `DATABASE_URL`); projets Vercel `ttp` et `neon-ninja` limités à `master`. Le passage du service en offre gratuite s'est fait dans le tableau de bord, l'API le refusant.
- **Première mise en ligne réussie** (commit `c5aaa63`), puis **une partie jouée de bout en bout sur la production** dans un navigateur: accueil, partie rapide, salon, lancement, captures (score 14), classement final, console sans erreur.
- **Mesures en ligne**: latence, compression, mandataires (voir ci-dessous). `docs/deploiement.md` documente l'exploitation.
- **Un défaut trouvé en production, et corrigé: le réveil du serveur endormi.** Ouverte sur le serveur gratuit endormi, la page affichait en moins de dix secondes « Le serveur de jeu ne répond pas », et ne réessayait jamais, alors que le serveur, réveillé par cette tentative même, écoutait quinze secondes plus tard. La page réessaie désormais d'elle-même toutes les trois secondes pendant une minute et demie, et dit que le serveur démarre (`packages/client/src/reveil.ts`, `minuterie.ts`). Vérifié en ligne après seize minutes sans trafic: page ouverte à 16:46:18 (UTC), serveur réveillé par elle à 16:46:19 et à l'écoute à 16:46:36, page connectée d'elle-même au plus tard à 16:46:47 après un premier essai en échec, sans aucun clic.

## Les adresses et les chiffres clés

| Grandeur                                            | Valeur                                                         |
| --------------------------------------------------- | -------------------------------------------------------------- |
| Page du jeu                                         | https://neon-ninja-jeu.vercel.app                              |
| Serveur de jeu                                      | https://neon-ninja.onrender.com (Render gratuit, Francfort)    |
| Aller-retour HTTP vers le serveur, depuis la France | médiane 60 ms (20 requêtes, 57 à 186 ms)                       |
| Page Vercel, depuis la France                       | médiane 50 ms (10 requêtes)                                    |
| `app.js` transféré                                  | 229 Ko en Brotli (739 Ko minifié)                              |
| Construction et démarrage du serveur sur Render     | environ 1 min 15 s, du déploiement demandé au serveur en ligne |
| `MANDATAIRES_DE_CONFIANCE`                          | 3, mesuré                                                      |

## Fichiers créés ou modifiés

Commit `c5aaa63`, la page à deux origines et le contrôle de version:

- `packages/shared/src/page.ts` et test (créés): la politique de sécurité, déplacée du serveur, ouverte au seul serveur de jeu nommé.
- `packages/shared/src/version.ts` et test (créés): le contrôle de version et son motif.
- `packages/shared/src/comptes.ts`, `index.ts`: version dans `AuthentificationReseau`, exports.
- `packages/server/src/ServeurSocket.ts`, `ServeurSocket.version.test.ts` (créé): refus d'une autre version, nombre de connexions.
- `packages/server/src/serveur.ts`, `fichiers.ts` et test, `index.ts`: option version, route de santé en JSON.
- `packages/server/src/principal.ts`: `SERVIR_LA_PAGE`, `VERSION_DU_JEU`.
- `packages/client/src/configuration.ts` et test (créés), `principal.ts`, `reseauSocketIo.ts`, `comptes/api.ts`: adresse et version écrites à l'empaquetage, version jointe à l'ouverture.
- `packages/client/src/interface/modeles/accueil.ts`, `ecrans/accueil.ts`, et leurs tests, `application.comptes.test.ts`: une page d'une autre version ne propose que de recharger.
- `packages/client/scripts/empaqueter.ts`, `sortieVercel.ts` et test (créé): options d'empaquetage, sortie Vercel.
- `tests/client/integration/version-serveur.test.ts` (créé): le vrai client refusé par un vrai serveur.
- `deploiement/deployer.ts`, `verifications.ts` et test (créés): la mise en ligne et ses vérifications pures.
- `vitest.workspace.ts`, `tsconfig.tests.json`, `eslint.config.js`, `.gitignore`, `.prettierignore`: le dossier `deploiement` et la sortie `.vercel`.
- `docs/plan/etape-5-3.md`, `docs/plan/ROADMAP.md`, `docs/design/README.md`, `docs/design/cadrage.md`.

Commit `6e9d013`, la mise en ligne par la CI:

- `.github/workflows/ci.yml`: job « Mise en ligne », exécutions de `reecriture` non annulées.
- `deploiement/deployer.ts`, `verifications.ts` et test: outil de Vercel par npx, adresse lue dans sa sortie JSON.
- `docs/deploiement.md` (créé), `docs/plan/etape-6-1.md`, `docs/design/README.md`, `CLAUDE.md`.

Commit `7a8fa65`, le réveil du serveur endormi:

- `packages/client/src/reveil.ts` et test (créés): les nouveaux essais d'ouverture quand le serveur ne répond pas.
- `packages/client/src/minuterie.ts` et test (créés): la minuterie injectable, du navigateur et manuelle.
- `packages/client/src/etat.ts`, `actions.ts`, `reduction.ts`: l'état de connexion « reveil ».
- `packages/client/src/client.ts`, `reseau.ts`, `reseauSocketIo.ts`, `index.ts`, `horloge.ts`: le branchement, le motif d'un serveur injoignable dans l'interface du transport, les exports.
- `packages/client/src/interface/modeles/accueil.ts`, `ecrans/accueil.ts` et leurs tests, `application.comptes.test.ts`: le message pendant le réveil.
- `tests/client/integration/comptes-serveur.test.ts`: un serveur muet est attendu, puis dit injoignable.
- `docs/design/README.md`, `docs/deploiement.md`.

Commit de ce handoff: `docs/handoffs/etape-5-3-handoff.md`.

Aucune modification de `legacy/`, `tests/caracterisation/` ni `master`.

## Tests

- Ajoutés:
  - **politique de sécurité**: identique à l'octet près pour une page servie par le serveur; ouverte au seul serveur nommé, en HTTPS et en `wss:`; origines mal écrites refusées;
  - **contrôle de version**: même commit accepté, autre commit, absence de version, valeur héritée refusés; serveur sans version qui accepte tout; refus avant la session, avec de vrais clients Socket.IO puis avec le vrai client;
  - **route de santé**: sans cache, version, parties et joueurs, adresse vue sans en-tête cru, et à travers un mandataire de confiance;
  - **page**: configuration d'empaquetage; accueil devant une page d'une autre version, modèle et écran;
  - **sortie Vercel**: politique, cache des polices, fichiers servis après les en-têtes, fichiers qui ne partent pas;
  - **mise en ligne**: statuts Render, déploiement d'un commit retrouvé, sortie de l'outil Vercel, santé et page publique conformes ou non;
  - **réveil du serveur**: attente et nouvel essai toutes les trois secondes, main rendue au bout d'une minute et demie, nouvelle série après un essai du joueur ou un lien établi, refus du serveur jamais réessayé, lien rouvert par le joueur jamais doublé, essai planifié annulé à la fermeture; minuterie manuelle et du navigateur; accueil sans bouton pendant l'attente; un serveur muet attendu puis dit injoignable, en intégration.
- Résultat: **1 667 tests unitaires sur 1 667**, 114 fichiers (projet `unitaires`); le projet `base` tourne en CI. Types (paquets, tests, bout en bout), linter et formatage: verts.
- Couverture: **99,84 pour cent** des instructions sur `sim` et `shared` (99,83 au handoff 7.1); `sim` à 99,66, inchangé; `shared` à 100.
- Bout en bout en local: 12 scénarios sur 14 au premier passage; les deux en échec (mobile, carte chargée en plus de 20 secondes) passent seuls, voir la dette. En CI: 15 sur 15.
- **Navigateurs**: navigation, parcours solo et mode Tactique, au bureau, **6 scénarios sur 6 dans Firefox et WebKit** (le moteur de Safari), du premier coup, sur une machine d'intégration Linux (exécution 34864496432, branche temporaire `mesure-navigateurs/firefox`, supprimée ensuite). WebKit passe aussi sur la machine de développement; Firefox n'y démarre pas, faute d'une bibliothèque Visual C++ que l'on ne peut installer sans droits administrateur. Les scénarios tactiles restent propres à Chromium, qu'ils pilotent par son protocole.
- **En production**: une partie complète jouée; route de santé; page, compression et fichiers exclus vérifiés; mandataires mesurés.
- Aucune régression de caractérisation.

## Décisions et écarts au plan

Treize décisions au journal de `docs/design/README.md`, datées du 14 septembre 2026. Quatre points à lire ici.

### 1. Page sur Vercel, jeu sur Render, et jamais l'un sans l'autre

Le serveur gratuit dort, se réveille lentement et n'a qu'un petit processeur: il ne sert que le jeu. Page et serveur sont deux mises en ligne distinctes, donc le serveur refuse une page d'un autre commit, et seule la CI met en ligne, toujours les deux ensemble, serveur d'abord, page promue ensuite.

### 2. Le service Render repris garde une trace de son passé

C'est l'ancien service « Neon Ninja » de la version d'origine (adresse conservée). Il a tourné environ deux minutes en offre Starter le 14 septembre, entre sa relance et le passage en offre gratuite.

### 3. `MANDATAIRES_DE_CONFIANCE` vaut 3, et un redémarrage n'applique pas une variable

Mesuré par la route de santé avec un en-tête d'adresses inventées numérotées. Deux essais ont d'abord échoué parce qu'un redémarrage de Render garde les anciennes variables: seul un déploiement les applique. Le réglage à 3, appliqué par la mise en ligne de la CI du commit `6e9d013`, a été vérifié en ligne: l'adresse publique de la machine de mesure, sans en-tête comme avec une ou neuf adresses inventées.

### 4. Écarts à la fiche

La fiche a été réécrite au début de la session: plus de bascule, de drapeau ni de retour vers l'ancien monolithe. Rien d'autre.

### Ce que cette étape rend structurellement impossible

- **Une page et un serveur de versions différentes qui se parlent sans le savoir**: le serveur refuse, l'accueil dit de recharger.
- **Une mise en ligne sans les tests**: ni Render ni Vercel ne déploient seuls; seule la CI met en ligne, après les deux jobs verts.
- **Deux politiques de sécurité qui divergent**: une seule fonction, dans le paquet partagé.
- **Un joueur laissé devant un serveur endormi sans que rien ne se passe**: la page attend le réveil et réessaie d'elle-même.

## Problèmes connus et dette

Nouveau, ouvert par cette étape:

- **Chaque poussée sur `reecriture`, même de documentation, remet le serveur en ligne**, ce qui coupe les parties en cours. Sans joueurs aujourd'hui; à revoir avant d'en avoir, par exemple en ne mettant en ligne que les commits qui touchent le code.
- **L'outil de Vercel est téléchargé par npx à chaque mise en ligne**, une vingtaine de secondes.
- **Les essais de la première mise en ligne ont laissé des déploiements Vercel non promus**, sans effet.
- **Les heures gratuites de Render sont partagées** avec le service « To The Point » de la version d'origine, jusqu'à l'étape 6.1.
- **Le jeton Vercel expire le 14 septembre 2027.**
- **Bout en bout en local**: le scénario mobile de navigation rejoint le parcours solo mobile parmi les scénarios qui dépassent 20 secondes de chargement de carte quand quatorze scénarios jouent en parallèle. En CI, un seul à la fois: vert.

Résolu par cette étape, repris des handoffs précédents: `MANDATAIRES_DE_CONFIANCE` et `ORIGINES_AUTORISEES` posés; `app.js` compressé au déploiement; latence mesurée hors réseau local; console d'une partie vérifiée dans un vrai navigateur; compatibilité mesurée dans Firefox et WebKit.

Repris des handoffs précédents, inchangé: les erreurs d'un travailleur échappent aux scénarios de bout en bout; les limites de tentatives vivent en mémoire de l'instance; continuer en invité laisse la session ouverte côté serveur; la liste des parties ne se rafraîchit pas d'elle-même; aucune gestion du mot de passe; un échec d'enregistrement n'est pas retenté; le filtrage du flux par zone d'intérêt écarté par la mesure; relevé des contacts et lissage du client en carré du nombre d'entités.

## État de la CI

- `c5aaa63` (page à deux origines, contrôle de version): **verte**, exécution 34826305914.
- `6e9d013` (mise en ligne par la CI): **verte**, exécution 34863746129: « Types, linter et tests », « Bout en bout » (15 scénarios) et **« Mise en ligne »** (2 min 6 s). Le serveur et la page publique sont de ce commit.
- `7a8fa65` (réveil du serveur endormi): **verte**, exécution 34867725120: « Types, linter et tests », « Bout en bout » (15 scénarios) et « Mise en ligne ». Le serveur et la page publique sont de ce commit.

`master` n'a pas été touché.

## Prochaine action exacte

La section 3 du ROADMAP place ensuite **l'étape 6.1, retrait du legacy** (`docs/plan/etape-6-1.md`, réconciliée pendant cette étape). Dans une conversation neuve: vérifier que la liste des ressources de la version d'origine y est toujours juste (API Render et Vercel, clés dans les variables Windows `RENDER_API_KEY` et `VERCEL_TOKEN`), puis demander au porteur du projet son accord explicite avant toute suppression.

## Étape suivante

Fiche à lire: `docs/plan/etape-6-1.md`
