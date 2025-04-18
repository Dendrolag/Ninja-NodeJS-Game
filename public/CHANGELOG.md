# Changelog
Tous les changements notables de ce projet seront documentés dans ce fichier.

## [0.8.6] - 2024-12-24
### Correction
- Ajout contrôles sur tablette

## [0.8.5] - 2024-12-21
### Correction
- Fix spawn bonus/malus dans les zones de collisions

## [0.8.4] - 2024-12-19
### Améliorations
- Ajout fond full screen pour la modale de sélection de map
- Animation glowing écran titre
- Ajustements responsives (marges, boutons)
### Ajout
- Ajout de la map3 test (Room Of Spirit and Time) grande taille
### Modifications
- Passage du nombre de bots par défaut de 30 à 50

## [0.8.3] - 2024-12-18
### Améliorations
- Amélioration de la modale de sélection de map
- Ajout de la map2 (Tokyo sans pluie)

## [0.8.2] - 2024-12-18
### Correction
- Fix bug mode miroir

## [0.8.1] - 2024-12-17
### Améliorations
- Nouveau bouton send du chat
- Fix modale Pause

## [0.8.0] - 2024-12-17
### Améliorations
- Nouvelle interface de la salle d'attente

## [0.7.16] - 2024-12-13
### Corrections
- Fix de l'alignement du calque de pluie map1
- Nouveaux assets map1 mirror
### Modifications
- Amélioration du feedback du score (modification de l'affichage du classement, floating point se déplacent vers le classement)

## [0.7.15] - 2024-12-12
### Ajout
- Ajout de la pluie map1
### Modifications
- Upgrade des assets map1

## [0.7.14] - 2024-12-11
### Corrections
- Fix d'un bug de normalisation de la vitesse
### Ajout
- Décompte de lancement de partie en plein écran
### Modifications
- Démarrage de la refonte UX/UI avec changement des arrondis des éléments

## [0.7.13] - 2024-12-10
### Corrections
- Fix de la vitesse des joueurs sur mobile
### Ajout
- Ajout du son de capture de joueur par un blackbot

## [0.7.12] - 2024-12-10
### Corrections
- Fix du bug du bonus d'invicibilité non actif après le premier timer si bonus cumulé plusieurs fois
- Fix du bug des sons de capture des bots des joueurs capturés qui ne devaient pas être joués
- Fix de la vitesse des joueurs inconsistante 

## [0.7.11] - 2024-12-08
### Ajout
- Ajout des sons de capture de joueur, joueur capturé, capture de blackbot
- Ajustement des effets de capture

## [0.7.10] - 2024-12-08
### Corrections
- Fix de l'audio mute par défaut
- Fix du problème de la map qui n'était pas en mode miroir pour les joueurs rejoignant une partie en cours
### Ajout
- Nouvelle musique de menu

## [0.7.9] - 2024-12-08
### Corrections
- Fix des effets des malus qui pouvaient être gardés sur la partie suivante
- Fix de la casse pour les claviers AZERTY

## [0.7.8] - 2024-12-08
### Corrections
- Refacto du chat pour fix le bug où il n'était pas possible parfois d'envoyer des messages

## [0.7.7] - 2024-12-08
### Corrections
- Fix du bug de score non reset sur la capture des black Ninjas
- Fix du bug du mode miroir pour les joueurs non propriétaires de la partie TBC

## [0.7.6] - 2024-12-06
### Ajouts
- Ajout d'un bouton de gestion du son accessible partout
- Ajout d'une fonction mute/unmute

## [0.7.5] - 2024-12-06
### Ajouts
- Ajout d'un sélecteur de Map dans les options de la partie
- Ajout d'un mode miroir

## [0.7.4] - 2024-12-04
### Optimisations techniques
- Séparation des constantes dans un fichier dédié 
- Optimisation du spawn des entités avec une nouvelle fonction plus performante

## [0.7.3] - 2024-11-23
### Corrections
- Joystick mobile de nouveau fonctionnel
- Son de capture des bots fonctionnel
- Optimisation des effets visuels de capture
- Pause et resume de la musique
- Ajustement des sons
- Remplacement des musiques de Katana Zero par des sons d'ambiance

## [0.7.2] - 2024-11-22
### Ajouts
- Effet visuel +1 sur les bots capturés, +15 sur les black ninjas capturés
- Effet visuel sur les changements de couleurs des bots
- Augmentation de la vitesse générale des déplacements

## [0.7.1] - 2024-11-21
### Corrections
- Correction de l'accès aux paramètres audio pour les joueurs non propriétaires

## [0.7.0] - 2024-11-21
### Ajouts
- Ajout de l'audio 
-- Musique de menu et de partie
-- Sons de déplacement des joueurs partagés
-- Sons des effets des bonus
-- Sons des boutons et timer
-- Sons de capture des bots 

## [0.6.4] - 2024-11-19
### Ajouts
- Ajout de passages secrets sur la map 1 et effets de transparence sur les arbres

## [0.6.3] - 2024-11-19
### Ajouts
- Ajustements des collisions sur la map 1
- Modification du zoom sur mobile

## [0.6.2] - 2024-11-18
### Ajouts
- Correction du bonus de révélation

## [0.6.1] - 2024-11-18
### Ajouts
- Ajustement des collisions sur la map 1
- Modification des styles du classement en partie

## [0.6.0] - 2024-11-18
### Ajouts
- Ajout de la première Map (by Bribz)

## [0.5.1] - 2024-11-17
### Ajouts
- Ajout des onglets dans la salle d'attente pour les commandes et comment jouer

## [0.5.0] - 2024-11-15
### Ajouts
- Ajout des assets Ninja (by Bribz)
- Ajout de la première Map test (by Bribz)
- Ajout d'un timer de 30 secondes à la fin de la partie
- Ajout d'un timer de 5 secondes avant le début de la partie
- Ajout des sprites bonus/malus
- Changement wordings thème Ninja
- Nouveaux styles interface thème Ninja

## [0.4.2] - 2024-11-04
### Ajouts
- Ajout du favicon
- Ajout des Sprites Ninja (by Bribz)

## [0.4.1] - 2024-10-31
### Ajouts
- Ajout des statuts des joueurs dans la salle d'attente
- Possibilité pour un joueur de rejoindre une partie en cours
- Notification d'un joueur qui join ou leave une partie
- Suppression des zones carrés

## [0.4.0] - 2024-10-31
### Ajouts
- Système de malus avec effets visuels
- Paramètres configurables pour les malus
- Effet de clignotement pour les bonus et malus
- Système de version avec affichage dans l'interface
- Messages personnalisés pour les malus avec nom du joueur déclencheur

### Corrections
- Correction du bug d'invincibilité
- Optimisation des effets visuels
- Amélioration de la gestion des paramètres (grisage des options)

## [0.3.0] - 2024-10-29
### Ajouts
- Compatibilité mobile complète
- Interface adaptative
- Contrôles tactiles optimisés

## [0.2.0] - 2024-10-28
### Ajouts
- Système de chat en jeu
- Affichage du timer de partie
- Gestion améliorée des timers de bonus

### Corrections
- Optimisation du système de timer pour les bonus

## [0.1.1] - 2024-10-27
### Corrections
- Correction de la modale Game Over
- Correction des boutons de retour dans la modale
- Amélioration de l'affichage des éléments d'interface

## [0.1.0] - 2024-10-27
### Ajouts
- Introduction du Black Bot
- Système de salle d'attente (room)
- Système de paramètres configurable

### Modifications
- Refonte visuelle du style du jeu
- Optimisation du système de room
- Amélioration de l'interface des paramètres

## [0.0.2] - 2024-10-25
### Modifications
- Configuration du serveur pour utiliser process.env.PORT
- Amélioration du système de déploiement

## [0.0.1] - 2024-10-25
### Ajouts
- Version initiale alpha du jeu
- Mécanique de base de capture de points
- Interface utilisateur basique
- Configuration initiale du serveur