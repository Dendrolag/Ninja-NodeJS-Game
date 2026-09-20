# Handoff - Étape 8.1 Étude des structures de carte

Date: 20 septembre 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Écrire une note qui dise ce qu'est techniquement une carte de Neon Ninja, ce qu'une bonne carte doit à une partie à plusieurs, et de quoi juger une structure de carte avant de commander un décor à un graphiste. Aucun code de jeu, aucun prototype.

## Ce qui a été fait

- **Fiche rédigée** selon le cas de repli du PROTOCOLE, à partir de l'entrée `8.1` du ROADMAP, du handoff 7.8 et de la fiche 7.8 prise comme modèle (`docs/plan/etape-8-1.md`, commit `af71917`).
- **Les deux cartes existantes sont mesurées**, et non décrites à vue d'œil. L'outil décode les quatre terrains jouables (Tokyo et Spirit & Time, normal et miroir) **par le chemin réel du serveur**, `terrainDepuisImage`, étirement et seuil à 128 compris, puis calcule part de sol, part réellement tenable par un ninja, morceaux d'un seul tenant, largeurs de passage, temps de traversée et détour médian.
- **Le résultat principal: nos deux cartes sont des terrains ouverts, pas des structures.** Le détour médian, qui compare le chemin réel au vol d'oiseau, vaut **1,08 sur Tokyo et 1,06 sur Spirit & Time**, là où une carte à couloirs donnerait 1,3 à 1,5 et un labyrinthe 2. Il n'y a ni détour à subir, ni raccourci à connaître. Les murs de Tokyo occupent 11 pour cent de la surface et se contournent: c'est du mobilier.
- **Deuxième résultat: un écran d'ordinateur montre 48 pour cent de Tokyo d'un coup** (1 600 sur 900 pixels de carte, sur 2 000 sur 1 500). C'est ce qui explique que le jeu se joue à vue, que la minimap serve peu, et que l'écart avec le téléphone (3,3 pour cent visibles) soit si grand.
- **Point positif, qui n'était pas acquis**: un seul morceau d'un seul tenant sur chaque carte, aucune poche isolée, aucun recoin où une apparition enfermerait un joueur pour toute la partie.
- **L'étude couvre les sept sections prévues**: ce qu'est techniquement une carte (neuf fichiers à livrer, le seuil de luminosité, le piège de l'étirement, le miroir, les cinq endroits du code à toucher, ce que pèse une carte), ce que valent les cartes existantes, ce qu'une partie à plusieurs demande à une carte (apparitions, visibilité, distances, goulets, densité, mode par mode, ce qui s'adapte tout seul et ce qui ne s'adapte pas), douze critères de jugement chiffrés, quatre archétypes, les limites du socle, et ce qu'il faut trancher.
- **Elle ne tranche rien**, comme `etude-grandes-cartes.md`: cinq questions reviennent au porteur du projet, et les suites possibles en dépendent.

## Fichiers créés ou modifiés

Commit `af71917`: `docs/plan/etape-8-1.md` (créé), la fiche.

Commit `6a3082d`:

- `docs/mesures/etude-structures-de-carte.md` (créé): l'étude elle-même.
- `docs/mesures/mesurer-les-cartes.mjs` (créé): l'outil de mesure. **Ce n'est pas du code de jeu**: rien dans `packages/` ne le connaît, le jeu tourne sans lui, et le linter ignore `docs/`. Il se relance par `node docs/mesures/mesurer-les-cartes.mjs`, après `pnpm build`, et met trois secondes par carte.
- `docs/mesures/cartes.json` (créé): la sortie brute de l'outil, rangée comme les autres mesures.
- `docs/plan/ROADMAP.md`: l'étape 8.1 passe à « faite » avec son résultat, et une ligne d'état la décrit. Aucune suite n'y est planifiée, à dessein.
- `docs/design/README.md`: une entrée au journal, datée du 20 septembre 2026.
- `docs/mesures/etude-grandes-cartes.md`: un renvoi croisé vers la nouvelle étude.
- `CLAUDE.md`: une ligne d'index.

Aucune modification de `packages/`, de `tests/`, de `assets/`, de `legacy/` ni de `tests/caracterisation/`.

## Tests

- Ajoutés: aucun, c'est une étude (entrée ROADMAP).
- Résultat: **2 481 tests Vitest au vert** (2 413 du projet `unitaires`, 68 du projet `base`), exactement le compte du handoff 7.8, puisque aucun paquet n'est touché. Types compilés (`tsc --build`), linter et formatage verts.
- Couverture de `packages/sim`: inchangée, le paquet n'est pas touché.
- État de la CI: à vérifier sur `6a3082d` après la poussée. Le commit ne touche que de la documentation et un outil hors `packages/`.

## Décisions et écarts au plan

1. **Un écart assumé à l'entrée ROADMAP, déclaré dans la fiche avant d'être fait.** L'entrée dit « une note, sans code »; l'étude est accompagnée d'un programme de mesure de six cents lignes, commentaires compris. Raison: sans lui, les chiffres de l'étude seraient affirmés et non vérifiables, et ce projet ne fonctionne pas comme cela. Il vit dans `docs/`, rien dans `packages/` ne le connaît, et il réutilise le décodage du serveur au lieu d'en redonner une version approchée, sans quoi ses chiffres ne seraient pas ceux du jeu.
2. **L'étude est rangée dans `docs/mesures/` et non dans `docs/design/`**, à côté de `etude-grandes-cartes.md` dont elle est la suite, et parce qu'elle porte des mesures. Accessoirement, `docs/design/` est exclu du formateur.
3. **Un pixel est dit tenable quand un disque du rayon d'un ninja y tient entièrement.** C'est un peu plus sévère que le moteur, qui échantillonne dix-sept points au lieu du disque entier: une carte jugée bonne par l'outil l'est donc aussi en jeu. C'est écrit dans l'étude.
4. **Les distances de trajet se calculent sur une grille d'un point tous les quatre pixels**, avec les diagonales interdites au coin de deux murs. Au pixel, le calcul aurait pris des minutes pour une précision que personne ne lit.
5. **Les seuils des douze critères sont des propositions, pas des décisions**, sauf quatre d'entre eux (un seul morceau, jouable hors bande de bord, superposition du décor et de la collision, proportions de l'image) qui sont des interdits techniques: une carte qui les rate est cassée.
6. **Trois faits vérifiés dans le dépôt en chemin**, et écrits dans l'étude parce qu'ils ne l'étaient nulle part: le miroir est bien un retournement horizontal des images (à l'octet près pour la collision de Tokyo), **sauf l'avant-plan de Tokyo, identique à 91 pour cent seulement**, retouché à la main, sans doute pour les enseignes; le client étire le décor aux dimensions de la carte quelle que soit la taille de l'image, donc une carte nouvelle n'est pas obligée de faire 3000 sur 2000; et le rayon des zones spéciales s'adapte tout seul à la surface de la carte, contrairement au plafond de faux ninjas et à la hauteur de vue.
7. **Un défaut de l'outil, trouvé et corrigé pendant l'étape**: la transformée de distance comparait des paraboles de hauteur infinie, et `Infinity - Infinity` donne `NaN`, ce qui rendait fausses toutes les comparaisons de sortie de boucle. Le programme tournait sans fin. Un très grand nombre fini règle le problème, et le commentaire l'explique dans le fichier. Rien à voir avec le jeu.

Aucun autre écart. Les cinq micro-décisions de la fiche ont été tenues.

## Problèmes connus et dette

- **L'étude s'arrête volontairement sur cinq questions**, section 7: quelle question on cherche à résoudre (manque-t-il des cartes ou de la structure), quel détour médian on vise, quelle taille, combien de cartes et à quel prix, et si le miroir reste obligatoire (il double la commande). Tant qu'elles ne sont pas tranchées, **aucune étape suivante n'est planifiable**, et le ROADMAP le dit.
- **Le comportement des faux ninjas dans les passages étroits n'a jamais été éprouvé.** Leur dégagement automatique n'a connu que des terrains ouverts: c'est le premier point à surveiller si une carte structurée est prototypée.
- **Le moteur ne connaît pas de ligne de vue**: tout ce qui est à l'écran se voit, même derrière un mur. Une carte pensée pour cacher ne cachera donc que ce que la caméra ne montre pas.
- **Les chiffres du socle au-delà de 500 faux ninjas sont extrapolés**, pas mesurés (environ 8 ms par battement à 1 000). C'est le chantier numéro 1 de `etude-grandes-cartes.md`.

Repris du handoff 7.8, inchangé: une couleur de joueur sombre n'a pas encore été jouée avec le nouveau repère, le rayonnement du calque des repères est à juger sur fond clair, l'équilibre des six objets du Tactique est à jouer, la vue de 500 pixels est à confirmer à plusieurs, et la déclaration du domaine aux moteurs de recherche reste à faire.

## Prochaine action exacte

**Poser les cinq questions de la section 7 de `docs/mesures/etude-structures-de-carte.md` au porteur du projet**, et attendre ses réponses: elles décident de la suite, et rien d'utile ne peut être construit avant. La plus structurante est la deuxième, le détour médian visé, qui fait la différence entre commander un décor et commander un terrain de jeu.

Les deux suites possibles sont décrites à la section 8 de l'étude, et deviendront des étapes à part entière:

- si le détour est la réponse, une étape « carte de travail », qui dessine une collision au trait, sans décor, pour éprouver un quartier en jeu avant toute commande;
- si la taille est la réponse, le chantier de mesure numéro 1 de `etude-grandes-cartes.md`, le banc à 1 000 et 2 000 faux ninjas.

Dans les deux cas, une fiche de commande d'une page pour le graphiste, tirée des sections 1 et 4 de l'étude, précède toute commande.

## Étape suivante

Aucune fiche à lire: la phase 8 n'a pas d'étape 8.2 planifiée, et elle ne peut pas l'être avant les réponses ci-dessus. La prochaine étape se décide avec le porteur du projet, puis sa fiche se rédige selon le cas de repli du PROTOCOLE, comme celle-ci.
