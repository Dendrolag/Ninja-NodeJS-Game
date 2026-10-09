# Handoff - Hors étape: la page dit ce que font les zones

Date: 9 octobre 2026
Auteur: session Claude Code
Statut: terminée, essayée en local et validée par le porteur du projet, mise en ligne

Travail hors plan, demandé par le porteur du projet en parallèle de l'étape 7.20, à la suite d'un retour de joueurs: on ne comprend pas ce que font les zones ouvertes par les mines de zone. Fait dans le worktree `.claude/worktrees/optimisations`, sur la branche `zones-expliquees`, partie du commit `6204636` (les optimisations du même jour, déjà en ligne). **Rien n'est poussé sur `master`**: le porteur du projet veut l'essayer en local avant.

## Objectif

Dire ce que fait une zone avant, pendant et après son effet, sans surcharger le jeu.

## Ce qui a été fait

- Textes du porteur du projet: « Chaos · les ninjas changent de couleur », « Répulsion · les ninjas te fuient », « Attraction · attire les ninjas vers toi », « Invisibilité · personne ne te voit » (il avait écrit « te vois », corrigé en « te voit »).
- Avant: à moins de 250 pixels d'une mine de zone, une bulle à la couleur de sa zone, au-dessus de la plus proche.
- Pendant: à l'entrée dans une zone, la phrase flotte 2,5 secondes au-dessus de notre ninja; la zone devient un effet en cours (carte ou pastille), avec son pictogramme, celui du bord de la zone, et sa durée restante.
- Après: les ninjas que le chaos nous prend, cumulés sur une seconde, flottent en « -3 ninjas » (Horde, Tactique, Équipes); un masque au-dessus de notre ninja tant que l'invisibilité le cache.
- L'effet ne s'explique que trois fois par nature et par navigateur (stockage `neon-ninja.zones-expliquees`); ensuite, le nom seul.
- Version 1.8.2, sans note.

## Fichiers créés ou modifiés

- `packages/client/src/zonesExpliquees.ts` (nouveau): textes, mine la plus proche, zones qui nous couvrent, ninjas repeints par le chaos.
- `packages/client/src/guideDesZones.ts` (nouveau): ce qui se rappelle d'une image à l'autre (texte de chaque mine, entrées, durées des zones, cumul des pertes).
- `packages/client/src/interface/souvenirDesZones.ts` (nouveau): le compte des explications, dans le navigateur.
- `packages/client/src/hud/bullesDeZone.ts` (nouveau): les bulles, posées dans le document sous le HUD.
- `packages/client/src/hud/modele.ts`: les zones dans les effets en cours (`categorie: 'zone'`), `construireHud` reçoit les durées des zones.
- `packages/client/src/rendu/zones.ts`: `adresseDuPictogrammeDeZone`, le pictogramme d'une zone en image SVG.
- `packages/client/src/rendu/boucle.ts`: le guide appelé à chaque image, avant le HUD.
- `packages/client/src/interface/ecrans/jeu.ts`, `ecrans/types.ts`, `application.ts`: montage des bulles, souvenir passé à l'écran de jeu.
- `packages/client/page/styles/jeu.css`: les bulles, et le pictogramme de zone dans une carte d'effet.
- `packages/shared/src/version.ts`: 1.8.2.
- `tests/e2e/mine-de-zone.spec.ts`: la bulle de la mine armée, la phrase d'entrée et la carte d'effet dans une vraie partie.
- `docs/design/README.md`: entrée du journal.

## Tests

- Ajoutés: `zonesExpliquees.test.ts`, `guideDesZones.test.ts`, `interface/souvenirDesZones.test.ts`, `hud/bullesDeZone.test.ts`, la zone dans `hud/modele.test.ts`, le pictogramme dans `rendu/zones.test.ts`.
- Résultat: 3 741 tests unitaires au vert, types et linter propres. `mine-de-zone.spec.ts` au vert huit fois de suite, sur ordinateur et téléphone.
- Trouvé en route: la phrase d'entrée ne dure que 2,5 secondes, et le scénario la cherchait parfois trop tard (la zone pouvait s'ouvrir pendant sa pause de capture). La page note désormais son apparition dès qu'elle survient.
- Couverture de packages/sim: inchangée, rien n'y a été touché.

## Décisions et écarts au plan

- La phrase d'entrée garde le fond sombre de la bulle: sans lui, elle se perdait dans le motif de la zone, qui a sa couleur (captures du scénario).
- La perte due au chaos se pose sous notre ninja, comme annoncé, même si la zone est loin (nos ninjas en Tactique ou ceux de l'équipe en Équipes).
- Le compte à rebours « Chaos dans 3 s » à l'armement, proposé en option, n'est pas construit: à essayer après ces trois-là.

## Problèmes connus et dette

Rien de connu. À juger en jouant: la portée de la bulle (250 pixels), le seuil de trois explications, la durée de la phrase d'entrée.

## Prochaine action exacte

Rien pour ce travail: validé et poussé sur `master` en avance rapide. La session de l'étape 7.20 fusionne `master` dans son `master` local avant de pousser, et donne au mode `among` ses colonnes de fin (handoff `optimisations-9-octobre-handoff.md`).

## Étape suivante

Fiche à lire: docs/plan/etape-7-20.md
