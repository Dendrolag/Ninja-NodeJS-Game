# Handoff - Étape 8.11 Prison Island, de jour ou de nuit

Date: 9 octobre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Une cinquième carte jouable, Prison Island, livrée par le porteur du projet, avec un fond et un avant-plan de jour et de nuit, au choix de l'hôte.

## Ce qui a été fait

- **Fiche rédigée selon le cas de repli du PROTOCOLE** (`docs/plan/etape-8-11.md`), avec le diagnostic du début d'étape et une section de réconciliation.
- **Faite en parallèle de l'étape 7.20**, dans le worktree `.claude/worktrees/prison`, branche `carte-prison`, tirée de `origin/master` (`e23bfc5`): les lots A et B de 7.20 étaient commités en local sur `master`, non poussés, et la page ne compilait plus en attendant leur lot client.
- **La carte `prison`, 2390 sur 1738.** Livrée à 1838 sur 1337, elle se mesurait en 21 morceaux: ses portes, d'un carreau de plan de jeu de rôle, laissaient moins que les 32 pixels d'un ninja. Agrandie de 30 pour cent sur les deux axes: la collision est livrée à la taille de la carte, le décor reste à sa taille et la page l'agrandit (proportions tenues à un pixel près, testé).
- **La collision retouchée**, détail dans `assets/README.md`: cailloux de la plage du bateau retirés, une porte de cellule élargie, murs de moins de neuf pixels épaissis, creux du bord des murs comblés (plus de deux cents poches d'une à six places, nées du contour rugueux des pierres), un passage élargi de 34 à 44 pixels, une niche comblée, une cinquantaine de pixels collés aux murs pour fermer les dernières places isolées. Aucune poche au pixel près, dans les deux sens.
- **Les douze critères**: un seul morceau dans les deux sens; 34,6 pour cent de sol et 22,7 tenable, sous les 45 proposés par le critère 2 (une île, la mer est un mur); 100 pour cent du tenable hors bande d'apparition; dégagement médian de 35 pixels; traversée en 23,1 secondes; **détour 1,32**, la carte la plus structurée du jeu; collision superposée au décor, vérifiée à l'œil; proportions tenues; mur lisible; avant-plan qui cache (tables, lits); vignette tirée du centre du fond de jour.
- **La nuit change aussi l'avant-plan.** `cheminFondDeNuit` vaut pour Prison Island, `cheminAvantPlanDeNuit` est nouveau (`packages/shared/src/ressources.ts`), et le rendu charge l'avant-plan de nuit à la place de celui du jour (`imageDeLAvantPlan`, `packages/client/src/rendu/pixi.ts`). Le réglage `nuit` se propose sur la carte, et le salon dit « Prison Island · Nuit ».
- **Plafond de 125 faux ninjas**, la densité des autres cartes; 0,40 ms par battement au banc, section 28 de `docs/mesures/charge-serveur.md`.
- **Migration `0014_carte_prison`**: la valeur `prison` entre dans l'énumération des cartes.
- **Crédits**: « Avec l'aimable participation de 2-Minute Tabletop pour les cartes Station lunaire et Prison Island, sous licence CC BY-NC 4.0. »
- **Version 1.8.0** et sa note, « Derrière les barreaux »: Prison Island, Jour ou nuit, Des cachettes.
- **Vu dans un vrai navigateur**, par le harnais Playwright, serveur local sans base: une partie lancée sur la carte de jour et de nuit, sur ordinateur et sur téléphone, sans erreur. Captures: `docs/design/etape-8-11/`.

## Fichiers créés ou modifiés

- `assets/cartes/prison/` (créé): `background.png`, `background-night.png`, `foreground.png`, `foreground-night.png`, `collision.png` (2390 sur 1738, retouchée), `preview.png`.
- `packages/shared/src/constantes.ts`: la carte, son enregistrement, son plafond. `ressources.ts`: `cheminFondDeNuit` pour deux cartes, `cheminAvantPlanDeNuit`. `reglages.ts`: commentaire du réglage `nuit`. `index.ts`: export. `version.ts`: 1.8.0. Tests: `constantes.test.ts`, `ressources.test.ts` (chemins, fichiers, tailles, proportions).
- `packages/server/migrations/0014_carte_prison.sql`, `meta/0014_snapshot.json`, `meta/_journal.json` (créés ou complétés par `pnpm base:generer`). Tests: `terrain.test.ts` (empreintes, miroir pixel à pixel, connexité, poches), `ServeurSocket.options.test.ts` (125 faux ninjas tenables).
- `packages/client/src/rendu/pixi.ts`: l'avant-plan de nuit. `interface/modeles/cartes.ts`: la présentation. `interface/modeles/reglages.ts`: commentaire. `interface/modeles/credits.ts`: la ligne de 2-Minute Tabletop. `interface/modeles/notesDeVersion.ts`: la note 1.8. Tests: `reglages.test.ts`, `salon.test.ts`, `credits.test.ts` (modèle et composant), `notesDeVersion.test.ts`, `application.test.ts` (« 5 modes · 5 cartes »).
- `tests/e2e/rendu-prison.spec.ts` (créé): la nuit assombrit le fond, et les tables de l'avant-plan sont brunes de jour, bleutées de nuit.
- Mesures: `docs/mesures/mesurer-les-cartes.mjs` (la carte dans sa table), `cartes.json`, `charge-serveur.md` (section 28), `charge-serveur-8-11-prison.json` (créé).
- Documentation: fiche 8.11 (créée), ROADMAP (entrée 8.11 en phase 8, et l'étape terminée), journal de conception, `assets/README.md` (licence et retouches), compétence `conception-de-cartes` (fichiers, table des cartes, endroits du code, deux leçons; fiche de commande), ce handoff, captures `docs/design/etape-8-11/`.

Aucune modification de `legacy/`, de `tests/caracterisation/` ni de `packages/sim`.

## Tests

- Ajoutés: chemins du fond et de l'avant-plan de nuit, fichiers présents, tailles et proportions des images; réglage de nuit proposé et récapitulé; crédits; note 1.8; empreintes des murs, miroir, connexité au pas de quatre pixels, aucune poche dans les deux sens, 125 faux ninjas tenables; bout en bout du rendu de jour et de nuit.
- Résultat: 3 689 tests unitaires et d'intégration au vert en local, types et linter compris; tests de la base sautés en local, joués par la CI. Bout en bout: `rendu-prison` 4 sur 4 (ordinateur et téléphone).
- Couverture de packages/sim: inchangée, il n'est pas touché.
- Empreintes des parties de référence: inchangées par construction, elles se jouent sur Tokyo et le moteur n'est pas touché.
- État de la CI: verte sur `2a46e82`, poussé en avance rapide sur `origin/master` (exécution 37919090631): types, linter et tests, base, bout en bout, banc du rendu, mise en ligne. Le porteur du projet a joué la carte en ligne et l'a validée le 9 octobre 2026.

## Décisions et écarts au plan

Détail dans la section « Réconciliation » de la fiche. Choisis par cette session et soumis au porteur du projet: l'agrandissement de 30 pour cent (20 suffisait à ouvrir les portes), le décor laissé à sa taille et agrandi par la page, l'identifiant `prison`, l'ambiance « Îlot · Jour ou nuit », le plafond de 125, le texte de la note 1.8 et la ligne des crédits commune aux deux cartes.

## Problèmes connus et dette

- **Deux migrations numéro 14**: `0014_mode_among` (étape 7.20, en local sur `master`) et `0014_carte_prison`. Prison Island est partie la première: celle de 7.20 se régénère en 15: après fusion, retirer la sienne et son instantané, relancer `pnpm base:generer`, renommer le fichier produit, puis vérifier que `pnpm test` passe sur la base.
- **Licence CC BY-NC 4.0**, comme la Station lunaire: aucun usage commercial.
- **À juger en jouant**: la taille des ninjas sur la carte agrandie, les couloirs d'un carreau, les cellules à une porte en Massacre (refuges), la part de carte que l'avant-plan cache.
- Rien d'autre.

## Prochaine action exacte

Reprendre l'étape 7.20. À son rebase sur `origin/master`, sa migration devient `0015_mode_among` et sa version 1.9.0 (voir « Problèmes connus »); la session 7.20 en a été prévenue.

## Étape suivante

Fiche à lire: `docs/plan/etape-7-20.md`, l'étape en cours.
