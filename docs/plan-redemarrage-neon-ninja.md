# Plan de redémarrage - Neon Ninja

## 1. Principe directeur

Les refactos précédentes ont échoué pour une raison simple. Il n'y avait aucun filet de sécurité (pas de tests, des sauvegardes de version faites à la main comme `server-v0-8-5.js`). Refactorer sans filet fait peur, donc on abandonne.

Ce redémarrage inverse l'ordre des priorités. On ne construit pas le jeu puis on ajoute des tests. On construit le harnais de test d'abord, on fige le comportement actuel, puis on transplante la logique de jeu morceau par morceau, chaque morceau étant couvert avant d'avancer. Les tests ne sont pas une assurance ajoutée à la fin. Ils sont la condition qui rend la reconstruction possible sans régression.

Deux décisions d'architecture conditionnent toute la testabilité. Elles sont non négociables.

1. **Cœur de simulation pur.** Toute la logique de jeu (déplacements, collisions, captures, bonus, malus, IA des bots, scores) vit dans une fonction sans effet de bord, de la forme `tick(etat, entrees, dt) -> nouvelEtat`. Aucun appel réseau, aucun `Date.now()`, aucun `Math.random()` non maîtrisé à l'intérieur. Le temps et l'aléa sont injectés depuis l'extérieur. Conséquence directe: la logique devient testable comme une simple fonction mathématique, rejouable à l'identique.

2. **Déterminisme.** Le temps passe par le paramètre `dt`. L'aléa passe par un générateur à graine (seed). Deux exécutions avec les mêmes entrées produisent le même résultat. Cela rend les tests reproductibles, et offre en bonus la rejouabilité des parties et le mode spectateur plus tard.

## 2. Stack cible et récupération du legacy

Décisions actées au fil des échanges, rappelées ici.

- Serveur en Node.js conservé. Le langage n'est pas le plafond de scalabilité, c'est l'architecture.
- État encapsulé dans une classe `GameRoom`, plusieurs parties simultanées via un `RoomManager`. C'est le déblocage central pour les parties privées et publiques.
- Rendu in-game migré vers WebGL avec PixiJS, justifié par l'objectif de plus de 100 bots animés et l'esthétique néon (la lueur devient un filtre GPU au lieu du coûteux `shadowBlur` de Canvas 2D).
- Persistance ajoutée pour les comptes et la progression (base de données, authentification).
- Diffusion réseau en delta binaire au lieu de l'état JSON complet à chaque tick.

Proposition complémentaire pertinente: **TypeScript**. Vous faites une réécriture, le coût de migration est donc quasi nul, et le bénéfice est direct sur votre objectif anti-régression. Typer le modèle d'état et surtout les contrats d'événements Socket.IO élimine une classe entière de bugs au moment de la compilation, avant même de lancer un test. Recommandé, mais c'est votre choix.

Ce qu'on récupère du code existant, fichier par fichier. L'objectif est de préserver les deux ans de réglage de gameplay, pas de tout retaper.

| Fichier legacy                               | Destination       | Traitement                                         |
| -------------------------------------------- | ----------------- | -------------------------------------------------- |
| `game-constants.js`                          | `packages/shared` | Conservé quasi tel quel, déjà propre et partagé    |
| `server.js` (classes et fonctions de jeu)    | `packages/sim`    | Porté dans le cœur pur, rendu sans I/O ni horloge  |
| `server.js` (Socket.IO, routes, état global) | `packages/server` | Reconstruit autour de `GameRoom` et `RoomManager`  |
| `MapManager.js`                              | `packages/client` | Déjà modulaire, portage quasi direct               |
| `AudioManager.js`                            | `packages/client` | Déjà modulaire, portage quasi direct               |
| `client.js` (boucle de rendu)                | `packages/client` | Logique de rendu portée vers PixiJS                |
| `client.js` (140 variables globales, menus)  | `packages/client` | Reconstruit avec séparation état et rendu          |
| `styles.css`                                 | `packages/client` | Repris et élagué (3965 lignes, code mort probable) |
| `index.html`                                 | `packages/client` | Reconstruit selon le nouveau client                |
| `server-v0-8-5.js`                           | supprimé          | Doublon d'ancienne version, à retirer              |

## 3. Structure du dépôt

Un monorepo, organisé pour isoler le cœur testable du reste.

```
neon-ninja/
  packages/
    sim/       coeur de simulation pur, zero dependance I/O, le plus testé
    server/    Express, Socket.IO, RoomManager, depend de sim
    client/    PixiJS, UI, menus
    shared/    constantes et types partages (ex game-constants)
  tests/
    e2e/       Playwright, parcours multi-clients
  .github/
    workflows/ CI qui bloque la fusion si rouge
```

Le point clé est que `packages/sim` ne dépend de rien d'autre que de `shared`. Pas de Socket.IO, pas d'Express, pas de DOM. C'est ce qui permet de le tester en isolation, à grande vitesse, sans démarrer ni serveur ni navigateur.

## 4. Stratégie de tests (le pilier)

La pyramide est large à la base (beaucoup de tests unitaires rapides) et fine au sommet (peu de tests E2E lents mais réalistes). Chaque niveau cible ce qu'il sait vraiment vérifier.

### 4.1 Tests de caractérisation (le pont depuis le legacy)

Écrits en tout premier, avant tout portage. Ils capturent le comportement actuel du moteur existant sur les points sensibles (résolution d'une capture, détection de collision, calcul de score, cône de capture). On nourrit le moteur legacy avec une situation précise et on enregistre sa sortie comme référence. Pendant le portage vers `packages/sim`, ces mêmes situations doivent produire la même sortie. C'est ce qui garantit que le ressenti de jeu ne change pas. Outil: Vitest.

### 4.2 Tests unitaires (TU)

La fondation. Ils testent le cœur pur, fonction par fonction, sans réseau ni rendu.

Exemples concrets sur ce jeu.

- Étant donné deux entités à des positions données, la détection de collision renvoie le bon résultat.
- Étant donné un joueur en mode capture orienté dans une direction, le cône inclut bien telle cible et exclut telle autre (les fonctions `checkEntityInCone`, `getAngleBetweenVectors`, `getEntitiesInCaptureRange`).
- Étant donné un bonus ramassé, l'effet correct est appliqué pour la bonne durée.
- Étant donné un état de jeu, le calcul des scores produit le classement attendu.
- Étant donné une situation, un bot choisit la décision attendue (IA déterministe grâce à la graine).

Outil: Vitest (rapide, natif ES modules, cohérent avec votre code). Cible de couverture élevée et exigeante sur `packages/sim` uniquement (80 à 90 pourcent), pas ailleurs. On ne court pas après 100 pourcent partout, on couvre fort là où ça compte, c'est-à-dire le gameplay.

### 4.3 Tests d'intégration (TI)

Ils vérifient que les briques communiquent correctement. Trois familles.

- **Serveur et réseau.** On démarre le serveur, on connecte des clients socket.io-client simulés, et on vérifie les séquences d'événements (entrée dans une room, attribution du propriétaire, démarrage de partie, réception des mises à jour d'état, événements de capture). On teste aussi le cycle de vie d'une room (création, joueurs qui rejoignent et partent, nettoyage quand vide).
- **Contrats d'événements.** Chaque message Socket.IO a un schéma. On vérifie que ce que le serveur émet et ce que le client attend correspondent. En TypeScript, une grande partie est garantie à la compilation, le test couvre le reste.
- **Persistance.** Avec une base de données de test (Postgres jetable via conteneur, ou base en mémoire). On vérifie que la création de compte, l'authentification, la sauvegarde des résultats de partie et la progression persistent correctement.

Outil: Vitest pour l'orchestration, socket.io-client pour les clients simulés, une base de test isolée.

### 4.4 Tests de bout en bout (E2E)

Ils rejouent les parcours réels d'un joueur dans un vrai navigateur. C'est ici que le multijoueur se teste vraiment.

Exemples de parcours critiques.

- Inscription puis connexion, rejoindre une partie publique, jouer, capturer un bot, voir le score, vérifier que la progression est sauvegardée.
- Deux clients simultanés dans une même partie privée (via code d'invitation), l'un capture l'autre, les deux voient un état cohérent. C'est le test multijoueur fondamental.
- Rendu PixiJS: le canvas se monte, le nombre d'entités affichées correspond à l'état serveur, la fréquence d'images ne s'effondre pas.

Outil: Playwright. Il gère plusieurs contextes de navigateur en parallèle, ce qui simule plusieurs joueurs en même temps, fonctionne sur plusieurs navigateurs, et émule les fenêtres mobiles, ce qui compte pour votre cible mobile.

### 4.5 Tests de charge et de performance

Ils dé-risquent directement les deux paris de scalabilité (le serveur multi-room et le rendu de plus de 100 bots).

- **Serveur.** Simuler N rooms peuplées de 100 bots et plus, mesurer le temps de calcul par tick et la taille des messages diffusés. Cela valide le delta binaire et la grille spatiale, et permet de dimensionner la flotte (bots par room multiplié par rooms par cœur).
- **Rendu.** Mesurer la fréquence d'images en PixiJS avec 100, 200 puis 500 sprites animés, avant d'engager tout le jeu sur ce moteur. Validation par la mesure, pas par l'estimation.

Outils: un harnais de charge socket.io (ou artillery) côté serveur, un banc de mesure de fréquence d'images côté client.

### 4.6 CI/CD et règle anti-régression

C'est le mécanisme qui transforme les tests en garantie réelle.

- À chaque poussée de code, la CI lance les TU et les TI. Si c'est rouge, la fusion est bloquée.
- Sur chaque demande de fusion, les E2E tournent en plus.
- La couverture du cœur de simulation est surveillée et ne doit pas baisser.
- Les tests de charge tournent périodiquement (pas à chaque commit, ils sont lents) pour détecter les régressions de performance.

Outil: GitHub Actions. Aucune évolution n'entre dans la branche principale sans passer le filet. C'est exactement la garantie que vous demandez.

## 5. Plan par phases

Chaque phase produit quelque chose de testé et fonctionnel. On ne passe à la suivante que lorsque la couverture de la phase en cours est en place.

**Phase 0. Filet et fondations.**
Mettre en place le dépôt monorepo et un Git propre avec branches (et supprimer les sauvegardes manuelles). Installer le harnais de test vide mais fonctionnel (Vitest, Playwright, CI qui tourne pour de vrai sur un test trivial). Figer la stack (dont la décision TypeScript). Écrire les tests de caractérisation sur le moteur legacy. Livrable: un squelette vide qui sait déjà se tester et déployer.

**Phase 1. Cœur de simulation pur.**
Créer le moteur `tick(etat, entrees, dt) -> nouvelEtat` sans I/O. Y porter la logique de gameplay du `server.js` legacy (entités, joueurs, bots, BlackBot, collisions, captures, bonus, malus, zones). Couvrir à 80 ou 90 pourcent par des TU, validés contre les tests de caractérisation. Livrable: un cœur de jeu qui passe les tests, sans réseau ni rendu. C'est la phase qui valide le plus tôt la préservation du gameplay, avant d'investir ailleurs.

**Phase 2. Serveur et réseau multi-room.**
Construire le `RoomManager` qui instancie des `GameRoom`, avec une boucle de tick par room dont le temps est injecté. Mettre en place la couche Socket.IO avec contrats d'événements typés et delta binaire. Ajouter le matchmaking simple (code pour les parties privées, file pour les publiques). Couvrir par des TI (serveur plus clients simulés, cycle de vie des rooms). Livrable: plusieurs parties jouables en parallèle côté serveur.

**Phase 3. Persistance et comptes.**
Choisir la base (Postgres recommandé pour une progression structurée). Définir le schéma comptes, progression, résultats de partie. Ajouter l'authentification. Brancher la progression sur la fin de partie. Couvrir par des TI avec base de test. Livrable: des comptes persistants qui progressent après chaque partie.

**Phase 4. Client et rendu PixiJS.**
Construire le squelette client propre avec séparation état et rendu. Porter le rendu in-game vers PixiJS (réutiliser la logique de rendu existante, lueur néon en filtre GPU). Reconstruire les menus et l'UI. Couvrir par des E2E Playwright sur les parcours critiques, en multi-clients et en fenêtre mobile. Livrable: le jeu complet, jouable de bout en bout, testé.

**Phase 5. Charge, performance, durcissement.**
Lancer les tests de charge (N rooms multipliées par 100 bots et plus) et le banc de mesure du rendu. Appliquer les optimisations validées par la mesure (grille spatiale pour les collisions, niveau de détail sur l'IA des bots lointains si nécessaire). Déployer en parallèle de l'ancien (déploiement séparé ou drapeau de fonctionnalité). Livrable: une version qui tient la charge cible, prête à recevoir des joueurs.

**Phase 6. Bascule et retrait du legacy.**
Migrer progressivement les joueurs, surveiller, puis retirer l'ancien monolithe. Livrable: le legacy éteint, la nouvelle base en production.

## 6. Ordre de priorité et dé-risquage

L'ordre n'est pas négociable sur un point. Le cœur de simulation pur (phase 1) vient avant le réseau, le client et la persistance. Raison: c'est l'élément le plus risqué (préserver deux ans de réglage de gameplay) et le plus rapide à valider une fois isolé et testé. Si le portage du cœur passe les tests de caractérisation, le reste suit avec un risque maîtrisé. Si vous commencez par le client ou le réseau, vous investissez sur une fondation non encore prouvée.

Le second dé-risquage tôt est le banc de mesure PixiJS (un test de fréquence d'images avec 100 à 500 sprites), à faire dès la phase 0 ou 1 en parallèle, pour confirmer le choix du moteur de rendu avant d'y engager tout le client.

## 7. Risques et garde-fous

- **Syndrome du second système.** Le risque d'une réécriture est de vouloir tout perfectionner. Garde-fou: le cœur pur porte la logique existante quasi à l'identique, validée par les tests de caractérisation. On ne réinvente pas le gameplay, on le déménage.
- **Période sans jeu jouable.** Garde-fou: les phases livrent du fonctionnel à chaque étape, et le cœur testable existe dès la phase 1. On mesure l'avancement, on ne reste pas des mois sans rien.
- **Bascule risquée.** Garde-fou: déploiement en parallèle de l'ancien, bascule progressive, pas d'arrêt sec.
- **Tests fragiles.** Les E2E temps réel peuvent devenir instables. Garde-fou: le gros de la vérification se fait en TU sur le cœur déterministe (rapide et stable), les E2E restent peu nombreux et ciblés sur les parcours vraiment critiques.
