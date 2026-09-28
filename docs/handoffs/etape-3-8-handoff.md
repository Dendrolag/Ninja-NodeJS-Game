# Handoff - Étape 3.8 Les exploits de partie

Date: 28 septembre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Un compte débloque, à la fin d'une partie, les succès qui demandent un relevé pendant la partie (exploits, secrets, « Rassembleur »). Le serveur relève ces faits à chaque battement, sans toucher `packages/sim`, les enregistre avec la partie, et les succès s'en déduisent par le même pli que ceux de l'étape 3.7.

## Ce qui a été fait

- **La fiche** `docs/plan/etape-3-8.md`, rédigée selon le cas de repli du PROTOCOLE, vingt-deux décisions de conception.
- **Un relevé d'exploits**, fonction pure du serveur (`releveDesExploits.ts`): il lit `etat.evenements` après chaque battement et rend le relevé suivant, sans rien muter; un battement sans événement rend le même relevé. Il compte par clé stable, le compte d'un joueur qui en a un, la connexion d'un invité: un compte qui part et revient retrouve son relevé. Il retient malus ramassés, plus grosse razzia, revanches (30 s), plus haut multiplicateur, ninjas ralliés, meilleur tir, carte vidée, Évadés attrapés, x2 volés, prises par un Black Ninja, prises sur le fil (dernière seconde du chronomètre), arroseur arrosé (3 s). Les faits de fin s'y ajoutent: `intouchable` (Horde, jamais pris), `derniereProie`, `finiAvecLeDoubleur`.
- **La room** fait avancer le relevé après chaque `tick`, retient dès le salon les amis entrés par invitation (`retenirUneInvitationServie`), et rend par `exploits()` les faits de chaque compte présent à la fin. Un abandon n'en a pas. `invitationServie` rend désormais l'invitation, et la couche réseau la signale à la room.
- **Une table `faits_de_partie`** (migration `0011`): une ligne par fait non nul, clé étrangère composée vers le résultat (partie, compte), en cascade, identifiant contrôlé par sa forme, valeur strictement positive. Les faits s'écrivent dans la transaction de fin, après les résultats et avant l'attribution des succès, qui les lit avec l'historique. Un fait que le code ne connaît plus est ignoré.
- **Le pli** (`packages/shared/src/succes.ts`) lit `PartieDuParcours.faits`, facultatif, et en tire dix-sept mesures. Les conditions croisées (Horde d'au moins quatre joueurs gagnée, Chasse d'au moins quatre, victoire à plusieurs avec le x2, x3 en Horde seulement, tir en Tactique seulement) vivent dans le pli.
- **18 succès nouveaux**, 47 en tout (8 Découverte, 15 Habitué, 17 Expert, 7 Légende), dont les trois secrets. Ils sont annoncés en fin de partie, rangés au profil, montrés sur la fiche et deviennent des titres possibles sans aucun changement de l'affichage.
- **La page** lit les définitions sans substitution: le test qui injectait un secret en éprouve de vrais.

Ni `packages/sim` ni les règles de jeu ne changent.

## Fichiers créés ou modifiés

- `packages/shared/src/succes.ts`: faits de partie (`FAITS_DE_PARTIE`, `estUnFait`, `FaitsDePartie`), `JOUEURS_POUR_UN_EXPLOIT`, `PartieDuParcours.faits`, les mesures, les 18 définitions. `index.ts`: les exports.
- `packages/server/src/releveDesExploits.ts` (créé): le relevé et les faits de fin.
- `packages/server/src/GameRoom.ts`: le relevé, les invitations servies, `exploits()`.
- `packages/server/src/amis/ReseauDesAmis.ts`, `ServeurSocket.ts`: l'invitation servie rendue et signalée à la room; les faits transmis à l'annuaire.
- `packages/server/src/finDePartie.ts`: `FinPourLesComptes.faits`. `comptes/annuaire.ts`, `comptes/Authentification.ts`: le paramètre `faits`.
- `packages/server/src/base/schema.ts`, `migrations/0011_faits_de_partie.sql` et `meta/` (drizzle-kit, nommée par `--name`): la table. `base/parties.ts`: l'écriture. `base/succes.ts`: la lecture avec l'historique.
- `packages/server/src/index.ts`: les exports, et l'en-tête complété des étapes 3.7 à 3.9, qui s'arrêtait à 3.6.
- `packages/client/src/interface/modeles/succes.ts`: plus de définitions injectées. `modeles/fiche.ts`: un commentaire.
- `tests/outils/comptes-en-memoire.ts`: les faits gardés et pliés, comme en base.
- Documentation: `docs/plan/etape-3-8.md` (créée), `docs/plan/ROADMAP.md` (étape terminée, prochaine `4.7`), `docs/design/README.md` (journal), `docs/design/cadrage.md` (profil, et la ligne « Succès » du tableau de portée, qui les disait encore après la v1), `docs/design/etude-succes.md` (statut, précisions de l'étape), ce handoff.

Aucune modification de `legacy/` ni de `tests/caracterisation/`.

## Tests

- Ajoutés:
  - partagé: chaque succès nouveau juste sous et juste sur son seuil, les règles croisées, une partie sans faits qui ne donne aucun exploit, cumuls et records, secrets sans progression, faits nommés comme la base l'exige;
  - serveur: le relevé (`releveDesExploits.test.ts`, 33 cas: chaque fait, revanche dans et hors délai, consommée, contre un invité, au katana; arroseur arrosé à sa borne; sur le fil à sa borne et pas sur une Chasse finie avant l'heure; faits de fin par mode; un battement vide rend le même relevé; le relevé suivi par compte); la room (`GameRoom.exploits.test.ts`: une Horde rejouée par graine dont chaque ralliement est compté, déterminisme, abandon, retour par une autre connexion, invitations servies); `finPourLesComptes`; l'invitation servie par le réseau jusqu'à la room; les faits transmis à l'annuaire;
  - base (`tests/base/exploits.test.ts`, 8 cas contre une branche Neon): les contraintes de la table, la cascade par le compte, l'écriture et l'annonce datée, les cumuls d'une partie à l'autre, le réessai qui n'écrit rien, une partie refusée en entier pour un fait sans résultat, un fait retiré ignoré, le rattrapage sans exploit; `migrations.test.ts` connaît la table;
  - client: le profil avec trois secrets en « ??? », « Pas de chance » avant et après obtention, 47 succès.
- Résultat: 3 056 tests unitaires et d'intégration au vert en local (`--project unitaires`); les tests de la base sautés en local (pas de clés Neon dans cette session), joués par la CI; bout en bout des comptes, du titre, de la fiche, des amis en direct et du multijoueur au vert en local (6 sur 6, en cadrage bureau, avec le Chromium préinstallé de la machine).
- Couverture de packages/sim: inchangée, aucun code du paquet touché.
- État de la CI: **verte sur `5e1ea2a`** (run `36391653211`) du premier coup, sans relance: 3 184 tests (3 056 unitaires, 128 de la base contre une branche Neon neuve, dont les 8 de `exploits.test.ts`), puis les scénarios de bout en bout. La mise en ligne est sautée hors de `master`: rien de l'étape n'est en production.

## Décisions et écarts au plan

1. **Aucune décision soumise au porteur du projet.** Tranchées dans la fiche, à relire: une prise (Revanche, Sur le fil, Arroseur arrosé) est une prise de joueur, pas par un Black Ninja; « Sur le fil » se lit au chronomètre; « Table rase » va à tous les présents, faute d'auteur publié par le moteur; « Coup de filet » compte joueurs et ninjas, comme le moteur; « Rassembleur » demande de finir la partie et se range en Habitué; les secrets en Découverte, Habitué et Expert.
2. **Les faits d'absence sont positifs** (`intouchable`), pour qu'une partie d'avant le relevé ne passe pas pour une partie sans prise. Sans cela, le rattrapage aurait donné « Intouchable » à toute victoire de Horde à quatre.
3. **`exploits()` à part du bilan**, plutôt qu'un champ de `JoueurDuBilan`: le bilan dit la place et le temps, et ses tests figent sa forme.
4. **Écart de branche**: le PROTOCOLE dit de pousser sur `master`. Cette session avait pour consigne de travailler sur `claude/exploits-partie-etape-3-8-brf71c`. Pendant ce temps, l'étape `4.7` (les crédits) a été avancée et faite sur `master`. Sur demande du porteur du projet, `master` a été fusionnée dans la branche (un seul conflit, au ROADMAP, résolu dans l'ordre réel: `4.7`, puis `3.8`), puis la branche dans `master`. Le porteur du projet a demandé que ce soit désormais la règle: consignée dans le PROTOCOLE, cadre permanent.
5. **Bout en bout sans scénario propre**: un exploit ne se provoque pas de façon fiable dans une partie pilotée par Playwright, et l'affichage n'a pas changé. La chaîne complète est couverte par la room rejouée par graine, la fin de partie, et la base.

## Ajustements du 28 septembre 2026

Une seconde session (branche `claude/exploits-partie-etape-3-8-kn9v33`) avait construit la même étape en parallèle, sans le savoir. Sa branche ne se fusionnait pas: même migration `0011`, même table, faits nommés autrement. Le porteur du projet a comparé les deux et retenu, sur `master`:

1. **Les exploits ne comptent que dans une partie à plusieurs**, Massacre seul compris (pli, `packages/shared/src/succes.ts`). Les faits d'une partie seule s'enregistrent toujours.
2. **« Pas de chance » en Habitué** au lieu de Découverte: 7 Découverte, 16 Habitué, 17 Expert, 7 Légende.
3. **« Coup de filet » ne compte que les ninjas** d'un tir, comme sa description: nouveau fait `meilleurFilet`, déduit dans le relevé (`releveDesExploits.ts`) des prises qui précèdent le tir dans le battement, et gardé par un test contre le vrai moteur.
4. **« Table rase » demande d'avoir tué** au moins un ninja: nouveau fait `tableRase`.
5. **Les faits `meilleurTir` et `carteVidee` sont retirés**, noms à ne jamais reprendre. Les lignes écrites sous ces noms en production s'ignorent à la lecture, les succès déjà inscrits restent.
6. **Un scénario de bout en bout** (`tests/e2e/exploits.spec.ts`, bureau seulement): Alice invite Bob, ils jouent, et « Rassembleur » s'annonce à la fin pour Alice seulement. La décision 5 de ce handoff (pas de scénario propre) ne tient plus: « Rassembleur » s'obtient à coup sûr.

Fichiers: `packages/shared/src/succes.ts` et son test, `packages/server/src/releveDesExploits.ts` et son test, `packages/client/src/interface/modeles/succes.test.ts`, `ecrans/profil.test.ts`, `tests/base/exploits.test.ts` (parties à deux, et un cas qui fige la règle des parties seules), `tests/e2e/exploits.spec.ts` (créé), `playwright.config.ts`, `docs/plan/etape-3-8.md`, `docs/plan/ROADMAP.md`, `docs/design/README.md`, `docs/design/etude-succes.md`, ce handoff. La branche parallèle est abandonnée.

## Problèmes connus et dette

- **Playwright et le Chromium de cette machine**: le dépôt épingle Playwright 1.62, dont le navigateur n'est pas celui préinstallé ici. Les scénarios ont été joués par une configuration temporaire, hors dépôt, qui pointe vers `/opt/pw-browsers/chromium`. Effet de l'environnement, pas du dépôt: la CI installe son navigateur.
- Rien d'autre.

## Prochaine action exacte

Aucune étape planifiée ne reste ouverte: `4.7` et `3.8` sont faites. Demander au porteur du projet la suivante. Un mois après la mise en ligne des succès, lui rappeler le relevé de rétention (`pnpm base:mesurer`, `docs/mesures/retention.md`).

## Étape suivante

Aucune: la prochaine étape se décide avec le porteur du projet, puis s'inscrit au ROADMAP.
