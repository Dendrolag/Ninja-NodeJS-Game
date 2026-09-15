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

## Réconciliation pendant l'étape (11 septembre 2026)

La fiche date du plan d'origine. Écarts constatés avec le dépôt, et comment ils ont été traités.

1. **Le rituel de début cite des handoffs qui ne font pas foi ou n'existent pas.** Le handoff 2.3 n'existe pas: l'étape 2.3 n'a pas été faite, elle dépend justement de cette mesure (section 3 du ROADMAP). Le handoff 4.4 n'est plus le dernier: c'est celui de la reprise des écrans du jalon 3 qui fait foi. Lus: le dernier handoff, puis 1.5, 2.1 et 2.2.
2. **« Deltas » se lit « flux d'état ».** Le serveur diffuse l'instantané JSON complet de l'étape 2.2 à chaque battement, sans delta. Ce qui est mesuré est donc la taille réelle de ce flux, sur le fil, et c'est elle qui décide de l'étape 2.3.
3. **Les « rooms » existent à plusieurs par serveur depuis l'étape 2.4**, avec des comptes et un enregistrement en base à chaque fin de partie (3.3). La charge se joue par le vrai protocole: création d'une partie privée, entrée par code, lancement par l'hôte, compte à rebours réel. Elle tourne sans base: l'enregistrement de fin de partie n'a lieu qu'une fois par partie, hors de la boucle de battement, et n'est pas mesuré.
4. **Le serveur se monte sans murs par défaut** (`creerServeur`). Le harnais fournit ceux des cartes (`ChargeurDeTerrain`), faute de quoi il mesurerait une carte vide.
5. **Les bornes du salon limitent la charge réseau**: 150 bots au plus par partie (`BORNES_REGLAGES.nombreBotsInitial`), 12 joueurs (`CAPACITES`). Le banc du battement, qui construit la partie sans passer par le réseau, mesure au-delà (jusqu'à 1000 bots). La fiche vise « plus de 100 bots »: les deux bancs y sont.
6. **Deux bancs plutôt qu'un.** Le banc du battement, déterministe, mesure le coût d'une partie et la taille de ses messages; la charge du serveur complet mesure la concurrence de N parties sur un seul fil, l'écriture sur les connexions et la saturation. Voir `docs/mesures/charge-serveur.md`.
7. **Une mesure de plus, non prévue: les populations mêlées.** En calibrant le banc, une partie de 300 bots coûtait 2,3 ms par battement dans un processus neuf et 8,0 ms après une partie de 150 bots, à travail identique à l'octet près. Chaque configuration du banc est donc mesurée dans un processus neuf, et le phénomène est mesuré à part, parce qu'un vrai serveur y est exposé.
8. **Des mesures ajoutées en cours de route pour situer la saturation.** Le premier palier non tenu arrivait avec un processeur du serveur loin de cent pour cent. Pour en trouver la cause, le harnais relève aussi l'occupation du fil du serveur et les pauses du ramasse-miettes, chaque palier réseau tourne dans un processus neuf (un palier joué dans le processus du précédent coûtait deux fois plus cher), et deux mesures complémentaires ont été jouées: les mêmes parties à un seul joueur, et des minuteries isolées, sans jeu ni réseau. Résultat et limites: section 6.3 du rapport.
9. **Aucune modification du code du jeu.** La mesure passe par l'horloge injectée du serveur, enveloppée, et par le rappel de battement qu'une `GameRoom` offre déjà. Changent `tests/charge/`, le script `pnpm charge`, l'autorisation des imports `.ts` dans `tsconfig.tests.json`, et deux commentaires de `packages/shared` (`CAPACITES` et le contrat du flux d'état) qui renvoyaient à cette mesure et en donnent désormais le résultat.

## Rituel de fin de session

Écrire docs/handoffs/etape-5-1-handoff.md. Donner les chiffres clés et indiquer où le serveur sature en premier, car cela oriente l'étape 5.2. Prochaine action exacte pour l'étape 5.2: appliquer, seulement si la mesure le justifie, les optimisations utiles (grille spatiale, niveau de détail d'IA), validées par comparaison avant après. Commiter.
