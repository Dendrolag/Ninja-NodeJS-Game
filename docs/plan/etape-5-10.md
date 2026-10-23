# Fiche étape 5.10 - La mesure en grand

Brief de session. Objectif unique: **mesurer ce que coûterait au jeu actuel une carte de 10 000 sur 10 000 pixels peuplée de 1 000 à 10 000 PNJ et de 12 à 60 joueurs**, sur la machine Oracle, et dire pour chaque plafond ce qui le lève et jusqu'où. Rien ne change pour les joueurs: c'est une étape de mesure, qui fixe les cibles chiffrées des étapes suivantes de la Battle Royale.

## Origine de cette fiche

Décision du porteur du projet du 23 octobre 2026: la Battle Royale se joue sur une carte de **10 000 sur 10 000 au minimum**, servie par la machine Oracle, en production depuis l'étape 5.13. L'étude du 3 octobre (`docs/design/etude-combat-survie-et-carte-geante.md`, section 12, voie B) place cette mesure en tête du socle de la carte géante, juste après l'hébergement: elle ne demande ni contenu ni règle de jeu, et ses chiffres décident de la taille des étapes qui suivent (`5.11` la grille du moteur, `8.13` les données de carte livrées, `4.10` la carte en tuiles, `2.10` le filtrage par zone d'intérêt).

Rédigée selon le cas de repli du PROTOCOLE, à partir de l'étude, de `docs/mesures/etude-grandes-cartes.md`, de `docs/mesures/charge-serveur.md` (sections 17 et 26) et de l'état du dépôt au commit `b9f8e66`.

## Ce qu'on sait en entrant

- **Le budget d'un battement est de 50 ms**, vingt battements par seconde, et une partie bat sur un seul fil: toutes les parties d'un processus se partagent un cœur. La machine Oracle a 4 cœurs Arm et 24 Go; **un de ses cœurs vaut 0,6 cœur du poste de mesure** (section 26).
- **Le moteur coûte plus que proportionnellement au nombre d'entités.** Sur le poste, en Horde à douze joueurs: 0,31 ms à 150 PNJ, 0,86 à 300, 2,05 à 500 (section 17.3). Le relevé des contacts examine chaque paire, écartée tôt si elle est loin sur un axe (`packages/sim/src/contacts.ts`), mais le nombre de paires croît au carré.
- **Les extrapolations de l'étude, à vérifier.** À la densité de Tokyo, 10 000 sur 10 000 demanderait environ 9 000 PNJ. Au carré, 650 ms par battement sur le poste, plus d'une seconde sur un cœur Oracle. **Même devenu proportionnel, le moteur à 9 000 PNJ coûterait de l'ordre de 37 ms sur le poste et 63 sur un cœur Oracle**, au-delà du budget: la grille ne suffirait peut-être pas seule, et le nombre de PNJ d'une Battle Royale pourrait devoir baisser, ou l'intelligence des PNJ lointains s'alléger. C'est la première question à laquelle la mesure répond.
- **La taille d'une carte est une constante fermée.** `CARTES` (`packages/shared/src/constantes.ts`) donne les dimensions des six cartes, et `creerEtatInitial` (`packages/sim/src/etat.ts`) refuse un terrain qui ne mesure pas celles de sa carte (garde du défaut X5 de l'audit). Le banc (`tests/charge/battement.ts`) ne joue que ces cartes (`--carte`), toujours à douze joueurs.
- **Le démarrage d'une carte géante coûte cher en mémoire.** Pour chaque carte, le serveur décode `collision.png` en rouge, vert, bleu et opacité (`packages/server/src/terrain.ts`, pngjs), soit 400 Mo pour 100 millions de pixels, plus une copie, puis calcule les places tenables et le morceau principal (`pointsTenables` et `calculerMorceauPrincipal`, `packages/sim/src/collisions.ts`), à un octet par pixel sur plusieurs tableaux et une file de quatre octets par pixel. L'étude l'estime à 200 à 600 Mo pour ce seul calcul. Au total, de l'ordre de 1,5 Go de pointe et autant pour le miroir s'il se calcule. La machine Oracle le tient, mais personne ne sait combien de temps cela prend, ni si la mise en ligne, qui attend trois minutes la réponse de `/sante`, le supporte.
- **Le flux n'a pas de borne dure**: les nombres s'écrivent sur autant d'octets qu'il en faut (`packages/shared/src/flux.ts`), une position de 10 000 pixels au huitième de pixel tient sur trois. Mais chaque joueur reçoit toutes les entités: 1 241 octets par message à 500 entités (section 17.3), soit de l'ordre de 12 Ko et 2 Mbit/s par joueur à 5 000, trop pour un téléphone en réseau mobile. Le flux par destinataire de l'étape 2.9 (`packages/server/src/vues.ts`) est le socle du filtrage, qui reste à construire (`2.10`).
- **La machine Oracle est la production.** La session n'y a pas accès par SSH (refusé par le garde-fou de Claude Code depuis l'étape 5.13): toute commande sur la machine est rédigée pour le porteur du projet, en PowerShell 5.1. Le dépôt est public: GitHub y fournit gratuitement des machines Arm (`ubuntu-24.04-arm`, à vérifier au début de l'étape), proches de la machine Oracle sans lui être identiques.
- **Le risque de récupération de la machine par Oracle** reste inconnu jusqu'à la fin de l'essai gratuit du compte, vers le 3 novembre 2026 (`docs/deploiement.md`). Il ne bloque pas la mesure, qui ne touche pas la production.
- **La machine de mesure varie** de 35 pour cent d'une heure à l'autre: tout avant-après se mesure dans la même séance, en alternant avec un témoin (Tokyo à 300 PNJ, douze joueurs), comme depuis l'étape 5.2.

## Décisions prises par cette fiche

1. **Aucune règle de jeu ne change, aucune optimisation n'est faite.** L'empreinte des parties de référence reste identique, et le numéro de version ne bouge pas. Ce que la mesure révèle devient le contenu chiffré des étapes suivantes.
2. **La carte de mesure n'est jamais jouable.** Elle sert au banc seul: aucun écran ne la propose, la validation des réglages d'un salon la refuse. Deux façons de la déclarer, à trancher au début de l'étape après lecture du code: un identifiant de carte de plus, hors des cartes proposées; ou des dimensions fournies au moteur avec le terrain, sans affaiblir la garde du défaut X5. Recommandation: la première, qui suit le chemin d'une vraie carte et sera celui de la carte géante (`8.15`).
3. **Deux terrains de 10 000 sur 10 000.** Un **terrain réaliste**, la collision de Tokyo répétée cinq fois en largeur et sept en hauteur puis coupée à 10 000 sur 10 000: la densité de murs d'une vraie carte, sans contenu à dessiner. Un **terrain sans mur**, en témoin. Les deux se fabriquent en mémoire par le banc; aucune image de 100 millions de pixels n'entre dans le dépôt. La mesure du démarrage écrit son image dans un dossier temporaire.
4. **Les populations mesurées**: 1 000, 2 000, 5 000 et 10 000 PNJ, à 12, 30 et 60 joueurs, en Horde, le mode qui s'approche le plus d'une Battle Royale par sa foule et ses Black Ninjas (un par centaine d'entités, comme en partie réelle). Une ligne en Massacre à 5 000, pour le coût du combat. Tokyo à 300 PNJ en témoin à chaque série.
5. **Le profil dit où passe le temps.** À 5 000 PNJ, un profil du processeur (`node --cpu-prof`) range le battement par fonction: relevé des contacts, choix de cible des Black Ninjas, contagion des couleurs, apparitions, intelligence des PNJ, projection et codage. Ce qui croît au carré est ce que la grille de `5.11` doit traiter; ce qui croît en proportion dit si la grille suffit.
6. **Le filtrage par zone d'intérêt est estimé, pas construit.** Le banc compte, pour chaque joueur et chaque battement, les entités dans un rectangle autour de lui (l'écran le plus large du jeu et une marge, à fixer au début de l'étape d'après `packages/client`), et code la trame qu'il recevrait s'il ne recevait qu'elles, avec les fonctions de `packages/shared/src/flux.ts`. Cela donne le débit par joueur et par partie avec et sans filtrage, et la cible de `2.10`.
7. **Trois machines, une seule commande.** Le poste de mesure, en alternant avec le témoin. Une machine Arm de GitHub, par le workflow de mesure (`.github/workflows/charge.yml`, branche `mesure-charge/`), étendu d'un job Arm. Et la machine Oracle, une fois, pour caler la machine Arm de GitHub sur elle par le témoin: le porteur du projet lance le banc dans un conteneur à part, borné à un cœur (`docker run --cpus 1`), à une heure sans partie en cours (`/sante` le dit), avec des commandes PowerShell 5.1 que la session rédige. La production garde ses trois autres cœurs.
8. **Le démarrage se mesure dans un vrai serveur**: la durée et la pointe de mémoire du décodage d'une carte de 10 000 sur 10 000, de ses places tenables, de son morceau principal et de son miroir, comparées au délai de trois minutes de la mise en ligne et à la mémoire de la machine.

## Questions au porteur du projet

À poser au début de l'étape. La mesure peut commencer sans les réponses, qui changent seulement les lignes du tableau.

1. **Combien de joueurs par partie de Battle Royale**, au plus ? La mesure prévoit 12, 30 et 60; l'étude visait 30 à 60.
2. **Quelle foule de PNJ**: une ville aussi peuplée que Tokyo, environ 9 000 PNJ, ou une carte plus clairsemée, où les PNJ sont surtout du gibier ? La mesure dira ce que chaque choix coûte.
3. **D'accord pour lancer une fois le banc sur la machine de production**, dans un conteneur borné à un cœur, à une heure sans joueur, avec les commandes fournies ?

## Périmètre

- `tests/charge/`: la carte de mesure et ses deux terrains, une option du nombre de joueurs, la mesure du démarrage, l'estimation du filtrage, le profil, et leurs tests.
- La déclaration de la carte de mesure (décision 2), là où elle doit vivre, avec ses tests de refus dans le jeu.
- `.github/workflows/charge.yml`: le job Arm.
- Les commandes du porteur du projet pour la machine Oracle, dans le handoff.
- Les résultats: une section 37 de `docs/mesures/charge-serveur.md`, les bruts dans `docs/mesures/5-10/`, le verdict par plafond, et la mise à jour des étapes suivantes au ROADMAP si les chiffres changent leur contenu ou leur ordre.
- L'étude du 3 octobre et `docs/mesures/etude-grandes-cartes.md`: leurs extrapolations remplacées par les mesures.

## Hors périmètre

- Toute optimisation: la grille du moteur (`5.11`), les données de carte livrées (`8.13`), le filtrage (`2.10`), un allègement de l'intelligence des PNJ lointains, plusieurs fils par processus. Si la mesure en montre le besoin, elle le chiffre et le ROADMAP le planifie.
- Le rendu d'une carte géante dans la page (`4.10`), et tout contenu de carte (`8.15`).
- Toute règle de la Battle Royale (`7.19`) et de ses pièces (`7.13` à `7.18`).
- La production: rien n'y est mis en ligne par cette étape.

## Tests requis

- TU du terrain réaliste: dimensions, répétition exacte de Tokyo, coupe au bord; et du terrain sans mur.
- TU du refus de la carte de mesure partout où le jeu choisit une carte: validation d'un salon, écran de création, partie rapide.
- TU de l'estimation du filtrage: une entité dans le rectangle comptée, une entité dehors écartée, la trame filtrée qui se décode.
- TU des nouvelles options du banc, comme les options existantes.
- Les seuils de charge existants inchangés (`tests/charge/seuils.test.ts`), l'empreinte des parties de référence identique, la suite unitaire complète, la CI verte.

## Définition de terminé

1. Le banc mesure une partie sur une carte de 10 000 sur 10 000, réaliste ou sans mur, à toute population de la décision 4, en une commande documentée dans `docs/mesures/charge-serveur.md`, section 10.
2. Le tableau du battement (moteur, projection, codage, total, centile 99, parties par cœur) est mesuré sur le poste et sur la machine Arm de GitHub, et calé sur la machine Oracle par le témoin.
3. Le profil à 5 000 PNJ dit, chiffres à l'appui, quelles parties du battement croissent au carré.
4. Le démarrage d'une carte de 10 000 sur 10 000 est mesuré, durée et pointe de mémoire.
5. Le débit par joueur et par partie est mesuré sans filtrage et estimé avec, à 30 et 60 joueurs.
6. Un verdict par plafond (moteur, démarrage, réseau, page, hébergement): valeur mesurée, budget, étape qui le lève, et la cible chiffrée de cette étape, par exemple « le moteur à N PNJ sous X ms sur un cœur Oracle » pour `5.11`.
7. Une recommandation de population pour la Battle Royale (joueurs, PNJ, Black Ninjas), soumise au porteur du projet avec les chiffres.
8. Les étapes suivantes de la voie B relues au ROADMAP à la lumière des mesures.

## Rituel de fin de session

Écrire `docs/handoffs/etape-5-10-handoff.md`, commiter, pousser, vérifier la CI. Poser au porteur du projet la recommandation de population et, si la mesure le montre, le besoin d'une étape d'optimisation de plus avant la grille ou après elle.
