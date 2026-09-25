# Handoff - Étape 8.5 Audit des saccades sur téléphone, et plan d'action

Date: 21 septembre 2026, repris le 25 septembre 2026
Auteur: session Claude Code
Statut: terminée le 25 septembre 2026; le réglage de l'écran de préparation est remesuré sur le téléphone le soir même (aucune image lente après son lever, `docs/mesures/releves-8-6/02-iphone-tactique-300.txt`)

## Objectif de l'étape

Savoir pourquoi le jeu saccade sur un iPhone 14 Pro, chiffres à l'appui, et écrire ce qu'il faut faire. On mesure d'abord, sur le vrai appareil.

## Ce qui a été fait

### Le 21 septembre: l'instrument et le protocole

- **Lot A, l'instrument.** `https://ninja.dendrolag.fr/?diagnostic=1` ouvre un relevé de performance dans la page. Un bandeau en bas de l'écran montre la cadence, le neuvième décile et le centile 99 de la durée d'image, et le compte des images d'au moins 50 ms depuis le début de la partie. Un bouton copie le relevé complet en texte: appareil, dos de rendu réellement utilisé, répartition des durées d'image, part de notre code (rendu et HUD séparés), de PixiJS et de ce qui échappe à nos chronomètres, réseau (instantanés, écarts, battements sautés, images où le lissage attendait), déroulé par fenêtres de 5 secondes, et les vingt pires images. Sans le paramètre, rien n'existe.
- **Des variantes de l'adresse**, au-delà de la fiche: `son=0`, `hud=0`, `flou=0`, `densite=1`, `cadence=60`, `rendu=webgpu`, `lueur=0`.
- **Lot B, le protocole de recette**: section 4 de `docs/mesures/audit-saccades-telephone.md`.
- Commit `2b5cb4f`, en ligne le 21 septembre.

### Le 25 septembre: les relevés, le verdict provisoire et deux corrections

- **Trois relevés de l'iPhone 14 Pro**, trois parties entières de trois minutes, seul: Horde à 50 PNJ, Massacre à 200, Tactique à 300. Rangés dans `docs/mesures/releves-8-5/`. Pris dans Firefox pour iOS, qui dessine avec le moteur de Safari.
- **Lot C, l'audit, verdict provisoire** (section 6 de l'audit). **Le dessin est fluide**: 59,8 à 59,9 images par seconde, centile 99 de 21 à 23 ms, notre code 0,3 à 0,4 ms et PixiJS 0,4 à 0,5 ms par image, aucune dégradation en trois minutes. **Ce qui reste est la forme 3**: les instantanés arrivent vingt fois par seconde mais irrégulièrement (centile 99 de l'écart de 119 à 151 ms), et le lissage, qui suit cette irrégularité, tient les personnages immobiles pendant 15 à 17 pour cent des images (1,5 au bureau). Et **un gel de 131 à 257 ms au tout début** de chaque partie, l'écran de préparation se levant trop tôt. Dix hypothèses sur douze écartées dans ces conditions, deux confirmées (6 et 7), la 4 confirmée au départ seulement.
- **Les très grosses saccades du 20 septembre ne sont pas reproduites.** Le porteur du projet ressent « pas de latence forte » à « quelques faibles latences ». Section 6.4 de l'audit: le navigateur, le réseau, la partie ou la version diffèrent peut-être.
- **Lot D, le plan d'action** (section 8 de l'audit): (1) le réglage de l'écran de préparation, fait; (2) mesurer la régularité du battement du serveur en production, proposé comme étape `8.6`; (3) adoucir le lissage sans ajouter de retard, à décider après `8.6`.
- **Décision du porteur du projet: pas de retard ajouté à l'affichage.** L'audit proposait d'abord un lissage à retard fixe (50 ms de plus); refusé, le jeu demandant d'être réactif pour capturer. Consignée au journal de conception.
- **Le porteur du projet confirme que le 20 septembre, les conditions étaient les mêmes** que le 25. La cause la plus probable des grosses saccades varie donc dans le temps: le réseau, ou le serveur hébergé gratuitement (section 6.4 de l'audit).
- **Réglage fait: l'écran de préparation attend une demi-seconde réellement fluide**, trente images d'affilée de moins de 34 ms au lieu de trois de moins de 100 ms (`STABILITE`, `rendu/apparence.ts`). Au plus trois secondes, comme avant.
- **Le relevé dit désormais quand l'écran de préparation s'est levé**, et combien d'images d'au moins 50 ms l'ont suivi: c'est ce qui remesurera le réglage.
- **Défaut trouvé en route et corrigé (règle 7): les PNJ naissaient empilés.** Relevé par le porteur du projet en Tactique à 300 PNJ: la plupart des PNJ apparaissaient en un disque près du joueur. Passé environ 150 PNJ sur Tokyo, les cent tirages à 100 pixels de toutes les entités échouaient, et la spirale de secours, dont le second passage ignore l'écart, rendait le même point à chaque PNJ: **138 sur 300 au même endroit sur Tokyo**, 161 sur 500 sur Spirit & Time, 98 sur 300 sur le Quartier. Présent depuis l'étape 7.6. Désormais l'écart se resserre à 50, 25 puis 0 pixel avant la spirale; plus aucune pile, sur les quatre cartes, jusqu'à 500 PNJ. Section 8.1 de l'audit.

## Fichiers créés ou modifiés

Commit `2b5cb4f` (21 septembre):

- `packages/client/src/diagnostic/demande.ts`, `histogramme.ts`, `releve.ts`, `diagnostic.ts`, `diagnostic.test.ts` (créés): l'instrument et ses tests.
- `packages/client/src/rendu/boucle.ts`: une sonde facultative. `rendu/interpolation.ts` (et son test): `enAttente`. `rendu/pixi.ts`: les options `preference` et `densite`.
- `packages/client/src/interface/ecrans/jeu.ts`, `principal.ts`: le relevé et ses variantes, seulement sur demande.
- `tests/e2e/diagnostic.spec.ts` (créé), `playwright.config.ts`.
- `docs/mesures/audit-saccades-telephone.md` (créé), `docs/plan/etape-8-5.md`, `docs/plan/ROADMAP.md`, ce handoff.

Commits du 25 septembre:

- `packages/sim/src/etat.ts`: `positionDApparition` resserre l'écart avant la spirale. `packages/sim/src/etat.test.ts`: deux tests.
- `packages/shared/src/constantes.ts`: `APPARITION.ECARTS_DE_REPLI`.
- `packages/client/src/rendu/apparence.ts`: `STABILITE` resserré. `rendu/boucle.test.ts`: le test de l'annonce joue ses images à 60 Hz.
- `packages/client/src/diagnostic/releve.ts`, `diagnostic.ts`, `diagnostic.test.ts`, `interface/ecrans/jeu.ts`: le lever de l'écran de préparation dans le relevé.
- `docs/mesures/releves-8-5/` (créé): les trois relevés bruts.
- `docs/mesures/audit-saccades-telephone.md`: hypothèses tranchées, verdict, banc, plan d'action. `docs/plan/ROADMAP.md`: verdict et proposition de l'étape `8.6`.

Aucune modification de `packages/server`, de `legacy/` ni de `tests/caracterisation/`.

## Tests

- Ajoutés le 25 septembre: quatre unitaires. Deux dans le moteur: cent pixels tenus entre soixante apparitions, et cinq cents apparitions toutes distinctes et réparties sur les quatre quarts de la carte (167 positions distinctes sur 500 avant la correction). Deux dans le relevé: les images lentes après le lever de l'écran de préparation, comptées à part, et le relevé d'un écran pas encore levé.
- Résultat: **2 449 tests unitaires au vert** (2 429 au handoff 8.4). Bout en bout: voir l'état de la CI. Types, linter et formatage verts.
- Couverture de packages/sim: **99,88 pour cent** des instructions (99,85 au handoff 7.7).
- **Empreintes des parties de référence** (`tests/charge/empreinte.ts`): la partie à 50 PNJ est identique; les trois autres changent, parce que le défaut des PNJ empilés les touchait déjà. Nouvelles empreintes du jeu:
  - 150 bots, 12 joueurs, murs: `21c9a22dfb14b707748207aa4447f17b85d335e2f24e06cf6c8749157e1dfb83` (ralliements 432 avant, 322 après)
  - 50 bots, 12 joueurs, murs: `c64c0e081766ce7df062dfba8580be86eedb2c97c5718cdccc1de426a4e59b12`, inchangée
  - 300 bots, 12 joueurs, sans mur: `ffbc1f1f5e7b75af85ee366eb8751cf1da3d9cce61f3b36543b684b1be63863d`
  - 150 bots, 2 joueurs, murs: `cf86bff3e179b41916157567cf2ff3bbac4609f55c01a0ea0a78b7262a5adca3`
- État de la CI: à vérifier sur le commit poussé.

## Décisions et écarts au plan

1. **La fiche se trompait sur le dos de rendu par défaut.** PixiJS 8.19 essaie WebGL d'abord, pas WebGPU.
2. **Deux hypothèses ajoutées**, 11 (le HUD) et 12 (la saisie tactile), écartées toutes deux par les relevés.
3. **Des variantes dans l'adresse**, non prévues par la fiche. Elles n'ont pas servi: le dessin n'est pas en cause.
4. **Le protocole n'a pas été joué tel quel**, et c'était le bon choix: trois parties de référence ont suffi à écarter le dessin, ce que les variantes devaient départager.
5. **Le gel du départ se corrige par un réglage**, dans l'étape, comme la fiche le demande. Le lissage à retard fixe, qui aurait été une étape, est **refusé par le porteur du projet**: pas de retard ajouté à l'affichage.
6. **La correction des PNJ empilés est faite dans cette étape**, hors de son périmètre, au titre de la règle 7: un défaut de jeu vu pendant la recette, petit et bien délimité. Elle change trois empreintes de référence, parce que ces parties portaient déjà le défaut.
7. **Pas de prédiction de notre propre ninja**: ce serait rejouer les règles dans la page. Section 8 de l'audit.

## Problèmes connus et dette

- **L'étape n'est pas terminée**, pour deux raisons que seul le porteur du projet peut lever:
  - **le réglage de l'écran de préparation n'est pas remesuré sur le téléphone**: il faut une partie avec `?diagnostic=1`, et la ligne « Écran de préparation levé à … s; images d'au moins 50 ms ensuite: 0 »;
  - **aucun relevé n'a encore été pris un jour où le jeu saccade**: les conditions du 20 septembre étaient les mêmes, et c'est un tel relevé qui établira la cause (section 6.4 de l'audit).
- **Le Massacre annoncé à 300 PNJ s'est joué à 200.** Le relevé lit le nombre dans les réglages de la partie, et aucun mode ne le réécrit (seule la validation le plafonne, par carte, à 300 sur Tokyo): le réglage était donc à 200. Pas un défaut.
- **Le bandeau du relevé peut couvrir un bouton** en bas d'un écran étroit.

Repris des handoffs précédents, inchangé: la carte du Quartier reste à juger en jouant à plusieurs; rien ne surveille que la production suit `master`.

## Prochaine action exacte

**Au porteur du projet**, sur l'iPhone 14 Pro, avec la page du commit qui porte ces corrections:

1. Une partie avec `https://ninja.dendrolag.fr/?diagnostic=1`, par défaut, et coller le relevé: il doit dire « images d'au moins 50 ms ensuite: 0 ». Vérifier au passage que les PNJ naissent partout sur la carte, en Tactique à 300.
2. Le jour où le jeu saccade de nouveau, jouer avec `?diagnostic=1` et coller le relevé.
3. Trancher l'étape `8.6`, la régularité du battement en production, et son ordre face à `8.3`.

**À la session suivante**, réponses en main: ranger les relevés, conclure la section 6.4 de l'audit, marquer l'étape terminée, et ouvrir `8.6` ou `8.3` selon la décision.

## Étape suivante

Fiche à lire: `docs/plan/etape-8-5.md`, la même, pour clore l'étape. Ensuite, selon la décision du porteur du projet, `8.6` (la régularité du battement en production, fiche à rédiger) ou `8.3` (le miroir calculé, fiche à rédiger).
