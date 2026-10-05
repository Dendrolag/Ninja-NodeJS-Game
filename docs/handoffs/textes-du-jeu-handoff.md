# Handoff - Hors étape: les textes du jeu et l'historique des nouveautés

Date: 5 octobre 2026
Auteur: session Claude Code
Statut: terminée

Travail hors plan, demandé par le porteur du projet en parallèle de l'étape 5.9 (Oracle), qui suit son propre cours.

## Objectif

Revoir les textes du jeu avec le porteur du projet (plus courts, un ton décalé, sans tout expliquer pour laisser le plaisir de la découverte), et permettre de relire les notes de version précédentes, pas seulement la dernière.

## Ce qui a été fait

- La fenêtre de la note de version devient « Nouveautés » et fait défiler toutes les notes parues, la plus récente en tête, chacune sous « numéro · titre » (« 1.6 · On a marché sur la Lune »). Le numéro du pied de l'accueil la rouvre. Elle s'ouvre toujours d'elle-même, une fois, au joueur qui revient et n'a pas lu la version servie.
- Les notes 1.5, 1.6 et 1.7 sont réécrites: une ligne par nouveauté, un titre par note. Bouton « À l'attaque » au lieu de « Compris ».
- L'aide « Comment jouer » est réécrite: principe, une section à part pour les Black Ninjas, l'Évadé laissé à découvrir (son x2 n'y est plus), règles de chaque mode raccourcies, la mine sans ses effets par mode, objets du Tactique et zones en une ligne. Les petits nombres s'écrivent en lettres, toujours tirés des constantes.
- Le rappel du salon de chaque mode (CAPTURES_DES_MODES) est raccourci.
- Six descriptions de succès revues: Premier pas, Cadeau empoisonné, Pas de chance, Revanche, Arroseur arrosé, Sur le fil.
- Le nouvel avant-plan de Spirit & Time, retouché par le porteur du projet dans `assets/cartes/map3/foreground.png`, est commité (mêmes dimensions, 2400 x 1760).

## Fichiers créés ou modifiés

- `packages/client/src/interface/modeles/notesDeVersion.ts`: une note porte un titre et des puces, sans sections; nouveaux textes; `notesParues` rend l'historique jusqu'à la version servie (1.10 se range après 1.9).
- `packages/client/src/interface/composants/noteDeVersion.ts`: `monterNouveautes` remplace `monterNoteDeVersion` et affiche toutes les notes.
- `packages/client/src/interface/souvenirDeVersion.ts`: le souvenir porte `historique`.
- `packages/client/src/interface/ecrans/accueil.ts`: le pied rouvre l'historique.
- `packages/client/src/interface/composants/aide.ts`: nouveaux textes, `enLettres` et `rangEnLettres`.
- `packages/client/src/interface/modeles/cartes.ts`: rappels du salon raccourcis. Les accroches des modes (`TEXTES_DES_MODES`) ne changent pas, à la demande du porteur du projet.
- `packages/shared/src/succes.ts`: six descriptions.
- `assets/cartes/map3/foreground.png`: nouvel avant-plan.
- Tests suivis: `noteDeVersion.test.ts`, `notesDeVersion.test.ts`, `souvenirDeVersion.test.ts`, `application.note.test.ts`, `aide.test.ts`, `salon.test.ts`, `fiche.test.ts`, `fin.test.ts`, `succes.test.ts` (client), `tests/e2e/note-de-version.spec.ts`, `tests/e2e/tactique.spec.ts`.

## Tests

- Ajoutés: l'ordre et le contenu de l'historique (`notesParues`, fenêtre, souvenir), les nombres en lettres de l'aide et l'ordre de ses sections.
- Résultat: 3 554 tests unitaires au vert; bout en bout `note-de-version` et `tactique` au vert. Un test unitaire a échoué une fois au premier passage de la suite complète, sans que le rapport filtré ne dise lequel, puis la suite est passée trois fois de suite: intermittent, non identifié.
- Couverture de packages/sim: inchangée, rien n'y a été touché.
- État de la CI: verte sur `24b6283` (types, linter et tests, bout en bout, mise en ligne, essai sur Oracle).

## Décisions et écarts au plan

- Le ton des textes, arrêté le 5 octobre 2026: une note de version annonce sans expliquer; l'aide dit ce qu'il faut pour jouer, pas tout. Écrit en tête de `notesDeVersion.ts` et `aide.ts`.
- Les succès gardent leurs autres textes, et les défis restent factuels (décision du porteur du projet).
- « Arroseur arrosé » dit « Être pris moins de 3 secondes après avoir pris quelqu'un », texte du porteur du projet; le jeu ne compte qu'une prise par un joueur, pas par un Black Ninja. Signalé, laissé tel quel.

## Problèmes connus et dette

- Le test intermittent ci-dessus, à identifier s'il revient.
- Pas encore relus: les annonces en cours de partie (« L'Évadé rôde ! ») et l'écran de fin.

## Prochaine action exacte

Rien d'ouvert sur ce sujet. Reprendre l'ordre du ROADMAP.
