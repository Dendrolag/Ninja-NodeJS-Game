# Fiche de commande d'une carte - à remettre au graphiste

Page à remplir puis à transmettre. Elle est écrite pour quelqu'un qui dessine, pas pour quelqu'un qui programme: tout ce qu'il faut savoir est ici, rien d'autre n'est nécessaire.

À remplir avant l'envoi: le nom de la carte, ses dimensions, et la structure visée.

---

## Le jeu, en trois phrases

Neon Ninja est un jeu multijoueur vu de dessus, dans une ville de néon la nuit. Les joueurs y courent après des centaines de faux ninjas pour les rallier à leur couleur, et se capturent les uns les autres. On voit la carte de haut, à plat: pas de perspective, pas de hauteur, pas d'étage.

## Ce qu'il y a à livrer

Trois images, toutes aux **mêmes dimensions**, parfaitement superposables.

| Image            | Ce que c'est                                                                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `background.png` | Le décor. Ce que le joueur voit sous son personnage: sol, routes, bâtiments vus de dessus                                                |
| `foreground.png` | L'avant-plan. Ce qui passe **au-dessus** du personnage et le cache: toits, câbles, passerelles, feuillages. Transparent partout ailleurs |
| `collision.png`  | Les murs, en noir et blanc. Voir ci-dessous, c'est la plus importante                                                                    |

Plus une vignette `preview.png` de **120 sur 120 pixels**, qui montre la carte en petit dans les menus.

**Le miroir.** Le jeu propose chaque carte aussi en version retournée horizontalement. Aujourd'hui elle se livre en images, dans un second dossier: cela double la commande. Le porteur du projet a décidé le 20 septembre 2026 que le jeu la calculerait lui-même (étape 8.3). **Tant que cette étape n'est pas faite, le miroir reste à livrer**: quatre images de plus, simple retournement horizontal, en retouchant à la main ce qui se lirait à l'envers. Vérifier où en est l'étape 8.3 avant d'envoyer cette fiche.

## L'image de collision: la règle à ne pas rater

C'est l'image qui décide où le joueur peut marcher. Le jeu la lit ainsi:

> **Noir, c'est un mur. Blanc, c'est du sol.** Le basculement se fait à mi-chemin, au gris moyen.

Trois règles qui en découlent, et qui comptent plus que tout le reste.

1. **Pas d'adoucissement des bords.** Un contour flouté crée une bande de gris, dont la moitié devient du mur: le mur réel serait plus épais que dessiné. Tracer net, sans anticrénelage.
2. **Aucun détail parasite.** Un trait d'un seul pixel est un mur infranchissable. Pas de texture, pas de grain, pas d'ombre portée dans cette image: uniquement les formes pleines des obstacles.
3. **Elle doit se superposer au décor au pixel près.** Un mur décalé donne un joueur qui bute sur du vide. Rien ne le détecte automatiquement.

## Les dimensions

**Dessiner l'image exactement à la taille de la carte**, ou à défaut aux mêmes proportions. Le jeu étire l'image jusqu'aux dimensions de la carte sans conserver les proportions: une image aux mauvaises proportions sera déformée.

- Carte commandée: `_______ x _______` pixels.

## Les tailles à respecter dans le dessin

Tout est en pixels de la carte.

| Quoi                            | Taille            |
| ------------------------------- | ----------------- |
| Un personnage                   | 32 px de diamètre |
| Passage minimum pour passer     | 40 px             |
| Passage pour se croiser à deux  | 64 px             |
| Une rue confortable             | 100 à 200 px      |
| Ce qu'un joueur voit d'un écran | 1600 x 900 px     |

Un personnage traverse 150 pixels par seconde. Un écran d'ordinateur montre 1600 sur 900 pixels de carte: c'est la bonne unité pour juger si un espace est grand ou petit.

## La structure visée

À remplir selon la commande. Le point important est le **détour**: de combien un trajet réel est plus long qu'une ligne droite.

- Structure demandée: `_____________________` (par exemple: un quartier à pâtés de maisons)
- Détour visé: `______` (1,1 = presque ouvert; 1,25 = un quartier; 1,5 = un dédale)
- Part de la carte praticable: `______ %` (viser 45 pour cent au minimum)

## Les cinq interdits

Une carte qui tombe dans l'un de ces cas est inutilisable, et devra être redessinée.

1. **Un espace fermé, coupé du reste.** Un joueur peut apparaître n'importe où: s'il apparaît dans une cour sans issue, il y reste toute la partie. Tout doit communiquer.
2. **Un cul-de-sac profond.** Un joueur acculé au fond est capturé d'avance, et un faux ninja qui s'y réfugie fait traîner la fin de partie. Préférer les boucles.
3. **Une bande de 100 pixels le long des bords qui serait le seul espace praticable.** Aucun personnage n'apparaît dans cette bande.
4. **Des passages de moins de 40 pixels.** Personne n'y passe, et cela ne se voit pas à l'œil sur le décor.
5. **Un mur invisible dans le décor.** Si le décor ne montre pas qu'on ne peut pas passer là, le joueur croit à un défaut du jeu.

## Ce qu'on n'attend pas

- Aucune perspective, aucune hauteur, aucun étage: le jeu est plat.
- Aucun texte lisible ni enseigne écrite si possible. Le jeu retourne la carte en miroir, et un texte se lirait à l'envers.
- Aucun point de départ ni zone de départ à marquer: les apparitions sont tirées au sort partout.
- Aucun objet, bonus ou personnage dessiné: le jeu les pose lui-même.

## Comment la carte sera jugée

Une fois livrée, la carte passe une vérification automatique qui mesure sa surface praticable, la largeur de ses passages, le temps pour la traverser, le détour de ses trajets, et qu'elle est bien d'un seul tenant. Les résultats sont renvoyés au graphiste avec, s'il y a lieu, la liste précise des endroits à corriger.
