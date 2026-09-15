# Handoff - Étape 1.1 Squelette du moteur et modèle d'état

Date: 13 août 2026
Auteur: session Claude Code
Statut: terminée

## Objectif de l'étape

Poser le cœur de simulation pur: son contrat, son modèle d'état, le générateur à graine, et y porter les entités de base du legacy.

## Ce qui a été fait

- Un générateur de nombres à graine dans `packages/shared`, sans état caché.
- Le portage des constantes de `legacy/game-constants.js`, avec conversion des vitesses en pixels par seconde.
- Un modèle d'état de partie entièrement en données immuables, portant ses réglages, ses dimensions de carte et sa graine.
- Le portage des classes `Entity` et `Player`, débarrassées de toute entrée-sortie.
- Le moteur `tick(etat, entrees, dt)`, et une évaluation de fin de partie qui constate sans agir.
- Quatre-vingt-deux tests unitaires ajoutés. Couverture de `packages/sim`: 98,89 pour cent.
- Suppression de `packages/shared/src/demo.ts` et de son test, prévue depuis le handoff 0.1.
- Deux dettes d'outillage fermées au passage: les tests ont enfin leurs types vérifiés, et ils ne dépendent plus d'une compilation qui pouvait être périmée.

## Le contrat du moteur, en une page

Les fiches suivantes s'appuient sur ce qui suit. C'est la partie du handoff à lire en priorité.

### La fonction

```ts
tick(etat: EtatPartie, entrees: Entrees, dtMs: number): EtatPartie
```

- **Pure.** Rien n'est modifié sur place, `tick` renvoie un nouvel état.
- **`dtMs` est en millisecondes.** Le moteur ne lit jamais l'horloge et ne suppose aucune cadence: vingt appels à 50 ms produisent le même déplacement qu'un appel à 1000 ms. Un `dt` négatif ou non fini lève une erreur, c'est une faute d'appelant.
- **Partie terminée: l'état est renvoyé tel quel**, sans avancer. Le legacy sortait de même dès que `isGameOver` était vrai.
- **Une entrée adressée à un joueur absent est ignorée.** Un joueur sans entrée s'immobilise.

### Les entrées

```ts
interface EntreeJoueur {
  deplacement: Vecteur; // seule son orientation compte
  enMouvement: boolean;
}
type Entrees = Record<IdentifiantEntite, EntreeJoueur>;
```

Le client indique une direction, jamais une vitesse: le moteur ramène le vecteur à la vitesse du joueur. Envoyer un vecteur mille fois plus grand ne change rien.

### L'état

```ts
interface EtatPartie {
  tick: number; // battements écoulés
  tempsEcouleMs: number;
  dureeMs: number;
  reglages: ReglagesPartie;
  carte: DimensionsCarte; // dimensions de la carte jouée
  joueurs: Record<IdentifiantEntite, Joueur>;
  alea: Alea; // le générateur à graine voyage dans l'état
}

interface Entite {
  id: IdentifiantEntite;
  type: 'joueur' | 'bot' | 'botNoir';
  position: Position;
  couleur: Couleur;
  direction: Direction;
}

interface Joueur extends Entite {
  type: 'joueur';
  pseudo: string;
  protectionSpawnRestanteMs: number;
  tempsDepuisDerniereCaptureMs: number;
}
```

Fonctions de manipulation: `creerEtatInitial`, `ajouterJoueur`, `retirerJoueur`, `couleursUtilisees`, `positionDApparition`, `estInvulnerable`, `peutCapturer`, plus `evaluerFinDePartie` côté moteur.

### Le générateur à graine

Il ne garde aucun état caché. Un tirage renvoie la valeur **et** le générateur suivant:

```ts
const premier = nombre(etat.alea);
const second = nombre(premier.alea); // et non nombre(etat.alea)
```

Conséquence à connaître: toute fonction qui tire au sort doit renvoyer le générateur avancé, sans quoi la partie rejoue le même tirage indéfiniment. C'est ce qui permet de respecter « aucun état global mutable ».

## Fichiers créés ou modifiés

Créés, dans `packages/shared/src/`

- `alea.ts`: le générateur à graine (mulberry32), en version sans mutation.
- `alea.test.ts`: 12 tests. Reproductibilité, bornes, absence de mutation.
- `constantes.ts`: portage de `legacy/game-constants.js`. Vitesses, cartes, durées, apparition, directions, couleurs.
- `constantes.test.ts`: 6 tests. Ils portent sur la conversion des vitesses, c'est-à-dire sur le seul calcul du fichier.
- `reglages.ts`: `ReglagesPartie` et ses valeurs par défaut.
- `geometrie.ts`: types `Position` et `Vecteur`.

Créés, dans `packages/sim/src/`

- `etat.ts`: le modèle d'état, le portage de `Entity` et `Player`, et les fonctions qui font entrer ou sortir un joueur.
- `etat.test.ts`: 18 tests.
- `moteur.ts`: `tick` et `evaluerFinDePartie`.
- `moteur.test.ts`: 27 tests. Pureté, déterminisme, déplacement, minuteries, fin de partie.
- `direction.ts`: portage de `determineDirection` et `updateDirection`, plus deux utilitaires de vecteur.
- `direction.test.ts`: 11 tests.
- `couleurs.ts`: portage de `getRandomColor` et `getUniqueColor`, rendus déterministes.
- `couleurs.test.ts`: 8 tests.

Créés, à la racine

- `tsconfig.tests.json`: vérification des types des fichiers de test et de configuration.
- `tsconfig.e2e.json`: idem pour les scénarios Playwright, seuls autorisés à parler au DOM.

Modifiés

- `packages/shared/src/index.ts` et `packages/sim/src/index.ts`: les points d'entrée exposent le contenu réel.
- `package.json`: le script `typecheck` enchaîne les trois configurations.
- `vitest.config.ts`: alias vers les sources des paquets, et exclusion des fichiers sans code exécutable du calcul de couverture.
- `CLAUDE.md`, `docs/audit/AUDIT-EXISTANT.md`, `docs/design/README.md`, `docs/plan/etape-1-1.md`: voir la section « Suites données aux découvertes ».

Supprimés

- `packages/shared/src/demo.ts` et `demo.test.ts`: la fonction de démonstration de l'étape 0.1 n'avait plus lieu d'être.

Aucune modification de `legacy/`.

## Tests

- Ajoutés: 82 tests unitaires, répartis en six fichiers.
- Résultat: **187 tests Vitest passent, 0 échec** (105 préexistants après retrait des 3 tests de démonstration, plus 82 nouveaux).
- Couverture de `packages/sim`: **98,89 pour cent** des instructions, 98,41 pour cent des branches. La cible est de 80 à 90 pour cent. `packages/shared` est à 100 pour cent. Première mesure du projet: le paquet était vide jusqu'ici.
- Seules lignes non couvertes: le repli de `couleurUnique` quand trente-deux tirages consécutifs tombent tous sur une couleur interdite. Cas hors d'atteinte en pratique, laissé volontairement.
- Types, linter, formatage: verts. Le linter confirme l'absence d'import et d'appel interdits dans `packages/sim`.
- Aucune régression de caractérisation: les 93 tests de `tests/caracterisation/` passent, inchangés.

## Décisions et écarts au plan

1. **Les vitesses passent en pixels par seconde.** C'est la décision structurante de l'étape, consignée au journal de `docs/design/README.md` et détaillée au défaut X17 de l'audit. Le legacy déplace d'une distance fixe par événement: 3 pixels par message de client (toutes les 20 ms), 5 pixels par battement serveur (toutes les 50 ms). Ces deux nombres ne sont pas comparables. Ramenés à la seconde: joueur 150, bot 100. Le joueur est donc **plus rapide** qu'un bot, contrairement à ce que la lecture du legacy laisse croire. Le moteur applique ces vitesses par seconde, ce qui préserve le jeu réellement joué.

2. **Deux formes de minuterie, chacune choisie pour rester fidèle.** La protection d'apparition est un compte à rebours (`protectionSpawnRestanteMs`), parce que le legacy compare `now < spawnProtection`: à trois secondes exactement, la protection est finie des deux côtés. Le délai entre deux captures est au contraire un compteur croissant (`tempsDepuisDerniereCaptureMs`), parce que le legacy compare en inégalité stricte, ce que la caractérisation a figé: refus à exactement 1000 ms, acceptation à 1001. Un compte à rebours aurait décalé la limite d'un battement. Le compteur est plafonné, un nombre qui grandit sans fin n'ayant rien à faire dans un état sérialisé vingt fois par seconde.

3. **Les réglages de partie voyagent dans l'état.** Il n'existe aucun objet de réglages accessible globalement. Le défaut X14 (deux réglages du salon sans effet parce que le code lisait les valeurs par défaut) devient structurellement impossible. Consigné au journal de conception.

4. **Les réglages ne sont portés que partiellement.** Bonus, malus, zones et bots noirs arrivent avec leurs étapes. Ce qui manque est listé en tête de `packages/shared/src/reglages.ts`. Voir la réconciliation ajoutée à la fiche.

5. **Le tirage de position d'apparition est porté sans sa validation.** `positionDApparition` tire une position à cent pixels des bords, comme le legacy, mais ne vérifie ni les murs ni la distance aux autres entités: la carte de collisions n'existe pas encore. C'est l'étape 1.2. Le chemin de secours du legacy, qui plante (défaut X3), n'est pas porté.

6. **Trois champs du legacy ne sont pas portés**, parce qu'ils sont morts: `lastX` et `lastY` (défaut X16, découvert cette session), et `botsControlled` (défaut X11).

7. **Le réglage `blackBotSpeed` n'est pas porté.** Défaut X13, décision du 13 août 2026: on garde la vitesse réellement jouée. Porter un réglage que personne ne lit aurait été recopier le piège.

8. **`Bot` n'est pas porté**, la fiche ne le demande pas et il relève de l'étape 1.5. Le type `Entite` l'attend.

9. **Les tests lisent les paquets dans leurs sources.** Découvert en cours de session: `pnpm test` chargeait `packages/shared/dist`, resté en retard sur les sources, et trois suites échouaient pour cette seule raison. Pire cas possible: une compilation périmée qui aurait fait passer des tests au vert contre du code qui n'existe plus. Corrigé par des alias dans `vitest.config.ts` et par `paths` dans `tsconfig.tests.json`.

## Suites données aux découvertes (règle 7 de CLAUDE.md)

Traitées pendant la session, hors périmètre de l'étape comprises.

- `docs/audit/AUDIT-EXISTANT.md`: section 6 point 5 corrigée, elle annonçait encore le bot noir à 6 alors que la section 2 avait été corrigée à l'étape 0.2. Nouvelle sous-section « Défauts découverts à l'étape 1.1 » avec X16 (champs `lastX` et `lastY` morts) et X17 (les vitesses ne sont pas rapportées à la même horloge).
- `CLAUDE.md`: règle 4 précisée, elle disait que le portage devait « faire passer » les tests de caractérisation, alors qu'ils tournent contre le legacy et servent d'étalon; c'est ce que dit déjà `docs/plan/PROTOCOLE.md`. Point 5 des comportements à préserver complété par la conversion des vitesses.
- `docs/design/README.md`: deux décisions ajoutées au journal, vitesses par seconde et réglages portés par l'état.
- `docs/plan/etape-1-1.md`: section « Réconciliation avec le dépôt ».
- Dette de l'étape 0.2 fermée: `tests/` n'était pas couvert par `tsc --build`, les fichiers de test n'avaient donc jamais leurs types vérifiés. Deux configurations ajoutées, aucune erreur trouvée sur l'existant.

## Problèmes connus et dette

- **`tsc --build` peut laisser une compilation périmée.** Constaté cette session: après modification d'une source, `dist/` n'était pas régénéré, et supprimer un fichier de `dist/` ne le fait pas revenir non plus. `tsc --build --force` corrige. Sans conséquence sur les tests désormais, qui lisent les sources, mais à savoir dès que `packages/server` consommera `packages/sim` compilé.
- **`packages/server` et `packages/client` restent vides.** Normal à ce stade.
- **Le déplacement ne connaît pas encore les murs.** Un joueur est seulement borné à la carte, sur son centre, comme le legacy le fait après résolution. Les collisions arrivent à l'étape 1.2, avec le défaut X15 (`canMove` échantillonne l'arrivée au lieu de balayer le trajet) à traiter par conception.
- **Le facteur mobile et le multiplicateur de bonus ne sont pas appliqués.** Les constantes sont portées, mais le premier relève de l'autorité serveur (étape 1.6, faille S2) et le second des bonus (étape 1.4).
- Le dépôt pèse toujours 157 Mo, `master` reste 6 commits en retard sur `origin/master`, et l'URL du dépôt distant redirige toujours vers `Ninja-NodeJS-Game.git`. Inchangé depuis les handoffs 0.1 et 0.2.

## Prochaine action exacte

Dans une conversation neuve: créer `packages/sim/src/collisions.ts` et y porter `CollisionMap` (legacy/server.js:394 pour `canMove`, :430 pour `checkCollision`) et `PositionManager` (:222) en données pures et taille-agnostiques, puis brancher la résolution du déplacement dans `tick` à la place du simple bornage actuel.

Trois points à trancher dès le début de l'étape 1.2, tous documentés:

1. **Défaut X15**: `canMove` ignore son point de départ, si bien qu'un mur de deux pixels se traverse. À traiter par conception, pas à reproduire. Test de caractérisation concerné: « laisse traverser un mur fin en un seul déplacement ».
2. **Défauts X3 et X4**: le tirage de position d'apparition doit valider la position (murs, distance aux autres entités) sans reproduire le chemin de secours qui plante.
3. La représentation de la carte du legacy est un tableau de booléens à la taille de la carte en pixels, soit six millions d'entrées pour map3. La décision du 29 juin exige des données pures et taille-agnostiques; le coût mémoire est à reconsidérer.

Lire `tests/caracterisation/collisions.test.ts` avant de porter: il décrit précisément ce que le portage doit reproduire, y compris le seuil de luminosité à 128 et les seize points de contour.

## Étape suivante

Fiche à lire: `docs/plan/etape-1-2.md`

Rappel de méthode: une étape égale une conversation. Repartir d'un contexte neuf avec `/clear`. L'ordre d'exécution qui fait foi est celui de la section 3 de `docs/plan/ROADMAP.md`, où 1.2 suit bien 1.1.
