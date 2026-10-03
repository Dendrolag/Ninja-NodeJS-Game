# Fiche étape 8.9 - La Station lunaire, de jour ou de nuit, et son vaisseau qui la survole

Brief de session. Objectif unique: une quatrième carte jouable, la Station lunaire, avec un fond de jour et un fond de nuit au choix de l'hôte, et un vaisseau qui arrive au-dessus de la carte, la survole lentement toute la partie, puis repart, avec son ombre portée en parallaxe sur le fond de jour.

## Origine de cette fiche

Aucune fiche n'existait. Demande du porteur du projet, le 3 octobre 2026: « Ajout d'une nouvelle map "Station Lunaire" avec les assets en PJ. Map de 2000 par 1524 pixels. Particularités: deux backgrounds day et night (sur cette map avoir une option pour avoir la map jour ou nuit); des collisions (iso autres maps); un layout foreground en premier plan à animer "spaceship", qui doit être mouvant (comme un vaisseau qui vient stationner au dessus de la map puis qui repart). Le sens de l'asset est: arrière du vaisseau en haut, avant du vaisseau en bas. Il doit arriver de façon aléatoire sur la map (pas le même chemin à chaque partie), survoler la map lentement pendant toute la partie. Prévoir une ombre portée du vaisseau en parallax sur le background de jour. »

Rédigée le 3 octobre 2026 selon le cas de repli du PROTOCOLE (boucle d'une étape, point 2), à partir de cette demande, de la compétence `conception-de-cartes`, de l'état du dépôt au commit `6d969a5` et du handoff 4.9.

## Ce que le porteur du projet a livré

Dans `Documents/Neon Ninja/map2 - Station lunaire/`:

| Fichier                | Taille      | Ce que c'est                                                                                |
| ---------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| `background-day.png`   | 2000 x 1524 | Le toit d'une station posée sur la Lune, un quai en contrebas, des cratères autour. De jour |
| `background-night.png` | 2000 x 1524 | Le même, de nuit: le toit sombre, le quai éclairé                                           |
| `collision.png`        | 2000 x 1524 | Les murs, en blanc sur noir, **opaque**: le toit et le quai sont du sol, la Lune est un mur |
| `spaceship.png`        | 683 x 769   | Le vaisseau vu de dessus, sur transparent. Arrière en haut, avant en bas                    |
| `License.url`          |             | Creative Commons BY-NC 4.0                                                                  |
| `Patreon.url`          |             | https://www.patreon.com/2minutetabletop, l'auteur des images: 2-Minute Tabletop             |

Ni avant-plan fixe, ni vignette.

## Diagnostic, fait au début de l'étape

1. **La collision se lit telle quelle.** Opaque partout, 256 niveaux de gris dont 0,5 pour cent seulement entre le noir et le blanc: les murs sont nets. Elle entre en niveaux de gris, mêmes pixels, 16 Ko.
2. **La collision suit le décor au pixel** (critère 8), vérifié sur une superposition: le bord du toit, le quai, les deux monte-charges rayés qui les relient, les caisses au pied du toit.
3. **Les images sont à la taille de la carte** (critère 9): 2000 sur 1524, aucun étirement.
4. **La mesure** (`mesurer-les-cartes.mjs station`): un seul morceau, 51 pour cent de sol, 47,1 pour cent tenable, 100 pour cent du jouable hors de la bande d'apparition, dixième le plus serré à 34 pixels de dégagement (68 de large), passage médian à 142, traversée en 12,2 secondes, détour médian 1,07. Les critères 1 à 6 tiennent, la traversée tout juste: c'est la plus petite carte du jeu. Comme Tokyo et Spirit & Time, un terrain ouvert.
5. **Le hasard du vaisseau doit être commun à toute la partie.** Le vaisseau passe au-dessus des joueurs et peut les cacher: deux joueurs de la même partie doivent le voir au même endroit, et un joueur qui entre en cours de partie aussi. Or rien de ce que la page reçoit ne change d'une partie à l'autre du même salon: `partieLancee` ne porte rien, et la graine du moteur ne doit pas sortir du serveur (elle permettrait de prédire le jeu). Il faut une graine de plus, propre au décor.
6. **Le temps de la partie est déjà commun**: chaque battement porte le temps restant, et le salon la durée. Le temps écoulé s'en déduit, pause comprise.

## Décisions prises par cette fiche

1. **Identifiant `station`**, nom « Station lunaire », ambiance « Lune · Jour ou nuit ». Une carte porte un nom, pas un numéro (compétence, section 8): `map2` est d'ailleurs pris par l'ancienne Tokyo. **Pas de badge « Prototype »**: le décor est celui d'un illustrateur, pas un essai. La valeur entre dans l'énumération des cartes de la base, migration à l'appui.
2. **2000 sur 1524**, images à la taille de la carte.
3. **Plafond de faux ninjas: 190.** Surface tenable de 1,44 million de pixels carrés: 190 faux ninjas redonnent la densité des trois autres cartes, 7 560 pixels carrés chacun. À confirmer au banc de charge.
4. **Le jour ou la nuit est un réglage de la partie**, `nuit`, choisi par l'hôte comme la pluie de Tokyo: tous les joueurs voient la même carte. **Le jour par défaut.** Il ne se propose que sur une carte qui a un fond de nuit, et le récapitulatif du salon dit « Nuit » quand il s'applique. Le moteur l'ignore. Le fond de nuit est une couche de plus: `cheminFondDeNuit`, qui ne rend rien pour une carte qui n'en a pas.
5. **Pas d'avant-plan fixe sur cette carte**: `cheminAvantPlan` ne rend rien pour elle, et le rendu n'en demande pas. Son seul premier plan est le vaisseau.
6. **Une graine du décor par partie**, tirée par le serveur au lancement, et transmise par `partieLancee`, aux joueurs du lancement comme à qui entre ou revient en cours de partie. Elle ne dit rien du jeu: le moteur ne la lit pas.
7. **La trajectoire du vaisseau est une fonction pure** de la graine du décor, de la carte, de la durée de la partie et du temps écoulé (`rendu/vaisseau.ts`). Elle se compose de trois temps:
   - **l'arrivée**: le vaisseau entre par un point tiré au hasard autour de la carte, hors de vue, et ralentit jusqu'au premier point de son survol, en vingt secondes (moins sur une partie courte);
   - **le survol**: il passe lentement d'un point à l'autre, tirés au hasard au-dessus de la carte, sur une courbe sans angle, à vitesse constante, environ 20 pixels par seconde, le nombre de points s'adaptant à la durée;
   - **le départ**: dans les vingt dernières secondes, il accélère et sort par un autre point du pourtour.
     Il regarde toujours là où il va: son avant, en bas de l'image, suit la tangente de sa course. En pause, il s'arrête avec le temps.
8. **Le temps écoulé se lisse comme les positions**: la vue lissée porte un temps restant interpolé entre les deux derniers battements, pour que le vaisseau glisse au lieu d'avancer par à-coups.
9. **L'altitude se voit par la parallaxe.** Le vaisseau vole plus près de la caméra que le sol: il se dessine écarté du centre de l'écran d'une part de son écart à la caméra, et grandi d'autant, comme ce qui est proche quand on regarde d'en haut. **Son ombre, elle, est au sol**, décalée par le soleil vers le bas et la droite comme celle de la station dans le décor, sans parallaxe. Quand la caméra bouge, le vaisseau et son ombre se séparent ou se rapprochent: c'est la profondeur. En miroir, le soleil change de côté avec le décor.
10. **L'ombre n'existe que de jour**, sur le fond et sous les personnages. **De nuit, le vaisseau est assombri** pour ne pas briller sur un décor éteint.
11. **Le vaisseau passe devant tout, sauf les repères**, comme un avant-plan. Pour ne jamais perdre le joueur (critère 11), il devient translucide quand il passe au-dessus de notre propre ninja. Il cache les autres: c'est une cachette qui se déplace.
12. **Taille affichée: 70 pour cent de l'image**, 478 sur 538 pixels au sol avant la parallaxe, à peu près un quart de la largeur de la station.
13. **Version 1.6.0**, et sa note: une carte nouvelle est une nouveauté majeure pour le joueur (étape 4.9). Le texte se soumet au porteur du projet.
14. **Crédits**: la licence CC BY-NC 4.0 oblige à nommer l'auteur. Une participation de plus, 2-Minute Tabletop, avec un lien vers sa page, que la licence autorise. Texte à soumettre au porteur du projet, la clause « pas d'usage commercial » à lui rappeler.

## Périmètre

### Lot A. La carte

1. Les images dans `assets/cartes/station/`: `background.png` (le jour), `background-night.png`, `collision.png`, `spaceship.png`, et une vignette de 120 sur 120 tirée du fond de jour.
2. `CARTES`, `CARTES_ENREGISTREES`, `PLAFONDS_DE_FAUX_NINJAS`, `PRESENTATION_CARTES`; migration de la base.
3. `cheminAvantPlan`, `cheminFondDeNuit`, `cheminVaisseau`, et leurs tests d'existence.
4. La mesure (`docs/mesures/cartes.json`), le banc de charge à 190 faux ninjas, les empreintes des murs.

### Lot B. Le jour et la nuit

1. `ReglagesPartie.nuit`, sa validation, le formulaire du salon (proposé sur la seule carte qui a une nuit), le récapitulatif.
2. Le rendu charge le fond de nuit à la place du fond quand la partie est de nuit.

### Lot C. Le vaisseau

1. La graine du décor: tirée au lancement, portée par `partieLancee`, retenue par la page.
2. `rendu/vaisseau.ts`: la trajectoire, la position et le cap à un instant, la place affichée avec la parallaxe, la place de l'ombre, l'opacité au-dessus de notre ninja. Tout est pur et testé.
3. Le temps restant lissé dans la vue lissée; la scène porte le vaisseau.
4. Le rendu: l'ombre au sol de jour, le vaisseau au premier plan, préchargés avec le reste du décor.

### Lot D. Version, crédits, documentation

1. `NUMERO_DE_VERSION` à 1.6.0 et la note 1.6; la participation de 2-Minute Tabletop.
2. Compétence `conception-de-cartes`, `assets/README.md`, journal de conception, ROADMAP, handoff.

## Hors périmètre

- Un vaisseau, une nuit ou une ombre pour les autres cartes.
- Une collision avec le vaisseau: il vole, il ne gêne personne.
- Toute modification de `legacy/` ou de `tests/caracterisation/`.

## Tests requis

- **Partagé (TU)**: dimensions et plafond de la station; chemins du fond de nuit, du vaisseau et de l'avant-plan, présents ou absents selon la carte, et leurs fichiers existent; le réglage `nuit` validé, par défaut le jour.
- **Serveur (TU)**: les murs de la station, normal et miroir, figés par leur empreinte; 190 faux ninjas tiennent à leur apparition; la graine du décor part avec `partieLancee`, change d'une partie à l'autre, et arrive aussi à qui entre en cours de partie.
- **Client (TU)**: la trajectoire (même graine, même chemin; autre graine, autre chemin; hors de la carte au début et à la fin, au-dessus pendant le survol; lente; continue; le cap suit la course; arrêtée sans durée), la parallaxe, l'ombre et son miroir, l'opacité; le temps restant lissé; la graine retenue à `partieLancee`; le réglage de nuit au salon.
- **Rendu (bout en bout)**: la carte de jour et de nuit dans le vrai rendu; le vaisseau bouge, son ombre de jour seulement.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. La carte se joue dans un vrai navigateur, de jour et de nuit, captures à l'appui, le vaisseau qui passe.
2. Les douze critères de la compétence tenus, mesure à l'appui.
3. La couverture de `packages/sim` ne baisse pas.

## Rituel de fin de session

Écrire `docs/handoffs/etape-8-9-handoff.md`. Commiter, pousser, vérifier la CI et la mise en ligne.
