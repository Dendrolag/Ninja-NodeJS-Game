# Handoff - Hors étape: ramassage au disque, camouflage face aux Black Ninjas, statistiques de fin par mode

Date: 9 octobre 2026
Auteur: session Claude Code
Statut: terminée

Travail hors plan, demandé par le porteur du projet en parallèle de l'étape 7.20 (Among Ninjas), qui se poursuit dans une autre session sur le `master` local. Fait dans un worktree à part (`.claude/worktrees/optimisations`, branche `optimisations-jeu`, partie d'`origin/master`), comme Prison Island (8.11), pour ne pas toucher au `master` local de l'étape 7.20.

## Objectif

Trois demandes du porteur du projet:

1. Un bonus ou un malus se ramasse en touchant le cercle coloré dessiné sous l'objet, et plus seulement l'icône.
2. La zone d'invisibilité cache aussi aux Black Ninjas et à l'Évadé les joueurs et les PNJ qui s'y tiennent, en plus de ce qu'elle faisait (cacher aux autres joueurs et à leur Révélation).
3. Le classement final montre des statistiques propres au mode joué (en Massacre: PNJ massacrés, joueurs massacrés, Black Ninjas, plus haut combo, Évadé attrapé), sans le badge « x2 » de l'Évadé à côté des pseudos, et la marche à suivre est documentée pour les modes à venir.

## Ce qui a été fait

- Ramassage: `OBJETS.SEUIL_RAMASSAGE_PX` passe de 15 à 38 pixels entre les centres, soit le rayon du disque (`OBJETS.RAYON_DU_DISQUE_PX`, 22, nouveau) plus le rayon d'une entité (`RAYON_ENTITE`, 16). La page dessine le disque avec la même constante (`RAYON_HALO_OBJET`).
- Camouflage: un Black Ninja ne choisit plus un joueur ni un PNJ caché dans une zone d'invisibilité, et lâche la proie qui s'y réfugie (`bots.ts`); l'Évadé ne fuit plus un joueur caché (`evade.ts`). Les deux lisent `estCache` de `zones.ts`. Les zones ne se consultent que pour un candidat déjà à portée. L'aide de la page le dit.
- Statistiques de fin: définitions et colonnes par mode dans `packages/shared/src/statistiquesDeFin.ts` (en-tête: comment ajouter un mode), calcul au serveur à la fin dans `packages/server/src/statistiquesDeFin.ts` (`GameRoom.statistiques()`), envoi avec le classement dans `partieTerminee` (`FinDePartie.statistiques`, facultatif), affichage par la page (`modeles/fin.ts`, `ecrans/fin.ts`): en-têtes selon le mode, infobulle qui dit ce que compte chaque colonne, tiret pour ce qui n'a pas d'objet. Colonnes Black Ninjas et Évadé retirées quand l'hôte les a coupés. Badge x2 retiré des lignes, du podium et des cartes d'équipe, avec sa règle de style.
- Version 1.8.1, sans note.

Colonnes retenues (micro-décisions de la session, à revoir en jouant):

| Mode     | Colonnes après rang, joueur et points                                   |
| -------- | ----------------------------------------------------------------------- |
| Horde    | Ninjas, Captures, Ralliés, Combo, Black Ninjas, Évadé                   |
| Tactique | Ninjas, Captures, Meilleur tir, Black Ninjas, Évadé                     |
| Équipes  | Ninjas (sa part de l'équipe), Captures, Black Ninjas, Évadé             |
| Chasse   | Survie (temps tenu comme proie), Infections, Vies (restantes, traqueur) |
| Massacre | PNJ, Joueurs, Black Ninjas, Combo, Évadé                                |

## Fichiers créés ou modifiés

- `packages/shared/src/constantes.ts`: `OBJETS.RAYON_DU_DISQUE_PX`, `OBJETS.SEUIL_RAMASSAGE_PX` à 38; le commentaire de `MODES` cite les statistiques de fin.
- `packages/shared/src/statistiquesDeFin.ts` (nouveau), `index.ts` (exports), `evenements.ts` (`FinDePartie.statistiques`), `version.ts` (1.8.1).
- `packages/sim/src/objets.ts` (commentaire du ramassage), `bots.ts` (proies cachées), `evade.ts` (menaces cachées), `zones.ts` (ce que fait désormais l'invisibilité).
- `packages/server/src/statistiquesDeFin.ts` (nouveau), `GameRoom.ts` (`statistiques()`), `ServeurSocket.ts` (envoi avec la fin).
- `packages/client/src/rendu/apparence.ts` (rayon du disque partagé), `interface/modeles/fin.ts` (colonnes, `ecrireUneStatistique`, plus de `doubleur`, plus de part des ninjas calculée par la page), `interface/ecrans/fin.ts` (en-têtes dynamiques, plus de badge), `interface/composants/aide.ts` (texte de la zone), `page/styles/ecrans.css` (règle du badge retirée).
- `tests/e2e/harnais/parcours.ts`: `classementDuServeur` suit les colonnes du mode.
- Documentation: `docs/design/README.md` (trois entrées du 9 octobre), `docs/design/cadrage.md` (ajouter un mode).

## Tests

- Ajoutés: ramassage au contact du disque (`objets.test.ts`); Black Ninja et zone d'invisibilité, joueur caché, PNJ caché, proie qui s'y réfugie et n'est pas prise, sortie de zone, autres zones sans effet (`bots.test.ts`); l'Évadé ne fuit pas un joueur caché (`evade.test.ts`); calcul serveur pour chaque mode, colonnes coupées, survie depuis l'entrée en jeu, part des ninjas en Équipes (`statistiquesDeFin.test.ts`); modèle de fin en Horde, Massacre, Chasse, Équipes, réglages coupés, sans statistiques, sans salon, formats (`fin.test.ts`, `fin.chasse.test.ts`, `fin.equipes.test.ts`); en-têtes, infobulle et absence du badge à l'écran (`ecrans/fin.test.ts`).
- Instantanés de `packages/sim/src/partie.test.ts` régénérés: ils ne bougent qu'à cause du rayon de ramassage. Vérifié: avec 15 pixels, les douze tests de ce fichier passent sans régénération, le camouflage n'y change donc rien.
- Résultat: suite unitaire complète au vert (3 712 avant les tests ajoutés en fin de session, puis les fichiers touchés relancés), types et linter propres. Bout en bout: voir « État de la CI » plus bas.
- Couverture de packages/sim: rien de retiré, chaque branche nouvelle a son test.

## Décisions et écarts au plan

- Le « corps » qui touche le disque est `RAYON_ENTITE` (16 pixels, la moitié du dessin d'un ninja, le rayon qui bute sur les murs), pas la moitié du seuil de contact entre entités (10). Toucher se juge à l'œil: c'est le dessin.
- Une proie ne se cache pas d'un Black Ninja qui la touche déjà: il la lâche au battement où elle entre dans la zone, il ne la prend pas.
- Le badge x2 disparaît aussi des cartes d'équipe, pas seulement à côté des pseudos: la colonne Évadé dit la même chose.
- Les statistiques ne s'écrivent pas en base: seuls les faits de partie survivent à la partie.

## Problèmes connus et dette

- L'étape 7.20 ajoute le mode `among` sur le `master` local. À la fusion, `STATISTIQUES_PAR_MODE` ne compilera pas tant que la ligne `among` n'y est pas: c'est voulu. Proposition pour le socle, à confirmer par le porteur du projet: camp (assassin ou proie), tâches faites, cadavres signalés, meurtres, votes justes. Une colonne nouvelle s'ajoute aussi aux `CALCULS` du serveur.
- Les intitulés des colonnes et le choix des colonnes par mode sont des propositions: à revoir après quelques parties.

## Prochaine action exacte

Reprendre l'étape 7.20 là où sa session l'a laissée, en fusionnant d'abord ce travail dans son `master` local et en donnant au mode `among` sa ligne dans `STATISTIQUES_PAR_MODE`.

## Étape suivante

Fiche à lire: docs/plan/etape-7-20.md
