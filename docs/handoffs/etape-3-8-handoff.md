# Handoff - Étape 3.8 Les exploits de partie

Date: 27 septembre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Un compte débloque, à la fin d'une partie, les succès qui demandent un relevé pendant la partie (combo, Razzia, Évadé, secrets, Rassembleur), vus comme les autres à l'écran de fin, au profil et sur la fiche.

## Ce qui a été fait

- **La réunion de `3.7` et de `2.8`.** Les deux étapes avaient été menées en parallèle depuis la fin de `3.6`: au début de la session, la `2.8` était dans `master`, la `3.7` sur sa branche (`claude/etape-3-7-socle-succes-ikwb7u`). La `3.8` dépend de la `3.7`: sa branche a été fusionnée dans celle de cette session, quatre conflits résolus, `pnpm verify` vert avant d'aller plus loin (commit `5f5e360`). Pendant l'étape, la session de la `3.7` a fusionné sa branche dans `master` et l'a mise en ligne (`d68bc15`, `4125acb`): `master` a été fusionné à son tour dans cette branche, en reprenant ses textes.
- **Des marqueurs de conflit commités dans `master`** (`docs/design/README.md`, lignes 374 à 379, venus de `d68bc15`) sont retirés dans cette fusion (règle 7).
- **La fiche** `docs/plan/etape-3-8.md`, rédigée selon le cas de repli du PROTOCOLE, avec vingt et une décisions de conception.
- **Dix-huit succès de source « partie »**, qui portent le total à 47: Cadeau empoisonné et Rassembleur (Découverte); Razzia, Revanche, En chaîne, et les secrets Pas de chance et Arroseur arrosé (Habitué); Combo parfait, Intouchable, Coup de filet, Dernière proie, Table rase, Chasseur d'Évadé, Main leste, Double ou rien, et le secret Sur le fil (Expert); Collectionneur de fantômes et Seigneur de la Horde (Légende).
- **Les faits d'une partie** (`FAITS_DE_PARTIE`, seize noms), dans le paquet partagé: des observations chiffrées, jamais des conclusions. Le pli des succès les lit partie par partie, et combine un fait au mode, au placement et au nombre de joueurs (Intouchable: une victoire en Horde, à quatre au moins, avec « jamais pris »).
- **Le relevé d'exploits** (`packages/server/src/exploits.ts`), fonction pure: il lit le journal du moteur après chaque battement, et en garde compteurs, records et les deux instants qu'une revanche demande. À la fin, les faits de chaque joueur présent, plus trois lus dans l'état final: jamais pris, seule proie restante d'une Chasse, porteur du x2. La room le tient comme elle tient l'état.
- **Rassembleur**: `ReseauDesAmis.invitationServie` rend l'invitation servie, et la couche réseau dit à la room quel compte a fait entrer quel ami.
- **La table `faits_de_partie`** (migration `0010`), une ligne par fait non nul, clé étrangère vers le résultat du compte dans la partie, en cascade. Les faits s'écrivent dans la transaction de fin, après les résultats et avant l'attribution des succès, qui les lit. Un réessai n'écrit rien de plus. Un fait que le code ne connaît plus est ignoré.
- **Le client** ne change pas: le profil, la fiche et la fin lisent les définitions, et les secrets se lisaient déjà « ??? ».

Ni `packages/sim`, ni les règles de jeu, ni le transport ne changent.

## Fichiers créés ou modifiés

- Fusion de la `3.7`: `packages/client/src/interface/modeles/fiche.ts`, `tests/outils/comptes-en-memoire.ts`, `docs/plan/ROADMAP.md`, `docs/design/README.md` (conflits), `CLAUDE.md` (virgule).
- `packages/shared/src/succes.ts`: faits, `PartieDuParcours.faits`, mesures, définitions, unités. `index.ts`: exports. `succes.test.ts`.
- `packages/server/src/exploits.ts` et `exploits.test.ts` (créés).
- `packages/server/src/GameRoom.ts`: le relevé, `noterUnAmiRassemble`, `faitsDesJoueurs`.
- `packages/server/src/finDePartie.ts` et son test: les faits des présents.
- `packages/server/src/ServeurSocket.ts`, `amis/ReseauDesAmis.ts`, `ServeurSocket.amis.test.ts`: l'ami rassemblé.
- `packages/server/src/base/schema.ts`, `migrations/0010_faits_de_partie.sql`, `migrations/meta/`: la table.
- `packages/server/src/base/parties.ts`: l'écriture. `base/succes.ts`: la lecture dans l'historique.
- `tests/base/exploits.test.ts` (créé), `tests/base/migrations.test.ts`, `tests/outils/comptes-en-memoire.ts`.
- Client, tests seulement: `modeles/succes.test.ts`, `modeles/fiche.test.ts`, `composants/ficheJoueur.test.ts`, `ecrans/profil.test.ts` (47 succès, secrets réels).
- Documentation: `docs/plan/etape-3-8.md` (créée), `docs/plan/ROADMAP.md`, `docs/design/README.md` (journal), `docs/design/etude-succes.md` (statut), `docs/design/cadrage.md` (profil), `CLAUDE.md` (une ligne), ce handoff.

Aucune modification de `legacy/` ni de `tests/caracterisation/`.

## Tests

- Ajoutés:
  - partagé: chacun des 18 exploits juste sous et juste sur son seuil, les conditions de mode (le multiplicateur de En chaîne en Horde seule, celui de Combo parfait ni en Tactique, ni en Équipes, ni en Chasse), de placement et de nombre de joueurs, une partie sans faits, records et cumuls, la date d'un exploit;
  - serveur, sans base (`exploits.test.ts`, 20 cas): chaque fait, les fenêtres de trente et trois secondes et la dernière seconde juste dedans et juste dehors, la revanche consommée et celle prise sur un autre joueur, la table rase, les amis rassemblés comptés une fois, les faits de fin; et une Horde de quatre joueurs rejouée par graine, dont les prises par un Black Ninja et « jamais pris » recoupent les compteurs du moteur, et dont deux rejeux donnent le même relevé;
  - fin de partie: les faits des présents, aucun pour un abandon, l'ami rassemblé; couche réseau: une entrée par invitation fait écrire « Rassembleur » à la fin (le test échoue si le branchement est retiré, vérifié);
  - base (`tests/base/exploits.test.ts`, 7 cas): contraintes et cascade, écriture des seuls faits non nuls et « Cadeau empoisonné » annoncé, réessai, abandon, Intouchable, cumuls d'une partie à l'autre, fait retiré ignoré.
- Résultat: `pnpm verify` en local, 3 001 tests unitaires et d'intégration au vert (162 de plus qu'au handoff 3.7, ceux de la `2.8` compris), 117 sautés (base Neon absente). Tests de la base contre un PostgreSQL 16 du conteneur: 116 sur 117, le seul échec étant l'écart de version connu (`parties.test.ts`, `23503` contre `23001`). Bout en bout en local: 57 scénarios sur 58 en parallèle, bureau et mobile, en 5 minutes; le seul échec est le scénario du HUD de `peaufinage.spec.ts` sur mobile, au délai de 30 s, vert rejoué seul (18 et 21 s), comme au handoff 3.7.
- Couverture de packages/sim: inchangée, aucun code du paquet touché.
- État de la CI: le premier run (`36305404170`, sur `e3461f7`) a échoué avant tout test, l'API Neon refusant de créer la branche de test (`ROOT_BRANCHES_LIMIT_EXCEEDED`): deux runs de la session de la `3.7` en occupaient au même moment. **Verte sur `8999feb`** (run `36305724405`), qui porte le même code et la fusion de `master`: tests de la base Neon compris, tous les scénarios de bout en bout, sans relance. Mise en ligne sautée: la branche n'est pas `master`.

## Décisions et écarts au plan

1. **La branche de la `3.7`, puis `master`, sont fusionnés dans celle de cette session.** Sans la `3.7`, pas de socle. La branche part désormais du `master` en ligne: sa fusion dans `master` est une avance rapide, qui met en ligne la migration `0010` et les exploits.
2. **Les décisions de conception de la fiche** (21), aucune soumise au porteur du projet. Les plus visibles: une prise est une capture, une infection ou une élimination; « Sur le fil » veut la dernière seconde du temps réglé, pas la prise qui termine une Chasse avant l'heure; « Table rase » revient à qui a frappé au battement où la carte s'est vidée; « Coup de filet » compte les joueurs pris dans le cône, le moteur ne les distinguant pas des ninjas; Rassembleur compte une fois chaque ami, et seulement si la partie se termine avec l'inviteur.
3. **Les paliers que l'étude ne donnait pas**: Rassembleur en Découverte, Pas de chance et Arroseur arrosé en Habitué, Sur le fil en Expert.
4. **La définition de terminé** demandait « Cadeau empoisonné » annoncé à la fin d'une partie où un malus est ramassé. Il est vérifié dans la transaction en base, et par le pli des comptes en mémoire; pas par une vraie partie, où ramasser un malus ne se provoque pas sans piloter le hasard. Le relevé du malus, lui, est vérifié à part.
5. **Écart de branche**, comme aux étapes précédentes: branche imposée `claude/presence-invitations-amis-eaicev`. Son nom vient d'une demande initiale d'exécuter la `2.8`, déjà faite et dans `master`: la session l'a signalé, et le porteur du projet a demandé la `3.8`.

## Problèmes connus et dette

- **Un seul processus serveur**, comme pour les parties et la présence: le relevé vit dans la room.
- **Tests de la base en local**: un PostgreSQL 16 du conteneur et une configuration Vitest hors dépôt, comme aux étapes 3.6 et 3.7. Seul écart, connu: `parties.test.ts`.
- **Playwright en local**: le dépôt attend Chromium 1234, le conteneur a le 1194. Un lien de l'un à l'autre (`chrome-headless-shell-linux64`), hors dépôt, a suffi.

## Prochaine action exacte

1. **Le porteur du projet**: fusionner cette branche dans `master` (avance rapide), ce qui met en ligne la `3.8`. Ce qui reste de la `3.7` ne change pas (handoff 3.7): `pnpm base:rattraper` une fois avec l'adresse de production, et `pnpm base:mesurer` un mois après la mise en ligne. Les exploits, eux, ne se rattrapent pas.
2. **La session suivante**: exécuter l'étape `3.9`, le titre. Rédiger sa fiche selon le cas de repli du PROTOCOLE, à partir de l'entrée 3.9 du ROADMAP et de la décision 1 de l'étude des succès.

## Étape suivante

Fiche à lire: `docs/plan/etape-3-9.md`, à rédiger au début de l'étape (cas de repli du PROTOCOLE).
