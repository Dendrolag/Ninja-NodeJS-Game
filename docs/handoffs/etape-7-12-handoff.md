# Handoff - Étape 7.12 Les mines de zone

Date: 2 octobre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Les zones spéciales n'apparaissent plus d'elles-mêmes: la carte pose des mines visibles de tous, à la couleur de la zone qu'elles cachent; un joueur ou un Black Ninja qui passe dessus l'arme, et trois secondes plus tard la zone s'ouvre à cet endroit. Les zones prennent un rendu peaufiné et une taille fixe.

## Ce qui a été fait

- **Rappel fait au porteur du projet** en ouvrant l'étape: quatre sons restent provisoires (la fumée, la pose, l'armement et l'explosion de la mine). Deux s'y ajoutent avec cette étape (point « Problèmes connus »).
- **La planche de la mine de zone** (`docs/design/etape-7-12/2-mine-de-zone.png`), trois rendus par rangée. **Choix du porteur du projet: A, B, B**: la mine ronde teintée, le bord de la zone qui se trace pendant l'armement, la zone qui gonfle à l'ouverture.
- **Le contrat** (`packages/shared`): `MINES_DE_ZONE` (3 secondes, seuil d'armement de 20 pixels, plafond par défaut de 3); `ZONES.RAYON_PX`, 220 pixels, à la place du rayon tiré et du plafond de trois zones; le réglage `zones.minesMaximum` (1 à 10) et sa validation; l'entité `mineDeZone` du flux, en fin de `TYPES_ENTITE`, avec sa nature et son armement; le message `mineDeZone` (posée, armée, ouverte), à tous.
- **Le moteur** (`packages/sim/src/zones.ts`): la pose au rythme réglé, sous le plafond des mines qui attendent, loin des joueurs, des Black Ninjas et des autres mines; l'armement par tout joueur en jeu ou un Black Ninja, ni faux ninja ni Évadé; l'ouverture après 3 secondes, centrée sur la mine, au rayon fixe et à la durée tirée; le retrait de l'apparition spontanée. Les effets des zones ne changent pas.
- **Le serveur**: les mines de zone dans l'instantané, leurs trois notifications.
- **La page**: le rendu B des zones, choisi le 2 octobre sur `1-zones.png` (motif vivant par nature, pictogramme sur le bord à la place du libellé écrit, fin qui pâlit et clignote), en couleurs néon; la mine de zone posée et armée; la zone qui gonfle; les sons; les paramètres avancés et le récapitulatif du salon; l'aide.
- **Vérifié dans un vrai navigateur**, dans une vraie partie, par le scénario de bout en bout: planches 3 et 4 de `docs/design/etape-7-12/`; les quatre natures côte à côte sur Tokyo: planche 5.
- **Point de vigilance 4 mesuré**: les trois cartes et leurs miroirs n'ont qu'un seul morceau praticable; aucune mine ne peut se poser hors d'atteinte.

## Fichiers créés ou modifiés

- `packages/shared`:
  - `constantes.ts`: `MINES_DE_ZONE`, `ZONES.RAYON_PX` (retrait de `SIMULTANEES_MAXIMUM`, `RAYON_MINIMUM_PX`, `PART_DE_CARTE`);
  - `bornes.ts`, `reglages.ts`, `validation.ts`: le réglage `minesMaximum`, le sens nouveau des autres;
  - `evenements.ts`: `MineDeZoneVue` dans `EntiteVue`, `MineDeZoneFaitVue`, le message `mineDeZone`;
  - `flux.ts`: l'entité `mineDeZone`, son codage (nature, armement);
  - `ressources.ts`: les sons `mineDeZoneArmee` et `zoneOuverte`;
  - `index.ts`: les exports;
  - tests: `flux.test.ts` (aller-retour image et deltas, coût nul d'une mine immobile, nature inconnue, trame refusée), `validation.test.ts`, `reglages.test.ts`.
- `packages/sim`:
  - `zones.ts`: la pose, l'armement, l'ouverture, l'en-tête qui décrit l'écart au legacy;
  - `etat.ts`: `MineDeZone`, le champ `minesDeZone`, les faits `mineDeZonePosee`, `mineDeZoneArmee`, `zoneOuverte`;
  - `moteur.ts`: les joueurs hors jeu passés aux zones; `index.ts`: les exports;
  - tests: `minesDeZone.test.ts` (créé, 32 cas), `zones.test.ts` (apparition spontanée retirée), `moteur.test.ts`, `partie.test.ts` et son instantané (point 3 des décisions).
- `packages/server`: `instantane.ts`, `ServeurSocket.ts`; `ServeurSocket.mineDeZone.test.ts` (créé).
- `packages/client`:
  - `rendu/zones.ts` et `rendu/zones.test.ts` (créés); `rendu/apparence.ts` (`APPARENCE_ZONE` néon, `APPARENCE_ZONES`, `APPARENCE_MINE_DE_ZONE`); `rendu/scene.ts` (zones et mines de zone au sol, la mine de zone exclue des personnages); `rendu/pixi.ts` (les couches des zones, le libellé retiré); `index.ts`;
  - `faits.ts`, `client.ts`, `annonces.ts`, `sons/declencheurs.ts`: le fait `mineDeZone`;
  - `interface/modeles/reglages.ts`, `interface/modeles/salon.ts`, `interface/composants/aide.ts`: réglages, récapitulatif, aide;
  - tests: `rendu/scene.test.ts`, `sons/sons.test.ts`, `interface/modeles/salon.test.ts`.
- `tests/e2e`: `mine-de-zone.spec.ts` (créé); `harnais/parcours.ts` (`armerUneMineDeZone`).
- `tests/charge/empreinte.ts`: l'option `--sans-zones`.
- Documentation: fiche 7.12 (réconciliation), ROADMAP, journal de conception, `docs/mesures/charge-serveur.md` (section 23), planches `docs/design/etape-7-12/2` à `5` (créées), ce handoff.

Aucune modification de `legacy/` ni de `tests/caracterisation/`.

## Tests

- Ajoutés: voir la liste ci-dessus. Pour le moteur: la pose à l'intervalle, sans zone spontanée, le plafond (défaut, 5, 1), les mines armées hors du plafond, les natures cochées, le chaos absent en Massacre, aucune pose ni tirage sans nature, la distance aux joueurs, aux Black Ninjas et aux autres mines, le déterminisme, les zones coupées; l'armement (seuil strict, toute couleur, joueur protégé, hors jeu, Black Ninja, faux ninja, Évadé, une seule fois); l'ouverture (délai exact, centre, rayon, durée, sans plafond, expiration); dans le battement, les cinq modes, la fumée et l'explosion d'une mine posée qui n'arment rien.
- Résultat: 3 269 tests unitaires et d'intégration au vert en local (`pnpm verify`: types, linter, tests), formatage vérifié; les tests de la base sautés en local, joués par la CI. `ServeurSocket.mineDeZone.test.ts`: stable sur dix passages, et sous la charge de la couverture après une correction (point 7 des décisions). Bout en bout, en local: `mine-de-zone.spec.ts`, `mine.spec.ts`, `poche.spec.ts`, `parcours-solo.spec.ts`, les trois scénarios de rendu et `hud-lisible.spec.ts`, 22 sur 22 dans les deux cadrages.
- Couverture de packages/sim: 99,84 pour cent des instructions et 99,08 des branches, contre 99,83 et 99,04 au handoff 7.11 (`zones.ts` 100 et 100).
- **Empreinte des parties de référence, zones coupées** (`--sans-zones`): identique à l'octet à celle du code d'avant l'étape (commit `5dc1580`, l'option ajoutée à l'identique), jeu et flux, pour les quatre parties. La fiche demandait « identique à celle du handoff 7.11 »: impossible à la lettre, ces empreintes jouaient les zones (décision 4).
- **Nouvelles empreintes, zones actives** (réglages par défaut, une mine toutes les cinq secondes dans l'outil):
  - 150 bots, 12 joueurs, murs: jeu `b46ad1fcedccf2dbaa0c6135feb9f8faf9e9267f2b2e7144502ba4cc53c8f7ec`, flux `52be6ba9fe5bdb61564371cbc793636c1c33d84b7866605f064f92bee1d8f9ac` (six zones ouvertes)
  - 50 bots, 12 joueurs, murs: jeu `b8d218696124680ee2e8a62fa40e0c80a9594d4191c19734e2374d4358c3a61a`, flux `66b8bd7b9c5995ffd7a31a0fed45f80994b951daf1586cebcab607f99f6108ce` (cinq)
  - 300 bots, 12 joueurs, sans mur: jeu `4d46c3eec478d4a1d324dff186f0724af80dddac6585dc219c07e5a5e70f236a`, flux `343cde1a968dd4b1b717a60662aa9f9c9a75ec9b08daa995583d25c1468a0cf4` (sept)
  - 150 bots, 2 joueurs, murs: jeu `5a4e4dac8ccd5f97cb3eccc8fe7dd681adfd6c829bb31deb1c8aabc075399eff`, flux `90965567e1c7f11a6a39201dccdb89611c633d15def1841309eb1381de54e06d` (aucune)
- Banc: dix mines de zone qui attendent coûtent de 0,01 à 0,02 ms par battement à 50 faux ninjas, rien de lisible à 300, et 1,6 octet par message. Section 23 de `docs/mesures/charge-serveur.md`.
- État de la CI: verte sur `e165d3e` (exécution 37017903616): types, linter et tests, bout en bout, mise en ligne. Le serveur de production répond sur ce commit (`/sante`).

## Décisions et écarts au plan

1. **Rendus A, B, B**, choisis sur la planche par le porteur du projet.
2. **Les parties de référence du moteur changent toutes**, comme voulu, les zones y restant en jeu; les références avec la fumée et la mine passent à la graine 52, une cinquième, graine 62, ouvre deux zones.
3. **La pose sans variation au hasard**: la micro-décision 2 parlait de « la même variation qu'aujourd'hui »; l'intervalle des zones était fixe, il le reste.
4. **L'empreinte zones coupées** se compare au code d'avant l'étape, pas aux empreintes du handoff 7.11, qui jouaient les zones.
5. **Un seul message réseau pour les trois faits**, `mineDeZone` avec `quoi`, à tous.
6. Les autres écarts de construction sont à la section « Réconciliation » de la fiche.
7. **Défaut corrigé en route**: le test d'intégration attendait le prochain message de mine de zone, quel qu'il soit. Une mine armée ne comptant plus dans le plafond, la carte peut en poser une autre pendant les 3 secondes, et sa pose arrivait parfois avant l'ouverture attendue (un échec sous la charge de la couverture). Le test attend désormais le fait de la sorte voulue.

## Problèmes connus et dette

- **Six sons sont provisoires**, et le porteur du projet a les siens: la fumée (`SONS.fumee`), la pose, l'armement et l'explosion de la mine (`SONS.minePosee`, `SONS.mineArmee`, `SONS.mineExplosee`), et depuis cette étape l'armement de la mine de zone et l'ouverture de sa zone (`SONS.mineDeZoneArmee`, le tic du compte à rebours; `SONS.zoneOuverte`, son dernier tic). Pour chacun: déposer le fichier dans `assets/sons/` et changer le nom dans `SONS` (`packages/shared/src/ressources.ts`).
- **À juger en jouant** (points de vigilance de la fiche): le chaos devenu une arme, les Black Ninjas déclencheurs, le délai de 3 secondes, la lisibilité du motif des zones sur le décor chargé de Tokyo.
- Rien d'autre.

## Prochaine action exacte

**Au porteur du projet**: jouer une partie pour juger les mines de zone et le rendu des zones, fournir les six sons s'il les a, et dire la suite: aucune étape planifiée ne reste ouverte à la section 3 du ROADMAP.

## Étape suivante

Fiche à lire: aucune. La prochaine étape est à décider avec le porteur du projet; sa fiche se rédigera au début de l'étape, selon le cas de repli du PROTOCOLE.
