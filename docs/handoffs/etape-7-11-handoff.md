# Handoff - Étape 7.11 La mine posée

Date: 2 octobre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Un second objet de poche, la mine: le joueur qui la ramasse la pose sous ses pieds quand il le veut; un adversaire ou un Black Ninja qui passe dessus l'arme, et elle explose un instant plus tard, avec un effet propre à chaque mode.

## Ce qui a été fait

- **Faite dans la conversation de l'étape 7.10**, à la demande du porteur du projet, après les ajustements de recette de la fumée (écart de méthode à la règle 6, comme pour 4.6, 7.9 et 7.10).
- **Le contrat** (`packages/shared`): `MINES` (1,5 s, 130 px, seuil d'armement de 20 px, 15 pour cent, trois par joueur, arme enrayée 3 s); la mine dans `TYPES_OBJETS_DE_POCHE`, réglage `objetsDePoche.mine` (actif, 15 pour cent par défaut, le taux de la fumée); l'entité `mine` du flux d'état, en fin de `TYPES_ENTITE`, avec son poseur et son armement, et son codage binaire; les faits `minePosee` (au poseur), `mineArmee` et `mineExplosee` (à tous); deux sons provisoires; le pictogramme `assets/objets/mine.svg`.
- **Le moteur** (`packages/sim/src/mines.ts`, créé): la pose et le plafond de trois; les mines retirées au départ du poseur, gardées à sa capture; l'armement par un adversaire (celui qu'un malus du poseur frapperait) ou un Black Ninja; l'explosion après 1,5 s, sur tout ce qui est à 130 pixels au plus, sans réaction en chaîne; les effets par mode: 15 pour cent des ninjas et de la réserve, combo retombé (Horde, Tactique, Équipes, choisis comme face à un Black Ninja), la mort et la moitié des points au poseur (Massacre, sans délai ni combo, faux ninjas, Black Ninjas et Évadé compris, carte vidée au dernier), 15 pour cent de la distance d'une proie et l'arme enrayée d'un traqueur (Chasse); les Black Ninjas tués et leurs 15 points; l'invincibilité et la protection d'apparition qui en protègent. Les mines sautent après l'action du mode, avant les contacts.
- **Le serveur**: les mines dans l'instantané, les trois notifications, une mine qui tue en Massacre comptée comme une prise par le relevé des exploits.
- **La page**: le rendu choisi sur planche (`packages/client/src/rendu/mines.ts`, créé, et deux calques de PixiJS); les annonces (grand titre de la victime, bulle du poseur); les points flottants (gain du poseur, perte de la victime en Horde); les sons; l'aide; le récapitulatif du salon; le rappel de la touche E; le repère de localisation après une mort par mine.
- **La planche** `docs/design/etape-7-11/1-mine.png`, rendus retenus A, A, B, B, A.
- **Hors étape, demandé pendant l'étape**: une planche des zones, `docs/design/etape-7-12/1-zones.png` (trois rendus, trois tailles fixes), consignée dans la fiche 7.12. Le porteur du projet a choisi le rendu B, motif vivant, et 220 pixels de rayon.
- **Défaut corrigé en route**: le rappel des touches passait sous le temps restant à 1 280 pixels de large, déjà depuis la fumée.

## Fichiers créés ou modifiés

- `packages/shared`:
  - `constantes.ts`: `MINES`, la mine dans `TYPES_OBJETS_DE_POCHE`;
  - `reglages.ts`: le réglage par défaut de la mine;
  - `evenements.ts`: `MineVue` dans `EntiteVue`, `MinePoseeVue`, `MineArmeeVue`, `MineExploseeVue`, `ToucheParUneMine`, les trois messages;
  - `flux.ts`: la mine dans `TYPES_ENTITE`, son codage (poseur, armement);
  - `ressources.ts`: l'icône de la mine, les sons `minePosee`, `mineArmee` et `mineExplosee`;
  - `index.ts`: les exports;
  - tests: `flux.test.ts` (aller-retour image et deltas, coût nul d'une mine immobile, trame refusée), `validation.test.ts` (réglage).
- `packages/sim`:
  - `mines.ts` (créé) et `mines.test.ts` (créé, 41 cas);
  - `etat.ts`: `MineSurLaCarte`, `minesPosees`, les trois faits, `avecLesMines`, les mines retirées au départ du poseur;
  - `poche.ts`: `SERVIR.mine`;
  - `moteur.ts`: les mines dans le battement;
  - `bots.ts`, `equipes.ts`: la part perdue en paramètre de `PerteFaceAuBotNoir`;
  - `massacre.ts`: `mettreAMort`, partagé par `tuerUnJoueur` et `tuerParUneMine`; `tuerUnBotParUneMine`; `viderLaCarteSiElleEstVide`;
  - `horde.ts`: `amputerLaReserve`; `chasse.ts`: `enrayerLArme`, `amputerLeParcours`;
  - `index.ts`: les exports;
  - tests: `partie.test.ts` (quatrième partie de référence, avec la mine, et la mine coupée dans les autres), `moteur.test.ts`, `objets.test.ts`, `objetsTactiques.test.ts`, `poche.test.ts`, `massacre.test.ts` (la mine coupée là où les tests supposaient qu'aucun objet de poche ne sort; `moteur.test.ts` en dépendait déjà pour la fumée sans le dire).
- `packages/server`:
  - `instantane.ts`: `minesVues`, les trois notifications;
  - `ServeurSocket.ts`: leur envoi;
  - `releveDesExploits.ts` et son test: la mine qui tue prend;
  - `ServeurSocket.mine.test.ts` (créé): la mine à travers le vrai serveur, en Horde et en Massacre.
- `packages/client`:
  - `rendu/mines.ts` et `rendu/mines.test.ts` (créés); `rendu/scene.ts` (champs `mines` et `explosions`, la mine exclue des personnages), `rendu/pixi.ts` (calque des mines, explosions avec les nuages), `rendu/apparence.ts` (`APPARENCE_MINE`, la couleur de l'objet), `rendu/boucle.ts` (repère après une mort par mine);
  - `faits.ts`, `client.ts`: les trois faits;
  - `annonces.ts`, `pointsFlottants.ts`, `sons/declencheurs.ts`: annonces, points, sons;
  - `interface/composants/aide.ts`, `interface/modeles/salon.ts`, `interface/modeles/touches.ts` (créé), `interface/ecrans/jeu.ts`: aide, récapitulatif, rappel de la touche;
  - `page/styles/jeu.css`: le genre de point `perte`, le rappel des touches qui ne passe plus sous le temps;
  - tests: `annonces.test.ts`, `pointsFlottants.test.ts`, `sons/sons.test.ts`, `rendu/scene.test.ts`, `rendu/boucle.test.ts`, `interface/modeles/salon.test.ts`, `interface/modeles/touches.test.ts` (créé).
- `assets/objets/mine.svg` (créé): le pictogramme.
- `tests/e2e`: `mine.spec.ts` (créé); `harnais/parcours.ts` (`ramasserUnObjetDePoche`); `poche.spec.ts` (mine coupée); `rendu-couleurs.spec.ts`, `rendu-miroir.spec.ts`, `rendu-pluie.spec.ts` (les deux champs nouveaux de la scène).
- `tests/charge`: `empreinte.ts` (`--sans-mine`, `--sans-poche` coupe les deux objets); `battement.ts`, `battement-isole.ts`, `charge.ts` (`--mines`).
- Documentation: `CLAUDE.md` (précisions datées des comportements 1 et 3), fiche 7.11 (réconciliation), fiche 7.12 (demande sur les zones), ROADMAP, journal de conception, `docs/mesures/charge-serveur.md` (section 22) et `charge-serveur-7-11-mines.json` (créé), planches `docs/design/etape-7-11/1-mine.png` et `docs/design/etape-7-12/1-zones.png` (créées), handoff 7.10 (ligne de CI des ajustements), ce handoff.

Aucune modification de `legacy/` ni de `tests/caracterisation/`.

## Tests

- Ajoutés: voir la liste ci-dessus. Pour le moteur: la pose et le plafond, le départ et la capture du poseur, l'armement (adversaire, seuil strict, ni poseur, ni coéquipier, ni faux ninja, ni Évadé, Black Ninja, joueur protégé), le délai exact, le rayon bord compris, celui qui passe et celui qui suit, aucune réaction en chaîne, chaque mode, les protections, les Black Ninjas, le x2, l'Évadé, la carte vidée, la Chasse et son camp, les cas limites.
- Résultat: 3 210 tests unitaires et d'intégration au vert en local (`pnpm verify`: types, linter, tests), formatage vérifié; les tests de la base sautés en local, joués par la CI. `ServeurSocket.mine.test.ts`: stable sur dix passages, et sous la charge de la couverture. Bout en bout: `mine.spec.ts` et `poche.spec.ts`, 4 sur 4 dans les deux cadrages; la suite entière: voir la ligne ajoutée après la poussée.
- Couverture de packages/sim: 99,83 pour cent des instructions et 99,04 des branches, contre 99,81 et 98,93 au handoff 7.10 (`mines.ts` 100 et 100).
- Empreinte des parties de référence, mine coupée (`--sans-mine`): identique à l'octet à celle du handoff 7.10, jeu et flux, pour les quatre parties. `--sans-poche`: identique à celle du handoff 7.9.
- Nouvelles empreintes, mine active (réglages par défaut):
  - 150 bots, 12 joueurs, murs: jeu `fcb5fc101b6c6c3efcdb4f4ea22cc1c2b2d5b787d56381f4b726a769849fa8ad`, flux `fae08658a75f07af6223ae6ddf43e9dd3de71d9cf9285aafa4eccaf4bb1041f2`
  - 50 bots, 12 joueurs, murs: jeu `57e939f3fef63877a35e1d215bb656c020c72792d4a902c36168b14ff299d2a5`, flux `241d75b34d1ce8158fd95c4c4814f457c22c13bb6b67e119186d5c427abe44d1` (deux mines posées)
  - 300 bots, 12 joueurs, sans mur: jeu `2cbfbf1245b9ccb784ab6099412839ba5ae3cc95f33b117aafe7a348f5cde146`, flux `95dca1224a84a5089f5d7f0145da9e1cbda401300326220a9caff59e46dfb398`
  - 150 bots, 2 joueurs, murs: jeu `c8262daf6e34aeb460506678db5ee656fe1960b336cfcd121fd7ebd25e3426f1`, flux `65d19806875b5bf075fed273f8bbc2c4913805f513cf27dcde697f13acd16350`
- Banc: trente-six mines coûtent environ 0,03 ms par battement au moteur à 50 faux ninjas, rien de lisible à 300, et 8 octets par message. Section 22 de `docs/mesures/charge-serveur.md`.
- État de la CI: voir la ligne ajoutée en fin de handoff après la poussée.

## Décisions et écarts au plan

1. **Écart de méthode, demandé par le porteur du projet**: l'étape s'est faite dans la conversation de l'étape 7.10.
2. **Rendus A, A, B, B, A**, choisis sur la planche.
3. Les autres écarts de construction sont à la section « Réconciliation » de la fiche: le seuil d'armement, l'adversaire lu par `victimeDuMalus`, la part perdue en paramètre, la mort par mine sans délai ni combo et comptée comme prise, le flux, les faits et les sons, les annonces et les points flottants, l'aide en un paragraphe, le rappel de la touche, le banc et l'empreinte, le test du serveur sans base.
4. **Le Massacre et la base**: le lot C demandait les points d'une mort par mine enregistrés en base. Rien de la mine ne change le chemin de l'enregistrement (le classement de fin): le test passe par le vrai serveur, sans base.

## Problèmes connus et dette

- **Quatre sons sont provisoires**, et le porteur du projet a les siens, qu'il n'avait pas sous la main: la fumée (`SONS.fumee`, le souffle du katana), la pose de la mine (`SONS.minePosee`, le clic des boutons), son armement (`SONS.mineArmee`, le tic du compte à rebours) et son explosion (`SONS.mineExplosee`, le Black Ninja détruit). Pour chacun: déposer le fichier dans `assets/sons/`, et changer le nom dans `SONS` (`packages/shared/src/ressources.ts`); le test des ressources vérifie que le fichier existe.
- **Le délai de 1,5 seconde est à juger en jouant**: à vitesse égale, un poursuivant collé au joueur qui arme la mine en sort aussi; c'est celui qui suit de loin qui y reste (fiche, réconciliation, point 16).
- Rien d'autre.

## Prochaine action exacte

D'abord, **rappeler au porteur du projet les quatre sons provisoires** (la fumée, la pose, l'armement et l'explosion de la mine). Puis exécuter l'étape `7.12`, les mines de zone: lire `docs/plan/etape-7-12.md`, sa section « Demande du porteur du projet, consignée le 2 octobre 2026 » (zones au rendu B, motif vivant, et à 220 pixels de rayon), réconcilier avec la mine posée (`packages/sim/src/mines.ts`, l'entité `mine` du flux, `rendu/mines.ts`), et commencer par la planche de la mine de zone.

## Étape suivante

Fiche à lire: docs/plan/etape-7-12.md
