# Handoff - Étape 3.10 Les défis de la semaine

Date: 3 octobre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Chaque semaine, trois défis communs à tous les comptes, qui rapportent de l'XP une fois relevés, montrés à l'accueil et à la fin de partie.

## Ce qui a été fait

- **Fiche rédigée selon le cas de repli du PROTOCOLE** (`docs/plan/etape-3-10.md`), à partir de la demande du porteur du projet, de la maquette et du cadrage (question 7), commitée avant l'exécution, puis complétée d'une section de réconciliation.
- **Le paquet partagé** (`packages/shared/src/defis.ts`): trois familles (assiduité 300 XP, action 400, exploit 500), vingt-huit défis, la semaine d'un jour (lundi, heure de Paris), le tirage des trois défis d'une semaine par le générateur à graine, et l'avancée de chaque défi sur les parties de la semaine (somme, record, valeurs distinctes). Chaque réserve se parcourt dans un ordre tiré par cycle: un défi ne revient qu'une fois sa famille passée, et jamais deux semaines de suite, même d'un cycle au suivant.
- **Une partie compte** si elle est finie (elle a rapporté de l'XP) et réglée sur trois minutes au moins. Ce que disent les faits de partie ne compte qu'à plusieurs, comme pour les succès.
- **Un fait de partie de plus**, `bonusRamasses` (bonus et objets de poche), relevé par le serveur.
- **La base**: table `defis_releves` (compte, semaine, défi, XP versée, date, partie), migration `0013_defis.sql`. Le relevé se fait dans la transaction de fin de partie, après les gains et avant les succès: chaque défi atteint s'inscrit une fois, et son XP s'ajoute à la progression. Au réessai d'une partie déjà enregistrée, rien ne s'inscrit et le récapitulatif est le même.
- **L'XP des défis compte dans l'XP totale des succès** (`PartieDuParcours.xpDesDefis`): sans cela, un compte aurait affiché un niveau sans son succès.
- **Le récapitulatif de fin** porte `defis` (relevés par la partie, et les trois de la semaine). « XP gagnée » reste celle de la partie seule.
- **La route `GET /api/comptes/defis`**, réservée aux comptes: les trois défis de la semaine en cours, l'avancée du compte et la fin de la semaine, lues à l'heure de la base.
- **Le client**: un bloc « Défis de la semaine » sur l'accueil d'un compte (icône de famille, texte, récompense, jauge, bilan, temps restant), lu à l'ouverture de la session et à chaque arrivée sur l'accueil; à la fin de partie, les défis relevés en vert puis les trois de la semaine, et un avis quand la partie était réglée sur moins de trois minutes. Rien pour un invité.
- **Version 1.7.0**, avec sa note (`notesDeVersion.ts`).
- **Défaut corrigé en route** (règle 7): `tests/base/parties.test.ts` termine ses parties à une date tirée sur trente-cinq ans; une semaine dont un défi se relève en une partie aurait faussé les gains comptés au plus près. Ces tests finissent désormais dans une semaine sans tel défi; `progression-de-fin.test.ts` retire l'XP des défis éventuels.

## Fichiers créés ou modifiés

- `packages/shared/src/defis.ts` (créé) et ses tests; `succes.ts` (fait `bonusRamasses`, `dureeS` et `xpDesDefis` dans `PartieDuParcours`, l'XP des défis dans `xpTotale`); `evenements.ts` (`ProgressionEnregistree.defis`); `comptes.ts` (route `defis`); `index.ts`; `version.ts` (1.7.0).
- `packages/server/src/base/defis.ts` (créé): relever les défis, lire ceux de la semaine. `base/schema.ts`, `migrations/0013_defis.sql` et `meta/`: la table. `base/parties.ts`: défis puis succès dans la transaction de fin, et au réessai. `base/succes.ts`: l'historique lit la durée et l'XP des défis, filtrable par semaine; `attribuerLesSucces` accepte un historique déjà lu. `finDePartie.ts`: le récapitulatif. `releveDesExploits.ts`: `bonusRamasses`. `comptes/annuaire.ts`, `Authentification.ts`, `routes.ts`: la route. `index.ts`: les exports.
- `packages/client/src/comptes/api.ts`, `session.ts`, `etat.ts`, `actions.ts`, `reduction.ts`, `client.ts`: lire les défis. `interface/modeles/defis.ts` et `composants/defis.ts` (créés), `ecrans/accueil.ts`, `ecrans/fin.ts`, `modeles/fin.ts`, `modeles/notesDeVersion.ts`; `page/styles/composants.css`, `ecrans.css`.
- `tests/outils/comptes-en-memoire.ts`: les mêmes défis, en mémoire. `tests/base/defis.test.ts` (créé); `migrations`, `parties` et `progression-de-fin` adaptés. `tests/e2e/compte.spec.ts`.
- Tests unitaires du serveur et du client adaptés au nouveau champ et aux lectures de défis.
- Documentation: `docs/plan/etape-3-10.md` (créée), `docs/plan/ROADMAP.md`, `docs/design/README.md`, `docs/design/cadrage.md`, `docs/design/etape-3-10/` (captures), `CLAUDE.md` (une ligne), ce handoff.

Aucune modification de `legacy/` ni de `tests/caracterisation/`.

## Tests

- Ajoutés: partagé (semaine, tirage sur cinq cents semaines, cycles, avancée de chaque genre, parties qui ne comptent pas, XP des défis dans les succès de niveau); serveur (fait `bonusRamasses`, récapitulatif, route); base contre Neon (contraintes, relevé unique avec son XP, plusieurs défis d'une partie, réessai, semaine à l'heure de Paris, parties qui ne comptent pas, succès de niveau, semaine en cours); client (session, modèle, accueil, fin); bout en bout (accueil et fin d'un compte).
- Résultat: 3 655 tests au vert, base comprise; scénario de bout en bout du compte au vert.
- Couverture de packages/sim et shared: 99,79 pour cent des instructions; `defis.ts` à 100. packages/sim n'est pas touché.
- État de la CI: à vérifier après la poussée.

## Décisions et écarts au plan

- **Numéro**: d'abord commitée sous 8.11, la fiche est devenue 3.10, la phase 3 étant celle des comptes et de la progression.
- **Table `defis_releves`** et non `defis_accomplis`; faits de partie à plusieurs seulement; avis de partie trop courte ajouté; le bout en bout vérifie l'affichage, l'avancée étant éprouvée contre Neon. Détail dans la section de réconciliation de la fiche.
- **À soumettre au porteur du projet**: les récompenses (300, 400, 500 XP), la liste des vingt-huit défis et leurs seuils, et le texte de la note 1.7.

## Problèmes connus et dette

- Le temps restant de l'accueil ne se met à jour qu'au rafraîchissement de l'écran, pas à la minute.
- Le formatage local signale des fichiers en CRLF dans la copie de travail de cette machine, sans différence pour git.
- Rien d'autre.

## Prochaine action exacte

Vérifier la CI de la poussée de l'étape 3.10. Puis, à la demande du porteur du projet faite pendant l'étape: remplacer l'avant-plan de Spirit & Time (`assets/cartes/map3/foreground.png`) par le fichier qu'il fournit.

## Étape suivante

À décider par le porteur du projet. Les défis du jour restent à décider après usage des défis de la semaine.
