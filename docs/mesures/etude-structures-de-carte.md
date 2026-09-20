# Étude - Les structures de carte (20 septembre 2026)

Étape 8.1, ouverture de la phase 8. Demande du porteur du projet: **une étude avant tout prototype**, pour savoir ce qu'on commanderait à un graphiste avant de lui commander quoi que ce soit.

**L'étude elle-même ne décide de rien.** L'étude dit ce qu'est techniquement une carte, ce que valent les deux cartes existantes, ce qu'une carte doit à une partie à plusieurs, comment juger une proposition, et ce que coûtent quelques structures possibles. Elle liste ce qui revient au porteur du projet, **et ses réponses, données le jour même, sont consignées à la section 7.1**: un quartier de 2400 sur 1800, à 1,20 de détour, éprouvé d'abord en carte de travail, sans graphiste, avec un miroir calculé par le jeu.

**Complétée le 20 septembre 2026 par la section 9**, qui mesure la carte de travail produite à l'étape 8.2 et la juge par les douze critères de la section 4. Les sections 1 à 8 sont restées telles qu'elles étaient: c'est le raisonnement qui a mené à cette carte.

Ce document ne remplace pas `etude-grandes-cartes.md` (16 septembre 2026), qui traite du très grand, 2 000 à 10 000 faux ninjas, et qui reste la référence sur ce sujet. Celui-ci traite des cartes qu'on pourrait commander demain, à des tailles que le socle tient déjà.

## Ce que l'étude a trouvé, en cinq lignes

1. **Une carte, c'est quatre images et cinq lignes de code.** La liste est courte et entièrement connue: section 1.
2. **Nos deux cartes n'ont presque aucune structure.** Mesurées, ce sont deux terrains ouverts: le chemin le plus court entre deux points y est 6 à 8 pour cent plus long qu'à vol d'oiseau. Il n'y a ni couloir, ni détour, ni cachette: section 2.
3. **On voit la moitié de Tokyo d'un seul écran** (48 pour cent de sa surface). Une carte plus grande ne serait pas seulement plus longue à traverser, elle changerait ce que le joueur sait de la partie: section 3.
4. **Douze critères mesurables** suffisent à juger une carte avant de la dessiner, et le programme qui les mesure existe: section 4.
5. **Le socle tient jusqu'à environ 12 millions de pixels et 1 000 faux ninjas** sans rien changer, soit quatre fois Tokyo. Au-delà, les plafonds de `etude-grandes-cartes.md` reprennent la main: section 6.

## 1. Ce qu'est techniquement une carte

### 1.1 Les fichiers à livrer

Une carte est un dossier `assets/cartes/<carte>/`, avec une vignette et deux orientations, `normal/` et `mirror/`. Les chemins se fabriquent à un seul endroit, `packages/shared/src/ressources.ts`, et un test y vérifie que chaque fichier annoncé existe.

| Fichier                        | Rôle                                                                    | Qui le lit                                | Obligatoire |
| ------------------------------ | ----------------------------------------------------------------------- | ----------------------------------------- | ----------- |
| `<orientation>/collision.png`  | Où sont les murs. C'est la seule image qui décide de quelque chose      | Le serveur (`packages/server/terrain.ts`) | Oui         |
| `<orientation>/background.png` | Le décor, sous les personnages                                          | Le client                                 | Oui         |
| `<orientation>/foreground.png` | L'avant-plan, au-dessus des personnages: toits, passerelles, feuillages | Le client                                 | Oui         |
| `<orientation>/rain.png`       | La pluie, une bande qui défile. Seule Tokyo en a une                    | Le client                                 | Non         |
| `preview.png`                  | La vignette de 120 sur 120 montrée dans les réglages de partie          | Le client                                 | Oui         |

Soit **neuf fichiers** pour une carte avec pluie, sept sans.

### 1.2 Comment les murs se déduisent de l'image

`collision.png` est une image ordinaire. Le serveur la décode, la ramène aux dimensions de la carte, et **un pixel devient un mur quand la moyenne de ses trois composantes de couleur passe sous 128** (`SEUIL_MUR_LUMINOSITE`, `packages/sim/src/collisions.ts`). L'opacité est ignorée. En clair, pour le graphiste: **le noir est un mur, le blanc est du sol, et le gris bascule à mi-chemin.**

Trois conséquences à lui dire, sinon il livrera une carte fausse.

1. **La résolution du mur est le pixel.** Un trait d'un pixel de large est un mur infranchissable: le moteur balaie les trajets pixel par pixel (défaut X15 de l'audit, corrigé). Un décor fin et détaillé produit des murs fins et détaillés, dans lesquels un ninja de 32 pixels de diamètre ne passe pas.
2. **L'anticrénelage compte.** Un bord adouci produit une bande de gris, dont la moitié sombre devient du mur. Le mur réel est donc un peu plus gros que le trait dessiné, de la moitié de l'adoucissement.
3. **L'image de collision et le décor doivent se superposer exactement.** Rien ne le vérifie: un mur décalé de dix pixels donne un ninja qui bute sur du vide, et aucune erreur nulle part.

### 1.3 Le piège de l'étirement

Les six images actuelles mesurent toutes **3000 sur 2000**, y compris celles de Tokyo, dont la carte mesure **2000 sur 1500**. Le jeu d'origine les étirait aux dimensions de la carte **sans conserver les proportions**, et les deux côtés du portage reproduisent cet étirement: le serveur pour les murs (`redimensionner`), le client pour le décor (`pixi.ts`, `image.width = options.carte.largeur`).

Les images de Tokyo sont donc écrasées verticalement de 11 pour cent, en jeu, depuis deux ans. C'est le comportement voulu, parce que c'est lui qui met les murs là où deux ans de jeu les ont mis.

**Pour une carte nouvelle, rien n'oblige à répéter cela**: il suffit de dessiner aux proportions de la carte, ou directement à sa taille. C'est le piège principal de la commande: un graphiste à qui on ne dirait rien livrerait au format de son choix, et le résultat serait étiré sans que personne ne comprenne pourquoi.

### 1.4 Le miroir

Le miroir n'est pas un mode de jeu, c'est un réglage de carte (journal de conception, 10 septembre 2026), et il se combine avec n'importe quel mode. Techniquement, ce sont **quatre autres images**, livrées à part, dans `mirror/`.

Vérifié dans les images actuelles: le miroir est bien le retournement horizontal du normal, à l'octet près pour la collision de Tokyo, à 99,9 pour cent pour Spirit & Time. **Une seule exception, l'avant-plan de Tokyo, identique à 91 pour cent seulement**: quelqu'un l'a retouché, sans doute pour que les enseignes et les textes ne se lisent pas à l'envers.

Deux façons de commander, donc: livrer huit images, ou en livrer quatre et retourner les autres, en retouchant à la main ce qui se lit. Le jeu, lui, ne sait pas qu'un miroir est un retournement: il charge un autre dossier.

### 1.5 Les cinq endroits du code à toucher

Ajouter une carte ne demande aucune refonte, mais elle n'apparaît pas toute seule.

1. `CARTES` (`packages/shared/src/constantes.ts`): son identifiant et ses dimensions en pixels. La validation des réglages de partie en découle.
2. `CARTES_ENREGISTREES`, la même liste plus les cartes retirées du jeu. **L'énumération PostgreSQL en est tirée**: ajouter une carte demande donc une migration de la base.
3. `PLAFONDS_DE_FAUX_NINJAS`: combien de faux ninjas la carte accepte au départ. Un chiffre à justifier par une mesure, pas au jugé.
4. `PRESENTATION_CARTES` (`packages/client/src/interface/modeles/cartes.ts`): son nom et son ambiance, tels que le joueur les lit. Oublier cette ligne est une erreur de compilation, à dessein.
5. `cheminPluie` (`packages/shared/src/ressources.ts`), si la carte a une pluie: il ne connaît aujourd'hui que Tokyo.

### 1.6 Ce que pèse une carte

Tokyo pèse **5,9 Mo** d'images, presque tout dans ses deux décors (2,3 Mo chacun); Spirit & Time, dont le décor est presque vide, pèse **0,2 Mo**. Ces images se téléchargent à l'entrée en partie. C'est le seul coût de contenu d'une carte: côté serveur, ses murs tiennent dans un bit par pixel, soit 375 Ko pour Tokyo et 750 Ko pour Spirit & Time, décodés une fois puis partagés par toutes les parties.

## 2. Ce que valent les deux cartes existantes

Chiffres bruts: `docs/mesures/cartes.json`, écrits par `docs/mesures/mesurer-les-cartes.mjs`. Ils se relancent d'une commande, depuis la racine du dépôt, après `pnpm build`:

```bash
node docs/mesures/mesurer-les-cartes.mjs
```

L'outil décode les quatre terrains jouables **par le chemin réel du serveur**, étirement et seuil compris, puis mesure. Un pixel est dit tenable quand un disque du rayon d'un ninja y tient entièrement, ce qui est un peu plus sévère que le moteur, qui échantillonne dix-sept points au lieu du disque entier: une carte jugée bonne ici l'est donc aussi en jeu. Les distances de trajet se calculent sur une grille d'un point tous les quatre pixels, avec les diagonales interdites au coin de deux murs.

### 2.1 Les chiffres

| Mesure                                         |            Tokyo |    Spirit & Time |
| ---------------------------------------------- | ---------------: | ---------------: |
| Dimensions                                     |      2000 x 1500 |      3000 x 2000 |
| Surface                                        |          3,0 Mpx |          6,0 Mpx |
| Part de sol (hors murs)                        |           88,9 % |           97,5 % |
| Part où un ninja tient réellement              |           75,3 % |           94,4 % |
| Morceaux séparés, et part du plus grand        |    1, soit 100 % |    1, soit 100 % |
| Part du jouable hors bande de bord             |           82,7 % |           85,7 % |
| Dégagement médian (demi-largeur d'un passage)  |            64 px |           258 px |
| Dégagement, dixième le plus serré              |            24 px |            63 px |
| Dégagement maximal                             |           244 px |           611 px |
| Traversée, du point le plus loin à l'opposé    | 2 699 px, 18,0 s | 3 778 px, 25,2 s |
| Parcours typique entre deux apparitions        |    956 px, 6,4 s | 1 506 px, 10,0 s |
| Parcours court (un sur dix)                    |            2,5 s |            3,9 s |
| Parcours long (un sur dix)                     |           11,1 s |           16,2 s |
| **Détour médian** (chemin réel / vol d'oiseau) |         **1,08** |         **1,07** |

Les durées sont à la vitesse du jeu, 150 pixels par seconde; avec le bonus de vitesse, elles se divisent par 1,7. Les chiffres du miroir sont identiques à la virgule près, comme attendu d'un retournement: seule la traversée de Tokyo diffère de 1,6 pour cent, effet du pas de grille et non du terrain.

Mise à jour du 20 septembre 2026, étape 8.2: **le détour de Spirit & Time est passé de 1,06 à 1,07**, et lui seul. L'outil tirait vingt-quatre points de départ, ce qui suffisait sur ces deux cartes ouvertes, où tous les trajets se ressemblent. Sur une carte structurée, le chiffre bougeait de cinq centièmes selon le tirage, ce qui est plus que ce qu'on cherchait à mesurer. Il en tire maintenant quatre-vingts, soit six mille trajets. Tokyo n'a pas bougé d'un centième.

### 2.2 Ce que ces chiffres disent

**Nos deux cartes sont des terrains ouverts, pas des structures.** Le détour médian est la mesure qui le dit le plus clairement: 1,08 et 1,07. Aller d'un point à un autre coûte 6 à 8 pour cent de plus qu'en ligne droite. Dans une carte à couloirs, ce nombre monte à 1,3 ou 1,5; dans un labyrinthe, à 2 et au-delà. Il n'y a chez nous ni détour à subir, ni raccourci à connaître, ni chemin à choisir.

**Les murs de Tokyo sont du mobilier.** Ils occupent 11 pour cent de la surface, et ce qu'ils retirent au jouable (13,6 points de plus, par leur seul encombrement) tient au fait qu'un ninja ne peut pas se coller à eux. Le passage médian fait 128 pixels de large, quatre fois un ninja. Ce sont des obstacles qu'on contourne, pas des murs qui organisent.

**Spirit & Time est une salle vide.** 94 pour cent de jouable, un dégagement médian de 258 pixels: le nom est honnête.

**Aucune des deux n'a de piège de conception**: un seul morceau d'un seul tenant, aucune poche isolée, aucun recoin où une apparition enfermerait un joueur. C'est le point positif de la mesure, et il n'était pas acquis: c'est exactement ce qu'un décor commandé sans contrainte produirait par accident.

**Les deux se traversent en moins d'une demi-minute**, et deux joueurs tirés au sort se trouvent à six à dix secondes l'un de l'autre. Une partie dure trois minutes par défaut: on fait une trentaine de fois ce trajet dans une partie.

## 3. Ce qu'une carte doit à une partie à plusieurs

### 3.1 Les apparitions

Toutes les entités apparaissent par le même tirage, `positionDApparition` (`packages/sim/src/etat.ts`): cent tirages au sort à **cent pixels des bords**, on garde le premier qui tient et qui respecte **cent pixels de distance de sécurité** avec ce qui est déjà posé; sinon une recherche en spirale depuis le centre prend le relais.

Ce que cela demande à une carte:

- **Assez de surface jouable dans la bande centrale.** Aujourd'hui 83 et 86 pour cent du jouable y sont: confortable. Une carte dont le jouable serait collé aux bords ferait échouer les cent tirages et tomberait sur la spirale, qui pose tout le monde au centre.
- **Assez de place pour la distance de sécurité.** Une partie pleine de Tokyo pose 12 joueurs, 300 faux ninjas et quelques bots noirs, soit environ 315 entités sur 2,26 Mpx de jouable: **7 200 pixels carrés par entité, un carré de 85 pixels de côté**. La distance de sécurité de 100 pixels est donc déjà, en fin de remplissage, plus large que la place disponible en moyenne. Elle reste un souhait et non une obligation, par conception, mais une carte plus petite ou plus peuplée la rendrait inatteignable et ferait travailler le tirage pour rien.
- **Aucune poche isolée.** Une apparition dans un recoin fermé par des murs donnerait un joueur prisonnier de sa partie. Rien dans le code ne l'empêche: c'est à la carte de ne pas en avoir.

### 3.2 Ce que le joueur voit

Sur ordinateur, la caméra montre toujours **900 pixels de carte en hauteur** quelle que soit la fenêtre (`HAUTEUR_DE_VUE_PX`), soit 1 600 sur 900 pixels de carte sur un écran 16:9. Le Tactique regarde de plus près, 500 pixels (étape 7.7). Sur téléphone, le cadrage est serré, 360 sur 271.

| Cadrage                     | Surface vue | Part de Tokyo | Part de Spirit & Time |
| --------------------------- | ----------: | ------------: | --------------------: |
| Ordinateur, 900 px          |    1,44 Mpx |      **48 %** |                  24 % |
| Ordinateur, Tactique 500 px |    0,44 Mpx |          15 % |                 7,4 % |
| Téléphone                   |    0,10 Mpx |         3,3 % |                 1,6 % |

**On voit la moitié de Tokyo d'un seul écran.** C'est sans doute le chiffre le plus important de cette étude. Il explique pourquoi le jeu se joue à vue, pourquoi la minimap sert peu, et pourquoi le repère de localisation de l'étape 7.8 est un confort et non une nécessité. Il explique aussi l'écart entre l'ordinateur et le téléphone, où l'on voit quinze fois moins: ce ne sont pas tout à fait les mêmes jeux.

Une carte deux fois plus grande ne rend pas seulement les trajets plus longs: elle fait passer le joueur de « je vois la partie » à « je cherche la partie ». C'est un changement de nature, pas de degré, et il demande alors ce que le jeu n'a pas encore: une minimap qui montre plus, ou un repérage des adversaires.

### 3.3 Les distances et la poursuite

Le jeu tient parce que joueurs et faux ninjas vont exactement à la même vitesse depuis l'étape 7.5, 150 pixels par seconde: **on ne rattrape rien sans bonus de vitesse ni raccourci**. C'est ce qui donne leur valeur aux bonus, et ce qui donnerait leur valeur à des murs bien placés, qui n'existent pas encore.

Sur les cartes actuelles, six à dix secondes séparent deux joueurs tirés au sort, et la protection au spawn dure trois secondes. Une carte où ce chiffre doublerait allongerait d'autant le temps mort entre deux rencontres.

### 3.4 Les goulets et les culs-de-sac

Rien dans le jeu n'interdit un goulet: le moteur laisse passer tout ce qui est plus large que 32 pixels. Mais un goulet est un endroit où la vitesse commune devient un blocage, et un cul-de-sac est un endroit où une capture est acquise d'avance. Ce sont les deux formes qu'une carte de ce jeu doit manier avec précaution, et les deux qu'un graphiste produira spontanément s'il dessine une ville réaliste.

Un repère utile, pour un ninja de 32 pixels de diamètre: **un passage de moins de 32 pixels ne laisse passer personne, et un passage de moins de 64 ne laisse pas deux ninjas se croiser.** Le dixième le plus serré de Tokyo est à 48 pixels de large: un ninja y passe, deux ne s'y croisent pas. Ces endroits-là existent donc déjà, mais ils sont rares et personne ne les a placés exprès.

### 3.5 La densité de faux ninjas

Le plafond est par carte: 300 pour Tokyo, 500 pour Spirit & Time, mesurés à l'étape 7.6. Rapportés au jouable, ce sont **7 530 et 11 330 pixels carrés par faux ninja**, soit un tous les 87 et 106 pixels. Tokyo est donc sensiblement plus dense que Spirit & Time.

Ce chiffre est le vrai réglage d'ambiance d'une carte: c'est lui qui décide si l'on court après une foule ou après des isolés. Une carte nouvelle se voit donc attribuer un plafond proportionné à son jouable, et pas à sa surface: sur une carte à 50 pour cent de murs, la moitié des pixels ne compte pas.

### 3.6 Ce que chaque mode demande en propre

| Mode     | Ce qu'il demande à la carte                                                                                                                    | Ce qui le gênerait                                       |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Horde    | De la densité de faux ninjas, et des trajets courts entre troupeaux. Le combo récompense l'enchaînement: il faut que la foule soit atteignable | Le vide, qui casse les enchaînements                     |
| Tactique | De quoi se cacher et se contourner. Le joueur ne voit que 500 pixels, et son tir a des charges limitées                                        | Le terrain ouvert, où tout se voit et rien ne s'approche |
| Équipes  | Une carte lisible en deux moitiés, et un milieu qui vaille la peine d'être tenu                                                                | Une carte sans centre                                    |
| Chasse   | Des détours et des cachettes: la proie marque en parcourant, le traqueur doit pouvoir la perdre de vue                                         | Le terrain ouvert, où une proie ne se cache jamais       |
| Massacre | Une carte qui se vide dans le temps d'une partie, donc peu de recoins où un dernier bot se réfugie                                             | Les culs-de-sac, qui font traîner la fin                 |

Trois des cinq modes profiteraient d'une carte **plus structurée que les nôtres**, et deux la redoutent. Ce n'est pas une contradiction: c'est un argument pour que les cartes ne soient pas interchangeables, et pour que le choix de carte fasse partie du choix de partie.

### 3.7 Ce qui s'adapte tout seul, et ce qui ne s'adapte pas

Utile avant de choisir une taille.

**S'adapte à la taille de la carte**: le rayon des zones spéciales (racine de la surface sur cinq, soit 437 pixels sur Tokyo et 618 sur Spirit & Time); les apparitions; la mémoire des murs; le cadrage minimum quand la carte est plus petite que l'écran; les points d'une proie en Chasse, qui comptent une distance parcourue.

**Ne s'adapte pas**: le plafond de faux ninjas, à choisir carte par carte; la hauteur de vue, fixe, donc la part visible baisse quand la carte grandit; la cadence d'apparition des bonus et des malus, donc leur densité baisse aussi; la bande de bord et la distance de sécurité, fixes à 100 pixels, ce qui est sans effet sauf sur une très petite carte; la capacité en joueurs, qui est une propriété du mode.

## 4. Les critères de jugement

Douze critères, à vérifier sur une carte proposée **avant** qu'elle soit dessinée pour de bon. Les six premiers se mesurent par `mesurer-les-cartes.mjs`; les six suivants se regardent.

| #   | Critère                                   | Seuil proposé                                     | Pourquoi                                                                                     |
| --- | ----------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1   | Un seul morceau d'un seul tenant          | 100 % du jouable dans le morceau principal        | Une poche isolée enferme un joueur pour toute la partie                                      |
| 2   | Part jouable                              | 45 % au moins de la surface                       | En dessous, la carte annoncée n'est pas la carte jouée, et les apparitions peinent           |
| 3   | Jouable hors bande de bord                | 70 % au moins du jouable                          | C'est là que toutes les apparitions se tirent                                                |
| 4   | Dixième le plus serré des passages        | 20 px de dégagement au moins, soit 40 px de large | En dessous, un ninja reste coincé sur un décor qui semble praticable                         |
| 5   | Surface jouable par entité, partie pleine | 5 000 px² au moins                                | En dessous, la distance de sécurité des apparitions devient inatteignable                    |
| 6   | Traversée complète                        | 12 à 30 s à 150 px/s                              | En dessous la carte est un couloir, au-delà les temps morts s'allongent                      |
| 7   | Détour médian                             | à choisir, voir section 7                         | C'est la mesure de la structure. 1,0 est un champ, 1,5 un dédale                             |
| 8   | Superposition du décor et de la collision | exacte, au pixel                                  | Rien ne la vérifie, et l'erreur est invisible à la lecture                                   |
| 9   | Proportions de l'image et de la carte     | identiques                                        | Sinon le décor est étiré, comme Tokyo l'est depuis deux ans                                  |
| 10  | Lisibilité du mur dans le décor           | un joueur doit voir où il ne peut pas aller       | Un mur invisible se vit comme un bug                                                         |
| 11  | Avant-plan justifié                       | il cache, il ne gêne pas                          | Ce qui passe au-dessus du joueur peut le perdre; le repère de l'étape 7.8 est fait pour cela |
| 12  | Vignette parlante à 120 px                | la structure doit se reconnaître                  | C'est ce que le joueur voit dans les réglages de partie                                      |

Les seuils 2, 4, 5, 6 et 7 sont des propositions de cette étude, pas des décisions. Les critères 1, 3, 8 et 9 sont des interdits techniques: une carte qui les rate est cassée, pas discutable.

## 5. Trois archétypes, et une variante

Décrits en mots et en chiffres, pas en images: dessiner est le métier du graphiste. Chaque archétype est donné avec ce que la mesure devrait rendre s'il était bien exécuté.

### 5.1 Le quartier

**Taille visée: 2000 x 1500, comme Tokyo.** Part jouable 60 à 70 pour cent, détour médian 1,20 à 1,35, passages de 100 à 200 pixels de large entre des blocs pleins, deux ou trois places dégagées, une ou deux artères traversantes. Plafond de faux ninjas: environ 250, pour garder la densité de Tokyo sur un jouable plus petit.

C'est Tokyo avec de vrais pâtés de maisons au lieu de mobilier. Le pari: les blocs donnent des angles morts, donc des embuscades et des fuites, sans jamais enfermer. À taille égale, le joueur voit toujours la moitié de la carte, mais **ne voit plus la moitié de ce qui s'y passe**: c'est la façon la moins chère d'ajouter de la profondeur, parce que rien dans le socle ne bouge.

Sert: le Tactique et la Chasse en premier, les Équipes ensuite. Dessert: un peu la Horde, dont les enchaînements de capture aiment l'espace dégagé.

### 5.2 L'arène

**Taille visée: 1400 x 1050, la moitié de Tokyo.** Part jouable 80 pour cent, détour médian 1,10, un centre ouvert, quatre entrées, de la couverture éparse. Traversée d'environ 12 secondes. Plafond de faux ninjas: environ 120.

Une carte pour parties courtes et petits effectifs, où l'on ne cherche jamais personne. Attention au critère 5: à 1,18 Mpx de jouable et 130 entités, on est à 9 000 pixels carrés par entité, ce qui tient, mais une partie à douze joueurs y serait à l'étroit. C'est une carte à six ou huit.

Sert: le Massacre, qui veut une carte qui se vide, et les Équipes. Dessert: la Chasse, sans cachette.

### 5.3 Le dédale

**Taille visée: 2400 x 1800.** Part jouable 45 à 55 pour cent, détour médian 1,45 à 1,70, des passages de 60 à 120 pixels, des boucles nombreuses et **aucun cul-de-sac**. Plafond de faux ninjas: environ 250.

C'est l'archétype qui change le plus le jeu, et le plus risqué. Trois raisons d'y aller doucement: la vitesse commune fait qu'une poursuite dans un couloir ne se conclut jamais; un faux ninja errant se coince plus souvent dans les recoins, ce qui use le dégagement automatique des bots; et le Massacre y traînerait en fin de partie. Il demanderait sans doute de repenser la minimap avant, pas après.

Sert: la Chasse, le Tactique. Dessert: le Massacre, la Horde.

### 5.4 Le grand terrain

**Taille visée: 4000 x 3000, quatre fois Tokyo.** C'est la variante « plus grand » plutôt qu'« autrement structuré », et elle est ici pour savoir ce qu'elle coûterait. Part jouable 70 pour cent, détour médian 1,15, traversée d'environ 35 secondes. Plafond de faux ninjas: 800 environ, à la densité de Spirit & Time.

12 Mpx et 800 entités: d'après les mesures de la section 6, **le socle tient**, à condition d'accepter une partie par cœur beaucoup plus chère. Mais le joueur ne verrait plus que 12 pour cent de la carte d'un écran, et le décor pèserait quatre fois celui de Tokyo. C'est la première taille à laquelle les questions d'interface (minimap, repérage) et de contenu (le prix du décor) deviennent plus lourdes que les questions techniques.

### 5.5 Les quatre en un coup d'œil

| Archétype     |      Taille | Jouable |    Détour | Faux ninjas | Traversée | Ce qu'il demande au socle     |
| ------------- | ----------: | ------: | --------: | ----------: | --------: | ----------------------------- |
| Quartier      | 2000 x 1500 | 60-70 % | 1,20-1,35 |        ~250 |     ~18 s | Rien                          |
| Arène         | 1400 x 1050 |    80 % |      1,10 |        ~120 |     ~12 s | Rien                          |
| Dédale        | 2400 x 1800 | 45-55 % | 1,45-1,70 |        ~250 |     ~28 s | Une minimap repensée          |
| Grand terrain | 4000 x 3000 |    70 % |      1,15 |        ~800 |     ~35 s | Une minimap, et un décor cher |

## 6. Ce que le socle tient aujourd'hui

Repris des mesures de `charge-serveur.md`, section 17, et de l'étape 5.7.

- **Le calcul ne dépend pas de la taille de la carte, il dépend du nombre d'entités.** À nombre égal de faux ninjas, Tokyo et Spirit & Time se mesurent à quelques centièmes de milliseconde près (0,418 contre 0,405 ms à 150 bots), alors que la seconde a deux fois la surface de la première et cinq fois moins de murs. **Les murs ne coûtent rien**: ils se lisent en un bit.
- **Le coût monte plus vite que le nombre d'entités**, parce que le relevé des contacts examine chaque paire: 1,02 ms par battement à 300 faux ninjas, 2,31 ms à 500, pour un budget de 50 ms. Le banc mesure 34 parties par cœur à 300, 15 à 500.
- **Extrapolé à 1 000 entités: environ 8 ms par battement**, soit six parties par cœur, et environ 2,5 Ko par message, 0,4 Mbit/s par joueur. C'est encore tenable sans changer quoi que ce soit.
- **La mémoire des murs est négligeable** à ces tailles: 12 Mpx font 1,5 Mo, décodés une fois et partagés.
- **Côté page, la limite est le nombre de sprites, pas la carte**: 4,3 à 5,3 ms par image à 500 entités sur un téléphone d'entrée de gamme simulé, après l'allègement de l'étape 5.7. Une carte plus grande y ajoute une texture de décor plus lourde: 12 Mpx font environ 48 Mo de mémoire graphique par couche, deux couches, ce qui passe sur un ordinateur et commence à gêner sur un téléphone.

**Conclusion: environ 12 millions de pixels et 1 000 faux ninjas sans rien changer**, soit le grand terrain de la section 5.4. Au-delà, ce sont les quatre plafonds de `etude-grandes-cartes.md` qui reprennent la main, dans l'ordre: partition spatiale du moteur, filtrage par zone d'intérêt du réseau, décor en tuiles côté page, hébergement.

## 7. Ce qu'il faut trancher d'abord

Ce qui revient au porteur du projet. L'étude ne le fait pas à sa place.

1. **Quelle question on cherche à résoudre**: manque-t-il des cartes, ou manque-t-il de la structure aux cartes qu'on a ? Les deux se commandent différemment. La mesure de la section 2 dit que le second manque est réel et chiffré; le premier est un choix de contenu.
2. **Quel détour médian on vise.** C'est la décision de conception principale, celle qui fait la différence entre un décor et un terrain de jeu. Repères: 1,07 et 1,08 aujourd'hui, 1,2 à 1,35 pour un quartier, 1,5 et plus pour un dédale.
3. **Quelle taille.** Tout ce qui tient dans 2000 x 1500 ne coûte rien au socle et ne change rien à l'interface. Au-delà de 3000 x 2000, la part visible d'un écran devient la vraie question, avant la performance.
4. **Combien de cartes, et à quel prix.** Le décor de Tokyo pèse 2,3 Mo par orientation: c'est du travail de graphiste, pas de programmeur. Une carte bien structurée mais laide se teste; une carte belle et sans structure se jette.
5. **Si le miroir reste obligatoire.** Il double la commande. Le jeu sait déjà se passer d'un fichier absent pour la pluie: la même souplesse pour le miroir est possible, et éviterait de payer deux fois chaque carte.

### 7.1 Les réponses du porteur du projet, 20 septembre 2026

Données le jour de l'étude. Elles sont la décision, et l'étude ci-dessus reste telle quelle: c'est le raisonnement qui y a mené.

| #   | Question                         | Réponse                                                                                  |
| --- | -------------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | Cartes, ou structure ?           | **Les deux, structure d'abord.** Une carte structurée éprouvée en jeu avant tout contenu |
| 2   | Quel détour médian ?             | **1,20 à 1,35**, l'archétype du quartier                                                 |
| 3   | Quelle taille ?                  | **2400 x 1800**                                                                          |
| 4   | Combien de cartes, à quel prix ? | **Pas de graphiste pour l'instant.** On avance en noir et blanc                          |
| 5   | Le miroir reste-t-il ?           | **Le jeu le calcule.** Une carte ne se commande plus qu'une fois                         |

Deux questions posées en plus, et leurs réponses: **une carte de travail d'abord**, une collision au trait sans décor, jugée par les douze critères de la section 4 puis jouée; et **le repérage se juge à la recette**, la minimap ne se repense que si l'on se perd vraiment.

Trois conséquences à tirer, qu'aucune section ci-dessus n'a traitées parce qu'elles n'existaient pas avant ces réponses.

1. **C'est un quartier plus grand que celui de la section 5.1**, qui le décrivait à 2000 sur 1500. À 2400 sur 1800, un écran d'ordinateur montre **33 pour cent** de la carte au lieu des 48 de Tokyo, et la traversée passe d'environ 18 à environ 25 secondes. C'est le point à surveiller à la recette, et c'est exactement ce que la septième réponse dit d'observer plutôt que d'anticiper.
2. **Le plafond de PNJ est à recalculer**: 4,32 Mpx de surface, 60 à 70 pour cent de jouable, soit 2,6 à 3,0 Mpx. À la densité de Tokyo, cela fait **340 à 400 PNJ**, à confirmer par la mesure et non à fixer au jugé, comme le veut le critère 5.
3. **Le miroir calculé est une étape de code à part entière**, et elle touche les deux côtés: le serveur retourne la collision, la page retourne le décor. Elle ne dépend pas de la carte de travail et peut se faire avant, après, ou jamais si la carte de travail est abandonnée.

## 8. Ce que deviendraient les étapes suivantes

Les réponses de la section 7.1 tranchent: c'est la première des trois suites qui est retenue, et elle devient l'étape `8.2`.

- **Retenu, étape `8.2`, la carte de travail**: une collision au trait, sans décor, qui dessine un quartier de 2400 sur 1800 à 1,20 de détour, jugée par les douze critères de la section 4 avant qu'on y joue, puis jouée à plusieurs. Un `collision.png` en noir et blanc se produit sans graphiste.
- **Retenu, étape `8.3`, le miroir calculé**: le serveur retourne la collision, la page retourne le décor, et une carte ne se livre plus qu'une fois. Indépendante de `8.2`.
- **Écarté pour l'instant**: l'étape de mesure numéro 1 de `etude-grandes-cartes.md`, le banc à 1 000 et 2 000 PNJ. La taille retenue, 4,3 Mpx, tient largement dans ce que la section 6 donne pour acquis.
- **Reporté à plus tard, et seulement si la carte de travail convainc**: la fiche de commande d'une page pour le graphiste, tirée des sections 1 et 4, avec le piège de l'étirement en tête.

## 9. La carte de travail, mesurée (étape 8.2, 20 septembre 2026)

Le Quartier est la première carte dessinée pour ce jeu-ci, et la première à avoir une structure. Elle est en noir et blanc, sans graphiste, et elle se refait d'une commande:

```bash
node docs/mesures/dessiner-le-quartier.mjs
node docs/mesures/mesurer-les-cartes.mjs quartier
```

Sa géométrie vit dans le programme et non dans l'image: quatre colonnes et trois lignes d'îlots, séparées par des rues de 120 pixels et par deux artères qui traversent la carte de part en part. Sept îlots sur huit sont des **îlots à cour**, c'est-à-dire une ceinture de bâtiments de 65 pixels d'épaisseur autour d'une cour ouverte par une seule porte. Aucune rue ne longe le bord de la carte: les îlots y touchent.

### 9.1 Les chiffres, à côté des deux autres

| Mesure                                         |            Tokyo |    Spirit & Time |         **Quartier** |
| ---------------------------------------------- | ---------------: | ---------------: | -------------------: |
| Dimensions                                     |      2000 x 1500 |      3000 x 2000 |      **2400 x 1800** |
| Surface                                        |          3,0 Mpx |          6,0 Mpx |          **4,3 Mpx** |
| Part de sol (hors murs)                        |           88,9 % |           97,5 % |           **69,8 %** |
| Part où un ninja tient réellement              |           75,3 % |           94,4 % |           **59,6 %** |
| Morceaux séparés, et part du plus grand        |    1, soit 100 % |    1, soit 100 % |    **1, soit 100 %** |
| Part du jouable hors bande de bord             |           82,7 % |           85,7 % |           **93,1 %** |
| Dégagement médian (demi-largeur d'un passage)  |            64 px |           258 px |            **60 px** |
| Dégagement, dixième le plus serré              |            24 px |            63 px |            **24 px** |
| Traversée, du point le plus loin à l'opposé    | 2 699 px, 18,0 s | 3 778 px, 25,2 s | **3 195 px, 21,3 s** |
| Parcours typique entre deux apparitions        |    956 px, 6,4 s | 1 506 px, 10,0 s |  **1 462 px, 9,7 s** |
| **Détour médian** (chemin réel / vol d'oiseau) |             1,08 |             1,07 |             **1,24** |

**Le chiffre qui compte est le dernier.** Aller d'un point à un autre coûte 24 pour cent de plus qu'en ligne droite, contre 7 et 8 sur les deux cartes héritées. C'est le premier terrain du jeu où le chemin se choisit.

### 9.2 Les douze critères, un par un

| #   | Critère                                   | Seuil                    | Quartier             | Tenu       |
| --- | ----------------------------------------- | ------------------------ | -------------------- | ---------- |
| 1   | Un seul morceau d'un seul tenant          | 100 %                    | 100 %                | oui        |
| 2   | Part jouable                              | 45 % au moins            | 59,6 %               | oui        |
| 3   | Jouable hors bande de bord                | 70 % au moins            | 93,1 %               | oui        |
| 4   | Dixième le plus serré des passages        | 20 px au moins           | 24 px                | oui        |
| 5   | Surface jouable par entité, partie pleine | 5 000 px² au moins       | 7 315 px²            | oui        |
| 6   | Traversée complète                        | 12 à 30 s                | 21,3 s               | oui        |
| 7   | Détour médian                             | 1,20 à 1,35 (décidé)     | 1,24                 | oui        |
| 8   | Superposition du décor et de la collision | exacte                   | même programme       | oui        |
| 9   | Proportions de l'image et de la carte     | identiques               | dessinée à 2400x1800 | oui        |
| 10  | Lisibilité du mur dans le décor           | visible                  | liseré cyan de 3 px  | oui        |
| 11  | Avant-plan justifié                       | il cache sans gêner      | transparent          | sans objet |
| 12  | Vignette parlante à 120 px                | structure reconnaissable | les îlots se lisent  | oui        |

Les critères 8 et 9 sont tenus **par construction** et non par vérification: le même programme écrit les murs et le décor, dans la même passe et aux mêmes dimensions. C'est le principal avantage d'une carte calculée sur une carte dessinée, et c'est ce qu'il faudra obtenir d'un graphiste par la consigne, faute de pouvoir l'obtenir par construction.

Le critère 5 se calcule pour une partie pleine: 340 faux ninjas au plafond, plus douze joueurs, sur 2,575 millions de pixels réellement tenables.

### 9.3 Le plafond de faux ninjas: 340

Établi par la mesure, comme le veut la section 1.5, et non au jugé. Tokyo porte 300 faux ninjas sur 2,259 millions de pixels tenables, soit **133 par million de pixels tenables**. Le Quartier en offre 2,575 millions, ce qui donne 342, arrondis à 340.

Le banc de charge confirme le chiffre, murs de la carte compris:

```bash
pnpm charge --banc --carte quartier --bots-banc 150,340
```

À 340 faux ninjas et douze joueurs, un battement coûte **1,24 milliseconde** pour un budget de 50, et un cœur tient 28 parties. C'est très exactement le coût de Tokyo à 300 (1,02 ms, 34 parties). La structure ne coûte rien: les murs se lisent en un bit, et seul le nombre d'entités compte.

### 9.4 Ce que la mise au point a appris

Cinq essais mesurés, et trois enseignements qui serviront à la carte suivante.

1. **Un boulevard périphérique dessert une carte deux fois.** Il offre un contournement gratuit de toute la structure, et il remplit de sol la bande de cent pixels où se tirent les apparitions: 68 pour cent du jouable hors bande au premier essai, contre 70 exigés par le critère 3. Îlots au ras du bord, et le même plan passe à 93 pour cent.
2. **Une cour traversante n'est pas une cour, c'est une rue.** Percer une deuxième porte en face de la première fait tomber le détour de 1,24 à 1,10. Une cour à une seule porte est une cachette, et c'est ce qu'on voulait; à deux portes, c'est un raccourci, et le jeu retrouve son terrain ouvert.
3. **Un grand vide au centre coûte autant qu'une rue de plus.** Une cellule entière laissée vide au croisement des artères fait tomber le détour de 1,24 à 1,15, parce qu'un vide central est un raccourci pour presque tous les trajets. Le croisement des deux artères se contente donc d'une teinte de sol: le repère est là, la structure est intacte.

Deux pièges découverts en chemin, tous deux invisibles à l'œil sur l'image.

- **Une porte de cour qui donne sur le bord de la carte ne s'ouvre sur rien.** Le dehors est un mur pour le moteur: la cour devient un morceau isolé, et un joueur qui y apparaîtrait y passerait la partie entière. Le programme refuse maintenant de dessiner une telle porte.
- **Une place taillée dans l'angle d'un îlot entame sa ceinture**, et peut laisser un point où un ninja tient sans pouvoir en sortir. Un seul point sur 161 000 était concerné, et il aurait suffi à y coincer un faux ninja pour toute une partie. Un test de `packages/server` parcourt maintenant la carte entière et vérifie qu'on atteint tout depuis n'importe quel point.

### 9.5 Ce que cette carte ne dit pas encore

Elle est mesurée, elle n'est pas jugée. **Aucune mesure ne dit qu'une carte est bonne**, et trois questions attendent d'être jouées à plusieurs.

- **Les faux ninjas dans les passages étroits.** Leur dégagement automatique n'a connu que des terrains ouverts. Sept cours à une seule porte sont exactement ce qui peut le mettre en défaut.
- **Le Massacre et les culs-de-sac.** Sept cours à une porte font sept refuges. Le mode veut une carte qui se vide: c'est celui qui risque le plus de traîner ici.
- **Le repérage.** Un écran d'ordinateur montre 33 pour cent de cette carte contre 48 de Tokyo, et les îlots se ressemblent. Le porteur du projet a tranché le 20 septembre 2026: la minimap ne se repense que si l'on se perd vraiment.

## Ce qui n'est pas mesuré ici

- **Le plaisir de jeu.** Aucune de ces mesures ne dit qu'une carte est bonne. Elles disent qu'elle n'est pas cassée, et elles donnent un vocabulaire pour en parler.
- **La visibilité réelle**, qui dépend de la hauteur des décors et de l'avant-plan, pas seulement des murs. Le moteur ne connaît pas de ligne de vue: tout ce qui est à l'écran se voit, même derrière un mur.
- **Le comportement des faux ninjas dans les passages étroits.** Leur dégagement automatique n'a jamais été éprouvé sur une carte à couloirs: c'est un point à surveiller au premier prototype.
- **Les cartes à plusieurs étages ou à téléporteurs.** Rien dans le socle ne les porte, et rien ne les interdit non plus; ce serait une étape de moteur, pas de contenu.
