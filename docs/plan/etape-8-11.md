# Fiche étape 8.11 - Prison Island, de jour ou de nuit

Statut: faite le 9 octobre 2026.

## Origine de cette fiche

Rédigée selon le cas de repli du PROTOCOLE: le porteur du projet a demandé l'ajout de la carte le 9 octobre 2026, « en parallèle de la 7.20 en cours », avec un mode jour et un mode nuit. Aucune entrée du ROADMAP ne la prévoyait. Modèle: la fiche 8.9, la Station lunaire, carte livrée elle aussi par le porteur du projet et dessinée par le même auteur.

**En parallèle de l'étape 7.20.** Les lots A et B de 7.20 étaient commités sur `master` en local, non poussés, et la page ne compilait plus en attendant leur lot client. Cette étape a donc été faite dans un worktree tiré de `origin/master`, sur la branche `carte-prison`, pour être vérifiée et mise en ligne sans attendre 7.20. Conséquence à régler à la fusion: les deux étapes ajoutent une migration numéro 14 (voir « Réconciliation »).

## Ce que le porteur du projet a livré

Cinq images de 1838 sur 1337:

- le fond de jour et le fond de nuit, en WebP;
- la collision, en noir et blanc purs, opaque;
- l'avant-plan de jour et l'avant-plan de nuit, en PNG transparent: tables, lits, étagères, grilles de cellules.

Le nom: Prison Island. L'auteur: 2-Minute Tabletop, sous licence CC BY-NC 4.0 (réponse du porteur du projet du 9 octobre 2026).

## Diagnostic, fait au début de l'étape

- **La collision se superpose au décor** (critère 8): vérifié à l'œil sur une superposition.
- **Telle que livrée, la carte n'est pas jouable.** Mesurée à 1838 sur 1337: 35,3 pour cent de sol, 20,2 tenable, **21 morceaux**. Un plan de jeu de rôle compte un carreau par personnage, environ 41 pixels ici; ses portes d'un carreau, une fois les pierres dessinées, laissent moins que les 32 pixels d'un ninja. La tour ronde, les deux blocs de cellules, la cour ouest et la plage du bateau étaient coupés du reste.
- **Aucun avant-plan de nuit n'existait dans le jeu**: la Station lunaire n'a pas d'avant-plan. Sans lui, la nuit poserait des tables en plein soleil sur un décor éteint.

## Décisions prises par cette fiche

1. **La carte mesure 2390 sur 1738**, 30 pour cent de plus que ses images, sur les deux axes. Essais au disque de rayon 16 sur la collision livrée: dès 20 pour cent, les portes s'ouvrent; à 30, il reste de la marge sans trop rapetisser les ninjas (un carreau de 53 pixels pour un ninja de 32). Les proportions de l'image sont tenues à un pixel près (critère 9).
2. **Le décor reste à sa taille de livraison**, la page l'agrandit. La collision, elle, est livrée à la taille de la carte, pour que ses retouches se fassent au pixel du jeu.
3. **L'identifiant est `prison`**, le nom affiché « Prison Island », l'ambiance « Îlot · Jour ou nuit ». Pas de badge « Prototype »: le décor est définitif.
4. **La nuit est le réglage `nuit` de l'étape 8.9**, proposé désormais sur deux cartes. Elle remplace le fond et l'avant-plan: `cheminAvantPlanDeNuit`, nouveau, dans `packages/shared/src/ressources.ts`.
5. **Plafond de 125 faux ninjas**: 0,94 million de pixels carrés tenables, la densité des autres cartes (7 540 pixels carrés chacun).
6. **Version 1.8.0** et sa note, « Derrière les barreaux ».
7. **Une seule ligne de crédits** pour les deux cartes de 2-Minute Tabletop: « les cartes Station lunaire et Prison Island ».

## Périmètre

### Lot A. La carte

`assets/cartes/prison/`: les deux fonds, les deux avant-plans, la collision retouchée, la vignette. `CARTES`, `CARTES_ENREGISTREES`, `PLAFONDS_DE_FAUX_NINJAS`, la migration de l'énumération des cartes, `PRESENTATION_CARTES`, l'outil de mesure.

### Lot B. Le jour et la nuit

`cheminFondDeNuit` vaut pour Prison Island, `cheminAvantPlanDeNuit` est nouveau, et le rendu PixiJS charge l'avant-plan de nuit à la place de celui du jour, au préchargement comme au montage.

### Lot C. Version, crédits, documentation

Version 1.8.0, note 1.8, crédits; `assets/README.md` dit ce qui a été changé, comme la licence l'exige; compétence `conception-de-cartes`, ROADMAP, journal de conception, mesures, handoff.

## Hors périmètre

- Un vaisseau ou tout autre décor animé: la carte n'en a pas.
- La place de Prison Island dans les défis de la semaine ou le mode Among Ninjas (7.20): rien ne l'y met pour l'instant.

## Tests requis

- Les douze critères de la compétence, mesurés.
- TU: dimensions, enregistrement, plafond; chemins du fond de nuit et de l'avant-plan de nuit, fichiers présents, tailles et proportions des images; réglage `nuit` proposé et récapitulé sur la carte; crédits; note 1.8.
- Serveur: empreintes des murs dans les deux sens, miroir retourné pixel à pixel, connexité au pas de quatre pixels, aucune poche au pixel près dans les deux sens, 125 faux ninjas tous tenables au lancement.
- Bout en bout: la nuit assombrit le fond et change l'avant-plan.
- Banc de charge au plafond.

## Définition de terminé

Celle du ROADMAP (section 2), plus: une vraie partie jouée sur la carte, de jour et de nuit, dans un vrai navigateur, sans erreur.

## Réconciliation pendant l'étape (9 octobre 2026)

1. **La collision est retouchée**, en plus de l'agrandissement. Dans l'ordre: quatre cailloux qui fermaient la plage du bateau retirés; la porte d'une cellule du nord, plus étroite que les autres, élargie; les murs de moins de neuf pixels épaissis (règle de l'étape 8.9); les creux du bord des murs comblés par une fermeture de rayon 4, parce que le contour rugueux des pierres laissait plus de deux cents poches d'une à six places au pixel près, que l'étape 8.10 rend sans danger mais que le test exige à zéro; le passage entre la cantine et le bloc du sud-ouest élargi de 34 à 44 pixels, jusqu'au sol dessiné, pour que le test de connexité au pas de quatre pixels le voie; une niche close au flanc ouest de la cantine comblée; une cinquantaine de pixels de mur collés aux murs existants, chacun pour rendre intenable une place isolée. Détail dans `assets/README.md`.
2. **La part tenable est la plus faible du jeu, 22,7 pour cent**, sous les 45 pour cent de sol que propose le critère 2 (34,6 ici). C'est la nature d'une île: la mer est un mur. Le critère est une proposition de l'étude, pas un interdit; les apparitions, tirées dans le morceau principal depuis l'étape 8.10, n'en souffrent pas (125 faux ninjas tenables au lancement, testé).
3. **Deux migrations numéro 14.** L'étape 7.20 a la sienne, `0014_mode_among`, commitée en local et non poussée; celle-ci a `0014_carte_prison`. La seconde à arriver sur `origin/master` se régénère au numéro 15 (`pnpm base:generer` après fusion, puis renommage).

## Rituel de fin de session

Handoff `docs/handoffs/etape-8-11-handoff.md`, commit, et mise en ligne par la CI une fois la question des migrations réglée avec l'étape 7.20.
