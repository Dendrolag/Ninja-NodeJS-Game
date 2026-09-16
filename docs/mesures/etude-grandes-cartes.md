# Étude - Des cartes beaucoup plus grandes (16 septembre 2026)

Question du porteur du projet, après l'étape 7.3: que coûterait une carte beaucoup plus grande, avec beaucoup plus de bots, par exemple pour un mode Battle Royale ? **Aucune décision n'est prise.** Le porteur du projet n'a pas les ressources pour produire une grande carte pour l'instant; cette étude est gardée pour le jour où la question reviendra.

## Verdict

Le socle n'est pas remis en cause: le moteur pur, les jeux de règles par mode (une zone qui rétrécit tient dans `estDecidee` et `horsJeu`, ajoutés à l'étape 7.3), les rooms, le flux binaire en différentiel, le banc de charge et l'empreinte des parties. Mais quatre plafonds, sans effet aux tailles actuelles, cèdent en grand, et doivent être levés avant un tel mode.

## Les quatre plafonds

| Couche      | Aujourd'hui                                                                                                                                                                                                                          | En grand                                                                                                                                                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Moteur      | Le relevé des contacts examine chaque paire d'entités: coût quadratique. 7,8 ms par battement à 1 000 bots (section 15 de `charge-serveur.md`).                                                                                      | Extrapolation: environ 30 ms à 2 000 bots, environ 200 ms à 5 000, soit quatre fois le budget d'un battement (50 ms).                                                                                                                       |
| Réseau      | Chaque joueur reçoit toutes les entités: 2,4 Ko par message à 1 000 bots, environ 0,4 Mbit/s par joueur.                                                                                                                             | Vers 5 000 bots, de l'ordre de 2 Mbit/s par joueur, plus de 100 Mbit/s sortants pour une partie de 60 joueurs. Le filtrage par zone d'intérêt, écarté à la section 12.9 « sauf si les cartes grandissent nettement », redevient nécessaire. |
| Client      | Le décor est une texture par couche à la taille de la carte (map3: 3 000 sur 2 000, environ 24 Mo de mémoire graphique par couche). Toutes les entités sont dessinées, même hors champ; le lissage est en carré du nombre d'entités. | Une carte de 10 000 sur 10 000 ferait environ 400 Mo par couche, et dépasse la taille de texture maximale de nombreux téléphones (souvent 4 096 ou 8 192 pixels): décor en tuiles et dessin limité au champ obligatoires.                   |
| Hébergement | Offre gratuite de Render; les mesures sont faites sur un Ryzen 7 de développement.                                                                                                                                                   | Une partie de 60 à 100 joueurs sur une grande carte est à mesurer sur l'hébergement visé; probablement une offre payante.                                                                                                                   |

La carte de collision n'est pas un problème: un bit par pixel, 12,5 Mo par partie pour 10 000 sur 10 000.

## Les chantiers, dans l'ordre

1. **Mesurer**: le banc actuel à 2 000, 5 000 et 10 000 bots sur une grande carte sans mur, pour remplacer les extrapolations.
2. **Moteur**: une partition spatiale (grille) pour les contacts, la recherche de cible des bots noirs et l'apparition. Coût linéaire; l'empreinte prouve que le jeu n'a pas changé. Profite aussi aux modes actuels.
3. **Réseau**: filtrage par zone d'intérêt, avec des trames regroupées par cellule de grille pour limiter le coût d'un codage par joueur.
4. **Client**: décor en tuiles chargées à la demande, dessin limité au champ, lissage linéaire.
5. **Contenu et hébergement**: produire la grande carte (décor et collision), mesurer la capacité réelle.

Chaque chantier serait une étape du ROADMAP validée par la mesure, comme 5.2 et 2.3. Un gameplay plus riche (objets, zones) coûte peu par comparaison: ce qui compte est le nombre d'entités et de joueurs.

## Ce qu'il faudra trancher d'abord

La taille de carte visée, le nombre de joueurs par partie et le nombre de bots.
