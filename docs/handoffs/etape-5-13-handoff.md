# Handoff - Étape 5.13 La production sur Oracle, Render en secours

Date: 5 octobre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Faire jouer la production sur le serveur de jeu Oracle, la page publique `ninja.dendrolag.fr` joignant `serveur.ninja.dendrolag.fr`, sur la base de production, Render gardé en secours à la même version, avec un retour vers lui en une commande.

## Ce qui a été fait

- **La production suit la page publique.** La mise en ligne lit la page: le serveur auquel sa politique de sécurité l'ouvre est la production, mis en ligne et vérifié avant que la page soit promue; l'autre est le secours, mis au même commit après, sans bloquer. Un secours qui échoue laisse l'exécution verte et le dit par une annotation « Secours en retard ». Il se remet à jour même quand rien n'est mis en ligne: relancer une mise en ligne suffit.
- **La bascule en une commande**: le workflow « Bascule » (`.github/workflows/bascule.yml`, onglet Actions, téléphone compris) remplace la page publique par celle du même commit, empaquetée pour l'autre serveur. Elle refuse, avant toute promotion, un serveur muet ou qui n'est pas au commit de la page. Même groupe de concurrence que la mise en ligne.
- **La machine Oracle en production**: variables de production et nouvelles commandes `neon-ninja` posées par le porteur du projet (le garde-fou de la session refuse l'accès à la machine de production); la machine ne sert plus de page, son image ne l'empaquette plus.
- **Bascules faites par la commande**, toutes vertes: vers Oracle (37328799802), retour vers Render (37328997059), vers Oracle (37329194731); puis, après le défaut ci-dessous, vers Render (37329483453) et vers Oracle (37334293894).
- **Défaut trouvé et corrigé**: après la première bascule, un navigateur qui avait la page en cache l'a revalidée; la page HTML étant la même pour les deux serveurs, Vercel a répondu 304 sans en-têtes, et le navigateur a gardé la politique de sécurité de Render avec le code visant Oracle: « le serveur de jeu démarre » sans fin. Page remise sur Render dans la minute, puis correction: la page porte `<meta name="serveur-de-jeu">`, et la vérification de la page l'exige. Revérifié dans le même navigateur, cache compris: page reçue en entier, Oracle joint, Render refusé par la politique.
- **Parties jouées en production sur Oracle** par le porteur du projet: une partie solo, puis une partie à deux appareils connectée à son compte. La progression s'est affichée en fin de partie, et la partie apparaît dans les dernières parties jouées du profil: la base de production reçoit les parties par Oracle.
- **Version 1.7.3**, pour la fin de la mise en veille, sans note.
- **Étape 5.14 planifiée** à la demande du porteur du projet: une CI plus courte (26 minutes aujourd'hui), fiche `docs/plan/etape-5-14.md`.

## Fichiers créés ou modifiés

- `deploiement/miseEnLigne.ts` (créé) et `miseEnLigne.test.ts` (créé): l'enchaînement de la mise en ligne et de la bascule, le monde extérieur injecté.
- `deploiement/vercel.ts`, `render.ts`, `monde.ts`, `patience.ts` (créés), `patience.test.ts` (créé): Vercel (lecture de la page, HTML compris), Render, git et routes de santé, patience des vérifications.
- `deploiement/deployer.ts`: réduit à son point d'entrée. `deploiement/basculer.ts` (créé): celui de la bascule.
- `deploiement/oracle.ts` et son test: plus de page ni de date, plus de point d'entrée; `miseEnLigneOracle`.
- `deploiement/verifications.ts` et son test: `serveurJointParLaPage`, la marque de la page exigée, la page toujours servie par Vercel.
- `deploiement/oracle/Dockerfile`, `deploiement/oracle/neon-ninja.sh`: l'image ne construit plus de page, `construire` ne prend plus de date.
- `.github/workflows/ci.yml`: un job « Mise en ligne » pour les deux serveurs, plus de job « Essai sur Oracle ». `.github/workflows/bascule.yml` (créé).
- `packages/client/scripts/sortieVercel.ts` et son test: `pageMarqueeDuServeur`.
- `packages/shared/src/version.ts`: 1.7.3.
- `docs/deploiement.md`: ce qui tourne où, la mise en ligne, la bascule (quand, comment, ses refus, quel serveur sert), la machine Oracle en production, ce qu'Oracle peut reprendre.
- `docs/plan/etape-5-13.md`: réconciliation. `docs/plan/etape-5-14.md` (créé). `docs/plan/ROADMAP.md`: l'entrée 5.14 et la clôture de 5.13 en section 5.

Hors du dépôt: `/etc/neon-ninja/environnement` sur la machine (base de production, `ORIGINES_AUTORISEES` de la page publique, `SERVIR_LA_PAGE=non`, `MANDATAIRES_DE_CONFIANCE=1`), `/usr/local/bin/neon-ninja` réinstallé.

Aucune modification de `legacy/`, de `tests/caracterisation/` ni de `packages/sim`.

## Tests

- Ajoutés: l'enchaînement de la mise en ligne (page non promue avant un serveur de la production vérifié, échec de la production sans promotion, échec du secours sans échec et annoncé sur une ligne, production qui suit la page, page qui ne joint aucun serveur refusée, page non conforme après promotion, production muette, commit de documentation, secours en retard rattrapé, secours à jour laissé); la bascule (vers Render et vers Oracle, page déjà sur la cible, serveur muet, serveur à une autre version, sources d'un autre commit, page non conforme); la marque de la page; le serveur joint par la page; la patience.
- Résultat: 3 615 tests unitaires au vert (suite complète); types des trois configurations et linter au vert.
- Couverture de packages/sim: inchangée, non touché.
- État de la CI: verte sur `f77cdc4` (37324675167) et sur `c0a2b2d` (37330153650), mise en ligne comprise. Production et secours servent `c0a2b2d`.

## Décisions et écarts au plan

Détail dans la section « Réconciliation » de la fiche.

- **La production suit la page** au lieu d'Oracle toujours en premier: sans cela, la poussée suivante annulait un retour vers Render, ou bloquait toute mise en ligne Oracle mort.
- **La bascule a son propre workflow**, un déclenchement manuel de `ci.yml` relançant tous ses jobs.
- **La première mise en ligne de l'étape s'est faite avec Render en production** (la page le joignait encore), Oracle mis à jour en secours sur la base de production; la bascule vers Oracle a été la bascule de la production.
- **La branche Neon `essai-oracle`** a été supprimée par le porteur du projet depuis la console Neon, le 5 octobre 2026: une suppression définitive de données ne se fait pas par la session.

## Problèmes connus et dette

- **Les accès de la session à la machine de production sont refusés** par le garde-fou de Claude Code (lecture comme écriture par SSH): toute manipulation de la machine passe par le porteur du projet, avec les commandes de `docs/deploiement.md`.
- **La récupération par Oracle** reste inconnue avant la fin de l'essai gratuit, vers le 3 novembre 2026 (étape 5.9). Si elle arrive: basculer vers Render.
- **Le secours Render dort**: après une bascule vers lui, le premier joueur attend 15 à 60 secondes.

## Prochaine action exacte

Exécuter l'étape `5.14`, une CI plus courte: lire `docs/plan/etape-5-14.md`. Vers le 10 novembre 2026, vérifier que la machine Oracle tourne toujours et clore la 5.9.

## Étape suivante

Fiche à lire: docs/plan/etape-5-14.md
