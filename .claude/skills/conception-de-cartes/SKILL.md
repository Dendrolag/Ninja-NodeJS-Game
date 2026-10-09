---
name: conception-de-cartes
description: Concevoir, juger ou ajouter une carte de Neon Ninja. À charger dès qu'il est question d'une carte du jeu - en dessiner une, en juger une proposée, changer les murs d'une existante, régler son plafond de PNJ, commander un décor à un graphiste, ou comprendre pourquoi une carte se joue comme elle se joue. Porte le contrat technique d'une carte (les fichiers à livrer, le seuil de luminosité, le piège de l'étirement, le miroir, les endroits du code à toucher), les douze critères de jugement chiffrés, les vrais nombres du jeu, et la commande qui mesure une carte. Ne sert pas au rendu du décor ni à l'interface.
---

# Concevoir et juger une carte de Neon Ninja

Tout ce qui suit est vérifié dans le dépôt, pas supposé. Le raisonnement complet et les mesures sont dans `docs/mesures/etude-structures-de-carte.md` (étape 8.1); cette compétence en est l'extrait utilisable.

**Règle première: on juge une carte avant d'y jouer, avec des nombres.** Les douze critères ci-dessous se vérifient sur une image, sans lancer le jeu. Une carte qui rate un interdit technique est cassée, pas discutable.

## 1. Ce qu'est une carte

Un dossier `assets/cartes/<carte>/`, avec ses images **dans un seul sens**. Le miroir se calcule depuis l'étape 8.3: le serveur retourne la collision, la page retourne le décor. Une carte se livre donc une fois, et un dossier `mirror/` n'a plus de sens (un test l'interdit).

| Fichier                   | Rôle                                                                                              | Obligatoire |
| ------------------------- | ------------------------------------------------------------------------------------------------- | ----------- |
| `collision.png`           | Les murs. La seule image qui décide de quelque chose                                              | Oui         |
| `background.png`          | Le décor, sous les personnages                                                                    | Oui         |
| `foreground.png`          | L'avant-plan, au-dessus des personnages. La Station lunaire n'en a pas (étape 8.9)                | Presque     |
| `rain.png`                | La pluie, une bande qui défile. Seule Tokyo en a une                                              | Non         |
| `background-parallax.png` | Le lointain, sous le fond, qui glisse moins vite que lui (étape 8.8). Seule Spirit & Time en a un | Non         |
| `background-night.png`    | Le fond de nuit, qui remplace le fond quand l'hôte choisit la nuit (étape 8.9). Station et Prison | Non         |
| `foreground-night.png`    | L'avant-plan de nuit, qui remplace l'avant-plan la nuit (étape 8.11). Seule Prison Island en a un | Non         |
| `spaceship.png`           | Le vaisseau qui survole la carte, au-dessus de tout (étape 8.9). Seule la Station en a un         | Non         |
| `preview.png`             | La vignette, 120 sur 120, montrée dans les réglages                                               | Oui         |

Les chemins se fabriquent à un seul endroit, `packages/shared/src/ressources.ts`, où un test vérifie que chaque fichier annoncé existe.

**La pluie suit le décor.** Elle ne tombe pas dans les intérieurs vus en coupe: ses zones sèches se dessinent sous les toits du fond. En miroir, la page la retourne image par image avec le fond, et ces zones restent à leur place. Une pluie se dessine donc pour le sens normal seulement, comme tout le reste.

## 2. Comment les murs se déduisent de l'image

**Un pixel devient un mur quand la moyenne de ses trois composantes de couleur passe sous 128.** L'opacité est ignorée: une collision livrée en noir sur transparent se lit toute en mur. Elle doit être opaque partout, ce qu'un test vérifie pour chaque carte (étape 8.8, où celle de Spirit & Time est arrivée ainsi et a été posée sur du blanc). Le noir est un mur, le blanc est du sol, le gris bascule à mi-chemin. (`SEUIL_MUR_LUMINOSITE`, `packages/sim/src/collisions.ts`; décodage dans `packages/server/src/terrain.ts`.)

Trois conséquences, à dire à quiconque dessine une carte.

1. **La résolution du mur est le pixel.** Un trait d'un pixel de large est un mur infranchissable: le moteur balaie les trajets pixel par pixel. Un décor fin et détaillé produit des murs fins et détaillés, dans lesquels un ninja de 32 pixels de diamètre ne passe pas.
2. **L'anticrénelage compte.** Un bord adouci produit une bande de gris, dont la moitié sombre devient du mur. Le mur réel est donc plus gros que le trait dessiné, de la moitié de l'adoucissement. Pour une carte de travail, dessiner sans adoucissement.
3. **Collision et décor doivent se superposer exactement.** Rien ne le vérifie: un mur décalé de dix pixels donne un ninja qui bute sur du vide, et aucune erreur nulle part.
4. **Un mur plus fin que neuf pixels peut être chevauché** (étape 8.9). Le moteur ne regarde pas tout le disque d'un ninja: dix-sept points, écartés de huit pixels au plus (`positionTenable`). Un trait plus fin peut passer entre deux points, et la place à cheval sur lui est jugée tenable. Au pied d'un tel trait naissent des poches de quelques pixels, coupées du reste, où une apparition peut tomber et enfermer un ninja pour la partie. Tokyo en a seize depuis le jeu d'origine; la Station lunaire en avait sous le bord de son toit, fermées en épaississant ses traits à neuf pixels. **Depuis l'étape 8.10, le moteur n'y fait plus rien apparaître**: il calcule à la construction de la carte son morceau principal, le plus grand d'un seul tenant au pixel près (`morceauPrincipal`, `dansLeMorceauPrincipal`), et toute apparition s'y tient. Une poche reste donc sans danger, mais du sol perdu, et un ninja continue de chevaucher un trait fin: **un mur se trace toujours à neuf pixels au moins**, et une carte se vérifie au pixel près (`placesEnPoche`, `packages/server/src/terrain.test.ts`), pas seulement au pas de quatre pixels de la mesure.

### Le piège de l'étirement

Les images sont **étirées aux dimensions de la carte, sans conserver les proportions**, des deux côtés: le serveur pour les murs (`redimensionner`), la page pour le décor (`pixi.ts`). Les images de Tokyo font 3000 sur 2000 pour une carte de 2000 sur 1500: elles sont donc écrasées de 11 pour cent, et c'est voulu, parce que c'est ce qui met les murs là où deux ans de jeu les ont mis. Celles de Spirit & Time et du Quartier sont à la taille de leur carte.

**Une carte nouvelle n'a aucune raison de répéter cela: la dessiner aux proportions de la carte, ou directement à sa taille.** C'est le piège principal d'une commande.

## 3. Les vrais nombres du jeu

À avoir en tête avant de tracer quoi que ce soit. Tous dans `packages/shared/src/constantes.ts`, sauf la vue.

| Quoi                                | Valeur                    | Ce que ça veut dire pour une carte                           |
| ----------------------------------- | ------------------------- | ------------------------------------------------------------ |
| Diamètre d'un ninja                 | 32 px (`RAYON_ENTITE` 16) | Moins de 32 px de passage: personne ne passe                 |
| Vitesse, tout le monde              | 150 px/s                  | On ne rattrape rien sans bonus ni raccourci                  |
| Bonus de vitesse                    | x1,7                      | 255 px/s, les durées se divisent d'autant                    |
| Vue sur ordinateur                  | 900 px de haut            | Soit 1600 x 900 px de carte sur un écran 16:9                |
| Vue en Tactique                     | 500 px de haut            | Soit 889 x 500, 31 pour cent de la surface ordinaire         |
| Cadrage sur téléphone               | 360 x 271 px              | Quinze fois moins que l'ordinateur: ce n'est pas le même jeu |
| Bande de bord interdite             | 100 px                    | Aucune apparition n'y tombe                                  |
| Distance de sécurité à l'apparition | 100 px                    | Un souhait, pas une obligation, mais il faut la place        |
| Rayon d'une zone spéciale           | racine de (surface / 5π)  | S'adapte tout seul: 437 px sur Tokyo, 519 sur Spirit & Time  |
| Protection au spawn                 | 3 s                       | Le temps de sortir d'un mauvais endroit                      |

**Ce qui ne s'adapte pas tout seul à la taille**: le plafond de PNJ (par carte), la hauteur de vue (fixe, donc la part visible baisse quand la carte grandit), la cadence d'apparition des objets (donc leur densité baisse aussi), et la capacité en joueurs (propriété du mode).

## 4. Les douze critères de jugement

Se vérifient sur une carte proposée avant qu'elle soit dessinée pour de bon. Les six premiers par la mesure (section 5), les six suivants à l'œil.

| #   | Critère                                   | Seuil                                 | Pourquoi                                                          |
| --- | ----------------------------------------- | ------------------------------------- | ----------------------------------------------------------------- |
| 1   | Un seul morceau d'un seul tenant          | 100 % du jouable                      | Une poche isolée enferme un joueur pour toute la partie           |
| 2   | Part jouable                              | 45 % au moins de la surface           | En dessous, les apparitions peinent                               |
| 3   | Jouable hors bande de bord                | 70 % au moins du jouable              | C'est là que toutes les apparitions se tirent                     |
| 4   | Dixième le plus serré des passages        | 20 px de dégagement, soit 40 de large | En dessous, un ninja se coince sur un décor qui semble praticable |
| 5   | Surface jouable par entité, partie pleine | 5 000 px² au moins                    | En dessous, la distance de sécurité devient inatteignable         |
| 6   | Traversée complète                        | 12 à 30 s à 150 px/s                  | En dessous c'est un couloir, au-delà les temps morts s'allongent  |
| 7   | Détour médian                             | selon l'intention, voir section 6     | La mesure de la structure. 1,0 est un champ, 1,5 un dédale        |
| 8   | Superposition décor et collision          | exacte, au pixel                      | Rien ne la vérifie, l'erreur est invisible à la lecture           |
| 9   | Proportions image et carte                | identiques                            | Sinon le décor est étiré, comme Tokyo l'est depuis deux ans       |
| 10  | Lisibilité du mur dans le décor           | on doit voir où l'on ne va pas        | Un mur invisible se vit comme un bug                              |
| 11  | Avant-plan justifié                       | il cache, il ne gêne pas              | Ce qui passe au-dessus du joueur peut le perdre                   |
| 12  | Vignette parlante à 120 px                | la structure se reconnaît             | C'est ce que le joueur voit dans les réglages                     |

**Les critères 1, 3, 8 et 9 sont des interdits techniques**: une carte qui les rate est cassée. Les seuils des critères 2, 4, 5, 6 et 7 sont des propositions de l'étude, ajustables avec le porteur du projet.

## 5. Mesurer une carte

Depuis la racine du dépôt, après `pnpm build`:

```bash
node docs/mesures/mesurer-les-cartes.mjs
```

Pour ne mesurer qu'une carte, la nommer. Indispensable quand on met une carte au point, où la boucle dessiner-mesurer se répète des dizaines de fois:

```bash
node docs/mesures/mesurer-les-cartes.mjs quartier
```

L'outil décode les terrains **par le chemin réel du serveur** (étirement et seuil compris), et écrit `docs/mesures/cartes.json`. Une mesure partielle ne réécrit pas ce fichier, pour ne pas y perdre les cartes sautées. Pour ajouter une carte, l'inscrire dans la table `TERRAINS` en tête du fichier. Deux à quatre secondes par carte.

Ce que chaque nombre veut dire:

- `partDeSolPct`: ce qui n'est pas mur. `partTenablePct`: ce où un ninja tient vraiment, disque entier compris. L'écart entre les deux est l'encombrement des murs.
- `morceaux` et `partDuPrincipalPct`: le critère 1. Autre chose que `1` et `100` est une carte cassée.
- `degagementPx`: la demi-largeur des passages. **Le double est la largeur.** Médiane 64 sur Tokyo veut dire des passages de 128 px, quatre fois un ninja.
- `traverseeS` et `parcoursTypiqueS`: à la vitesse du jeu, du point le plus loin à son opposé, et entre deux apparitions tirées au sort.
- `detourMedian`: chemin réel divisé par le vol d'oiseau. **C'est la mesure de la structure.**

### Les cartes du jeu

| Mesure              | Tokyo (2000x1500) | Spirit & Time (2400x1760) | Quartier (2400x1800) | Station (2000x1524) | Prison (2390x1738) |
| ------------------- | ----------------: | ------------------------: | -------------------: | ------------------: | -----------------: |
| Part tenable        |            75,3 % |                    64,6 % |               59,6 % |              47,0 % |             22,7 % |
| Dégagement médian   |             64 px |                    226 px |                60 px |              142 px |              35 px |
| Traversée           |            18,0 s |                    16,2 s |               21,3 s |              12,2 s |             23,1 s |
| **Détour médian**   |          **1,08** |                  **1,06** |             **1,24** |            **1,07** |           **1,32** |
| Plafond de PNJ      |               300 |                       360 |                  340 |                 190 |                125 |
| Part vue d'un écran |              48 % |                      34 % |                 33 % |                47 % |               35 % |

**Les deux cartes héritées sont des terrains ouverts**: un détour de 1,07 à 1,08 veut dire qu'il n'y a ni couloir, ni détour à subir, ni raccourci à connaître. Les murs de Tokyo sont du mobilier qu'on contourne, pas une structure qui organise.

**Le Quartier est le premier terrain du jeu où le chemin se choisit** (étape 8.2, 20 septembre 2026): quatre colonnes et trois lignes d'îlots, des rues de 120 pixels, deux artères traversantes, et sept îlots sur huit bâtis en ceinture de 65 pixels autour d'une cour ouverte par une seule porte.

Note: le détour de l'ancienne Spirit & Time se lisait 1,06 à l'étape 8.1, avec vingt-quatre points de départ tirés, et 1,07 avec quatre-vingts. L'outil en tire quatre-vingts depuis l'étape 8.2, parce que vingt-quatre laissaient le détour bouger de cinq centièmes selon le tirage.

**La Station lunaire (étape 8.9) est la plus petite carte du jeu**: le toit d'une station et son quai, dessinés par 2-Minute Tabletop, la Lune autour en mur. Terrain ouvert (1,07), traversée tout juste au seuil de 12 secondes. Le quai ne tient au toit que par deux monte-charges, d'où son test de connexité. Elle se joue de jour ou de nuit, et un vaisseau la survole, avec son ombre en parallaxe de jour.

**Prison Island (étape 8.11) est la carte la plus structurée du jeu**: une prison bâtie sur un îlot, dessinée par 2-Minute Tabletop, la mer autour en mur. Détour de 1,32, couloirs de 70 pixels, cellules à une porte, d'où la plus faible part tenable du jeu. Livrée à 1838 sur 1337, elle n'était pas jouable: un plan de jeu de rôle compte un carreau par personnage, et ses portes, d'un carreau, laissaient moins que les 32 pixels d'un ninja. Agrandie de 30 pour cent, elle tient. Elle se joue de jour ou de nuit, et son avant-plan (tables, lits) change avec le fond.

**Spirit & Time a changé de terrain à l'étape 8.8**: le décor livré par le porteur du projet, un toit-terrasse ceint de murs au-dessus d'une ville, réduit de 20 pour cent pour que les ninjas n'y paraissent pas trop petits. L'ancienne était un champ de 3000 sur 2000, tenable à 94,4 pour cent, plafonnée à 500 PNJ. La nouvelle reste un terrain ouvert (1,06), mais bordé de murs: tout son tenable est hors de la bande d'apparition.

## 5 bis. Une carte se calcule, elle ne se dessine pas

Leçon de l'étape 8.2, qui a produit le Quartier. La carte est écrite par un programme, `docs/mesures/dessiner-le-quartier.mjs`, à copier comme modèle. Trois raisons, dont deux n'étaient pas prévues.

1. **La mise au point demande des dizaines d'essais mesurés.** Chacun serait un nouveau dessin dans un éditeur d'images. Le Quartier en a demandé une quinzaine.
2. **Les critères 8 et 9 deviennent vrais par construction**, puisque le même programme écrit la collision et le décor à la même dimension dans la même passe. On ne peut plus les rater.
3. **La géométrie devient lisible et modifiable**: elle est écrite en clair, pas enfouie dans des pixels.

### Trois règles de structure, établies contre la mesure

Elles ont coûté des essais, elles se réutilisent telles quelles.

- **Pas de boulevard périphérique.** Il offre un contournement gratuit de toute la structure, et il remplit de sol la bande de cent pixels où se tirent les apparitions. Au premier essai du Quartier: 68 pour cent de jouable hors bande, contre 70 exigés. Une fois les îlots posés au ras du bord: 93 pour cent.
- **Des cours à une seule porte.** Une deuxième porte en face fait tomber le détour de 1,24 à 1,10: une cour traversante n'est plus une cour, c'est une rue.
- **Pas de place centrale.** Une cellule vide au croisement des artères coûte 0,09 de détour, une place taillée dans les angles seulement 0,03. Le croisement tient lieu de repère par la couleur du sol, sans retirer un seul mur.

Quatrième leçon, sur la part jouable: **une ceinture bâtie autour d'une cour encombre autant qu'un pâté plein et coûte trois fois moins de mur.** C'est ce qui a permis au Quartier de tenir 59,6 pour cent de jouable tout en atteignant 1,24 de détour.

## 6. Ce que chaque mode demande au terrain

| Mode     | Ce qu'il demande                                                | Ce qui le gêne                |
| -------- | --------------------------------------------------------------- | ----------------------------- |
| Horde    | De la densité, des trajets courts entre troupeaux               | Le vide, qui casse les combos |
| Tactique | De quoi se cacher et se contourner (vue de 500 px seulement)    | Le terrain ouvert             |
| Équipes  | Une carte lisible en deux moitiés, un milieu à tenir            | Une carte sans centre         |
| Chasse   | Des détours et des cachettes, pour que la proie se perde de vue | Le terrain ouvert             |
| Massacre | Une carte qui se vide, donc peu de recoins                      | Les culs-de-sac               |

Trois modes sur cinq profitent d'une carte plus structurée que les nôtres, deux la redoutent. C'est un argument pour que les cartes ne soient pas interchangeables.

**Repères de détour**: 1,06 à 1,08 aujourd'hui, 1,20 à 1,35 pour un quartier à pâtés de maisons, 1,45 à 1,70 pour un dédale, au-delà de 2 pour un labyrinthe.

## 7. Ajouter une carte au jeu: les endroits du code

1. `CARTES` (`packages/shared/src/constantes.ts`): identifiant et dimensions. La validation des réglages en découle.
2. `CARTES_ENREGISTREES`: la même liste plus les cartes retirées. **L'énumération PostgreSQL en est tirée, donc une migration de la base est nécessaire.** Une carte retirée du jeu y reste, sinon les parties enregistrées deviennent illisibles.
3. `PLAFONDS_DE_FAUX_NINJAS`: combien de PNJ au départ. **À justifier par une mesure au banc de charge, jamais au jugé.**
4. `PRESENTATION_CARTES` (`packages/client/src/interface/modeles/cartes.ts`): nom et ambiance. L'oublier est une erreur de compilation, à dessein.
5. `cheminPluie` (`packages/shared/src/ressources.ts`), si la carte a une pluie.
6. `cheminLointain`, au même endroit, si la carte a un lointain. Son amplitude (`LOINTAIN`, `packages/client/src/rendu/apparence.ts`) se règle sur la marge que le terrain laisse autour de ce qu'il cache, mesurée par `parallaxe.test.ts`.
7. `cheminAvantPlan`, `cheminFondDeNuit` et `cheminVaisseau`, au même endroit (étape 8.9): une carte sans avant-plan, une carte qui a une nuit (le réglage `nuit` ne se propose alors que sur elle), une carte qu'un vaisseau survole. `cheminAvantPlanDeNuit` (étape 8.11), une carte dont l'avant-plan change aussi la nuit. Les réglages du vaisseau, sa vitesse, son altitude, son ombre, sont dans `VAISSEAU` (`apparence.ts`), sa course dans `packages/client/src/rendu/vaisseau.ts`, tirée de la graine du décor que le serveur donne à chaque lancement.
8. Le test de connexité de `packages/server/src/terrain.test.ts` (« les cartes à passages étroits »), si la carte a des passages étroits ou des parties qui ne tiennent au reste que par eux.

## 8. Décisions déjà prises, à ne pas rouvrir

Porteur du projet, 20 septembre 2026, en réponse à l'étude 8.1 (section 7.1).

- **La structure d'abord**, avant tout contenu nouveau.
- **Détour médian visé: 1,20 à 1,35**, l'archétype du quartier. **Réalisé: 1,24**, le Quartier, étape 8.2.
- **Taille visée: 2400 sur 1800.** Réalisée. Un écran en montre 33 pour cent, contre 48 sur Tokyo.
- **Pas de graphiste pour l'instant**: on avance en noir et blanc, et un décor ne se commande que si la structure convainc. Le Quartier est donc une carte de travail, au trait, et elle se joue telle quelle.
- **Une carte porte un nom, pas un numéro** (étape 8.2): `quartier`, et non `map4`. `map1` et `map3` sont des noms de fichiers hérités, pas une numérotation à poursuivre. Conséquence assumée: la valeur entre dans l'énumération PostgreSQL et n'en sortira jamais, une valeur retirée rendant illisibles les parties déjà jouées.
- **Le miroir est calculé par le jeu**, et non livré en images: **étape 8.3, faite le 25 septembre 2026**. Le serveur retourne l'image de collision avant de l'étirer, ce qui redonne à l'octet près les murs des anciennes images de miroir; la page retourne le fond, la pluie et l'avant-plan. La réserve de l'étude sur l'avant-plan de Tokyo était fausse: seuls des pixels entièrement transparents différaient, aucune retouche visible. Conséquence pour une commande: **rien ne se lit à l'envers qui ne se lise aussi à l'endroit**, puisque plus rien ne permet de retoucher un miroir. Spirit & Time, dont le miroir n'était qu'une copie de la carte normale depuis le jeu d'origine, est devenu un vrai miroir (défaut X37 de l'audit).
- **Le repérage se juge à la recette**, pas à l'avance: la minimap ne se repense que si l'on se perd vraiment.

Décision plus ancienne, toujours valable: **le miroir est un réglage de carte, pas un mode** (journal de conception, 10 septembre 2026). Il se combine avec n'importe quel mode.

## 9. Points de vigilance

1. **Le dégagement automatique des PNJ n'a jamais été éprouvé sur une carte à passages étroits.** Il n'a connu que des terrains ouverts, et les sept cours à une seule porte du Quartier sont exactement ce qui peut le mettre en défaut. Un test vérifie que 340 PNJ tiennent tous à leur apparition, ce qui ne dit rien de leur errance ensuite. **À jouer à plusieurs.**
2. **Le Massacre et les culs-de-sac.** Sept cours à une porte font sept refuges, et le mode veut une carte qui se vide. C'est celui qui risque le plus de traîner sur le Quartier.
3. **Le moteur ne connaît pas de ligne de vue**: tout ce qui est à l'écran se voit, même derrière un mur. Une carte pensée pour cacher ne cachera que ce que la caméra ne montre pas.
4. **Les murs ne coûtent rien au serveur.** À nombre égal de PNJ, Tokyo et Spirit & Time se mesurent à quelques centièmes de milliseconde près. Ce qui coûte est le nombre d'entités, pas la surface ni les murs.
5. **Le socle tient environ 12 Mpx et 1 000 PNJ** sans rien changer. Au-delà, ce sont les quatre plafonds de `docs/mesures/etude-grandes-cartes.md` qui reprennent la main.
6. **Un mur de moins de neuf pixels se chevauche** (section 2, point 4). Depuis l'étape 8.10, les poches qu'il crée n'enferment plus personne: aucune apparition n'y tombe. Il reste un défaut de dessin, du sol perdu.
7. **Générer une image de collision avec un modèle d'image est le mauvais instrument.** L'anticrénelage y épaissit chaque mur de façon incontrôlée, et on rate par construction les critères 4 et 8. Une collision se trace, elle ne se génère pas.
8. **Un plan de jeu de rôle livré tel quel est trop petit** (étape 8.11). Il compte un carreau par personnage, quarante pixels environ, et ses portes d'un carreau, une fois les pierres du mur dessinées, laissent moins que les 32 pixels d'un ninja. Mesurer d'abord à la taille livrée: si les morceaux se comptent par dizaines, agrandir la carte (Prison Island, 30 pour cent), la même échelle sur les deux axes, et la collision au plus proche voisin.
9. **Un mur dessiné à la main a un bord rugueux, et chaque creux de ce bord peut faire une poche** (étape 8.11). Le moteur juge une place en dix-sept points: entre deux pierres saillantes, une place isolée devient tenable. Prison Island en avait plus de deux cents, d'une à six places. Combler les creux plus étroits qu'un disque de quatre pixels de rayon (fermeture: dilater les murs, puis les éroder d'autant) en a fermé presque toutes; les dernières se ferment pixel par pixel, en noircissant un point de leur contour collé à un mur. `placesEnPoche` doit tomber à zéro dans les deux sens: le miroir arrondit autrement, et a ses propres poches.

## Pour commander un décor à un graphiste

Voir `fiche-de-commande.md`, à côté de ce fichier: la page à lui remettre, tirée des sections 1 à 4.
