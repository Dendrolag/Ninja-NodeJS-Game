# Fiche étape 5.1 - Tests de charge serveur

Brief de session. Objectif unique: mesurer le comportement du serveur sous charge, pour valider les paris du multi-room et du delta binaire avant toute optimisation. On mesure d'abord, on optimise ensuite.

## Rituel de début de session

Lire CLAUDE.md, le handoff de l'étape 4.4, et les handoffs des étapes 2.1 (rooms), 2.3 (delta) et 1.5 (coût du moteur), puis cette fiche.

## Objectif

Construire un harnais de charge qui simule plusieurs rooms peuplées de plus de 100 bots, et mesurer les indicateurs qui dimensionnent le serveur: temps de calcul par tick par room, et taille des messages diffusés. Définir des seuils de référence.

## Périmètre

1. Harnais de charge: outil capable de créer N rooms, chacune peuplée de plus de 100 bots, et de simuler des clients connectés recevant le flux.
2. Mesures: le temps de tick par room sous charge, l'évolution quand N rooms tournent en parallèle, et la taille réelle des deltas diffusés par tick et par client.
3. Seuils de référence: définir, à partir des mesures, un budget par cœur (nombre de bots par room multiplié par rooms par cœur) qui tient la fréquence cible.
4. Rapport: consigner les chiffres dans un document de référence, qui servira de base de comparaison pour l'étape 5.2 et pour détecter les régressions de performance futures.

## Hors périmètre

- Aucune optimisation ici. On mesure, on ne corrige pas. Les corrections sont l'étape 5.2, conditionnées à ces mesures.
- Aucune modification de la logique de jeu.

## Tests requis

- Le harnais de charge s'exécute et produit des mesures reproductibles.
- Un rapport chiffré existe, avec temps de tick et taille de diffusion sous charge.
- Des seuils de référence sont définis.

## Définition de terminé

Conditions de ROADMAP réunies, plus:

1. Le harnais de charge fonctionne.
2. Le rapport de mesures existe et est commité.
3. Les seuils de référence sont posés.

## Rituel de fin de session

Écrire docs/handoffs/etape-5-1-handoff.md. Donner les chiffres clés et indiquer où le serveur sature en premier, car cela oriente l'étape 5.2. Prochaine action exacte pour l'étape 5.2: appliquer, seulement si la mesure le justifie, les optimisations utiles (grille spatiale, niveau de détail d'IA), validées par comparaison avant après. Commiter.
