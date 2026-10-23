# Étude - Des cartes beaucoup plus grandes (16 septembre 2026)

Question du porteur du projet, après l'étape 7.3: que coûterait une carte beaucoup plus grande, avec beaucoup plus de bots, par exemple pour un mode Battle Royale ? **Aucune décision n'est prise.** Le porteur du projet n'a pas les ressources pour produire une grande carte pour l'instant; cette étude est gardée pour le jour où la question reviendra.

**Suite, 20 septembre 2026**: l'étape 8.1 a produit `etude-structures-de-carte.md`, qui traite des cartes qu'on pourrait commander demain, aux tailles que le socle tient déjà, et qui mesure les deux cartes existantes. Les deux documents se complètent: celui-ci reste la référence sur le très grand, l'autre sur la structure et la commande d'une carte.

**Suite, 3 octobre 2026**: l'étude `docs/design/etude-combat-survie-et-carte-geante.md` reprend la question pour une carte de 10 000 sur 10 000 sur plusieurs niveaux. Elle ajoute un cinquième plafond, la mémoire du calcul des places tenables et du morceau principal au démarrage (étape 8.10), et propose une carte faite d'un jeu de tuiles réutilisables, dont la collision se dérive.

**Suite, 23 octobre 2026**: le porteur du projet décide une Battle Royale sur une carte de 10 000 sur 10 000 au moins, servie par la machine Oracle de la production (étape 5.13). Les plafonds de ce document deviennent un plan, dans le ROADMAP: la mesure en grand (`5.10`, fiche `docs/plan/etape-5-10.md`), la grille du moteur (`5.11`), les données de carte livrées (`8.13`), la carte en tuiles (`4.10`), le filtrage par zone d'intérêt (`2.10`), puis la carte géante (`8.15`) et le mode (`7.19`). L'hébergement n'est plus un plafond.

**Suite, 23 octobre 2026, étape 5.10: les extrapolations sont remplacées par la mesure** (section 37 de `charge-serveur.md`). Sur une carte de 10 000 sur 10 000, à douze joueurs, le battement coûte 44 ms à 2 000 PNJ (30 extrapolées), 259 à 5 000 (200 extrapolées) et 1 072 à 10 000, sur le poste; deux fois plus sur une machine Arm. La taille de la carte n'y change rien, seule la foule compte. Trois plafonds que ce document ne connaissait pas: le lancement d'une partie, quadratique (61 secondes à 10 000 PNJ, toutes les parties du serveur arrêtées), le classement, qui croît en joueurs fois PNJ, et ce qui reste une fois la grille faite, environ 21 ms à 5 000 PNJ sur le poste, au-delà du budget d'un cœur Arm. Le réseau est tel qu'estimé: 1,8 Mbit/s par joueur à 5 000 PNJ, 0,09 avec le filtrage par zone d'intérêt.

## Verdict

Le socle n'est pas remis en cause: le moteur pur, les jeux de règles par mode (une zone qui rétrécit tient dans `estDecidee` et `horsJeu`, ajoutés à l'étape 7.3), les rooms, le flux binaire en différentiel, le banc de charge et l'empreinte des parties. Mais quatre plafonds, sans effet aux tailles actuelles, cèdent en grand, et doivent être levés avant un tel mode.

## Les quatre plafonds

| Couche      | Aujourd'hui                                                                                                                                                                                                                          | En grand                                                                                                                                                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Moteur      | Le relevé des contacts examine chaque paire d'entités: coût quadratique. 7,8 ms par battement à 1 000 bots (section 15 de `charge-serveur.md`).                                                                                      | Mesuré à l'étape 5.10 (section 37): 44 ms à 2 000 PNJ, 259 à 5 000, 1 072 à 10 000, sur le poste, soit vingt fois le budget d'un battement (50 ms).                                                                                         |
| Réseau      | Chaque joueur reçoit toutes les entités: 2,4 Ko par message à 1 000 bots, environ 0,4 Mbit/s par joueur.                                                                                                                             | Vers 5 000 bots, de l'ordre de 2 Mbit/s par joueur, plus de 100 Mbit/s sortants pour une partie de 60 joueurs. Le filtrage par zone d'intérêt, écarté à la section 12.9 « sauf si les cartes grandissent nettement », redevient nécessaire. |
| Client      | Le décor est une texture par couche à la taille de la carte (map3: 3 000 sur 2 000, environ 24 Mo de mémoire graphique par couche). Toutes les entités sont dessinées, même hors champ; le lissage est en carré du nombre d'entités. | Une carte de 10 000 sur 10 000 ferait environ 400 Mo par couche, et dépasse la taille de texture maximale de nombreux téléphones (souvent 4 096 ou 8 192 pixels): décor en tuiles et dessin limité au champ obligatoires.                   |
| Hébergement | Offre gratuite de Render; les mesures sont faites sur un Ryzen 7 de développement.                                                                                                                                                   | Une partie de 60 à 100 joueurs sur une grande carte est à mesurer sur l'hébergement visé; probablement une offre payante.                                                                                                                   |

La carte de collision n'est pas un problème: un bit par pixel, 12,5 Mo par partie pour 10 000 sur 10 000.

## Les chantiers, dans l'ordre

1. **Mesurer**: le banc actuel à 2 000, 5 000 et 10 000 bots sur une grande carte sans mur, pour remplacer les extrapolations. Fait à l'étape 5.10, avec et sans murs (section 37 de `charge-serveur.md`).
2. **Moteur**: une partition spatiale (grille) pour les contacts, la recherche de cible des bots noirs et l'apparition. Coût linéaire; l'empreinte prouve que le jeu n'a pas changé. Profite aussi aux modes actuels.
3. **Réseau**: filtrage par zone d'intérêt, avec des trames regroupées par cellule de grille pour limiter le coût d'un codage par joueur.
4. **Client**: décor en tuiles chargées à la demande, dessin limité au champ, lissage linéaire.
5. **Contenu et hébergement**: produire la grande carte (décor et collision), mesurer la capacité réelle.

Chaque chantier serait une étape du ROADMAP validée par la mesure, comme 5.2 et 2.3. Un gameplay plus riche (objets, zones) coûte peu par comparaison: ce qui compte est le nombre d'entités et de joueurs.

## Ce qu'il faudra trancher d'abord

La taille de carte visée, le nombre de joueurs par partie et le nombre de bots.
